/* ============================================================================
 * PRODUCTION API - CACHE-FIRST + INCREMENTAL PERSISTENCE v2
 * ----------------------------------------------------------------------------
 * Business logic sản xuất vẫn nằm trong app.js / mod-production.js.
 * File này chỉ chịu trách nhiệm persistence.
 *
 * Tối ưu quan trọng:
 *   - KHÔNG seed một PRODUCTION_STATE khổng lồ khi boot.
 *   - Tách dữ liệu thành 3 singleton nhỏ: Orders / Plans / Material Requests.
 *   - Chỉ ghi singleton thực sự thay đổi.
 *   - BOM / Routing thuộc master thành phẩm và được InventoryAPI lưu trong
 *     lenam_finished_products, không ghi lặp lại trong Production state.
 *   - Vẫn đọc được PRODUCTION_STATE v1 để tương thích dữ liệu cũ.
 * ========================================================================== */
const ProductionAPI = (() => {
  const TABLE = KIO_CONFIG.inventorySettingsTable;
  const LEGACY_STATE_ID = 'PRODUCTION_STATE';
  const IDS = Object.freeze({
    productionOrders: 'PRODUCTION_ORDERS',
    productionPlans: 'PRODUCTION_PLANS',
    productionMaterialRequests: 'PRODUCTION_MATERIAL_REQUESTS',
    productionFinalInspections: 'PRODUCTION_FINAL_INSPECTIONS',
  });
  const CACHE_KEY = 'lenam:production-cache:v2';
  const LEGACY_CACHE_KEY = 'lenam:production-cache:v1';

  let syncTimer = null;
  let syncChain = Promise.resolve();
  let localVersion = 0;
  let bootPromise = null;
  let booted = false;
  let lastRefreshAt = 0;
  const REFRESH_TTL = 2 * 60 * 1000;
  const lastSerialized = new Map();

  DB.productionPlans = DB.productionPlans || [];
  DB.productionMaterialRequests = DB.productionMaterialRequests || [];
  DB.productionOrders = DB.productionOrders || [];
  DB.productionFinalInspections = DB.productionFinalInspections || [];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY) || localStorage.getItem(LEGACY_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function writeCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        productionOrders: clone(DB.productionOrders || []),
        productionPlans: clone(DB.productionPlans || []),
        productionMaterialRequests: clone(DB.productionMaterialRequests || []),
        productionFinalInspections: clone(DB.productionFinalInspections || []),
        // Giữ trong cache local để tương thích bản cũ; server master BOM nằm ở products.
        productBoms: (DB.products || []).map(p => ({ id:p.id, bom:clone(p.bom || []) })),
        productRoutings: (DB.products || []).map(p => ({ id:p.id, routing:clone(p.routing || []) })),
        updatedAt: new Date().toISOString(),
      }));
    } catch (err) {
      console.warn('[ProductionAPI] Không ghi được cache local:', err);
    }
  }

  function applyLegacy(state) {
    if (!state || typeof state !== 'object') return false;
    if (Array.isArray(state.productionOrders)) DB.productionOrders = state.productionOrders;
    if (Array.isArray(state.productionPlans)) DB.productionPlans = state.productionPlans;
    if (Array.isArray(state.productionMaterialRequests)) DB.productionMaterialRequests = state.productionMaterialRequests;
    if (Array.isArray(state.productionFinalInspections)) DB.productionFinalInspections = state.productionFinalInspections;
    // Chỉ dùng để đọc dữ liệu v1. Các lần lưu mới không ghi BOM/routing ở đây nữa.
    if (Array.isArray(state.productBoms)) {
      state.productBoms.forEach(row => {
        const p = (DB.products || []).find(x => x.id === row.id);
        if (p && Array.isArray(row.bom) && !(p.bom || []).length) p.bom = row.bom;
      });
    }
    if (Array.isArray(state.productRoutings)) {
      state.productRoutings.forEach(row => {
        const p = (DB.products || []).find(x => x.id === row.id);
        if (p && Array.isArray(row.routing) && !(p.routing || []).length) p.routing = row.routing;
      });
    }
    return true;
  }

  function applyCache(state) {
    if (!state || typeof state !== 'object') return false;
    let used = false;
    for (const key of Object.keys(IDS)) {
      if (Array.isArray(state[key])) { DB[key] = state[key]; used = true; }
    }
    // Cache v1 có thể chứa BOM/routing mới hơn data.js; chỉ bù khi master đang trống.
    if (Array.isArray(state.productBoms)) {
      state.productBoms.forEach(row => {
        const p = (DB.products || []).find(x => x.id === row.id);
        if (p && Array.isArray(row.bom) && !(p.bom || []).length) p.bom = row.bom;
      });
    }
    if (Array.isArray(state.productRoutings)) {
      state.productRoutings.forEach(row => {
        const p = (DB.products || []).find(x => x.id === row.id);
        if (p && Array.isArray(row.routing) && !(p.routing || []).length) p.routing = row.routing;
      });
    }
    return used;
  }

  function normalizeLegacySalesPlans() {
    let changed = false;
    (DB.productionPlans || []).forEach(plan => {
      if (plan?.source === 'SALES_ORDER' && plan.status === 'WAITING_SALES_APPROVAL') {
        plan.status = 'WAITING_APPROVAL';
        plan.approvalSource = 'WAREHOUSE';
        changed = true;
      }
    });
    return changed;
  }

  function rememberBaseline() {
    for (const key of Object.keys(IDS)) {
      lastSerialized.set(key, JSON.stringify(DB[key] || []));
    }
  }

  async function syncNow() {
    const versionAtStart = localVersion;
    const changed = [];
    const snapshots = {};

    for (const key of Object.keys(IDS)) {
      const items = clone(DB[key] || []);
      const serialized = JSON.stringify(items);
      if (serialized !== lastSerialized.get(key)) {
        changed.push(key);
        snapshots[key] = { items, serialized };
      }
    }

    if (!changed.length) {
      writeCache();
      return true;
    }

    syncChain = syncChain.catch(() => {}).then(async () => {
      for (const key of changed) {
        await KioStore.saveSingleton(TABLE, IDS[key], {
          items: snapshots[key].items,
          updatedAt: new Date().toISOString(),
        });
        lastSerialized.set(key, snapshots[key].serialized);
      }
      writeCache();
      console.info(`[ProductionAPI] Đã đồng bộ phần thay đổi: ${changed.join(', ')}`);
      return true;
    }).catch(err => {
      console.error('[ProductionAPI] Không lưu được dữ liệu sản xuất lên KIO:', err);
      if (typeof Toast !== 'undefined') Toast.err('Không lưu được dữ liệu sản xuất', err.message);
      throw err;
    });

    const result = await syncChain;
    if (versionAtStart !== localVersion) scheduleSync(180);
    return result;
  }

  function scheduleSync(delay = 220) {
    localVersion += 1;
    writeCache();
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncNow().catch(() => {}), delay);
  }

  async function bootstrap() {
    // Bootstrap chỉ hydrate cache đúng MỘT LẦN. Tuyệt đối không đọc lại cache
    // sau khi DB đã được refresh từ server, tránh state bị "nhảy ngược".
    if (booted) return true;
    if (bootPromise) return bootPromise;
    bootPromise = Promise.resolve().then(() => {
      const cached = readCache();
      if (cached) applyCache(cached);
      normalizeLegacySalesPlans();
      rememberBaseline();
      booted = true;
      if (cached) console.info('[ProductionAPI] Đã nạp cache sản xuất; chờ refresh theo màn hình đang mở.');
      else console.info('[ProductionAPI] Chưa có cache sản xuất; dùng dữ liệu hiện tại.');
      return true;
    }).finally(() => { bootPromise = null; });
    return bootPromise;
  }

  async function refreshFromServer({ force = false } = {}) {
    const startedVersion = localVersion;
    try {
      const rows = await KioStore.listCollection(TABLE);
      // Nếu user vừa chỉnh dữ liệu trong lúc request đang chạy thì không cho
      // snapshot server cũ ghi đè thay đổi local chưa sync xong.
      if (localVersion !== startedVersion) return {};

      const byId = new Map((rows || []).map(row => [String(row?.id || ''), row]));
      let serverApplied = false;
      const changed = {};

      for (const [key, id] of Object.entries(IDS)) {
        const row = byId.get(id);
        if (row && Array.isArray(row.items)) {
          const incoming = row.items;
          const before = JSON.stringify(DB[key] || []);
          const after = JSON.stringify(incoming);
          DB[key] = incoming;
          if (before !== after) changed[key] = incoming;
          serverApplied = true;
        }
      }

      // Tương thích dữ liệu v1: chỉ đọc khi chưa có các singleton mới.
      if (!serverApplied) {
        const legacy = byId.get(LEGACY_STATE_ID);
        if (legacy) {
          const before = {
            productionOrders: JSON.stringify(DB.productionOrders || []),
            productionPlans: JSON.stringify(DB.productionPlans || []),
            productionMaterialRequests: JSON.stringify(DB.productionMaterialRequests || []),
            productionFinalInspections: JSON.stringify(DB.productionFinalInspections || []),
          };
          serverApplied = applyLegacy(legacy);
          if (serverApplied) {
            for (const key of Object.keys(IDS)) {
              if (before[key] !== JSON.stringify(DB[key] || [])) changed[key] = DB[key];
            }
          }
        }
      }

      normalizeLegacySalesPlans();
      lastRefreshAt = Date.now();
      rememberBaseline();
      writeCache();
      return changed;
    } catch (err) {
      console.warn('[ProductionAPI] Không refresh được server; giữ state hiện tại:', err);
      return {};
    }
  }

  async function ensureFresh(_keys = null, { force = false } = {}) {
    if (!force && (Date.now() - lastRefreshAt) < REFRESH_TTL) return {};
    return refreshFromServer({ force });
  }

  return { bootstrap, refreshFromServer, ensureFresh, scheduleSync, syncNow };
})();
