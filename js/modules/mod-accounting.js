/* ============================================================================
 * MODULE: KẾ TOÁN – TÀI CHÍNH (Lê Nam ERP)
 * ----------------------------------------------------------------------------
 * Nạp SAU app.js (xem hướng dẫn tích hợp cuối file). Ghi đè Views.accounting
 * (trước đó chỉ là bảng demo tĩnh trong mod-enterprise.js) bằng một phân hệ
 * đầy đủ, tính toán trực tiếp từ dữ liệu đã có — không tạo sổ kế toán song
 * song phải nhập tay lại từ đầu.
 *
 * LIÊN THÔNG TỰ ĐỘNG (không cần nhập tay):
 *  - Doanh thu & VAT đầu ra  ← DB.orders (đơn đã giao/hoàn thành)
 *  - Giá vốn hàng bán        ← BOM + Routing sản xuất (Q.costOf) theo từng đơn
 *  - Công nợ phải trả & VAT đầu vào ← DB.purchaseOrders
 *  - Công nợ phải trả — thanh toán ← DB.supplierPayments (tái dùng action có sẵn)
 *  - Tồn kho (Balance Sheet) ← DB.inventory / DB.materials
 *  - Ngân sách vs Thực tế    ← DB.budgets + DB.purchases (PR theo bộ phận)
 *
 * NHẬP TAY TỐI THIỂU (không có nguồn tự động trong hệ thống):
 *  - Thu tiền khách hàng (không có module thu ngân riêng)
 *  - Sổ phụ ngân hàng (không kết nối API ngân hàng thật)
 *  - Tài sản cố định & khấu hao
 *  - Chi phí hoạt động khác (lương, điện nước, thuê mặt bằng…)
 * ==========================================================================*/

/* ---------------------------------------------------------------- 0. DATA */
DB.customerPayments = DB.customerPayments || [];
DB.cashTransactions = DB.cashTransactions || [];   // sổ thu-chi thủ công (không phải công nợ NCC/KH)
DB.bankAccounts = DB.bankAccounts || [
  { id: 'BANK-01', name: 'Vietcombank – TK thanh toán chính', bankName: 'Vietcombank', accountNumber: '0071000123456', accountName: 'CÔNG TY LÊ NAM', openingBalance: 850000000, scopeType: 'COMPANY', storeId: '', active: true, isDefault: true },
  { id: 'BANK-02', name: 'ACB – TK thu hộ đại lý', bankName: 'ACB', accountNumber: '9988776655', accountName: 'CÔNG TY LÊ NAM', openingBalance: 120000000, scopeType: 'COMPANY', storeId: '', active: true, isDefault: false },
];
DB.bankTransactions = DB.bankTransactions || [];
DB.fixedAssets = DB.fixedAssets || [
  { id: 'TS-001', name: 'Kho lạnh 0-4°C KL-01', dept: 'Kho vận', purchaseDate: '2021-03-10', cost: 480000000, usefulYears: 10, status: 'active' },
  { id: 'TS-002', name: 'Máy xay công nghiệp XD-200', dept: 'Sản xuất', purchaseDate: '2020-06-01', cost: 260000000, usefulYears: 8, status: 'active' },
  { id: 'TS-003', name: 'Nồi nấu inox 2 lớp 300L (x2)', dept: 'Sản xuất', purchaseDate: '2019-11-15', cost: 180000000, usefulYears: 8, status: 'active' },
  { id: 'TS-004', name: 'Máy ép khuôn thủy lực KH-2', dept: 'Sản xuất', purchaseDate: '2022-02-20', cost: 210000000, usefulYears: 8, status: 'active' },
  { id: 'TS-005', name: 'Xe tải giao hàng 51C-123.45', dept: 'Kho vận', purchaseDate: '2018-05-05', cost: 620000000, usefulYears: 10, status: 'active' },
];
DB.accountingSettings = DB.accountingSettings || { corporateTaxRatePct: 20, opexCategories: ['Lương & BHXH', 'Điện nước', 'Thuê mặt bằng', 'Vận chuyển', 'Marketing', 'Khác'] };

/* Nạp một lần dữ liệu Thu tiền khách hàng từ lịch sử hợp đồng đã có, để màn
 * Thu-Chi và Cashflow không trống ngay từ đầu (không tạo nghiệp vụ mới). */
if (!DB.customerPayments.length) {
  DB.contracts.forEach((c) => {
    if (c.paid > 0) {
      DB.customerPayments.push({
        id: nextCode('TT-KH-2026-', DB.customerPayments),
        customerId: c.customerId, contractId: c.id,
        date: c.signDate, amount: c.paid, method: 'Chuyển khoản',
        note: `Thu theo hợp đồng ${c.id}`,
      });
    }
  });
}

/* ------------------------------------------------------------ 1. TÍNH TOÁN */
const AccFin = {
  monthOf: (d) => String(d || '').slice(0, 7),
  fmtMonthShort: (m) => 'Th' + Number(m.slice(5, 7)) + '/' + m.slice(2, 4),

  recognizedOrders: () => DB.orders.filter((o) => ['dh_da_giao', 'dh_hoan_tat'].includes(o.status)),
  activePOs: () => (DB.purchaseOrders || []).filter((po) => po.status !== 'CANCELLED'),

  cogsOfOrder(o) {
    return o.items.reduce((s, it) => {
      const c = Q.costOf(it.productId);
      return s + (c ? c.unitCost * it.qty : 0);
    }, 0);
  },

  monthlyMap(list, dateField, valueFn) {
    const map = {};
    list.forEach((x) => { const m = AccFin.monthOf(x[dateField]); map[m] = (map[m] || 0) + valueFn(x); });
    return map;
  },
  revenueByMonth() { return AccFin.monthlyMap(AccFin.recognizedOrders(), 'date', (o) => o.subtotal); },
  cogsByMonth() { return AccFin.monthlyMap(AccFin.recognizedOrders(), 'date', (o) => AccFin.cogsOfOrder(o)); },
  vatOutputByMonth() { return AccFin.monthlyMap(AccFin.recognizedOrders(), 'date', (o) => o.vat || 0); },
  vatInputByMonth() { return AccFin.monthlyMap(AccFin.activePOs(), 'date', (po) => po.vat || 0); },
  purchaseValueByMonth() { return AccFin.monthlyMap(AccFin.activePOs(), 'date', (po) => po.subtotal || 0); },
  cashInByMonth() {
    const a = AccFin.monthlyMap(DB.customerPayments, 'date', (p) => p.amount);
    const b = AccFin.monthlyMap(DB.cashTransactions.filter((t) => t.type === 'THU'), 'date', (t) => t.amount);
    const out = { ...a }; Object.keys(b).forEach((m) => { out[m] = (out[m] || 0) + b[m]; }); return out;
  },
  cashOutByMonth() {
    const a = AccFin.monthlyMap(DB.supplierPayments, 'date', (p) => p.amount);
    const b = AccFin.monthlyMap(DB.cashTransactions.filter((t) => t.type === 'CHI'), 'date', (t) => t.amount);
    const out = { ...a }; Object.keys(b).forEach((m) => { out[m] = (out[m] || 0) + b[m]; }); return out;
  },
  opexByMonth() { return AccFin.monthlyMap(DB.cashTransactions.filter((t) => t.type === 'CHI'), 'date', (t) => t.amount); },

  last6Months() {
    const all = new Set([...Object.keys(AccFin.revenueByMonth()), ...Object.keys(AccFin.cashOutByMonth()), AccFin.monthOf(TODAY)]);
    return [...all].sort().slice(-6);
  },
  currentMonth: () => AccFin.monthOf(TODAY),
  prevMonth() { const [y, m] = AccFin.currentMonth().split('-').map(Number); const d = new Date(y, m - 2, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); },

  totalAR() { return AccFin.recognizedOrders().reduce((s,o)=>s+(typeof SalesCRM!=='undefined'?SalesCRM.receivableOfOrder(o):Math.max(0,Number(o.total||0)-Number(o.paid||0))),0); },
  totalAP() { return AccFin.activePOs().reduce((s, po) => s + (typeof purchasePayableRemaining==='function' ? purchasePayableRemaining(po) : Math.max(0, Number(po.total||0) - Number(po.paid||0))), 0); },

  bankBalance(bankId) {
    const acc = (DB.bankAccounts || []).find((b) => b.id === bankId);
    if (!acc) return 0;
    const moved = (DB.bankTransactions || []).filter((t) => t.bankId === bankId).reduce((s, t) => s + (t.type === 'IN' ? t.amount : -t.amount), 0);
    return Number(acc.openingBalance || 0) + moved;
  },
  totalBankBalance() { return (DB.bankAccounts || []).reduce((s, b) => s + AccFin.bankBalance(b.id), 0); },

  assetBookValue(a) {
    const years = Math.max(0, (new Date(TODAY) - new Date(a.purchaseDate)) / (365 * 86400000));
    const dep = Math.min(a.cost, (a.cost / a.usefulYears) * years);
    return Math.max(0, Math.round(a.cost - dep));
  },
  assetAccumDep(a) { return Math.round(a.cost - AccFin.assetBookValue(a)); },
  totalAssetsNet() { return (DB.fixedAssets || []).filter((a) => a.status !== 'disposed').reduce((s, a) => s + AccFin.assetBookValue(a), 0); },

  inventoryBookValue() {
    const materialsValue = Q.inventoryValue();
    const finishedValue = DB.inventory.reduce((s, r) => {
      const p = Q.product(r.productId);
      if (!p) return s;
      const c = Q.costOf(p.id);
      return s + (c ? c.unitCost * (r.qtyOnHand || 0) : 0);
    }, 0);
    return materialsValue + finishedValue;
  },

  pnlOf(month) {
    const revenue = AccFin.revenueByMonth()[month] || 0;
    const cogs = AccFin.cogsByMonth()[month] || 0;
    const grossProfit = revenue - cogs;
    const opex = AccFin.opexByMonth()[month] || 0;
    const ebt = grossProfit - opex;
    const tax = Math.max(0, Math.round(ebt * (DB.accountingSettings.corporateTaxRatePct / 100)));
    return { revenue, cogs, grossProfit, opex, ebt, tax, netProfit: ebt - tax };
  },

  deptActualSpend(dept) {
    return (DB.purchases || []).filter((p) => p.dept === dept && p.status !== 'mh_tu_choi').reduce((s, p) => s + (p.total || 0), 0);
  },
};

/* -------------------------------------------------------------- 2. GIAO DIỆN */
const ACCOUNTING_TABS = [
  ['budget', 'Ngân sách'],
  ['pnl', 'P&L'],
  ['balance_sheet', 'Balance Sheet'],
  ['cashflow', 'Cashflow'],
];

function accTabsBar(active) {
  return `<div class="tabs module-tabs" style="margin-bottom:16px">
    ${ACCOUNTING_TABS.map(([id, label]) => `<button class="tab ${active === id ? 'active' : ''}" data-act="nav" data-id="accounting" data-tab="${id}">${esc(label)}</button>`).join('')}
  </div>`;
}

function pctDelta(cur, prev) {
  if (!prev) return '';
  const d = ((cur - prev) / Math.abs(prev)) * 100;
  const tone = d >= 0 ? 'green' : 'red';
  const arrow = d >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
  return `<span class="kpi-delta ${tone === 'green' ? 'up' : 'down'}"><i class="fa-solid ${arrow}"></i>${Math.abs(d).toFixed(1)}%</span> so với tháng trước`;
}

/* ----------------------------------------------------------------
 * ACCOUNTING FILTER HELPERS
 * ---------------------------------------------------------------- */

function accDateInRange(date, from, to) {
  if (!date) return false;
  if (from && String(date) < String(from)) return false;
  if (to && String(date) > String(to)) return false;
  return true;
}

function accTextMatch(values, keyword) {
  if (!keyword) return true;
  const q = String(keyword).trim().toLowerCase();
  if (!q) return true;

  return values.some((v) =>
    String(v ?? '').toLowerCase().includes(q)
  );
}

/* Khoảng ngày mặc định cho báo cáo */
function accDefaultReportFilter(key) {
  const today = currentDateYMD ? currentDateYMD() : String(TODAY);

  const d = new Date(today);
  const y = d.getFullYear();
  const m = d.getMonth();

  if (key === 'acc-report-pnl' || key === 'acc-report-tax') {
    return {
      period: 'month',
      year: y,
      month: String(m + 1).padStart(2, '0'),
      from: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      to: today
    };
  }

  if (key === 'acc-report-cashflow') {
    const from = new Date(y, m - 5, 1);

    return {
      period: 'month',
      from: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-01`,
      to: today
    };
  }

  if (key === 'acc-report-bs') {
    return {
      asOf: today
    };
  }

  return {};
}

function accReportPeriodLabel(period, from, to) {
  if (period === 'month') {
    return `Theo tháng · ${fmtDate(from)} → ${fmtDate(to)}`;
  }

  if (period === 'quarter') {
    return `Theo quý · ${fmtDate(from)} → ${fmtDate(to)}`;
  }

  if (period === 'year') {
    return `Theo năm · ${fmtDate(from)} → ${fmtDate(to)}`;
  }

  return `${fmtDate(from)} → ${fmtDate(to)}`;
}

/* Gom dữ liệu theo tháng / quý / năm */
function accGroupKey(date, groupBy = 'month') {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';

  const y = d.getFullYear();
  const m = d.getMonth() + 1;

  if (groupBy === 'year') {
    return String(y);
  }

  if (groupBy === 'quarter') {
    return `${y}-Q${Math.ceil(m / 3)}`;
  }

  return `${y}-${String(m).padStart(2, '0')}`;
}

function accGroupLabel(key, groupBy = 'month') {
  if (groupBy === 'year') {
    return `Năm ${key}`;
  }

  if (groupBy === 'quarter') {
    return key.replace('-', ' / ');
  }

  const [y, m] = key.split('-');
  return `Th${Number(m)}/${String(y).slice(2)}`;
}

/* ---- 2.1 Tổng quan ---- */
function accDashboardView() {
  const m = AccFin.currentMonth(), pm = AccFin.prevMonth();
  const rev = AccFin.revenueByMonth()[m] || 0, prevRev = AccFin.revenueByMonth()[pm] || 0;
  const cogs = AccFin.cogsByMonth()[m] || 0, prevCogs = AccFin.cogsByMonth()[pm] || 0;
  const gp = rev - cogs, prevGp = prevRev - prevCogs;
  const ar = AccFin.totalAR(), ap = AccFin.totalAP();
  const cash = AccFin.totalBankBalance();
  const assetNet = AccFin.totalAssetsNet();
  const invValue = AccFin.inventoryBookValue();

  const months = AccFin.last6Months();
  const revMap = AccFin.revenueByMonth(), cogsMap = AccFin.cogsByMonth();

  return `${pageHead('Tổng quan tài chính', 'Số liệu tổng hợp tự động từ Bán hàng, Sản xuất, Kho và Mua hàng', '<button class="btn btn-sm" data-act="nav" data-id="accounting" data-tab="reports_hub"><i class="fa-solid fa-file-export"></i>Xem báo cáo</button>')}
  <div class="grid g-auto" style="margin-bottom:14px">
    ${mkpi('Doanh thu thuần tháng', fmtVND(rev), 'fa-sack-dollar', 'blue', null, pctDelta(rev, prevRev))}
    ${mkpi('Giá vốn hàng bán', fmtVND(cogs), 'fa-cubes', 'orange', null, pctDelta(cogs, prevCogs))}
    ${mkpi('Lợi nhuận gộp', fmtVND(gp), 'fa-chart-line', 'green', null, pctDelta(gp, prevGp))}
    ${mkpi('Tồn quỹ ngân hàng', fmtVND(cash), 'fa-building-columns', 'indigo')}
    ${mkpi('Công nợ phải thu', fmtVND(ar), 'fa-hand-holding-dollar', 'teal', 'nav', )}
    ${mkpi('Công nợ phải chi', fmtVND(ap), 'fa-file-invoice-dollar', 'red')}
    ${mkpi('Giá trị tồn kho', fmtVND(invValue), 'fa-boxes-stacked', 'slate')}
    ${mkpi('Tài sản cố định (còn lại)', fmtVND(assetNet), 'fa-warehouse', 'blue')}
  </div>
  <div class="card" style="margin-bottom:14px">
    <div class="card-head"><div><h3>Doanh thu &amp; Giá vốn 6 tháng gần nhất</h3><p>Doanh thu ghi nhận theo đơn hàng đã giao; giá vốn tính theo định mức BOM/Routing hiện hành</p></div></div>
    <div class="card-body"><div class="chart-box"><canvas id="accTrendChart"></canvas></div></div>
  </div>
  <div class="grid g-2">
    <div class="card">
      <div class="card-head"><h3>Thu – Chi gần đây</h3><div class="right"><button class="btn btn-sm" data-act="nav" data-id="accounting" data-tab="cashflow_inout">Xem tất cả</button></div></div>
      ${accRecentCashRows()}
    </div>
    <div class="card">
      <div class="card-head"><h3>Công nợ cần chú ý</h3></div>
      ${accTopDebtRows()}
    </div>
  </div>`;
}
accDashboardView.months = null;

function accRecentCashRows() {
  const rows = accAllCashRows().slice(0, 6);
  return tableShell([{ t: 'Ngày' }, { t: 'Loại' }, { t: 'Diễn giải' }, { t: 'Số tiền', cls: 'right' }],
    rows.map((r) => `<tr><td class="num">${fmtDate(r.date)}</td><td>${r.type === 'THU' ? '<span class="badge green">Thu</span>' : '<span class="badge red">Chi</span>'}</td><td>${cell2(esc(r.note), esc(r.source))}</td><td class="right num strong">${fmtVND(r.amount)}</td></tr>`),
    { emptyTitle: 'Chưa có giao dịch' });
}

function accTopDebtRows() {
  const arRows = AccFin.recognizedOrders().map(o=>({o,remain:typeof SalesCRM!=='undefined'?SalesCRM.receivableOfOrder(o):Math.max(0,Number(o.total||0)-Number(o.paid||0))})).filter(x=>x.remain>0).sort((a,b)=>b.remain-a.remain).slice(0,4)
    .map(({o,remain}) => `<tr><td>${cell2(esc(Q.customerName(o.customerId)), 'Phải thu · ' + esc(o.id))}</td><td class="right num strong" style="color:var(--teal)">${fmtVND(remain)}</td></tr>`);
  const apRows = AccFin.activePOs().map(po=>{const remain=typeof purchasePayableRemaining==='function'?purchasePayableRemaining(po):Math.max(0,Number(po.total||0)-Number(po.paid||0));return {po,remain};}).filter(x=>x.remain>0).sort((a,b)=>b.remain-a.remain).slice(0,4)
    .map(({po,remain}) => `<tr><td>${cell2(esc(Q.supplierName(po.supplierId)), 'Phải chi · ' + esc(po.id))}</td><td class="right num strong" style="color:var(--red)">${fmtVND(remain)}</td></tr>`);
  return tableShell([{ t: 'Đối tượng' }, { t: '', cls: 'right' }], [...arRows, ...apRows], { emptyTitle: 'Không có công nợ đáng chú ý' });
}

/** Toàn bộ dòng thu-chi (tự động + thủ công), sắp xếp mới nhất trước */
function accAllCashRows() {
  const rows = [];
  DB.customerPayments.forEach((p) => rows.push({ date: p.date, type: 'THU', amount: p.amount, note: p.note || `Thu tiền ${Q.customerName(p.customerId)}`, source: 'Tự động · Hợp đồng/Đơn hàng', ref: p.contractId || '', editable: false, id: p.id, kind: 'customerPayment' }));
  DB.supplierPayments.forEach((p) => rows.push({ date: p.date, type: 'CHI', amount: p.amount, note: p.note || `Trả NCC ${Q.supplierName(p.supplierId)}`, source: 'Tự động · Mua hàng', ref: p.poId || '', editable: false, id: p.id, kind: 'supplierPayment' }));
  (DB.supplierRefunds || []).forEach((r) => rows.push({ date: r.date, type: 'THU', amount: r.amount, note: r.note || `NCC hoàn tiền ${Q.supplierName(r.supplierId)}`, source: 'Tự động · Hoàn tiền NCC', ref: r.poId || '', editable: false, id: r.id, kind: 'supplierRefund' }));
  DB.cashTransactions.forEach((t) => rows.push({ date: t.date, type: t.type, amount: t.amount, note: t.note || t.category, source: 'Thủ công · ' + (t.category || ''), ref: '', editable: true, id: t.id, kind: 'manual' }));
  return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
accDashboardView.after = function () {
  const months = AccFin.last6Months();
  const revMap = AccFin.revenueByMonth(), cogsMap = AccFin.cogsByMonth();
  if (typeof Charts !== 'undefined') {
    Charts.bar('accTrendChart', months.map(AccFin.fmtMonthShort), [
      { label: 'Doanh thu', data: months.map((m) => revMap[m] || 0), color: 'blue' },
      { label: 'Giá vốn', data: months.map((m) => cogsMap[m] || 0), color: 'orange' },
    ], { money: true });
  }
};

/* ---- 2.2 Thu – Chi ---- */
function accCashflowInOutView() {
  const f = F('acc-cash', { type: '', from: '', to: '' });
  let rows = accAllCashRows();
  if (f.type) rows = rows.filter((r) => r.type === f.type);
  if (f.from) rows = rows.filter((r) => r.date >= f.from);
  if (f.to) rows = rows.filter((r) => r.date <= f.to);
  const totalIn = rows.filter((r) => r.type === 'THU').reduce((s, r) => s + r.amount, 0);
  const totalOut = rows.filter((r) => r.type === 'CHI').reduce((s, r) => s + r.amount, 0);
  const pg = paged(rows, 'acc-cash', 15);

  return `${pageHead('Thu – Chi', 'Sổ quỹ tổng hợp: tự động từ công nợ khách hàng/nhà cung cấp + ghi nhận thủ công', `
      <button class="btn" data-act="acc-cash-add" data-type="THU"><i class="fa-solid fa-arrow-down"></i>Ghi nhận thu</button>
      <button class="btn btn-primary" data-act="acc-cash-add" data-type="CHI"><i class="fa-solid fa-arrow-up"></i>Ghi nhận chi</button>`)}
    <div class="grid g-auto-sm" style="margin-bottom:14px">
      ${mkpi('Tổng thu (theo lọc)', fmtVND(totalIn), 'fa-arrow-down', 'green')}
      ${mkpi('Tổng chi (theo lọc)', fmtVND(totalOut), 'fa-arrow-up', 'red')}
      ${mkpi('Chênh lệch', fmtVND(totalIn - totalOut), 'fa-scale-balanced', totalIn >= totalOut ? 'blue' : 'orange')}
    </div>
    <div class="card">
      <div class="toolbar">
        ${selectFilter('acc-cash', 'type', [['THU', 'Thu'], ['CHI', 'Chi']], 'Tất cả loại')}
        <span class="muted" style="font-size:13px;white-space:nowrap">Từ ngày</span><input class="inp" type="date" data-f="acc-cash.from" value="${esc(f.from || '')}">
        <span class="muted" style="font-size:13px;white-space:nowrap">Đến ngày</span><input class="inp" type="date" data-f="acc-cash.to" value="${esc(f.to || '')}">
        ${(f.type || f.from || f.to) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="acc-cash"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
        <span class="spacer"></span><span class="chip">${rows.length} giao dịch</span>
      </div>
      ${tableShell([{ t: 'Ngày' }, { t: 'Loại' }, { t: 'Diễn giải' }, { t: 'Chứng từ / Nguồn' }, { t: 'Số tiền', cls: 'right' }, { t: '', cls: 'right' }],
        pg.items.map((r) => `<tr>
          <td class="num">${fmtDate(r.date)}</td>
          <td>${r.type === 'THU' ? '<span class="badge green">Thu</span>' : '<span class="badge red">Chi</span>'}</td>
          <td>${esc(r.note)}</td>
          <td class="muted">${esc(r.ref || r.source)}</td>
          <td class="right num strong" style="color:${r.type === 'THU' ? 'var(--green)' : 'var(--red)'}">${r.type === 'THU' ? '+' : '−'}${fmtVND(r.amount)}</td>
          <td class="right">${r.editable ? `<button class="btn btn-icon btn-sm" data-act="acc-cash-delete" data-id="${esc(r.id)}" title="Xóa"><i class="fa-solid fa-trash"></i></button>` : `<span class="cell-sub">Tự động</span>`}</td>
        </tr>`), { emptyTitle: 'Chưa có giao dịch thu chi' })}
      ${pagiHTML('acc-cash', pg, 'giao dịch')}
    </div>`;
}

function openCashTxForm(type) {
  Modal.open({
    title: type === 'THU' ? 'Ghi nhận khoản thu' : 'Ghi nhận khoản chi',
    sub: 'Dùng cho các khoản không tự sinh ra từ Bán hàng/Mua hàng, ví dụ lương, điện nước, thu khác…',
    body: `<div class="form-grid">
        <div class="field"><label>Ngày <span class="req">*</span></label><input class="inp" id="ctxDate" type="date" value="${currentDateYMD()}"></div>
        <div class="field"><label>Số tiền <span class="req">*</span></label><input class="inp right num" id="ctxAmount" data-money="1" type="text" inputmode="numeric" min="0" step="1000"></div>
        <div class="field" style="grid-column:1/-1"><label>Khoản mục</label><select class="inp" id="ctxCategory">${DB.accountingSettings.opexCategories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></div>
        <div class="field" style="grid-column:1/-1"><label>Diễn giải</label><textarea class="inp" id="ctxNote" rows="2" placeholder="Nội dung khoản thu/chi"></textarea></div>
      </div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button><button class="btn btn-primary" data-act="acc-cash-save" data-type="${type}"><i class="fa-solid fa-floppy-disk"></i>Lưu</button>`,
  });
}

/* ---- 2.3 Ngân hàng ---- */
function accBankingView() {
  const accRows = (DB.bankAccounts || []).map((b) => {
    const store = (DB.stores || []).find(s => String(s.id) === String(b.storeId));
    const scope = b.scopeType === 'STORE' ? (store?.name || b.storeId || 'Chi nhánh / Cửa hàng') : 'Công ty';
    return `<tr>
      <td>${cell2(esc(b.name), esc(b.bankName || '') + ' · ' + esc(b.accountNumber || ''))}</td>
      <td>${esc(scope)}${b.isDefault ? '<div class="cell-sub">Tài khoản mặc định</div>' : ''}</td>
      <td>${b.active === false ? '<span class="badge gray">Ngừng dùng</span>' : '<span class="badge green">Đang dùng</span>'}</td>
      <td class="right num strong">${fmtVND(AccFin.bankBalance(b.id))}</td>
      <td class="right"><button class="btn btn-sm" data-act="acc-bank-tx-add" data-id="${esc(b.id)}"><i class="fa-solid fa-plus"></i>Giao dịch</button></td>
    </tr>`;
  });
  const txRows = (DB.bankTransactions || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30)
    .map((t) => `<tr><td class="num">${fmtDate(t.date)}</td><td>${esc((DB.bankAccounts.find((b) => b.id === t.bankId) || {}).name || '—')}</td><td>${esc(t.note)}</td><td class="right num strong" style="color:${t.type === 'IN' ? 'var(--green)' : 'var(--red)'}">${t.type === 'IN' ? '+' : '−'}${fmtVND(t.amount)}</td></tr>`);

  return `${pageHead('Ngân hàng', 'Số dư tài khoản ghi nhận thủ công theo sao kê — hệ thống chưa kết nối trực tiếp API ngân hàng', '<button class="btn btn-primary" data-act="acc-bank-add"><i class="fa-solid fa-plus"></i>Thêm tài khoản</button>')}
    <div class="alert-item" style="margin-bottom:14px;cursor:default"><span class="alert-ico t-orange"><i class="fa-solid fa-circle-info"></i></span><div><b class="alert-title">Chưa kết nối API ngân hàng</b><div class="alert-sub">Số dư dưới đây được cập nhật thủ công theo sao kê định kỳ. Khi có API Open Banking, phần này sẽ tự đồng bộ mà không đổi cấu trúc dữ liệu.</div></div></div>
    <div class="card" style="margin-bottom:14px">
      <div class="card-head"><h3>Tài khoản ngân hàng</h3></div>
      ${tableShell([{ t: 'Tài khoản' }, { t: 'Phạm vi sử dụng' }, { t: 'Trạng thái' }, { t: 'Số dư hiện tại', cls: 'right' }, { t: '', cls: 'right' }], accRows, { emptyTitle: 'Chưa có tài khoản ngân hàng' })}
    </div>
    <div class="card">
      <div class="card-head"><h3>Sổ phụ / Giao dịch gần đây</h3></div>
      ${tableShell([{ t: 'Ngày' }, { t: 'Tài khoản' }, { t: 'Nội dung' }, { t: 'Số tiền', cls: 'right' }], txRows, { emptyTitle: 'Chưa có giao dịch ngân hàng' })}
    </div>`;
}

function openBankAccountForm() {
  const stores = (DB.stores || []).filter(s => s.status !== 'inactive');
  Modal.open({
    title: 'Thêm tài khoản ngân hàng',
    body: `<div class="form-grid cols-2">
        <div class="field" style="grid-column:1/-1"><label>Tên gợi nhớ <span class="req">*</span></label><input class="inp" id="bkName" placeholder="VD: Vietcombank – TK thanh toán"></div>
        <div class="field"><label>Ngân hàng <span class="req">*</span></label><input class="inp" id="bkBankName" placeholder="Vietcombank, ACB…"></div>
        <div class="field"><label>Số tài khoản <span class="req">*</span></label><input class="inp" id="bkNumber"></div>
        <div class="field" style="grid-column:1/-1"><label>Chủ tài khoản</label><input class="inp" id="bkAccountName" placeholder="CÔNG TY TNHH ..."></div>
        <div class="field"><label>Phạm vi sử dụng *</label><select class="inp" id="bkScope" onchange="accountingBankScopeChanged()"><option value="COMPANY">Công ty</option><option value="STORE">Chi nhánh / Cửa hàng</option></select></div>
        <div class="field" id="bkStoreWrap" style="display:none"><label>Chi nhánh / Cửa hàng *</label><select class="inp" id="bkStore"><option value="">-- Chọn chi nhánh / cửa hàng --</option>${stores.map(st=>`<option value="${esc(st.id)}">${esc(st.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Trạng thái</label><select class="inp" id="bkActive"><option value="1">Đang sử dụng</option><option value="0">Ngừng sử dụng</option></select></div>
        <div class="field"><label>Số dư ban đầu</label><input class="inp right num" id="bkOpening" data-money="1" type="text" inputmode="numeric" min="0" step="1000" value="0"></div>
        <div class="field" style="grid-column:1/-1"><label class="check"><input type="checkbox" id="bkDefault"> Tài khoản mặc định trong phạm vi này</label></div>
      </div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button><button class="btn btn-primary" data-act="acc-bank-save"><i class="fa-solid fa-floppy-disk"></i>Lưu tài khoản</button>`,
  });
}
function accountingBankScopeChanged(){
  const wrap=$('#bkStoreWrap'); if(wrap) wrap.style.display=$('#bkScope')?.value==='STORE'?'':'none';
}

function openBankTxForm(bankId) {
  const b = DB.bankAccounts.find((x) => x.id === bankId);
  if (!b) return;
  Modal.open({
    title: `Ghi nhận giao dịch · ${b.name}`,
    body: `<div class="form-grid">
        <div class="field"><label>Loại</label><select class="inp" id="bkTxType"><option value="IN">Tiền vào</option><option value="OUT">Tiền ra</option></select></div>
        <div class="field"><label>Ngày</label><input class="inp" id="bkTxDate" type="date" value="${currentDateYMD()}"></div>
        <div class="field" style="grid-column:1/-1"><label>Số tiền <span class="req">*</span></label><input class="inp right num" id="bkTxAmount" data-money="1" type="text" inputmode="numeric" min="0" step="1000"></div>
        <div class="field" style="grid-column:1/-1"><label>Nội dung</label><input class="inp" id="bkTxNote" placeholder="Nội dung theo sao kê"></div>
      </div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button><button class="btn btn-primary" data-act="acc-bank-tx-save" data-id="${esc(bankId)}"><i class="fa-solid fa-floppy-disk"></i>Lưu</button>`,
  });
}

/* ---- 2.4 Phải thu — dùng chung dữ liệu CRM, không tạo sổ công nợ song song ---- */
function accArView() {
  const f = F('acc-ar', {q:'',customerId:'',status:'',from:'',to:''});
  const q = String(f.q||'').trim().toLowerCase();
  const statusOpts=[['UNPAID','Chưa thanh toán'],['PARTIALLY_PAID','Thanh toán một phần'],['PAID','Đã thanh toán'],['OVERDUE','Quá hạn']];
  const customerOpts=(DB.customers||[]).map(c=>[c.id,`${c.id} · ${c.name}`]);
  let list=AccFin.recognizedOrders().filter(o=>{
    const st=typeof SalesCRM!=='undefined'?SalesCRM.receivableStatus(o):'';
    const d=String(o.date||'').slice(0,10);
    if(f.customerId&&o.customerId!==f.customerId)return false;
    if(f.status&&st!==f.status)return false;
    if(f.from&&d<f.from)return false;
    if(f.to&&d>f.to)return false;
    if(q&&![o.id,Q.customerName(o.customerId)].some(v=>String(v||'').toLowerCase().includes(q)))return false;
    return true;
  }).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.id||'').localeCompare(String(a.id||'')));
  const paidOf=o=>typeof SalesCRM!=='undefined'?SalesCRM.paidOfOrder(o.id):Number(o.paid||0);
  const remainOf=o=>typeof SalesCRM!=='undefined'?SalesCRM.receivableOfOrder(o):Math.max(0,Number(o.total||0)-paidOf(o));
  const statusOf=o=>typeof SalesCRM!=='undefined'?SalesCRM.receivableStatus(o):(remainOf(o)>0?'UNPAID':'PAID');
  const total=list.reduce((s,o)=>s+remainOf(o),0);
  const overdue=list.reduce((s,o)=>s+(statusOf(o)==='OVERDUE'?remainOf(o):0),0);
  const customersInDebt=new Set(list.filter(o=>remainOf(o)>0).map(o=>o.customerId)).size;
  const badgeAr=st=>({UNPAID:'<span class="badge slate">Chưa thanh toán</span>',PARTIALLY_PAID:'<span class="badge orange">Thanh toán một phần</span>',PAID:'<span class="badge green">Đã thanh toán</span>',OVERDUE:'<span class="badge red">Quá hạn</span>'}[st]||esc(st));
  const rows=list.map(o=>{const paid=paidOf(o),remain=remainOf(o),st=statusOf(o);return `<tr>
    <td><span class="code">${esc(o.id)}</span><div class="cell-sub">${fmtDate(o.date)}</div></td>
    <td>${cell2(esc(Q.customerName(o.customerId)),esc(o.customerId||''))}</td>
    <td>${fmtDate(o.paymentDueDate||o.dueDate)}</td>
    <td class="right num">${fmtVND(Number(o.total||0))}</td><td class="right num" style="color:var(--green)">${fmtVND(paid)}</td>
    <td class="right num strong" style="color:${remain>0?'var(--red)':'var(--text-3)'}">${fmtVND(remain)}</td><td>${badgeAr(st)}</td>
    <td class="right">${remain>0?`<button class="btn btn-sm btn-primary" data-act="crm-customer-pay-modal" data-id="${esc(o.id)}"><i class="fa-solid fa-hand-holding-dollar"></i>Thu tiền</button>`:'<span class="muted">Tất toán</span>'}</td></tr>`;});
  const paymentRows=[...(DB.customerPayments||[])].filter(p=>{const d=String(p.date||'').slice(0,10);if(f.customerId&&p.customerId!==f.customerId)return false;if(f.from&&d<f.from)return false;if(f.to&&d>f.to)return false;return true;}).sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||''))).slice(0,100).map(p=>`<tr><td><span class="code">${esc(p.id)}</span></td><td>${fmtDate(p.date)}</td><td><span class="code">${esc(p.orderId||'—')}</span></td><td>${esc(Q.customerName(p.customerId))}</td><td class="right num strong">${fmtVND(Number(p.amount||0))}</td><td>${esc(p.method||'—')}</td><td>${esc(p.bankName||'—')}</td><td>${esc(p.payerName||p.collectedByName||Q.employeeName(p.createdBy)||'—')}</td></tr>`);
  return `${pageHead('Công nợ phải thu','Nguồn duy nhất từ Đơn hàng bán + lịch sử thu tiền CRM; không nhập công nợ trùng ở CRM','')}
    <div class="grid g-auto-sm" style="margin-bottom:14px">${mkpi('Tổng còn phải thu',fmtVND(total),'fa-hand-holding-dollar','teal')}${mkpi('Khách hàng còn nợ',customersInDebt,'fa-users','blue')}${mkpi('Quá hạn',fmtVND(overdue),'fa-triangle-exclamation','orange')}</div>
    <div class="card" style="margin-bottom:14px"><div class="toolbar">${searchBox('acc-ar','Tìm đơn hàng, khách hàng…')}${selectFilter('acc-ar','customerId',customerOpts,'Tất cả khách hàng')}${selectFilter('acc-ar','status',statusOpts,'Tất cả trạng thái')}${(f.q||f.customerId||f.status||f.from||f.to)?'<button class="btn btn-sm" data-act="clear-filter" data-key="acc-ar"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>':''}<label class="field-inline">Từ <input class="inp" type="date" data-f="acc-ar.from" value="${esc(f.from||'')}"></label><label class="field-inline">Đến <input class="inp" type="date" data-f="acc-ar.to" value="${esc(f.to||'')}"></label><span class="spacer"></span><span class="chip">${fmtN(list.length)} đơn</span></div>${tableShell([{t:'Đơn bán'},{t:'Khách hàng'},{t:'Hạn thanh toán'},{t:'Tổng phải thu',cls:'right'},{t:'Đã thu',cls:'right'},{t:'Còn phải thu',cls:'right'},{t:'Trạng thái'},{t:'',cls:'right'}],rows,{emptyTitle:'Không có công nợ phải thu phù hợp'})}</div>
    <div class="card"><div class="card-head"><div><h3>Lịch sử thu tiền</h3><p>Dùng chung dữ liệu với đơn hàng và chi tiết khách hàng.</p></div></div>${tableShell([{t:'Mã thu'},{t:'Ngày'},{t:'Đơn hàng'},{t:'Khách hàng'},{t:'Số tiền',cls:'right'},{t:'Phương thức'},{t:'Ngân hàng'},{t:'Người thực hiện'}],paymentRows,{emptyTitle:'Chưa có lịch sử thu tiền'})}</div>`;
}

/* ---- 2.5 Phải chi — dùng chung dữ liệu Mua hàng ---- */
function accApView() {
  const f=F('acc-ap',{q:'',supplierId:'',status:'',from:'',to:''});
  const q=String(f.q||'').trim().toLowerCase();
  const supplierOpts=(DB.suppliers||[]).map(x=>[x.id,`${x.id} · ${x.name}`]);
  const statusOpts=[['UNPAID','Chưa thanh toán'],['PARTIAL','Thanh toán một phần'],['PAID','Đã thanh toán'],['REFUND_DUE','NCC phải hoàn lại']];
  const paidOf=po=>typeof purchasePaidAmount==='function'?purchasePaidAmount(po):Math.max(Number(po.paid||0),(DB.supplierPayments||[]).filter(p=>String(p.poId)===String(po.id)).reduce((s,p)=>s+Number(p.amount||0),0));
  const remainOf=po=>typeof purchasePayableRemaining==='function'?purchasePayableRemaining(po):Math.max(0,Number(po.total||0)-paidOf(po));
  const refundOf=po=>typeof purchaseSupplierRefundDue==='function'?purchaseSupplierRefundDue(po):0;
  const statusOf=po=>{const paid=paidOf(po),remain=remainOf(po),refund=refundOf(po);return refund>0?'REFUND_DUE':remain<=0?'PAID':paid>0?'PARTIAL':'UNPAID';};
  let list=AccFin.activePOs().filter(po=>{const d=String(po.date||'').slice(0,10);if(f.supplierId&&po.supplierId!==f.supplierId)return false;if(f.status&&statusOf(po)!==f.status)return false;if(f.from&&d<f.from)return false;if(f.to&&d>f.to)return false;if(q&&![po.id,Q.supplierName(po.supplierId)].some(v=>String(v||'').toLowerCase().includes(q)))return false;return true;}).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.id||'').localeCompare(String(a.id||'')));
  const total=list.reduce((s,po)=>s+remainOf(po),0);
  const refundTotal=list.reduce((s,po)=>s+refundOf(po),0);
  const suppliersInDebt=new Set(list.filter(po=>remainOf(po)>0).map(po=>po.supplierId)).size;
  const badgeAp=st=>({UNPAID:'<span class="badge slate">Chưa thanh toán</span>',PARTIAL:'<span class="badge orange">Thanh toán một phần</span>',PAID:'<span class="badge green">Đã thanh toán</span>',REFUND_DUE:'<span class="badge orange">NCC phải hoàn lại</span>'}[st]||esc(st));
  const rows=list.map(po=>{const paid=paidOf(po),remain=remainOf(po),refund=refundOf(po),st=statusOf(po);return `<tr><td><span class="code">${esc(po.id)}</span><div class="cell-sub">${fmtDate(po.date)}</div></td><td>${esc(Q.supplierName(po.supplierId))}</td><td class="right num">${fmtVND(po.total)}</td><td class="right num" style="color:var(--green)">${fmtVND(paid)}</td><td class="right num strong" style="color:${remain>0?'var(--red)':'var(--text-3)'}">${fmtVND(remain)}</td><td class="right num strong" style="color:${refund>0?'var(--orange)':'var(--text-3)'}">${fmtVND(refund)}</td><td>${badgeAp(st)}</td><td class="right">${remain>0?`<button class="btn btn-sm btn-primary" data-act="supplier-pay-modal" data-id="${esc(po.id)}"><i class="fa-solid fa-money-bill-transfer"></i>Thanh toán</button>`:(refund>0?`<button class="btn btn-sm btn-primary" data-act="supplier-refund-modal" data-id="${esc(po.id)}"><i class="fa-solid fa-rotate-left"></i>Nhận hoàn tiền</button>`:'<span class="muted">Tất toán</span>')}</td></tr>`;});
  const paymentRows=[...(DB.supplierPayments||[])].filter(p=>{const d=String(p.date||'').slice(0,10);if(f.supplierId&&p.supplierId!==f.supplierId)return false;if(f.from&&d<f.from)return false;if(f.to&&d>f.to)return false;return true;}).sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||''))).slice(0,100).map(p=>`<tr><td><span class="code">${esc(p.id)}</span></td><td>${fmtDate(p.date)}</td><td><span class="code">${esc(p.poId||'—')}</span></td><td>${esc(Q.supplierName(p.supplierId))}</td><td class="right num strong">${fmtVND(Number(p.amount||0))}</td><td>${esc(p.method||'—')}</td><td>${esc(p.bankName||'—')}</td><td>${esc(p.payerName||Q.employeeName(p.createdBy)||'—')}</td></tr>`);
  const refundRows=[...(DB.supplierRefunds||[])].filter(r=>{const d=String(r.date||'').slice(0,10);if(f.supplierId&&r.supplierId!==f.supplierId)return false;if(f.from&&d<f.from)return false;if(f.to&&d>f.to)return false;return true;}).sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||''))).slice(0,100).map(r=>`<tr><td><span class="code">${esc(r.id)}</span></td><td>${fmtDate(r.date)}</td><td><span class="code">${esc(r.poId||'—')}</span></td><td>${esc(Q.supplierName(r.supplierId))}</td><td class="right num strong" style="color:var(--green)">${fmtVND(Number(r.amount||0))}</td><td>${esc(r.method==='BANK_TRANSFER'?'Chuyển khoản ngân hàng':r.method==='CASH'?'Tiền mặt':r.method||'—')}</td><td>${esc(r.bankName||'—')}</td><td>${esc(r.receivedByName||r.createdByName||'—')}</td></tr>`);
  return `${pageHead('Công nợ phải chi','Nguồn duy nhất từ Đơn đặt hàng mua + lịch sử thanh toán nhà cung cấp','')}
    <div class="grid g-auto-sm" style="margin-bottom:14px">${mkpi('Tổng còn phải chi',fmtVND(total),'fa-file-invoice-dollar','red')}${mkpi('NCC phải hoàn lại',fmtVND(refundTotal),'fa-rotate-left','orange')}${mkpi('Nhà cung cấp còn nợ',suppliersInDebt,'fa-building','orange')}</div>
    <div class="card" style="margin-bottom:14px"><div class="toolbar">${searchBox('acc-ap','Tìm PO, nhà cung cấp…')}${selectFilter('acc-ap','supplierId',supplierOpts,'Tất cả nhà cung cấp')}${selectFilter('acc-ap','status',statusOpts,'Tất cả trạng thái')}${(f.q||f.supplierId||f.status||f.from||f.to)?'<button class="btn btn-sm" data-act="clear-filter" data-key="acc-ap"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>':''}<label class="field-inline">Từ <input class="inp" type="date" data-f="acc-ap.from" value="${esc(f.from||'')}"></label><label class="field-inline">Đến <input class="inp" type="date" data-f="acc-ap.to" value="${esc(f.to||'')}"></label><span class="spacer"></span><span class="chip">${fmtN(list.length)} PO</span></div>${tableShell([{t:'Đơn mua'},{t:'Nhà cung cấp'},{t:'Giá trị',cls:'right'},{t:'Đã trả',cls:'right'},{t:'Còn phải chi',cls:'right'},{t:'NCC phải hoàn lại',cls:'right'},{t:'Trạng thái'},{t:'',cls:'right'}],rows,{emptyTitle:'Không có công nợ phải chi phù hợp'})}</div>
    <div class="card" style="margin-bottom:14px"><div class="card-head"><div><h3>Lịch sử thanh toán nhà cung cấp</h3><p>Dùng chung dữ liệu với Mua hàng.</p></div></div>${tableShell([{t:'Mã chi'},{t:'Ngày'},{t:'PO'},{t:'Nhà cung cấp'},{t:'Số tiền',cls:'right'},{t:'Phương thức'},{t:'Ngân hàng'},{t:'Người thực hiện'}],paymentRows,{emptyTitle:'Chưa có lịch sử thanh toán'})}</div><div class="card"><div class="card-head"><div><h3>Lịch sử NCC hoàn tiền</h3><p>Khoản doanh nghiệp đã nhận lại sau trả hàng hoặc thanh toán dư.</p></div></div>${tableShell([{t:'Mã nhận hoàn'},{t:'Ngày'},{t:'PO'},{t:'Nhà cung cấp'},{t:'Số tiền nhận',cls:'right'},{t:'Phương thức'},{t:'Ngân hàng nhận'},{t:'Người ghi nhận'}],refundRows,{emptyTitle:'Chưa có NCC hoàn tiền'})}</div>`;
}

/* ---- 2.6 Giá thành ---- */
function accCostingView() {
  const f = F('acc-costing', { status: 'lsx_hoan_thanh' });
  let list = DB.productionOrders.slice();
  if (f.status) list = list.filter((p) => p.status === f.status);
  const rows = list.map((po) => {
    const c = Q.costOf(po.productId);
    if (!c) return '';
    const material = Math.round(c.materialCost * po.qty), labor = Math.round(c.laborCost * po.qty), overhead = Math.round(c.overhead * po.qty);
    const totalCost = material + labor + overhead;
    const sellPrice = c.product.price * po.qty;
    const profit = sellPrice - totalCost;
    return `<tr>
        <td><span class="code" data-act="open-po" data-id="${esc(po.id)}" style="cursor:pointer">${esc(po.id)}</span><div class="cell-sub">${esc(po.productName)}</div></td>
        <td class="num">${fmtN(po.qty)} ${esc(po.unit)}</td>
        <td class="right num">${fmtVND(material)}</td>
        <td class="right num">${fmtVND(labor)}</td>
        <td class="right num">${fmtVND(overhead)}</td>
        <td class="right num strong">${fmtVND(totalCost)}</td>
        <td class="right num">${fmtVND(sellPrice)}</td>
        <td class="right num strong" style="color:${profit >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtVND(profit)}</td>
      </tr>`;
  }).join('');

  return `${pageHead('Giá thành sản xuất', 'Tính tự động từ định mức BOM/Routing của từng lệnh sản xuất theo đơn giá hiện hành', '')}
    <div class="card">
      <div class="toolbar">${selectFilter('acc-costing', 'status', statusOptions('lsx_'), 'Tất cả trạng thái')}<span class="spacer"></span><span class="chip">${list.length} lệnh sản xuất</span></div>
      ${tableShell([{ t: 'Lệnh SX' }, { t: 'SL' }, { t: 'CP nguyên liệu', cls: 'right' }, { t: 'CP công đoạn', cls: 'right' }, { t: 'CP quản lý PB', cls: 'right' }, { t: 'Giá thành', cls: 'right' }, { t: 'Doanh thu', cls: 'right' }, { t: 'Lợi nhuận gộp', cls: 'right' }], rows, { emptyTitle: 'Không có lệnh sản xuất phù hợp' })}
    </div>`;
}

/* ---- 2.7 Tài sản cố định ---- */
function accFixedAssetsView() {
  const rows = (DB.fixedAssets || []).map((a) => `<tr>
      <td><span class="code">${esc(a.id)}</span></td>
      <td>${cell2(esc(a.name), esc(a.dept))}</td>
      <td class="num">${fmtDate(a.purchaseDate)}</td>
      <td class="right num">${fmtVND(a.cost)}</td>
      <td class="num center">${a.usefulYears} năm</td>
      <td class="right num">${fmtVND(AccFin.assetAccumDep(a))}</td>
      <td class="right num strong">${fmtVND(AccFin.assetBookValue(a))}</td>
      <td>${a.status === 'disposed' ? badge('vt_het_hang') : badge('vt_du_ton')}</td>
      <td class="right">${rowActions([{ act: 'acc-asset-edit', data: `data-id="${a.id}"`, icon: 'fa-pen', title: 'Sửa' }, { act: 'acc-asset-delete', data: `data-id="${a.id}"`, icon: 'fa-trash', title: 'Xóa' }])}</td>
    </tr>`);
  const totalCost = (DB.fixedAssets || []).reduce((s, a) => s + a.cost, 0);
  const totalNet = AccFin.totalAssetsNet();
  return `${pageHead('Tài sản cố định', 'Khấu hao đường thẳng theo số năm sử dụng, tự tính lại theo ngày hiện tại', '<button class="btn btn-primary" data-act="acc-asset-add"><i class="fa-solid fa-plus"></i>Thêm tài sản</button>')}
    <div class="grid g-auto-sm" style="margin-bottom:14px">${mkpi('Nguyên giá', fmtVND(totalCost), 'fa-warehouse', 'blue')}${mkpi('Giá trị còn lại', fmtVND(totalNet), 'fa-scale-balanced', 'green')}${mkpi('Khấu hao lũy kế', fmtVND(totalCost - totalNet), 'fa-chart-line', 'orange')}</div>
    <div class="card">${tableShell([{ t: 'Mã' }, { t: 'Tài sản' }, { t: 'Ngày mua' }, { t: 'Nguyên giá', cls: 'right' }, { t: 'Thời gian KH', cls: 'center' }, { t: 'Khấu hao lũy kế', cls: 'right' }, { t: 'Giá trị còn lại', cls: 'right' }, { t: 'Trạng thái' }, { t: '', cls: 'right' }], rows, { emptyTitle: 'Chưa có tài sản cố định' })}</div>`;
}

function openFixedAssetForm(id = '') {
  const a = id ? (DB.fixedAssets || []).find((x) => x.id === id) : null;
  return Modal.open({
    title: a ? 'Sửa tài sản cố định' : 'Thêm tài sản cố định',
    body: `<div class="form-grid">
        <div class="field" style="grid-column:1/-1"><label>Tên tài sản <span class="req">*</span></label><input class="inp" id="faName" value="${esc(a?.name || '')}"></div>
        <div class="field"><label>Bộ phận sử dụng</label><select class="inp" id="faDept">${DB.departments.map((d) => `<option ${a?.dept === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></div>
        <div class="field"><label>Ngày mua</label><input class="inp" id="faDate" type="date" value="${esc(a?.purchaseDate || currentDateYMD())}"></div>
        <div class="field"><label>Nguyên giá <span class="req">*</span></label><input class="inp right num" id="faCost" data-money="1" type="text" inputmode="numeric" min="0" step="1000" value="${a?.cost || ''}"></div>
        <div class="field"><label>Số năm khấu hao</label><input class="inp right num" id="faYears" type="number" min="1" max="30" value="${a?.usefulYears || 8}"></div>
      </div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button><button class="btn btn-primary" data-act="acc-asset-save" data-id="${esc(id)}"><i class="fa-solid fa-floppy-disk"></i>Lưu</button>`,
  });
}

/* ---- 2.8 Thuế ---- */
function accTaxView() {
  const months = AccFin.last6Months();
  const outMap = AccFin.vatOutputByMonth(), inMap = AccFin.vatInputByMonth();
  let totalOut = 0, totalIn = 0;
  const rows = months.map((m) => {
    const out = outMap[m] || 0, inp = inMap[m] || 0;
    totalOut += out; totalIn += inp;
    const payable = out - inp;
    return `<tr><td>${AccFin.fmtMonthShort(m)}/${m.slice(0, 4)}</td><td class="right num">${fmtVND(out)}</td><td class="right num">${fmtVND(inp)}</td><td class="right num strong" style="color:${payable >= 0 ? 'var(--red)' : 'var(--green)'}">${payable >= 0 ? fmtVND(payable) : 'Được khấu trừ ' + fmtVND(-payable)}</td></tr>`;
  });
  return `${pageHead('Thuế', 'VAT đầu ra tính theo Đơn hàng bán, VAT đầu vào tính theo Đơn đặt hàng mua — không cần khai báo tay', '<button class="btn" data-act="export-report" data-key="rp-material"><i class="fa-solid fa-file-export"></i>Xuất bảng kê</button>')}
    <div class="grid g-auto-sm" style="margin-bottom:14px">${mkpi('VAT đầu ra (6 tháng)', fmtVND(totalOut), 'fa-arrow-up', 'red')}${mkpi('VAT đầu vào (6 tháng)', fmtVND(totalIn), 'fa-arrow-down', 'green')}${mkpi('Thuế TNDN ước tính tháng này', fmtVND(AccFin.pnlOf(AccFin.currentMonth()).tax), 'fa-landmark', 'indigo')}</div>
    <div class="card">${tableShell([{ t: 'Tháng' }, { t: 'VAT đầu ra', cls: 'right' }, { t: 'VAT đầu vào', cls: 'right' }, { t: 'Phải nộp / Được khấu trừ', cls: 'right' }], rows, { emptyTitle: 'Chưa có dữ liệu' })}</div>`;
}

/* ---- 2.9 Ngân sách vs Thực tế ---- */
function accBudgetView() {
  const rows = (DB.budgets || []).map((b) => {
    const actual = AccFin.deptActualSpend(b.dept);
    const pct = b.totalBudget ? Math.round((actual / b.totalBudget) * 100) : 0;
    return `<tr><td class="strong">${esc(b.dept)}</td><td class="right num">${fmtVND(b.totalBudget)}</td><td class="right num">${fmtVND(actual)}</td><td class="right num" style="color:${b.totalBudget - actual >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtVND(b.totalBudget - actual)}</td><td style="min-width:160px">${progressBar(pct)}</td></tr>`;
  });
  return `${pageHead('Ngân sách vs Thực tế', 'Thực chi lấy trực tiếp từ Đề nghị mua hàng (PR) đã duyệt/chờ duyệt theo từng bộ phận', '')}
    ${accTabsBar('budget')}
    <div class="card">${tableShell([{ t: 'Bộ phận' }, { t: 'Ngân sách', cls: 'right' }, { t: 'Thực chi', cls: 'right' }, { t: 'Còn lại', cls: 'right' }, { t: '% sử dụng' }], rows, { emptyTitle: 'Chưa cấu hình ngân sách' })}</div>`;
}

/* ---- 2.10 P&L ---- */
function accPnlView() {
  const f = F(
    'acc-report-pnl',
    accDefaultReportFilter('acc-report-pnl')
  );

  const today = currentDateYMD();
  let from = f.from;
  let to = f.to;

  /* Nếu chọn tháng */
  if (f.period === 'month' && f.year && f.month) {
    from =
      `${f.year}-${String(f.month).padStart(2, '0')}-01`;

    const lastDay =
      new Date(
        Number(f.year),
        Number(f.month),
        0
      ).getDate();

    to =
      `${f.year}-${String(f.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  /* Quý */
  if (f.period === 'quarter' && f.year && f.quarter) {
    const q = Number(f.quarter);
    const startMonth = (q - 1) * 3 + 1;

    from =
      `${f.year}-${String(startMonth).padStart(2, '0')}-01`;

    const endMonth = startMonth + 2;

    const lastDay =
      new Date(
        Number(f.year),
        endMonth,
        0
      ).getDate();

    to =
      `${f.year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  /* Năm */
  if (f.period === 'year' && f.year) {
    from = `${f.year}-01-01`;
    to = `${f.year}-12-31`;
  }

  from = from || `${today.slice(0, 7)}-01`;
  to = to || today;

  const months = Object.keys(AccFin.revenueByMonth())
    .filter((m) => {
      const start = `${m}-01`;
      return start >= from.slice(0, 7) &&
             start <= to.slice(0, 7);
    });

  const revenueMap = AccFin.revenueByMonth();
  const cogsMap = AccFin.cogsByMonth();
  const opexMap = AccFin.opexByMonth();

  let revenue = 0;
  let cogs = 0;
  let opex = 0;

  months.forEach((m) => {
    revenue += revenueMap[m] || 0;
    cogs += cogsMap[m] || 0;
    opex += opexMap[m] || 0;
  });

  const grossProfit = revenue - cogs;
  const ebt = grossProfit - opex;

  const taxRate =
    Number(DB.accountingSettings.corporateTaxRatePct || 0);

  const tax =
    Math.max(
      0,
      Math.round(ebt * taxRate / 100)
    );

  const netProfit = ebt - tax;

  return `${pageHead(
    'Báo cáo Lãi lỗ (P&L)',
    `Kỳ báo cáo: ${fmtDate(from)} → ${fmtDate(to)}`,
    '<button class="btn" data-act="export-report" data-key="pnl"><i class="fa-solid fa-file-export"></i>Xuất báo cáo</button>'
  )}
  ${accTabsBar('pnl')}
  <div class="card" style="margin-bottom:14px">
    <div class="toolbar">
      <select class="inp" data-f="acc-report-pnl.period">
        <option value="month" ${f.period === 'month' ? 'selected' : ''}>Theo tháng</option>
        <option value="quarter" ${f.period === 'quarter' ? 'selected' : ''}>Theo quý</option>
        <option value="year" ${f.period === 'year' ? 'selected' : ''}>Theo năm</option>
        <option value="custom" ${f.period === 'custom' ? 'selected' : ''}>Tùy chọn ngày</option>
      </select>

      ${
        f.period !== 'custom'
          ? `<input class="inp" type="number" min="2020" max="2100" data-f="acc-report-pnl.year" value="${esc(f.year || new Date().getFullYear())}" style="width:110px">`
          : ''
      }

      ${
        f.period === 'month'
          ? `<select class="inp" data-f="acc-report-pnl.month">
              ${Array.from({ length: 12 }, (_, i) => {
                const v = String(i + 1).padStart(2, '0');
                return `<option value="${v}" ${f.month === v ? 'selected' : ''}>Tháng ${i + 1}</option>`;
              }).join('')}
            </select>`
          : ''
      }

      ${
        f.period === 'quarter'
          ? `<select class="inp" data-f="acc-report-pnl.quarter">
              ${[1, 2, 3, 4].map((q) =>
                `<option value="${q}" ${Number(f.quarter) === q ? 'selected' : ''}>Quý ${q}</option>`
              ).join('')}
            </select>`
          : ''
      }

      ${
        f.period === 'custom'
          ? `<input class="inp" type="date" data-f="acc-report-pnl.from" value="${esc(f.from || '')}">
            <input class="inp" type="date" data-f="acc-report-pnl.to" value="${esc(f.to || '')}">`
          : ''
      }

      <span class="spacer"></span>
      <span class="chip">
        ${accReportPeriodLabel(f.period, from, to)}
      </span>
    </div>
  </div>

  <div class="grid g-auto-sm" style="margin-bottom:14px">
    ${mkpi(
      'Doanh thu thuần',
      fmtVND(revenue),
      'fa-sack-dollar',
      'blue'
    )}

    ${mkpi(
      'Giá vốn',
      fmtVND(cogs),
      'fa-cubes',
      'orange'
    )}

    ${mkpi(
      'Lợi nhuận gộp',
      fmtVND(grossProfit),
      'fa-chart-line',
      'green'
    )}

    ${mkpi(
      'Chi phí hoạt động',
      fmtVND(opex),
      'fa-receipt',
      'red'
    )}

    ${mkpi(
      'Lợi nhuận sau thuế',
      fmtVND(netProfit),
      'fa-money-bill-trend-up',
      netProfit >= 0 ? 'green' : 'red'
    )}

  </div>

  <div class="card">
    <div class="card-body">

      ${tableShell(
        [
          { t: 'Chỉ tiêu' },
          { t: 'Kỳ báo cáo', cls: 'right' }
        ],

        [
          `<tr>
            <td>Doanh thu thuần</td>
            <td class="right num">${fmtVND(revenue)}</td>
          </tr>`,

          `<tr>
            <td>Giá vốn hàng bán</td>
            <td class="right num">${fmtVND(-cogs)}</td>
          </tr>`,

          `<tr style="font-weight:700;background:var(--surface-2)">
            <td>Lợi nhuận gộp</td>
            <td class="right num">${fmtVND(grossProfit)}</td>
          </tr>`,

          `<tr>
            <td>Chi phí hoạt động</td>
            <td class="right num">${fmtVND(-opex)}</td>
          </tr>`,

          `<tr style="font-weight:700">
            <td>Lợi nhuận trước thuế</td>
            <td class="right num">${fmtVND(ebt)}</td>
          </tr>`,

          `<tr>
            <td>Thuế TNDN ước tính (${taxRate}%)</td>
            <td class="right num">${fmtVND(-tax)}</td>
          </tr>`,

          `<tr style="font-weight:700;background:var(--surface-2)">
            <td>Lợi nhuận sau thuế</td>
            <td class="right num">${fmtVND(netProfit)}</td>
          </tr>`
        ]
      )}

    </div>
  </div>`;
}

/* ---- 2.11 Balance Sheet ---- */
function accBalanceSheetView() {
  const cash = AccFin.totalBankBalance();
  const ar = AccFin.totalAR();
  const inv = AccFin.inventoryBookValue();
  const assets = AccFin.totalAssetsNet();
  const totalAssets = cash + ar + inv + assets;
  const ap = AccFin.totalAP();
  const equity = totalAssets - ap; // cân đối kế toán: Vốn CSH = Tổng TS - Nợ phải trả
  return `${pageHead('Bảng cân đối kế toán (Balance Sheet)', `Số liệu tại ngày ${fmtDate(TODAY)}`, '')}
    ${accTabsBar('balance_sheet')}
    <div class="grid g-2">
      <div class="card">
        <div class="card-head"><h3>TÀI SẢN</h3></div>
        ${tableShell([{ t: '' }, { t: '', cls: 'right' }], [
          `<tr><td>Tiền &amp; tương đương tiền (ngân hàng)</td><td class="right num">${fmtVND(cash)}</td></tr>`,
          `<tr><td>Phải thu khách hàng</td><td class="right num">${fmtVND(ar)}</td></tr>`,
          `<tr><td>Hàng tồn kho (NVL + thành phẩm)</td><td class="right num">${fmtVND(inv)}</td></tr>`,
          `<tr><td>Tài sản cố định (giá trị còn lại)</td><td class="right num">${fmtVND(assets)}</td></tr>`,
          `<tr style="font-weight:700;background:var(--surface-2)"><td>TỔNG TÀI SẢN</td><td class="right num">${fmtVND(totalAssets)}</td></tr>`,
        ])}
      </div>
      <div class="card">
        <div class="card-head"><h3>NGUỒN VỐN</h3></div>
        ${tableShell([{ t: '' }, { t: '', cls: 'right' }], [
          `<tr><td>Phải trả nhà cung cấp</td><td class="right num">${fmtVND(ap)}</td></tr>`,
          `<tr style="font-weight:700"><td>TỔNG NỢ PHẢI TRẢ</td><td class="right num">${fmtVND(ap)}</td></tr>`,
          `<tr><td>Vốn chủ sở hữu (cân đối)</td><td class="right num">${fmtVND(equity)}</td></tr>`,
          `<tr style="font-weight:700;background:var(--surface-2)"><td>TỔNG NGUỒN VỐN</td><td class="right num">${fmtVND(ap + equity)}</td></tr>`,
        ])}
      </div>
    </div>
    <p class="cell-sub" style="margin-top:10px">Vốn chủ sở hữu được suy ra để cân đối (Tổng tài sản − Nợ phải trả) vì hệ thống demo chưa có sổ vốn góp/lợi nhuận giữ lại riêng.</p>`;
}

/* ---- 2.12 Cashflow statement ---- */
function accCashflowStatementView() {
  const f = F(
    'acc-report-cashflow',
    accDefaultReportFilter('acc-report-cashflow')
  );

  const from =
    f.from ||
    `${AccFin.currentMonth()}-01`;

  const to =
    f.to ||
    currentDateYMD();

  const groupBy =
    f.groupBy || 'month';

  let rows = accAllCashRows().filter((r) =>
    accDateInRange(r.date, from, to)
  );

  if (f.type) {
    rows = rows.filter((r) =>
      r.type === f.type
    );
  }

  const groups = {};

  rows.forEach((r) => {
    const key =
      accGroupKey(r.date, groupBy);

    if (!groups[key]) {
      groups[key] = {
        in: 0,
        out: 0
      };
    }

    if (r.type === 'THU') {
      groups[key].in += Number(r.amount || 0);
    } else {
      groups[key].out += Number(r.amount || 0);
    }
  });

  const keys =
    Object.keys(groups).sort();

  let running = 0;

  const totalIn = rows
    .filter((r) => r.type === 'THU')
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  const totalOut = rows
    .filter((r) => r.type === 'CHI')
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  const htmlRows = keys.map((key) => {
    const inn = groups[key].in;
    const out = groups[key].out;
    const net = inn - out;

    running += net;

    return `
      <tr>

        <td>
          ${esc(accGroupLabel(key, groupBy))}
        </td>

        <td class="right num"
          style="color:var(--green)">
          ${fmtVND(inn)}
        </td>

        <td class="right num"
          style="color:var(--red)">
          ${fmtVND(out)}
        </td>

        <td
          class="right num strong"
          style="color:${net >= 0
            ? 'var(--green)'
            : 'var(--red)'}"
        >
          ${net >= 0 ? '+' : ''}
          ${fmtVND(net)}
        </td>

        <td class="right num">
          ${fmtVND(running)}
        </td>

      </tr>
    `;
  });

  return `${pageHead(
    'Báo cáo lưu chuyển tiền tệ (Cashflow)',
    `Kỳ báo cáo: ${fmtDate(from)} → ${fmtDate(to)}`,
    '<button class="btn" data-act="export-report" data-key="cashflow"><i class="fa-solid fa-file-export"></i>Xuất báo cáo</button>'
  )}

  ${accTabsBar('cashflow')}

  <div class="card" style="margin-bottom:14px">

    <div class="toolbar">

      <select
        class="inp"
        data-f="acc-report-cashflow.groupBy"
      >
        <option value="month" ${groupBy === 'month' ? 'selected' : ''}>
          Gom theo tháng
        </option>

        <option value="quarter" ${groupBy === 'quarter' ? 'selected' : ''}>
          Gom theo quý
        </option>

        <option value="year" ${groupBy === 'year' ? 'selected' : ''}>
          Gom theo năm
        </option>
      </select>

      ${selectFilter(
        'acc-report-cashflow',
        'type',
        [
          ['THU', 'Thu'],
          ['CHI', 'Chi']
        ],
        'Tất cả Thu / Chi'
      )}

      <input
        class="inp"
        type="date"
        data-f="acc-report-cashflow.from"
        value="${esc(from)}"
      >

      <input
        class="inp"
        type="date"
        data-f="acc-report-cashflow.to"
        value="${esc(to)}"
      >

      <span class="spacer"></span>

      <span class="chip">
        ${rows.length} giao dịch
      </span>

    </div>

  </div>

  <div
    class="grid g-auto-sm"
    style="margin-bottom:14px"
  >

    ${mkpi(
      'Tổng thu',
      fmtVND(totalIn),
      'fa-arrow-down',
      'green'
    )}

    ${mkpi(
      'Tổng chi',
      fmtVND(totalOut),
      'fa-arrow-up',
      'red'
    )}

    ${mkpi(
      'Dòng tiền thuần',
      fmtVND(totalIn - totalOut),
      'fa-scale-balanced',
      totalIn >= totalOut ? 'blue' : 'orange'
    )}

    ${mkpi(
      'Tồn quỹ hiện tại',
      fmtVND(AccFin.totalBankBalance()),
      'fa-building-columns',
      'indigo'
    )}

  </div>

  <div class="card">

    ${tableShell(
      [
        { t: 'Kỳ' },
        { t: 'Thu', cls: 'right' },
        { t: 'Chi', cls: 'right' },
        { t: 'Dòng tiền thuần', cls: 'right' },
        { t: 'Lũy kế', cls: 'right' }
      ],
      htmlRows,
      {
        emptyTitle:
          'Không có dữ liệu dòng tiền trong kỳ'
      }
    )}

  </div>`;
}

/* ---- 2.13 Sổ nhật ký chung / Hạch toán ---- */
function accLedgerView() {
  const f = F('acc-ledger', {
    type: '',
    from: '',
    to: '',
    source: '',
    q: ''
  });

  let rows = accAllCashRows();

  /* Lọc Thu / Chi */
  if (f.type) {
    rows = rows.filter((r) => r.type === f.type);
  }

  /* Lọc khoảng ngày */
  if (f.from || f.to) {
    rows = rows.filter((r) =>
      accDateInRange(r.date, f.from, f.to)
    );
  }

  /* Lọc nguồn */
  if (f.source) {
    rows = rows.filter((r) => {
      const source = String(r.source || '').toLowerCase();
      return source.includes(String(f.source).toLowerCase());
    });
  }

  /* Tìm kiếm */
  if (f.q) {
    rows = rows.filter((r) =>
      accTextMatch(
        [
          r.id,
          r.ref,
          r.note,
          r.source,
          r.kind,
          r.date
        ],
        f.q
      )
    );
  }

  const totalIn = rows
    .filter((r) => r.type === 'THU')
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  const totalOut = rows
    .filter((r) => r.type === 'CHI')
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  const pg = paged(rows, 'acc-ledger', 20);

  const sourceOptions = [
    ['', 'Tất cả nguồn'],
    ['Tự động', 'Tự động'],
    ['Thủ công', 'Thủ công']
  ];

  return `${pageHead(
    'Sổ nhật ký chung',
    'Tổng hợp các nghiệp vụ thu – chi từ công nợ, mua hàng, bán hàng và giao dịch thủ công',
    '<button class="btn" data-act="export-report" data-key="general-ledger"><i class="fa-solid fa-file-export"></i>Xuất sổ</button>'
  )}

  <div class="grid g-auto-sm" style="margin-bottom:14px">
    ${mkpi(
      'Tổng thu',
      fmtVND(totalIn),
      'fa-arrow-down',
      'green'
    )}

    ${mkpi(
      'Tổng chi',
      fmtVND(totalOut),
      'fa-arrow-up',
      'red'
    )}

    ${mkpi('Dòng tiền thuần',fmtVND(totalIn - totalOut),'fa-scale-balanced',totalIn >= totalOut ? 'blue' : 'orange')}
    ${mkpi('Số nghiệp vụ',fmtN(rows.length),'fa-list-check','indigo')}
  </div>

  <div class="card">
    <div class="toolbar">
      ${selectFilter('acc-ledger','type',
        [
          ['THU', 'Thu'],
          ['CHI', 'Chi']
        ],
        'Tất cả Thu / Chi'
      )}

      <select class="inp" data-f="acc-ledger.source" style="min-width:150px">
        ${sourceOptions.map(([v, label]) =>
          `<option value="${esc(v)}" ${f.source === v ? 'selected' : ''}>
            ${esc(label)}
          </option>`
        ).join('')}
      </select>
	  <span class="muted" style="font-size:13px;white-space:nowrap">Từ ngày</span>
      <input class="inp" type="date" data-f="acc-ledger.from" value="${esc(f.from || '')}">
	  <span class="muted" style="font-size:13px;white-space:nowrap">Đến ngày</span>
      <input class="inp" type="date" data-f="acc-ledger.to" value="${esc(f.to || '')}">
      <input class="inp" type="search" data-f="acc-ledger.q" value="${esc(f.q || '')}" placeholder="Tìm mã, diễn giải, chứng từ..." style="min-width:230px">

      ${(f.type || f.source || f.from || f.to || f.q)
        ? `<button class="btn btn-sm" data-act="clear-filter" data-key="acc-ledger">
            <i class="fa-solid fa-filter-circle-xmark"></i>
            Xóa lọc
          </button>`
        : ''
      }

      <span class="spacer"></span>
      <span class="chip">
        ${rows.length} nghiệp vụ
      </span>
    </div>

    ${tableShell(
      [
        { t: 'Ngày' },
        { t: 'Loại' },
        { t: 'Diễn giải' },
        { t: 'Chứng từ' },
        { t: 'Nguồn' },
        { t: 'Số tiền', cls: 'right' }
      ],
      pg.items.map((r) => `
        <tr>
          <td class="num">
            ${fmtDate(r.date)}
          </td>
          <td>
            ${
              r.type === 'THU'
                ? '<span class="badge green">Thu</span>'
                : '<span class="badge red">Chi</span>'
            }
          </td>
          <td>
            ${cell2(esc(r.note),esc(r.kind || ''))}
          </td>
          <td>
            ${
              r.ref
                ? `<span class="code">${esc(r.ref)}</span>`
                : '<span class="muted">—</span>'
            }
          </td>
          <td class="muted">
            ${esc(r.source || '')}
          </td>
          <td class="right num strong"
            style="color:${r.type === 'THU'
              ? 'var(--green)'
              : 'var(--red)'}">
            ${r.type === 'THU' ? '+' : '−'}${fmtVND(r.amount)}
          </td>
        </tr>
      `),

      {
        emptyTitle: 'Không có nghiệp vụ phù hợp với bộ lọc'
      }
    )}

    ${pagiHTML(
      'acc-ledger',
      pg,
      'nghiệp vụ'
    )}

  </div>`;
}

/* ---- 2.14 Hub báo cáo ---- */
function accReportsHubView() {
  const cards = [
    ['pnl', 'fa-chart-line', 't-blue', 'Báo cáo Lãi lỗ (P&L)', 'Doanh thu, giá vốn, chi phí và lợi nhuận theo tháng'],
    ['balance_sheet', 'fa-scale-balanced', 't-indigo', 'Bảng cân đối kế toán', 'Tài sản, nợ phải trả và vốn chủ sở hữu tại một thời điểm'],
    ['cashflow', 'fa-money-bill-trend-up', 't-green', 'Lưu chuyển tiền tệ', 'Dòng tiền vào/ra và tồn quỹ lũy kế theo tháng'],
    ['budget', 'fa-bullseye', 't-orange', 'Ngân sách vs Thực tế', 'So sánh ngân sách được cấp với thực chi mua hàng'],
  ];
  return `${pageHead('Báo cáo tài chính', 'Chọn báo cáo quản trị đa chiều cần xem', '')}
    ${accTabsBar('reports_hub')}
    <div class="grid g-3">${cards.map(([tab, icon, tone, title, sub]) => `<div class="report-card" data-act="nav" data-id="accounting" data-tab="${tab}"><span class="rc-ico ${tone}"><i class="fa-solid ${icon}"></i></span><b>${esc(title)}</b><span>${esc(sub)}</span></div>`).join('')}</div>`;
}

/* --------------------------------------------------------------- 3. ROUTER */
Views.accounting = function () {
  const tab = State.tab || 'dashboard';
  switch (tab) {
    case 'dashboard': return accDashboardView();
    case 'cashflow_inout': return accCashflowInOutView();
    case 'banking': return accBankingView();
    case 'ar': return accArView();
    case 'ap': return accApView();
    case 'costing': return accCostingView();
    case 'fixed_assets': return accFixedAssetsView();
    case 'tax': return accTaxView();
    case 'budget': return accBudgetView();
    case 'pnl': return accPnlView();
    case 'balance_sheet': return accBalanceSheetView();
    case 'cashflow': return accCashflowStatementView();
    case 'general_ledger': return accLedgerView();
    case 'reports': case 'reports_hub': return accReportsHubView();
    default: return accDashboardView();
  }
};
Views.accounting.after = function () { if ((State.tab || 'dashboard') === 'dashboard') accDashboardView.after(); };

/* --------------------------------------------------------------- 4. ACTIONS
 * Gắn thêm vào Actions toàn cục (đã được app.js khởi tạo trước khi file này
 * chạy — xem hướng dẫn nạp script cuối file). */
Object.assign(Actions, {
  'acc-cash-add': (d) => openCashTxForm(d.type),
  'acc-cash-save': (d) => {
    const date = $('#ctxDate')?.value || currentDateYMD();
    const amount = parseMoney($('#ctxAmount')?.value) || 0;
    if (amount <= 0) { Toast.err('Số tiền không hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0.'); return; }
    const category = $('#ctxCategory')?.value || '';
    const note = $('#ctxNote')?.value.trim() || category;
    DB.cashTransactions.unshift({ id: nextCode('SQ-2026-', DB.cashTransactions), type: d.type, date, amount, category, note, createdBy: DB.currentUser?.id || '' });
    Modal.close(); render();
    Toast.ok('Đã ghi nhận', `${d.type === 'THU' ? 'Thu' : 'Chi'} ${fmtVND(amount)} · ${note}`);
  },
  'acc-cash-delete': (d) => {
    DB.cashTransactions = DB.cashTransactions.filter((t) => t.id !== d.id);
    render(); Toast.ok('Đã xóa giao dịch');
  },

  'acc-bank-add': async () => {
    try { if (typeof RestaurantQualityAPI !== 'undefined') await RestaurantQualityAPI.ensureFresh(['stores','bankAccounts'], {force:false}); } catch(err) {}
    openBankAccountForm();
  },
  'acc-bank-save': async () => {
    const name = $('#bkName')?.value.trim() || '';
    const bankName = $('#bkBankName')?.value.trim() || '';
    const accountNumber = $('#bkNumber')?.value.trim() || '';
    const accountName = $('#bkAccountName')?.value.trim() || '';
    const scopeType = $('#bkScope')?.value || 'COMPANY';
    const storeId = scopeType === 'STORE' ? ($('#bkStore')?.value || '') : '';
    if (!name || !bankName || !accountNumber) { Toast.err('Thiếu thông tin tài khoản', 'Tên gợi nhớ, ngân hàng và số tài khoản là bắt buộc.'); return; }
    if (scopeType === 'STORE' && !storeId) { Toast.err('Chưa chọn chi nhánh / cửa hàng', 'Tài khoản theo chi nhánh phải được gắn với một cửa hàng cụ thể.'); return; }
    const before = JSON.parse(JSON.stringify(DB.bankAccounts || []));
    const isDefault = !!$('#bkDefault')?.checked;
    if (isDefault) {
      for (const x of DB.bankAccounts || []) {
        if (x.scopeType === scopeType && (scopeType === 'COMPANY' || String(x.storeId) === String(storeId))) x.isDefault = false;
      }
    }
    const row = { id: nextCode('BANK-', DB.bankAccounts, 2), name, bankName, accountNumber, accountName, openingBalance: parseMoney($('#bkOpening')?.value) || 0, scopeType, storeId, active: $('#bkActive')?.value !== '0', isDefault, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    DB.bankAccounts.push(row);
    try {
      if (typeof RestaurantQualityAPI !== 'undefined') await RestaurantQualityAPI.syncRestaurant(['bankAccounts']);
      Modal.close(); render(); Toast.ok('Đã thêm tài khoản ngân hàng', `${name} · ${scopeType === 'STORE' ? ((DB.stores||[]).find(s=>String(s.id)===String(storeId))?.name||storeId) : 'Công ty'}`);
    } catch (err) {
      DB.bankAccounts = before;
      Toast.err('Không lưu được lên server', err?.message || 'Vui lòng thử lại.');
    }
  },
  'acc-bank-tx-add': (d) => openBankTxForm(d.id),
  'acc-bank-tx-save': (d) => {
    const amount = parseMoney($('#bkTxAmount')?.value) || 0;
    if (amount <= 0) { Toast.err('Số tiền không hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0.'); return; }
    DB.bankTransactions.unshift({ id: nextCode('BTX-2026-', DB.bankTransactions), bankId: d.id, type: $('#bkTxType')?.value || 'IN', date: $('#bkTxDate')?.value || currentDateYMD(), amount, note: $('#bkTxNote')?.value.trim() || '' });
    Modal.close(); render(); Toast.ok('Đã ghi nhận giao dịch ngân hàng');
  },

  'acc-ar-collect': (d) => { const o=AccFin.recognizedOrders().find(x=>x.customerId===d.id && (typeof SalesCRM==='undefined'||SalesCRM.receivableOfOrder(x)>0)); if(o) openCustomerPaymentModal(o.id); },
  'acc-ar-collect-save': () => { Toast.warn('Đã chuyển chức năng','Vui lòng thu tiền trực tiếp theo từng đơn tại Công nợ phải thu.'); },

  'acc-asset-add': () => openFixedAssetForm(),
  'acc-asset-edit': (d) => openFixedAssetForm(d.id),
  'acc-asset-save': (d) => {
    const name = $('#faName')?.value.trim();
    const cost = parseMoney($('#faCost')?.value) || 0;
    if (!name || cost <= 0) { Toast.err('Thiếu thông tin', 'Vui lòng nhập tên tài sản và nguyên giá lớn hơn 0.'); return; }
    const payload = { name, dept: $('#faDept')?.value || '', purchaseDate: $('#faDate')?.value || currentDateYMD(), cost, usefulYears: Number($('#faYears')?.value) || 8 };
    if (d.id) {
      Object.assign(DB.fixedAssets.find((a) => a.id === d.id), payload);
    } else {
      DB.fixedAssets.push({ id: nextCode('TS-', DB.fixedAssets), status: 'active', ...payload });
    }
    Modal.close(); render(); Toast.ok(d.id ? 'Đã cập nhật tài sản' : 'Đã thêm tài sản', name);
  },
  'acc-asset-delete': (d) => {
    const a = DB.fixedAssets.find((x) => x.id === d.id); if (!a) return;
    confirmBox({ title: 'Xóa tài sản cố định', icon: 'fa-trash', okText: 'Xóa', message: `Xóa tài sản <b>${esc(a.name)}</b>?`, onOk: () => { DB.fixedAssets = DB.fixedAssets.filter((x) => x.id !== d.id); render(); Toast.ok('Đã xóa tài sản', a.name); } });
  },
});

/* ============================================================================
 * LƯU Ý TÍCH HỢP
 * ----------------------------------------------------------------------------
 *    Trong index.html, thêm MỘT dòng script NGAY SAU app.js (bắt buộc sau,
 *    vì file này dùng Actions/Views/DB/Q/AccFin đã được app.js khởi tạo):
 *
 *      <script src="js/app.js?v=20260914-restaurant1"></script>
 *      <script src="js/modules/mod-accounting.js?v=1"></script>
 * ==========================================================================*/