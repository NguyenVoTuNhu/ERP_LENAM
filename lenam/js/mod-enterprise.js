/* ============================================================================
 * MODULE: CÁC PHÂN HỆ DOANH NGHIỆP LÊ NAM
 * Bảng điều hành nhẹ cho các phân hệ chưa có backend riêng trong bản SPA demo.
 * ==========================================================================*/

const ENTERPRISE_MODULES = {
  subcontracting: {
    title: 'Quản lý gia công',
    sub: 'Theo dõi nguyên liệu gửi đối tác, tiến độ, hao hụt, lỗi và công nợ gia công',
    icon: 'fa-industry',
    columns: ['Mã lệnh', 'Đối tác', 'Sản phẩm', 'SL giao', 'Tiến độ', 'Tỷ lệ lỗi', 'Trạng thái'],
    rows: [
      ['GC-2026-001', 'Cơ sở Đậu Hủ Tân Phúc', 'Đậu hủ cứng đóng khuôn', '500 Kg', '80%', '1,2%', 'Đang thực hiện'],
      ['GC-2026-002', 'Xưởng Đóng Gói An Bình', 'Đậu hủ chiên giòn', '2.000 Gói', '100%', '0,5%', 'Chờ QC'],
    ],
  },
  restaurant: {
    title: 'Nhà hàng & POS',
    sub: 'Theo dõi doanh thu cửa hàng, ca bán hàng, định lượng món và chi phí nguyên liệu',
    icon: 'fa-utensils',
    columns: ['Cửa hàng', 'Doanh thu hôm nay', 'Đơn hàng', 'Food Cost', 'Ca hiện tại', 'Trạng thái'],
    rows: [
      ['Cửa hàng Lê Văn Việt', '18.450.000đ', '126', '32,4%', 'Ca sáng', 'Đang bán'],
      ['Quầy Bún Đậu Thủ Đức', '12.680.000đ', '94', '30,8%', 'Ca trưa', 'Đang bán'],
    ],
  },
  accounting: {
    title: 'Kế toán & tài chính',
    sub: 'Tổng hợp doanh thu, công nợ, dòng tiền và giá vốn liên thông từ bán hàng, mua hàng và kho',
    icon: 'fa-file-invoice-dollar',
    columns: ['Chỉ tiêu', 'Tháng này', 'Tháng trước', 'Biến động', 'Nguồn dữ liệu'],
    rows: [
      ['Doanh thu thuần', '486.000.000đ', '455.000.000đ', '+6,8%', 'Đơn hàng'],
      ['Giá vốn hàng bán', '298.000.000đ', '281.000.000đ', '+6,0%', 'Kho & sản xuất'],
      ['Công nợ phải thu', '128.000.000đ', '121.000.000đ', '+5,8%', 'Bán hàng'],
      ['Công nợ phải trả', '76.500.000đ', '82.000.000đ', '-6,7%', 'Mua hàng'],
    ],
  },
  quality: {
    title: 'QC / QA & truy xuất nguồn gốc',
    sub: 'Kiểm tra nguyên liệu, bán thành phẩm, thành phẩm và truy xuất từ lô đến nhà cung cấp',
    icon: 'fa-clipboard-check',
    columns: ['Mã kiểm tra', 'Đối tượng', 'Lô', 'Kết quả', 'Người kiểm', 'Trạng thái'],
    rows: [
      ['QC-2026-018', 'Đậu hủ non', 'LOT-DHN-260827', 'Đạt', 'Ngô Thị Lan', 'PASSED'],
      ['QC-2026-017', 'Đậu nành nguyên hạt', 'LOT-DN-260810', 'Đạt', 'Trịnh Văn Kiểm', 'PASSED'],
      ['QC-2026-016', 'Đậu hủ cứng', 'LOT-DHC-260826', 'Chờ kiểm', 'Trịnh Văn Kiểm', 'QC_PENDING'],
    ],
  },
  maintenance: {
    title: 'Bảo trì thiết bị',
    sub: 'Lịch bảo trì máy xay, nồi nấu, máy ép, máy đóng gói và kho lạnh',
    icon: 'fa-screwdriver-wrench',
    columns: ['Thiết bị', 'Khu vực', 'Bảo trì gần nhất', 'Lần kế tiếp', 'Downtime', 'Trạng thái'],
    rows: [
      ['Máy xay XD-200', 'Khu Xay', '2026-08-01', '2026-09-01', '2,5 giờ', 'Đúng hạn'],
      ['Kho lạnh KL-01', 'Kho thành phẩm', '2026-07-28', '2026-08-28', '0 giờ', 'Đến hạn'],
    ],
  },
  logistics: {
    title: 'Logistics & đội xe',
    sub: 'Điều phối giao đậu hủ, theo dõi tài xế, chi phí/km và tỷ lệ giao đúng hạn',
    icon: 'fa-truck-fast',
    columns: ['Mã chuyến', 'Tuyến giao', 'Xe', 'Tài xế', 'Giờ dự kiến', 'Trạng thái'],
    rows: [
      ['GH-2026-084', 'Kho lạnh → Quận 9', '51C-123.45', 'Đinh Thị Hương', '09:30', 'Đang giao'],
      ['GH-2026-085', 'Kho lạnh → Bình Dương', '51C-678.90', 'Nguyễn Văn Bình', '13:00', 'Đã lập kế hoạch'],
    ],
  },
  rnd: {
    title: 'R&D công thức sản phẩm',
    sub: 'Quản lý thử nghiệm, phiên bản công thức, chi phí và quy trình duyệt sản phẩm mới',
    icon: 'fa-flask',
    columns: ['Mã dự án', 'Sản phẩm thử nghiệm', 'Phiên bản', 'Chi phí thử', 'Người phụ trách', 'Trạng thái'],
    rows: [
      ['RND-2026-004', 'Đậu hủ rong biển', 'v0.3', '8.500.000đ', 'Ngô Thị Lan', 'Đang thử nghiệm'],
      ['RND-2026-003', 'Đậu hủ protein cao', 'v1.0', '12.200.000đ', 'Phạm Quốc Bảo', 'Chờ duyệt'],
    ],
  },
  approvals: {
    title: 'Phê duyệt nghiệp vụ',
    sub: 'Tập trung các yêu cầu mua, thanh toán, xuất kho đặc biệt, hủy hàng và điều chỉnh sản xuất',
    icon: 'fa-signature',
    columns: ['Mã yêu cầu', 'Loại', 'Người đề nghị', 'Số tiền / SL', 'Hạn duyệt', 'Trạng thái'],
    rows: [
      ['YCM-2026-0044', 'Đề nghị mua nguyên liệu', 'Võ Thị Kim Ngân', '12.400.000đ', '2026-08-28', 'Chờ duyệt'],
      ['PX-2026-0320', 'Xuất kho đặc biệt', 'Cao Văn Thắng', '120 Kg', '2026-08-28', 'Chờ quản lý'],
    ],
  },
};

function enterpriseView(key) {
  const module = ENTERPRISE_MODULES[key];
  const rowHtml = module.rows.map((row) => `<tr>${row.map((cell, index) => `<td class="${index === row.length - 1 ? '' : 'num'}">${esc(cell)}</td>`).join('')}</tr>`);
  return `${pageHead(module.title, module.sub, `<button class="btn" data-act="export-enterprise" data-key="${key}"><i class="fa-solid fa-file-export"></i>Xuất báo cáo</button><button class="btn btn-primary" data-act="enterprise-action" data-key="${key}"><i class="fa-solid fa-plus"></i>Tạo mới</button>`)}
    <div class="grid g-auto-sm" style="margin-bottom:14px">
      ${mkpi('Bản ghi đang theo dõi', module.rows.length, module.icon, 'blue')}
      ${mkpi('Cập nhật hôm nay', module.rows.length, 'fa-clock', 'teal')}
      ${mkpi('Cần xử lý', module.rows.filter((row) => /Chờ|Đến hạn|Đang/.test(row[row.length - 1])).length, 'fa-triangle-exclamation', 'orange')}
    </div>
    <div class="card"><div class="card-head"><div><h3>${esc(module.title)}</h3><p>${esc(module.sub)}</p></div></div>${tableShell(module.columns.map((t) => ({ t })), rowHtml, { emptyTitle: 'Chưa có dữ liệu phân hệ' })}</div>`;
}

// Object.keys(ENTERPRISE_MODULES).forEach((key) => { Views[key] = () => enterpriseView(key); });

Views.restaurant = function () {
  const todayOrders = DB.posOrders.filter((order) => order.date === DB.today);
  const revenue = todayOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity * item.price, 0), 0);
  const rows = todayOrders.map((order) => `<tr><td><span class="code">${esc(order.id)}</span></td><td>${esc(DB.stores.find((store) => store.id === order.storeId)?.name || order.storeId)}</td><td>${esc(Q.employeeName(order.employeeId))}</td><td>${esc(order.shift)}</td><td class="right num">${fmtVND(order.items.reduce((sum, item) => sum + item.quantity * item.price, 0))}</td><td>${badge(order.status)}</td></tr>`);
  return `${pageHead('Nhà hàng & Cửa hàng', 'POS bán hàng, công thức món, ca bán hàng và tự động trừ nguyên liệu tại kho cửa hàng', `<button class="btn" data-act="restaurant-recipes"><i class="fa-solid fa-book-open"></i>Công thức món</button><button class="btn btn-primary" data-act="restaurant-pos-open"><i class="fa-solid fa-cash-register"></i>Bán tại quầy</button>`)}
    ${moduleTabs([{ id: 'overview', label: 'Tổng quan', route: 'restaurant' }, { id: 'pos', label: 'POS bán hàng', route: 'restaurant', tab: 'pos' }, { id: 'recipes', label: 'Công thức món', route: 'restaurant', tab: 'recipes' }, { id: 'store-stock', label: 'Kho cửa hàng', route: 'inv-overview' }, { id: 'revenue', label: 'Doanh thu theo ca', route: 'restaurant', tab: 'revenue' }], 'overview')}
    <div class="grid g-auto-sm" style="margin-bottom:14px">${mkpi('Doanh thu hôm nay', fmtVND(revenue), 'fa-sack-dollar', 'green')}${mkpi('Hóa đơn hôm nay', todayOrders.length, 'fa-receipt', 'blue')}${mkpi('Cửa hàng', DB.stores.length, 'fa-store', 'teal')}${mkpi('Món đang bán', DB.restaurantRecipes.filter((recipe) => recipe.active).length, 'fa-utensils', 'orange')}</div>
    <div class="card"><div class="card-head"><div><h3>Bán hàng theo ca</h3><p>Mỗi hóa đơn gắn với cửa hàng, nhân viên, ca bán và công thức món.</p></div></div>${tableShell([{ t: 'Hóa đơn' }, { t: 'Cửa hàng' }, { t: 'Nhân viên' }, { t: 'Ca' }, { t: 'Doanh thu', cls: 'right' }, { t: 'Trạng thái' }], rows, { emptyTitle: 'Chưa có hóa đơn hôm nay' })}</div>`;
};

function openRestaurantPos() {
  Modal.open({
    title: 'POS bán hàng tại quầy', sub: 'Chọn món và số lượng; hệ thống tự lấy công thức để tính nguyên liệu tiêu thụ', size: 'md',
    body: `<div class="form-grid"><div class="field"><label>Cửa hàng</label><select class="inp" id="posStore">${DB.stores.map((store) => `<option value="${store.id}">${esc(store.name)}</option>`).join('')}</select></div><div class="field"><label>Ca bán hàng</label><select class="inp" id="posShift"><option>Ca sáng</option><option>Ca trưa</option><option>Ca tối</option></select></div></div><div class="field"><label>Món bán</label><select class="inp" id="posRecipe">${DB.restaurantRecipes.filter((recipe) => recipe.active).map((recipe) => `<option value="${recipe.id}">${esc(recipe.name)} · ${fmtVND(recipe.price)}/${recipe.unit}</option>`).join('')}</select></div><div class="form-grid"><div class="field"><label>Số lượng</label><input class="inp num" id="posQty" type="number" min="1" value="1" /></div><div class="field"><label>Thanh toán</label><select class="inp" id="posPayment"><option>Tiền mặt</option><option>Chuyển khoản</option><option>Ví điện tử</option></select></div></div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button><button class="btn btn-primary" data-act="restaurant-pos-save"><i class="fa-solid fa-check"></i>Thanh toán và ghi kho</button>`,
  });
}

Views.suppliers = function () {
  const f = F('suppliers', { q: '', group: '' });
  const q = (f.q || '').toLowerCase().trim();
  const groups = [...new Set(DB.suppliers.map((supplier) => supplier.group))].sort().map((group) => [group, group]);
  const list = DB.suppliers.filter((supplier) => {
    if (f.group && supplier.group !== f.group) return false;
    return !q || [supplier.id, supplier.name, supplier.contact, supplier.group, supplier.address].some((value) => String(value || '').toLowerCase().includes(q));
  });
  const rows = list.map((supplier) => `<tr>
    <td><span class="code">${esc(supplier.id)}</span></td>
    <td>${cell2(esc(supplier.name), esc(supplier.address || ''))}</td>
    <td>${esc(supplier.group)}</td>
    <td>${esc(supplier.contact)}<div class="cell-sub">${esc(supplier.phone)}</div></td>
    <td class="center strong" style="${supplier.ratingStatus === 'UNRATED' || !Number(supplier.rating) ? 'color:var(--text-3)' : Number(supplier.rating) < 4 ? 'color:var(--red)' : ''}">${Number(supplier.rating || 0) ? Number(supplier.rating).toFixed(1) + ' / 5' : 'Chưa đánh giá'}</td>
    <td>${esc(supplier.paymentTerm || 'Theo hợp đồng')}</td>
    <td>${rowActions([{ act: 'supplier-detail', data: `data-id="${supplier.id}"`, icon: 'fa-eye', title: 'Xem chi tiết nhà cung cấp' }, { act: 'supplier-edit', data: `data-id="${supplier.id}"`, icon: 'fa-pen', title: 'Sửa nhà cung cấp' }, { act: 'supplier-delete', data: `data-id="${supplier.id}"`, icon: 'fa-trash', title: 'Xóa nhà cung cấp' }])}</td>
  </tr>`);
  return `${pageHead('Nhà cung cấp', 'Đối tác nguyên liệu đậu nành, phụ gia, bao bì, nước sạch, vận chuyển và dịch vụ của Lê Nam', '<button class="btn btn-primary" data-act="enterprise-action" data-key="suppliers"><i class="fa-solid fa-plus"></i>Thêm nhà cung cấp</button>')}
    <div class="grid g-auto-sm" style="margin-bottom:14px">${mkpi('Tổng nhà cung cấp', DB.suppliers.length, 'fa-handshake', 'blue')}${mkpi('Nhóm cung ứng', groups.length, 'fa-layer-group', 'teal')}${mkpi('Đánh giá trung bình', (DB.suppliers.reduce((sum, supplier) => sum + Number(supplier.rating || 0), 0) / DB.suppliers.length).toFixed(1) + ' / 5', 'fa-star', 'orange')}</div>
    <div class="card"><div class="toolbar">${searchBox('suppliers', 'Tìm mã, tên, người liên hệ, nhóm hàng…')}${selectFilter('suppliers', 'group', groups, 'Tất cả nhóm cung ứng')}${(f.q || f.group) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="suppliers"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}<span class="spacer"></span><span class="chip"><i class="fa-solid fa-list"></i> ${list.length} nhà cung cấp</span></div>${tableShell([{ t: 'Mã NCC' }, { t: 'Tên nhà cung cấp' }, { t: 'Nhóm cung ứng' }, { t: 'Liên hệ' }, { t: 'Đánh giá', cls: 'center' }, { t: 'Thanh toán' }, { t: '', cls: 'right' }], rows, { emptyTitle: 'Không tìm thấy nhà cung cấp' })}</div>`;
};

// Views['subcontracting-overview'] = function () {
//   const rows = DB.subcontractingOrders.map(order => {
//     const progress = order.plannedQty
//       ? Math.round((order.receivedQty / order.plannedQty) * 100)
//       : 0;

//     const amount = order.plannedQty * order.unitCost;

//     return `<tr>
//       <td><span class="code">${order.id}</span></td>
//       <td class="strong">${esc(order.partner)}</td>
//       <td>${esc(Q.product(order.productId)?.name || order.productId)}</td>
//       <td class="right num">${fmtDec(order.plannedQty, 2)}</td>
//       <td class="right num">${fmtDec(order.issuedQty, 2)}</td>
//       <td class="right num">
//         ${fmtDec(order.receivedQty, 2)} (${progress}%)
//       </td>
//       <td class="right num">${fmtVND(amount)}</td>
//       <td>${badge(order.status)}</td>
//       <td>
//         ${rowActions([{
//           act: 'subcontracting-issue',
//           data: `data-id="${order.id}"`,
//           icon: 'fa-arrow-right-from-bracket',
//           title: 'Xuất nguyên liệu gia công'
//         }])}
//       </td>
//     </tr>`;
//   });

//   return `${pageHead(
//     'Gia công',
//     'Quản lý kế hoạch, nguyên liệu giao đối tác, tiến độ nhận hàng, hao hụt, chất lượng và công nợ',
//     `
//       <button class="btn btn-primary" data-act="subcontracting-new">
//         <i class="fa-solid fa-plus"></i>
//         Tạo kế hoạch gia công
//       </button>
//     `
//   )}

//   <div class="grid g-auto-sm" style="margin-bottom:14px">
//     ${mkpi(
//       'Đơn gia công',
//       DB.subcontractingOrders.length,
//       'fa-industry',
//       'blue'
//     )}

//     ${mkpi(
//       'Sản lượng đã giao',
//       fmtDec(
//         DB.subcontractingOrders.reduce(
//           (sum, order) => sum + order.issuedQty,
//           0
//         ),
//         2
//       ),
//       'fa-truck-ramp-box',
//       'orange'
//     )}

//     ${mkpi(
//       'Sản lượng đã nhận',
//       fmtDec(
//         DB.subcontractingOrders.reduce(
//           (sum, order) => sum + order.receivedQty,
//           0
//         ),
//         2
//       ),
//       'fa-box-open',
//       'green'
//     )}

//     ${mkpi(
//       'Công nợ còn lại',
//       fmtVND(
//         DB.subcontractingOrders.reduce(
//           (sum, order) =>
//             sum + (order.plannedQty * order.unitCost - order.paid),
//           0
//         )
//       ),
//       'fa-file-invoice-dollar',
//       'red'
//     )}
//   </div>

//   <div class="card">
//     ${tableShell(
//       [
//         { t: 'Mã đơn' },
//         { t: 'Đối tác' },
//         { t: 'Sản phẩm' },
//         { t: 'Kế hoạch', cls: 'right' },
//         { t: 'Đã giao', cls: 'right' },
//         { t: 'Đã nhận', cls: 'right' },
//         { t: 'Giá trị', cls: 'right' },
//         { t: 'Trạng thái' },
//         { t: '', cls: 'right' }
//       ],
//       rows,
//       {
//         emptyTitle: 'Chưa có kế hoạch gia công'
//       }
//     )}
//   </div>`;
// };

Views['subcontracting-overview'] = function () {

  const orders = DB.subcontractingOrders;

  const totalPlanned = orders.reduce(
    (sum, order) => sum + (Number(order.plannedQty) || 0),
    0
  );

  const totalIssued = orders.reduce(
    (sum, order) => sum + (Number(order.issuedQty) || 0),
    0
  );

  const totalReceived = orders.reduce(
    (sum, order) => sum + (Number(order.receivedQty) || 0),
    0
  );

  const totalDebt = orders.reduce(
    (sum, order) =>
      sum +
      ((Number(order.plannedQty) || 0) *
        (Number(order.unitCost) || 0)) -
      (Number(order.paid) || 0),
    0
  );

  const inProgress = orders.filter(
    order => order.status === 'IN_PROGRESS'
  ).length;

  const completed = orders.filter(
    order => order.status === 'COMPLETED'
  ).length;

  const overdue = orders.filter(order => {
    if (!order.dueDate || order.status === 'COMPLETED') {
      return false;
    }

    return order.dueDate < DB.today;
  }).length;

  return `${pageHead(
    'Gia công',
    'Tổng quan hoạt động gia công, tiến độ, sản lượng, chất lượng và công nợ',
    `
      <button class="btn btn-primary" data-act="subcontracting-new">
        <i class="fa-solid fa-plus"></i>
        Tạo kế hoạch gia công
      </button>
    `
  )}

  <div class="grid g-auto-sm" style="margin-bottom:14px">

    ${mkpi(
      'Đơn gia công',
      orders.length,
      'fa-industry',
      'blue'
    )}

    ${mkpi(
      'Sản lượng kế hoạch',
      fmtDec(totalPlanned, 2),
      'fa-clipboard-list',
      'teal'
    )}

    ${mkpi(
      'Đang thực hiện',
      inProgress,
      'fa-spinner',
      'orange'
    )}

    ${mkpi(
      'Đã hoàn thành',
      completed,
      'fa-circle-check',
      'green'
    )}

    ${mkpi(
      'Công nợ còn lại',
      fmtVND(totalDebt),
      'fa-file-invoice-dollar',
      'red'
    )}

  </div>

  <div class="grid g-auto-sm">

    <div class="card">
      <div class="card-head">
        <div>
          <h3>Tình hình sản lượng</h3>
          <p>Tổng hợp sản lượng gia công hiện tại</p>
        </div>
      </div>

      <div class="grid g-auto-sm">

        ${mkpi(
          'Đã giao nguyên liệu',
          fmtDec(totalIssued, 2),
          'fa-truck-ramp-box',
          'orange'
        )}

        ${mkpi(
          'Đã nhận về',
          fmtDec(totalReceived, 2),
          'fa-box-open',
          'green'
        )}

      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h3>Cảnh báo</h3>
          <p>Các đơn cần được theo dõi</p>
        </div>
      </div>

      <div class="grid g-auto-sm">

        ${mkpi(
          'Đơn đang thực hiện',
          inProgress,
          'fa-clock',
          'orange'
        )}

        ${mkpi(
          'Đơn quá hạn',
          overdue,
          'fa-triangle-exclamation',
          'red'
        )}

      </div>
    </div>

  </div>`;
};

Views.subcontracting = function () {
  const tab = State.tab || 'dashboard';

  switch (tab) {
    case 'dashboard':
      return Views['subcontracting-overview']
        ? Views['subcontracting-overview']()
        : '';

    case 'orders':
      return Views['subcontracting-orders']
        ? Views['subcontracting-orders']()
        : '';

    case 'issue':
      return Views['subcontracting-issue']
        ? Views['subcontracting-issue']()
        : '';

    case 'progress':
      return Views['subcontracting-progress']
        ? Views['subcontracting-progress']()
        : '';

    case 'receive':
      return Views['subcontracting-receive']
        ? Views['subcontracting-receive']()
        : '';

    case 'debt':
      return Views['subcontracting-debt']
        ? Views['subcontracting-debt']()
        : '';

    case 'partners':
      return Views['subcontracting-partners']
        ? Views['subcontracting-partners']()
        : '';

    default:
      return '';
  }
};

Views['subcontracting-orders'] = function () {

  const rows = DB.subcontractingOrders.map(order => {

    const progress = order.plannedQty
      ? Math.round(
          (order.receivedQty / order.plannedQty) * 100
        )
      : 0;

    const amount =
      (Number(order.plannedQty) || 0) *
      (Number(order.unitCost) || 0);

    return `<tr>

      <td>
        <span class="code">${esc(order.id)}</span>
      </td>

      <td class="strong">
        ${esc(order.partner)}
      </td>

      <td>
        ${esc(
          Q.product(order.productId)?.name ||
          order.productId
        )}
      </td>

      <td class="right num">
        ${fmtDec(order.plannedQty, 2)}
      </td>

      <td class="right num">
        ${fmtDec(order.issuedQty, 2)}
      </td>

      <td class="right num">
        ${fmtDec(order.receivedQty, 2)}
      </td>

      <td class="right num">
        ${progress}%
      </td>

      <td class="right num">
        ${fmtVND(amount)}
      </td>

      <td>
        ${badge(order.status)}
      </td>

      <td>
        ${rowActions([
          {
            act: 'subcontracting-issue',
            data: `data-id="${order.id}"`,
            icon: 'fa-arrow-right-from-bracket',
            title: 'Xuất nguyên liệu'
          }
        ])}
      </td>

    </tr>`;
  });

  return `${pageHead(
    'Đơn gia công',
    'Quản lý danh sách đơn gia công, số lượng, tiến độ và trạng thái thực hiện',
    `
      <button class="btn btn-primary"
        data-act="subcontracting-new">
        <i class="fa-solid fa-plus"></i>
        Tạo đơn gia công
      </button>
    `
  )}

  <div class="grid g-auto-sm" style="margin-bottom:14px">

    ${mkpi(
      'Tổng đơn',
      DB.subcontractingOrders.length,
      'fa-industry',
      'blue'
    )}

    ${mkpi(
      'Đang thực hiện',
      DB.subcontractingOrders.filter(
        order => order.status === 'IN_PROGRESS'
      ).length,
      'fa-spinner',
      'orange'
    )}

    ${mkpi(
      'Hoàn thành',
      DB.subcontractingOrders.filter(
        order => order.status === 'COMPLETED'
      ).length,
      'fa-circle-check',
      'green'
    )}

    ${mkpi(
      'Bản nháp',
      DB.subcontractingOrders.filter(
        order => order.status === 'DRAFT'
      ).length,
      'fa-file',
      'teal'
    )}

  </div>

  <div class="card">

    ${tableShell(
      [
        { t: 'Mã đơn' },
        { t: 'Đối tác' },
        { t: 'Sản phẩm' },
        { t: 'Kế hoạch', cls: 'right' },
        { t: 'Đã giao', cls: 'right' },
        { t: 'Đã nhận', cls: 'right' },
        { t: 'Tiến độ', cls: 'right' },
        { t: 'Giá trị', cls: 'right' },
        { t: 'Trạng thái' },
        { t: '', cls: 'right' }
      ],
      rows,
      {
        emptyTitle: 'Chưa có đơn gia công'
      }
    )}

  </div>`;
};

Views['subcontracting-issue'] = function () {

  const orders = DB.subcontractingOrders.filter(
    order => order.issuedQty < order.plannedQty
  );

  const rows = orders.map(order => {

    const remaining =
      Math.max(
        (Number(order.plannedQty) || 0) -
        (Number(order.issuedQty) || 0),
        0
      );

    const productName =
      Q.product(order.productId)?.name ||
      order.productId;

    return `<tr>

      <td>
        <span class="code">${esc(order.id)}</span>
      </td>

      <td class="strong">
        ${esc(order.partner)}
      </td>

      <td>
        ${esc(productName)}
      </td>

      <td class="right num">
        ${fmtDec(order.plannedQty, 2)}
      </td>

      <td class="right num">
        ${fmtDec(order.issuedQty, 2)}
      </td>

      <td class="right num strong">
        ${fmtDec(remaining, 2)}
      </td>

      <td>
        ${badge(order.status)}
      </td>

      <td>
        ${rowActions([
          {
            act: 'subcontracting-issue',
            data: `data-id="${order.id}"`,
            icon: 'fa-arrow-right-from-bracket',
            title: 'Xuất nguyên liệu'
          }
        ])}
      </td>

    </tr>`;
  });

  const totalPlanned = DB.subcontractingOrders.reduce(
    (sum, order) =>
      sum + (Number(order.plannedQty) || 0),
    0
  );

  const totalIssued = DB.subcontractingOrders.reduce(
    (sum, order) =>
      sum + (Number(order.issuedQty) || 0),
    0
  );

  const totalRemaining = Math.max(
    totalPlanned - totalIssued,
    0
  );

  return `${pageHead(
    'Xuất nguyên liệu',
    'Quản lý nguyên liệu cần giao cho đối tác gia công theo từng đơn',
    ''
  )}

  <div class="grid g-auto-sm" style="margin-bottom:14px">

    ${mkpi(
      'Đơn cần xuất',
      orders.length,
      'fa-truck-ramp-box',
      'orange'
    )}

    ${mkpi(
      'Sản lượng kế hoạch',
      fmtDec(totalPlanned, 2),
      'fa-clipboard-list',
      'blue'
    )}

    ${mkpi(
      'Đã xuất',
      fmtDec(totalIssued, 2),
      'fa-boxes-stacked',
      'green'
    )}

    ${mkpi(
      'Còn cần xuất',
      fmtDec(totalRemaining, 2),
      'fa-arrow-right-from-bracket',
      'red'
    )}

  </div>

  <div class="card">

    <div class="card-head">
      <div>
        <h3>Danh sách xuất nguyên liệu</h3>
        <p>Các đơn chưa hoàn tất việc giao nguyên liệu cho đối tác</p>
      </div>
    </div>

    ${tableShell(
      [
        { t: 'Mã đơn' },
        { t: 'Đối tác' },
        { t: 'Sản phẩm' },
        { t: 'Kế hoạch', cls: 'right' },
        { t: 'Đã xuất', cls: 'right' },
        { t: 'Còn cần xuất', cls: 'right' },
        { t: 'Trạng thái' },
        { t: '', cls: 'right' }
      ],
      rows,
      {
        emptyTitle: 'Không có đơn cần xuất nguyên liệu'
      }
    )}

  </div>`;
};

Views['subcontracting-progress'] = function () {

  const orders = DB.subcontractingOrders;

  const rows = orders.map(order => {

    const planned =
      Number(order.plannedQty) || 0;

    const received =
      Number(order.receivedQty) || 0;

    const progress = planned
      ? Math.min(
          Math.round((received / planned) * 100),
          100
        )
      : 0;

    const isOverdue =
      order.dueDate &&
      order.dueDate < DB.today &&
      order.status !== 'COMPLETED';

    let progressStatus = '';

    if (order.status === 'COMPLETED') {
      progressStatus = badge('COMPLETED');
    } else if (isOverdue) {
      progressStatus = badge('OVERDUE');
    } else if (progress > 0) {
      progressStatus = badge('IN_PROGRESS');
    } else {
      progressStatus = badge('DRAFT');
    }

    return `<tr>

      <td>
        <span class="code">${esc(order.id)}</span>
      </td>

      <td class="strong">
        ${esc(order.partner)}
      </td>

      <td>
        ${esc(
          Q.product(order.productId)?.name ||
          order.productId
        )}
      </td>

      <td class="right num">
        ${fmtDec(planned, 2)}
      </td>

      <td class="right num">
        ${fmtDec(order.issuedQty, 2)}
      </td>

      <td class="right num">
        ${fmtDec(received, 2)}
      </td>

      <td class="right num strong">
        ${progress}%
      </td>

      <td>
        ${esc(order.dueDate || '-')}
      </td>

      <td>
        ${progressStatus}
      </td>

    </tr>`;
  });

  const completed = orders.filter(
    order => order.status === 'COMPLETED'
  ).length;

  const inProgress = orders.filter(
    order => order.status === 'IN_PROGRESS'
  ).length;

  const overdue = orders.filter(order =>
    order.dueDate &&
    order.dueDate < DB.today &&
    order.status !== 'COMPLETED'
  ).length;

  const avgProgress = orders.length
    ? Math.round(
        orders.reduce((sum, order) => {
          const planned =
            Number(order.plannedQty) || 0;

          const received =
            Number(order.receivedQty) || 0;

          return sum + (
            planned
              ? Math.min((received / planned) * 100, 100)
              : 0
          );
        }, 0) / orders.length
      )
    : 0;

  return `${pageHead(
    'Theo dõi tiến độ',
    'Theo dõi tình trạng thực hiện và tiến độ nhận hàng của các đơn gia công',
    ''
  )}

  <div class="grid g-auto-sm" style="margin-bottom:14px">

    ${mkpi(
      'Tiến độ trung bình',
      `${avgProgress}%`,
      'fa-chart-line',
      'blue'
    )}

    ${mkpi(
      'Đang thực hiện',
      inProgress,
      'fa-spinner',
      'orange'
    )}

    ${mkpi(
      'Đã hoàn thành',
      completed,
      'fa-circle-check',
      'green'
    )}

    ${mkpi(
      'Quá hạn',
      overdue,
      'fa-triangle-exclamation',
      'red'
    )}

  </div>

  <div class="card">

    <div class="card-head">
      <div>
        <h3>Tiến độ đơn gia công</h3>
        <p>Theo dõi sản lượng đã giao và sản lượng đã nhận</p>
      </div>
    </div>

    ${tableShell(
      [
        { t: 'Mã đơn' },
        { t: 'Đối tác' },
        { t: 'Sản phẩm' },
        { t: 'Kế hoạch', cls: 'right' },
        { t: 'Đã giao', cls: 'right' },
        { t: 'Đã nhận', cls: 'right' },
        { t: 'Tiến độ', cls: 'right' },
        { t: 'Hạn hoàn thành' },
        { t: 'Tình trạng' }
      ],
      rows,
      {
        emptyTitle: 'Chưa có đơn gia công'
      }
    )}

  </div>`;
};

Views['subcontracting-receive'] = function () {

  const orders = DB.subcontractingOrders;

  const rows = orders.map(order => {

    const received =
      Number(order.receivedQty) || 0;

    const good =
      Number(order.goodQty) || 0;

    const defect =
      Number(order.defectQty) || 0;

    const defectRate =
      received > 0
        ? ((defect / received) * 100).toFixed(1)
        : '0.0';

    let qualityStatus = 'Chưa nhận';

    if (received > 0 && defect === 0) {
      qualityStatus = 'Đạt';
    } else if (defect > 0) {
      qualityStatus = 'Có lỗi';
    }

    return `<tr>

      <td>
        <span class="code">${esc(order.id)}</span>
      </td>

      <td class="strong">
        ${esc(order.partner)}
      </td>

      <td>
        ${esc(
          Q.product(order.productId)?.name ||
          order.productId
        )}
      </td>

      <td class="right num">
        ${fmtDec(order.plannedQty, 2)}
      </td>

      <td class="right num">
        ${fmtDec(received, 2)}
      </td>

      <td class="right num">
        ${fmtDec(good, 2)}
      </td>

      <td class="right num">
        ${fmtDec(defect, 2)}
      </td>

      <td class="right num">
        ${defectRate}%
      </td>

      <td>
        ${esc(qualityStatus)}
      </td>

      <td>
        ${rowActions([
          {
            act: 'subcontracting-receive',
            data: `data-id="${order.id}"`,
            icon: 'fa-box-open',
            title: 'Ghi nhận nhận hàng'
          }
        ])}
      </td>

    </tr>`;
  });

  const totalReceived = orders.reduce(
    (sum, order) =>
      sum + (Number(order.receivedQty) || 0),
    0
  );

  const totalGood = orders.reduce(
    (sum, order) =>
      sum + (Number(order.goodQty) || 0),
    0
  );

  const totalDefect = orders.reduce(
    (sum, order) =>
      sum + (Number(order.defectQty) || 0),
    0
  );

  const defectRate =
    totalReceived > 0
      ? ((totalDefect / totalReceived) * 100).toFixed(1)
      : '0.0';

  return `${pageHead(
    'Nhận hàng & chất lượng',
    'Ghi nhận sản lượng nhận về và theo dõi chất lượng sản phẩm gia công',
    ''
  )}

  <div class="grid g-auto-sm" style="margin-bottom:14px">

    ${mkpi(
      'Đã nhận',
      fmtDec(totalReceived, 2),
      'fa-box-open',
      'blue'
    )}

    ${mkpi(
      'Số lượng đạt',
      fmtDec(totalGood, 2),
      'fa-circle-check',
      'green'
    )}

    ${mkpi(
      'Số lượng lỗi',
      fmtDec(totalDefect, 2),
      'fa-circle-xmark',
      'red'
    )}

    ${mkpi(
      'Tỷ lệ lỗi',
      `${defectRate}%`,
      'fa-triangle-exclamation',
      'orange'
    )}

  </div>

  <div class="card">

    <div class="card-head">
      <div>
        <h3>Nhận hàng & kiểm soát chất lượng</h3>
        <p>Theo dõi số lượng nhận, số lượng đạt và số lượng lỗi</p>
      </div>
    </div>

    ${tableShell(
      [
        { t: 'Mã đơn' },
        { t: 'Đối tác' },
        { t: 'Sản phẩm' },
        { t: 'Kế hoạch', cls: 'right' },
        { t: 'Đã nhận', cls: 'right' },
        { t: 'Đạt', cls: 'right' },
        { t: 'Lỗi', cls: 'right' },
        { t: 'Tỷ lệ lỗi', cls: 'right' },
        { t: 'Chất lượng' },
        { t: '', cls: 'right' }
      ],
      rows,
      {
        emptyTitle: 'Chưa có dữ liệu nhận hàng'
      }
    )}

  </div>`;
};

Views['subcontracting-debt'] = function () {

  const orders = DB.subcontractingOrders;

  const rows = orders.map(order => {

    const amount =
      (Number(order.plannedQty) || 0) *
      (Number(order.unitCost) || 0);

    const paid =
      Number(order.paid) || 0;

    const debt =
      Math.max(amount - paid, 0);

    let debtStatus = 'Chưa thanh toán';

    if (debt <= 0) {
      debtStatus = 'Đã thanh toán';
    } else if (paid > 0) {
      debtStatus = 'Thanh toán một phần';
    }

    return `<tr>

      <td>
        <span class="code">${esc(order.id)}</span>
      </td>

      <td class="strong">
        ${esc(order.partner)}
      </td>

      <td>
        ${esc(
          Q.product(order.productId)?.name ||
          order.productId
        )}
      </td>

      <td class="right num">
        ${fmtDec(order.plannedQty, 2)}
      </td>

      <td class="right num">
        ${fmtVND(order.unitCost)}
      </td>

      <td class="right num">
        ${fmtVND(amount)}
      </td>

      <td class="right num">
        ${fmtVND(paid)}
      </td>

      <td class="right num strong">
        ${fmtVND(debt)}
      </td>

      <td>
        ${esc(debtStatus)}
      </td>

    </tr>`;
  });

  const totalAmount = orders.reduce(
    (sum, order) =>
      sum +
      (Number(order.plannedQty) || 0) *
      (Number(order.unitCost) || 0),
    0
  );

  const totalPaid = orders.reduce(
    (sum, order) =>
      sum + (Number(order.paid) || 0),
    0
  );

  const totalDebt =
    Math.max(totalAmount - totalPaid, 0);

  const paidOrders = orders.filter(order => {

    const amount =
      (Number(order.plannedQty) || 0) *
      (Number(order.unitCost) || 0);

    return amount > 0 &&
      (Number(order.paid) || 0) >= amount;

  }).length;

  const unpaidOrders = orders.filter(order => {

    const amount =
      (Number(order.plannedQty) || 0) *
      (Number(order.unitCost) || 0);

    return amount >
      (Number(order.paid) || 0);

  }).length;

  return `${pageHead(
    'Công nợ',
    'Theo dõi giá trị gia công, số tiền đã thanh toán và công nợ còn lại',
    ''
  )}

  <div class="grid g-auto-sm" style="margin-bottom:14px">

    ${mkpi(
      'Tổng giá trị',
      fmtVND(totalAmount),
      'fa-file-invoice',
      'blue'
    )}

    ${mkpi(
      'Đã thanh toán',
      fmtVND(totalPaid),
      'fa-money-bill-transfer',
      'green'
    )}

    ${mkpi(
      'Còn phải trả',
      fmtVND(totalDebt),
      'fa-file-invoice-dollar',
      'red'
    )}

    ${mkpi(
      'Đơn chưa thanh toán',
      unpaidOrders,
      'fa-clock',
      'orange'
    )}

  </div>

  <div class="card">

    <div class="card-head">
      <div>
        <h3>Công nợ gia công</h3>
        <p>Theo dõi thanh toán theo từng đơn gia công</p>
      </div>
    </div>

    ${tableShell(
      [
        { t: 'Mã đơn' },
        { t: 'Đối tác' },
        { t: 'Sản phẩm' },
        { t: 'SL', cls: 'right' },
        { t: 'Đơn giá', cls: 'right' },
        { t: 'Giá trị', cls: 'right' },
        { t: 'Đã trả', cls: 'right' },
        { t: 'Còn nợ', cls: 'right' },
        { t: 'Trạng thái' }
      ],
      rows,
      {
        emptyTitle: 'Chưa có dữ liệu công nợ'
      }
    )}

  </div>`;
};

Views['subcontracting-partners'] = function () {

  const partnerMap = {};

  DB.subcontractingOrders.forEach(order => {

    const partner = order.partner;

    if (!partnerMap[partner]) {
      partnerMap[partner] = {
        partner,
        orders: 0,
        plannedQty: 0,
        issuedQty: 0,
        receivedQty: 0,
        goodQty: 0,
        defectQty: 0,
        amount: 0,
        paid: 0
      };
    }

    const item = partnerMap[partner];

    item.orders += 1;

    item.plannedQty +=
      Number(order.plannedQty) || 0;

    item.issuedQty +=
      Number(order.issuedQty) || 0;

    item.receivedQty +=
      Number(order.receivedQty) || 0;

    item.goodQty +=
      Number(order.goodQty) || 0;

    item.defectQty +=
      Number(order.defectQty) || 0;

    item.amount +=
      (Number(order.plannedQty) || 0) *
      (Number(order.unitCost) || 0);

    item.paid +=
      Number(order.paid) || 0;
  });

  const partners = Object.values(partnerMap);

  const rows = partners.map(item => {

    const debt =
      Math.max(
        item.amount - item.paid,
        0
      );

    const defectRate =
      item.receivedQty > 0
        ? (
            item.defectQty /
            item.receivedQty *
            100
          ).toFixed(1)
        : '0.0';

    return `<tr>

      <td class="strong">
        ${esc(item.partner)}
      </td>

      <td class="right num">
        ${item.orders}
      </td>

      <td class="right num">
        ${fmtDec(item.plannedQty, 2)}
      </td>

      <td class="right num">
        ${fmtDec(item.issuedQty, 2)}
      </td>

      <td class="right num">
        ${fmtDec(item.receivedQty, 2)}
      </td>

      <td class="right num">
        ${fmtDec(item.goodQty, 2)}
      </td>

      <td class="right num">
        ${defectRate}%
      </td>

      <td class="right num">
        ${fmtVND(item.amount)}
      </td>

      <td class="right num">
        ${fmtVND(debt)}
      </td>

      <td>
        ${rowActions([
          {
            act: 'subcontracting-partner-detail',
            data: `data-partner="${esc(item.partner)}"`,
            icon: 'fa-eye',
            title: 'Xem chi tiết'
          }
        ])}
      </td>

    </tr>`;
  });

  const totalPartners = partners.length;

  const totalOrders = partners.reduce(
    (sum, item) =>
      sum + item.orders,
    0
  );

  const totalAmount = partners.reduce(
    (sum, item) =>
      sum + item.amount,
    0
  );

  const totalDebt = partners.reduce(
    (sum, item) =>
      sum + Math.max(item.amount - item.paid, 0),
    0
  );

  return `${pageHead(
    'Đối tác gia công',
    'Quản lý và theo dõi tình hình thực hiện của các đối tác gia công',
    `
      <button class="btn btn-primary"
        data-act="subcontracting-partner-new">
        <i class="fa-solid fa-plus"></i>
        Thêm đối tác
      </button>
    `
  )}

  <div class="grid g-auto-sm" style="margin-bottom:14px">

    ${mkpi(
      'Đối tác',
      totalPartners,
      'fa-handshake',
      'blue'
    )}

    ${mkpi(
      'Tổng đơn gia công',
      totalOrders,
      'fa-industry',
      'teal'
    )}

    ${mkpi(
      'Tổng giá trị',
      fmtVND(totalAmount),
      'fa-file-invoice',
      'green'
    )}

    ${mkpi(
      'Công nợ',
      fmtVND(totalDebt),
      'fa-file-invoice-dollar',
      'red'
    )}

  </div>

  <div class="card">

    <div class="card-head">
      <div>
        <h3>Danh sách đối tác gia công</h3>
        <p>Tổng hợp sản lượng, chất lượng và công nợ theo đối tác</p>
      </div>
    </div>

    ${tableShell(
      [
        { t: 'Đối tác' },
        { t: 'Số đơn', cls: 'right' },
        { t: 'Kế hoạch', cls: 'right' },
        { t: 'Đã giao', cls: 'right' },
        { t: 'Đã nhận', cls: 'right' },
        { t: 'Đạt', cls: 'right' },
        { t: 'Tỷ lệ lỗi', cls: 'right' },
        { t: 'Giá trị', cls: 'right' },
        { t: 'Công nợ', cls: 'right' },
        { t: '', cls: 'right' }
      ],
      rows,
      {
        emptyTitle: 'Chưa có đối tác gia công'
      }
    )}

  </div>`;
};
function openSubcontractingForm() {
  Modal.open({ title: 'Tạo kế hoạch gia công', sub: 'Khai báo đối tác, sản phẩm, số lượng và hạn hoàn thành', size: 'md', body: `<div class="form-grid"><div class="field"><label>Đối tác gia công</label><input class="inp" id="subPartner" value="Cơ sở Đậu Hủ Tân Phúc" /></div><div class="field"><label>Sản phẩm</label><select class="inp" id="subProduct">${DB.products.map((product) => `<option value="${product.id}">${esc(product.name)}</option>`).join('')}</select></div></div><div class="form-grid"><div class="field"><label>Số lượng kế hoạch</label><input class="inp num" id="subQty" type="number" min="1" value="500" /></div><div class="field"><label>Đơn giá gia công</label><input class="inp num" id="subCost" type="number" min="0" value="1500" /></div></div><div class="form-grid"><div class="field"><label>Ngày giao nguyên liệu</label><input class="inp" id="subIssueDate" type="date" value="${DB.today}" /></div><div class="field"><label>Ngày cần hoàn thành</label><input class="inp" id="subDueDate" type="date" value="${addDays(DB.today, 10)}" /></div></div>`, foot: '<button class="btn" data-act="modal-close">Hủy</button><button class="btn btn-primary" data-act="subcontracting-save"><i class="fa-solid fa-floppy-disk"></i>Lưu kế hoạch</button>' });
}


function incomingInspectionView() {
  const f = F('quality-iqc', { q: '', status: '' });
  const q = (f.q || '').toLowerCase().trim();
  const receipts = (DB.goodsReceipts || []).filter(r => {
    const po = Q.purchaseOrder(r.poId);
    if (!po || !['RECEIVED', 'PARTIAL_RECEIVED'].includes(po.status)) return false;
    if (f.status && (r.inspectionStatus || 'PENDING') !== f.status) return false;
    if (q && ![r.id, r.poId, r.prId, Q.supplierName(po.supplierId), r.note].some(v => String(v || '').toLowerCase().includes(q))) return false;
    return true;
  }).sort((a,b) => String(b.id).localeCompare(String(a.id)));
  const pg = paged(receipts, 'quality-iqc');
  const rows = pg.items.map(r => {
    const po = Q.purchaseOrder(r.poId);
    const status = r.inspectionStatus || 'PENDING';
    const statusHtml = status === 'PASSED' ? '<span class="badge green">Đạt</span>' : (status === 'FAILED' || status === 'PARTIAL_FAILED') ? '<span class="badge red">Có nguyên liệu không đạt</span>' : '<span class="badge orange">Chờ kiểm</span>';
    return `<tr>
      <td><span class="code">${esc(r.id)}</span><div class="cell-sub">Đợt nhập ${fmtN((Q.receiptsOfPo(r.poId).sort((a,b)=>String(a.id).localeCompare(String(b.id))).findIndex(x=>x.id===r.id)+1) || 1)}</div></td>
      <td><span class="code">${esc(r.poId)}</span></td>
      <td>${esc(Q.supplierName(po?.supplierId))}</td>
      <td class="num">${fmtDate(r.date)}</td>
      <td>${esc(r.warehouse || Q.warehouseName(r.warehouseId))}</td>
      <td>${esc((r.items||[]).map(i=>`${i.name} (${fmtN(i.qty)} ${i.unit})`).join(', '))}</td>
      <td>${statusHtml}</td>
      <td class="right">${status === 'PENDING' ? `<button class="btn btn-sm btn-primary" data-act="iqc-open-inspection" data-id="${esc(r.id)}"><i class="fa-solid fa-clipboard-check"></i>Kiểm tra</button>` : `<button class="btn btn-sm" data-act="iqc-open-inspection" data-id="${esc(r.id)}"><i class="fa-solid fa-eye"></i>Xem kết quả</button>`}</td>
    </tr>`;
  });
  return `${pageHead('Kiểm tra nguyên liệu đầu vào', 'Kiểm tra theo từng phiếu nhập/đợt nhập. Nguyên liệu không đạt sẽ sinh yêu cầu trả chuyển sang Kho nguyên liệu.', '')}
    <div class="grid g-auto-sm" style="margin-bottom:14px">
      ${mkpi('Đợt chờ kiểm', receipts.filter(r => (r.inspectionStatus||'PENDING') === 'PENDING').length, 'fa-clock', 'orange')}
      ${mkpi('Đợt đạt', receipts.filter(r => r.inspectionStatus === 'PASSED').length, 'fa-circle-check', 'green')}
      ${mkpi('Đợt có lỗi', receipts.filter(r => ['FAILED','PARTIAL_FAILED'].includes(r.inspectionStatus)).length, 'fa-triangle-exclamation', 'red')}
      ${mkpi('Yêu cầu trả chờ kho', (DB.materialReturnRequests||[]).filter(r=>r.status==='PENDING_WAREHOUSE').length, 'fa-rotate-left', 'blue')}
    </div>
    <div class="card"><div class="toolbar">${searchBox('quality-iqc','Tìm phiếu nhập, PO, NCC…')}${selectFilter('quality-iqc','status',[['PENDING','Chờ kiểm'],['PASSED','Đạt'],['PARTIAL_FAILED','Có lỗi một phần'],['FAILED','Không đạt']], 'Tất cả kết quả')}${(f.q||f.status)?'<button class="btn btn-sm" data-act="clear-filter" data-key="quality-iqc"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>':''}<span class="spacer"></span><span class="chip">${receipts.length} đợt nhập</span></div>
    ${tableShell([{t:'Phiếu nhập / Đợt'},{t:'PO'},{t:'Nhà cung cấp'},{t:'Ngày nhập'},{t:'Kho'},{t:'Nguyên liệu'},{t:'Kết quả'},{t:'',cls:'right'}], rows, {emptyTitle:'Chưa có đợt nhập nào cần kiểm tra'})}${pagiHTML('quality-iqc', pg, 'đợt nhập')}</div>`;
}

function openIncomingInspectionModal(receiptId) {
  const receipt = (DB.goodsReceipts || []).find(r => r.id === receiptId);
  if (!receipt) return;
  const po = Q.purchaseOrder(receipt.poId);
  const readonly = receipt.inspectionStatus && receipt.inspectionStatus !== 'PENDING';
  Modal.open({
    title: `Kiểm tra nguyên liệu · ${receipt.id}`,
    sub: `${receipt.poId} · ${esc(Q.supplierName(po?.supplierId))} · kiểm tra theo đúng đợt nhập ngày ${fmtDate(receipt.date)}`,
    size: 'lg',
    body: `
      <div class="info-grid" style="margin-bottom:16px">
        ${infoItem('Phiếu nhập', `<span class="code">${esc(receipt.id)}</span>`)}
        ${infoItem('Đơn đặt hàng', `<span class="code">${esc(receipt.poId)}</span>`)}
        ${infoItem('Kho / Kệ', `${esc(receipt.warehouse || Q.warehouseName(receipt.warehouseId))} · ${esc(receipt.location || Q.locationName(receipt.locationId))}`)}
        ${infoItem('Người nhập kho', esc(Q.employeeName(receipt.receivedBy)))}
      </div>
      <div class="form-grid"><div class="field"><label>Người kiểm tra</label><select class="inp" id="iqcInspector" ${readonly?'disabled':''}>${DB.employees.filter(e=>e.dept==='QC/ATTP').map(e=>`<option value="${e.id}" ${e.id===(receipt.inspectedBy||'NV-016')?'selected':''}>${esc(e.name)}</option>`).join('')}</select></div><div class="field"><label>Ngày kiểm tra</label><input class="inp" value="${esc(receipt.inspectedAt||DB.today)}" disabled></div></div>
      <div class="form-sec-title"><i class="fa-solid fa-vials"></i>Kết quả theo từng nguyên liệu</div>
      <div class="tbl-wrap"><table class="line-tbl"><thead><tr><th>Nguyên liệu</th><th>SL nhập</th><th>Lô hệ thống</th><th>Lô SP/NCC</th><th>Kết quả</th><th class="right">SL không đạt / trả</th><th>Lý do</th></tr></thead><tbody>
      ${(receipt.items||[]).map(i=>`<tr><td>${cell2(esc(i.name),esc(i.materialId))}</td><td class="num">${fmtN(i.qty)} ${esc(i.unit)}</td><td><span class="code">${esc(i.lotNumber||'—')}</span></td><td>${esc(i.supplierLot||Q.lot(i.lotId)?.supplierLot||'—')}</td><td><select class="inp iqc-result" data-mid="${esc(i.materialId)}" ${readonly?'disabled':''}><option value="PASSED" ${(i.qcStatus||'PASSED')==='PASSED'?'selected':''}>Đạt</option><option value="FAILED" ${i.qcStatus==='FAILED'?'selected':''}>Không đạt</option></select></td><td><input class="inp right num iqc-fail-qty" data-mid="${esc(i.materialId)}" type="number" min="0" max="${Number(i.qty||0)}" value="${Number(i.failedQty||0)}" ${readonly?'disabled':''}></td><td><input class="inp iqc-reason" data-mid="${esc(i.materialId)}" value="${esc(i.qcReason||'')}" placeholder="Mùi, màu, bao bì, độ ẩm…" ${readonly?'disabled':''}></td></tr>`).join('')}
      </tbody></table></div>
      <div class="field" style="margin-top:12px"><label>Ghi chú kiểm tra</label><textarea class="inp" id="iqcNote" rows="2" ${readonly?'disabled':''}>${esc(receipt.inspectionNote||'')}</textarea></div>
      ${readonly ? `<div class="alert-item"><i class="fa-solid fa-circle-info"></i><div><b>Đợt nhập đã được kiểm tra</b><div class="muted">Kết quả đã khóa. Yêu cầu trả nguyên liệu (nếu có) đang/đã được xử lý ở Kho → Xuất kho → Kho nguyên liệu.</div></div></div>` : ''}`,
    foot: `<button class="btn" data-act="modal-close">Đóng</button>${readonly?'':`<button class="btn btn-primary" data-act="iqc-save-inspection" data-id="${esc(receipt.id)}"><i class="fa-solid fa-floppy-disk"></i>Lưu kết quả kiểm tra</button>`}`
  });
}

/* Đăng ký Views cho các phân hệ doanh nghiệp tiêu chuẩn */
['accounting', 'quality', 'maintenance', 'logistics', 'rnd', 'approvals', 'bi'].forEach(key => {
  Views[key] = function (params = {}) {
    const tab = State.tab || (params && params.tab) || 'dashboard';
    if (key === 'quality' && tab === 'iqc') return incomingInspectionView();
    if (!tab || tab === 'dashboard') {
      if (ENTERPRISE_MODULES[key]) return enterpriseView(key);
      if (key === 'bi' && typeof Views.reports === 'function') return Views.reports(params);
    }
    return '';
  };
});
function openSupplierForm(id = '') {
  const supplier = id ? DB.suppliers.find((x) => x.id === id) : null;
  const categoryNames = [...new Set([
    ...(DB.itemCategories || []).filter((c) => c.type === 'RAW_MATERIAL' && c.status !== 'inactive').map((c) => c.name),
    ...DB.suppliers.map((x) => x.group).filter(Boolean),
  ])].sort((a, b) => String(a).localeCompare(String(b), 'vi'));
  const groupOptions = categoryNames.map((name) => `<option value="${esc(name)}" ${supplier?.group === name ? 'selected' : ''}>${esc(name)}</option>`).join('');
  Modal.open({
    title: supplier ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp',
    sub: supplier ? `${supplier.id} · Cập nhật hồ sơ nhà cung cấp` : 'Tạo hồ sơ nhà cung cấp mới · ban đầu chưa đánh giá',
    size: 'md',
    body: `<div class="form-grid">
      <div class="field" style="grid-column:1/-1"><label>Tên nhà cung cấp <span class="req">*</span></label><input class="inp" id="supName" value="${esc(supplier?.name || '')}" placeholder="Tên công ty / hộ kinh doanh / đối tác"></div>
      <div class="field"><label>Nhóm cung ứng <span class="req">*</span></label><select class="inp" id="supGroup"><option value="">-- Chọn nhóm cung ứng --</option>${groupOptions}</select><div class="cell-sub" style="margin-top:5px">Danh sách lấy từ danh mục nguyên liệu / nhóm cung ứng hiện có.</div></div>
      <div class="field"><label>Người liên hệ</label><input class="inp" id="supContact" value="${esc(supplier?.contact || '')}" placeholder="Họ và tên"></div>
      <div class="field"><label>Số điện thoại</label><input class="inp" id="supPhone" value="${esc(supplier?.phone || '')}" placeholder="Số điện thoại"></div>
      <div class="field"><label>Email</label><input class="inp" id="supEmail" type="email" value="${esc(supplier?.email || '')}" placeholder="email@congty.vn"></div>
      <div class="field"><label>Mã số thuế</label><input class="inp" id="supTaxCode" value="${esc(supplier?.taxCode || '')}" placeholder="Mã số thuế"></div>
      <div class="field"><label>Tài khoản ngân hàng</label><input class="inp" id="supBankAccount" value="${esc(supplier?.bankAccount || '')}" placeholder="Số tài khoản"></div>
      <div class="field"><label>Ngân hàng</label><input class="inp" id="supBankName" value="${esc(supplier?.bankName || '')}" placeholder="Tên ngân hàng"></div>
      <div class="field" style="grid-column:1/-1"><label>Địa chỉ</label><input class="inp" id="supAddress" value="${esc(supplier?.address || '')}" placeholder="Địa chỉ nhà cung cấp"></div>
      <div class="field"><label>Điều khoản thanh toán</label><input class="inp" id="supPayment" value="${esc(supplier?.paymentTerm || '')}" placeholder="Ví dụ: 30 ngày sau giao hàng"></div>
      <div class="field"><label>Đánh giá</label><input class="inp" value="${supplier && Number(supplier.rating) ? Number(supplier.rating).toFixed(1) + ' / 5' : 'Chưa đánh giá'}" disabled></div>
    </div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button><button class="btn btn-primary" data-act="supplier-save" data-id="${esc(supplier?.id || '')}"><i class="fa-solid fa-floppy-disk"></i>${supplier ? 'Lưu thay đổi' : 'Lưu nhà cung cấp'}</button>`
  });
}
