/* ============================================================================
 * MODULE: NHÂN SỰ — CHẤM CÔNG — NGƯỜI DÙNG & PHÂN QUYỀN — CÀI ĐẶT
 * ==========================================================================*/

/* ------------------------------------------------------------ NHÂN SỰ */
Views.hr = function () {
  const tab = State.tab || (State.params && State.params.tab);
  if (tab === 'attendance') return Views.attendance ? Views.attendance(State.params) : '';
  if (tab && !['dashboard', 'profile'].includes(tab)) return '';

  const f = F('hr', { q: '', dept: '', status: '', position: '' });
  const q = (f.q || '').toLowerCase().trim();
  const list = DB.employees.filter((e) => {
    if (f.dept && e.dept !== f.dept) return false;
    if (f.status && e.status !== f.status) return false;
    if (f.position && e.position !== f.position) return false;
    if (q && ![e.id, e.name, e.dept, e.position, e.phone].some((v) => String(v).toLowerCase().includes(q))) return false;
    return true;
  });
  const pg = paged(list, 'hr');
  const positions = [...new Set(DB.employees.map((e) => e.position))].sort().map((p) => [p, p]);
  const cnt = (s) => DB.employees.filter((e) => e.status === s).length;
  const working = cnt('ns_dang_lam') + cnt('ns_thu_viec');

  const rows = pg.items.map((e) => `
    <tr class="clickable" data-act="open-employee" data-id="${e.id}">
      <td><span class="code">${e.id}</span></td>
      <td><div style="display:flex;align-items:center;gap:9px">${avatarHTML(e.name)}<span style="min-width:0">${cell2(esc(e.name), esc(e.gender + ' · ' + e.email))}</span></div></td>
      <td class="hide-sm"><span class="chip">${esc(e.dept)}</span></td>
      <td>${esc(e.position)}</td>
      <td class="num">${esc(e.phone)}</td>
      <td class="num hide-sm">${fmtDate(e.joinDate)}</td>
      <td>${badge(e.status)}</td>
    </tr>`);

  return `
  ${pageHead('Quản lý nhân sự', `${DB.employees.length} nhân sự thuộc ${DB.departments.length} phòng ban`, `
    <button class="btn" data-act="import-data" data-what="nhân sự"><i class="fa-solid fa-file-import"></i>Import</button>
    <button class="btn" data-act="export-hr"><i class="fa-solid fa-file-export"></i>Export</button>
    <button class="btn btn-primary" data-act="new-employee"><i class="fa-solid fa-user-plus"></i>Thêm nhân sự</button>
  `)}

  <div class="grid g-auto-sm" style="margin-bottom:14px">
    ${mkpi('Tổng nhân sự', DB.employees.length, 'fa-users', 'blue')}
    ${mkpi('Đang làm việc', working, 'fa-user-check', 'green')}
    ${mkpi('Nghỉ phép', cnt('ns_nghi_phep'), 'fa-umbrella-beach', 'orange')}
    ${mkpi('Nghỉ việc', cnt('ns_nghi_viec'), 'fa-user-slash', 'red')}
    ${mkpi('Quỹ lương tháng', fmtShort(DB.employees.filter((e) => e.status !== 'ns_nghi_viec').reduce((s, e) => s + e.salary, 0)), 'fa-money-check-dollar', 'indigo')}
  </div>

  <div class="grid g-2" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h3>Cơ cấu nhân sự theo phòng ban</h3><p>Số lượng nhân sự đang làm việc</p></div></div>
      <div class="card-body"><div class="chart-box sm"><canvas id="chHrDept"></canvas></div></div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Phân bổ theo trạng thái</h3><p>Tình trạng làm việc toàn công ty</p></div></div>
      <div class="card-body">
        <div class="chart-box sm"><canvas id="chHrStatus"></canvas></div>
        <div class="legend">
          ${['ns_dang_lam', 'ns_thu_viec', 'ns_nghi_phep', 'ns_nghi_viec'].map((s) => `
            <span class="legend-item"><span class="legend-dot" style="background:var(--${statusTone(s)})"></span>${esc(statusLabel(s))} · <b>${cnt(s)}</b></span>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="toolbar">
      ${searchBox('hr', 'Tìm mã NV, họ tên, số điện thoại…')}
      ${selectFilter('hr', 'dept', DB.departments.map((d) => [d, d]), 'Tất cả phòng ban')}
      ${selectFilter('hr', 'position', positions, 'Tất cả chức vụ')}
      ${selectFilter('hr', 'status', statusOptions('ns_'), 'Tất cả trạng thái')}
      ${(f.q || f.dept || f.status || f.position) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="hr"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
      <span class="spacer"></span>
      <span class="chip"><i class="fa-solid fa-list"></i> ${fmtN(list.length)} nhân sự</span>
    </div>
    ${tableShell(
      [{ t: 'Mã NV', w: '92px' }, { t: 'Họ tên' }, { t: 'Phòng ban', cls: 'hide-sm' }, { t: 'Chức vụ' },
       { t: 'Số điện thoại' }, { t: 'Ngày vào làm', cls: 'hide-sm' }, { t: 'Trạng thái', w: '130px' }],
      rows, { emptyTitle: 'Không tìm thấy nhân sự' })}
    ${pagiHTML('hr', pg, 'nhân sự')}
  </div>`;
};

Views.hr.after = function () {
  const depts = DB.departments.filter((d) => DB.employees.some((e) => e.dept === d));
  Charts.bar('chHrDept', depts, [{ label: 'Nhân sự', data: depts.map((d) => DB.employees.filter((e) => e.dept === d && e.status !== 'ns_nghi_viec').length), color: 'blue' }], { horizontal: true });
  const sts = ['ns_dang_lam', 'ns_thu_viec', 'ns_nghi_phep', 'ns_nghi_viec'];
  Charts.donut('chHrStatus', sts.map(statusLabel), sts.map((s) => DB.employees.filter((e) => e.status === s).length), sts.map(statusTone));
};

function openEmployeeModal(id) {
  const e = Q.employee(id);
  if (!e) return;
  const att = DB.attendance.find((a) => a.empId === id);
  const user = DB.users.find((u) => u.empId === id);
  const stages = DB.productionOrders.flatMap((p) => p.stages.filter((s) => s.leadId === id).map((s) => ({ po: p, s })));

  Modal.open({
    title: `<div style="display:flex;align-items:center;gap:11px">${avatarHTML(e.name, 'lg')}<span>${esc(e.name)}<div style="font-size:12.5px;font-weight:500;color:var(--text-3);margin-top:2px">${e.id} · ${esc(e.position)}</div></span></div>`,
    size: 'md',
    body: `
      <div class="info-grid" style="margin-bottom:18px">
        ${infoItem('Phòng ban', esc(e.dept))}
        ${infoItem('Chức vụ', esc(e.position))}
        ${infoItem('Giới tính', esc(e.gender))}
        ${infoItem('Số điện thoại', esc(e.phone))}
        ${infoItem('Email', esc(e.email))}
        ${infoItem('Ngày vào làm', fmtDate(e.joinDate))}
        ${infoItem('Thâm niên', Math.max(0, Math.floor((new Date(DB.today) - new Date(e.joinDate)) / 31536000000)) + ' năm')}
        ${infoItem('Trạng thái', badge(e.status))}
        ${infoItem('Mức lương', fmtVND(e.salary) + '/tháng')}
        ${infoItem('Tài khoản hệ thống', user ? `<span class="code">${esc(user.username)}</span> — ${esc((DB.roles.find((r) => r.id === user.roleId) || {}).name || '')}` : '<span class="muted">Chưa cấp tài khoản</span>')}
      </div>
      ${att ? `
      <div class="form-sec-title"><i class="fa-solid fa-calendar-check"></i>Bảng công tháng 08/2026</div>
      <div class="stat-strip" style="margin-bottom:16px">
        <div><div class="l">Công chuẩn</div><div class="v">${att.standard}</div></div>
        <div><div class="l">Đi làm</div><div class="v" style="color:var(--green)">${att.worked}</div></div>
        <div><div class="l">Nghỉ phép</div><div class="v" style="color:var(--orange)">${att.leave}</div></div>
        <div><div class="l">Đi muộn</div><div class="v">${att.late}</div></div>
        <div><div class="l">Tăng ca (giờ)</div><div class="v" style="color:var(--indigo)">${att.ot}</div></div>
      </div>` : ''}
      ${stages.length ? `
      <div class="form-sec-title"><i class="fa-solid fa-industry"></i>Công đoạn đang phụ trách</div>
      ${tableShell(
        [{ t: 'Lệnh SX' }, { t: 'Sản phẩm' }, { t: 'Công đoạn' }, { t: 'Sản lượng', cls: 'right' }, { t: 'Trạng thái' }],
        stages.slice(0, 8).map(({ po, s }) => `<tr class="clickable" data-act="open-po" data-id="${po.id}">
          <td><span class="code">${po.id}</span></td>
          <td>${esc(po.productName)}</td>
          <td class="strong">${esc(s.name)}</td>
          <td class="right num">${fmtN(s.qtyDone)}/${fmtN(s.qtyPlan)}</td>
          <td>${s.status === 'done' ? '<span class="badge green">Xong</span>' : s.status === 'doing' ? '<span class="badge blue">Đang làm</span>' : '<span class="badge slate">Chờ</span>'}</td></tr>`))}` : ''}`,
    foot: `<button class="btn" data-act="modal-close">Đóng</button>
           <button class="btn" data-act="go" data-id="attendance"><i class="fa-solid fa-calendar-check"></i>Xem chấm công</button>`,
  });
}

/* ---------------------------------------------------------- CHẤM CÔNG */
Views.attendance = function () {
  const f = F('attendance', { q: '', dept: '', month: '2026-08' });
  const q = (f.q || '').toLowerCase().trim();
  const list = DB.attendance.filter((a) => {
    if (f.dept && a.dept !== f.dept) return false;
    if (q && ![a.empId, a.name, a.dept, a.position].some((v) => String(v).toLowerCase().includes(q))) return false;
    return true;
  });
  const pg = paged(list, 'attendance');

  const totalWorked = DB.attendance.reduce((s, a) => s + a.worked, 0);
  const totalStd = DB.attendance.reduce((s, a) => s + a.standard, 0);
  const totalOt = DB.attendance.reduce((s, a) => s + a.ot, 0);
  const totalLeave = DB.attendance.reduce((s, a) => s + a.leave, 0);
  const totalLate = DB.attendance.filter((a) => a.late > 0).length;

  const rows = pg.items.map((a) => `
    <tr class="clickable" data-act="open-employee" data-id="${a.empId}">
      <td><span class="code">${a.empId}</span></td>
      <td><div style="display:flex;align-items:center;gap:9px">${avatarHTML(a.name)}<span>${cell2(esc(a.name), esc(a.position))}</span></div></td>
      <td class="hide-sm"><span class="chip">${esc(a.dept)}</span></td>
      <td class="center num">${a.standard}</td>
      <td class="center num strong" style="color:var(--green)">${a.worked}</td>
      <td class="center num" style="color:${a.leave ? 'var(--orange)' : 'var(--text-3)'}">${a.leave || '—'}</td>
      <td class="center num hide-sm" style="color:${a.late ? 'var(--red)' : 'var(--text-3)'}">${a.late || '—'}</td>
      <td class="center num hide-sm" style="color:${a.ot ? 'var(--indigo)' : 'var(--text-3)'}">${a.ot || '—'}</td>
      <td style="min-width:120px">${progressBar(a.rate)}</td>
    </tr>`);

  return `
  ${pageHead('Chấm công', `Bảng công ${fmtMonth(f.month + '-01')} · ${DB.attendance.length} nhân sự`, `
    <input class="inp" type="month" data-f="attendance.month" value="${f.month}" style="width:160px" />
    <button class="btn" data-act="export-attendance"><i class="fa-solid fa-file-export"></i>Xuất bảng công</button>
  `)}

  <div class="grid g-auto-sm" style="margin-bottom:14px">
    ${mkpi('Tổng công chuẩn', fmtN(totalStd), 'fa-calendar', 'slate')}
    ${mkpi('Tổng công thực tế', fmtN(totalWorked), 'fa-calendar-check', 'green')}
    ${mkpi('Tỷ lệ chuyên cần', (totalStd ? Math.round((totalWorked / totalStd) * 1000) / 10 : 0) + '%', 'fa-gauge-high', 'blue')}
    ${mkpi('Ngày nghỉ phép', fmtN(totalLeave), 'fa-umbrella-beach', 'orange')}
    ${mkpi('Giờ tăng ca', fmtN(totalOt), 'fa-clock', 'indigo')}
    ${mkpi('NV đi muộn', fmtN(totalLate), 'fa-person-running', 'red')}
  </div>

  <div class="card">
    <div class="toolbar">
      ${searchBox('attendance', 'Tìm mã NV, họ tên…')}
      ${selectFilter('attendance', 'dept', DB.departments.map((d) => [d, d]), 'Tất cả phòng ban')}
      ${(f.q || f.dept) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="attendance"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
      <span class="spacer"></span>
      <span class="chip"><i class="fa-solid fa-list"></i> ${fmtN(list.length)} nhân sự</span>
    </div>
    ${tableShell(
      [{ t: 'Mã NV', w: '92px' }, { t: 'Họ tên' }, { t: 'Phòng ban', cls: 'hide-sm' }, { t: 'Công chuẩn', cls: 'center' },
       { t: 'Đi làm', cls: 'center' }, { t: 'Nghỉ phép', cls: 'center' }, { t: 'Đi muộn', cls: 'center hide-sm' },
       { t: 'Tăng ca (h)', cls: 'center hide-sm' }, { t: 'Tỷ lệ', w: '150px' }],
      rows, { emptyTitle: 'Không có dữ liệu chấm công' })}
    ${pagiHTML('attendance', pg, 'nhân sự')}
  </div>`;
};

/* --------------------------------------------- NGƯỜI DÙNG & PHÂN QUYỀN */
Views.users = function () {
  const f = F('users', { q: '', role: '' });
  const q = (f.q || '').toLowerCase().trim();
  const list = DB.users.filter((u) => {
    if (f.role && u.roleId !== f.role) return false;
    if (q && ![u.username, u.name, u.dept].some((v) => String(v).toLowerCase().includes(q))) return false;
    return true;
  });

  const rows = list.map((u) => {
    const role = DB.roles.find((r) => r.id === u.roleId);
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:9px">${avatarHTML(u.name)}<span>${cell2(esc(u.name), esc(u.empId + ' · ' + u.dept))}</span></div></td>
      <td><span class="code">${esc(u.username)}</span></td>
      <td><span class="chip"><i class="fa-solid fa-user-shield"></i>${esc(role ? role.name : '')}</span></td>
      <td class="num hide-sm muted">${esc(u.lastLogin)}</td>
      <td>${u.state === 'active' ? '<span class="badge green">Đang hoạt động</span>' : '<span class="badge red">Đã khóa</span>'}</td>
      <td>${rowActions([
        { act: 'user-role', data: `data-id="${u.id}"`, icon: 'fa-user-pen', title: 'Đổi vai trò' },
        { act: 'user-toggle', data: `data-id="${u.id}"`, icon: u.state === 'active' ? 'fa-lock' : 'fa-lock-open', title: u.state === 'active' ? 'Khóa tài khoản' : 'Mở khóa' },
      ])}</td>
    </tr>`;
  });

  return `
  ${pageHead('Người dùng & phân quyền', `${DB.users.length} tài khoản · ${DB.roles.length} vai trò`, `
    <button class="btn" data-act="export-users"><i class="fa-solid fa-file-export"></i>Export</button>
    <button class="btn btn-primary" data-act="new-user"><i class="fa-solid fa-user-plus"></i>Thêm người dùng</button>
  `)}

  <div class="grid g-auto-sm" style="margin-bottom:14px">
    ${mkpi('Tổng tài khoản', DB.users.length, 'fa-users-gear', 'blue')}
    ${mkpi('Đang hoạt động', DB.users.filter((u) => u.state === 'active').length, 'fa-circle-check', 'green')}
    ${mkpi('Đã khóa', DB.users.filter((u) => u.state !== 'active').length, 'fa-lock', 'red')}
    ${mkpi('Vai trò', DB.roles.length, 'fa-user-shield', 'indigo')}
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="toolbar">
      ${searchBox('users', 'Tìm tên đăng nhập, họ tên…')}
      ${selectFilter('users', 'role', DB.roles.map((r) => [r.id, r.name]), 'Tất cả vai trò')}
      ${(f.q || f.role) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="users"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
      <span class="spacer"></span>
      <span class="chip"><i class="fa-solid fa-list"></i> ${fmtN(list.length)} tài khoản</span>
    </div>
    ${tableShell(
      [{ t: 'Người dùng' }, { t: 'Tên đăng nhập', w: '150px' }, { t: 'Vai trò' }, { t: 'Đăng nhập gần nhất', cls: 'hide-sm' },
       { t: 'Trạng thái', w: '150px' }, { t: 'Thao tác', cls: 'right', w: '92px' }],
      rows, { emptyTitle: 'Không tìm thấy tài khoản' })}
  </div>

  <div class="card">
    <div class="card-head"><div><h3>Ma trận vai trò & quyền hạn</h3><p>Quyền truy cập từng nhóm chức năng trong hệ thống</p></div></div>
    <div class="card-body">
      <div class="grid g-auto-lg">
        ${DB.roles.map((r) => `
          <div class="card" style="background:var(--surface-2)">
            <div class="card-body">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
                <span class="mkpi-ico t-indigo"><i class="fa-solid fa-user-shield"></i></span>
                <div style="min-width:0">
                  <div style="font-weight:700;font-size:13.4px">${esc(r.name)}</div>
                  <div style="font-size:11.6px;color:var(--text-3)">${r.users} người dùng</div>
                </div>
              </div>
              <div style="font-size:12.2px;color:var(--text-2);margin-bottom:10px;line-height:1.55">${esc(r.desc)}</div>
              <div style="display:flex;flex-wrap:wrap;gap:5px">
                ${r.perms.map((p) => `<span class="chip" style="font-size:11px"><i class="fa-solid fa-check" style="color:var(--green)"></i>${esc(p)}</span>`).join('')}
              </div>
            </div>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
};

/* ------------------------------------------------------------ CÀI ĐẶT */
Views.settings = function () {
  const s = DB.settings;
  const c = DB.company;
  return `
  ${pageHead('Cài đặt hệ thống', 'Thông tin doanh nghiệp và tham số vận hành', `
    <button class="btn" data-act="reset-demo"><i class="fa-solid fa-rotate-left"></i>Khôi phục dữ liệu demo</button>
    <button class="btn btn-primary" data-act="settings-save"><i class="fa-solid fa-floppy-disk"></i>Lưu thay đổi</button>
  `)}

  <div class="grid g-2" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><span class="mkpi-ico t-blue"><i class="fa-solid fa-building"></i></span>
        <div><h3>Thông tin doanh nghiệp</h3><p>Hiển thị trên báo giá, hợp đồng và chứng từ in</p></div></div>
      <div class="card-body">
        <div class="field"><label>Tên công ty</label><input class="inp" data-set="name" value="${esc(c.name)}" /></div>
        <div class="form-grid">
          <div class="field"><label>Mã số thuế</label><input class="inp" data-set="tax" value="${esc(c.tax)}" /></div>
          <div class="field"><label>Điện thoại</label><input class="inp" data-set="phone" value="${esc(c.phone)}" /></div>
          <div class="field"><label>Email</label><input class="inp" data-set="email" value="${esc(c.email)}" /></div>
          <div class="field"><label>Website</label><input class="inp" data-set="website" value="${esc(c.website)}" /></div>
        </div>
        <div class="field"><label>Địa chỉ</label><input class="inp" data-set="address" value="${esc(c.address)}" /></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><span class="mkpi-ico t-indigo"><i class="fa-solid fa-sliders"></i></span>
        <div><h3>Tham số nghiệp vụ</h3><p>Áp dụng cho báo giá, đơn hàng và cảnh báo</p></div></div>
      <div class="card-body">
        <div class="form-grid">
          <div class="field"><label>Thuế VAT mặc định (%)</label>
            <select class="inp" data-cfg="vatRate">${[0, 5, 8, 10].map((v) => `<option value="${v}" ${s.vatRate === v ? 'selected' : ''}>${v}%</option>`).join('')}</select></div>
          <div class="field"><label>Hiệu lực báo giá (ngày)</label><input class="inp num" type="number" data-cfg="quoteValidDays" value="${s.quoteValidDays}" /></div>
          <div class="field"><label>Cảnh báo tới hạn trước (ngày)</label><input class="inp num" type="number" data-cfg="dueSoonDays" value="${s.dueSoonDays}" /></div>
          <div class="field"><label>Năm tài chính</label><input class="inp num" type="number" data-cfg="fiscalYear" value="${s.fiscalYear}" /></div>
        </div>
        <div class="setting-row">
          <div><div class="st">Cảnh báo vật tư dưới định mức</div><div class="ss">Hiển thị trên dashboard và menu Vật tư</div></div>
          <div class="sa"><button class="toggle ${s.lowStockAlert ? 'on' : ''}" data-act="toggle-setting" data-key="lowStockAlert"></button></div>
        </div>
        <div class="setting-row">
          <div><div class="st">Tự động tạo lệnh sản xuất</div><div class="ss">Khi đơn hàng chuyển sang trạng thái chờ sản xuất</div></div>
          <div class="sa"><button class="toggle ${s.autoCreatePO ? 'on' : ''}" data-act="toggle-setting" data-key="autoCreatePO"></button></div>
        </div>
        <div class="setting-row">
          <div><div class="st">Gửi email thông báo</div><div class="ss">Thông báo duyệt báo giá, yêu cầu mua hàng</div></div>
          <div class="sa"><button class="toggle ${s.emailNotify ? 'on' : ''}" data-act="toggle-setting" data-key="emailNotify"></button></div>
        </div>
      </div>
    </div>
  </div>

  <div class="grid g-2">
    <div class="card">
      <div class="card-head"><span class="mkpi-ico t-teal"><i class="fa-solid fa-palette"></i></span>
        <div><h3>Giao diện</h3><p>Tùy chọn hiển thị của người dùng hiện tại</p></div></div>
      <div class="card-body">
        <div class="setting-row">
          <div><div class="st">Chế độ tối (Dark mode)</div><div class="ss">Áp dụng cho toàn bộ sidebar, bảng, biểu đồ và popup</div></div>
          <div class="sa"><button class="toggle ${document.documentElement.dataset.theme === 'dark' ? 'on' : ''}" data-act="toggle-theme"></button></div>
        </div>
        <div class="setting-row">
          <div><div class="st">Ngôn ngữ hiển thị</div><div class="ss">Giao diện và chứng từ in</div></div>
          <div class="sa"><select class="inp" style="width:180px"><option>Tiếng Việt</option><option>English</option></select></div>
        </div>
        <div class="setting-row">
          <div><div class="st">Định dạng tiền tệ</div><div class="ss">Áp dụng cho toàn bộ số liệu</div></div>
          <div class="sa"><select class="inp" style="width:180px"><option>VND (₫) — 1.000.000đ</option><option>USD ($)</option></select></div>
        </div>
        <div class="setting-row">
          <div><div class="st">Số dòng mỗi trang</div><div class="ss">Áp dụng cho tất cả bảng dữ liệu</div></div>
          <div class="sa"><select class="inp" style="width:180px"><option>10 dòng</option><option>20 dòng</option><option>50 dòng</option></select></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><span class="mkpi-ico t-orange"><i class="fa-solid fa-database"></i></span>
        <div><h3>Dữ liệu & hệ thống</h3><p>Thông tin phiên bản và dữ liệu demo</p></div></div>
      <div class="card-body">
        <dl class="dl">
          <dt>Phiên bản</dt><dd>VYKO ERP 2.4.0 (bản demo)</dd>
          <dt>Ngày hệ thống</dt><dd>${fmtDate(DB.today)}</dd>
          <dt>Khách hàng</dt><dd>${DB.customers.length} bản ghi</dd>
          <dt>Đơn hàng</dt><dd>${DB.orders.length} bản ghi</dd>
          <dt>Lệnh sản xuất</dt><dd>${DB.productionOrders.length} bản ghi</dd>
          <dt>Vật tư</dt><dd>${DB.materials.length} bản ghi</dd>
          <dt>Nhân sự</dt><dd>${DB.employees.length} bản ghi</dd>
        </dl>
        <div style="margin-top:14px;font-size:12.3px;color:var(--text-3);background:var(--surface-2);border-radius:var(--r);padding:11px 13px;line-height:1.6">
          <i class="fa-solid fa-circle-info" style="color:var(--primary)"></i>
          Bản demo chạy hoàn toàn trên trình duyệt, không kết nối máy chủ. Mọi thay đổi bạn thực hiện (tạo báo giá, duyệt mua hàng, cập nhật tiến độ…) chỉ tồn tại trong phiên làm việc hiện tại — tải lại trang là dữ liệu trở về trạng thái ban đầu.
        </div>
      </div>
    </div>
  </div>`;
};
