/* ============================================================================
 * INVENTORY SERVER ADAPTER - KIO
 * Không thay đổi logic Kho/QC/nhập xuất. Module vẫn thao tác trên DB.* như cũ.
 * ========================================================================== */
const InventoryAPI = (() => {
  const TABLES = {
    warehouses: 'lenam_warehouses',
    warehouseLocations: 'lenam_warehouse_locations',
    inventoryLots: 'lenam_inventory_lots',
    inventory: 'lenam_inventory_balances',
    stockTransfers: 'lenam_stock_transfers',
    inventoryCounts: 'lenam_inventory_counts',
    inventoryTransactions: 'lenam_inventory_transactions',
    goodsIssues: 'lenam_goods_issues',
    stockMoves: 'lenam_stock_moves',
    inventoryAuditLogs: 'lenam_inventory_audit_logs',
    materialReturnRequests: 'lenam_material_return_requests',
    materialReturnHistory: 'lenam_material_return_history',
    materialInspections: 'lenam_material_inspections',
    itemCategories: 'lenam_item_categories',
    materials: 'lenam_materials',
    semiFinishedProducts: 'lenam_semi_finished_products',
    products: 'lenam_finished_products',
  };
  const SETTINGS_TABLE = 'lenam_inventory_settings';

  let timer = null;
  let syncChain = Promise.resolve();

  function rehydrateMaterial(m) {
    const x = { ...m };
    delete x.status;
    delete x.value;
    Object.defineProperty(x, 'status', {
      enumerable: true, configurable: true,
      get() {
        if (Number(this.stock || 0) <= 0) return 'vt_het_hang';
        if (Number(this.stock || 0) < Number(this.minStock || 0)) return 'vt_sap_het';
        return 'vt_du_ton';
      },
    });
    Object.defineProperty(x, 'value', {
      enumerable: true, configurable: true,
      get() { return Number(this.stock || 0) * Number(this.price || 0); },
    });
    return x;
  }

  async function readAll() {
    const out = {};
    for (const [key, table] of Object.entries(TABLES)) {
      out[key] = await KioStore.listCollection(table);
    }
    const settings = await KioStore.listCollection(SETTINGS_TABLE);
    out.settings = settings.find(x => x?.id === 'INVENTORY_SETTINGS') || null;
    return out;
  }

  function hasData(d) {
    return Object.keys(TABLES).some(key => Array.isArray(d?.[key]) && d[key].length > 0);
  }

  function apply(d) {
    Object.keys(TABLES).forEach(key => {
      if (!Array.isArray(d?.[key])) return;
      if (key === 'materials') DB.materials = d[key].map(rehydrateMaterial);
      else DB[key] = d[key];
    });
    if (d?.settings) {
      if (d.settings.inventoryAlertConfig && typeof d.settings.inventoryAlertConfig === 'object') {
        DB.inventoryAlertConfig = d.settings.inventoryAlertConfig;
      }
      if (d.settings.finishedMinStock && typeof d.settings.finishedMinStock === 'object') {
        DB.finishedMinStock = d.settings.finishedMinStock;
      }
    }
  }

  function syncAll() {
    clearTimeout(timer);
    syncChain = syncChain.catch(() => {}).then(async () => {
      for (const [key, table] of Object.entries(TABLES)) {
        await KioStore.syncCollection(table, Array.isArray(DB[key]) ? DB[key] : []);
      }
      await KioStore.syncCollection(SETTINGS_TABLE, [{
        id: 'INVENTORY_SETTINGS',
        inventoryAlertConfig: DB.inventoryAlertConfig || {},
        finishedMinStock: DB.finishedMinStock || {},
      }]);
      console.info('[InventoryAPI] Đã đồng bộ Kho/Master với KIO server.');
      return true;
    }).catch(err => {
      console.error('[InventoryAPI] Đồng bộ KIO thất bại:', err);
      if (typeof Toast !== 'undefined') Toast.err('Không lưu được dữ liệu Kho', err.message);
      throw err;
    });
    return syncChain;
  }

  function scheduleSync(delay = 120) {
    clearTimeout(timer);
    timer = setTimeout(() => syncAll().catch(() => {}), delay);
  }

  async function bootstrap() {
    try {
      const data = await readAll();
      if (hasData(data)) {
        apply(data);
        console.info('[InventoryAPI] Đã nạp Kho/Master từ KIO server.');
      } else {
        console.info('[InventoryAPI] Các bảng Kho trên server đang trống, seed dữ liệu hiện tại lần đầu.');
        await syncAll();
      }
      return true;
    } catch (err) {
      console.warn('[InventoryAPI] Không đọc được KIO server, tạm giữ data.js:', err);
      return false;
    }
  }

  async function refreshFromServer() {
    const data = await readAll();
    if (hasData(data)) apply(data);
    return data;
  }

  function wrapActions(actions) {
    if (!actions || actions.__inventoryPersistenceWrapped) return;
    Object.keys(actions).forEach(name => {
      const original = actions[name];
      if (typeof original !== 'function') return;
      actions[name] = function (...args) {
        const result = original.apply(this, args);
        Promise.resolve(result).finally(() => {
          scheduleSync();
          if (typeof PurchaseAPI !== 'undefined') PurchaseAPI.scheduleSync();
        });
        return result;
      };
    });
    Object.defineProperty(actions, '__inventoryPersistenceWrapped', { value: true });
  }

  return { bootstrap, refreshFromServer, syncAll, scheduleSync, wrapActions };
})();
