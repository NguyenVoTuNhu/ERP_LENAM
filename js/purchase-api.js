/* ============================================================================
 * PURCHASE SERVER ADAPTER - KIO
 * Giữ nguyên UI và toàn bộ business logic đang dùng DB.*.
 * Chỉ thay persistence từ PHP/MySQL local sang API server do công ty cung cấp.
 * ========================================================================== */
const PurchaseAPI = (() => {
  const TABLES = {
    suppliers: 'lenam_suppliers',
    purchases: 'lenam_purchase_requests',
    supplierQuotations: 'lenam_supplier_quotations',
    purchaseOrders: 'lenam_purchase_orders',
    goodsReceipts: 'lenam_goods_receipts',
    supplierPayments: 'lenam_supplier_payments',
    purchasePriceHistory: 'lenam_purchase_price_history',
    supplierEvaluations: 'lenam_supplier_evaluations',
  };

  let timer = null;
  let syncChain = Promise.resolve();

  const mutatingActions = new Set([
    'supplier-save', 'supplier-delete',
    'pr-save', 'pr-delete', 'pr-add-supplier', 'pr-select-supplier',
    'pr-approve-action', 'pr-reject-save', 'pr-convert-po',
    'quote-confirm-pr', 'quote-save-supplier', 'quote-select-winner',
    'po-approve-action', 'po-cancel', 'po-change-status',
    'po-evaluate-supplier-save', 'supplier-evaluation-save',
    'po-goods-receipt-save', 'goods-receipt-save',
    'supplier-pay-save',
  ]);

  function serverHasData(result) {
    return Object.values(result).some(arr => Array.isArray(arr) && arr.length > 0);
  }

  async function readAll() {
    const out = {};
    for (const [key, table] of Object.entries(TABLES)) {
      out[key] = await KioStore.listCollection(table);
    }
    return out;
  }

  function apply(data) {
    Object.keys(TABLES).forEach(key => {
      if (Array.isArray(data?.[key])) DB[key] = data[key];
    });
  }

  function syncAll() {
    clearTimeout(timer);
    syncChain = syncChain.catch(() => {}).then(async () => {
      for (const [key, table] of Object.entries(TABLES)) {
        await KioStore.syncCollection(table, Array.isArray(DB[key]) ? DB[key] : []);
      }
      console.info('[PurchaseAPI] Đã đồng bộ Purchase với KIO server.');
      return true;
    }).catch(err => {
      console.error('[PurchaseAPI] Đồng bộ KIO thất bại:', err);
      if (typeof Toast !== 'undefined') Toast.err('Không lưu được dữ liệu Purchase', err.message);
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
      if (serverHasData(data)) {
        apply(data);
        console.info('[PurchaseAPI] Đã nạp Purchase từ KIO server.');
      } else {
        // Giữ hành vi demo cũ: server project mới thì seed dữ liệu hiện tại một lần.
        console.info('[PurchaseAPI] Các bảng Purchase trên server đang trống, seed dữ liệu hiện tại lần đầu.');
        await syncAll();
      }
      return true;
    } catch (err) {
      console.warn('[PurchaseAPI] Không đọc được KIO server, tạm giữ data.js:', err);
      return false;
    }
  }

  function wrapActions(actions) {
    if (!actions || actions.__purchaseApiWrapped) return;
    mutatingActions.forEach(name => {
      const original = actions[name];
      if (typeof original !== 'function') return;
      actions[name] = function (...args) {
        const result = original.apply(this, args);
        Promise.resolve(result).finally(scheduleSync);
        return result;
      };
    });
    Object.defineProperty(actions, '__purchaseApiWrapped', { value: true });
  }

  return { bootstrap, syncAll, scheduleSync, wrapActions };
})();
