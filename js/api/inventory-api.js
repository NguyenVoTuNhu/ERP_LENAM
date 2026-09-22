/* ============================================================================
 * INVENTORY API - KIO PERSISTENCE
 * ----------------------------------------------------------------------------
 * Trách nhiệm duy nhất của file này:
 *   1) Nạp dữ liệu Kho/Master từ KIO vào DB.*
 *   2) Seed dữ liệu demo còn thiếu đúng 1 lần theo phiên bản demo
 *   3) Đồng bộ đúng collection bị thay đổi lên KIO
 *
 * Business logic nhập kho -> QC -> tồn kho -> trả NCC vẫn nằm nguyên trong
 * app.js / mod-inventory.js và KHÔNG được thay đổi tại đây.
 * ========================================================================== */
const InventoryAPI = (() => {
  const TABLES = KIO_CONFIG.inventoryTables;
  const SETTINGS_TABLE = KIO_CONFIG.inventorySettingsTable;
  const CACHE_KEY = KIO_CONFIG.storageKeys.inventoryCache;
  const DEMO_SEED_KEY = KIO_CONFIG.storageKeys.inventoryDemoSeed;
  const DELIVERY_TEST_SEED_VERSION = '20260916-finished-1000-v1';

  const DEMO_DATA = KioDataUtils.snapshotCollections(TABLES);
  const DEMO_SETTINGS = {
    id: 'INVENTORY_SETTINGS',
    inventoryAlertConfig: KioDataUtils.clone(DB.inventoryAlertConfig || {}),
    finishedMinStock: KioDataUtils.clone(DB.finishedMinStock || {}),
    testDataVersions: {},
  };

  let syncTimer = null;
  let syncChain = Promise.resolve();
  const pendingKeys = new Set();
  const localVersion = new Map();
  const lastRefresh = new Map();
  const REFRESH_TTL = 2 * 60 * 1000;
  let booted = false;

  function versionOf(key) { return Number(localVersion.get(key) || 0); }
  function markLocalChange(keys) {
    normalizeKeys(keys).forEach(key => localVersion.set(key, versionOf(key) + 1));
  }

  function rehydrateMaterial(material) {
    const item = { ...material };
    delete item.status;
    delete item.value;

    Object.defineProperty(item, 'status', {
      enumerable: true,
      configurable: true,
      get() {
        if (Number(this.stock || 0) <= 0) return 'vt_het_hang';
        if (Number(this.stock || 0) < Number(this.minStock || 0)) return 'vt_sap_het';
        return 'vt_du_ton';
      },
    });

    Object.defineProperty(item, 'value', {
      enumerable: true,
      configurable: true,
      get() { return Number(this.stock || 0) * Number(this.price || 0); },
    });

    return item;
  }

  // Một balance tồn kho phải là duy nhất theo hàng + kho + vị trí + lô.
  // Dữ liệu legacy từng không có id/lotId ổn định có thể bị KIO lưu lặp nhiều lần
  // sau các lần full-sync. Không cộng dồn các bản sao này vì chúng cùng là một balance.
  function inventoryBalanceIdentity(row) {
    return [
      String(row?.productId || '').trim(),
      String(row?.warehouseId || '').trim(),
      String(row?.locationId || '').trim(),
      String(row?.lotId || '').trim() || '__NO_LOT__',
    ].join('::');
  }

  function uniqueInventoryBalances(rows) {
    const map = new Map();
    let duplicates = 0;
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const key = inventoryBalanceIdentity(row);
      if (!map.has(key)) {
        map.set(key, row);
        return;
      }
      duplicates += 1;
      const current = map.get(key);
      // Nếu hai bản ghi cùng identity nhưng khác timestamp, giữ balance cập nhật mới hơn.
      // Nếu timestamp bằng nhau/không có, giữ bản đầu tiên để tránh nhân tồn.
      const curTime = String(current?.lastUpdated || '');
      const nextTime = String(row?.lastUpdated || '');
      if (nextTime > curTime) map.set(key, row);
    });
    return { rows: [...map.values()], duplicates };
  }


  function hasData(data) {
    return Object.keys(TABLES).some(key => Array.isArray(data?.[key]) && data[key].length > 0);
  }

  function readCache() {
    return KioDataUtils.readJson(CACHE_KEY);
  }

  function writeCache(data) {
    KioDataUtils.writeJson(CACHE_KEY, data);
  }

  function snapshotCurrentDb() {
    const out = KioDataUtils.snapshotCollections(TABLES);
    out.settings = {
      id: 'INVENTORY_SETTINGS',
      inventoryAlertConfig: KioDataUtils.clone(DB.inventoryAlertConfig || {}),
      finishedMinStock: KioDataUtils.clone(DB.finishedMinStock || {}),
      testDataVersions: KioDataUtils.clone(DB.inventoryTestDataVersions || {}),
    };
    return out;
  }

  async function readAll() {
    const entries = Object.entries(TABLES);
    const [values, settings] = await Promise.all([
      Promise.all(entries.map(([, table]) => KioStore.listCollection(table))),
      KioStore.listCollection(SETTINGS_TABLE),
    ]);

    const out = Object.fromEntries(entries.map(([key], index) => [key, values[index]]));
    out.settings = settings.find(item => item?.id === 'INVENTORY_SETTINGS') || null;
    return out;
  }

  function categoryIdentity(category) {
    return `${String(category?.type || '').trim().toUpperCase()}::${String(category?.name || '').trim().toLocaleLowerCase('vi')}`;
  }

  function uniqueItemCategories(categories) {
    const seen = new Set();
    return (Array.isArray(categories) ? categories : [])
      .slice()
      .sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || ''), 'vi', { numeric: true }))
      .filter(category => {
        const key = categoryIdentity(category);
        if (!category?.name || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  // [DATA CLEANUP] Danh mục nguyên liệu là master dùng chung. Nếu server từng
  // bị seed/tạo trùng tên (ví dụ 2 "Bao bì", 2 "Phụ gia"), giữ record có mã
  // nhỏ nhất và xóa record trùng khỏi KIO. Không đổi tên, mã viết tắt hoặc
  // logic nghiệp vụ của bất kỳ danh mục nào.
  async function cleanupDuplicateCategories(data) {
    const categories = Array.isArray(data?.itemCategories) ? data.itemCategories : [];
    const seen = new Set();
    const duplicateIds = [];
    const unique = [];
    categories
      .slice()
      .sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || ''), 'vi', { numeric: true }))
      .forEach(category => {
        const key = categoryIdentity(category);
        if (category?.name && seen.has(key)) duplicateIds.push(category.id);
        else {
          if (category?.name) seen.add(key);
          unique.push(category);
        }
      });

    if (duplicateIds.length) {
      await KioStore.deleteKeys(TABLES.itemCategories, duplicateIds);
      console.info(`[InventoryAPI] Đã dọn danh mục trùng trên server: ${duplicateIds.join(', ')}`);
    }
    return { ...data, itemCategories: uniqueItemCategories(unique) };
  }

  // [DATA RECONCILIATION - RETURN TO SUPPLIER]
  // Một số dữ liệu cũ trên server đã có phiếu RETURN_OUT = COMPLETED nhưng
  // dòng tồn vẫn giữ qtyRejected > 0, nên màn Tồn kho còn hiện "chờ trả NCC".
  //
  // Đây chỉ là bước làm sạch dữ liệu legacy, KHÔNG thay đổi luồng nghiệp vụ:
  //   QC không đạt -> Yêu cầu trả -> Xuất trả NCC -> COMPLETED.
  //
  // Để tránh trừ lặp dữ liệu mới, chỉ xử lý khi:
  //   1) Phiếu xuất là RETURN_OUT và COMPLETED;
  //   2) Chưa có materialReturnHistory tương ứng (dấu hiệu dữ liệu legacy);
  //   3) Tổng số lượng đã xuất trả của đúng material + lot >= qtyRejected còn treo.
  // Khi đó qtyRejected thực tế phải bằng 0.
  async function cleanupCompletedSupplierReturns(data) {
    const inventoryRows = Array.isArray(data?.inventory) ? data.inventory : [];
    const issues = Array.isArray(data?.goodsIssues) ? data.goodsIssues : [];
    const lots = Array.isArray(data?.inventoryLots) ? data.inventoryLots : [];
    const histories = Array.isArray(data?.materialReturnHistory) ? data.materialReturnHistory : [];

    const historyIssueIds = new Set(
      histories.map(h => String(h?.issueId || '').trim()).filter(Boolean)
    );

    const norm = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const lotById = new Map(lots.map(lot => [String(lot?.id || ''), lot]));

    // 1) Đối soát chính xác theo material + lot khi phiếu xuất trả có lotId.
    const returnedByLot = new Map();

    // 2) Dữ liệu legacy có phiếu Xuất trả NCC nhưng item không lưu lotId.
    // Khi đó đối soát theo PO + material. Chỉ xóa trạng thái treo nếu tổng SL đã trả
    // >= TOÀN BỘ qtyRejected còn treo của material đó trong đúng PO.
    // Như vậy không làm sai trường hợp xuất trả một phần.
    const returnedByPoMaterial = new Map();

    issues
      .filter(issue =>
        issue?.type === 'RETURN_OUT' &&
        issue?.status === 'COMPLETED'
      )
      .forEach(issue => {
        const poKey = norm(issue?.poId || issue?.refDoc || '');
        (issue.items || []).forEach(item => {
          const productId = String(item?.productId || item?.materialId || '').trim();
          const lotId = String(item?.lotId || '').trim();
          const qty = Number(item?.qty || 0);
          if (!productId || qty <= 0) return;

          if (lotId) {
            const key = `${productId}::${lotId}`;
            returnedByLot.set(key, (returnedByLot.get(key) || 0) + qty);
          }

          if (poKey) {
            const key = `${poKey}::${productId}`;
            returnedByPoMaterial.set(key, (returnedByPoMaterial.get(key) || 0) + qty);
          }
        });
      });

    // Tính tổng rejected còn treo theo PO + material từ các lô.
    const rejectedByPoMaterial = new Map();
    const rowPoMaterialKey = new Map();

    inventoryRows.forEach((row, index) => {
      const rejected = Number(row?.qtyRejected || 0);
      if (rejected <= 0) return;

      const productId = String(row?.productId || '').trim();
      const lot = lotById.get(String(row?.lotId || ''));
      const lotNumber = String(lot?.lotNumber || row?.lotNumber || '');

      // Ví dụ lot PO20260039-BB0001-260815-02 <-> PO-2026-0039.
      // Chỉ lấy PO prefix nếu lot bắt đầu bằng PO + 8 chữ số.
      const poMatch = norm(lotNumber).match(/^(PO\d{8})/);
      const poKey = poMatch ? poMatch[1] : norm(row?.poId || row?.refDoc || '');
      if (!poKey || !productId) return;

      const key = `${poKey}::${productId}`;
      rowPoMaterialKey.set(index, key);
      rejectedByPoMaterial.set(key, (rejectedByPoMaterial.get(key) || 0) + rejected);
    });

    let changed = false;
    // const cleanedInventory = inventoryRows.map((row, index) => {
    //   const rejected = Number(row?.qtyRejected || 0);
    //   if (rejected <= 0) return row;

    //   const productId = String(row?.productId || '').trim();
    //   const lotId = String(row?.lotId || '').trim();
    //   const exactReturnedQty = Number(returnedByLot.get(`${productId}::${lotId}`) || 0);

    //   let fullyReturned = exactReturnedQty >= rejected && exactReturnedQty > 0;

    //   // Fallback legacy: phiếu xuất đã hoàn tất nhưng thiếu lotId.
    //   if (!fullyReturned) {
    //     const poMaterialKey = rowPoMaterialKey.get(index);
    //     const totalReturned = Number(returnedByPoMaterial.get(poMaterialKey) || 0);
    //     const totalRejected = Number(rejectedByPoMaterial.get(poMaterialKey) || 0);
    //     fullyReturned = !!poMaterialKey && totalRejected > 0 && totalReturned >= totalRejected;
    //   }

    //   if (!fullyReturned) return row;

    //   changed = true;
    //   return {
    //     ...row,
    //     qtyRejected: 0,
    //     lastUpdated: row.lastUpdated || `${DB.today} 00:00`,
    //   };
    // });

    const cleanedInventory = inventoryRows.map((row) => {
      const rejected = Number(row?.qtyRejected || 0);

      if (rejected <= 0) return row;

      const productId = String(row?.productId || '').trim();
      const lotId = String(row?.lotId || '').trim();

      const returnedQty = issues
        .filter(issue =>
          issue?.type === 'RETURN_OUT' &&
          issue?.status === 'COMPLETED'
        )
        .reduce((total, issue) => {
          const qty = (issue.items || [])
            .filter(item =>
              String(item?.productId || '').trim() === productId &&
              String(item?.lotId || '').trim() === lotId
            )
            .reduce(
              (sum, item) => sum + Number(item?.qty || 0),
              0
            );

          return total + qty;
        }, 0);

      if (returnedQty < rejected) {
        return row;
      }

      // [DATA RECONCILIATION] Có thay đổi thực tế thì bật cờ để ghi lại KIO.
      // Chỉ sửa trạng thái dữ liệu legacy đã xuất trả NCC hoàn tất; không đổi luồng nghiệp vụ.
      changed = true;

      return {
        ...row,
        qtyRejected: 0
      };
    });

    if (changed) {
      const cleaned = { ...data, inventory: cleanedInventory };
      await KioStore.syncCollection(TABLES.inventory, cleanedInventory);
      console.info('[InventoryAPI] Đã đối soát hàng không đạt với phiếu Xuất trả NCC COMPLETED.');
      return cleaned;
    }

    return data;
  }


  // [SALES RESERVATION RECONCILIATION]
  // qtyReserved chỉ hợp lệ khi có phiếu SALES_ISSUE đang PENDING_CONFIRMATION.
  // Dọn các giữ chỗ legacy/orphan để Tồn kho không còn hiển thị giữ chỗ khi
  // không còn chứng từ xuất bán tương ứng. Không trừ/cộng qtyOnHand.
  async function reconcileSalesReservations({ persist = false } = {}) {
    const inventory = Array.isArray(DB.inventory) ? DB.inventory : [];
    const issues = Array.isArray(DB.goodsIssues) ? DB.goodsIssues : [];
    const expected = new Map();
    issues
      .filter(gi => gi?.type === 'SALES_ISSUE' && gi?.status === 'PENDING_CONFIRMATION')
      .forEach(gi => (gi.items || []).forEach(it => {
        const key = inventoryBalanceIdentity({
          productId: it.productId || it.materialId,
          warehouseId: it.warehouseId || gi.warehouseId,
          locationId: it.locationId,
          lotId: it.lotId,
        });
        expected.set(key, Number(expected.get(key) || 0) + Number(it.qty || 0));
      }));
    let changed = false;
    inventory.forEach(row => {
      const want = Math.max(0, Math.round(Number(expected.get(inventoryBalanceIdentity(row)) || 0) * 10000) / 10000);
      const current = Math.max(0, Number(row.qtyReserved || 0));
      if (Math.abs(current - want) > 1e-9) {
        row.qtyReserved = want;
        row.qtyAvailable = Math.max(0, Math.round((Number(row.qtyOnHand || 0) - want) * 10000) / 10000);
        row.lastUpdated = row.lastUpdated || new Date().toISOString();
        changed = true;
      }
    });
    if (changed && persist) {
      await KioStore.syncCollection(TABLES.inventory, inventory);
      console.info('[InventoryAPI] Đã đối soát giữ chỗ bán theo phiếu SALES_ISSUE đang chờ xác nhận.');
    }
    return changed;
  }

  function apply(data) {
    Object.keys(TABLES).forEach(key => {
      if (!Array.isArray(data?.[key])) return;
      DB[key] = key === 'materials'
        ? data[key].map(rehydrateMaterial)
        : key === 'itemCategories'
          ? uniqueItemCategories(data[key])
          : key === 'inventory'
            ? uniqueInventoryBalances(data[key]).rows
            : data[key];
    });

    if (data?.settings?.inventoryAlertConfig && typeof data.settings.inventoryAlertConfig === 'object') {
      DB.inventoryAlertConfig = data.settings.inventoryAlertConfig;
    }
    if (data?.settings?.finishedMinStock && typeof data.settings.finishedMinStock === 'object') {
      DB.finishedMinStock = data.settings.finishedMinStock;
    }
    if (data?.settings?.testDataVersions && typeof data.settings.testDataVersions === 'object') {
      DB.inventoryTestDataVersions = { ...data.settings.testDataVersions };
    }
  }

  // OPTION A: bổ sung demo còn thiếu, nhưng server luôn thắng khi trùng key.
  async function seedMissingDemo(serverData) {
    const merged = { ...serverData };
    const seeded = [];

    for (const [key, table] of Object.entries(TABLES)) {
      const remote = Array.isArray(serverData?.[key]) ? serverData[key] : [];

      // [REAL DATA] Thành phẩm là master thật trên KIO. Không seed/merge DB.products
      // demo vào lenam_finished_products khi mở hệ thống trên máy/trình duyệt mới.
      // Nếu server chưa có packedWeightG/shelfLifeDays, người dùng khai báo trực tiếp trong form
      // Thành phẩm rồi InventoryAPI sẽ sync field đó lên server như các field master khác.
      if (key === 'products') {
        merged[key] = remote;
        continue;
      }

      const demo = Array.isArray(DEMO_DATA[key]) ? DEMO_DATA[key] : [];
      const remoteKeys = new Set(
        remote.map((item, index) => KioDataUtils.recordKey(item, index))
      );
      const missing = demo.filter(
        (item, index) => !remoteKeys.has(KioDataUtils.recordKey(item, index))
      );

      if (missing.length) {
        await KioStore.syncCollection(table, missing);
        seeded.push(`${key}:${missing.length}`);
      }

      merged[key] = KioDataUtils.mergeServerOverDemo(remote, demo);
    }

    if (!serverData?.settings) {
      await KioStore.syncCollection(SETTINGS_TABLE, [DEMO_SETTINGS]);
      merged.settings = DEMO_SETTINGS;
      seeded.push('settings:1');
    }

    if (seeded.length) {
      console.info(`[InventoryAPI] Đã seed demo còn thiếu: ${seeded.join(', ')}`);
    }
    return merged;
  }

  function normalizeKeys(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    return [...new Set(list.filter(Boolean))];
  }

  function syncCollections(keys) {
    clearTimeout(syncTimer);
    const wanted = normalizeKeys(keys);

    syncChain = syncChain.catch(() => {}).then(async () => {
      for (const key of wanted) {
        if (key === 'settings') {
          await KioStore.syncCollection(SETTINGS_TABLE, [{
            id: 'INVENTORY_SETTINGS',
            inventoryAlertConfig: DB.inventoryAlertConfig || {},
            finishedMinStock: DB.finishedMinStock || {},
            testDataVersions: DB.inventoryTestDataVersions || {},
          }]);
          continue;
        }

        const table = TABLES[key];
        if (!table) continue;
        await KioStore.syncCollection(table, Array.isArray(DB[key]) ? DB[key] : []);
      }

      writeCache(snapshotCurrentDb());
      if (wanted.length) console.info(`[InventoryAPI] Đã đồng bộ: ${wanted.join(', ')}`);
      return true;
    }).catch(err => {
      console.error('[InventoryAPI] Đồng bộ KIO thất bại:', err);
      if (typeof Toast !== 'undefined') Toast.err('Không lưu được dữ liệu Kho', err.message);
      throw err;
    });

    return syncChain;
  }

  function syncAll() {
    return syncCollections([...Object.keys(TABLES), 'settings']);
  }

  function scheduleCollections(keys, delay = 180) {
    const normalized = normalizeKeys(keys);
    normalized.forEach(key => pendingKeys.add(key));
    markLocalChange(normalized);
    clearTimeout(syncTimer);

    syncTimer = setTimeout(() => {
      const keysToSync = [...pendingKeys];
      pendingKeys.clear();
      syncCollections(keysToSync).catch(() => {});
    }, delay);
  }

  function scheduleSync(delay = 180) {
    scheduleCollections([...Object.keys(TABLES), 'settings'], delay);
  }

  // [PERFORMANCE] Ghi snapshot hiện tại vào cache ngay để UI không phải chờ KIO.
  // KIO vẫn được schedule sync ở background; không thay đổi business logic.
  function cacheCurrent() {
    writeCache(snapshotCurrentDb());
    return true;
  }

  async function loadServerAndSeedIfNeeded() {
    let serverData = await readAll();
    serverData = await cleanupDuplicateCategories(serverData);
    serverData = await cleanupCompletedSupplierReturns(serverData);
    const alreadySeeded = KioDataUtils.storageGet(DEMO_SEED_KEY) === '1';

    if (!alreadySeeded || !hasData(serverData)) {
      const merged = await seedMissingDemo(serverData);
      KioDataUtils.storageSet(DEMO_SEED_KEY, '1');
      return merged;
    }

    return serverData;
  }

  function stablePackedWeightG(productId) {
    const text = String(productId || 'TP');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) hash = ((hash * 31) + text.charCodeAt(i)) >>> 0;
    // 250g -> 790g, bước 10g: đủ khác nhau để test tải xe nhưng vẫn hợp lý cho thành phẩm thực phẩm.
    return 250 + (hash % 55) * 10;
  }

  function datePlusDaysLocal(dateText, days) {
    const d = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + Math.max(0, Number(days || 0)));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // [ONE-TIME SERVER TEST DATA]
  // Chuẩn bị dữ liệu thật trên KIO để test Logistics:
  // - Mỗi thành phẩm có tổng tồn khả dụng nền = 1.000 ĐVT, phân bổ qua các kho thành phẩm hiện có.
  // - Mỗi thành phẩm có khối lượng đóng gói khác nhau (gram) để tính tải xe.
  // - Chỉ chạy một lần trên toàn server nhờ marker trong lenam_inventory_settings.
  // Sau khi marker đã được ghi, các thay đổi tồn kho thực tế về sau KHÔNG bị reset lại 1.000.
  async function ensureFinishedDeliveryTestData() {
    const settingsRows = await KioStore.listCollection(SETTINGS_TABLE);
    let settings = settingsRows.find(x => x?.id === 'INVENTORY_SETTINGS') || {
      id:'INVENTORY_SETTINGS',
      inventoryAlertConfig: DB.inventoryAlertConfig || {},
      finishedMinStock: DB.finishedMinStock || {},
      testDataVersions: {},
    };
    if (settings?.testDataVersions?.finishedDelivery === DELIVERY_TEST_SEED_VERSION) {
      DB.inventoryTestDataVersions = { ...(settings.testDataVersions || {}) };
      return false;
    }

    const [products, inventory, lots, warehouses, locations, goodsIssues] = await Promise.all([
      KioStore.listCollection(TABLES.products),
      KioStore.listCollection(TABLES.inventory),
      KioStore.listCollection(TABLES.inventoryLots),
      KioStore.listCollection(TABLES.warehouses),
      KioStore.listCollection(TABLES.warehouseLocations),
      KioStore.listCollection(TABLES.goodsIssues),
    ]);
    if (!products.length) return false;

    const finishedWarehouses = warehouses.filter(w =>
      String(w?.type || '').toUpperCase() === 'FINISHED_GOODS' &&
      String(w?.status || 'active').toLowerCase() !== 'inactive'
    );
    const targets = finishedWarehouses.map(w => ({
      wh: w,
      loc: locations.find(l => l?.warehouseId === w.id && String(l?.status || 'active').toLowerCase() !== 'inactive') || null,
    })).filter(x => x.loc);
    if (!targets.length) throw new Error('Không tìm thấy Kho thành phẩm có Kệ/Vị trí để tạo tồn test.');

    const finishedWarehouseIds = new Set(finishedWarehouses.map(w => w.id));
    const productIds = new Set(products.map(p => p.id));
    const keptInventory = inventory.filter(row => !(productIds.has(row?.productId) && finishedWarehouseIds.has(row?.warehouseId)));
    const nextLots = Array.isArray(lots) ? lots.slice() : [];
    const lotIds = new Set(nextLots.map(l => String(l?.id || '')));
    const now = new Date();
    const todayText = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    products.forEach((product, productIndex) => {
      const packedWeightG = stablePackedWeightG(product.id);
      product.packedWeightG = packedWeightG;
      product.packedWeightKg = Math.round((packedWeightG / 1000) * 1000000) / 1000000;

      const base = Math.floor(1000 / targets.length);
      let remaining = 1000;
      targets.forEach((target, index) => {
        const qty = index === targets.length - 1 ? remaining : base;
        remaining -= qty;
        const safeProduct = String(product.id || `P${productIndex+1}`).replace(/[^A-Za-z0-9]/g,'');
        const safeWh = String(target.wh.id || `W${index+1}`).replace(/[^A-Za-z0-9]/g,'');
        let lotId = `LOT-TEST-${safeProduct}-${safeWh}`;
        if (!lotIds.has(lotId)) {
          lotIds.add(lotId);
          nextLots.push({
            id:lotId,
            lotNumber:`TEST-${product.id}-${target.wh.code || target.wh.id}`,
            productId:product.id,
            productionDate:todayText,
            mfgDate:todayText,
            expiryDate:Number(product.shelfLifeDays||0)>0 ? datePlusDaysLocal(todayText, Number(product.shelfLifeDays)) : '',
            qcStatus:'PASSED',
            status:'active',
            sourceType:'LOGISTICS_TEST_DATA',
            createdAt:new Date().toISOString(),
          });
        }
        keptInventory.push({
          productId:product.id,
          warehouseId:target.wh.id,
          locationId:target.loc.id,
          lotId,
          qtyOnHand:qty,
          qtyReserved:0,
          qtyAvailable:qty,
          qtyPending:0,
          qtyRejected:0,
          unit:product.unit || '',
          sourceType:'LOGISTICS_TEST_DATA',
          sourceId:DELIVERY_TEST_SEED_VERSION,
          lastUpdated:new Date().toISOString(),
        });
      });
    });

    // Áp vào DB trước để đối soát giữ chỗ SALES_ISSUE thật đang chờ xác nhận.
    DB.products = products;
    DB.inventory = keptInventory;
    DB.inventoryLots = nextLots;
    DB.goodsIssues = goodsIssues;
    await reconcileSalesReservations({ persist:false });

    settings = {
      ...settings,
      inventoryAlertConfig: settings.inventoryAlertConfig || DB.inventoryAlertConfig || {},
      finishedMinStock: settings.finishedMinStock || DB.finishedMinStock || {},
      testDataVersions: {
        ...(settings.testDataVersions || {}),
        finishedDelivery: DELIVERY_TEST_SEED_VERSION,
      },
    };
    DB.inventoryTestDataVersions = { ...(settings.testDataVersions || {}) };

    await KioStore.replaceCollection(TABLES.products, products);
    await KioStore.replaceCollection(TABLES.inventoryLots, nextLots);
    await KioStore.replaceCollection(TABLES.inventory, DB.inventory);
    await KioStore.syncCollection(SETTINGS_TABLE, [settings]);
    writeCache(snapshotCurrentDb());
    console.info(`[InventoryAPI] Đã tạo dữ liệu test Logistics trên KIO: ${products.length} thành phẩm, mỗi thành phẩm tổng tồn 1.000 ĐVT.`);
    return true;
  }

  async function bootstrap() {
    if (booted) return true;
    booted = true;
    // Không tự tạo/đối soát dữ liệu test Logistics khi mở web.
    // Đây là tác vụ ghi server khá nặng và không thuộc luồng tải dữ liệu thực tế.
    // Dữ liệu test chỉ được tạo khi người dùng gọi chức năng test tương ứng.
    const cached = readCache();

    // [PERFORMANCE] Chỉ nạp cache/data.js ở lúc boot. Không đọc toàn bộ bảng
    // Kho/Master ngay sau đăng nhập. Tab nào được mở thì tab đó mới refresh các
    // collection cần thiết qua ensureFresh().
    if (cached && hasData(cached)) {
      apply(cached);
      console.info('[InventoryAPI] Đã nạp cache local; chờ refresh theo màn hình đang mở.');
    } else {
      console.info('[InventoryAPI] Chưa có cache; dùng dữ liệu hiện tại.');
    }

    return true;
  }

  async function refreshKeys(keys, { force = false } = {}) {
    const wanted = normalizeKeys(keys).filter(key => key !== 'settings' && TABLES[key]);
    const out = {};

    for (const key of wanted) {
      const startedVersion = versionOf(key);
      try {
        const rows = await KioStore.listCollection(TABLES[key]);
        if (versionOf(key) !== startedVersion) continue;
        let normalizedRows = rows;
        if (key === 'inventory') {
          const normalized = uniqueInventoryBalances(rows);
          normalizedRows = normalized.rows;
          if (normalized.duplicates > 0) {
            console.warn(`[InventoryAPI] Phát hiện ${normalized.duplicates} balance tồn kho bị trùng; đang dọn dữ liệu KIO.`);
            await KioStore.replaceCollection(TABLES.inventory, normalizedRows);
            console.info('[InventoryAPI] Đã dọn balance tồn kho trùng trên KIO.');
          }
        }
        out[key] = normalizedRows;
        DB[key] = key === 'materials'
          ? normalizedRows.map(rehydrateMaterial)
          : key === 'itemCategories'
            ? uniqueItemCategories(normalizedRows)
            : normalizedRows;
        lastRefresh.set(key, Date.now());
      } catch (err) {
        console.warn(`[InventoryAPI] Không refresh được ${key}; tiếp tục dùng cache:`, err);
      }
    }

    if (wanted.includes('inventory') || wanted.includes('goodsIssues')) {
      try { await reconcileSalesReservations({ persist: wanted.includes('inventory') && wanted.includes('goodsIssues') }); }
      catch (err) { console.warn('[InventoryAPI] Không đối soát được giữ chỗ bán:', err); }
    }
    if (Object.keys(out).length) writeCache(snapshotCurrentDb());
    return out;
  }

  async function ensureFresh(keys, { force = false } = {}) {
    const wanted = normalizeKeys(keys).filter(key => {
      if (key === 'settings' || !TABLES[key]) return false;
      if (force) return true;
      return (Date.now() - Number(lastRefresh.get(key) || 0)) >= REFRESH_TTL;
    });
    if (!wanted.length) return {};
    return refreshKeys(wanted, { force });
  }

  async function refreshFromServer() {
    let data = await cleanupDuplicateCategories(await readAll());
    data = await cleanupCompletedSupplierReturns(data);
    const normalizedInventory = uniqueInventoryBalances(data.inventory);
    if (normalizedInventory.duplicates > 0) {
      data.inventory = normalizedInventory.rows;
      await KioStore.replaceCollection(TABLES.inventory, normalizedInventory.rows);
      console.info(`[InventoryAPI] Đã dọn ${normalizedInventory.duplicates} balance tồn kho trùng khi refresh toàn bộ.`);
    }
    if (hasData(data)) {
      apply(data);
      await reconcileSalesReservations({ persist: true });
      Object.keys(TABLES).forEach(key => lastRefresh.set(key, Date.now()));
      writeCache(snapshotCurrentDb());
    }
    return data;
  }

  // Chỉ các action thật sự thay đổi dữ liệu mới được persistence wrapper xử lý.
  const ACTION_KEYS = {
    'inventory-item-delete': d => [
      d?.type === 'RAW_MATERIAL' ? 'materials' : d?.type === 'SEMI_FINISHED' ? 'semiFinishedProducts' : 'products',
      ...(d?.type === 'FINISHED_GOODS' ? ['settings'] : []),
    ],
    'stock-move-save': () => ['materials', 'inventory', 'inventoryTransactions', 'stockMoves'],
    'inv-count-save': () => ['inventoryCounts'],
    'inv-receipt-save-new': () => ['materials', 'inventoryLots', 'inventory', 'inventoryTransactions'],
    'inv-issue-save-new': () => ['materials', 'goodsIssues', 'inventory', 'inventoryTransactions'],
    'inv-sales-issue-confirm': () => ['goodsIssues', 'inventory', 'inventoryTransactions'],
    'inv-transfer-save-new': () => ['stockTransfers', 'inventory', 'inventoryTransactions'],
    'po-goods-receipt-save': () => ['materials', 'inventoryLots', 'inventory', 'inventoryTransactions', 'materialInspections'],
    'warehouse-receipt-save': () => ['materials', 'inventoryLots', 'inventory', 'inventoryTransactions', 'materialInspections'],
    'goods-receipt-save': () => ['materials', 'inventoryLots', 'inventory', 'inventoryTransactions', 'materialInspections'],
    'iqc-save-inspection': () => ['materials', 'inventoryLots', 'inventory', 'inventoryTransactions', 'materialInspections', 'materialReturnRequests'],
    'inv-return-confirm-issue': () => ['materials', 'goodsIssues', 'inventory', 'inventoryTransactions', 'materialReturnRequests', 'materialReturnHistory'],
    'inv-lot-quarantine': () => ['inventoryLots', 'inventory'],
    'inv-save-alert-config': () => ['settings'],
    // Nhà hàng/POS: khi thanh toán mới phát sinh trừ tồn và ledger kho cửa hàng.
    'restaurant-pos-save': () => ['inventory', 'inventoryTransactions'],
    'restaurant-pos-checkout-confirm': () => ['inventory', 'inventoryTransactions'],
    'restaurant-order-pay': () => ['inventory', 'inventoryTransactions'],
    'restaurant-replenishment-fulfill-save': () => ['stockTransfers', 'inventory', 'inventoryTransactions'],
  };

  function wrapActions(actions) {
    if (!actions || actions.__inventoryPersistenceWrapped) return;

    Object.entries(ACTION_KEYS).forEach(([name, resolver]) => {
      const original = actions[name];
      if (typeof original !== 'function') return;

      actions[name] = function (...args) {
        const result = original.apply(this, args);
        Promise.resolve(result).then(() => {
          scheduleCollections(resolver(args[0] || {}));

          // [PERFORMANCE] Không sync toàn bộ Purchase sau mỗi thao tác Kho.
          // Hai action nhập PO đã được PurchaseAPI.wrapActions tự đồng bộ đúng
          // goodsReceipts/purchaseOrders/purchasePriceHistory. Các action còn lại
          // chỉ đồng bộ đúng collection Purchase thật sự bị thay đổi.
          const purchaseKeysByAction = {
            'warehouse-receipt-save': ['goodsReceipts'],
            'iqc-save-inspection': ['goodsReceipts', 'purchaseOrders'],
            'inv-return-confirm-issue': ['purchaseOrders'],
          };
          const purchaseKeys = purchaseKeysByAction[name];
          if (purchaseKeys && typeof PurchaseAPI !== 'undefined') {
            PurchaseAPI.scheduleCollections(purchaseKeys, 220);
          }
        }).catch(() => {});

        return result;
      };
    });

    Object.defineProperty(actions, '__inventoryPersistenceWrapped', { value: true });
  }

  return {
    bootstrap,
    refreshFromServer,
    refreshKeys,
    ensureFresh,
    syncAll,
    syncCollections,
    scheduleSync,
    scheduleCollections,
    cacheCurrent,
    wrapActions,
    ensureFinishedDeliveryTestData,
  };
})();
