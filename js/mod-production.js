/* ============================================================================
 * MODULE: LỆNH SẢN XUẤT & TIẾN ĐỘ SẢN XUẤT
 * Đây là phần lõi nghiệp vụ: mỗi lệnh chạy qua 8 công đoạn, tiến độ được
 * tính từ số lượng thực tế đã qua từng công đoạn.
 * ==========================================================================*/

const STAGE_ICON = {
  'Cắt': 'fa-scissors', 'Tiện': 'fa-circle-notch', 'Phay': 'fa-gear', 'Hàn': 'fa-fire',
  'Sơn': 'fa-spray-can-sparkles', 'Lắp ráp': 'fa-screwdriver-wrench', 'QC': 'fa-clipboard-check', 'Hoàn thành': 'fa-box-open',
};

/** Công đoạn đang chạy của một lệnh */
function currentStage(po) {
  const doing = po.stages.find((s) => s.status === 'doing');
  if (doing) return doing;
  const pending = po.stages.find((s) => s.status === 'pending');
  return pending || po.stages[po.stages.length - 1];
}

Views.production = function () {
  const tab = State.tab || (State.params && State.params.tab);
  if (tab === 'bom') return Views.operations ? Views.operations(State.params) : '';
  if (tab === 'routing' || tab === 'progress') return Views.progress ? Views.progress(State.params) : '';
  if (tab && !['dashboard', 'orders'].includes(tab)) return '';

  const f = F('production', { q: '', status: '', stage: '' });
  if (State.params.filter === 'late') { f.status = ''; State.params.filter = 'late'; }
  const q = (f.q || '').toLowerCase().trim();
  const onlyLate = State.params.filter === 'late';

  let list = DB.productionOrders.filter((p) => {
    if (f.status && p.status !== f.status) return false;
    if (f.stage && currentStage(p).name !== f.stage) return false;
    if (q && ![p.id, p.orderId, p.productName, Q.customerName(p.customerId)].some((v) => String(v).toLowerCase().includes(q))) return false;
    return true;
  });
  if (onlyLate) list = list.filter((p) => p.status !== 'lsx_hoan_thanh' && daysTo(p.deadline) <= 5);
  list.sort((a, b) => b.id.localeCompare(a.id));

  const pg = paged(list, 'production');
  const cnt = (s) => DB.productionOrders.filter((p) => p.status === s).length;

  const rows = pg.items.map((p) => {
    const prog = Q.progress(p);
    const d = daysTo(p.deadline);
    const st = currentStage(p);
    return `<tr class="clickable" data-act="open-po" data-id="${p.id}">
      <td><span class="code">${p.id}</span><div class="cell-sub">${esc(st.name)}</div></td>
      <td class="hide-sm"><span class="code" style="color:var(--text-2)">${p.orderId}</span><div class="cell-sub">${esc(Q.customerName(p.customerId))}</div></td>
      <td>${cell2(esc(p.productName), esc(p.spec))}</td>
      <td class="right num">${fmtN(p.qty)} ${esc(p.unit)}</td>
      <td class="num hide-sm">${fmtDate(p.startDate)}</td>
      <td class="num">${cell2(fmtDate(p.deadline), p.status !== 'lsx_hoan_thanh' ? (d < 0 ? `<span style="color:var(--red)">trễ ${-d} ngày</span>` : d <= 3 ? `<span style="color:var(--orange)">còn ${d} ngày</span>` : `còn ${d} ngày`) : '')}</td>
      <td style="min-width:150px">${progressBar(prog)}</td>
      <td>${badge(p.status)}</td>
    </tr>`;
  });

  return `
  ${pageHead('Lệnh sản xuất', 'Điều hành lệnh sản xuất theo từng công đoạn của xưởng', `
    <button class="btn" data-act="export-po"><i class="fa-solid fa-file-export"></i>Export</button>
    <button class="btn" data-act="go" data-id="progress"><i class="fa-solid fa-diagram-project"></i>Bảng điều hành</button>
    <button class="btn btn-primary" data-act="new-po"><i class="fa-solid fa-plus"></i>Tạo lệnh sản xuất</button>
  `)}

  <div class="grid g-auto-sm" style="margin-bottom:14px">
    ${mkpi('Tổng lệnh', DB.productionOrders.length, 'fa-industry', 'blue')}
    ${mkpi('Chờ sản xuất', cnt('lsx_cho_san_xuat'), 'fa-hourglass-start', 'slate')}
    ${mkpi('Đang sản xuất', cnt('lsx_dang_san_xuat'), 'fa-gears', 'indigo')}
    ${mkpi('Đang QC', cnt('lsx_dang_qc'), 'fa-clipboard-check', 'orange')}
    ${mkpi('Hoàn thành', cnt('lsx_hoan_thanh'), 'fa-circle-check', 'green')}
  </div>

  ${onlyLate ? `<div class="card" style="margin-bottom:14px;border-left:3px solid var(--orange)">
    <div class="card-head">
      <span class="mkpi-ico t-orange"><i class="fa-solid fa-clock"></i></span>
      <div><h3>Đang lọc: lệnh sắp/đã trễ tiến độ</h3><p>${list.length} lệnh có deadline trong 5 ngày tới hoặc đã quá hạn</p></div>
      <div class="right"><button class="btn btn-sm" data-act="clear-filter" data-key="production">Bỏ lọc</button></div>
    </div></div>` : ''}

  <div class="card">
    <div class="toolbar">
      ${searchBox('production', 'Tìm mã LSX, đơn hàng, sản phẩm…')}
      ${selectFilter('production', 'status', statusOptions('lsx_'), 'Tất cả trạng thái')}
      ${selectFilter('production', 'stage', DB.stageNames.map((s) => [s, s]), 'Tất cả công đoạn')}
      ${(f.q || f.status || f.stage || onlyLate) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="production"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
      <span class="spacer"></span>
      <span class="chip"><i class="fa-solid fa-list"></i> ${fmtN(list.length)} lệnh</span>
    </div>
    ${tableShell(
      [{ t: 'Mã LSX', w: '150px' }, { t: 'Đơn hàng', cls: 'hide-sm' }, { t: 'Sản phẩm' }, { t: 'Số lượng', cls: 'right' },
       { t: 'Bắt đầu', cls: 'hide-sm' }, { t: 'Deadline' }, { t: 'Tiến độ', w: '170px' }, { t: 'Trạng thái', w: '132px' }],
      rows, { emptyTitle: 'Không tìm thấy lệnh sản xuất' })}
    ${pagiHTML('production', pg, 'lệnh sản xuất')}
  </div>`;
};

/* ------------------------------------------- CHI TIẾT LỆNH SẢN XUẤT */
Views['production-detail'] = function (params) {
  const p = Q.po(params.id);
  if (!p) return `<div class="empty"><div class="empty-ico"><i class="fa-solid fa-file-circle-xmark"></i></div><h4>Không tìm thấy lệnh sản xuất</h4><button class="btn btn-primary btn-sm" data-act="go" data-id="production">Về danh sách</button></div>`;

  const prog = Q.progress(p);
  const check = Q.materialCheck(p);
  const lacking = check.filter((m) => !m.ok);
  const d = daysTo(p.deadline);
  const order = Q.order(p.orderId);
  const doneQty = p.stages.reduce((s, st) => s + st.qtyDone, 0);
  const totalHours = p.stages.reduce((s, st) => s + st.hours, 0);

  return `
  ${pageHead(`Lệnh sản xuất ${p.id}`, `${esc(p.productName)} · Đơn hàng ${p.orderId} · ${esc(Q.customerName(p.customerId))}`, `
    <button class="btn" data-act="go" data-id="production"><i class="fa-solid fa-arrow-left"></i>Danh sách</button>
    <button class="btn" data-act="export-po-detail" data-id="${p.id}"><i class="fa-solid fa-print"></i>In phiếu SX</button>
    ${p.status !== 'lsx_hoan_thanh' ? `<button class="btn btn-primary" data-act="po-advance" data-id="${p.id}"><i class="fa-solid fa-forward"></i>Cập nhật công đoạn</button>` : ''}
  `)}

  <div class="grid g-31" style="margin-bottom:14px">
    <!-- THÔNG TIN SẢN XUẤT -->
    <div class="card">
      <div class="card-head"><div><h3>Thông tin sản xuất</h3><p>Thông số lệnh và người chịu trách nhiệm</p></div>
        <div class="right">${badge(p.status)}</div></div>
      <div class="card-body">
        <div class="info-grid">
          ${infoItem('Mã lệnh', `<span class="code">${p.id}</span>`)}
          ${infoItem('Đơn hàng', `<span class="code" data-act="open-order" data-id="${p.orderId}" style="cursor:pointer">${p.orderId}</span>`)}
          ${infoItem('Khách hàng', esc(Q.customerName(p.customerId)))}
          ${infoItem('Sản phẩm', esc(p.productName))}
          ${infoItem('Quy cách', esc(p.spec))}
          ${infoItem('Số lượng', `${fmtN(p.qty)} ${esc(p.unit)}`)}
          ${infoItem('Ngày bắt đầu', fmtDate(p.startDate))}
          ${infoItem('Deadline', `${fmtDate(p.deadline)} ${p.status !== 'lsx_hoan_thanh' ? (d < 0 ? `<span style="color:var(--red);font-weight:700">(trễ ${-d} ngày)</span>` : `<span style="color:${d <= 3 ? 'var(--orange)' : 'var(--text-3)'}">(còn ${d} ngày)</span>`) : ''}`)}
          ${infoItem('Người phụ trách', esc(Q.employeeName(p.managerId)))}
          ${infoItem('Tổng giờ máy', fmtDec(totalHours) + ' giờ')}
        </div>
      </div>
    </div>

    <!-- TIẾN ĐỘ TỔNG -->
    <div class="card">
      <div class="card-head"><div><h3>Tiến độ tổng</h3><p>Tính theo sản lượng qua từng công đoạn</p></div></div>
      <div class="card-body" style="display:flex;flex-direction:column;align-items:center;gap:12px">
        <div class="ring-wrap">
          ${Charts.ring(prog)}
          <div class="ring-val"><b>${prog}%</b><span>hoàn thành</span></div>
        </div>
        <div style="text-align:center;font-size:12.6px;color:var(--text-2)">
          Đã qua <b>${fmtN(doneQty)}</b> / ${fmtN(p.qty * p.stages.length)} lượt công đoạn<br/>
          Công đoạn hiện tại: <b style="color:var(--primary)">${esc(currentStage(p).name)}</b>
        </div>
        <div class="stat-strip" style="width:100%">
          <div><div class="l">Đạt QC</div><div class="v" style="color:var(--green)">${fmtN(p.qcPass)}</div></div>
          <div><div class="l">Lỗi</div><div class="v" style="color:${p.qcFail ? 'var(--red)' : 'var(--text-3)'}">${fmtN(p.qcFail)}</div></div>
        </div>
      </div>
    </div>
  </div>

  <!-- KIỂM TRA VẬT TƯ THEO ĐỊNH MỨC -->
  <div class="card" style="margin-bottom:14px;${lacking.length ? 'border-left:3px solid var(--red)' : ''}">
    <div class="card-head">
      <span class="mkpi-ico t-${lacking.length ? 'red' : 'green'}"><i class="fa-solid ${lacking.length ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i></span>
      <div><h3>Kiểm tra vật tư theo định mức (BOM)</h3>
        <p>${lacking.length ? `Thiếu ${lacking.length} vật tư — cần tạo yêu cầu mua hàng trước khi sản xuất tiếp` : 'Vật tư đủ cho toàn bộ lệnh sản xuất'}</p></div>
      <div class="right">
        ${lacking.length ? `<button class="btn btn-sm btn-primary" data-act="po-create-pr" data-id="${p.id}"><i class="fa-solid fa-cart-plus"></i>Tạo yêu cầu mua hàng</button>` : ''}
        <button class="btn btn-sm" data-act="go" data-id="materials"><i class="fa-solid fa-layer-group"></i>Kho vật tư</button>
      </div>
    </div>
    ${tableShell(
      [{ t: 'Mã VT', w: '92px' }, { t: 'Tên vật tư' }, { t: 'Định mức/SP', cls: 'right' }, { t: 'Nhu cầu', cls: 'right' },
       { t: 'Tồn kho', cls: 'right' }, { t: 'Thiếu', cls: 'right' }, { t: 'Tình trạng', w: '120px' }],
      check.map((m) => `<tr>
        <td><span class="code">${m.materialId}</span></td>
        <td class="strong">${esc(m.name)}</td>
        <td class="right num muted">${fmtDec(m.per, 2)} ${esc(m.unit)}</td>
        <td class="right num strong">${fmtDec(m.need, 2)} ${esc(m.unit)}</td>
        <td class="right num">${fmtDec(m.stock, 2)} ${esc(m.unit)}</td>
        <td class="right num" style="color:${m.lack ? 'var(--red)' : 'var(--text-3)'};font-weight:${m.lack ? 700 : 400}">${m.lack ? fmtDec(m.lack, 2) + ' ' + esc(m.unit) : '—'}</td>
        <td>${m.ok ? '<span class="badge green">Đủ</span>' : '<span class="badge red">Thiếu</span>'}</td></tr>`))}
  </div>

  <!-- ĐỊNH MỨC CÔNG ĐOẠN LẤY TỪ BÁO GIÁ -->
  ${(() => {
    const routing = expandRouting((Q.product(p.productId) || {}).routing);
    if (!routing.length) return '';
    const totalHours = routing.reduce((s, o) => s + o.hoursPer, 0);
    const totalCost = routing.reduce((s, o) => s + o.amount, 0);
    return `
    <div class="card" style="margin-bottom:14px">
      <div class="card-head">
        <span class="mkpi-ico t-indigo"><i class="fa-solid fa-gears"></i></span>
        <div><h3>Định mức công đoạn (routing)</h3>
          <p>Bóc tách từ báo giá — ${routing.length} công đoạn · ${fmtDec(totalHours, 2)} giờ/${esc(p.unit)} · ${fmtDec(totalHours * p.qty, 1)} giờ cho cả lệnh</p></div>
        <div class="right"><button class="btn btn-sm" data-act="go" data-id="operations"><i class="fa-solid fa-list"></i>Danh mục công đoạn</button></div>
      </div>
      ${tableShell(
        [{ t: 'Mã CĐ', w: '80px' }, { t: 'Công đoạn' }, { t: 'Phân xưởng' }, { t: 'Máy / thiết bị', cls: 'hide-sm' },
         { t: 'Giờ/SP', cls: 'right' }, { t: 'Tổng giờ', cls: 'right' }, { t: 'Đơn giá giờ', cls: 'right hide-sm' }, { t: 'Chi phí lệnh', cls: 'right' }],
        routing.map((o) => `<tr class="clickable" data-act="open-operation" data-id="${o.operationId}">
          <td><span class="code">${o.operationId}</span></td>
          <td class="strong">${esc(o.name)}</td>
          <td><span class="chip"><i class="fa-solid ${STAGE_ICON[o.workshop] || 'fa-gear'}"></i>${esc(o.workshop)}</span></td>
          <td class="muted hide-sm">${esc(o.machine)}</td>
          <td class="right num">${fmtDec(o.hoursPer, 2)}</td>
          <td class="right num strong">${fmtDec(o.hoursPer * p.qty, 1)}</td>
          <td class="right num muted hide-sm">${fmtVND(o.rate)}</td>
          <td class="right strong num">${fmtVND(o.amount * p.qty)}</td></tr>`))}
      <div class="card-foot" style="display:flex;justify-content:flex-end;gap:24px;font-size:13px">
        <span>Tổng giờ máy định mức: <b class="num">${fmtDec(totalHours * p.qty, 1)} giờ</b></span>
        <span>Chi phí gia công: <b class="num" style="color:var(--indigo)">${fmtVND(totalCost * p.qty)}</b></span>
      </div>
    </div>`;
  })()}

  <!-- QUY TRÌNH SẢN XUẤT DẠNG KANBAN -->
  <div class="card">
    <div class="card-head">
      <div><h3>Quy trình sản xuất — 8 công đoạn</h3><p>Mỗi công đoạn có người phụ trách, máy, thời gian và sản lượng thực tế</p></div>
      <div class="right"><span class="chip"><i class="fa-solid fa-check"></i> ${p.stages.filter((s) => s.status === 'done').length}/8 công đoạn xong</span></div>
    </div>
    <div class="card-body">
      <div class="kanban">
        ${p.stages.map((s, i) => {
          const pct = p.qty ? Math.round((s.qtyDone / p.qty) * 100) : 0;
          const canStart = s.status === 'pending' && (i === 0 || p.stages[i - 1].status === 'done');
          return `<div class="kcol ${s.status}">
            <div class="kcol-head">
              <span class="n">${i + 1}</span>
              <b>${esc(s.name)}</b>
              <span style="margin-left:auto"><i class="fa-solid ${STAGE_ICON[s.name]}" style="color:var(--text-3)"></i></span>
            </div>
            <div class="kcol-body">
              <div>${s.status === 'done' ? '<span class="badge green">Hoàn tất</span>' : s.status === 'doing' ? '<span class="badge blue">Đang chạy</span>' : '<span class="badge slate">Chờ</span>'}</div>
              <div class="kfield"><i class="fa-solid fa-user"></i>${esc(Q.employeeName(s.leadId))}</div>
              <div class="kfield"><i class="fa-solid fa-robot"></i>${esc(s.machine)}</div>
              ${(() => {
                // Các công đoạn trong định mức thuộc phân xưởng này (đến từ báo giá)
                const ops = Q.opsOfStage(p.productId, s.name);
                if (!ops.length) return '';
                const h = ops.reduce((t, o) => t + o.hoursPer, 0);
                return `<div style="background:var(--surface);border:1px dashed var(--border-2);border-radius:7px;padding:6px 8px;font-size:11px;line-height:1.5">
                    <div style="color:var(--text-3);font-weight:700;text-transform:uppercase;letter-spacing:.04em;font-size:9.5px;margin-bottom:3px">Định mức từ báo giá</div>
                    ${ops.map((o) => `<div style="color:var(--text-2)">• ${esc(o.name)} — ${fmtDec(o.hoursPer, 2)}h/${esc(p.unit)}</div>`).join('')}
                    <div style="color:var(--indigo);font-weight:700;margin-top:2px">Σ ${fmtDec(h * p.qty, 1)} giờ cho ${fmtN(p.qty)} ${esc(p.unit)}</div>
                  </div>`;
              })()}
              <div class="kfield"><i class="fa-regular fa-clock"></i>${s.hours ? fmtDec(s.hours) + ' giờ máy thực tế' : 'Chưa phát sinh'}</div>
              <div class="kfield"><i class="fa-solid fa-cubes"></i>${fmtN(s.qtyDone)} / ${fmtN(s.qtyPlan)} ${esc(p.unit)}</div>
              ${s.start ? `<div class="kfield"><i class="fa-regular fa-calendar"></i>${fmtDate(s.start)}${s.end ? ' → ' + fmtDate(s.end) : ''}</div>` : ''}
              <div style="margin-top:2px">${progressBar(pct)}</div>
            </div>
            <div class="kcol-foot">
              ${s.status === 'done' ? '<button class="btn btn-xs" disabled style="width:100%"><i class="fa-solid fa-check"></i>Đã xong</button>'
                : s.status === 'doing' ? `<button class="btn btn-xs btn-primary" style="width:100%" data-act="stage-update" data-id="${p.id}" data-i="${i}"><i class="fa-solid fa-pen"></i>Ghi nhận sản lượng</button>`
                : canStart ? `<button class="btn btn-xs" style="width:100%" data-act="stage-start" data-id="${p.id}" data-i="${i}"><i class="fa-solid fa-play"></i>Bắt đầu</button>`
                : '<button class="btn btn-xs" disabled style="width:100%">Chờ công đoạn trước</button>'}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
    ${order ? `<div class="card-foot" style="display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end">
      <button class="btn btn-sm" data-act="open-order" data-id="${order.id}"><i class="fa-solid fa-cart-flatbed"></i>Xem đơn hàng ${order.id}</button>
      ${p.status === 'lsx_dang_qc' ? `<button class="btn btn-sm btn-success" data-act="po-qc" data-id="${p.id}"><i class="fa-solid fa-clipboard-check"></i>Nghiệm thu QC</button>` : ''}
    </div>` : ''}
  </div>`;
};

/* ------------------------------------------ MODAL GHI NHẬN SẢN LƯỢNG */
function openStageModal(poId, index) {
  const p = Q.po(poId);
  const s = p.stages[index];
  Modal.open({
    title: `Ghi nhận công đoạn: ${esc(s.name)}`,
    sub: `${p.id} · ${esc(p.productName)} · Kế hoạch ${fmtN(s.qtyPlan)} ${esc(p.unit)}`,
    body: `
      <div class="form-grid">
        <div class="field"><label>Sản lượng đã hoàn thành (${esc(p.unit)})</label>
          <input class="inp num" type="number" id="stQty" min="0" max="${s.qtyPlan}" value="${s.qtyDone}" /></div>
        <div class="field"><label>Giờ máy phát sinh</label>
          <input class="inp num" type="number" id="stHours" min="0" step="0.5" value="${s.hours}" /></div>
        <div class="field"><label>Người phụ trách</label>
          <select class="inp" id="stLead">
            ${DB.employees.filter((e) => ['Sản xuất', 'QC/KCS', 'Kho vận'].includes(e.dept) && e.status !== 'ns_nghi_viec').slice(0, 40)
              .map((e) => `<option value="${e.id}" ${s.leadId === e.id ? 'selected' : ''}>${esc(e.name)} — ${esc(e.position)}</option>`).join('')}
          </select></div>
        <div class="field"><label>Máy / trạm</label>
          <input class="inp" id="stMachine" value="${esc(s.machine)}" /></div>
      </div>
      <div class="field"><label>Ghi chú</label>
        <textarea class="inp" id="stNote" rows="2" placeholder="Ví dụ: dừng 30 phút thay dao phay…">${esc(s.note)}</textarea></div>
      <div style="font-size:12.3px;color:var(--text-3);background:var(--surface-2);border-radius:var(--r);padding:10px 12px">
        <i class="fa-solid fa-circle-info" style="color:var(--primary)"></i>
        Khi ghi nhận đủ <b>${fmtN(s.qtyPlan)} ${esc(p.unit)}</b>, công đoạn sẽ tự động chuyển sang trạng thái hoàn tất và mở công đoạn kế tiếp.
      </div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button>
           <button class="btn" data-act="stage-save" data-id="${p.id}" data-i="${index}" data-full="0"><i class="fa-solid fa-floppy-disk"></i>Lưu sản lượng</button>
           <button class="btn btn-primary" data-act="stage-save" data-id="${p.id}" data-i="${index}" data-full="1"><i class="fa-solid fa-check-double"></i>Hoàn tất công đoạn</button>`,
  });
}

/* ============================================================================
 * DANH MỤC CÔNG ĐOẠN SẢN XUẤT
 * Nơi các công đoạn bóc tách từ báo giá được lưu về và tái sử dụng làm định mức.
 * ==========================================================================*/
Views.operations = function () {
  const f = F('operations', { q: '', workshop: '', source: '' });
  if (State.params.filter === 'new') { f.source = 'quote'; State.params.filter = null; }
  const q = (f.q || '').toLowerCase().trim();

  const list = DB.operations.filter((o) => {
    if (f.workshop && o.workshop !== f.workshop) return false;
    if (f.source === 'quote' && !o.source) return false;
    if (f.source === 'base' && o.source) return false;
    if (q && ![o.id, o.name, o.workshop, o.machine].some((v) => String(v).toLowerCase().includes(q))) return false;
    return true;
  });
  const pg = paged(list, 'operations');

  const fromQuote = DB.operations.filter((o) => o.source).length;
  const avgRate = DB.operations.length ? Math.round(DB.operations.reduce((s, o) => s + o.rate, 0) / DB.operations.length) : 0;

  /** Tổng giờ định mức của một công đoạn trên toàn bộ lệnh sản xuất đang chạy */
  const plannedHours = (oid) => DB.productionOrders.reduce((s, po) => {
    const r = (Q.product(po.productId) || {}).routing || [];
    const hit = r.find(([id]) => id === oid);
    return s + (hit ? hit[1] * po.qty : 0);
  }, 0);

  const rows = pg.items.map((o) => {
    const used = Q.productsUsingOp(o.id);
    return `<tr class="clickable" data-act="open-operation" data-id="${o.id}">
      <td><span class="code">${o.id}</span></td>
      <td>${cell2(esc(o.name), esc(o.machine))}</td>
      <td><span class="chip"><i class="fa-solid ${STAGE_ICON[o.workshop] || 'fa-gear'}"></i>${esc(o.workshop)}</span></td>
      <td class="center">${esc(o.unit)}</td>
      <td class="right" onclick="event.stopPropagation()">
        <input class="inp right num" type="number" min="0" step="10000" data-op-rate="${o.id}" value="${o.rate}" style="width:130px" title="Sửa trực tiếp đơn giá giờ" /></td>
      <td class="center num hide-sm">${used.length}</td>
      <td class="right num hide-sm">${fmtDec(plannedHours(o.id), 1)} giờ</td>
      <td class="hide-sm">${esc(Q.employeeName(o.leadId))}</td>
      <td>${o.source
        ? `<span class="badge blue" title="Được khai báo khi lập báo giá ${o.source}">Từ ${esc(o.source)}</span>`
        : '<span class="badge slate">Danh mục gốc</span>'}</td>
    </tr>`;
  });

  return `
  ${pageHead('Công đoạn sản xuất', 'Danh mục công đoạn gia công — nguồn định mức cho báo giá và lệnh sản xuất', `
    <button class="btn" data-act="export-operations"><i class="fa-solid fa-file-export"></i>Export</button>
    <button class="btn btn-primary" data-act="new-quote"><i class="fa-solid fa-file-invoice-dollar"></i>Bóc tách từ báo giá</button>
  `)}

  <div class="grid g-auto-sm" style="margin-bottom:14px">
    ${mkpi('Tổng công đoạn', DB.operations.length, 'fa-gears', 'indigo')}
    ${mkpi('Phân xưởng', new Set(DB.operations.map((o) => o.workshop)).size, 'fa-industry', 'blue')}
    ${mkpi('Đơn giá giờ TB', fmtVND(avgRate), 'fa-tag', 'teal')}
    ${mkpi('Khai báo từ báo giá', fromQuote, 'fa-file-invoice-dollar', fromQuote ? 'green' : 'slate', fromQuote ? 'filter-op-new' : '')}
    ${mkpi('Sản phẩm có định mức', DB.products.filter((p) => (p.routing || []).length).length, 'fa-cube', 'orange')}
  </div>

  <div class="grid g-2" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h3>Đơn giá giờ theo công đoạn</h3><p>Giá giờ máy + nhân công dùng để tính giá thành trong báo giá</p></div></div>
      <div class="card-body"><div class="chart-box"><canvas id="chOpRate"></canvas></div></div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Khối lượng giờ định mức theo phân xưởng</h3><p>Tổng giờ của toàn bộ lệnh sản xuất đang theo dõi</p></div></div>
      <div class="card-body"><div class="chart-box"><canvas id="chOpWorkshop"></canvas></div></div>
    </div>
  </div>

  <div class="card">
    <div class="toolbar">
      ${searchBox('operations', 'Tìm mã, tên công đoạn, máy…')}
      ${selectFilter('operations', 'workshop', DB.workshopNames.map((w) => [w, w]), 'Tất cả phân xưởng')}
      ${selectFilter('operations', 'source', [['base', 'Danh mục gốc'], ['quote', 'Khai báo từ báo giá']], 'Tất cả nguồn')}
      ${(f.q || f.workshop || f.source) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="operations"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
      <span class="spacer"></span>
      <span class="chip"><i class="fa-solid fa-list"></i> ${fmtN(list.length)} công đoạn</span>
    </div>
    ${tableShell(
      [{ t: 'Mã CĐ', w: '84px' }, { t: 'Công đoạn / thiết bị' }, { t: 'Phân xưởng', w: '140px' }, { t: 'ĐVT', cls: 'center', w: '62px' },
       { t: 'Đơn giá giờ', cls: 'right' }, { t: 'SP áp dụng', cls: 'center hide-sm' }, { t: 'Giờ định mức', cls: 'right hide-sm' },
       { t: 'Tổ trưởng', cls: 'hide-sm' }, { t: 'Nguồn', w: '140px' }],
      rows, { emptyTitle: 'Không tìm thấy công đoạn' })}
    ${pagiHTML('operations', pg, 'công đoạn')}
  </div>`;
};

Views.operations.after = function () {
  const ops = [...DB.operations].sort((a, b) => b.rate - a.rate).slice(0, 12);
  Charts.bar('chOpRate', ops.map((o) => o.name.length > 20 ? o.name.slice(0, 19) + '…' : o.name),
    [{ label: 'Đơn giá giờ', data: ops.map((o) => o.rate), color: 'indigo' }], { money: true, horizontal: true });

  const byWs = {};
  DB.productionOrders.forEach((po) => {
    ((Q.product(po.productId) || {}).routing || []).forEach(([oid, h]) => {
      const o = Q.operation(oid);
      if (!o) return;
      byWs[o.workshop] = (byWs[o.workshop] || 0) + h * po.qty;
    });
  });
  const names = DB.workshopNames.filter((w) => byWs[w]);
  Charts.bar('chOpWorkshop', names, [{ label: 'Giờ định mức', data: names.map((w) => Math.round(byWs[w])), color: 'blue' }]);
};

function openOperationModal(id) {
  const o = Q.operation(id);
  if (!o) return;
  const used = Q.productsUsingOp(id);
  const pos = DB.productionOrders.filter((p) => ((Q.product(p.productId) || {}).routing || []).some(([x]) => x === id));

  Modal.open({
    title: `${esc(o.name)}`,
    sub: `${o.id} · Phân xưởng ${esc(o.workshop)} · ${esc(o.machine)}`,
    size: 'md',
    body: `
      <div class="grid g-auto-sm" style="margin-bottom:16px">
        ${mkpi('Đơn giá giờ', fmtVND(o.rate), 'fa-tag', 'indigo')}
        ${mkpi('Sản phẩm áp dụng', used.length, 'fa-cube', 'blue')}
        ${mkpi('Lệnh SX liên quan', pos.length, 'fa-industry', 'orange')}
        ${mkpi('Nguồn', o.source ? 'Báo giá' : 'Danh mục gốc', 'fa-file-invoice-dollar', o.source ? 'green' : 'slate')}
      </div>

      <div class="form-sec-title"><i class="fa-solid fa-circle-info"></i>Thông tin công đoạn</div>
      <div class="info-grid" style="margin-bottom:18px">
        ${infoItem('Mã công đoạn', `<span class="code">${o.id}</span>`)}
        ${infoItem('Phân xưởng', esc(o.workshop))}
        ${infoItem('Máy / thiết bị', esc(o.machine))}
        ${infoItem('Đơn vị tính', esc(o.unit))}
        ${infoItem('Tổ trưởng phụ trách', esc(Q.employeeName(o.leadId)))}
        ${infoItem('Nguồn khai báo', o.source ? `Bóc tách từ báo giá <span class="code">${esc(o.source)}</span>` : 'Danh mục ban đầu của hệ thống')}
      </div>

      <div class="form-sec-title"><i class="fa-solid fa-cube"></i>Sản phẩm đang dùng công đoạn này</div>
      ${tableShell(
        [{ t: 'Mã SP', w: '84px' }, { t: 'Sản phẩm' }, { t: 'Giờ / SP', cls: 'right' }, { t: 'Chi phí / SP', cls: 'right' }],
        used.map((p) => {
          const h = (p.routing.find(([x]) => x === id) || [0, 0])[1];
          return `<tr>
            <td><span class="code">${p.id}</span></td>
            <td class="strong">${esc(p.name)}</td>
            <td class="right num">${fmtDec(h, 2)} giờ</td>
            <td class="right strong num">${fmtVND(h * o.rate)}</td></tr>`;
        }),
        { emptyTitle: 'Chưa sản phẩm nào dùng', emptyDesc: 'Công đoạn này sẽ được gắn vào sản phẩm khi bóc tách báo giá.' })}`,
    foot: `<button class="btn" data-act="modal-close">Đóng</button>
           <button class="btn" data-act="go" data-id="production"><i class="fa-solid fa-industry"></i>Lệnh sản xuất</button>`,
  });
}

/* ------------------------------------------------- TIẾN ĐỘ SẢN XUẤT */
Views.progress = function () {
  const f = F('progress', { stage: '', status: '' });
  const active = DB.productionOrders.filter((p) => p.status !== 'lsx_hoan_thanh');
  const late = active.filter((p) => daysTo(p.deadline) < 0);
  const soon = active.filter((p) => { const d = daysTo(p.deadline); return d >= 0 && d <= 3; });
  const avg = active.length ? Math.round(active.reduce((s, p) => s + Q.progress(p), 0) / active.length) : 0;

  // Nhóm các lệnh đang chạy theo công đoạn hiện tại
  const byStage = DB.stageNames.map((name) => ({
    name,
    items: active.filter((p) => currentStage(p).name === name),
  }));

  return `
  ${pageHead('Tiến độ sản xuất', 'Bảng điều hành xưởng theo công đoạn và năng lực máy', `
    <button class="btn" data-act="go" data-id="production"><i class="fa-solid fa-list"></i>Danh sách lệnh</button>
    <button class="btn" data-act="export-progress"><i class="fa-solid fa-file-export"></i>Xuất tiến độ</button>
  `)}

  <div class="grid g-auto-sm" style="margin-bottom:14px">
    ${mkpi('Lệnh đang chạy', active.length, 'fa-gears', 'blue')}
    ${mkpi('Tiến độ trung bình', avg + '%', 'fa-gauge-high', avg >= 60 ? 'green' : 'orange')}
    ${mkpi('Sắp tới hạn (≤3 ngày)', soon.length, 'fa-hourglass-half', 'orange')}
    ${mkpi('Đã trễ deadline', late.length, 'fa-triangle-exclamation', late.length ? 'red' : 'slate')}
    ${mkpi('Sản lượng tháng', fmtN(DB.workshops.reduce((s, w) => s + w.output, 0)) + ' giờ máy', 'fa-industry', 'indigo')}
  </div>

  <div class="grid g-2" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h3>Năng lực phân xưởng</h3><p>Giờ máy đã dùng / năng lực tối đa tháng 08/2026</p></div></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:13px">
        ${DB.workshops.map((w) => {
          const pct = Math.round((w.output / w.capacity) * 100);
          return `<div>
            <div style="display:flex;justify-content:space-between;font-size:12.6px;margin-bottom:5px">
              <b>${esc(w.name)}</b>
              <span class="muted num">${fmtN(w.output)} / ${fmtN(w.capacity)} giờ · <b style="color:${pct >= 90 ? 'var(--red)' : pct >= 75 ? 'var(--orange)' : 'var(--green)'}">${pct}%</b></span>
            </div>
            <div class="bar ${pct >= 90 ? 'red' : pct >= 75 ? 'orange' : 'green'}"><span style="width:${pct}%"></span></div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><h3>Tiến độ các lệnh đang chạy</h3><p>So sánh % hoàn thành giữa các lệnh sản xuất</p></div></div>
      <div class="card-body"><div class="chart-box"><canvas id="chProgress"></canvas></div></div>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <div><h3>Bảng điều hành theo công đoạn</h3><p>Lệnh sản xuất đang nằm ở từng công đoạn của xưởng</p></div>
      <div class="right"><span class="chip"><i class="fa-solid fa-industry"></i> ${active.length} lệnh đang chạy</span></div>
    </div>
    <div class="card-body">
      <div class="kanban">
        ${byStage.map((col, i) => `
          <div class="kcol ${col.items.length ? 'doing' : ''}">
            <div class="kcol-head">
              <span class="n">${col.items.length}</span><b>${esc(col.name)}</b>
              <span style="margin-left:auto"><i class="fa-solid ${STAGE_ICON[col.name]}" style="color:var(--text-3)"></i></span>
            </div>
            <div class="kcol-body">
              ${col.items.length ? col.items.map((p) => {
                const d = daysTo(p.deadline);
                return `<div class="alert-item" style="flex-direction:column;align-items:stretch;gap:6px;padding:10px" data-act="open-po" data-id="${p.id}">
                  <div style="display:flex;align-items:center;gap:7px">
                    <span class="code" style="font-size:12px">${p.id}</span>
                    ${d < 0 ? '<span class="badge red no-dot" style="margin-left:auto;font-size:10px">Trễ</span>' : d <= 3 ? '<span class="badge orange no-dot" style="margin-left:auto;font-size:10px">Gấp</span>' : ''}
                  </div>
                  <div style="font-size:12px;font-weight:600;line-height:1.35">${esc(p.productName)}</div>
                  <div style="font-size:11.2px;color:var(--text-3)">${fmtN(p.qty)} ${esc(p.unit)} · ${esc(Q.customerName(p.customerId))}</div>
                  ${progressBar(Q.progress(p))}
                </div>`;
              }).join('') : '<div style="text-align:center;padding:16px 0;font-size:11.8px;color:var(--text-3)">Không có lệnh</div>'}
            </div>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
};

Views.progress.after = function () {
  const active = DB.productionOrders.filter((p) => p.status !== 'lsx_hoan_thanh').slice(0, 12);
  Charts.bar('chProgress', active.map((p) => p.id.replace('LSX-2026-', '#')), [
    // Màu theo mức độ hoàn thành: đỏ (chậm) → cam → xanh
    { label: '% hoàn thành', data: active.map((p) => Q.progress(p)),
      colorFn: (pal) => active.map((p) => { const v = Q.progress(p); return v >= 70 ? pal.green : v >= 40 ? pal.blue : pal.orange; }) },
  ], { horizontal: true });
};
