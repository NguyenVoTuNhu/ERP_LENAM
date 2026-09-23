/* ============================================================================
 * APPROVALS API - KIO PERSISTENCE
 * ----------------------------------------------------------------------------
 * Trách nhiệm duy nhất của file này:
 *   1) Nạp dữ liệu Quy trình phê duyệt từ các bảng lenam_approval_* trên KIO
 *      server vào DB.* (workflows / requests / logs / signatures).
 *   2) Đồng bộ collection bị thay đổi lên đúng bảng server.
 *   3) Seed đúng 1 lần các quy trình mặc định (định nghĩa trong
 *      mod-approvals.js) lên server nếu server đang trống — giống cơ chế
 *      migrate/seed của CRMAPI.
 *
 * KHÔNG chứa business logic phê duyệt. Luồng nghiệp vụ (tạo/duyệt/từ chối/
 * hủy yêu cầu, ký điện tử) vẫn nằm nguyên trong mod-approvals.js.
 * ========================================================================== */
const ApprovalsAPI = (() => {
  const TABLES = KIO_CONFIG.approvalTables;
  const CACHE_KEY = KIO_CONFIG.storageKeys.approvalCache;
  const DEMO_SEED_KEY = KIO_CONFIG.storageKeys.approvalDemoSeed;

  const REFRESH_TTL = 2 * 60 * 1000;

  let syncChain = Promise.resolve();
  const localVersion = new Map();
  let lastRefreshAt = 0;
  let bootPromise = null;
  let booted = false;
  let scheduleTimer = null;
  let scheduledKeys = new Set();

  function versionOf(key) { return Number(localVersion.get(key) || 0); }
  function markLocalChange(keys) {
    normalizeKeys(keys).forEach(key => localVersion.set(key, versionOf(key) + 1));
  }
  function normalizeKeys(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    return [...new Set(list.filter(key => key && TABLES[key]))];
  }

  function readCache() { return KioDataUtils.readJson(CACHE_KEY); }
  function writeCache() { KioDataUtils.writeJson(CACHE_KEY, KioDataUtils.snapshotCollections(TABLES)); }

  function apply(data) {
    Object.keys(TABLES).forEach(key => {
      if (Array.isArray(data?.[key])) DB[key] = data[key];
    });
  }

  async function readAll() {
    const entries = Object.entries(TABLES);
    const values = await Promise.all(entries.map(([, table]) => KioStore.listCollection(table)));
    return Object.fromEntries(entries.map(([key], index) => [key, values[index]]));
  }

  // Quy trình mặc định (9 loại chứng từ) được mod-approvals.js khởi tạo vào
  // DB.approvalWorkflows ngay khi file đó load (trước khi app boot gọi tới
  // đây). Nếu server chưa có gì, đẩy đúng bản đang có trong DB lên làm seed —
  // KHÔNG tự seed lại nếu collection đã từng được migrate (tương tự CRMAPI:
  // một request/log rỗng sau đó là trạng thái hợp lệ, không phải thiếu dữ liệu).
  async function seedMissingCollections(serverData) {
    const demo = KioDataUtils.snapshotCollections(TABLES);
    const out = { ...serverData };
    const seeded = [];

    for (const [key, table] of Object.entries(TABLES)) {
      const remote = Array.isArray(serverData?.[key]) ? serverData[key] : [];
      if (remote.length > 0) { out[key] = remote; continue; }

      const items = Array.isArray(demo?.[key]) ? demo[key] : [];
      if (items.length) {
        await KioStore.syncCollection(table, items);
        out[key] = KioDataUtils.clone(items);
        seeded.push(`${key}:${items.length}`);
      } else {
        out[key] = [];
      }
    }

    if (seeded.length) console.info(`[ApprovalsAPI] Đã seed dữ liệu mặc định lên KIO: ${seeded.join(', ')}`);
    KioDataUtils.storageSet(DEMO_SEED_KEY, '1');
    return out;
  }

  async function loadServerAndMigrateIfNeeded() {
    let data = await readAll();
    const migrated = KioDataUtils.storageGet(DEMO_SEED_KEY) === '1';
    if (!migrated) data = await seedMissingCollections(data);
    return data;
  }

  function syncCollections(keys) {
    const wanted = normalizeKeys(keys);
    syncChain = syncChain.catch(() => {}).then(async () => {
      for (const key of wanted) {
        await KioStore.syncCollection(TABLES[key], Array.isArray(DB[key]) ? DB[key] : []);
      }
      writeCache();
      if (wanted.length) console.info(`[ApprovalsAPI] Đã đồng bộ lên KIO: ${wanted.join(', ')}`);
      return true;
    }).catch(err => {
      console.error('[ApprovalsAPI] Đồng bộ KIO thất bại:', err);
      if (typeof Toast !== 'undefined') Toast.err('Không lưu được dữ liệu phê duyệt', err.message);
      throw err;
    });
    return syncChain;
  }

  function scheduleCollections(keys, delay = 180) {
    markLocalChange(keys);
    normalizeKeys(keys).forEach(key => scheduledKeys.add(key));
    writeCache();
    clearTimeout(scheduleTimer);
    scheduleTimer = setTimeout(() => {
      const wanted = [...scheduledKeys];
      scheduledKeys = new Set();
      syncCollections(wanted).catch(() => {});
    }, delay);
  }

  // Nhật ký phê duyệt là append-only (không sửa lại dòng cũ) — ghi thẳng
  // record mới lên server, không cần đọc lại toàn bảng như syncCollection.
  async function appendLogs(items) {
    const list = Array.isArray(items) ? items : [items];
    if (!list.length) return true;
    try {
      await KioStore.appendCollection(TABLES.logs, list);
      writeCache();
    } catch (err) {
      console.error('[ApprovalsAPI] Không ghi được nhật ký phê duyệt lên KIO:', err);
    }
    return true;
  }

  async function deleteKeys(key, ids) {
    if (!TABLES[key]) return false;
    return KioStore.deleteKeys(TABLES[key], ids);
  }

  async function ensureFresh(keys = null, { force = false } = {}) {
    if (!force && (Date.now() - lastRefreshAt) < REFRESH_TTL) return false;
    try {
      const data = await loadServerAndMigrateIfNeeded();
      const changed = {};
      Object.keys(TABLES).forEach(key => {
        if (!Array.isArray(data?.[key])) return;
        const before = JSON.stringify(DB[key] || []);
        const after = JSON.stringify(data[key]);
        if (before !== after) changed[key] = data[key];
      });
      apply(data);
      lastRefreshAt = Date.now();
      writeCache();
      return changed;
    } catch (err) {
      console.warn('[ApprovalsAPI] Không refresh được từ server; giữ dữ liệu hiện tại:', err);
      return {};
    }
  }

  async function bootstrap() {
    if (booted) return true;
    if (bootPromise) return bootPromise;
    bootPromise = (async () => {
      const cached = readCache();
      if (cached) apply(cached);
      try { await ensureFresh(null, { force: true }); } catch (_) {}
      booted = true;
      return true;
    })().finally(() => { bootPromise = null; });
    return bootPromise;
  }

  return { bootstrap, ensureFresh, syncCollections, scheduleCollections, appendLogs, deleteKeys };
})();
