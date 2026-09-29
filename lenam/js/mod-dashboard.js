/* ============================================================================
 * MODULE: DASHBOARD — Tổng quan doanh nghiệp
 * ==========================================================================*/

/** Số liệu KPI theo kỳ báo cáo (kế toán chốt sẵn cho từng kỳ) */
const PERIODS = {
  today:   { label: 'Hôm nay',    revenue: 186000000,  rc: 4.2,  orders: 4,   oc: 0,    po: 2,  pc: 0,    inv: 2350000000, ic: -0.4, recv: 1280000000, rcc: 0.6,
             trend: [{ month: '08:00', value: 22000000 }, { month: '10:00', value: 48000000 }, { month: '12:00', value: 65000000 }, { month: '14:00', value: 112000000 }, { month: '16:00', value: 158000000 }, { month: '18:00', value: 186000000 }] },
  w7:      { label: '7 ngày qua', revenue: 1120000000, rc: 9.1,  orders: 11,  oc: 5.2,  po: 8,  pc: 3.4,  inv: 2350000000, ic: -1.2, recv: 1280000000, rcc: 2.1,
             trend: [{ month: '09/08', value: 142000000 }, { month: '10/08', value: 168000000 }, { month: '11/08', value: 196000000 }, { month: '12/08', value: 152000000 }, { month: '13/08', value: 178000000 }, { month: '14/08', value: 198000000 }, { month: '15/08', value: 186000000 }] },
  month:   { label: 'Tháng này',  revenue: 4860000000, rc: 12.5, orders: 128, oc: 8.4,  po: 47, pc: 6.2,  inv: 2350000000, ic: -3.1, recv: 1280000000, rcc: 4.5, trend: null },
  quarter: { label: 'Quý này',    revenue: 13760000000, rc: 15.8, orders: 342, oc: 11.6, po: 126, pc: 9.8, inv: 2350000000, ic: -5.4, recv: 1280000000, rcc: 6.2,
             trend: [{ month: 'T6/2026', value: 4300000000 }, { month: 'T7/2026', value: 4600000000 }, { month: 'T8/2026', value: 4860000000 }] },
};

/** Thẻ KPI lớn của dashboard */
function kpiCard({ label, value, unit, icon, tone, delta, note, spark, act, data = '' }) {
  const dir = delta == null ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return `<div class="kpi" ${act ? `data-act="${act}" ${data}` : ''}>
      ${spark ? Charts.sparkline(spark, tone) : ''}
      <div class="kpi-top">
        <span class="kpi-ico t-${tone}"><i class="fa-solid ${icon}"></i></span>
        <div style="min-width:0">
          <div class="kpi-label">${esc(label)}</div>
          <div class="kpi-value">${value}${unit ? `<span class="kpi-unit">${esc(unit)}</span>` : ''}</div>
        </div>
      </div>
      <div class="kpi-foot">
        ${dir ? `<span class="kpi-delta ${dir}"><i class="fa-solid fa-arrow-${dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'right'}"></i>${Math.abs(delta).toFixed(1).replace('.', ',')}%</span>` : ''}
        <span class="kpi-note">${note}</span>
      </div>
    </div>`;
}

Views.dashboard = function () {
  const f = F('dashboard', { period: 'month' });
  const P = PERIODS[f.period] || PERIODS.month;
  const trend = P.trend || DB.revenueTrend;

  /* --- Thống kê trạng thái đơn hàng cho biểu đồ tròn --- */
  const orderStatuses = ['dh_cho_xu_ly', 'dh_cho_san_xuat', 'dh_dang_san_xuat', 'dh_hoan_thanh', 'dh_da_giao', 'dh_da_huy'];
  const orderCounts = orderStatuses.map((s) => DB.orders.filter((o) => o.status === s).length);

  /* --- Cảnh báo cần xử lý (tính từ dữ liệu thật) --- */
  const low = Q.lowStock();
  const late = Q.lateProduction();
  const pendingPR = DB.purchases.filter((p) => p.status === 'mh_cho_duyet');
  const expiring = Q.expiringContracts(45);
  const alerts = [
    low.length ? { tone: 'red', icon: 'fa-triangle-exclamation', title: `Vật tư ${low[0].name} ${low[0].stock <= 0 ? 'đã hết hàng' : 'sắp hết'}`, sub: `${low.length} vật tư đang dưới định mức tồn tối thiểu`, act: 'go', data: 'data-id="materials" data-filter="low"' } : null,
    late.length ? { tone: 'orange', icon: 'fa-clock', title: `${late.length} lệnh sản xuất sắp/đã trễ tiến độ`, sub: `Gần nhất: ${late[0].id} — deadline ${fmtDate(late[0].deadline)}`, act: 'go', data: 'data-id="production" data-filter="late"' } : null,
    pendingPR.length ? { tone: 'orange', icon: 'fa-cart-shopping', title: `${pendingPR.length} yêu cầu mua hàng đang chờ duyệt`, sub: `Tổng giá trị ${fmtVND(pendingPR.reduce((s, p) => s + p.total, 0))}`, act: 'go', data: 'data-id="purchases" data-filter="pending"' } : null,
    expiring.length ? { tone: 'blue', icon: 'fa-file-contract', title: `${expiring.length} hợp đồng sắp hết hạn`, sub: `Sớm nhất: ${expiring[0].id} — hết hạn ${fmtDate(expiring[0].expireDate)}`, act: 'go', data: 'data-id="contracts" data-filter="expiring"' } : null,
  ].filter(Boolean);

  /* --- Đơn hàng gần đây --- */
  const recent = [...DB.orders].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const recentRows = recent.map((o) => `
    <tr class="clickable" data-act="open-order" data-id="${o.id}">
      <td><span class="code">${o.id}</span></td>
      <td>${cell2(esc(Q.customerName(o.customerId)), esc(Q.customer(o.customerId)?.province || ''))}</td>
      <td class="hide-sm">${cell2(esc(o.items[0].name), o.items.length > 1 ? `+ ${o.items.length - 1} sản phẩm khác` : esc(o.items[0].qty + ' ' + o.items[0].unit))}</td>
      <td class="hide-sm num">${fmtDate(o.date)}</td>
      <td class="right strong num">${fmtVND(o.total)}</td>
      <td>${badge(o.status)}</td>
    </tr>`);

  const nvlValue = Q.inventoryValue();

  return `
  ${pageHead('Tổng quan doanh nghiệp', 'Theo dõi hoạt động kinh doanh và sản xuất', `
    <select class="inp" data-f="dashboard.period" style="min-width:150px">
      ${Object.entries(PERIODS).map(([k, v]) => `<option value="${k}" ${f.period === k ? 'selected' : ''}>${v.label}</option>`).join('')}
    </select>
    <button class="btn" data-act="export-dashboard"><i class="fa-solid fa-file-arrow-down"></i>Xuất báo cáo</button>
    <button class="btn btn-primary" data-act="open-guide"><i class="fa-solid fa-route"></i>Kịch bản demo</button>
  `)}

  <!-- ============ 6 THẺ KPI ============ -->
  <div class="grid g-auto" style="margin-bottom:14px">
    ${kpiCard({ label: 'Doanh thu ' + P.label.toLowerCase(), value: fmtShort(P.revenue), icon: 'fa-sack-dollar', tone: 'green', delta: P.rc, note: 'so với kỳ trước', spark: trend.map((t) => t.value), act: 'go', data: 'data-id="rp-revenue"' })}
    ${kpiCard({ label: 'Đơn hàng', value: fmtN(P.orders), unit: 'đơn', icon: 'fa-cart-flatbed', tone: 'blue', delta: P.oc, note: 'lũy kế kỳ báo cáo', spark: [88, 96, 104, 112, 120, P.orders], act: 'go', data: 'data-id="orders"' })}
    ${kpiCard({ label: 'Lệnh sản xuất', value: fmtN(P.po), unit: 'lệnh', icon: 'fa-industry', tone: 'indigo', delta: P.pc, note: 'đã phát hành', spark: [31, 34, 38, 41, 44, P.po], act: 'go', data: 'data-id="production"' })}
    ${kpiCard({ label: 'Đang sản xuất', value: fmtN(DB.kpi.inProduction), unit: 'lệnh', icon: 'fa-gears', tone: 'orange', note: `${DB.productionOrders.filter((p) => p.status === 'lsx_dang_qc').length} lệnh đang chờ QC`, spark: [18, 21, 19, 24, 22, 23], act: 'go', data: 'data-id="progress"' })}
    ${kpiCard({ label: 'Giá trị tồn kho', value: fmtShort(P.inv), icon: 'fa-warehouse', tone: 'teal', delta: P.ic, note: `NVL ${fmtShort(nvlValue)} + BTP/TP ${fmtShort(P.inv - nvlValue)}`, spark: [2.62, 2.55, 2.48, 2.44, 2.39, 2.35], act: 'go', data: 'data-id="inventory"' })}
    ${kpiCard({ label: 'Công nợ phải thu', value: fmtShort(P.recv), icon: 'fa-file-invoice', tone: 'red', delta: P.rcc, note: `${DB.customers.filter((c) => c.debt > 0).length} khách hàng còn dư nợ`, spark: [1.05, 1.12, 1.18, 1.15, 1.22, 1.28], act: 'go', data: 'data-id="rp-revenue"' })}
  </div>

  <!-- ============ BIỂU ĐỒ ============ -->
  <div class="grid g-31" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head">
        <div><h3>Doanh thu theo thời gian</h3><p>Giá trị đơn hàng đã xuất hóa đơn — ${esc(P.label)}</p></div>
        <div class="right">
          <span class="chip"><i class="fa-solid fa-arrow-trend-up" style="color:var(--green)"></i> Tăng trưởng ${P.rc.toFixed(1).replace('.', ',')}%</span>
        </div>
      </div>
      <div class="card-body"><div class="chart-box"><canvas id="chRevenue"></canvas></div></div>
    </div>

    <div class="card">
      <div class="card-head"><div><h3>Trạng thái đơn hàng</h3><p>Tổng ${DB.orders.length} đơn đang theo dõi</p></div></div>
      <div class="card-body">
        <div class="chart-box sm"><canvas id="chOrderStatus"></canvas></div>
        <div class="legend">
          ${orderStatuses.map((s, i) => `<span class="legend-item">
            <span class="legend-dot" style="background:var(--${statusTone(s)})"></span>${esc(statusLabel(s))} · <b>${orderCounts[i]}</b></span>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <div class="grid g-31" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head">
        <div><h3>Sản lượng theo phân xưởng</h3><p>Giờ máy thực hiện so với năng lực tháng 08/2026</p></div>
        <div class="right"><button class="btn btn-sm" data-act="go" data-id="rp-product"><i class="fa-solid fa-chart-column"></i>Báo cáo chi tiết</button></div>
      </div>
      <div class="card-body"><div class="chart-box"><canvas id="chWorkshop"></canvas></div></div>
    </div>

    <div class="card">
      <div class="card-head"><div><h3>Cảnh báo cần xử lý</h3><p>${alerts.length} vấn đề đang chờ</p></div></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:9px">
        ${alerts.length ? alerts.map((a) => `
          <div class="alert-item" data-act="${a.act}" ${a.data}>
            <span class="alert-ico t-${a.tone}"><i class="fa-solid ${a.icon}"></i></span>
            <span style="min-width:0">
              <span class="alert-title">${esc(a.title)}</span>
              <div class="alert-sub">${esc(a.sub)}</div>
            </span>
            <i class="fa-solid fa-chevron-right"></i>
          </div>`).join('') : `<div class="empty"><div class="empty-ico t-green"><i class="fa-solid fa-check"></i></div><h4>Không có cảnh báo</h4><p>Mọi chỉ số đang trong ngưỡng an toàn.</p></div>`}
      </div>
    </div>
  </div>

  <!-- ============ ĐƠN HÀNG GẦN ĐÂY + HOẠT ĐỘNG ============ -->
  <div class="grid g-31">
    <div class="card">
      <div class="card-head">
        <div><h3>Đơn hàng gần đây</h3><p>6 đơn hàng mới nhất</p></div>
        <div class="right"><button class="btn btn-sm" data-act="go" data-id="orders">Xem tất cả <i class="fa-solid fa-arrow-right"></i></button></div>
      </div>
      ${tableShell(
        [{ t: 'Mã đơn hàng' }, { t: 'Khách hàng' }, { t: 'Sản phẩm', cls: 'hide-sm' }, { t: 'Ngày đặt', cls: 'hide-sm' }, { t: 'Giá trị', cls: 'right' }, { t: 'Trạng thái' }],
        recentRows)}
    </div>

    <div class="card">
      <div class="card-head"><div><h3>Hoạt động gần đây</h3><p>Nhật ký thao tác trên hệ thống</p></div></div>
      <div class="card-body">
        <div class="tline">
          ${DB.activities.map((a) => `
            <div class="tline-item done">
              <span class="tline-dot t-${a.tone}" style="background:var(--surface);border-color:var(--${a.tone})"><i class="fa-solid ${a.icon}" style="color:var(--${a.tone})"></i></span>
              <div class="tline-title">${esc(a.user)} <span style="font-weight:400;color:var(--text-2)">${esc(a.action)}</span> <span style="color:var(--primary)">${esc(a.target)}</span></div>
              <div class="tline-sub">${esc(a.extra)} · ${esc(a.time)}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
};

/** Vẽ biểu đồ sau khi dashboard đã có trong DOM */
Views.dashboard.after = function () {
  const f = F('dashboard', { period: 'month' });
  const P = PERIODS[f.period] || PERIODS.month;
  const trend = P.trend || DB.revenueTrend;
  Charts.line('chRevenue', trend.map((t) => t.month), trend.map((t) => t.value), { label: 'Doanh thu' });

  const orderStatuses = ['dh_cho_xu_ly', 'dh_cho_san_xuat', 'dh_dang_san_xuat', 'dh_hoan_thanh', 'dh_da_giao', 'dh_da_huy'];
  Charts.donut('chOrderStatus',
    orderStatuses.map(statusLabel),
    orderStatuses.map((s) => DB.orders.filter((o) => o.status === s).length),
    orderStatuses.map(statusTone));

  Charts.bar('chWorkshop', DB.workshops.map((w) => w.name), [
    { label: 'Giờ máy thực hiện', data: DB.workshops.map((w) => w.output), color: 'blue' },
    { label: 'Năng lực tối đa', data: DB.workshops.map((w) => w.capacity - w.output), colorFn: (p) => (p.dark ? 'rgba(255,255,255,.08)' : '#e9eef6') },
  ], { stacked: true });
};
