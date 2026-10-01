/* ============================================================================
 * VYKO MANUFACTURING ERP — CORE
 * Tiện ích chung, UI kit (toast / modal / drawer / dropdown), router,
 * và các widget dùng lại ở mọi module (toolbar, bảng, phân trang…).
 * ==========================================================================*/

/* ---------------------------------------------------------- 1. TIỆN ÍCH */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Chống XSS khi ghép chuỗi HTML (dữ liệu do người dùng nhập trong demo) */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const fmtN     = (n) => (Math.round(Number(n) || 0)).toLocaleString('vi-VN');
const fmtVND   = (n) => fmtN(n) + 'đ';
const fmtDec   = (n, d = 1) => (Number(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: d });
const fmtDate  = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '—');
const fmtMonth = (s) => (s ? 'Tháng ' + Number(s.slice(5, 7)) + '/' + s.slice(0, 4) : '—');

/** 4.860.000.000 -> "4,86 tỷ" */
function fmtShort(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2).replace('.', ',') + ' tỷ';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(v >= 1e8 ? 0 : 1).replace('.', ',') + ' tr';
  return fmtN(v);
}

/** Chữ cái viết tắt cho avatar: "Hà Minh Tú" -> "HT" */
function initials(name) {
  const w = String(name || '').trim().split(/\s+/);
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
}

const AVA_TONES = ['', 'teal', 'orange', 'indigo', 'green', 'slate'];
const avaTone = (seed) => AVA_TONES[(String(seed).charCodeAt(String(seed).length - 1) || 0) % AVA_TONES.length];

/** Số ngày từ hôm nay tới ngày d (âm = đã quá hạn) */
const daysTo = (d) => Math.round((new Date(d + 'T00:00:00') - new Date(DB.today + 'T00:00:00')) / 86400000);

/** Badge trạng thái theo từ điển STATUS trong data.js */
function badge(key, extraClass = '') {
  const s = DB.statusMap[key];
  if (!s) return `<span class="badge slate ${extraClass}">${esc(key)}</span>`;
  return `<span class="badge ${s.tone} ${extraClass}">${esc(s.label)}</span>`;
}
const statusLabel = (key) => (DB.statusMap[key] || {}).label || key;
const statusTone  = (key) => (DB.statusMap[key] || {}).tone || 'slate';

/** Thanh tiến độ có màu theo mức hoàn thành */
function progressBar(pct, showText = true) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const tone = p >= 100 ? 'green' : p >= 60 ? '' : p >= 30 ? 'orange' : 'red';
  return `<div class="bar-row"><div class="bar ${tone}"><span style="width:${p}%"></span></div>${showText ? `<b>${p}%</b>` : ''}</div>`;
}

function avatarHTML(name, cls = 'sm') {
  return `<span class="avatar ${cls} ${avaTone(name)}">${esc(initials(name))}</span>`;
}

/** Ô 2 dòng trong bảng: dòng chính + dòng phụ */
const cell2 = (main, sub) => `<div class="cell-main">${main}</div>${sub ? `<div class="cell-sub">${sub}</div>` : ''}`;

/* -------------------------------------------------------- 2. TRẠNG THÁI */
const State = {
  module: 'dashboard',
  params: {},
  filters: {},
  page: {},
  tab: null,
};

/** Lấy (và khởi tạo) bộ lọc của một module */
function F(key, defaults = {}) {
  if (!State.filters[key]) State.filters[key] = { ...defaults };
  return State.filters[key];
}

/* ---------------------------------------------------------- 3. TOAST */
const Toast = {
  show(msg, { type = 'success', desc = '', timeout = 3200 } = {}) {
    const icons = { success: 'fa-circle-check', warning: 'fa-triangle-exclamation', danger: 'fa-circle-xmark', info: 'fa-circle-info' };
    const tones = { success: 't-green', warning: 't-orange', danger: 't-red', info: 't-blue' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-ico ${tones[type]}"><i class="fa-solid ${icons[type]}"></i></span>
      <span style="min-width:0"><b>${esc(msg)}</b>${desc ? `<p>${esc(desc)}</p>` : ''}</span>
      <button class="x" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>`;
    $('#toasts').appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); };
    el.querySelector('.x').onclick = close;
    if (timeout) setTimeout(close, timeout);
  },
  ok:   (m, d) => Toast.show(m, { type: 'success', desc: d }),
  warn: (m, d) => Toast.show(m, { type: 'warning', desc: d }),
  err:  (m, d) => Toast.show(m, { type: 'danger', desc: d }),
  info: (m, d) => Toast.show(m, { type: 'info', desc: d }),
};

/* ------------------------------------------------- 4. MODAL / DRAWER / POP */
const Overlay = {
  el: () => $('#overlay'),
  show() { Overlay.el().classList.add('show'); },
  hide() { if (!Modal.isOpen() && !Drawer.isOpen()) Overlay.el().classList.remove('show'); },
};

const Modal = {
  /* Hẹn giờ dọn dẹp sau khi đóng — phải hủy nếu có modal mới mở ngay sau đó,
     nếu không nội dung modal mới sẽ bị xóa oan. */
  _timer: null,

  open({ title, sub = '', body, foot = '', size = '', onMount, closable = true }) {
    if (Modal._timer) { clearTimeout(Modal._timer); Modal._timer = null; }
    const host = $('#modalHost');
    host.classList.remove('hidden');
    host.innerHTML = `
      <div class="modal ${size}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div style="min-width:0">
            <h3>${title}</h3>
            ${sub ? `<p>${sub}</p>` : ''}
          </div>
          ${closable ? '<button class="icon-btn btn-icon x" data-act="modal-close" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>' : ''}
        </div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
      </div>`;
    Overlay.show();
    Modal._open = true;
    const m = host.querySelector('.modal');
    // Bật hiệu ứng ở khung hình kế tiếp; hủy lệnh cũ nếu modal bị đóng ngay sau đó
    if (Modal._raf) cancelAnimationFrame(Modal._raf);
    Modal._raf = requestAnimationFrame(() => { Modal._raf = null; if (Modal._open) m.classList.add('show'); });
    if (onMount) onMount(m);
    return m;
  },
  _raf: null,
  _open: false,
  isOpen: () => Modal._open,
  close() {
    if (!Modal._open) return;
    Modal._open = false;
    if (Modal._raf) { cancelAnimationFrame(Modal._raf); Modal._raf = null; }
    const host = $('#modalHost');
    const m = host.querySelector('.modal');
    if (m) m.classList.remove('show');
    if (Modal._timer) clearTimeout(Modal._timer);
    Modal._timer = setTimeout(() => {
      Modal._timer = null;
      host.classList.add('hidden'); host.innerHTML = ''; Overlay.hide();
    }, 200);
  },
};

const Drawer = {
  _timer: null,
  _raf: null,
  _open: false,

  open({ title, sub = '', body, foot = '', wide = false, onMount, headExtra = '' }) {
    if (Drawer._timer) { clearTimeout(Drawer._timer); Drawer._timer = null; }
    const d = $('#drawer');
    d.className = 'drawer' + (wide ? ' wide' : '');
    d.innerHTML = `
      <div class="drawer-head">
        <div style="min-width:0;flex:1 1 auto">
          <h3 style="font-size:16px">${title}</h3>
          ${sub ? `<p style="font-size:12.5px;color:var(--text-3);margin-top:3px">${sub}</p>` : ''}
        </div>
        ${headExtra}
        <button class="icon-btn btn-icon" data-act="drawer-close" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="drawer-body">${body}</div>
      ${foot ? `<div class="drawer-foot">${foot}</div>` : ''}`;
    Overlay.show();
    Drawer._open = true;
    if (Drawer._raf) cancelAnimationFrame(Drawer._raf);
    Drawer._raf = requestAnimationFrame(() => { Drawer._raf = null; if (Drawer._open) d.classList.add('show'); });
    if (onMount) onMount(d);
  },
  isOpen: () => Drawer._open,
  close() {
    if (!Drawer._open) return;
    Drawer._open = false;
    if (Drawer._raf) { cancelAnimationFrame(Drawer._raf); Drawer._raf = null; }
    const d = $('#drawer');
    d.classList.remove('show');
    if (Drawer._timer) clearTimeout(Drawer._timer);
    Drawer._timer = setTimeout(() => { Drawer._timer = null; d.innerHTML = ''; Overlay.hide(); }, 260);
  },
  /** Cập nhật phần thân drawer mà không đóng/mở lại (dùng khi chuyển tab) */
  setBody(html) { const b = $('#drawer .drawer-body'); if (b) b.innerHTML = html; },
};

const Pop = {
  open(anchor, html, { align = 'right', width } = {}) {
    const p = $('#pop');
    p.innerHTML = html;
    if (width) p.style.width = typeof width === 'number' ? width + 'px' : width;
    else p.style.width = '';
    p.classList.add('show');
    const r = anchor.getBoundingClientRect();
    const pw = p.offsetWidth, ph = p.offsetHeight;
    let left = align === 'right' ? r.right - pw : r.left;
    left = Math.max(10, Math.min(left, window.innerWidth - pw - 10));
    let top = r.bottom + 7;
    if (top + ph > window.innerHeight - 10) top = Math.max(10, r.top - ph - 7);
    p.style.left = left + 'px';
    p.style.top = top + 'px';
    p.dataset.anchor = anchor.id || '';
  },
  close() { const p = $('#pop'); p.classList.remove('show'); p.dataset.anchor = ''; },
  isOpen: () => $('#pop').classList.contains('show'),
};

/** Hộp xác nhận dùng chung (thay cho confirm() mặc định) */
function confirmBox({ title, message, okText = 'Xác nhận', tone = 'danger', icon = 'fa-triangle-exclamation', onOk }) {
  Modal.open({
    title: esc(title),
    body: `<div style="display:flex;gap:14px;align-items:flex-start">
        <span class="kpi-ico t-${tone === 'danger' ? 'red' : tone}"><i class="fa-solid ${icon}"></i></span>
        <div style="font-size:13.5px;color:var(--text-2);line-height:1.6">${message}</div>
      </div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy bỏ</button>
           <button class="btn btn-${tone === 'danger' ? 'danger' : 'primary'}" data-act="confirm-ok">${esc(okText)}</button>`,
    onMount: (m) => { m.querySelector('[data-act="confirm-ok"]').onclick = () => { Modal.close(); setTimeout(() => onOk && onOk(), 210); }; },
  });
}

/* ------------------------------------------------- 5. WIDGET DÙNG CHUNG */

/** Khung bảng chuẩn: header + body + trạng thái rỗng */
function tableShell(headers, rowsHTML, { emptyTitle = 'Chưa có dữ liệu', emptyDesc = 'Không tìm thấy bản ghi nào khớp với bộ lọc hiện tại. Hãy thử xóa bớt điều kiện lọc.', emptyAction = '' } = {}) {
  const normalizedRows = Array.isArray(rowsHTML) ? rowsHTML.join('') : String(rowsHTML || '');
  const body = normalizedRows.length
    ? normalizedRows
    : `<tr><td colspan="${headers.length}" style="padding:0">
        <div class="empty">
          <div class="empty-ico"><i class="fa-solid fa-inbox"></i></div>
          <h4>${esc(emptyTitle)}</h4><p>${esc(emptyDesc)}</p>${emptyAction}
        </div></td></tr>`;
  return `<div class="tbl-wrap"><table class="tbl">
      <thead><tr>${headers.map((h) => `<th class="${h.cls || ''}" ${h.w ? `style="width:${h.w}"` : ''}>${h.t}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
}

/** Cắt trang danh sách + ghi nhớ trang hiện tại theo module */
function paged(list, key, size = 10) {
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / size));
  let page = State.page[key] || 1;
  if (page > pages) { page = pages; State.page[key] = page; }
  return { items: list.slice((page - 1) * size, page * size), total, pages, page, size };
}

function pagiHTML(key, pg, unit = 'bản ghi') {
  if (!pg.total) return '';
  const from = (pg.page - 1) * pg.size + 1;
  const to = Math.min(pg.total, pg.page * pg.size);
  const nums = [];
  const push = (n) => nums.push(`<button class="pg ${n === pg.page ? 'active' : ''}" data-act="page" data-key="${key}" data-p="${n}">${n}</button>`);
  const dots = () => nums.push('<button class="pg dots" disabled>…</button>');
  if (pg.pages <= 7) { for (let i = 1; i <= pg.pages; i++) push(i); }
  else {
    push(1);
    if (pg.page > 3) dots();
    for (let i = Math.max(2, pg.page - 1); i <= Math.min(pg.pages - 1, pg.page + 1); i++) push(i);
    if (pg.page < pg.pages - 2) dots();
    push(pg.pages);
  }
  return `<div class="pagi">
      <span class="pagi-info">Hiển thị <b>${from}–${to}</b> trên tổng <b>${fmtN(pg.total)}</b> ${unit}</span>
      <div class="pagi-btns">
        <button class="pg" data-act="page" data-key="${key}" data-p="${pg.page - 1}" ${pg.page === 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>
        ${nums.join('')}
        <button class="pg" data-act="page" data-key="${key}" data-p="${pg.page + 1}" ${pg.page === pg.pages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>
      </div>
    </div>`;
}

/** Ô tìm kiếm của module (gắn với State.filters[key].q) */
function searchBox(key, placeholder = 'Tìm kiếm…') {
  const f = F(key);
  return `<div class="search-box">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input class="inp" type="text" data-f="${key}.q" value="${esc(f.q || '')}" placeholder="${esc(placeholder)}" />
    </div>`;
}

/** Select lọc: options = [[value,label],...] */
function selectFilter(key, field, options, allLabel) {
  const f = F(key);
  const cur = f[field] || '';
  return `<select class="inp" data-f="${key}.${field}">
      <option value="">${esc(allLabel)}</option>
      ${options.map(([v, l]) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
    </select>`;
}

/** Danh sách option trạng thái từ tiền tố khóa (vd 'dh_') */
function statusOptions(prefix) {
  return Object.keys(DB.statusMap).filter((k) => k.startsWith(prefix)).map((k) => [k, DB.statusMap[k].label]);
}

/** Thẻ KPI nhỏ đầu module */
function mkpi(label, value, icon, tone, onClickAct) {
  return `<div class="mkpi" ${onClickAct ? `data-act="${onClickAct}" style="cursor:pointer"` : ''}>
      <span class="mkpi-ico t-${tone}"><i class="fa-solid ${icon}"></i></span>
      <span style="min-width:0">
        <span class="mkpi-label">${esc(label)}</span>
        <div class="mkpi-value">${value}</div>
      </span>
    </div>`;
}

/** Nút thao tác cuối dòng bảng */
function rowActions(acts) {
  return `<div class="row-actions">${acts.map((a) => `
      <button class="btn btn-icon btn-sm" data-act="${a.act}" ${a.data || ''} title="${esc(a.title)}"><i class="fa-solid ${a.icon}"></i></button>`).join('')}</div>`;
}

/** Khối tiêu đề trang */
function pageHead(title, sub, actions = '') {
  return `<div class="page-head">
      <div style="min-width:0"><h1>${title}</h1><p>${sub}</p></div>
      ${actions ? `<div class="page-head-actions">${actions}</div>` : ''}
    </div>`;
}

function moduleTabs(tabs, active) {
  return `<div class="tabs module-tabs" style="margin-bottom:16px">
    ${tabs.map((tab) => `<button class="tab ${active === tab.id ? 'active' : ''}" data-act="nav" data-id="${tab.route || tab.id}" ${tab.tab ? `data-tab="${tab.tab}"` : ''}>${esc(tab.label)}</button>`).join('')}
  </div>`;
}

/** Ô thông tin nhãn - giá trị */
const infoItem = (label, value) => `<div class="info-item"><div class="info-label">${esc(label)}</div><div class="info-value">${value}</div></div>`;

/* ------------------------------------------------------- 6. XUẤT DỮ LIỆU */
const Exporter = {
  /** Xuất CSV thật (mở được bằng Excel) — hoạt động hoàn toàn offline */
  csv(filename, headers, rows) {
    const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const content = '﻿' + [headers.map(q).join(';')].concat(rows.map((r) => r.map(q).join(';'))).join('\r\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    Toast.ok('Đã xuất file Excel', filename + ' — ' + rows.length + ' dòng dữ liệu');
  },
  /** Mô phỏng kết xuất PDF (bản demo không nhúng thư viện PDF) */
  pdf(name) {
    Toast.info('Đang kết xuất PDF…', name);
    setTimeout(() => Toast.ok('Đã tạo file PDF', name + '.pdf — sẵn sàng tải xuống'), 1100);
  },
};

/* ------------------------------------------------------------ 7. ROUTER */
// Badge công việc: chỉ đếm các record còn cần người dùng xử lý.
// Child badge được tính trực tiếp từ dữ liệu đã hydrate; parent badge là tổng child.
function navStatus(v){ return String(v || '').trim().toUpperCase(); }
function navCountWhere(rows, fn){ try { return (Array.isArray(rows) ? rows : []).filter(fn).length; } catch (_) { return 0; } }
function navWorkCount(key){
  switch (key) {
    case 'purchase-pr':
      return navCountWhere(DB?.purchases, x => ['MH_CHO_DUYET','PENDING_APPROVAL'].includes(navStatus(x.status)));
    case 'warehouse-receipts':
      return navCountWhere(DB?.goodsReceipts, x => ['QC_PENDING','PENDING','WAITING_RECEIPT'].includes(navStatus(x.inspectionStatus || x.status)));
    case 'warehouse-issues': {
      const req = navCountWhere(DB?.productionMaterialRequests, x => ['APPROVED','WAITING_WAREHOUSE_APPROVAL'].includes(navStatus(x.status)));
      const sales = navCountWhere(DB?.goodsIssues, x => navStatus(x.status) === 'PENDING_CONFIRMATION');
      const returns = navCountWhere(DB?.materialReturnRequests, x => ['WAITING_WAREHOUSE','WAITING_WAREHOUSE_CONFIRMATION','PENDING_WAREHOUSE'].includes(navStatus(x.status)));
      return req + sales + returns;
    }
    case 'warehouse-transfers':
      return navCountWhere(DB?.stockTransfers, x => ['PENDING','WAITING','PENDING_CONFIRMATION','WAITING_CONFIRMATION'].includes(navStatus(x.status)));
    case 'warehouse-alerts':
      return (typeof Q !== 'undefined' && Q.nearExpiryLots) ? Q.nearExpiryLots().length + Q.expiredLots().length : 0;
    case 'production-plan':
      // MATERIAL_ISSUED = Kho đã cấp NVL, Sản xuất cần tạo LSX.
      return navCountWhere(DB?.productionPlans, x => ['APPROVED','MATERIAL_ISSUED'].includes(navStatus(x.status)));
    case 'production-orders':
      return navCountWhere(DB?.productionOrders, x => ['LSX_CHO_SAN_XUAT','LSX_DANG_SAN_XUAT','LSX_DANG_QC'].includes(navStatus(x.status)));
    case 'production-material-request':
      return navCountWhere(DB?.productionMaterialRequests, x => ['APPROVED','WAITING_WAREHOUSE_APPROVAL'].includes(navStatus(x.status)));
    case 'quality-iqc':
      return navCountWhere(DB?.goodsReceipts, x => ['QC_PENDING','PENDING'].includes(navStatus(x.inspectionStatus || x.status)));
    case 'quality-fqc':
      return navCountWhere(DB?.productionFinalInspections, x => ['PENDING','WAITING','QC_PENDING'].includes(navStatus(x.status)));
    case 'approval-pending':
      return navCountWhere(DB?.approvalRequests, x => navStatus(x.status) === 'PENDING');
    case 'logistics-deliveries':
      return navCountWhere(DB?.logisticsDeliveries, x => ['PENDING','WAITING','READY','ASSIGNED','IN_TRANSIT'].includes(navStatus(x.status)));
    default: return 0;
  }
}
function navEntryCount(it){
  if (!it) return 0;
  if (Array.isArray(it.children) && it.children.length) {
    const childTotal = it.children.reduce((sum, c) => sum + Number(typeof c.count === 'function' ? c.count() : 0), 0);
    if (childTotal > 0) return childTotal;
  }
  return Number(typeof it.count === 'function' ? it.count() : 0) || 0;
}
const NAV = [
  { group: 'TỔNG QUAN', items: [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
  ]},
  { group: 'NGHIỆP VỤ', items: [
    {
      id: 'purchases',
      label: 'Mua hàng',
      icon: 'fa-cart-shopping',
      children: [
        { id: 'dashboard', label: 'Tổng quan' },
        { id: 'pr', label: 'Đề nghị mua hàng', count: () => navWorkCount('purchase-pr'), alert: true },
        { id: 'quotes', label: 'Báo giá nhà cung cấp' },
        { id: 'po', label: 'Đơn đặt hàng' },
        { id: 'debts', label: 'Công nợ nhà cung cấp' },
        { id: 'price_history', label: 'Lịch sử giá mua' },
        { id: 'budget', label: 'Cảnh báo vượt ngân sách' },
        { id: 'stock_control', label: 'Kiểm soát tồn kho mua hàng' },
        { id: 'suppliers', label: 'Nhà cung cấp' },
        { id: 'reports', label: 'Báo cáo mua hàng' }
      ],
      count: () => (typeof DB !== 'undefined' && DB.purchases) ? DB.purchases.filter((p) => ['mh_cho_duyet', 'PENDING_APPROVAL'].includes(p.status)).length : 0,
      alert: true
    },
    {
      id: 'warehouse',
      label: 'Kho',
      icon: 'fa-boxes-stacked',
      children: [
        { id: 'dashboard', label: 'Tổng quan' },
        { id: 'receipts', label: 'Nhập kho', count: () => navWorkCount('warehouse-receipts'), alert: true },
        { id: 'issues', label: 'Xuất kho', count: () => navWorkCount('warehouse-issues'), alert: true },
        { id: 'transfers', label: 'Chuyển kho', count: () => navWorkCount('warehouse-transfers'), alert: true },
        { id: 'stocktake', label: 'Kiểm kê' },
        { id: 'inventory', label: 'Tồn kho' },
        { id: 'batches', label: 'Lô và hạn sử dụng' },
        { id: 'defects', label: 'Hàng lỗi & hàng trả về' },
        { id: 'alerts', label: 'Cảnh báo kho', count: () => navWorkCount('warehouse-alerts'), alert: true },
        { id: 'barcode', label: 'Barcode / QR Code' }
      ],
      count: () => (typeof Q !== 'undefined' && Q.nearExpiryLots) ? Q.nearExpiryLots().length + Q.expiredLots().length : 0,
      alert: true
    },
    {
      id: 'production',
      label: 'Sản xuất',
      icon: 'fa-industry',
      children: [
        { id: 'dashboard', label: 'Tổng quan sản xuất' },
        { id: 'orders', label: 'Lệnh sản xuất', count: () => navWorkCount('production-orders'), alert: true },
        { id: 'bom', label: 'BOM / Định mức' },
        { id: 'routing', label: 'Routing công đoạn' },
        { id: 'plan', label: 'Kế hoạch sản xuất', count: () => navWorkCount('production-plan'), alert: true },
        { id: 'progress', label: 'Tiến độ sản xuất' },
        { id: 'issue_nvl', label: 'Xuất NVL sản xuất', count: () => navWorkCount('production-material-request'), alert: true },
        { id: 'receipt_tp', label: 'Nhập kho thành phẩm' },
        { id: 'wip', label: 'Theo dõi bán thành phẩm' },
        { id: 'scrap', label: 'Hao hụt' },
        { id: 'productivity', label: 'Năng suất' },
        { id: 'oee', label: 'Hiệu suất máy' },
        { id: 'costing', label: 'Tính giá thành' },
        { id: 'reports', label: 'Báo cáo sản xuất' }
      ],
      count: () => (typeof DB !== 'undefined' && DB.productionOrders) ? DB.productionOrders.filter((p) => p.status === 'lsx_dang_san_xuat').length : 0
    },
    {
      id: 'subcontracting',
      label: 'Gia công',
      icon: 'fa-screwdriver-wrench',
      children: [
        { id: 'dashboard', label: 'Tổng quan gia công' },
        { id: 'orders', label: 'Đơn gia công' },
        { id: 'partners', label: 'Đối tác gia công' },
        { id: 'issue', label: 'Xuất nguyên liệu' },
        { id: 'progress', label: 'Theo dõi tiến độ' },
        { id: 'receive', label: 'Nhập hàng hoàn thành' },
        { id: 'scrap', label: 'Hao hụt' },
        { id: 'debt', label: 'Công nợ gia công' },
        { id: 'evaluation', label: 'Đánh giá đối tác' },
        { id: 'reports', label: 'Báo cáo gia công' }
      ]
    },
    {
      id: 'restaurant',
      label: 'Nhà hàng & Cửa hàng',
      icon: 'fa-utensils',
      children: [
        { id: 'dashboard', label: 'Tổng quan' },
        { id: 'pos', label: 'POS bán hàng' },
        { id: 'tablet', label: 'Tablet Ordering' },
        { id: 'qr', label: 'QR Ordering' },
        { id: 'menu', label: 'Menu/Combo' },
        { id: 'recipe', label: 'Recipe / BOM món' },
        { id: 'orders', label: 'Đơn hàng' },
        { id: 'branches', label: 'Chi nhánh' },
        { id: 'issue', label: 'Xuất kho nguyên liệu' },
        { id: 'revenue', label: 'Doanh thu' },
        { id: 'reports', label: 'Báo cáo cửa hàng' }
      ]
    },
    {
      id: 'accounting',
      label: 'Kế toán – Tài chính',
      icon: 'fa-coins',
      children: [
        { id: 'dashboard', label: 'Tổng quan tài chính' },
        { id: 'general_ledger', label: 'Hạch toán' },
        { id: 'ar', label: 'Công nợ phải thu' },
        { id: 'ap', label: 'Công nợ phải trả' },
        { id: 'cashflow_inout', label: 'Thu – Chi' },
        { id: 'banking', label: 'Ngân hàng' },
        { id: 'costing', label: 'Giá thành' },
        { id: 'fixed_assets', label: 'Tài sản cố định' },
        { id: 'tax', label: 'Thuế' },
        { id: 'budget', label: 'Ngân sách' },
        { id: 'pnl', label: 'P&L' },
        { id: 'balance_sheet', label: 'Balance Sheet' },
        { id: 'cashflow', label: 'Cashflow' },
        { id: 'reports', label: 'Báo cáo tài chính' }
      ]
    },
    {
      id: 'hr',
      label: 'Nhân sự – Tiền lương',
      icon: 'fa-users',
      children: [
        { id: 'dashboard', label: 'Tổng quan nhân sự' },
        { id: 'profile', label: 'Hồ sơ nhân sự' },
        { id: 'attendance', label: 'Chấm công' },
        { id: 'shifts', label: 'Phân ca' },
        { id: 'kpi', label: 'KPI' },
        { id: 'evaluations', label: 'Đánh giá' },
        { id: 'payroll', label: 'Tính lương' },
        { id: 'labour_cost', label: 'Chi phí nhân công' },
        { id: 'reports', label: 'Báo cáo nhân sự' }
      ]
    },
    {
      id: 'quality',
      label: 'QC / QA',
      icon: 'fa-shield-halved',
      children: [
        { id: 'dashboard', label: 'Tổng quan chất lượng' },
        { id: 'iqc', label: 'Kiểm tra đầu vào', count: () => navWorkCount('quality-iqc'), alert: true },
        { id: 'pqc', label: 'Kiểm tra bán thành phẩm' },
        { id: 'fqc', label: 'Kiểm tra thành phẩm', count: () => navWorkCount('quality-fqc'), alert: true },
        { id: 'coa', label: 'Hồ sơ kiểm nghiệm' },
        { id: 'capa', label: 'CAPA' },
        { id: 'customer_claims', label: 'Khiếu nại khách hàng' },
        { id: 'recall', label: 'Thu hồi sản phẩm' },
        { id: 'traceability', label: 'Truy xuất nguồn gốc' },
        { id: 'defects', label: 'Quản lý lỗi' },
        { id: 'reports', label: 'Báo cáo chất lượng' }
      ]
    },
    {
      id: 'maintenance',
      label: 'Bảo trì thiết bị',
      icon: 'fa-gears',
      children: [
        { id: 'dashboard', label: 'Tổng quan' },
        { id: 'equipment', label: 'Danh mục máy móc' },
        { id: 'schedule', label: 'Lịch bảo trì' },
        { id: 'work_orders', label: 'Phiếu sửa chữa' },
        { id: 'logs', label: 'Nhật ký máy' }
      ]
    },
    {
      id: 'crm',
      label: 'CRM – Bán hàng',
      icon: 'fa-handshake',
      children: [
        { id: 'dashboard', label: 'Tổng quan' },
        { id: 'customers', label: 'Khách hàng' },
        { id: 'opportunities', label: 'Cơ hội bán hàng' },
        { id: 'care', label: 'Chăm sóc khách hàng' },
        { id: 'complaints', label: 'Khiếu nại' },
        { id: 'transactions', label: 'Lịch sử giao dịch' },
        { id: 'orders', label: 'Đơn hàng bán' }
      ]
    },
    {
      id: 'logistics',
      label: 'Logistics & Fleet',
      icon: 'fa-truck',
      children: [
        { id: 'dashboard', label: 'Tổng quan vận tải' },
        { id: 'deliveries', label: 'Đơn giao hàng', count: () => navWorkCount('logistics-deliveries'), alert: true },
        { id: 'dispatch', label: 'Điều phối' },
        { id: 'maintenance', label: 'Bảo trì xe' },
        { id: 'fleet', label: 'Danh mục xe' },
        { id: 'gps', label: 'GPS / Theo dõi xe' },
        { id: 'drivers', label: 'Tài xế' },
        { id: 'schedule', label: 'Lịch giao hàng' }
      ]
    },
    {
      id: 'rnd',
      label: 'R&D',
      icon: 'fa-flask',
      children: [
        { id: 'dashboard', label: 'Tổng quan R&D' },
        { id: 'projects', label: 'Dự án nghiên cứu' },
        { id: 'formula', label: 'Công thức' },
        { id: 'versions', label: 'Phiên bản công thức' },
        { id: 'trials', label: 'Thử nghiệm' },
        { id: 'costs', label: 'Chi phí nghiên cứu' },
        { id: 'npd', label: 'Phát triển sản phẩm mới' },
        { id: 'approvals', label: 'Quy trình duyệt' },
        { id: 'reports', label: 'Báo cáo R&D' }
      ]
    },
    {
      id: 'approvals',
      label: 'Phê duyệt',
      icon: 'fa-circle-check',
      children: [
        { id: 'dashboard', label: 'Tổng quan' },
        { id: 'pending', label: 'Việc cần duyệt', count: () => navWorkCount('approval-pending'), alert: true },
        { id: 'workflows', label: 'Quy trình phê duyệt' },
        { id: 'signature', label: 'Chữ ký điện tử' }
      ]
    },
    {
      id: 'bi',
      label: 'Quản trị doanh nghiệp — BI',
      icon: 'fa-chart-line',
      children: [
        { id: 'dashboard', label: 'Tổng quan' },
        { id: 'finance', label: 'Tài chính' },
        { id: 'warehouse', label: 'Kho' },
        { id: 'production', label: 'Sản xuất' },
        { id: 'sales', label: 'Kinh doanh' },
        { id: 'restaurant', label: 'Nhà hàng' },
        { id: 'hr', label: 'Nhân sự' },
        { id: 'purchases', label: 'Mua hàng' },
        { id: 'quality', label: 'Chất lượng' },
        { id: 'logistics', label: 'Logistics' },
        { id: 'advanced_bi', label: 'Phân tích chuyên sâu' }
      ]
    }
  ]},
  { group: 'QUẢN TRỊ', items: [
    { id: 'users', label: 'Hệ thống', icon: 'fa-gear' },
  ]},
];

/** Thông tin tiêu đề / breadcrumb từng màn hình */
const META = {
  dashboard:   { title: 'Dashboard – Lê Nam ERP', sub: 'Theo dõi hoạt động kinh doanh đậu hủ theo thời gian thực', crumb: ['Tổng quan', 'Dashboard'] },
  customers: { title: 'Quản lý khách hàng', sub: 'Hồ sơ khách hàng, lịch sử giao dịch đậu hủ và công nợ', crumb: ['CRM – Bán hàng', 'Khách hàng']},
  crm: { title: 'CRM – Bán hàng', sub: 'Quản lý khách hàng, đơn hàng và hoạt động bán hàng', crumb: ['CRM – Bán hàng', 'Tổng quan']},
  orders: { title: 'Quản lý đơn hàng', sub: 'Theo dõi đơn hàng đậu hủ từ lúc đặt tới khi giao', crumb: ['CRM – Bán hàng', 'Đơn hàng']},
  quotes:      { title: 'Quản lý báo giá', sub: 'Lập, gửi và theo dõi báo giá đậu hủ tới khi chốt đơn hàng', crumb: ['Bán hàng', 'Báo giá'] },
  'quote-detail': { title: 'Chi tiết báo giá', sub: 'Tham số sản phẩm — định mức — phân tích giá thành', crumb: ['Bán hàng', 'Báo giá', 'Chi tiết'], parent: 'quotes' },
  pricebook:   { title: 'Đơn giá đầu vào', sub: 'Đơn giá nguyên liệu, công đoạn và bảng giá sản phẩm đậu hủ', crumb: ['Bán hàng', 'Đơn giá đầu vào'] },
  catalogs:    { title: 'Danh mục hệ thống', sub: 'Nhà cung cấp, sản phẩm, quy trình sản xuất đậu hủ', crumb: ['Hệ thống', 'Danh mục'] },
  'order-detail': { title: 'Chi tiết đơn hàng', sub: 'Thông tin đơn hàng và tiến trình xử lý', crumb: ['Bán hàng', 'Đơn hàng', 'Chi tiết'], parent: 'orders' },
  contracts:   { title: 'Quản lý hợp đồng', sub: 'Hợp đồng cung cấp đậu hủ, tiến độ thanh toán và hiệu lực', crumb: ['Bán hàng', 'Hợp đồng'] },
  production:  { title: 'Lệnh sản xuất', sub: 'Điều hành lệnh sản xuất đậu hủ theo từng công đoạn', crumb: ['Sản xuất', 'Lệnh sản xuất'] },
  'production-detail': { title: 'Chi tiết lệnh sản xuất', sub: 'Quy trình sản xuất đậu hủ, vật tư và tiến độ thực tế', crumb: ['Sản xuất', 'Lệnh sản xuất', 'Chi tiết'], parent: 'production' },
  progress:    { title: 'Tiến độ sản xuất', sub: 'Bảng điều hành dây chuyền ngâm – xay – nấu – ép – đóng gói', crumb: ['Sản xuất', 'Tiến độ sản xuất'] },
  operations:  { title: 'Công đoạn & BOM', sub: 'Danh mục công đoạn sản xuất đậu hủ và định mức nguyên liệu', crumb: ['Sản xuất', 'Công đoạn & BOM'] },
  materials:   { title: 'Quản lý vật tư', sub: 'Nguyên liệu, hóa chất, bao bì, thiết bị và tồn kho đậu hủ', crumb: ['Kho & Vật tư', 'Vật tư'] },
  inventory:   { title: 'Tồn kho & biến động', sub: 'Phiếu nhập, phiếu xuất và lịch sử giao dịch kho', crumb: ['Kho & Vật tư', 'Tồn kho'] },
  purchases:   { title: 'Trung tâm Mua hàng', sub: 'PR → Phê duyệt → Báo giá NCC → PO → Nhập kho → Công nợ', crumb: ['Mua hàng', 'Quản lý mua sắm'] },
  suppliers:   { title: 'Nhà cung cấp', sub: 'Danh mục đối tác cung cấp nguyên liệu, bao bì, dịch vụ và vận chuyển cho Lê Nam', crumb: ['Mua hàng', 'Nhà cung cấp'] },
  users:       { title: 'Người dùng & phân quyền', sub: 'Tài khoản đăng nhập và vai trò truy cập hệ thống', crumb: ['Quản trị', 'Hệ thống'] },
  settings:    { title: 'Cài đặt hệ thống', sub: 'Thông tin Công ty TNHH SX TM DV Lê Nam và tham số vận hành', crumb: ['Quản trị', 'Cài đặt'] },
};

/** Bảng đăng ký view — được nạp ở app.js */
const Views = {};

/** Hàm render Placeholder tiêu chuẩn UI cho các menu con chưa phát triển backend/CRUD */
function renderPlaceholderView(moduleName, tabName, icon = 'fa-gear') {
  return `
    ${pageHead(esc(tabName), `Chức năng thuộc phân hệ ${esc(moduleName)}`, '<button class="btn btn-sm" disabled style="opacity:0.75"><i class="fa-solid fa-clock"></i> Giai đoạn tiếp theo</button>')}
    <div class="card" style="padding:48px 24px;text-align:center;max-width:720px;margin:24px auto;border-radius:12px;border:1px dashed var(--border);">
      <div style="width:64px;height:64px;border-radius:50%;background:var(--primary-soft);color:var(--primary);display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 16px auto;">
        <i class="fa-solid ${icon}"></i>
      </div>
      <h3 style="font-size:18px;font-weight:700;margin-bottom:8px;color:var(--text);">${esc(tabName)}</h3>
      <p style="font-size:13.5px;color:var(--text-muted);margin-bottom:20px;line-height:1.6;max-width:480px;margin-left:auto;margin-right:auto;">
        Chức năng <b>${esc(tabName)}</b> thuộc phân hệ <b>${esc(moduleName)}</b> đang được hoàn thiện cấu trúc giao diện &amp; nghiệp vụ chi tiết.
      </p>
      <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:var(--bg-hover);border-radius:20px;font-size:12.5px;color:var(--text-2);">
        <i class="fa-solid fa-link" style="color:var(--primary);"></i>
        <span>Route SPA: <code>#${esc(State.module)}${State.tab ? '/' + esc(State.tab) : ''}</code></span>
      </div>
    </div>
  `;
}

/** Điều hướng sang module khác */
function go(module, params = {}) {
  State.module = module;
  State.params = params;

  let navItem = null;
  for (const group of NAV) {
    const found = group.items.find(i => i.id === module);
    if (found) { navItem = found; break; }
  }

  if (navItem && Array.isArray(navItem.children) && navItem.children.length > 0) {
    const defaultTab = navItem.children[0].tab || navItem.children[0].id;
    State.tab = params.tab || defaultTab;
  } else {
    State.tab = params.tab || null;
  }

  const hash = State.tab
    ? `${module}/${State.tab}`
    : module;

  if (location.hash.replace('#', '') !== hash) {
    try {
      history.replaceState(null, '', '#' + hash);
    } catch (e) { /* bỏ qua */ }
  }

  Pop.close();
  if (window.innerWidth <= 900) closeSidebar();

  render();

  $('.view')?.scrollTo?.({ top: 0 });
  window.scrollTo({
    top: 0,
    behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto'
  });
}

function getPageMeta() {
  const module = State.module;
  const tab = State.tab;

  if (module === 'purchases') {
    const purchaseCrumbMap = {
      pr: 'Đề nghị mua',
      dashboard: 'Tổng quan',
      approval: 'Duyệt mua hàng',
      quotes: 'Báo giá NCC',
      po: 'Đơn đặt hàng',
      debts: 'Công nợ NCC',
      price_history: 'Lịch sử giá mua',
      budget: 'Cảnh báo vượt ngân sách',
      stock_control: 'Kiểm soát tồn kho',
      evaluations: 'Đánh giá NCC',
      suppliers: 'Nhà cung cấp',
      reports: 'Báo cáo mua hàng'
    };
    const tabName = purchaseCrumbMap[tab] || 'Đề nghị mua';
    return {
      title: 'Mua hàng',
      sub: 'PR → Phê duyệt → Báo giá NCC → PO → Nhập kho → Công nợ',
      crumb: ['Mua hàng', tabName],
      parent: 'purchases'
    };
  }

  let navParent = null;
  let navChild = null;
  for (const group of NAV) {
    const item = group.items.find(i => i.id === module);
    if (item) {
      navParent = item;
      if (Array.isArray(item.children)) {
        navChild = item.children.find(c => (c.tab || c.id) === tab);
      }
      break;
    }
  }

  if (navParent) {
    if (navChild) {
      return {
        title: navChild.label,
        sub: `Quản lý ${navChild.label} thuộc phân hệ ${navParent.label}`,
        crumb: [navParent.label, navChild.label],
        parent: navParent.id
      };
    }
    return {
      title: navParent.label,
      sub: `Quản lý tổng quan phân hệ ${navParent.label}`,
      crumb: [navParent.label, 'Tổng quan'],
      parent: navParent.id
    };
  }

  return META[module] || { title: 'Lê Nam ERP', sub: 'Hệ thống quản lý sản xuất và kinh doanh', crumb: ['Hệ thống'] };
}

/** Vẽ lại toàn bộ view hiện tại (giữ nguyên con trỏ trong ô đang nhập) */
function render() {
  const active = document.activeElement;
  const keepF = active && active.dataset && active.dataset.f ? active.dataset.f : null;
  const caret = keepF && active.selectionStart != null ? active.selectionStart : null;

  Charts.destroyAll();

  const meta = getPageMeta();
  $('#crumbTitle').textContent = meta.title;
  $('#crumb').innerHTML = meta.crumb
    .map((c, i) => (
      i === meta.crumb.length - 1
        ? `<b>${esc(c)}</b>`
        : `<span>${esc(c)}</span><i class="fa-solid fa-chevron-right"></i>`
    ))
    .join('');

  const view = $('#view');
  const fn = Views[State.module];
  let html = '';

  if (typeof fn === 'function') {
    html = fn(State.params) || '';
  }

  if (!html) {
    const icon = (NAV.flatMap(g => g.items).find(i => i.id === State.module) || {}).icon || 'fa-gear';
    html = renderPlaceholderView(meta.crumb[0] || State.module, meta.crumb[1] || meta.title, icon);
  }

  view.innerHTML = html;

  if (typeof fn === 'function' && typeof fn.after === 'function') {
    fn.after(State.params);
  }

  renderNav();

  if (keepF) {
    const again = view.querySelector(`[data-f="${CSS.escape(keepF)}"]`);
    if (again) { again.focus(); if (caret != null && again.setSelectionRange) again.setSelectionRange(caret, caret); }
  }
}

/** Sidebar Navigation Render & Behavior */
function renderNav() {
  const curModule = State.module;
  const curTab = State.tab;
  State.openNavParents = State.openNavParents || {};

  $('#nav').innerHTML = NAV.map(g => `
    <div class="nav-group">${esc(g.group)}</div>

    ${g.items.map(it => {
      const n = navEntryCount(it);
      const hasChildren = Array.isArray(it.children) && it.children.length > 0;

      if (hasChildren) {
        const isParentActive = curModule === it.id;
        const isParentOpen = isParentActive || State.openNavParents[it.id] === true;

        return `
          <div class="nav-parent ${isParentActive ? 'active' : ''} ${isParentOpen ? 'open' : ''}">
            <button
              class="nav-item nav-toggle ${isParentActive ? 'active' : ''}"
              data-submenu="${it.id}"
              type="button"
            >
              <i class="fa-solid ${it.icon}"></i>
              <span>${esc(it.label)}</span>
              ${n ? `<span class="nav-count ${it.alert ? 'alert' : ''}">${n}</span>` : ''}
              <i class="fa-solid fa-chevron-down nav-arrow"></i>
            </button>

            <div class="nav-submenu" data-submenu-content="${it.id}">
              ${it.children.map((child, idx) => {
                const tab = child.tab || child.id;
                const isChildActive = isParentActive && (curTab ? curTab === tab : idx === 0);
                const childN = Number(typeof child.count === 'function' ? child.count() : 0) || 0;

                return `
                  <button
                    class="nav-subitem ${isChildActive ? 'active' : ''}"
                    data-act="nav"
                    data-id="${it.id}"
                    data-tab="${tab}"
                    type="button">
                    <span>${esc(child.label)}</span>
                    ${childN ? `<span class="nav-count ${child.alert ? 'alert' : ''}">${childN}</span>` : ''}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }

      return `
        <button
          class="nav-item ${curModule === it.id ? 'active' : ''}"
          data-act="nav"
          data-id="${it.id}"
          type="button"
        >
          <i class="fa-solid ${it.icon}"></i>
          <span>${esc(it.label)}</span>
          ${n ? `<span class="nav-count ${it.alert ? 'alert' : ''}">${n}</span>` : ''}
        </button>
      `;
    }).join('')}
  `).join('');

  // Submenu Toggle
  $('#nav').querySelectorAll('.nav-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const parentEl = btn.closest('.nav-parent');
      const submenuId = btn.dataset.submenu;
      const nextOpen = !parentEl.classList.contains('open');
      parentEl.classList.toggle('open', nextOpen);
      State.openNavParents[submenuId] = nextOpen;
    });
  });

  // Navigation Click
  $('#nav').querySelectorAll('[data-act="nav"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const module = btn.dataset.id;
      const tab = btn.dataset.tab || null;
      // Khi chọn menu con, luôn ghi nhớ parent đang mở để render lại không làm mất dropdown.
      if (btn.closest('.nav-parent')) State.openNavParents[module] = true;
      go(module, { tab });
    });
  });
}

function openSidebar()  { $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); }
function closeSidebar() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }

