/* ============================================================================
 * CRM API - KIO PERSISTENCE
 * ----------------------------------------------------------------------------
 * Trách nhiệm duy nhất của file này:
 *   1) Nạp dữ liệu CRM/Bán hàng từ các bảng lenam_* trên KIO server vào DB.*
 *   2) Đồng bộ collection CRM bị thay đổi lên đúng bảng server
 *   3) Migrate dữ liệu từ cơ chế CRM_SALES_STATE/localStorage cũ đúng 1 lần
 *
 * KHÔNG chứa business logic bán hàng. Luồng nghiệp vụ vẫn nằm nguyên trong
 * mod-crm-sales.js / app.js.
 * ========================================================================== */
const CRMAPI = (() => {
  const TABLES = KIO_CONFIG.crmTables;
  const CACHE_KEY = KIO_CONFIG.storageKeys.crmCache;
  const DEMO_SEED_KEY = KIO_CONFIG.storageKeys.crmDemoSeed;

  // Chỉ dùng để migrate dữ liệu từ bản CRM trước đây; sau migrate không còn
  // ghi CRM vào lenam_inventory_settings nữa.
  const LEGACY_SETTINGS_TABLE = KIO_CONFIG.inventorySettingsTable;
  const LEGACY_STATE_ID = 'CRM_SALES_STATE';
  const LEGACY_LOCAL_KEY = 'lenam:crm-sales:v1';

  const DEMO_DATA = KioDataUtils.snapshotCollections(TABLES);

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

  function normalizeKeys(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    return [...new Set(list.filter(key => key && TABLES[key]))];
  }

  function hasAnyData(data) {
    return Object.keys(TABLES).some(
      key => Array.isArray(data?.[key]) && data[key].length > 0
    );
  }

  function readCache() {
    return KioDataUtils.readJson(CACHE_KEY);
  }

  function writeCache(data) {
    return KioDataUtils.writeJson(CACHE_KEY, data);
  }

  function snapshotCurrentDb() {
    return KioDataUtils.snapshotCollections(TABLES);
  }

  function apply(data) {
    Object.keys(TABLES).forEach(key => {
      if (Array.isArray(data?.[key])) DB[key] = data[key];
    });
  }

  async function readAll() {
    const entries = Object.entries(TABLES);
    const values = await Promise.all(
      entries.map(([, table]) => KioStore.listCollection(table))
    );
    return Object.fromEntries(
      entries.map(([key], index) => [key, values[index]])
    );
  }

  function readLegacyLocalState() {
    const saved = KioDataUtils.readJson(LEGACY_LOCAL_KEY);
    if (!saved || typeof saved !== 'object') return null;
    return saved;
  }

  async function readLegacyServerState() {
    try {
      return await KioStore.loadSingleton(LEGACY_SETTINGS_TABLE, LEGACY_STATE_ID);
    } catch (err) {
      console.warn('[CRMAPI] Không đọc được CRM_SALES_STATE cũ; bỏ qua migration server:', err);
      return null;
    }
  }

  function chooseMigrationSource(serverLegacy, localLegacy) {
    // Ưu tiên snapshot cũ trên server, sau đó local cache, cuối cùng data.js.
    if (serverLegacy && typeof serverLegacy === 'object') return serverLegacy;
    if (localLegacy && typeof localLegacy === 'object') return localLegacy;
    return DEMO_DATA;
  }

  async function seedMissingCollections(serverData) {
    const serverLegacy = await readLegacyServerState();
    const localLegacy = readLegacyLocalState();
    const source = chooseMigrationSource(serverLegacy, localLegacy);
    const out = { ...serverData };
    const seeded = [];

    for (const [key, table] of Object.entries(TABLES)) {
      const remote = Array.isArray(serverData?.[key]) ? serverData[key] : [];
      if (remote.length > 0) {
        out[key] = remote;
        continue;
      }

      const legacyItems = Array.isArray(source?.[key])
        ? source[key]
        : Array.isArray(DEMO_DATA?.[key])
          ? DEMO_DATA[key]
          : [];

      if (legacyItems.length) {
        await KioStore.syncCollection(table, legacyItems);
        out[key] = KioDataUtils.clone(legacyItems);
        seeded.push(`${key}:${legacyItems.length}`);
      } else {
        out[key] = [];
      }
    }

    if (seeded.length) {
      console.info(`[CRMAPI] Đã migrate/seed CRM sang bảng lenam_*: ${seeded.join(', ')}`);
    }

    KioDataUtils.storageSet(DEMO_SEED_KEY, '1');
    return out;
  }

  async function loadServerAndMigrateIfNeeded() {
    let data = await readAll();
    const migrated = KioDataUtils.storageGet(DEMO_SEED_KEY) === '1';

    // Migration chỉ chạy một lần. Một bảng CRM rỗng sau đó có thể là trạng thái
    // hợp lệ (ví dụ chưa có khiếu nại), nên tuyệt đối không tự seed lại demo chỉ
    // vì collection đang rỗng.
    if (!migrated) {
      data = await seedMissingCollections(data);
    }

    return data;
  }

  function syncCollections(keys) {
    const wanted = normalizeKeys(keys);
    syncChain = syncChain.catch(() => {}).then(async () => {
      for (const key of wanted) {
        await KioStore.syncCollection(
          TABLES[key],
          Array.isArray(DB[key]) ? DB[key] : []
        );
      }
      writeCache(snapshotCurrentDb());
      if (wanted.length) {
        console.info(`[CRMAPI] Đã đồng bộ lên KIO: ${wanted.join(', ')}`);
      }
      return true;
    }).catch(err => {
      console.error('[CRMAPI] Đồng bộ KIO thất bại:', err);
      if (typeof Toast !== 'undefined') {
        Toast.err('Không lưu được dữ liệu CRM/Bán hàng', err.message);
      }
      throw err;
    });
    return syncChain;
  }

  function syncAll() {
    return syncCollections(Object.keys(TABLES));
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
    scheduleCollections(Object.keys(TABLES), delay);
  }

  async function deleteKeys(key, ids) {
    const table = TABLES[key];
    if (!table) throw new Error(`CRM collection không hợp lệ: ${key}`);
    await KioStore.deleteKeys(table, ids);
    writeCache(snapshotCurrentDb());
    console.info(`[CRMAPI] Đã xóa record khỏi ${table}: ${(Array.isArray(ids) ? ids : [ids]).join(', ')}`);
    return true;
  }

  async function bootstrap() {
    if (booted) return true;
    booted = true;
    const cached = readCache();
    if (cached && hasAnyData(cached)) {
      apply(cached);
      console.info('[CRMAPI] Đã nạp cache CRM; chờ refresh theo màn hình đang mở.');
    } else {
      const legacy = readLegacyLocalState();
      if (legacy) apply(legacy);
      console.info('[CRMAPI] Chưa có cache CRM; dùng dữ liệu hiện tại.');
    }
    return true;
  }

  async function refreshKeys(keys, { force = false } = {}) {
    const wanted = normalizeKeys(keys);
    const out = {};
    for (const key of wanted) {
      const startedVersion = versionOf(key);
      try {
        const rows = await KioStore.listCollection(TABLES[key]);
        if (versionOf(key) !== startedVersion) continue;
        out[key] = rows;
        DB[key] = rows;
        lastRefresh.set(key, Date.now());
      } catch (err) {
        console.warn(`[CRMAPI] Không refresh được ${key}; tiếp tục dùng cache:`, err);
      }
    }
    if (Object.keys(out).length) writeCache(snapshotCurrentDb());
    return out;
  }

  async function ensureFresh(keys, { force = false } = {}) {
    const wanted = normalizeKeys(keys).filter(key => {
      if (force) return true;
      return (Date.now() - Number(lastRefresh.get(key) || 0)) >= REFRESH_TTL;
    });
    if (!wanted.length) return {};
    return refreshKeys(wanted, { force });
  }

  async function refreshFromServer() {
    const data = await loadServerAndMigrateIfNeeded();
    apply(data);
    Object.keys(TABLES).forEach(key => lastRefresh.set(key, Date.now()));
    writeCache(data);
    return data;
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
    deleteKeys,
  };
})();
