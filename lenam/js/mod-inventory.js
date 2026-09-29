/* ============================================================================
 * MODULE: VẬT TƯ — TỒN KHO — MUA SẮM
 * ==========================================================================*/

function inventoryMasterItem(id) {
  return Q.material(id) || (DB.semiFinishedProducts || []).find((x) => x.id === id) || Q.product(id);
}
function inventoryItemCategory(item, type) {
  if (!item) return '';
  if (type === 'RAW_MATERIAL') return item.group || item.category || '';
  return item.category || (type === 'SEMI_FINISHED' ? 'Bán thành phẩm' : 'Thành phẩm');
}
function inventoryCategories(type) {
  const configured = (DB.itemCategories || []).filter((c) => c.type === type && c.status !== 'inactive').map((c) => c.name);
  const derived = type === 'RAW_MATERIAL'
    ? (DB.materials || []).map((x) => x.group)
    : type === 'SEMI_FINISHED'
      ? (DB.semiFinishedProducts || []).map((x) => x.category)
      : (DB.products || []).map((x) => x.category);
  return [...new Set([...configured, ...derived].filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'vi'));
}

/* ------------------------------------------------------------ VẬT TƯ */
Views.materials = function () {
  const f = F('materials', { q: '', group: '', status: '' });
  if (State.params.filter === 'low') { f.status = 'vt_sap_het'; State.params.filter = null; }
  const q = (f.q || '').toLowerCase().trim();
  const list = DB.materials.filter((m) => {
    if (f.group && m.group !== f.group) return false;
    if (f.status && m.status !== f.status) return false;
    if (q && ![m.id, m.name, m.group, m.unit].some((v) => String(v || '').toLowerCase().includes(q))) return false;
    return true;
  });
  const pg = paged(list, 'materials');
  const groups = inventoryCategories('RAW_MATERIAL').map((g) => [g, g]);
  const cnt = (s) => DB.materials.filter((m) => m.status === s).length;

  const rows = pg.items.map((m) => {
    const pct = m.minStock ? Math.min(100, Math.round((Number(m.stock||0) / (m.minStock * 2)) * 100)) : 100;
    return `<tr class="clickable" data-act="open-material" data-id="${m.id}">
      <td><span class="code">${m.id}</span></td>
      <td><div class="strong">${esc(m.name)}</div><div class="cell-sub">Master nguyên liệu</div></td>
      <td class="hide-sm"><span class="chip">${esc(m.group || 'Chưa phân loại')}</span></td>
      <td class="center">${esc(m.unit)}</td>
      <td class="right"><div class="strong num">${fmtDec(Number(m.stock||0), 2)}</div><div class="bar ${Number(m.stock||0) <= 0 ? 'red' : Number(m.stock||0) < Number(m.minStock||0) ? 'orange' : 'green'}" style="margin-top:4px"><span style="width:${pct}%"></span></div></td>
      <td class="right num muted">${fmtDec(Number(m.minStock||0), 2)}</td>
      <td class="right num hide-sm">${fmtVND(Number(m.price||0))}</td>
      <td class="right num hide-sm">${fmtVND(Number(m.value||0))}</td>
      <td>${badge(m.status)}</td>
      <td>${rowActions([
        { act: 'open-material', data: `data-id="${m.id}"`, icon: 'fa-eye', title: 'Xem chi tiết' },
        { act: 'material-edit', data: `data-id="${m.id}"`, icon: 'fa-pen', title: 'Sửa nguyên liệu' },
        { act: 'material-delete', data: `data-id="${m.id}"`, icon: 'fa-trash', title: 'Xóa nguyên liệu' },
        { act: 'stock-move', data: `data-id="${m.id}"`, icon: 'fa-right-left', title: 'Nhập / xuất kho' },
        ...(Number(m.stock||0) < Number(m.minStock||0) ? [{ act: 'material-request', data: `data-id="${m.id}"`, icon: 'fa-cart-plus', title: 'Tạo yêu cầu mua' }] : []),
      ])}</td>
    </tr>`;
  });

  return `
  ${pageHead('Quản lý vật tư', `${DB.materials.length} mã vật tư · Giá trị tồn ${fmtShort(Q.inventoryValue())}`, `
    <button class="btn" data-act="import-data" data-what="vật tư"><i class="fa-solid fa-file-import"></i>Import</button>
    <button class="btn" data-act="export-materials"><i class="fa-solid fa-file-export"></i>Export</button>
    <button class="btn" data-act="item-category-manager" data-type="RAW_MATERIAL"><i class="fa-solid fa-tags"></i>Danh mục nguyên liệu</button>
    <button class="btn btn-primary" data-act="new-material"><i class="fa-solid fa-plus"></i>Thêm vật tư</button>
  `)}

  <div class="grid g-auto-sm" style="margin-bottom:14px">
    ${mkpi('Tổng vật tư', DB.materials.length, 'fa-layer-group', 'blue')}
    ${mkpi('Đủ tồn', cnt('vt_du_ton'), 'fa-circle-check', 'green')}
    ${mkpi('Sắp hết', cnt('vt_sap_het'), 'fa-triangle-exclamation', 'orange')}
    ${mkpi('Hết hàng', cnt('vt_het_hang'), 'fa-circle-xmark', 'red')}
    ${mkpi('Giá trị tồn kho', fmtShort(Q.inventoryValue()), 'fa-warehouse', 'teal')}
  </div>

  <div class="card">
    <div class="toolbar">
      ${searchBox('materials', 'Tìm mã, tên, danh mục nguyên liệu…')}
      ${selectFilter('materials', 'group', groups, 'Tất cả danh mục')}
      ${selectFilter('materials', 'status', statusOptions('vt_'), 'Tất cả tình trạng')}
      ${(f.q || f.group || f.status) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="materials"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
      <span class="spacer"></span>
      <span class="chip"><i class="fa-solid fa-list"></i> ${fmtN(list.length)} vật tư</span>
    </div>
    ${tableShell(
      [{ t: 'Mã VT', w: '100px' }, { t: 'Tên nguyên liệu' }, { t: 'Danh mục', cls: 'hide-sm' }, { t: 'ĐVT', cls: 'center', w: '62px' },
       { t: 'Tồn kho', cls: 'right', w: '128px' }, { t: 'Tồn tối thiểu', cls: 'right' }, { t: 'Đơn giá', cls: 'right hide-sm' },
       { t: 'Giá trị tồn', cls: 'right hide-sm' }, { t: 'Trạng thái', w: '120px' }, { t: 'Thao tác', cls: 'right', w: '118px' }],
      rows, { emptyTitle: 'Không tìm thấy vật tư' })}
    ${pagiHTML('materials', pg, 'vật tư')}
  </div>`;
};

function openMaterialModal(id) {
  const m = Q.material(id);
  if (!m) return;
  const moves = DB.stockMoves.filter((x) => x.materialId === id);
  const usedIn = DB.products.filter((p) => (p.bom || []).some(([mid]) => mid === id));
  const stockRows = (DB.inventory || []).filter((r) => r.productId === id && Number(r.qtyOnHand || 0) !== 0);

  Modal.open({
    title: `${esc(m.name)}`,
    sub: `${m.id} · ${esc(m.group || 'Chưa phân loại')}`,
    size: 'md',
    body: `
      <div class="grid g-auto-sm" style="margin-bottom:16px">
        ${mkpi('Tồn kho hiện tại', fmtDec(Number(m.stock||0), 2) + ' ' + m.unit, 'fa-boxes-stacked', Number(m.stock||0) <= 0 ? 'red' : Number(m.stock||0) < Number(m.minStock||0) ? 'orange' : 'green')}
        ${mkpi('Tồn tối thiểu', fmtDec(Number(m.minStock||0), 2) + ' ' + m.unit, 'fa-arrow-down-short-wide', 'slate')}
        ${mkpi('Đơn giá tham chiếu', fmtVND(Number(m.price||0)), 'fa-tag', 'blue')}
        ${mkpi('Giá trị tồn', fmtShort(Number(m.value||0)), 'fa-sack-dollar', 'teal')}
      </div>
      <div class="form-sec-title"><i class="fa-solid fa-circle-info"></i>Thông tin master</div>
      <div class="info-grid" style="margin-bottom:18px">
        ${infoItem('Danh mục', esc(m.group || '—'))}
        ${infoItem('Đơn vị tính', esc(m.unit || '—'))}
        ${infoItem('Tình trạng', badge(m.status))}
        ${infoItem('Dùng cho', usedIn.length ? usedIn.map((p) => esc(p.name)).join(', ') : '<span class="muted">Chưa gắn định mức</span>')}
      </div>
      <div class="form-sec-title"><i class="fa-solid fa-location-dot"></i>Vị trí tồn thực tế</div>
      ${tableShell([{t:'Kho'},{t:'Vị trí'},{t:'Lô'},{t:'Số lượng',cls:'right'}], stockRows.map(r=>`<tr><td>${esc(Q.warehouseName(r.warehouseId))}</td><td>${esc(Q.locationName(r.locationId)||'—')}</td><td><span class="code">${esc(Q.lot(r.lotId)?.lotNumber||r.lotId||'—')}</span></td><td class="right num">${fmtN(Number(r.qtyOnHand||0))} ${esc(r.unit||m.unit)}</td></tr>`), {emptyTitle:'Chưa có tồn kho',emptyDesc:'Vị trí chỉ được xác định khi hàng được nhập kho.'})}
      <div class="form-sec-title" style="margin-top:18px"><i class="fa-solid fa-right-left"></i>Lịch sử nhập xuất gần đây</div>
      ${tableShell(
        [{ t: 'Chứng từ' }, { t: 'Loại' }, { t: 'Ngày' }, { t: 'Số lượng', cls: 'right' }, { t: 'Tham chiếu' }],
        moves.map((x) => `<tr>
          <td><span class="code">${x.id}</span></td>
          <td>${x.type === 'in' ? '<span class="badge green">Nhập kho</span>' : '<span class="badge orange">Xuất kho</span>'}</td>
          <td class="num">${fmtDate(x.date)}</td>
          <td class="right strong num" style="color:${x.type === 'in' ? 'var(--green)' : 'var(--orange)'}">${x.type === 'in' ? '+' : '−'}${fmtN(x.qty)}</td>
          <td class="muted">${esc(x.ref)}</td></tr>`),
        { emptyTitle: 'Chưa có giao dịch', emptyDesc: 'Vật tư này chưa phát sinh nhập xuất trong kỳ.' })}`,
    foot: `<button class="btn" data-act="modal-close">Đóng</button>
           <button class="btn" data-act="material-edit" data-id="${m.id}"><i class="fa-solid fa-pen"></i>Sửa</button>
           <button class="btn" data-act="stock-move" data-id="${m.id}"><i class="fa-solid fa-right-left"></i>Nhập / xuất kho</button>
           ${Number(m.stock||0) < Number(m.minStock||0) ? `<button class="btn btn-primary" data-act="material-request" data-id="${m.id}"><i class="fa-solid fa-cart-plus"></i>Tạo yêu cầu mua</button>` : ''}`,
  });
}


function inventoryCategoryCodePrefix(type, categoryName) {
  const cat = (DB.itemCategories || []).find((c) => c.type === type && String(c.name) === String(categoryName));
  if (cat?.codePrefix) return String(cat.codePrefix).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const normalized = String(categoryName || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (!words.length) return type === 'RAW_MATERIAL' ? 'NVL' : type === 'SEMI_FINISHED' ? 'BTP' : 'TP';
  const prefix = words.length === 1 ? words[0].slice(0, 3) : words.map((w) => w[0]).join('').slice(0, 6);
  return prefix || (type === 'RAW_MATERIAL' ? 'NVL' : type === 'SEMI_FINISHED' ? 'BTP' : 'TP');
}

function nextInventoryMasterCode(type, categoryName) {
  const prefix = inventoryCategoryCodePrefix(type, categoryName);
  const all = [
    ...(DB.materials || []),
    ...(DB.semiFinishedProducts || []),
    ...(DB.products || []),
  ];
  let max = 0;
  const rx = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}-(\\d+)$`, 'i');
  all.forEach((x) => {
    const m = String(x.id || '').match(rx);
    if (m) max = Math.max(max, Number(m[1]) || 0);
  });
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

function supplierMatchesCategory(supplier, categoryName) {
  if (!supplier || !categoryName) return false;
  const groups = Array.isArray(supplier.groups) ? supplier.groups : [supplier.group];
  return groups.filter(Boolean).some((g) => String(g).trim().toLowerCase() === String(categoryName).trim().toLowerCase());
}

function inventorySuppliersForCategory(categoryName) {
  return (DB.suppliers || []).filter((supplier) => supplierMatchesCategory(supplier, categoryName));
}

function locationZoneLabel(location) {
  if (!location) return '';
  if (location.zone) return String(location.zone);
  if (location.parentLocation) {
    const parent = (DB.warehouseLocations || []).find((x) => x.id === location.parentLocation);
    if (parent) return parent.name || parent.code || parent.id;
  }
  const code = String(location.code || '');
  const m = code.match(/-([A-Z]+)\d*$/i);
  if (m) return `Khu ${m[1].toUpperCase()}`;
  const name = String(location.name || '');
  const n = name.match(/Kệ\s+([A-Z]+)/i);
  return n ? `Khu ${n[1].toUpperCase()}` : 'Khu chung';
}

function inventoryZonesOf(warehouseId) {
  return [...new Set((Q.locationsOf(warehouseId) || []).map(locationZoneLabel).filter(Boolean))];
}

function inventoryShelfOptions(warehouseId, zone, selectedLocationId = '') {
  return (Q.locationsOf(warehouseId) || [])
    .filter((l) => !zone || locationZoneLabel(l) === zone)
    .map((l) => `<option value="${esc(l.id)}" ${String(selectedLocationId) === String(l.id) ? 'selected' : ''}>${esc(l.name)} · ${esc(l.code || '')}</option>`)
    .join('');
}

function openInventoryItemForm(type = 'RAW_MATERIAL', id = '') {
  const isRaw = type === 'RAW_MATERIAL';
  const isSemi = type === 'SEMI_FINISHED';
  const source = isRaw ? DB.materials : isSemi ? [...(DB.semiFinishedProducts || []), ...(DB.products || [])] : DB.products;
  const item = id ? source.find((x) => x.id === id) : null;
  const typeLabel = isRaw ? 'nguyên liệu' : isSemi ? 'bán thành phẩm' : 'thành phẩm';
  const cats = inventoryCategories(type);
  const category = inventoryItemCategory(item, type);
  const generatedCode = item?.id || (category ? nextInventoryMasterCode(type, category) : 'Chọn danh mục để sinh mã');

  Modal.open({
    title: item ? `Sửa ${typeLabel}` : `Thêm ${typeLabel}`,
    sub: item ? `${item.id} · Cập nhật thông tin master` : `Chỉ khai báo master hàng hóa; tồn kho chỉ phát sinh khi nhập kho thực tế`,
    size: 'md',
    body: `<div class="form-grid">
      <div class="field"><label>Mã ${typeLabel}</label><input class="inp code" id="invItemId" value="${esc(generatedCode)}" disabled><div class="cell-sub" style="margin-top:5px">Mã tự sinh theo mã viết tắt của danh mục, ví dụ BB-0001, NLC-0001.</div></div>
      <div class="field"><label>Tên ${typeLabel} <span class="req">*</span></label><input class="inp" id="invItemName" value="${esc(item?.name || '')}" placeholder="Ví dụ: Ly nhựa 500ml"></div>
      <div class="field"><label>Danh mục <span class="req">*</span></label><select class="inp" id="invItemCategory"><option value="">-- Chọn danh mục --</option>${cats.map(c=>`<option value="${esc(c)}" ${category===c?'selected':''}>${esc(c)}</option>`).join('')}</select><div class="cell-sub" style="margin-top:6px">Chưa có danh mục? Đóng form và chọn nút <b>Danh mục nguyên liệu</b> trên màn hình Quản lý vật tư.</div></div>
      <div class="field"><label>Đơn vị tính <span class="req">*</span></label><input class="inp" id="invItemUnit" value="${esc(item?.unit || '')}" placeholder="Kg / Cái / Hộp..."></div>
      <div class="field"><label>Đơn giá tham chiếu</label><input class="inp right num" id="invItemPrice" type="text" inputmode="numeric" autocomplete="off" value="${item ? fmtN(Number(item?.price || 0)) : ''}" placeholder="Ví dụ: 12.000"><div class="cell-sub" style="margin-top:5px">Nhập 12000, hệ thống sẽ hiển thị 12.000. Giá mua thực tế lấy theo báo giá/PO.</div></div>
      <div class="field"><label>Tồn kho tối thiểu</label><input class="inp right num" id="invItemMinStock" type="number" min="0" value="${item ? Number(isRaw ? item?.minStock || 0 : type==='FINISHED_GOODS' ? DB.finishedMinStock?.[item?.id] || 0 : item?.minStock || 0) : ''}" placeholder="0"></div>
      ${!isRaw ? `<div class="field" style="grid-column:1/-1"><label>Quy cách / mô tả</label><input class="inp" id="invItemSpec" value="${esc(item?.spec || '')}" placeholder="Quy cách sản phẩm"></div>` : ''}
    </div>
    <div class="alert info" style="margin-top:12px"><i class="fa-solid fa-circle-info"></i><span>${item ? 'Sửa master không tự thay đổi số lượng tồn kho.' : `Sau khi lưu, ${typeLabel} mới có tồn = 0. Hệ thống chưa gán nhà cung cấp, kho, khu hay kệ. Các thông tin đó chỉ phát sinh khi mua/nhập kho hoặc sản xuất nhập kho.`}</span></div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button><button class="btn btn-primary" data-act="inventory-item-save" data-type="${type}" data-id="${esc(item?.id || '')}"><i class="fa-solid fa-floppy-disk"></i>Lưu ${typeLabel}</button>`
  });
}

function openInventoryMasterDetail(type, id) {
  if (type === 'RAW_MATERIAL') return openMaterialModal(id);
  const item = inventoryMasterItem(id); if (!item) return;
  const rows = DB.inventory.filter((r)=>r.productId===id);
  const qty = rows.reduce((sum,r)=>sum+Number(r.qtyOnHand||0),0);
  const typeLabel = type === 'SEMI_FINISHED' ? 'Bán thành phẩm' : 'Thành phẩm';
  Modal.open({
    title: esc(item.name || id), sub: `${id} · ${typeLabel} · ${esc(inventoryItemCategory(item,type)||'Chưa phân loại')}`, size:'md',
    body:`<div class="info-grid">${infoItem('Mã hàng',`<span class="code">${esc(id)}</span>`)}${infoItem('Danh mục',esc(inventoryItemCategory(item,type)||'—'))}${infoItem('Đơn vị tính',esc(item.unit||'—'))}${infoItem('Đơn giá',fmtVND(Number(item.price||0)))}${infoItem('Tổng tồn',`<b class="num">${fmtN(qty)} ${esc(item.unit||'')}</b>`)}${infoItem('Quy cách',esc(item.spec||'—'))}</div>
      <div class="form-sec-title"><i class="fa-solid fa-warehouse"></i>Tồn theo kho/lô</div>${tableShell([{t:'Kho'},{t:'Lô'},{t:'Số lượng',cls:'right'}],rows.map(r=>`<tr><td>${esc(Q.warehouseName(r.warehouseId))}</td><td><span class="code">${esc(Q.lot(r.lotId)?.lotNumber||'—')}</span></td><td class="right num">${fmtN(r.qtyOnHand)} ${esc(r.unit||item.unit||'')}</td></tr>`),{emptyTitle:'Chưa phát sinh tồn kho'})}`,
    foot:`<button class="btn" data-act="modal-close">Đóng</button><button class="btn btn-primary" data-act="inventory-item-edit" data-type="${type}" data-id="${esc(id)}"><i class="fa-solid fa-pen"></i>Sửa</button>`
  });
}

function openItemCategoryManager(type='RAW_MATERIAL') {
  const labels={RAW_MATERIAL:'Danh mục nguyên liệu',SEMI_FINISHED:'Danh mục bán thành phẩm',FINISHED_GOODS:'Danh mục thành phẩm'};
  const cats=(DB.itemCategories||[]).filter(c=>c.type===type && c.status!=='inactive');
  Modal.open({title:labels[type]||'Danh mục hàng hóa',sub:'Tạo danh mục trước, sau đó hệ thống dùng mã viết tắt để tự sinh mã hàng.',size:'lg',body:`
    <div data-category-manager-type="${type}"></div>
    <div class="form-grid" style="align-items:end;margin-bottom:14px">
      <div class="field"><label>Tên danh mục</label><input class="inp" id="newItemCategoryName" placeholder="Ví dụ: Bao bì"></div>
      <div class="field"><label>Mã viết tắt</label><input class="inp" id="newItemCategoryPrefix" maxlength="8" placeholder="Ví dụ: BB"><div class="cell-sub" style="margin-top:5px">Có thể để trống để hệ thống tự gợi ý.</div></div>
      <div class="field"><button type="button" class="btn btn-primary" data-act="item-category-add" data-type="${type}"><i class="fa-solid fa-plus"></i>Thêm danh mục</button></div>
    </div>
    ${tableShell([{t:'Mã danh mục'},{t:'Tên danh mục'},{t:'Mã viết tắt'},{t:'Ví dụ mã hàng'},{t:'',cls:'right'}],cats.map(c=>{const prefix=inventoryCategoryCodePrefix(type,c.name);return `<tr><td><span class="code">${esc(c.id)}</span></td><td class="strong">${esc(c.name)}</td><td><input class="inp category-prefix-input" data-id="${esc(c.id)}" value="${esc(prefix)}" maxlength="8" style="width:100px;text-transform:uppercase"></td><td><span class="code">${esc(prefix)}-0001</span></td><td class="right">${rowActions([{act:'item-category-prefix-save',data:`data-id="${esc(c.id)}"`,icon:'fa-floppy-disk',title:'Lưu mã viết tắt'},{act:'item-category-delete',data:`data-id="${esc(c.id)}"`,icon:'fa-trash',title:'Xóa danh mục'}])}</td></tr>`}),{emptyTitle:'Chưa có danh mục'})}`,
    foot:'<button class="btn" data-act="modal-close">Đóng</button>'});
}

// /** Phiếu nhập / xuất kho thủ công */
// function openStockMoveModal(id) {
//   const m = Q.material(id);
//   Modal.open({
//     title: 'Phiếu nhập / xuất kho',
//     sub: `${m.id} · ${esc(m.name)} · Tồn hiện tại ${fmtDec(m.stock, 2)} ${esc(m.unit)}`,
//     body: `<div class="form-grid">
//         <div class="field"><label>Loại phiếu</label>
//           <select class="inp" id="smType"><option value="in">Nhập kho</option><option value="out">Xuất kho</option></select></div>
//         <div class="field"><label>Số lượng (${esc(m.unit)}) <span class="req">*</span></label>
//           <input class="inp num" type="number" id="smQty" min="0" step="0.01" value="" placeholder="0" /></div>
//         <div class="field"><label>Ngày chứng từ</label><input class="inp" type="date" id="smDate" value="${DB.today}" /></div>
//         <div class="field"><label>Tham chiếu</label><input class="inp" id="smRef" placeholder="LSX-2026-0048 / YCM-2026-0046" /></div>
//       </div>
//       <div class="field"><label>Diễn giải</label><textarea class="inp" id="smNote" rows="2" placeholder="Xuất vật tư cho lệnh sản xuất…"></textarea></div>`,
//     foot: `<button class="btn" data-act="modal-close">Hủy</button>
//            <button class="btn btn-primary" data-act="stock-move-save" data-id="${m.id}"><i class="fa-solid fa-floppy-disk"></i>Ghi phiếu</button>`,
//   });
// }

/* ------------------------------------------------------------ TỒN KHO */
Views.inventory = function () {
  const f = F('inventory', { q: '', stockTab: 'raw', warehouse: '', category: '', expandedProductId: '' });
  const q = (f.q || '').toLowerCase().trim();
  const stockTab = f.stockTab || 'raw';
  const stockTabConfig = {
    raw: { label: 'Kho nguyên liệu', type: 'RAW_MATERIAL', icon: 'fa-seedling', itemLabel: 'Nguyên liệu' },
    semi: { label: 'Kho bán thành phẩm', type: 'SEMI_FINISHED', icon: 'fa-cubes-stacked', itemLabel: 'Bán thành phẩm' },
    finished: { label: 'Kho thành phẩm', type: 'FINISHED_GOODS', icon: 'fa-box', itemLabel: 'Thành phẩm' },
  };
  const cfg = stockTabConfig[stockTab] || stockTabConfig.raw;
  const finishedMinStock = DB.finishedMinStock || {};
  // Chỉ đổi nhãn hiển thị trong Tồn kho: Kho = địa điểm vật lý, Kệ = Khu + Kệ.
  // Không thay đổi warehouseId/locationId hay logic nghiệp vụ đang dùng ở các màn khác.
  const inventoryWarehouseLabel = (warehouseId) => {
    const wh = Q.warehouse(warehouseId);
    if (!wh) return '—';
    const place = String(wh.name || '')
      .replace(/^Kho\s+Nguyên liệu\s*-\s*/i, '')
      .replace(/^Kho\s+Bán thành phẩm\s*-\s*/i, '')
      .replace(/^Kho\s+Thành phẩm\s*-\s*/i, '')
      .trim();
    return place ? `Kho ${place}` : (wh.name || '—');
  };
  const inventoryLocationLabel = (locationId) => {
    const raw = String(Q.locationName(locationId) || '—');
    const m = raw.match(/^Kệ\s+([^\s]+)\s*-\s*(.+)$/i);
    if (!m) return raw;
    const shelf = m[1];
    let area = m[2].trim();
    area = area
      .replace(/^Nguyên liệu\s+/i, '')
      .replace(/^BTP\s+/i, '')
      .replace(/^Thành phẩm\s+/i, '');
    return `Khu ${area.charAt(0).toLowerCase()}${area.slice(1)} - Kệ ${shelf}`;
  };
  const warehouseIds = new Set(DB.warehouses.filter(w => w.type === cfg.type).map(w => w.id));
  const rowsSource = (DB.inventory || []).filter(row => warehouseIds.has(row.warehouseId));

  // Tồn kho là màn hình trạng thái của TOÀN BỘ master hàng hóa, không chỉ các mã đã phát sinh tồn.
  // Vì vậy nguyên liệu/BTP/TP vừa tạo vẫn phải xuất hiện với số lượng 0 sau khi refresh.
  const masterSource = cfg.type === 'RAW_MATERIAL'
    ? (DB.materials || [])
    : cfg.type === 'SEMI_FINISHED'
      ? (DB.semiFinishedProducts || [])
      : (DB.products || []);

  const groupMap = new Map();
  masterSource.forEach(item => {
    if (f.category && inventoryItemCategory(item, cfg.type) !== f.category) return;
    if (q && ![item.id, item.name, inventoryItemCategory(item, cfg.type), item.unit].some(v => String(v || '').toLowerCase().includes(q))) return;
    groupMap.set(item.id, { productId: item.id, qtyOnHand: 0, qtyPending: 0, qtyRejected: 0, rows: [] });
  });

  // Bổ sung các lô/tồn thực tế. Nếu tìm theo lô/PO/kho/kệ thì vẫn đưa đúng mã hàng vào kết quả.
  rowsSource.forEach(row => {
    const item = inventoryMasterItem(row.productId);
    const lot = Q.lot(row.lotId);
    const receipt = (DB.goodsReceipts || []).find(r => (r.items || []).some(i => i.lotId === row.lotId || i.lotNumber === lot?.lotNumber));
    if (f.warehouse && row.warehouseId !== f.warehouse) return;
    if (f.category && inventoryItemCategory(item, cfg.type) !== f.category) return;
    const rowMatchesQ = !q || [row.productId, item?.name, lot?.lotNumber, lot?.supplierLot, receipt?.poId, Q.warehouseName(row.warehouseId), Q.locationName(row.locationId)].some(v => String(v || '').toLowerCase().includes(q));
    const masterMatchesQ = !q || [row.productId, item?.name, inventoryItemCategory(item, cfg.type), item?.unit].some(v => String(v || '').toLowerCase().includes(q));
    if (!rowMatchesQ && !masterMatchesQ) return;
    if (!groupMap.has(row.productId)) groupMap.set(row.productId, { productId: row.productId, qtyOnHand: 0, qtyPending: 0, qtyRejected: 0, rows: [] });
    const g = groupMap.get(row.productId);
    g.qtyOnHand += Number(row.qtyOnHand || 0);
    g.qtyPending += Number(row.qtyPending || 0);
    g.qtyRejected += Number(row.qtyRejected || 0);
    g.rows.push(row);
  });
  const groups = [...groupMap.values()].sort((a,b) => {
    const ai = inventoryMasterItem(a.productId);
    const bi = inventoryMasterItem(b.productId);
    return String(ai?.name || a.productId).localeCompare(String(bi?.name || b.productId), 'vi', { sensitivity:'base', numeric:true });
  });
  const pg = paged(groups, 'inventory');

  const rows = pg.items.map(group => {
    const item = inventoryMasterItem(group.productId);
    const expanded = f.expandedProductId === group.productId;
    const lotRows = [...group.rows].sort((a,b) => {
      const al = Q.lot(a.lotId), bl = Q.lot(b.lotId);
      return String(al?.lotNumber || '').localeCompare(String(bl?.lotNumber || ''), 'vi', { numeric:true });
    });
    const minimumStock = stockTab === 'raw'
      ? Number(item?.minStock || 0)
      : (stockTab === 'finished' ? Number(finishedMinStock[group.productId] || 0) : 0);
    const lowStock = minimumStock > 0 && Number(group.qtyOnHand || 0) < minimumStock;
    const parent = `<tr class="clickable ${expanded ? 'inventory-group-selected' : ''} ${lowStock ? 'inventory-low-stock' : ''}" data-act="inv-stock-product-toggle" data-productid="${group.productId}" style="${expanded ? 'background:var(--teal-soft);box-shadow:inset 5px 0 0 var(--teal)' : ''}">
      <td>${cell2(esc(item?.name || group.productId), `${esc(group.productId)}${lowStock ? ` · <span class="badge orange"><i class="fa-solid fa-triangle-exclamation"></i> Sắp hết hàng</span>` : ''}${Number(group.qtyPending||0)>0 ? `<div class="cell-sub" style="margin-top:4px;color:var(--orange)"><i class="fa-solid fa-flask-vial"></i> Đang chờ kiểm tra chất lượng</div>` : ''}${Number(group.qtyRejected||0)>0 ? `<div class="cell-sub" style="margin-top:4px;color:var(--red)"><i class="fa-solid fa-triangle-exclamation"></i> Có ${fmtN(group.qtyRejected)} ${esc(item?.unit || '')} không đạt QC · chờ xuất trả NCC</div>` : ''}`)}</td>
      <td class="right strong num">${fmtN(group.qtyOnHand)} ${esc(item?.unit || lotRows[0]?.unit || '')}${minimumStock > 0 ? `<div class="cell-sub">Tối thiểu: ${fmtN(minimumStock)}</div>` : ''}</td>
      <td class="center"><span class="chip"><i class="fa-solid fa-layer-group"></i> ${lotRows.length} lô</span></td>
      <td>${esc([...new Set(lotRows.map(r=>inventoryWarehouseLabel(r.warehouseId)).filter(Boolean))].join(', '))}</td>
      <td class="right" style="white-space:nowrap">${rowActions([
        { act:'inventory-item-view', data:`data-type="${cfg.type}" data-id="${group.productId}"`, icon:'fa-eye', title:`Xem ${cfg.itemLabel.toLowerCase()}` },
        { act:'inventory-item-edit', data:`data-type="${cfg.type}" data-id="${group.productId}"`, icon:'fa-pen', title:'Sửa master' },
        { act:'inventory-item-delete', data:`data-type="${cfg.type}" data-id="${group.productId}"`, icon:'fa-trash', title:'Xóa master' },
      ])}<button class="btn btn-sm" data-act="inv-stock-product-toggle" data-productid="${group.productId}"><i class="fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>${expanded ? 'Thu gọn' : 'Xem lô'}</button></td>
    </tr>`;
    if (!expanded) return parent;
    const child = `<tr class="inventory-lot-child"><td colspan="5" style="padding:0 14px 14px 28px;background:var(--surface-2)">
      <div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-top:10px">
      ${tableShell(
        [{t:'Lô hệ thống'},{t:'Lô sản phẩm'},{t:'Số lượng',cls:'right'},{t:'Ngày nhập'},{t:'Hạn sử dụng'},{t:stockTab==='raw'?'Tham chiếu PO':'Tham chiếu'},{t:'Kho'},{t:'Kệ / vị trí'},{t:'',cls:'right',w:'70px'}],
        lotRows.map(row => {
          const lot = Q.lot(row.lotId);
          const receipt = (DB.goodsReceipts || []).find(r => (r.items || []).some(i => i.lotId === row.lotId || i.lotNumber === lot?.lotNumber));
          const receiptDate = receipt?.date || String(row.lastUpdated||'').slice(0,10);
          return `<tr class="clickable" data-act="inv-stock-lot-view" data-productid="${row.productId}" data-lotid="${row.lotId}">
            <td><span class="code">${esc(lot?.lotNumber || '—')}</span></td>
            <td>${esc(lot?.supplierLot || '—')}</td>
            <td class="right strong num">${fmtN(row.qtyOnHand)} ${esc(row.unit || item?.unit || '')}${Number(row.qtyPending||0)>0 ? `<div class="cell-sub" style="margin-top:4px;color:var(--orange)">Đang chờ kiểm tra chất lượng</div>` : ''}${Number(row.qtyRejected||0)>0 ? `<div class="cell-sub" style="margin-top:4px;color:var(--red)">Lô nhập ${fmtN(Number(row.receivedQty||0) || (Number(row.qtyOnHand||0)+Number(row.qtyRejected||0)))} ${esc(row.unit || item?.unit || '')} có ${fmtN(row.qtyRejected)} không đạt · chờ trả NCC</div>` : ''}</td>
            <td class="num">${fmtDate(receiptDate)}</td>
            <td class="num">${lot?.expiryDate ? fmtDate(lot.expiryDate) : '—'}</td>
            <td>${receipt?.poId ? `<span class="code" style="color:var(--primary)">${esc(receipt.poId)}</span>` : `<span class="muted">${esc(lot?.productionOrderId || '—')}</span>`}</td>
            <td>${esc(inventoryWarehouseLabel(row.warehouseId))}</td>
            <td>${esc(inventoryLocationLabel(row.locationId))}</td>
            <td>${rowActions([{ act:'inv-stock-lot-view', data:`data-productid="${row.productId}" data-lotid="${row.lotId}"`, icon:'fa-eye', title:'Xem chi tiết' }])}</td>
          </tr>`;
        }), { emptyTitle:'Không có lô tồn kho' })}
      </div></td></tr>`;
    return parent + child;
  });

  return `
  ${pageHead('Tồn kho', 'Theo dõi tồn kho tổng hợp theo mặt hàng; click để xem chi tiết từng lô ngay bên dưới', `
    <button class="btn" data-act="inv-export-stock"><i class="fa-solid fa-file-export"></i>Export</button>
    <button class="btn" data-act="item-category-manager" data-type="${cfg.type}"><i class="fa-solid fa-tags"></i>Danh mục</button>
    <button class="btn btn-primary" data-act="inventory-item-add" data-type="${cfg.type}"><i class="fa-solid fa-plus"></i>Thêm ${cfg.itemLabel.toLowerCase()}</button>
  `)}
  <div class="tabs" style="margin-bottom:14px">
    <button class="tab ${stockTab === 'raw' ? 'active' : ''}" data-act="inventory-stock-tab" data-tab="raw"><i class="fa-solid fa-seedling"></i>Kho nguyên liệu</button>
    <button class="tab ${stockTab === 'semi' ? 'active' : ''}" data-act="inventory-stock-tab" data-tab="semi"><i class="fa-solid fa-cubes-stacked"></i>Kho bán thành phẩm</button>
    <button class="tab ${stockTab === 'finished' ? 'active' : ''}" data-act="inventory-stock-tab" data-tab="finished"><i class="fa-solid fa-box"></i>Kho thành phẩm</button>
  </div>
  <div class="grid g-auto-sm" style="margin-bottom:14px">
    ${mkpi(`${cfg.itemLabel}`, masterSource.length, 'fa-box', 'blue')}
    ${mkpi('Tổng số lượng tồn', fmtN(rowsSource.reduce((s,r)=>s+Number(r.qtyOnHand||0),0)), 'fa-boxes-stacked', 'teal')}
    ${mkpi('Tổng số lô', rowsSource.length, 'fa-layer-group', 'indigo')}
    ${mkpi('Lô cận / hết hạn', rowsSource.filter(r => { const l=Q.lot(r.lotId); return l?.expiryDate && l.expiryDate <= addDays(DB.today, DB.inventoryAlertConfig?.nearExpiryDays || 7); }).length, 'fa-triangle-exclamation', 'orange')}
  </div>
  <div class="card">
    <div class="toolbar">
      ${searchBox('inventory', `Tìm ${cfg.itemLabel.toLowerCase()}, lô, khu, kệ…`)}
      ${selectFilter('inventory','category',inventoryCategories(cfg.type).map(c=>[c,c]),'Tất cả danh mục')}
      ${selectFilter('inventory','warehouse',DB.warehouses.filter(w=>w.type===cfg.type).map(w=>[w.id,w.name]),'Tất cả kho')}
      ${(f.q || f.category || f.warehouse) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="inventory"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
      <span class="spacer"></span><span class="chip"><i class="fa-solid fa-list"></i> ${fmtN(groups.length)} ${cfg.itemLabel.toLowerCase()}</span>
    </div>
    ${tableShell(
      [{t:cfg.itemLabel},{t:'Tổng số lượng',cls:'right'},{t:'Số lô',cls:'center'},{t:'Kho đang lưu'},{t:'Thao tác',cls:'right',w:'110px'}],
      rows, { emptyTitle: `Chưa có ${cfg.itemLabel.toLowerCase()} trong kho` })}
    ${pagiHTML('inventory', pg, cfg.itemLabel.toLowerCase())}
  </div>`;
};

function openInventoryStockLotDetail(productId, lotId) {
  const row = DB.inventory.find(r => r.productId === productId && r.lotId === lotId);
  if (!row) return;
  const material = Q.material(productId);
  const product = Q.product(productId);
  const item = material || product;
  const lot = Q.lot(lotId);
  const receipts = (DB.goodsReceipts || []).filter(r => (r.items || []).some(i => i.lotId === lotId || i.lotNumber === lot?.lotNumber));
  const moves = (DB.inventoryTransactions || []).filter(t => t.productId === productId && t.lotId === lotId).slice(0,10);
  Modal.open({
    title: `${item?.name || productId}`,
    sub: `${productId} · Lô ${lot?.lotNumber || lotId}`,
    size: 'md',
    body: `
      <div class="info-grid" style="margin-bottom:16px">
        ${infoItem('Số lượng tồn', `<b class="num">${fmtN(row.qtyOnHand)} ${esc(row.unit || item?.unit || '')}</b>`)}
        ${infoItem('Lô hệ thống', `<span class="code">${esc(lot?.lotNumber || '—')}</span>`)}
        ${infoItem('Lô sản phẩm', esc(lot?.supplierLot || '—'))}
        ${infoItem('Ngày sản xuất', lot?.mfgDate ? fmtDate(lot.mfgDate) : '—')}
        ${infoItem('Hạn sử dụng', lot?.expiryDate ? fmtDate(lot.expiryDate) : '—')}
        ${infoItem('Khu', esc(Q.warehouseName(row.warehouseId)))}
        ${infoItem('Vị trí', esc(Q.locationName(row.locationId)))}
        ${infoItem('PO tham chiếu', receipts[0]?.poId ? `<span class="code">${esc(receipts[0].poId)}</span>` : '—')}
        ${infoItem('Ngày nhập gần nhất', receipts[0]?.date ? fmtDate(receipts[0].date) : fmtDate(String(row.lastUpdated||'').slice(0,10)))}
      </div>
      <div class="form-sec-title"><i class="fa-solid fa-clock-rotate-left"></i>Lịch sử nhập của lô</div>
      ${tableShell([{t:'Phiếu nhập'},{t:'Ngày'},{t:'PO'},{t:'Số lượng',cls:'right'}], receipts.flatMap(r => (r.items||[]).filter(i => i.lotId===lotId || i.lotNumber===lot?.lotNumber).map(i => `<tr><td><span class="code">${r.id}</span></td><td>${fmtDate(r.date)}</td><td>${esc(r.poId||'—')}</td><td class="right num">${fmtN(i.qty)} ${esc(i.unit||'')}</td></tr>`)), {emptyTitle:'Chưa có lịch sử phiếu nhập cho lô này'})}`,
    foot: '<button class="btn" data-act="modal-close">Đóng</button>'
  });
}

Views.warehouse = function () {
  const tab = State.tab || 'dashboard';
  switch (tab) {

    case 'dashboard':
      return Views['inv-overview']
        ? Views['inv-overview']()
        : '';

    case 'inventory':
      return Views.inventory
        ? Views.inventory()
        : '';

    case 'receipts':
      return Views['inv-receipts']
        ? Views['inv-receipts']()
        : '';

    case 'issues':
      return Views['inv-issues']
        ? Views['inv-issues']()
        : '';

    case 'transfers':
      return Views['inv-transfers']
        ? Views['inv-transfers']()
        : '';

    case 'stocktake':
      return Views['inv-counts']
        ? Views['inv-counts']()
        : '';

    case 'batches':
      return Views['inv-lots']
        ? Views['inv-lots']()
        : '';

    case 'locations':
      return Views['inv-warehouses']
        ? Views['inv-warehouses']()
        : '';

    case 'alerts':
      return Views['inv-alerts']
        ? Views['inv-alerts']()
        : '';

    default:
      return '';
  }
};
/* ------------------------------------------------------------ MUA SẮM */


// Views.purchases = function () {
//   const f = F('purchases', { q: '', status: '', supplier: '', tab: 'pr', prId: '', materialId: '' });
//   if (State.params.filter === 'pending') { f.status = 'mh_cho_duyet'; f.tab = 'pr'; State.params.filter = null; }
//   if (State.params.tab) { f.tab = State.params.tab; State.params.tab = null; }
//   const q = (f.q || '').toLowerCase().trim();

// const purchaseTabCounts = {
//   pr: DB.purchases.length,

//   quotes:
//     DB.supplierQuotations.length,

//   po:
//     DB.purchaseOrders.length,

//   receipts:
//     DB.goodsReceipts.length,

//   debts:
//     DB.supplierPayments.length,

//   price_history:
//     DB.purchasePriceHistory.length,

//   evaluations:
//     DB.supplierEvaluations.length,

//   suppliers:
//     DB.suppliers.length
// };


// const tabs =
//   PURCHASE_INVENTORY_CONFIG.purchaseTabs.map(
//     (tab) => ({
//       ...tab,

//       count:
//         tab.id === 'dashboard'
//           ? ''
//           : purchaseTabCounts[tab.id] ?? ''
//     })
//   );

//   /* -------------------------------------------------- TAB 1: PR (YÊU CẦU MUA) */
//   const renderPrTab = () => {
//     const list = DB.purchases.filter((p) => {
//       if (f.status && p.status !== f.status) return false;
//       if (f.supplier && p.supplierId !== f.supplier) return false;
//       if (q && ![p.id, Q.supplierName(p.supplierId), Q.employeeName(p.requesterId), p.reason].some((v) => String(v).toLowerCase().includes(q))) return false;
//       return true;
//     }).sort((a, b) => b.id.localeCompare(a.id));
//     const pg = paged(list, 'purchases');
//     const suppliers = DB.suppliers.map((s) => [s.id, s.name]);
//     const cnt = (s) => DB.purchases.filter((p) => p.status === s).length;

//     const rows = pg.items.map((p) => {
//   const isApproved =
//   PURCHASE_INVENTORY_CONFIG
//     .prStatus
//     .approved
//     .includes(p.status);

//   const isPending =
//   PURCHASE_INVENTORY_CONFIG
//     .prStatus
//     .pending
//     .includes(p.status);

//   /* Danh sách vật tư thuộc PR */
//   const materialHtml = (p.items || []).length
//     ? p.items.map((it) => `
//         <div style="
//           display:flex;
//           align-items:center;
//           gap:7px;
//           margin-bottom:5px;
//         ">
//           <span class="code">${esc(it.materialId)}</span>

//           <span style="flex:1">
//             ${esc(it.name)}
//           </span>

//           <span class="num muted" style="white-space:nowrap">
//             ${fmtDec(it.qty, 2)} ${esc(it.unit)}
//           </span>
//         </div>
//       `).join('')
//     : `
//       <span class="muted">
//         Chưa có vật tư
//       </span>
//     `;

//   return `
//     <tr
//       class="clickable"
//       data-act="open-pr"
//       data-id="${p.id}"
//     >

//       <td>
//         <span class="code">${p.id}</span>

//         <div class="cell-sub">
//           ${esc(p.reason || '')}
//         </div>
//       </td>

//       <td class="hide-sm">
//         <div style="
//           display:flex;
//           align-items:center;
//           gap:8px
//         ">
//           ${avatarHTML(Q.employeeName(p.requesterId))}

//           <span>
//             ${esc(Q.employeeName(p.requesterId))}
//           </span>
//         </div>
//       </td>

//       <!-- VẬT TƯ ĐỀ NGHỊ MUA -->
//       <td>
//         ${materialHtml}
//       </td>

//       <!-- NHÀ CUNG CẤP -->
//       <td>
//         <div class="strong">
//           ${esc(Q.supplierName(p.supplierId))}
//         </div>
//       </td>

//       <td class="right strong num">
//         ${fmtVND(p.total)}
//       </td>

//       <td class="num">
//         ${fmtDate(p.date)}
//       </td>

//       <td class="num hide-sm">
//         ${fmtDate(p.expectedDate)}
//       </td>

//       <td>
//         ${badge(p.status)}
//       </td>

//       <td>
//         ${rowActions([
//           {
//             act: 'open-pr',
//             data: `data-id="${p.id}"`,
//             icon: 'fa-eye',
//             title: 'Xem chi tiết'
//           },

//           ...(isPending
//             ? [{
//                 act: 'pr-approve-action',
//                 data: `data-id="${p.id}"`,
//                 icon: 'fa-check',
//                 title: 'Phê duyệt PR'
//               }]
//             : []),

//           ...(isPending
//             ? [{
//                 act: 'pr-reject-modal',
//                 data: `data-id="${p.id}"`,
//                 icon: 'fa-xmark',
//                 title: 'Từ chối PR'
//               }]
//             : []),

//           ...(isApproved
//             ? [{
//                 act: 'pr-convert-po',
//                 data: `data-id="${p.id}"`,
//                 icon: 'fa-file-export',
//                 title: 'Tạo PO từ PR này'
//               }]
//             : []),
//         ])}
//       </td>

//     </tr>
//   `;
// });

//     return `
//     <div class="card" style="margin-bottom:14px">
//       <div class="card-head"><div><h3>Quy trình Đề nghị mua hàng (PR)</h3><p>Số yêu cầu đang xử lý theo từng giai đoạn</p></div></div>
//       <div class="card-body">
//         <div class="flow">
//           ${PR_FLOW.map((s) => {
//             const n = cnt(s.key);
//             return `<div class="flow-step ${n ? 'doing' : 'pending'}" data-act="filter-pr" data-status="${s.key}" style="cursor:pointer">
//               <div class="flow-ico"><i class="fa-solid ${s.icon}"></i></div>
//               <div class="flow-name">${esc(s.name)}</div>
//               <div class="flow-date">${n} yêu cầu</div>
//             </div>`;
//           }).join('')}
//         </div>
//       </div>
//     </div>

//     <div class="grid g-auto-sm" style="margin-bottom:14px">
//       ${mkpi('Tổng PR', DB.purchases.length, 'fa-cart-shopping', 'blue')}
//       ${mkpi('Chờ duyệt', cnt('mh_cho_duyet') + cnt('PENDING_APPROVAL'), 'fa-hourglass-half', 'orange')}
//       ${mkpi('Đã phê duyệt', cnt('mh_da_duyet') + cnt('APPROVED'), 'fa-circle-check', 'green')}
//       ${mkpi('Từ chối', cnt('mh_tu_choi') + cnt('REJECTED'), 'fa-circle-xmark', 'red')}
//       ${mkpi('Giá trị đề xuất', fmtShort(DB.purchases
//   .filter((p) =>
//     !PURCHASE_INVENTORY_CONFIG
//       .prStatus
//       .rejected
//       .includes(p.status)).reduce((s, p) => s + p.total, 0)), 'fa-sack-dollar', 'indigo')}
//     </div>

//     <div class="card">
//       <div class="toolbar">
//         ${searchBox('purchases', 'Tìm mã PR, nhà cung cấp, người yêu cầu…')}
//         ${selectFilter('purchases', 'status', statusOptions('mh_'), 'Tất cả trạng thái')}
//         ${selectFilter('purchases', 'supplier', suppliers, 'Tất cả nhà cung cấp')}
//         ${(f.q || f.status || f.supplier) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="purchases"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
//         <span class="spacer"></span>
//         <span class="chip"><i class="fa-solid fa-list"></i> ${fmtN(list.length)} yêu cầu</span>
//       </div>
//       ${tableShell(
//         [{ t: 'Mã PR', w: '130px' }, { t: 'Người yêu cầu', cls: 'hide-sm' }, { t: 'Nhà cung cấp' }, { t: 'Giá trị', cls: 'right' },
//          { t: 'Ngày yêu cầu' }, { t: 'Dự kiến về', cls: 'hide-sm' }, { t: 'Trạng thái', w: '128px' }, { t: 'Thao tác', cls: 'right', w: '130px' }],
//         rows, { emptyTitle: 'Không tìm thấy đề nghị mua hàng' })}
//       ${pagiHTML('purchases', pg, 'yêu cầu')}
//     </div>`;
//   };

//   /* -------------------------------------------------- TAB 2: BÁO GIÁ NCC */
//   const renderQuotesTab = () => {
//     const quoteable =
//   DB.purchases.filter((p) =>
//     PURCHASE_INVENTORY_CONFIG
//       .prStatus
//       .quoteable
//       .includes(p.status)
//   );
//     const prList = quoteable.map((p) => [p.id, `${p.id} — ${p.reason.slice(0, 36)}…`]);
//     const quotePrIds = new Set(DB.supplierQuotations.map((q) => q.prId));
//     const defaultPr = quoteable.find((p) => quotePrIds.has(p.id)) || quoteable[0];
//     const selPrId = f.prId && quoteable.some((p) => p.id === f.prId) ? f.prId : (defaultPr ? defaultPr.id : '');
//     f.prId = selPrId;
//     const quotes = DB.supplierQuotations.filter((q) => !selPrId || q.prId === selPrId);

//     let compHtml = '';
//     if (quotes.length >= 2) {
//       const minP = Math.min(...quotes.map((q) => q.total));
//       const maxP = Math.max(...quotes.map((q) => q.total));
//       const diffP = maxP - minP;
//       const diffPct = minP ? Math.round((diffP / minP) * 100) : 0;
//       const winner = quotes.find((q) => q.selected) || quotes[0];

//       compHtml = `
//       <div class="card" style="margin-bottom:14px;background:var(--surface-2);border-color:var(--primary)">
//         <div class="card-head">
//           <div><h3>Bảng so sánh báo giá nhà cung cấp — ${esc(selPrId)}</h3><p>So sánh giá mua và thời gian giao hàng giữa các nhà cung cấp cho cùng 1 đề nghị mua</p></div>
//           <div class="right"><span class="badge green">Có ${quotes.length} báo giá</span></div>
//         </div>
//         <div class="card-body">
//           <div class="grid g-4" style="margin-bottom:14px">
//             <div class="mkpi"><span class="mkpi-ico t-green"><i class="fa-solid fa-arrow-down"></i></span><span><span class="mkpi-label">Giá thấp nhất</span><div class="mkpi-value">${fmtVND(minP)}</div></span></div>
//             <div class="mkpi"><span class="mkpi-ico t-red"><i class="fa-solid fa-arrow-up"></i></span><span><span class="mkpi-label">Giá cao nhất</span><div class="mkpi-value">${fmtVND(maxP)}</div></span></div>
//             <div class="mkpi"><span class="mkpi-ico t-orange"><i class="fa-solid fa-percent"></i></span><span><span class="mkpi-label">Chênh lệch giá</span><div class="mkpi-value">+${fmtVND(diffP)} (${diffPct}%)</div></span></div>
//             <div class="mkpi"><span class="mkpi-ico t-blue"><i class="fa-solid fa-trophy"></i></span><span><span class="mkpi-label">NCC được chọn</span><div class="mkpi-value" style="font-size:14px">${esc(Q.supplierName(winner.supplierId))}</div></span></div>
//           </div>
//         </div>
//       </div>`;
//     }

//     const rows = quotes.map((q) => `
//       <tr>
//         <td><span class="code">${q.id}</span></td>
//         <td><span class="code" style="color:var(--text-2)">${q.prId}</span></td>
//         <td><div class="strong">${esc(Q.supplierName(q.supplierId))}</div><div class="cell-sub">${q.items.map((i) => `${i.name} (${fmtN(i.qty)} ${i.unit})`).join(', ')}</div></td>
//         <td class="num">${fmtDate(q.date)}</td>
//         <td class="num center">${q.leadTimeDays} ngày</td>
//         <td class="right strong num">${fmtVND(q.total)}</td>
//         <td class="center">${q.selected ? '<span class="badge green">Trúng thầu</span>' : '<span class="badge slate">Đã chào giá</span>'}</td>
//         <td class="right">${rowActions([
//           { act: 'quote-select-winner', data: `data-id="${q.id}"`, icon: 'fa-check', title: 'Chọn nhà cung cấp này' },
//         ])}</td>
//       </tr>`);

//     return `
//     ${compHtml}
//     <div class="card">
//       <div class="toolbar">
//         ${selectFilter('purchases', 'prId', prList, quoteable.length ? 'Chọn PR đã duyệt' : 'Chưa có PR đã duyệt')}
//         <span class="spacer"></span>
//         ${selPrId ? `<button class="btn btn-sm btn-primary" data-act="quote-add-supplier" data-id="${selPrId}"><i class="fa-solid fa-plus"></i>Thêm báo giá NCC</button>` : '<span class="chip">Cần duyệt PR trước khi lấy báo giá</span>'}
//       </div>
//       ${tableShell(
//         [{ t: 'Mã Báo giá', w: '120px' }, { t: 'Mã PR', w: '120px' }, { t: 'Nhà cung cấp' }, { t: 'Ngày báo' },
//          { t: 'Lead time', cls: 'center' }, { t: 'Tổng tiền (chưa VAT)', cls: 'right' }, { t: 'Trạng thái', cls: 'center' }, { t: 'Thao tác', cls: 'right' }],
//         rows, { emptyTitle: 'Chưa có báo giá NCC nào cho PR này' })}
//     </div>`;
//   };

//   /* -------------------------------------------------- TAB 3: PO (ĐƠN ĐẶT HÀNG) */
//   const renderPoTab = () => {
//     const list = DB.purchaseOrders.filter((po) => {
//       if (f.status && po.status !== f.status) return false;
//       if (f.supplier && po.supplierId !== f.supplier) return false;
//       if (q && ![po.id, po.prId, Q.supplierName(po.supplierId), po.note].some((v) => String(v).toLowerCase().includes(q))) return false;
//       return true;
//     }).sort((a, b) => b.id.localeCompare(a.id));
//     const pg = paged(list, 'purchases');
//     const suppliers = DB.suppliers.map((s) => [s.id, s.name]);

//     const rows = pg.items.map((po) => `
//       <tr class="clickable" data-act="open-po" data-id="${po.id}">
//         <td><span class="code">${po.id}</span><div class="cell-sub">từ ${po.prId}</div></td>
//         <td>${cell2(esc(Q.supplierName(po.supplierId)), esc(po.items.map((i) => i.name).join(', ')))}</td>
//         <td class="num">${fmtDate(po.date)}</td>
//         <td class="num hide-sm">${fmtDate(po.expectedDate)}</td>
//         <td class="right strong num">${fmtVND(po.total)}</td>
//         <td class="right num hide-sm" style="color:var(--green)">${fmtVND(po.paid)}</td>
//         <td>${badge(po.status)}</td>
//         <td>${rowActions([
//           { act: 'open-po', data: `data-id="${po.id}"`, icon: 'fa-eye', title: 'Xem chi tiết PO' },
//           ...(po.status === 'SHIPPING' || po.status === 'PARTIAL_RECEIVED' ? [{ act: 'po-receive-goods', data: `data-id="${po.id}"`, icon: 'fa-box-open', title: 'Nhập kho hàng về' }] : []),
//           ...(po.status === 'DRAFT' ? [{ act: 'po-change-status', data: `data-id="${po.id}" data-status="SENT_TO_SUPPLIER"`, icon: 'fa-paper-plane', title: 'Gửi cho Nhà cung cấp' }] : []),
//           ...(po.status === 'SENT_TO_SUPPLIER' ? [{ act: 'po-change-status', data: `data-id="${po.id}" data-status="SHIPPING"`, icon: 'fa-truck-fast', title: 'Xác nhận NCC đang giao' }] : []),
//         ])}</td>
//       </tr>`);

//     return `
//     <div class="grid g-auto-sm" style="margin-bottom:14px">
//       ${mkpi('Tổng đơn PO', DB.purchaseOrders.length, 'fa-file-invoice-dollar', 'blue')}
//       ${mkpi('Đang giao hàng', DB.purchaseOrders.filter((p) => p.status === 'SHIPPING').length, 'fa-truck-fast', 'teal')}
//       ${mkpi('Nhận 1 phần', DB.purchaseOrders.filter((p) => p.status === 'PARTIAL_RECEIVED').length, 'fa-boxes-packing', 'orange')}
//       ${mkpi('Đã nhận đủ', DB.purchaseOrders.filter((p) => p.status === 'RECEIVED').length, 'fa-circle-check', 'green')}
//       ${mkpi('Tổng giá trị PO', fmtShort(DB.purchaseOrders.reduce((s, p) => s + p.total, 0)), 'fa-sack-dollar', 'indigo')}
//     </div>

//     <div class="card">
//       <div class="toolbar">
//         ${searchBox('purchases', 'Tìm mã PO, mã PR, nhà cung cấp…')}
//         ${selectFilter('purchases', 'status', statusOptions('po_'), 'Tất cả trạng thái PO')}
//         ${selectFilter('purchases', 'supplier', suppliers, 'Tất cả nhà cung cấp')}
//         ${(f.q || f.status || f.supplier) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="purchases"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
//         <span class="spacer"></span>
//         <span class="chip"><i class="fa-solid fa-list"></i> ${fmtN(list.length)} đơn PO</span>
//       </div>
//       ${tableShell(
//         [{ t: 'Mã PO', w: '130px' }, { t: 'Nhà cung cấp' }, { t: 'Ngày đặt' }, { t: 'Giao dự kiến', cls: 'hide-sm' },
//          { t: 'Tổng giá trị PO', cls: 'right' }, { t: 'Đã thanh toán', cls: 'right hide-sm' }, { t: 'Trạng thái PO', w: '140px' }, { t: 'Thao tác', cls: 'right', w: '120px' }],
//         rows, { emptyTitle: 'Chưa có đơn đặt hàng PO nào' })}
//       ${pagiHTML('purchases', pg, 'đơn PO')}
//     </div>`;
//   };

//   /* -------------------------------------------------- TAB 4: NHẬP KHO (GOODS RECEIPTS) */
//   const renderReceiptsTab = () => {
//     const list = [...DB.goodsReceipts].sort((a, b) => b.date.localeCompare(a.date));
//     const rows = list.map((g) => `
//       <tr>
//         <td><span class="code">${g.id}</span></td>
//         <td><span class="code" style="color:var(--primary)">${g.poId}</span></td>
//         <td class="num">${fmtDate(g.date)}</td>
//         <td>${esc(Q.employeeName(g.receivedBy))}</td>
//         <td><span class="chip">${esc(g.warehouse)}</span></td>
//         <td>${esc(g.items.map((i) => `${i.name} (+${fmtN(i.qty)} ${i.unit})`).join(', '))}</td>
//         <td>${badge(g.status)}</td>
//         <td class="muted">${esc(g.note)}</td>
//       </tr>`);

//     return `
//     <div class="card">
//       <div class="toolbar">
//         ${searchBox('purchases', 'Tìm phiếu nhập, mã PO, người nhận…')}
//         <span class="spacer"></span>
//         <span class="chip"><i class="fa-solid fa-warehouse"></i> ${list.length} lượt nhập kho</span>
//       </div>
//       ${tableShell(
//         [{ t: 'Số phiếu nhập', w: '130px' }, { t: 'Mã PO', w: '120px' }, { t: 'Ngày nhận' }, { t: 'Người nhận' },
//          { t: 'Kho nhận' }, { t: 'Vật tư nhận' }, { t: 'Trạng thái' }, { t: 'Ghi chú' }],
//         rows, { emptyTitle: 'Chưa có lượt nhập kho nào' })}
//     </div>`;
//   };

//   /* -------------------------------------------------- TAB 5: CÔNG NỢ NCC */
//   const renderDebtsTab = () => {
//     const pos = DB.purchaseOrders;
//     const totalPoVal = pos.reduce((s, p) => s + p.total, 0);
//     const totalPaidVal = pos.reduce((s, p) => s + p.paid, 0);
//     const remainingDebt = totalPoVal - totalPaidVal;

//     const rows = pos.map((p) => {
//       const remain = p.total - p.paid;
//       const payStatus = remain <= 0 ? 'PAID' : p.paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
//       return `<tr>
//         <td><span class="code">${p.id}</span></td>
//         <td><div class="strong">${esc(Q.supplierName(p.supplierId))}</div></td>
//         <td class="num hide-sm">${fmtDate(p.date)}</td>
//         <td class="right num strong">${fmtVND(p.total)}</td>
//         <td class="right num" style="color:var(--green)">${fmtVND(p.paid)}</td>
//         <td class="right num strong" style="color:${remain > 0 ? 'var(--red)' : 'var(--text-3)'}">${fmtVND(remain)}</td>
//         <td>${badge(payStatus)}</td>
//         <td class="right">${remain > 0 ? `<button class="btn btn-xs btn-primary" data-act="supplier-pay-modal" data-id="${p.id}"><i class="fa-solid fa-hand-holding-dollar"></i>Thanh toán</button>` : '<span class="muted">Tất toán</span>'}</td>
//       </tr>`;
//     });

//     return `
//     <div class="grid g-auto-sm" style="margin-bottom:14px">
//       ${mkpi('Tổng giá trị mua PO', fmtShort(totalPoVal), 'fa-sack-dollar', 'blue')}
//       ${mkpi('Đã thanh toán', fmtShort(totalPaidVal), 'fa-circle-check', 'green')}
//       ${mkpi('Công nợ còn lại', fmtShort(remainingDebt), 'fa-file-invoice-dollar', 'red')}
//       ${mkpi('Số đợt thanh toán', DB.supplierPayments.length, 'fa-receipt', 'indigo')}
//     </div>

//     <div class="card">
//       <div class="card-head"><div><h3>Sổ theo dõi công nợ nhà cung cấp theo PO</h3><p>Công nợ còn lại = Tổng giá trị PO − Đã thanh toán</p></div></div>
//       ${tableShell(
//         [{ t: 'Mã PO', w: '120px' }, { t: 'Nhà cung cấp' }, { t: 'Ngày PO', cls: 'hide-sm' },
//          { t: 'Tổng PO', cls: 'right' }, { t: 'Đã thanh toán', cls: 'right' }, { t: 'Công nợ còn lại', cls: 'right' }, { t: 'Trạng thái', w: '130px' }, { t: 'Thao tác', cls: 'right' }],
//         rows, { emptyTitle: 'Không có dữ liệu công nợ' })}
//     </div>`;
//   };

//   /* -------------------------------------------------- TAB 6: LỊCH SỬ GIÁ MUA */
//   const renderPriceHistoryTab = () => {
//     const list = [...DB.purchasePriceHistory].sort((a, b) => b.date.localeCompare(a.date));
//     const matList = DB.materials.map((m) => [m.id, m.name]);
//     const selMatId = f.materialId || '';
//     const filtered = selMatId ? list.filter((x) => x.materialId === selMatId) : list;

//     // Cảnh báo tăng giá > 10%
//     let alertHtml = '';
//     if (selMatId && filtered.length >= 2) {
//       const newest = filtered[0];
//       const prev = filtered[1];
//       const pct = prev.price ? Math.round(((newest.price - prev.price) / prev.price) * 1000) / 10 : 0;
//       if (pct > 10) {
//         alertHtml = `
//         <div class="alert-item" style="border-color:var(--red);background:var(--red-soft);margin-bottom:14px">
//           <span class="alert-ico t-red"><i class="fa-solid fa-arrow-trend-up"></i></span>
//           <span style="min-width:0">
//             <span class="alert-title" style="color:var(--red)">CẢNH BÁO TĂNG GIÁ MUA VƯỢT NGƯỠNG 10%</span>
//             <div class="alert-sub">Sản phẩm <b>${esc(Q.material(selMatId)?.name)}</b> tăng <b>+${pct}%</b> (từ ${fmtVND(prev.price)} lên ${fmtVND(newest.price)}) vào ngày ${fmtDate(newest.date)}</div>
//           </span>
//         </div>`;
//       }
//     }

//     const rows = filtered.map((x) => `
//       <tr>
//         <td><span class="code">${x.materialId}</span></td>
//         <td><div class="strong">${esc(Q.material(x.materialId)?.name)}</div></td>
//         <td>${esc(Q.supplierName(x.supplierId))}</td>
//         <td><span class="code" style="color:var(--primary)">${x.poId}</span></td>
//         <td class="num">${fmtDate(x.date)}</td>
//         <td class="right num">${fmtN(x.qty)}</td>
//         <td class="right strong num" style="color:var(--primary)">${fmtVND(x.price)}</td>
//         <td class="right strong num">${fmtVND(x.amount)}</td>
//       </tr>`);

//     return `
//     ${alertHtml}
//     <div class="card">
//       <div class="toolbar">
//         ${selectFilter('purchases', 'materialId', matList, 'Tất cả vật tư')}
//         <span class="spacer"></span>
//         <span class="chip"><i class="fa-solid fa-chart-line"></i> ${filtered.length} lượt theo dõi giá</span>
//       </div>
//       ${tableShell(
//         [{ t: 'Mã VT', w: '90px' }, { t: 'Tên nguyên vật liệu' }, { t: 'Nhà cung cấp' }, { t: 'Đơn PO', w: '110px' },
//          { t: 'Ngày mua' }, { t: 'Số lượng', cls: 'right' }, { t: 'Đơn giá mua', cls: 'right' }, { t: 'Thành tiền', cls: 'right' }],
//         rows, { emptyTitle: 'Chưa có lịch sử giá mua nào' })}
//     </div>`;
//   };

//   /* -------------------------------------------------- TAB 7: ĐÁNH GIÁ NCC */
//   const renderEvaluationsTab = () => {
//     const rows = DB.supplierEvaluations.map((e) => `
//       <tr>
//         <td><span class="code">${e.supplierId}</span></td>
//         <td><div class="strong">${esc(Q.supplierName(e.supplierId))}</div></td>
//         <td class="center strong num">${e.priceScore} / 5</td>
//         <td class="center strong num">${e.deliveryScore} / 5</td>
//         <td class="center strong num">${e.qualityScore} / 5</td>
//         <td class="center strong num">${e.fulfillmentScore} / 5</td>
//         <td class="center strong num" style="color:var(--primary);font-size:15px">${e.totalScore}</td>
//         <td><span class="badge ${e.totalScore >= 4.6 ? 'green' : e.totalScore >= 4.0 ? 'blue' : 'orange'}">${esc(e.ratingLabel)}</span></td>
//         <td class="muted">${esc(e.notes)}</td>
//       </tr>`);

//     return `
//     <div class="card">
//       <div class="card-head"><div><h3>Đánh giá năng lực nhà cung cấp theo dữ liệu mua hàng</h3><p>Điểm số tính dựa trên 5 tiêu chí: Giá cả, Giao hàng đúng hạn, Chất lượng hàng hóa, Tỷ lệ hoàn thành đơn và Độ ổn định</p></div></div>
//       ${tableShell(
//         [{ t: 'Mã NCC', w: '90px' }, { t: 'Tên Nhà cung cấp' }, { t: 'Giá cả', cls: 'center' }, { t: 'Đúng hạn', cls: 'center' },
//          { t: 'Chất lượng', cls: 'center' }, { t: 'Hoàn thành', cls: 'center' }, { t: 'Điểm tổng hợp', cls: 'center' }, { t: 'Xếp loại' }, { t: 'Ghi chú' }],
//         rows, { emptyTitle: 'Chưa có dữ liệu đánh giá nhà cung cấp' })}
//     </div>`;
//   };

//   /* -------------------------------------------------- TAB 8: DASHBOARD MUA HÀNG */
//   const renderDashboardTab = () => {
//     const pendingPR = DB.purchases.filter((p) => ['mh_cho_duyet', 'PENDING_APPROVAL'].includes(p.status)).length;
//     const shippingPO = DB.purchaseOrders.filter((p) => p.status === 'SHIPPING').length;
//     const partialPO = DB.purchaseOrders.filter((p) => p.status === 'PARTIAL_RECEIVED').length;
//     const fullPO = DB.purchaseOrders.filter((p) => p.status === 'RECEIVED').length;
//     const totalPoVal = DB.purchaseOrders.reduce((s, p) => s + p.total, 0);
//     const totalPaidVal = DB.purchaseOrders.reduce((s, p) => s + p.paid, 0);
//     const remainingDebt = totalPoVal - totalPaidVal;
//     const lowStockCount = Q.lowStock().length;

//     return `
//     <div class="grid g-4" style="margin-bottom:14px">
//       ${mkpi('PR chờ duyệt', pendingPR, 'fa-hourglass-half', 'orange')}
//       ${mkpi('PO đang giao', shippingPO, 'fa-truck-fast', 'teal')}
//       ${mkpi('PO nhận 1 phần', partialPO, 'fa-boxes-packing', 'indigo')}
//       ${mkpi('PO đã nhận đủ', fullPO, 'fa-circle-check', 'green')}
//       ${mkpi('Tổng giá trị mua PO', fmtShort(totalPoVal), 'fa-sack-dollar', 'blue')}
//       ${mkpi('Nợ phải trả NCC', fmtShort(remainingDebt), 'fa-file-invoice-dollar', 'red')}
//       ${mkpi('Vật tư sắp hết tồn', lowStockCount, 'fa-triangle-exclamation', 'orange')}
//       ${mkpi('Nhà cung cấp', DB.suppliers.length, 'fa-handshake', 'teal')}
//     </div>

//     <div class="grid g-21" style="margin-bottom:14px">
//       <div class="card">
//         <div class="card-head"><div><h3>Phân bổ giá trị mua hàng theo Nhà cung cấp</h3><p>Tỷ trọng mua sắm theo từng nhà đối tác</p></div></div>
//         <div class="card-body"><div class="chart-box"><canvas id="chPurchaseSupplier"></canvas></div></div>
//       </div>

//       <div class="card">
//         <div class="card-head"><div><h3>Trạng thái các Đơn đặt hàng (PO)</h3><p>Tổng ${DB.purchaseOrders.length} đơn PO đang theo dõi</p></div></div>
//         <div class="card-body"><div class="chart-box sm"><canvas id="chPoStatus"></canvas></div></div>
//       </div>
//     </div>`;
//   };

//   /* --- RENDER CHÍNH THEO TAB --- */
//   let tabContent = '';
//   if (f.tab === 'quotes') tabContent = renderQuotesTab();
//   else if (f.tab === 'po') tabContent = renderPoTab();
//   else if (f.tab === 'receipts') tabContent = renderReceiptsTab();
//   else if (f.tab === 'debts') tabContent = renderDebtsTab();
//   else if (f.tab === 'price_history') tabContent = renderPriceHistoryTab();
//   else if (f.tab === 'evaluations') tabContent = renderEvaluationsTab();
//   else if (f.tab === 'dashboard') tabContent = renderDashboardTab();
//   else if (f.tab === 'suppliers') tabContent = Views.suppliers ? Views.suppliers() : '';
//   else tabContent = renderPrTab();

//   return `
//   ${pageHead('Trung tâm Quản lý Mua sắm (Purchase)', 'Quy trình: Đề nghị mua → Duyệt PR → Báo giá NCC → Đơn hàng → Nhập kho → Công nợ', `
//     <button class="btn" data-act="export-purchases"><i class="fa-solid fa-file-export"></i>Export dữ liệu</button>
//     <button class="btn btn-primary" data-act="new-pr"><i class="fa-solid fa-plus"></i>Tạo Yêu cầu mua</button>
//   `)}

//   <div class="tabs" style="margin-bottom:16px">
//     ${tabs.map((t) => `<button class="tab ${f.tab === t.id ? 'active' : ''}" data-act="purchase-tab-change" data-tab="${t.id}">
//       ${esc(t.label)} ${t.count !== '' ? `<span class="cnt">${t.count}</span>` : ''}
//     </button>`).join('')}
//   </div>

//   ${tabContent}`;
// };

// Views.purchases.after = function () {
//   const f = F('purchases', { tab: 'pr' });
//   if (f.tab === 'dashboard') {
//     const suppliers = DB.suppliers.slice(0, 5);
//     const supplierVals = suppliers.map((s) => DB.purchaseOrders.filter((p) => p.supplierId === s.id).reduce((sum, p) => sum + p.total, 0));
//     Charts.bar('chPurchaseSupplier', suppliers.map((s) => s.name.slice(0, 18) + '…'), [
//       { label: 'Giá trị mua (VND)', data: supplierVals, color: 'blue' }
//     ]);

//     const poStatuses = ['po_draft', 'po_sent_to_supplier', 'po_shipping', 'po_partial_received', 'po_received'];
//     const poCounts = [
//       DB.purchaseOrders.filter((p) => p.status === 'DRAFT').length,
//       DB.purchaseOrders.filter((p) => p.status === 'SENT_TO_SUPPLIER').length,
//       DB.purchaseOrders.filter((p) => p.status === 'SHIPPING').length,
//       DB.purchaseOrders.filter((p) => p.status === 'PARTIAL_RECEIVED').length,
//       DB.purchaseOrders.filter((p) => p.status === 'RECEIVED').length,
//     ];
//     Charts.donut('chPoStatus', ['Nháp PO', 'Đã gửi NCC', 'Đang giao', 'Nhận 1 phần', 'Đã nhận đủ'], poCounts, ['slate', 'blue', 'teal', 'orange', 'green']);
//   }
// };

/* ------------------------------------------------------------ MODALS MUA HÀNG */

/** Modal xem chi tiết Đề nghị mua hàng (PR) */
// function openPRModal(id) {
//   const p = Q.purchase(id);
//   if (!p) return;
//   const s = Q.supplier(p.supplierId);
//   const isPending =
//   PURCHASE_INVENTORY_CONFIG
//     .prStatus
//     .pending
//     .includes(p.status);


// const isApproved =
//   PURCHASE_INVENTORY_CONFIG
//     .prStatus
//     .approved
//     .includes(p.status);
//   const approvals = DB.purchaseApprovals.filter((a) => a.prId === id);

//   Modal.open({
//     title: `Đề nghị mua hàng (PR) ${p.id}`,
//     sub: `${esc(s.name)} · Người yêu cầu ${esc(Q.employeeName(p.requesterId))}`,
//     size: 'md',
//     body: `
//       <div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:16px">
//         ${badge(p.status)}
//         <span class="chip"><i class="fa-regular fa-calendar"></i> Ngày tạo: ${fmtDate(p.date)}</span>
//         <span class="chip"><i class="fa-solid fa-truck"></i> Ngày cần hàng: ${fmtDate(p.expectedDate)}</span>
//       </div>

//       <div class="form-sec-title"><i class="fa-solid fa-circle-info"></i>Thông tin đề nghị</div>
//       <div class="info-grid" style="margin-bottom:16px">
//         ${infoItem('Bộ phận đề nghị', esc(p.dept || 'Sản xuất'))}
//         ${infoItem('Nhà cung cấp dự kiến', esc(s.name))}
//         ${infoItem('Người phê duyệt', p.approvedBy ? esc(Q.employeeName(p.approvedBy)) : '<span class="muted">Chưa duyệt</span>')}
//         ${infoItem('Tổng giá trị đề xuất', `<b class="num" style="color:var(--primary);font-size:15px">${fmtVND(p.total)}</b>`)}
//       </div>

//       <div style="font-size:12.8px;color:var(--text-2);background:var(--surface-2);border-radius:var(--r);padding:10px 12px;margin-bottom:16px">
//         <b>Mục đích / Lý do đề xuất:</b> ${esc(p.reason)}
//       </div>

//       <div class="form-sec-title"><i class="fa-solid fa-list-check"></i>Danh sách vật tư đề nghị</div>
//       ${tableShell(
//         [{ t: 'Mã VT', w: '88px' }, { t: 'Tên vật tư' }, { t: 'Số lượng', cls: 'right' }, { t: 'ĐVT' }, { t: 'Đơn giá dự kiến', cls: 'right' }, { t: 'Thành tiền', cls: 'right' }],
//         p.items.map((it) => `<tr>
//           <td><span class="code">${it.materialId}</span></td>
//           <td class="strong">${esc(it.name)}</td>
//           <td class="right num strong">${fmtN(it.qty)}</td>
//           <td>${esc(it.unit)}</td>
//           <td class="right num">${fmtVND(it.price)}</td>
//           <td class="right strong num">${fmtVND(it.amount)}</td></tr>`))}

//       ${approvals.length ? `
//       <div class="form-sec-title" style="margin-top:16px"><i class="fa-solid fa-clock-rotate-left"></i>Lịch sử phê duyệt</div>
//       <div class="tline" style="margin-bottom:16px">
//         ${approvals.map((a) => `<div class="tline-item done">
//           <span class="tline-dot t-${a.action === 'approve' ? 'green' : 'red'}"><i class="fa-solid fa-${a.action === 'approve' ? 'check' : 'xmark'}"></i></span>
//           <div class="tline-title">${esc(Q.employeeName(a.approverId))} — <span style="color:var(--${a.action === 'approve' ? 'green' : 'red'})">${a.action === 'approve' ? 'Phê duyệt' : 'Từ chối'}</span></div>
//           <div class="tline-sub">${esc(a.note)} · ${fmtDate(a.time)}</div>
//         </div>`).join('')}
//       </div>` : ''}`,
//     foot: `${isPending ? `<button class="btn btn-danger left" data-act="pr-reject-modal" data-id="${p.id}"><i class="fa-solid fa-xmark"></i>Từ chối PR</button>
//            <button class="btn btn-success" data-act="pr-approve-action" data-id="${p.id}"><i class="fa-solid fa-check"></i>Phê duyệt PR</button>` : ''}
//            ${isApproved ? `<button class="btn btn-primary" data-act="pr-convert-po" data-id="${p.id}"><i class="fa-solid fa-file-export"></i>Tạo PO từ PR này</button>` : ''}
//            <button class="btn" data-act="modal-close">Đóng</button>`,
//   });
// }

/** Modal Form Tạo Đề nghị mua hàng (PR) — Kiểm soát Ngân sách & Tồn kho tối thiểu */
// function openPRForm(materialId) {

//   const cfg =
//     PURCHASE_INVENTORY_CONFIG.defaultPR;


//   const low =
//     materialId
//       ? [Q.material(materialId)].filter(Boolean)
//       : Q.lowStock();


//   const suggestions =
//     low.length
//       ? low
//       : DB.materials.slice(0, 3);


//   const deptBudget =
//     Q.deptBudget(cfg.department) || {
//       totalBudget: 2500000000,
//       usedBudget: 1850000000,
//       remaining: 650000000
//     };

//   // Kiểm tra tồn kho tối thiểu trước khi tạo PR
//   let minStockWarn = '';
//   if (materialId) {
//     const m = Q.material(materialId);
//     if (m && m.stock >= m.minStock) {
//       minStockWarn = `
//       <div class="alert-item" style="border-color:var(--orange);background:var(--orange-soft);margin-bottom:14px">
//         <span class="alert-ico t-orange"><i class="fa-solid fa-triangle-exclamation"></i></span>
//         <span style="min-width:0">
//           <span class="alert-title" style="color:var(--orange)">CẢNH BÁO TỒN KHO TRÊN MỨC TỐI THIỂU</span>
//           <div class="alert-sub">Vật tư <b>${esc(m.name)}</b> hiện đang có tồn kho <b>${fmtDec(m.stock, 2)} ${m.unit}</b> (>= Định mức tối thiểu ${fmtDec(m.minStock, 2)} ${m.unit}). Cân nhắc xem có thực sự cần mua thêm không.</div>
//         </span>
//       </div>`;
//     }
//   }

// //   Modal.open({
// //     title: 'Tạo Đề nghị mua hàng (Purchase Request)',
// //     sub: 'Điền thông tin nguyên vật liệu cần mua sắm phục vụ sản xuất / dự phòng tồn kho',
// //     size: 'md',
// //     body: `
// //       ${minStockWarn}
// //       <div class="form-grid">
// //         <div class="field"><label>Bộ phận đề nghị</label>
// //           <select class="inp" id="prDept">
// //             ${DB.departments.map((d) => `<option value="${esc(d)}" ${d === cfg.department ? 'selected' : ''}>${esc(d)}</option>`).join('')}
// //           </select></div>
// //         <div class="field"><label>Người đề nghị <span class="req">*</span></label>
// //           <select class="inp" id="prRequester">
// //             ${DB.employees.slice(0, 25).map((e) => `<option value="${e.id}" ${e.id === cfg.requesterId ? 'selected' : ''}>${esc(e.name)} — ${esc(e.dept)}</option>`).join('')}
// //           </select></div>
// //       </div>

// //       <div class="form-grid">
// //         <div class="field"><label>Nhà cung cấp dự kiến</label>
// //           <select class="inp" id="prSupplier">
// //             ${DB.suppliers.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
// //           </select></div>
// //         <div class="field"><label>Ngày cần hàng <span class="req">*</span></label>
// //           <input class="inp" type="date" id="prExpectedDate" value="${addDays(
// //   DB.today,
// //   cfg.expectedDays
// // )}" /></div>
// //       </div>

// //       <div class="field"><label>Mục đích / Lý do đề nghị mua <span class="req">*</span></label>
// //         <input class="inp" id="prReason" value="${esc(low.length ? 'Bổ sung vật tư cho sản xuất & tồn kho tối thiểu' : 'Phục vụ đơn hàng sản xuất quý III')}" placeholder="Nhập lý do mua sắm…" /></div>

// //       <!-- Thông tin ngân sách phòng ban -->
// //       <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r);padding:10px 14px;margin-bottom:14px;font-size:12.4px">
// //         <span>Ngân sách còn lại phòng Sản xuất: <b class="num" style="color:var(--green)">${fmtVND(deptBudget.remaining)}</b> / Total ${fmtShort(deptBudget.totalBudget)}</span>
// //         <span class="chip t-blue"><i class="fa-solid fa-piggy-bank"></i> Trong hạn mức</span>
// //       </div>

// //       <div class="form-sec-title"><i class="fa-solid fa-list-check"></i>Danh sách vật tư đề nghị mua</div>
// //       <div class="tbl-wrap" style="border:1px solid var(--border);border-radius:var(--r)">
// //         <table class="line-tbl" style="min-width:560px">
// //           <thead><tr><th style="width:40px"></th><th>Vật tư</th><th class="right">Tồn / Tối thiểu</th><th class="right">SL yêu cầu</th><th class="right">Đơn giá dự kiến</th></tr></thead>
// //           <tbody>
// //             ${suggestions.map((m) => {
// //               const need = Math.max(m.minStock * 2 - m.stock, m.minStock);
// //               return `<tr>
// //                 <td class="center"><input type="checkbox" class="pr-pick" data-id="${m.id}" checked style="width:16px;height:16px;accent-color:var(--primary)" /></td>
// //                 <td><div class="strong" style="font-size:12.6px">${esc(m.name)}</div><div class="muted" style="font-size:11.4px">${m.id} · ${esc(m.group)}</div></td>
// //                 <td class="right num muted">${fmtDec(m.stock, 2)} / ${fmtDec(m.minStock, 2)} ${esc(m.unit)}</td>
// //                 <td class="right"><input class="inp right num pr-qty" data-id="${m.id}" type="number" min="1" value="${Math.round(need)}" style="width:100px" /></td>
// //                 <td class="right num">${fmtVND(m.price)}</td>
// //               </tr>`;
// //             }).join('')}
// //           </tbody>
// //         </table>
// //       </div>`,
// //     foot: `<button class="btn" data-act="modal-close">Hủy</button>
// //            <button class="btn btn-primary" data-act="pr-save"><i class="fa-solid fa-paper-plane"></i>Gửi đề nghị mua</button>`,
// //   });
//  }

/** Modal Từ chối PR kèm ghi lý do */
// function openPRRejectModal(prId) {
//   Modal.open({
//     title: 'Từ chối Đề nghị mua hàng',
//     sub: `Mã PR: ${prId} — Nhập lý do từ chối để gửi thông báo cho người đề xuất`,
//     body: `<div class="field"><label>Lý do từ chối <span class="req">*</span></label>
//       <textarea class="inp" id="prRejectReason" rows="3" placeholder="Nhập lý do từ chối cụ thể (ví dụ: tồn kho hiện tại vẫn đủ dùng, đề xuất vượt ngân sách…)"></textarea></div>`,
//     foot: `<button class="btn" data-act="modal-close">Hủy</button>
//            <button class="btn btn-danger" data-act="pr-reject-save" data-id="${prId}"><i class="fa-solid fa-xmark"></i>Xác nhận từ chối</button>`,
//   });
// }

/** Modal Thêm Báo giá Nhà cung cấp cho 1 PR */
// function openQuotationModal(prId) {
//   const pr = Q.purchase(prId) || DB.purchases[0];
//   Modal.open({
//     title: 'Thêm Báo giá Nhà cung cấp',
//     sub: `Báo giá cho Đề nghị mua ${pr ? pr.id : ''}`,
//     size: 'md',
//     body: `
//       <div class="form-grid">
//         <div class="field"><label>Nhà cung cấp <span class="req">*</span></label>
//           <select class="inp" id="sqSupplier">
//             ${DB.suppliers.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
//           </select></div>
//         <div class="field"><label>Thời gian giao hàng (Lead time)</label>
//           <input class="inp num" type="number" id="sqLeadTime" value="7" placeholder="Số ngày giao hàng" /></div>
//       </div>
//       <div class="form-grid">
//         <div class="field"><label>Ngày báo giá</label><input class="inp" type="date" id="sqDate" value="${DB.today}" /></div>
//         <div class="field"><label>Thời hạn hiệu lực</label><input class="inp" type="date" id="sqValid" value="${addDays(DB.today, 15)}" /></div>
//       </div>
//       <div class="field"><label>Điều khoản thanh toán</label>
//         <input class="inp" id="sqTerm" value="30% tạm ứng, 70% sau khi giao hàng" /></div>

//       <div class="form-sec-title"><i class="fa-solid fa-tags"></i>Đơn giá báo cho các vật tư</div>
//       <div class="tbl-wrap" style="border:1px solid var(--border);border-radius:var(--r)">
//         <table class="line-tbl">
//           <thead><tr><th>Vật tư</th><th class="right">SL yêu cầu</th><th class="right">Đơn giá báo (VND)</th></tr></thead>
//           <tbody>
//             ${pr.items.map((it) => `<tr>
//               <td><div class="strong">${esc(it.name)}</div><div class="cell-sub">${it.materialId}</div></td>
//               <td class="right num">${fmtN(it.qty)} ${esc(it.unit)}</td>
//               <td class="right"><input class="inp right num sq-price" data-id="${it.materialId}" data-qty="${it.qty}" type="number" value="${it.price}" style="width:130px" /></td>
//             </tr>`).join('')}
//           </tbody>
//         </table>
//       </div>`,
//     foot: `<button class="btn" data-act="modal-close">Hủy</button>
//            <button class="btn btn-primary" data-act="quote-save-supplier" data-prid="${pr ? pr.id : ''}"><i class="fa-solid fa-floppy-disk"></i>Lưu báo giá NCC</button>`,
//   });
// }

/** Modal Xem Chi tiết Đơn đặt hàng PO */
function openPOModal(id) {
  const po = Q.purchaseOrder(id);
  if (!po) return;
  const s = Q.supplier(po.supplierId);
  const receipts = Q.receiptsOfPo(id);
  const payments = Q.paymentsOfPo(id);

  Modal.open({
    title: `Đơn đặt hàng (Purchase Order) ${po.id}`,
    sub: `${esc(s.name)} · Khởi tạo từ ${po.prId}`,
    size: 'md',
    body: `
      <div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:16px">
        ${badge(po.status)}
        <span class="chip"><i class="fa-regular fa-calendar"></i> Ngày PO: ${fmtDate(po.date)}</span>
        <span class="chip"><i class="fa-solid fa-truck"></i> Dự kiến giao: ${fmtDate(po.expectedDate)}</span>
      </div>

      <div class="form-sec-title"><i class="fa-solid fa-circle-info"></i>Thông tin đơn PO</div>
      <div class="info-grid" style="margin-bottom:16px">
        ${infoItem('Nhà cung cấp', esc(s.name))}
        ${infoItem('Đầu mối liên hệ', `${esc(s.contact)} · ${esc(s.phone)}`)}
        ${infoItem('Điều khoản thanh toán', esc(po.paymentTerm))}
        ${infoItem('Tổng tiền PO', `<b class="num" style="color:var(--primary);font-size:15px">${fmtVND(po.total)}</b>`)}
        ${infoItem('Đã thanh toán', `<b class="num" style="color:var(--green)">${fmtVND(po.paid)}</b>`)}
        ${infoItem('Công nợ còn lại', `<b class="num" style="color:var(--red)">${fmtVND(po.total - po.paid)}</b>`)}
      </div>

      <div class="form-sec-title"><i class="fa-solid fa-boxes-stacked"></i>Danh sách vật tư đặt hàng</div>
      ${tableShell(
        [{ t: 'Mã VT', w: '88px' }, { t: 'Tên vật tư' }, { t: 'SL Đặt', cls: 'right' }, { t: 'SL Đã nhận', cls: 'right' }, { t: 'Đơn giá', cls: 'right' }, { t: 'Thành tiền', cls: 'right' }],
        po.items.map((it) => `<tr>
          <td><span class="code">${it.materialId}</span></td>
          <td class="strong">${esc(it.name)}</td>
          <td class="right num strong">${fmtN(it.qty)} ${esc(it.unit)}</td>
          <td class="right num" style="color:${it.receivedQty >= it.qty ? 'var(--green)' : 'var(--orange)'}">${fmtN(it.receivedQty || 0)} ${esc(it.unit)}</td>
          <td class="right num">${fmtVND(it.price)}</td>
          <td class="right strong num">${fmtVND(it.amount)}</td></tr>`))}

      ${receipts.length ? `
      <div class="form-sec-title" style="margin-top:16px"><i class="fa-solid fa-warehouse"></i>Lịch sử nhập kho</div>
      ${tableShell(
        [{ t: 'Phiếu nhập' }, { t: 'Ngày nhận' }, { t: 'Kho nhận' }, { t: 'Người nhận' }],
        receipts.map((r) => `<tr><td><span class="code">${r.id}</span></td><td class="num">${fmtDate(r.date)}</td><td>${esc(r.warehouse)}</td><td>${esc(Q.employeeName(r.receivedBy))}</td></tr>`))}` : ''}`,
    foot: `<button class="btn" data-act="modal-close">Đóng</button>`,
  });
}

/** Modal Nhập kho nguyên vật liệu từ PO (Hỗ trợ Nhập kho từng phần - Partial Receipt) */
function openGoodsReceiptModal(poId) {
  const po = Q.purchaseOrder(poId);
  if (!po) return;

  Modal.open({
    title: `Phiếu Nhập kho hàng mua (Goods Receipt)`,
    sub: `Nhập kho theo Đơn hàng ${po.id} — Nhà cung cấp ${esc(Q.supplierName(po.supplierId))}`,
    size: 'md',
    body: `
      <div class="form-grid">
        <div class="field"><label>Kho nhận hàng <span class="req">*</span></label>
          <select class="inp" id="grWarehouse">
            <option value="WH-001">Kho Nguyên vật liệu chính</option>
            <option value="WH-002">Kho Phân xưởng sản xuất</option>
            <option value="WH-004">Kho Thành phẩm lạnh</option>
          </select></div>
        <div class="field"><label>Người nhận hàng</label>
          <select class="inp" id="grReceiver">
            ${DB.employees.filter((e) => e.dept === 'Kho vận').map((e) => `<option value="${e.id}" ${e.id === 'NV-018' ? 'selected' : ''}>${esc(e.name)} — Thủ kho</option>`).join('')}
          </select></div>
      </div>
      <div class="field"><label>Ghi chú nhập kho</label>
        <input class="inp" id="grNote" value="Nhập kho nguyên vật liệu theo đơn PO ${po.id}" placeholder="Ghi chú phiếu nhập…" /></div>

      <div class="form-sec-title"><i class="fa-solid fa-boxes-packing"></i>Số lượng thực nhận đợt này</div>
      <div class="tbl-wrap" style="border:1px solid var(--border);border-radius:var(--r)">
        <table class="line-tbl">
          <thead><tr><th>Vật tư</th><th class="right">SL Đặt</th><th class="right">Đã nhận trước</th><th class="right">SL Nhập đợt này</th></tr></thead>
          <tbody>
            ${po.items.map((it) => {
              const remain = Math.max(0, it.qty - (it.receivedQty || 0));
              return `<tr>
                <td><div class="strong">${esc(it.name)}</div><div class="cell-sub">${it.materialId}</div></td>
                <td class="right num">${fmtN(it.qty)} ${esc(it.unit)}</td>
                <td class="right num muted">${fmtN(it.receivedQty || 0)} ${esc(it.unit)}</td>
                <td class="right"><input class="inp right num gr-qty" data-id="${it.materialId}" data-max="${remain}" type="number" min="0" max="${remain}" value="${remain}" style="width:120px" /></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button>
           <button class="btn btn-success" data-act="goods-receipt-save" data-poid="${po.id}"><i class="fa-solid fa-warehouse"></i>Xác nhận Nhập kho</button>`,
  });
}

/** Modal Ghi nhận Thanh toán Công nợ Nhà cung cấp */
function openPaymentModal(poId) {
  const po = Q.purchaseOrder(poId);
  if (!po) return;
  const remain = po.total - po.paid;

  Modal.open({
    title: 'Ghi nhận Thanh toán Công nợ NCC',
    sub: `Đơn PO ${po.id} — Nợ còn lại: ${fmtVND(remain)}`,
    body: `
      <div class="form-grid">
        <div class="field"><label>Số tiền thanh toán (VND) <span class="req">*</span></label>
          <input class="inp right num" type="number" id="payAmount" min="1" max="${remain}" value="${remain}" /></div>
        <div class="field"><label>Hình thức thanh toán</label>
          <select class="inp" id="payMethod"><option value="Chuyển khoản">Chuyển khoản ngân hàng</option><option value="Tiền mặt">Tiền mặt</option></select></div>
      </div>
      <div class="field"><label>Mã giao dịch / Số chứng từ bank</label>
        <input class="inp" id="payRef" value="FT${Date.now().toString().slice(-8)}" /></div>
      <div class="field"><label>Ghi chú thanh toán</label>
        <input class="inp" id="payNote" value="Thanh toán công nợ PO ${po.id}" /></div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button>
           <button class="btn btn-primary" data-act="supplier-pay-save" data-poid="${po.id}"><i class="fa-solid fa-floppy-disk"></i>Lưu thanh toán</button>`,
  });
}

/* ============================================================================
 * MODULE: PHÂN HỆ KHO (INVENTORY)
 * inv-overview | inv-receipts | inv-issues | inv-transfers | inv-counts | inv-lots
 * ==========================================================================*/

/* ------------- Màn 1: TỔNG QUAN TỒN KHO --------------------------------- */
Views['inv-overview'] = function () {
  const f = F('inv-overview', { q: '', warehouseId: '', status: '' });
  const q = (f.q || '').toLowerCase().trim();
  const today = new Date(DB.today + 'T00:00:00');
  const nearDays = DB.inventoryAlertConfig.nearExpiryDays;

  // Tổng hợp KPI
  const totalSKU = new Set(DB.inventory.map((i) => i.productId)).size;
  const totalOnHand = DB.inventory.reduce((s, i) => s + i.qtyOnHand, 0);
  const inventoryVal = DB.materials.reduce((s, m) => s + m.value, 0);
  const lowStockCnt = Q.lowStockAlerts().length;
  const nearExpiryCnt = Q.nearExpiryLots().length;
  const expiredCnt = Q.expiredLots().length;

  // Lọc danh sách tồn kho
  const list = DB.inventory.filter((inv) => {
    if (f.warehouseId && inv.warehouseId !== f.warehouseId) return false;
    const lot = DB.inventoryLots.find((l) => l.id === inv.lotId);
    const mat = DB.materials.find((m) => m.id === inv.productId) || DB.products.find((p) => p.id === inv.productId);
    if (q && ![(mat ? mat.name : ''), inv.productId, inv.warehouseId, inv.locationId].some((v) => String(v).toLowerCase().includes(q))) return false;
    const exp = lot ? new Date(lot.expiryDate + 'T00:00:00') : null;
    if (f.status === 'near_expiry') return exp && exp >= today && (exp - today) / 86400000 <= nearDays;
    if (f.status === 'expired') return exp && exp < today;
    if (f.status === 'low_stock') { const m = DB.materials.find((x) => x.id === inv.productId); return m && m.stock < m.minStock; }
    return true;
  });
  const pg = paged(list, 'inv-overview');

  const warehouses = DB.warehouses.map((w) => [w.id, w.name]);

  const rows = pg.items.map((inv) => {
    const lot = DB.inventoryLots.find((l) => l.id === inv.lotId);
    const mat = DB.materials.find((m) => m.id === inv.productId) || DB.products.find((p) => p.id === inv.productId);
    const wh = DB.warehouses.find((w) => w.id === inv.warehouseId);
    const loc = DB.warehouseLocations.find((l) => l.id === inv.locationId);
    const exp = lot ? new Date(lot.expiryDate + 'T00:00:00') : null;
    const daysLeft = exp ? Math.round((exp - today) / 86400000) : null;
    let expBadge = '';
    if (exp) {
      if (daysLeft < 0) expBadge = `<span class="badge red">Hết hạn ${Math.abs(daysLeft)} ngày</span>`;
      else if (daysLeft <= nearDays) expBadge = `<span class="badge orange">Còn ${daysLeft} ngày</span>`;
      else expBadge = `<span class="badge green">Còn ${daysLeft} ngày</span>`;
    }
    return `<tr class="clickable" data-act="inv-lot-detail" data-lotid="${inv.lotId}">
      <td><span class="code">${inv.productId}</span></td>
      <td>${cell2(esc(mat ? mat.name : inv.productId), '')}</td>
      <td><span class="chip">${esc(wh ? wh.name : inv.warehouseId)}</span></td>
      <td class="muted" style="font-size:12px">${esc(loc ? loc.name : inv.locationId)}</td>
      <td>${lot ? `<span class="code" style="font-size:11px">${lot.lotNumber}</span>` : '—'}</td>
      <td>${lot ? `<span class="code" style="font-size:11px">${esc(lot.supplierLot || '—')}</span>` : '—'}</td>
      <td class="num">${lot ? fmtDate(lot.mfgDate) : '—'}</td>
      <td>${expBadge || (lot ? fmtDate(lot.expiryDate) : '—')}</td>
      <td class="right strong num">${fmtDec(inv.qtyOnHand, 2)} ${esc(inv.unit)}</td>
      <td class="right num muted">${fmtDec(inv.qtyReserved, 2)}</td>
      <td class="right strong num" style="color:${inv.qtyAvailable <= 0 ? 'var(--red)' : 'var(--green)'}">${fmtDec(inv.qtyAvailable, 2)}</td>
    </tr>`;
  });

  return `
  ${pageHead('Tổng quan tồn kho', `${totalSKU} SKU · Tổng tồn ${fmtShort(inventoryVal)}`, `
    <button class="btn" data-act="inv-export-stock"><i class="fa-solid fa-file-export"></i>Xuất Excel</button>
    <button class="btn btn-primary" data-act="inv-new-receipt"><i class="fa-solid fa-plus"></i>Lập phiếu nhập</button>
  `)}
  <div class="grid g-auto-sm" style="margin-bottom:14px">
    ${mkpi('Tổng SKU', totalSKU, 'fa-boxes-stacked', 'blue')}
    ${mkpi('Tồn kho thực tế', fmtN(totalOnHand), 'fa-warehouse', 'teal')}
    ${mkpi('Giá trị tồn kho', fmtShort(inventoryVal), 'fa-sack-dollar', 'indigo')}
    ${mkpi('Dưới tồn tối thiểu', lowStockCnt, 'fa-triangle-exclamation', 'orange')}
    ${mkpi('Lô cận hạn ≤' + nearDays + ' ngày', nearExpiryCnt, 'fa-calendar-minus', 'orange')}
    ${mkpi('Lô đã hết hạn', expiredCnt, 'fa-circle-xmark', 'red')}
  </div>

  ${expiredCnt > 0 ? `
  <div class="alert-item" style="border-color:var(--red);background:var(--red-soft);margin-bottom:14px">
    <span class="alert-ico t-red"><i class="fa-solid fa-circle-xmark"></i></span>
    <span style="min-width:0">
      <span class="alert-title" style="color:var(--red)">CÓ ${expiredCnt} LÔ ĐÃ HẾT HẠN SỬ DỤNG</span>
      <div class="alert-sub">Cần xử lý ngay — chuyển sang kho hàng lỗi hoặc tiêu hủy theo quy trình</div>
    </span>
    <button class="btn btn-sm" data-act="inv-tab" data-tab="lots" style="flex-shrink:0">Xem lô hết hạn</button>
  </div>` : ''}

  <div class="card">
    <div class="toolbar">
      ${searchBox('inv-overview', 'Tìm mã hàng, tên hàng, kho…')}
      ${selectFilter('inv-overview', 'warehouseId', warehouses, 'Tất cả kho')}
      ${selectFilter('inv-overview', 'status', [['near_expiry', '⚠ Cận hạn'], ['expired', '❌ Hết hạn'], ['low_stock', '⬇ Dưới tồn min']], 'Tất cả tình trạng')}
      ${(f.q || f.warehouseId || f.status) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="inv-overview"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
      <span class="spacer"></span>
      <span class="chip"><i class="fa-solid fa-list"></i> ${fmtN(list.length)} bản ghi</span>
    </div>
    ${tableShell(
      [{ t: 'Mã hàng', w: '90px' }, { t: 'Tên hàng' }, { t: 'Kho' }, { t: 'Vị trí', cls: 'hide-sm' },
       { t: 'Lô hệ thống', cls: 'hide-sm' }, { t: 'Lô NCC', cls: 'hide-sm' }, { t: 'NSX' }, { t: 'HSD / Còn lại' },
       { t: 'On Hand', cls: 'right' }, { t: 'Reserved', cls: 'right hide-sm' }, { t: 'Available', cls: 'right' }],
      rows, { emptyTitle: 'Không có dữ liệu tồn kho', emptyDesc: 'Hãy nhập kho để bắt đầu theo dõi tồn kho.' })}
    ${pagiHTML('inv-overview', pg, 'bản ghi')}
  </div>`;
};

/* ------------- Màn 2: NHẬP KHO ------------------------------------------ */
Views['inv-receipts'] = function () {
  const f = F('inv-receipts', { q: '', status: '', supplier: '', receiptTab: 'raw' });
  const q = (f.q || '').toLowerCase().trim();
  const receiptTab = f.receiptTab || 'raw';
  const cfgs = {
    raw: { label:'Kho nguyên liệu', type:'RAW_MATERIAL', icon:'fa-seedling' },
    semi:{ label:'Kho bán thành phẩm', type:'SEMI_FINISHED', icon:'fa-cubes-stacked' },
    finished:{ label:'Kho thành phẩm', type:'FINISHED_GOODS', icon:'fa-box' }
  };
  const cfg = cfgs[receiptTab] || cfgs.raw;
  const whIds = new Set(DB.warehouses.filter(w=>w.type===cfg.type).map(w=>w.id));
  let rowsData = [];
  if (receiptTab === 'raw') {
    rowsData = DB.purchaseOrders.filter(po => ['SHIPPING','PARTIAL_RECEIVED','RECEIVED'].includes(po.status)).map(po => {
      const receipts = Q.receiptsOfPo(po.id).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      const ordered = (po.items||[]).reduce((n,i)=>n+Number(i.qty||0),0);
      const received = (po.items||[]).reduce((n,i)=>n+Number(i.receivedQty||0),0);
      const defectReceipts = receipts.filter(r=>['FAILED','PARTIAL_FAILED'].includes(r.inspectionStatus));
      const defectNote = defectReceipts.some(r=>r.defectType==='FULL_LOT') ? 'Lỗi nguyên lô' : defectReceipts.length ? 'Lỗi 1 phần' : '';
      return { kind:'po', id:po.id, po, receipts, ordered, received, defectNote, date:receipts[0]?.date || po.expectedDate || po.date };
    });
  } else {
    rowsData = (DB.goodsReceipts||[]).filter(r=>whIds.has(r.warehouseId)).map(r=>({kind:'receipt',id:r.id,r,date:r.date}));
  }
  rowsData = rowsData.filter(x=>{
    const text = x.kind==='po' ? [x.po.id,x.po.prId,Q.supplierName(x.po.supplierId),x.defectNote].join(' ') : [x.r.id,x.r.poId,x.r.note,Q.warehouseName(x.r.warehouseId)].join(' ');
    if (q && !text.toLowerCase().includes(q)) return false;
    if (receiptTab === 'raw' && x.kind === 'po') {
      if (f.status && x.po.status !== f.status) return false;
      if (f.supplier && x.po.supplierId !== f.supplier) return false;
    }
    return true;
  }).sort((a,b)=>{
    const hasFilter = Boolean(q || f.status || f.supplier);
    // Mặc định: giữ thứ tự cố định theo mã PO / mã phiếu, không bị thay đổi sau khi nhập kho.
    if (!hasFilter) return String(b.id||'').localeCompare(String(a.id||''), 'vi', { numeric:true, sensitivity:'base' });
    // Khi người dùng lọc/tìm kiếm, ưu tiên bản ghi có hoạt động mới hơn trong tập kết quả.
    const byDate = String(b.date||'').localeCompare(String(a.date||''));
    if (byDate) return byDate;
    return String(a.id||'').localeCompare(String(b.id||''), 'vi', { numeric:true, sensitivity:'base' });
  });
  const pg = paged(rowsData,'inv-receipts');
  const rows = pg.items.map(x=>{
    if (x.kind==='po') {
      const po=x.po; const canReceipt=['SHIPPING','PARTIAL_RECEIVED'].includes(po.status) && x.received < x.ordered;
      return `<tr>
        <td><span class="code">${po.id}</span><div class="cell-sub">${esc(po.prId||'')}</div></td>
        <td>${cell2(esc(Q.supplierName(po.supplierId)),esc((po.items||[]).map(i=>i.name).join(', ')))}</td>
        <td class="right num">${fmtN(x.received)} / ${fmtN(x.ordered)}</td>
        <td>${badge(po.status)}${x.defectNote?`<div style="margin-top:5px"><span class="badge red">${x.defectNote}</span></div>`:''}</td>
        <td class="num">${x.receipts[0]?fmtDate(x.receipts[0].date):'—'}</td>
        <td class="center">${x.receipts.length}</td>
        <td class="right">${rowActions([
          {act:'inv-po-receipt-history',data:`data-id="${po.id}"`,icon:'fa-eye',title:'Xem chi tiết'},
          ...(canReceipt?[{act:'inv-new-receipt',data:`data-poid="${po.id}"`,icon:'fa-file-circle-plus',title:'Lập phiếu nhập'}]:[])
        ])}</td>
      </tr>`;
    }
    const r=x.r;
    return `<tr><td><span class="code">${r.id}</span></td><td>${fmtDate(r.date)}</td><td>${cell2(esc(Q.warehouseName(r.warehouseId)),esc(Q.locationName(r.locationId)))}</td><td>${esc((r.items||[]).map(i=>`${i.name||i.materialId}: ${fmtN(i.qty)} ${i.unit||''}`).join(', '))}</td><td>${esc(Q.employeeName(r.receivedBy))}</td><td>${badge(r.status)}</td><td></td></tr>`;
  });
  return `${pageHead('Nhập kho','Danh sách nhập kho theo từng loại kho; thao tác được thực hiện trực tiếp tại từng dòng',`
    <button class="btn" data-act="inv-export-receipts"><i class="fa-solid fa-file-export"></i>Xuất Excel</button>
    <button class="btn btn-primary" data-act="inv-new-receipt" data-tab="${receiptTab}"><i class="fa-solid fa-plus"></i>${receiptTab==='raw'?'Phiếu nhập kho nguyên liệu':receiptTab==='semi'?'Phiếu nhập kho bán thành phẩm':'Phiếu nhập kho thành phẩm'}</button>`)}
    <div class="tabs" style="margin-bottom:14px">
      <button class="tab ${receiptTab==='raw'?'active':''}" data-act="inventory-receipt-tab" data-tab="raw"><i class="fa-solid fa-seedling"></i>Kho nguyên liệu</button>
      <button class="tab ${receiptTab==='semi'?'active':''}" data-act="inventory-receipt-tab" data-tab="semi"><i class="fa-solid fa-cubes-stacked"></i>Kho bán thành phẩm</button>
      <button class="tab ${receiptTab==='finished'?'active':''}" data-act="inventory-receipt-tab" data-tab="finished"><i class="fa-solid fa-box"></i>Kho thành phẩm</button>
    </div>
    <div class="card"><div class="toolbar">${searchBox('inv-receipts','Tìm PO, phiếu nhập, NCC, khu…')}
      ${receiptTab==='raw' ? `${selectFilter('inv-receipts','status',[['SHIPPING','Đang giao hàng'],['PARTIAL_RECEIVED','Nhận một phần'],['RECEIVED','Đã nhận đủ']],'Tất cả trạng thái')}${selectFilter('inv-receipts','supplier',DB.suppliers.map(s=>[s.id,s.name]),'Tất cả NCC')}` : ''}
      ${(f.q||f.status||f.supplier)?'<button class="btn btn-sm" data-act="clear-filter" data-key="inv-receipts"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>':''}
      <span class="spacer"></span><span class="chip">${fmtN(rowsData.length)} dòng</span></div>
    ${receiptTab==='raw' ? tableShell([{t:'Mã PO'},{t:'NCC / Nguyên liệu'},{t:'Đã nhập / Đặt',cls:'right'},{t:'Trạng thái / QC'},{t:'Nhập gần nhất'},{t:'Số đợt',cls:'center'},{t:'Thao tác',cls:'right'}],rows,{emptyTitle:'Chưa có đơn hàng nhập kho'}) : tableShell([{t:'Phiếu nhập'},{t:'Ngày'},{t:'Khu / Kệ'},{t:'Nội dung'},{t:'Người nhập'},{t:'Trạng thái'},{t:'Thao tác'}],rows,{emptyTitle:`Chưa có dữ liệu ${cfg.label.toLowerCase()}`})}
    ${pagiHTML('inv-receipts',pg,'dòng')}</div>`;
};

/* ------------- Màn 3: XUẤT KHO ------------------------------------------ */
Views['inv-issues'] = function () {
  const f = F('inv-issues', { q:'', type:'', issueTab:'raw' });
  const q=(f.q||'').toLowerCase().trim();
  const issueTab=f.issueTab||'raw';
  const cfgs={raw:{label:'Kho nguyên liệu',type:'RAW_MATERIAL',icon:'fa-seedling'},semi:{label:'Kho bán thành phẩm',type:'SEMI_FINISHED',icon:'fa-cubes-stacked'},finished:{label:'Kho thành phẩm',type:'FINISHED_GOODS',icon:'fa-box'}};
  const cfg=cfgs[issueTab]||cfgs.raw;
  const whIds=new Set(DB.warehouses.filter(w=>w.type===cfg.type).map(w=>w.id));
  const ISSUE_TYPES={PRODUCTION_ISSUE:'Xuất sản xuất',SALES_ISSUE:'Xuất bán hàng',ADJUSTMENT_OUT:'Xuất điều chỉnh',TRANSFER_OUT:'Xuất chuyển kho',DEFECTIVE_ISSUE:'Xuất hàng lỗi',RETURN_OUT:'Xuất trả NCC'};
  let entries=(DB.goodsIssues||[]).filter(gi=>whIds.has(gi.warehouseId)).map(gi=>({kind:'issue',date:gi.date,id:gi.id,gi}));
  if(issueTab==='raw') entries.push(...(DB.materialReturnRequests||[]).filter(r=>r.status==='PENDING_WAREHOUSE').map(r=>({kind:'return',date:r.requestedDate,id:r.id,r})));
  entries=entries.filter(x=>{
    if(f.type && x.kind==='issue' && x.gi.type!==f.type) return false;
    if(f.type && x.kind==='return' && f.type!=='RETURN_OUT') return false;
    const text=x.kind==='issue'?[x.gi.id,x.gi.refDoc,x.gi.note,ISSUE_TYPES[x.gi.type]].join(' '):[x.r.id,x.r.poId,Q.supplierName(x.r.supplierId),x.r.reason].join(' ');
    return !q||text.toLowerCase().includes(q);
  }).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const pg=paged(entries,'inv-issues');
  const rows=pg.items.map(x=>{
    if(x.kind==='return'){
      const r=x.r;const lot=Q.lot(r.lotId);
      return `<tr><td><span class="code">${esc(r.id)}</span><div class="cell-sub">Yêu cầu trả</div></td><td><span class="badge red">Chờ xuất trả NCC</span></td><td>${fmtDate(r.requestedDate)}</td><td>${esc(Q.warehouseName(r.warehouseId))}</td><td><span class="code">${esc(r.poId)}</span></td><td>${cell2(esc(Q.material(r.materialId)?.name||r.materialId),`Lô HT: ${esc(lot?.lotNumber||'—')} · Lô NCC: ${esc(r.supplierLot||'—')}`)}</td><td class="right strong num">${fmtN(r.qty)} ${esc(r.unit||'')}</td><td><span class="badge orange">Chờ kho xác nhận</span></td><td class="right">${rowActions([{act:'open-po',data:`data-id="${r.poId}"`,icon:'fa-eye',title:'Xem chi tiết đơn hàng'},{act:'inv-return-confirm-issue',data:`data-id="${r.id}"`,icon:'fa-arrow-right-from-bracket',title:'Xác nhận xuất trả'}])}</td></tr>`;
    }
    const gi=x.gi;const total=(gi.items||[]).reduce((n,i)=>n+Number(i.qty||0),0);
    return `<tr><td><span class="code">${esc(gi.id)}</span></td><td><span class="badge blue">${esc(ISSUE_TYPES[gi.type]||gi.type)}</span></td><td>${fmtDate(gi.date)}</td><td>${esc(Q.warehouseName(gi.warehouseId))}</td><td><span class="code">${esc(gi.refDoc||'—')}</span></td><td>${esc((gi.items||[]).map(i=>`${i.productId} (${fmtN(i.qty)})`).join(', '))}</td><td class="right num">${fmtN(total)}</td><td>${badge(gi.status)}</td><td class="right">${rowActions([{act:'inv-issue-view',data:`data-id="${gi.id}"`,icon:'fa-eye',title:'Xem chi tiết'}])}</td></tr>`;
  });
  return `${pageHead('Xuất kho','Danh sách phiếu và yêu cầu xuất được quản lý chung theo từng loại kho',`
    <button class="btn" data-act="inv-export-issues"><i class="fa-solid fa-file-export"></i>Xuất Excel</button>
    <button class="btn btn-primary" data-act="inv-new-issue" data-tab="${issueTab}"><i class="fa-solid fa-plus"></i>Lập phiếu xuất ${cfg.label.toLowerCase()}</button>`)}
    <div class="tabs" style="margin-bottom:14px">
      <button class="tab ${issueTab==='raw'?'active':''}" data-act="inventory-issue-tab" data-tab="raw"><i class="fa-solid fa-seedling"></i>Kho nguyên liệu</button>
      <button class="tab ${issueTab==='semi'?'active':''}" data-act="inventory-issue-tab" data-tab="semi"><i class="fa-solid fa-cubes-stacked"></i>Kho bán thành phẩm</button>
      <button class="tab ${issueTab==='finished'?'active':''}" data-act="inventory-issue-tab" data-tab="finished"><i class="fa-solid fa-box"></i>Kho thành phẩm</button>
    </div>
    <div class="card"><div class="toolbar">${searchBox('inv-issues','Tìm phiếu, PO, chứng từ tham chiếu…')}${selectFilter('inv-issues','type',Object.entries(ISSUE_TYPES).map(([k,v])=>[k,v]),'Tất cả loại xuất')}${(f.q||f.type)?'<button class="btn btn-sm" data-act="clear-filter" data-key="inv-issues"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>':''}<span class="spacer"></span><span class="chip">${fmtN(entries.length)} dòng</span></div>
    ${tableShell([{t:'Phiếu / Yêu cầu'},{t:'Loại'},{t:'Ngày'},{t:'Khu xuất'},{t:'Tham chiếu'},{t:'Hàng hóa / Lô'},{t:'Số lượng',cls:'right'},{t:'Trạng thái'},{t:'Thao tác',cls:'right'}],rows,{emptyTitle:`Chưa có dữ liệu xuất tại ${cfg.label.toLowerCase()}`})}
    ${pagiHTML('inv-issues',pg,'dòng')}</div>`;
};

/* ------------- Màn 4: CHUYỂN KHO ----------------------------------------- */
Views['inv-transfers'] = function () {
  const TYPE_META = {
    RAW_MATERIAL: { label: 'Chuyển kho nguyên liệu', short: 'Nguyên liệu', icon: 'fa-seedling' },
    SEMI_FINISHED: { label: 'Chuyển kho bán thành phẩm', short: 'Bán thành phẩm', icon: 'fa-layer-group' },
    FINISHED_GOODS: { label: 'Chuyển kho thành phẩm', short: 'Thành phẩm', icon: 'fa-box' },
  };
  State.invTransferType = State.invTransferType || 'RAW_MATERIAL';
  const activeType = State.invTransferType;
  const meta = TYPE_META[activeType];
  const f = F('inv-transfers', { q: '', status: '' });
  const q = (f.q || '').toLowerCase().trim();
  const inferType = (t) => t.transferType || (Q.warehouse(t.fromWarehouseId)?.type || 'RAW_MATERIAL');
  const typedTransfers = DB.stockTransfers.filter((t) => inferType(t) === activeType);
  const list = [...typedTransfers].filter((t) => {
    if (f.status && t.status !== f.status) return false;
    const fromWh = Q.warehouse(t.fromWarehouseId);
    const toWh = Q.warehouse(t.toWarehouseId);
    if (q && ![t.id, t.note, fromWh?.name, toWh?.name].some((v) => String(v || '').toLowerCase().includes(q))) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const pg = paged(list, 'inv-transfers');

  const rows = pg.items.map((t) => {
    const fromWh = Q.warehouse(t.fromWarehouseId);
    const toWh = Q.warehouse(t.toWarehouseId);
    const totalQty = (t.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
    return `<tr>
      <td><span class="code">${esc(t.id)}</span></td>
      <td class="num">${fmtDate(t.date)}</td>
      <td>${cell2(esc(fromWh?.name || t.fromWarehouseId), esc(fromWh?.address || ''))}</td>
      <td>${cell2(esc(toWh?.name || t.toWarehouseId), esc(toWh?.address || ''))}</td>
      <td class="center num strong">${fmtN((t.items || []).length)}</td>
      <td class="right num strong">${fmtN(totalQty)}</td>
      <td>${badge(t.status)}</td>
      <td class="muted">${esc(t.note || '')}</td>
      <td>${rowActions([{ act: 'inv-transfer-view', data: `data-id="${t.id}"`, icon: 'fa-eye', title: 'Xem phiếu chuyển kho' }])}</td>
    </tr>`;
  });

  const tabs = Object.entries(TYPE_META).map(([type, m]) => `
    <button class="tab ${activeType === type ? 'active' : ''}" data-act="inv-transfer-tab" data-type="${type}">
      <i class="fa-solid ${m.icon}"></i>${m.label}
    </button>`).join('');

  return `
  ${pageHead('Chuyển kho nội bộ', 'Điều phối hàng giữa các kho vật lý cùng loại tại các địa điểm khác nhau', '')}
  <div class="tabs" style="margin-bottom:14px">${tabs}</div>

  <div class="card">
    <div class="toolbar">
      ${searchBox('inv-transfers', 'Tìm số phiếu, kho nguồn, kho đích…')}
      ${selectFilter('inv-transfers', 'status', [['DRAFT', 'Nháp'], ['IN_TRANSIT', 'Đang đi đường'], ['RECEIVED', 'Đã nhận']], 'Tất cả trạng thái')}
      ${(f.q || f.status) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="inv-transfers"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
      <span class="spacer"></span>
      <button class="btn btn-primary" data-act="inv-new-transfer" data-type="${activeType}"><i class="fa-solid fa-plus"></i>Lập phiếu ${meta.short.toLowerCase()}</button>
    </div>
    ${tableShell(
      [{ t: 'Số phiếu', w: '125px' }, { t: 'Ngày' }, { t: 'Kho nguồn' }, { t: 'Kho đích' }, { t: 'Số dòng', cls: 'center' },
       { t: 'Tổng SL', cls: 'right' }, { t: 'Trạng thái', w: '125px' }, { t: 'Ghi chú' }, { t: '', cls: 'right', w: '70px' }],
      rows, { emptyTitle: `Chưa có phiếu ${meta.label.toLowerCase()}` })}
    ${pagiHTML('inv-transfers', pg, 'phiếu')}
  </div>`;
};

/* ------------- Màn 5: KIỂM KÊ -------------------------------------------- */
Views['inv-counts'] = function () {
  const f = F('inv-counts', { q: '', warehouseId: '' });
  const q = (f.q || '').toLowerCase().trim();
  const list = [...DB.inventoryCounts].filter((c) => {
    if (f.warehouseId && c.warehouseId !== f.warehouseId) return false;
    if (q && ![c.id, c.note].some((v) => String(v).toLowerCase().includes(q))) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));
  const pg = paged(list, 'inv-counts');
  const warehouses = DB.warehouses.map((w) => [w.id, w.name]);

  const rows = pg.items.map((c) => {
    const wh = DB.warehouses.find((w) => w.id === c.warehouseId);
    const totalDiff = c.items.reduce((s, i) => s + i.difference, 0);
    return `<tr>
      <td><span class="code">${c.id}</span></td>
      <td class="num">${fmtDate(c.date)}</td>
      <td><span class="chip">${esc(wh ? wh.name : c.warehouseId)}</span></td>
      <td class="center num">${c.items.length}</td>
      <td class="right strong num" style="color:${totalDiff < 0 ? 'var(--red)' : totalDiff > 0 ? 'var(--green)' : 'var(--text-3)'}">
        ${totalDiff > 0 ? '+' : ''}${fmtN(totalDiff)}
      </td>
      <td>${badge(c.status)}</td>
      <td class="muted">${esc(c.note || '')}</td>
      <td>${rowActions([
        { act: 'inv-count-view', data: `data-id="${c.id}"`, icon: 'fa-eye', title: 'Xem chi tiết kiểm kê' },
        ...(c.status !== 'COMPLETED' ? [{ act: 'inv-count-complete', data: `data-id="${c.id}"`, icon: 'fa-check-double', title: 'Xác nhận & điều chỉnh tồn' }] : []),
      ])}</td>
    </tr>`;
  });

  return `
  ${pageHead('Kiểm kê kho', 'Tạo phiếu kiểm kê, đối chiếu và điều chỉnh tồn kho thực tế', `
    <button class="btn btn-primary" data-act="inv-new-count"><i class="fa-solid fa-plus"></i>Tạo phiếu kiểm kê</button>
  `)}

  <div class="grid g-auto-sm" style="margin-bottom:14px">
    ${mkpi('Tổng phiếu kiểm kê', DB.inventoryCounts.length, 'fa-clipboard-list', 'blue')}
    ${mkpi('Đã hoàn tất', DB.inventoryCounts.filter((c) => c.status === 'COMPLETED').length, 'fa-circle-check', 'green')}
    ${mkpi('Đang kiểm kê', DB.inventoryCounts.filter((c) => c.status !== 'COMPLETED').length, 'fa-spinner', 'orange')}
  </div>

  <div class="card">
    <div class="toolbar">
      ${searchBox('inv-counts', 'Tìm số phiếu, kho kiểm kê…')}
      ${selectFilter('inv-counts', 'warehouseId', warehouses, 'Tất cả kho')}
      ${(f.q || f.warehouseId) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="inv-counts"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
      <span class="spacer"></span>
      <span class="chip"><i class="fa-solid fa-list"></i> ${fmtN(list.length)} phiếu</span>
    </div>
    ${tableShell(
      [{ t: 'Số phiếu KK', w: '120px' }, { t: 'Ngày KK' }, { t: 'Kho' }, { t: 'Số dòng', cls: 'center' },
       { t: 'Chênh lệch', cls: 'right' }, { t: 'Trạng thái', w: '120px' }, { t: 'Ghi chú' }, { t: '', cls: 'right', w: '90px' }],
      rows, { emptyTitle: 'Chưa có phiếu kiểm kê nào' })}
    ${pagiHTML('inv-counts', pg, 'phiếu')}
  </div>`;
};

/* ------------- Màn 6: LÔ & HẠN SỬ DỤNG ---------------------------------- */
Views['inv-lots'] = function () {
  const f = F('inv-lots', { q: '', qcStatus: '', expStatus: '' });
  const q = (f.q || '').toLowerCase().trim();
  const today = new Date(DB.today + 'T00:00:00');
  const nearDays = DB.inventoryAlertConfig.nearExpiryDays;

  const list = DB.inventoryLots.filter((lot) => {
    if (f.qcStatus && lot.qcStatus !== f.qcStatus) return false;
    const exp = new Date(lot.expiryDate + 'T00:00:00');
    const daysLeft = Math.round((exp - today) / 86400000);
    if (f.expStatus === 'expired' && daysLeft >= 0) return false;
    if (f.expStatus === 'near_expiry' && (daysLeft < 0 || daysLeft > nearDays)) return false;
    if (f.expStatus === 'normal' && daysLeft <= nearDays) return false;
    if (q && ![lot.lotNumber, lot.productId, lot.supplierId].some((v) => String(v).toLowerCase().includes(q))) return false;
    return true;
  }).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const pg = paged(list, 'inv-lots');

  const expiredLots = Q.expiredLots();
  const nearExpiryLots = Q.nearExpiryLots();

  const rows = pg.items.map((lot) => {
    const mat = DB.materials.find((m) => m.id === lot.productId) || DB.products.find((p) => p.id === lot.productId);
    const exp = new Date(lot.expiryDate + 'T00:00:00');
    const daysLeft = Math.round((exp - today) / 86400000);
    const inv = DB.inventory.find((i) => i.lotId === lot.id);
    let expBadge = '';
    if (daysLeft < 0) expBadge = `<span class="badge red">HẾT HẠN ${Math.abs(daysLeft)} ngày</span>`;
    else if (daysLeft <= nearDays) expBadge = `<span class="badge orange">Cận hạn: còn ${daysLeft} ngày</span>`;
    else expBadge = `<span class="badge green">Còn ${daysLeft} ngày</span>`;
    return `<tr>
      <td><span class="code" style="font-size:11px">${lot.lotNumber}</span></td>
      <td>${cell2(esc(mat ? mat.name : lot.productId), esc(lot.productId))}</td>
      <td class="num">${fmtDate(lot.mfgDate)}</td>
      <td>${expBadge}</td>
      <td class="right strong num">${inv ? fmtDec(inv.qtyOnHand, 2) + ' ' + esc(inv.unit) : '<span class="muted">—</span>'}</td>
      <td class="right num muted">${inv ? fmtDec(inv.qtyAvailable, 2) : '—'}</td>
      <td>${badge(lot.qcStatus)}</td>
      <td>${esc(Q.supplierName(lot.supplierId) || '—')}</td>
      <td>${rowActions([
        { act: 'inv-lot-detail', data: `data-lotid="${lot.id}"`, icon: 'fa-eye', title: 'Xem chi tiết lô' },
        ...(daysLeft < 0 || lot.qcStatus === 'FAILED' ? [{ act: 'inv-lot-quarantine', data: `data-lotid="${lot.id}"`, icon: 'fa-ban', title: 'Chuyển sang kho hàng lỗi' }] : []),
      ])}</td>
    </tr>`;
  });

  return `
  ${pageHead('Quản lý Lô & Hạn sử dụng', `Theo dõi lô hàng, HSD và trạng thái QC cho từng lô đậu hủ`, `
    <button class="btn" data-act="inv-lot-config"><i class="fa-solid fa-sliders"></i>Cấu hình cảnh báo</button>
  `)}

  <div class="grid g-auto-sm" style="margin-bottom:14px">
    ${mkpi('Tổng số lô', DB.inventoryLots.length, 'fa-barcode', 'blue')}
    ${mkpi(`Cận hạn ≤${nearDays} ngày`, nearExpiryLots.length, 'fa-calendar-minus', 'orange')}
    ${mkpi('Đã hết hạn', expiredLots.length, 'fa-circle-xmark', 'red')}
    ${mkpi('Đạt QC', DB.inventoryLots.filter((l) => l.qcStatus === 'PASSED').length, 'fa-circle-check', 'green')}
    ${mkpi('Cách ly / Lỗi', DB.inventoryLots.filter((l) => ['FAILED', 'QUARANTINE'].includes(l.qcStatus)).length, 'fa-triangle-exclamation', 'red')}
  </div>

  ${expiredLots.length > 0 ? `
  <div class="card" style="margin-bottom:14px;border-left:3px solid var(--red)">
    <div class="card-head"><span class="mkpi-ico t-red"><i class="fa-solid fa-circle-xmark"></i></span>
      <div><h3>Lô đã hết hạn sử dụng — cần xử lý ngay</h3><p>Các lô bên dưới đã hết HSD, không được xuất bán. Cần chuyển sang kho hàng lỗi hoặc tiêu hủy.</p></div></div>
    <div class="card-body" style="display:flex;flex-wrap:wrap;gap:8px">
      ${expiredLots.map((lot) => {
        const mat = DB.materials.find((m) => m.id === lot.productId) || {};
        const daysExpired = Math.abs(Math.round((new Date(lot.expiryDate) - today) / 86400000));
        return `<div class="alert-item" style="flex:1 1 240px;border-color:var(--red)">
          <span class="alert-ico t-red"><i class="fa-solid fa-calendar-xmark"></i></span>
          <span><span class="alert-title" style="color:var(--red)">${lot.lotNumber}</span>
          <div class="alert-sub">${esc(mat.name || lot.productId)} · Hết hạn ${fmtDate(lot.expiryDate)} (${daysExpired} ngày trước)</div></span>
          <button class="btn btn-sm" data-act="inv-lot-quarantine" data-lotid="${lot.id}" style="flex-shrink:0">Chuyển kho lỗi</button>
        </div>`;
      }).join('')}
    </div>
  </div>` : ''}

  <div class="card">
    <div class="toolbar">
      ${searchBox('inv-lots', 'Tìm số lô, mã hàng, nhà cung cấp…')}
      ${selectFilter('inv-lots', 'qcStatus', [['PASSED', 'Đạt QC'], ['QC_PENDING', 'Chờ QC'], ['FAILED', 'Không đạt'], ['QUARANTINE', 'Cách ly']], 'Tất cả QC')}
      ${selectFilter('inv-lots', 'expStatus', [['near_expiry', '⚠ Cận hạn'], ['expired', '❌ Hết hạn'], ['normal', '✅ Còn xa']], 'Tất cả HSD')}
      ${(f.q || f.qcStatus || f.expStatus) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="inv-lots"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
      <span class="spacer"></span>
      <span class="chip"><i class="fa-solid fa-list"></i> ${fmtN(list.length)} lô</span>
    </div>
    ${tableShell(
      [{ t: 'Số lô' }, { t: 'Tên hàng' }, { t: 'NSX' }, { t: 'HSD / Còn lại' },
       { t: 'On Hand', cls: 'right' }, { t: 'Available', cls: 'right' }, { t: 'QC', w: '100px' }, { t: 'Nhà cung cấp', cls: 'hide-sm' }, { t: '', cls: 'right', w: '80px' }],
      rows, { emptyTitle: 'Không tìm thấy lô hàng nào' })}
    ${pagiHTML('inv-lots', pg, 'lô')}
  </div>`;
};

/* ---- Modal cấu hình cảnh báo kho ---- */
function openInventoryAlertConfig() {
  Modal.open({
    title: 'Cấu hình cảnh báo tồn kho',
    sub: 'Điều chỉnh ngưỡng cảnh báo hạn sử dụng và hàng chậm luân chuyển',
    body: `<div class="form-grid">
      <div class="field"><label>Số ngày cảnh báo cận hạn <span class="req">*</span></label>
        <select class="inp" id="alertNearExpiry">
          ${[1, 3, 7, 15, 30].map((d) => `<option value="${d}" ${DB.inventoryAlertConfig.nearExpiryDays === d ? 'selected' : ''}>${d} ngày</option>`).join('')}
        </select></div>
      <div class="field"><label>Hàng chậm luân chuyển sau (ngày)</label>
        <select class="inp" id="alertSlowMoving">
          ${[30, 60, 90, 180].map((d) => `<option value="${d}" ${DB.inventoryAlertConfig.slowMovingDays === d ? 'selected' : ''}>${d} ngày</option>`).join('')}
        </select></div>
    </div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button>
           <button class="btn btn-primary" data-act="inv-save-alert-config"><i class="fa-solid fa-floppy-disk"></i>Lưu cấu hình</button>`,
  });
}

/* ---- Modal tạo phiếu nhập kho ---- */
function receiptLotCode(poId, materialId, date, roundNo) {
  const compactPo = String(poId || 'PO').replace(/-/g, '');
  const compactMat = String(materialId || 'SP').replace(/-/g, '');
  const ymd = String(date || DB.today).replace(/-/g, '').slice(2);
  return `${compactPo}-${compactMat}-${ymd}-${String(roundNo || 1).padStart(2, '0')}`;
}

function receiptRoundOfPo(poId) {
  return (DB.goodsReceipts || []).filter(r => r.poId === poId).length + 1;
}

function receiptPoDetailHtml(po, date) {
  if (!po) return '<div class="empty-mini">Chọn đơn hàng để hiển thị chi tiết.</div>';
  const roundNo = receiptRoundOfPo(po.id);
  return `
    <div class="card" style="margin-bottom:14px;background:var(--surface-2)">
      <div class="card-body">
        <div class="info-grid">
          ${infoItem('Mã đơn hàng', `<span class="code">${esc(po.id)}</span>`)}
          ${infoItem('Đề nghị mua', `<span class="code">${esc(po.prId || '—')}</span>`)}
          ${infoItem('Nhà cung cấp', esc(Q.supplierName(po.supplierId)))}
          ${infoItem('Ngày đặt', fmtDate(po.date))}
          ${infoItem('Giao dự kiến', fmtDate(po.expectedDate))}
          ${infoItem('Trạng thái', badge(po.status))}${po.qualityNote ? infoItem('Ghi chú chất lượng', `<span class="badge red">${esc(po.qualityNote)}</span>`) : ''}
        </div>
      </div>
    </div>
    <div class="form-sec-title"><i class="fa-solid fa-boxes-packing"></i>Nguyên liệu nhập kho</div>
    <div class="tbl-wrap" style="border:1px solid var(--border);border-radius:var(--r)">
      <table class="line-tbl">
        <thead><tr><th>Nguyên liệu</th><th class="right">SL đặt</th><th class="right">Đã nhập</th><th class="right">Nhập lần này</th><th>Lô hệ thống</th><th>Lô sản phẩm / NCC <span class="req">*</span></th><th>NSX</th><th>HSD</th></tr></thead>
        <tbody>
          ${(po.items || []).map((it) => {
            const remain = Math.max(0, Number(it.qty || 0) - Number(it.receivedQty || 0));
            const lotNo = receiptLotCode(po.id, it.materialId, date, roundNo);
            return `<tr>
              <td><div class="strong">${esc(it.name)}</div><div class="cell-sub">${esc(it.materialId)} · ${esc(it.unit)}</div></td>
              <td class="right num">${fmtN(it.qty)}</td>
              <td class="right num muted">${fmtN(it.receivedQty || 0)}</td>
              <td class="right"><input class="inp right num po-gr-qty" data-mid="${esc(it.materialId)}" type="number" min="0" max="${remain}" value="${remain}" style="width:100px" ${remain <= 0 ? 'disabled' : ''}></td>
              <td><input class="inp po-gr-lot" data-mid="${esc(it.materialId)}" value="${esc(lotNo)}" style="min-width:190px;background:var(--surface-2)" readonly title="Lô hệ thống tự sinh, không được chỉnh sửa"></td>
              <td><input class="inp po-gr-supplier-lot" data-mid="${esc(it.materialId)}" value="" placeholder="Bắt buộc · VD: NCC-LOT-0907" required style="min-width:165px" title="Nhập lô thực tế in trên bao bì/chứng từ NCC; có thể trùng giữa nhiều đợt nhập"></td>
              <td><input class="inp po-gr-mfg" data-mid="${esc(it.materialId)}" type="date" value="${date}" style="width:135px"></td>
              <td><input class="inp po-gr-exp" data-mid="${esc(it.materialId)}" type="date" value="${addDays(date, 365)}" style="width:135px"></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="muted" style="font-size:11.8px;margin-top:8px"><i class="fa-solid fa-circle-info"></i> <b>Lô hệ thống</b> tự sinh theo Mã PO - Mã SP - YYMMDD - Đợt và bị khóa. <b>Lô sản phẩm / NCC</b> bắt buộc nhập. Có thể trùng giữa nhiều đợt nếu cùng nguyên liệu, NSX và HSD.</div>`;
}

function openNewReceiptModal(preselectedPoId = '') {
  const eligiblePos = DB.purchaseOrders.filter((po) => ['SHIPPING', 'PARTIAL_RECEIVED'].includes(po.status));
  const selectedId = preselectedPoId && eligiblePos.some(p => p.id === preselectedPoId) ? preselectedPoId : '';
  const po = Q.purchaseOrder(selectedId);
  const warehouse = DB.warehouses.find(w => w.type === 'RAW_MATERIAL') || DB.warehouses[0];
  const locations = warehouse ? Q.locationsOf(warehouse.id) : [];
  Modal.open({
    title: 'Lập phiếu nhập kho từ đơn đặt hàng',
    sub: 'Chỉ các PO đang giao hoặc đã nhận một phần mới được phép lập phiếu nhập',
    size: 'lg',
    body: `
      ${eligiblePos.length ? '' : '<div class="alert-item" style="margin-bottom:14px"><i class="fa-solid fa-circle-info"></i><div><b>Chưa có PO chờ nhập kho</b><div class="muted">Hãy xác nhận giao hàng ở Đơn đặt hàng trước.</div></div></div>'}
      <div class="form-grid">
        <div class="field"><label>Đơn đặt hàng <span class="req">*</span></label>
          <select class="inp" id="poGrPo">
            <option value="">-- Chọn đơn đặt hàng --</option>${eligiblePos.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.id} · ${esc(Q.supplierName(p.supplierId))} · ${statusLabel(p.status)}</option>`).join('')}
          </select></div>
        <div class="field"><label>Kho nhận hàng <span class="req">*</span></label>
          <select class="inp" id="poGrWarehouse">
            ${DB.warehouses.filter(w => w.type === 'RAW_MATERIAL').map(w => `<option value="${w.id}" ${warehouse && w.id === warehouse.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}
          </select></div>
        <div class="field"><label>Kệ / vị trí lưu trữ <span class="req">*</span></label>
          <select class="inp" id="poGrLocation">
            ${locations.map(l => `<option value="${l.id}">${esc(l.name)} · ${esc(l.code)}</option>`).join('')}
          </select></div>
        <div class="field"><label>Người nhập kho</label>
          <select class="inp" id="poGrReceiver">
            ${DB.employees.filter(e => e.dept === 'Kho vận').map(e => `<option value="${e.id}" ${e.id === DB.currentUser.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
          </select></div>
        <div class="field"><label>Ngày nhập</label><input class="inp" id="poGrDate" type="date" value="${DB.today}"></div>
      </div>
      <div class="field"><label>Ghi chú</label><textarea class="inp" id="poGrNote" rows="2" placeholder="Ghi chú nhận hàng / tình trạng hàng…">${po ? `Nhập kho theo đơn ${po.id}` : ''}</textarea></div>
      <div id="poGrDetail">${receiptPoDetailHtml(po, DB.today)}</div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button>
           <button class="btn btn-success" id="poGrSaveBtn" data-act="po-goods-receipt-save" ${(eligiblePos.length && selectedId) ? '' : 'disabled'}><i class="fa-solid fa-warehouse"></i>Xác nhận nhập kho</button>`,
  });
}


function openWarehouseReceiptModal(receiptTab = 'semi') {
  const cfg = receiptTab === 'finished'
    ? { label: 'thành phẩm', type: 'FINISHED_GOODS', defaultRef: 'LSX-' }
    : { label: 'bán thành phẩm', type: 'SEMI_FINISHED', defaultRef: 'LSX-' };
  const warehouses = DB.warehouses.filter(w => w.type === cfg.type);
  const warehouse = warehouses[0];
  const locations = warehouse ? Q.locationsOf(warehouse.id) : [];
  const products = DB.products || [];
  Modal.open({
    title: `Lập phiếu nhập kho ${cfg.label}`,
    sub: `Phiếu nhập nội bộ vào ${cfg.label}; chỉ hiển thị kho đúng loại`,
    size: 'lg',
    body: `
      <div class="form-grid">
        <div class="field"><label>Kho nhận <span class="req">*</span></label><select class="inp" id="whGrWarehouse">${warehouses.map(w=>`<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Kệ / vị trí <span class="req">*</span></label><select class="inp" id="whGrLocation">${locations.map(l=>`<option value="${l.id}">${esc(l.name)} · ${esc(l.code)}</option>`).join('')}</select></div>
        <div class="field"><label>Ngày nhập</label><input class="inp" id="whGrDate" type="date" value="${DB.today}"></div>
        <div class="field"><label>Người nhập</label><select class="inp" id="whGrReceiver">${DB.employees.filter(e=>e.dept==='Kho vận').map(e=>`<option value="${e.id}" ${e.id===DB.currentUser.id?'selected':''}>${esc(e.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Sản phẩm <span class="req">*</span></label><select class="inp" id="whGrProduct"><option value="">-- Chọn sản phẩm --</option>${products.map(p=>`<option value="${p.id}">${esc(p.id)} · ${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Số lượng <span class="req">*</span></label><input class="inp right num" id="whGrQty" type="number" min="0" value="0"></div>
        <div class="field"><label>Lô hệ thống <span class="req">*</span></label><input class="inp" id="whGrSystemLot" placeholder="VD: LSX0048-SP001-260908-01"></div>
        <div class="field"><label>Ngày sản xuất</label><input class="inp" id="whGrMfg" type="date" value="${DB.today}"></div>
        <div class="field"><label>Hạn sử dụng</label><input class="inp" id="whGrExp" type="date" value="${addDays(DB.today, 7)}"></div>
        <div class="field"><label>Chứng từ tham chiếu</label><input class="inp" id="whGrRef" placeholder="${cfg.defaultRef}..."></div>
      </div>
      <div class="field"><label>Ghi chú</label><textarea class="inp" id="whGrNote" rows="2" placeholder="Ghi chú nhập ${cfg.label}…"></textarea></div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button><button class="btn btn-success" data-act="warehouse-receipt-save" data-tab="${receiptTab}"><i class="fa-solid fa-warehouse"></i>Xác nhận nhập kho</button>`
  });
}

function openPoReceiptHistory(poId) {
  const po = Q.purchaseOrder(poId);
  if (!po) return;
  const receipts = Q.receiptsOfPo(poId).sort((a,b) => String(b.date).localeCompare(String(a.date)));
  const returns = (DB.goodsIssues || []).filter(x => x.type === 'RETURN_OUT' && (x.refDoc === poId || x.poId === poId));
  Modal.open({
    title: `Nhập kho theo ${po.id}`,
    sub: `${esc(Q.supplierName(po.supplierId))} · ${statusLabel(po.status)}`,
    size: 'lg',
    body: `
      <div class="form-sec-title"><i class="fa-solid fa-box"></i>Chi tiết nguyên liệu</div>
      ${tableShell([{t:'Nguyên liệu'},{t:'SL đặt',cls:'right'},{t:'Đã nhập',cls:'right'}], (po.items||[]).map(i => `<tr><td>${cell2(esc(i.name), esc(i.materialId))}</td><td class="right num">${fmtN(i.qty)} ${esc(i.unit)}</td><td class="right num strong">${fmtN(i.receivedQty||0)} ${esc(i.unit)}</td></tr>`))}
      <div class="form-sec-title" style="margin-top:16px"><i class="fa-solid fa-clock-rotate-left"></i>Lịch sử nhập kho</div>
      ${tableShell([{t:'Phiếu nhập'},{t:'Ngày'},{t:'Người nhập'},{t:'Nguyên liệu'},{t:'Số lượng nhập',cls:'right'},{t:'Lô hệ thống'},{t:'Lô SP/NCC'},{t:'QC'}], receipts.flatMap(r => (r.items||[]).map(i => `<tr><td><span class="code">${r.id}</span></td><td class="num">${fmtDate(r.date)}</td><td>${esc(Q.employeeName(r.receivedBy))}</td><td>${esc(i.name)}</td><td class="right num strong">${fmtN(i.qty)} ${esc(i.unit)}</td><td><span class="code">${esc(i.lotNumber||'—')}</span></td><td>${esc(i.supplierLot||'—')}</td><td>${r.inspectionStatus === 'PASSED' ? '<span class="badge green">Đạt</span>' : r.inspectionStatus === 'FAILED' || r.inspectionStatus === 'PARTIAL_FAILED' ? '<span class="badge red">Có lỗi</span>' : '<span class="badge orange">Chờ kiểm</span>'}</td></tr>`)), {emptyTitle:'Chưa có lịch sử nhập kho'})}
      <div class="form-sec-title" style="margin-top:16px"><i class="fa-solid fa-rotate-left"></i>Lịch sử đổi trả</div>
      ${tableShell([{t:'Phiếu xuất trả'},{t:'Ngày'},{t:'Nguyên liệu'},{t:'Số lượng trả',cls:'right'},{t:'Lô hệ thống'},{t:'Lý do'}], returns.flatMap(r => (r.items||[]).map(i => `<tr><td><span class="code">${r.id}</span></td><td>${fmtDate(r.date)}</td><td>${esc(Q.material(i.productId)?.name || i.productId)}</td><td class="right num">${fmtN(i.qty)} ${esc(i.unit||'')}</td><td><span class="code">${esc(Q.lot(i.lotId)?.lotNumber || i.lotId || '—')}</span></td><td class="muted">${esc(r.note||'')}</td></tr>`)), {emptyTitle:'Chưa phát sinh đổi trả'})}`,
    foot: `<button class="btn" data-act="modal-close">Đóng</button>${po.status === 'PARTIAL_RECEIVED' ? `<button class="btn btn-primary" data-act="inv-new-receipt" data-poid="${po.id}"><i class="fa-solid fa-plus"></i>Nhập tiếp</button>` : ''}`,
  });
}

/* ---- Modal tạo phiếu xuất kho với FEFO ----- */
function openNewIssueModal(issueTab = 'raw') {
  const tabType = { raw:'RAW_MATERIAL', semi:'SEMI_FINISHED', finished:'FINISHED_GOODS' }[issueTab] || 'RAW_MATERIAL';
  const warehouses = DB.warehouses.filter(w => w.type === tabType);
  const allowedIds = new Set(warehouses.map(w=>w.id));
  const stockProducts = [...new Set(DB.inventory.filter(i=>allowedIds.has(i.warehouseId) && Number(i.qtyAvailable ?? i.qtyOnHand ?? 0) > 0).map(i=>i.productId))]
    .map(id=>Q.material(id)||Q.product(id)).filter(Boolean)
    .sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id),'vi',{sensitivity:'base'}));
  const productOptions = `<option value="">-- Chọn hàng xuất kho --</option>${stockProducts.map(m=>`<option value="${m.id}">${esc(m.name)} (${m.id})</option>`).join('')}`;
  const itemLabel = issueTab === 'raw' ? 'Nguyên liệu' : issueTab === 'semi' ? 'Bán thành phẩm' : 'Thành phẩm';
  Modal.open({
    title: `Lập phiếu xuất ${itemLabel.toLowerCase()}`,
    sub: 'Có thể chọn nhiều mặt hàng trong cùng một phiếu; hệ thống lấy lô phù hợp theo FEFO trong khu đã chọn',
    size: 'lg',
    body: `
      <div class="form-sec-title"><i class="fa-solid fa-file-lines"></i>Thông tin chung</div>
      <div class="form-grid">
        <div class="field"><label>Người lập phiếu</label><input class="inp" value="${esc(Q.employeeName(DB.currentUser.id))}" disabled></div>
        <div class="field"><label>Ngày xuất</label><input class="inp" type="date" id="giNewDate" value="${DB.today}" /></div>
        <div class="field"><label>Loại hàng</label><input class="inp" id="giItemCategory" value="${itemLabel}" disabled></div>
        <div class="field"><label>Loại xuất <span class="req">*</span></label>
          <select class="inp" id="giNewType">
            ${issueTab !== 'finished' ? '<option value="PRODUCTION_ISSUE">Xuất sản xuất</option>' : ''}
            ${issueTab === 'finished' ? '<option value="SALES_ISSUE">Xuất bán hàng</option>' : ''}
            <option value="ADJUSTMENT_OUT">Xuất điều chỉnh</option>
            <option value="TRANSFER_OUT">Xuất chuyển kho</option>
          </select></div>
        <div class="field"><label>Khu xuất <span class="req">*</span></label>
          <select class="inp" id="giNewWarehouse">${warehouses.map(w=>`<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Chứng từ tham chiếu</label><input class="inp" id="giNewRef" placeholder="LSX-2026-xxxx / DH-2026-xxxx" /></div>
      </div>
      <div class="form-sec-title" style="margin-top:16px"><i class="fa-solid fa-box-open"></i>Hàng xuất kho</div>
      <div style="display:grid;grid-template-columns:minmax(280px,2fr) minmax(150px,1fr) 44px;gap:10px;padding:0 2px 6px;color:var(--text-muted);font-size:12px;font-weight:700">
        <div>${itemLabel}</div><div>Số lượng xuất</div><div></div>
      </div>
      <div id="giNewItems" data-options="${encodeURIComponent(productOptions)}">
        <div class="gi-issue-line" style="display:grid;grid-template-columns:minmax(280px,2fr) minmax(150px,1fr) 44px;gap:10px;align-items:center;margin-bottom:8px">
          <select class="inp" name="product">${productOptions}</select>
          <input class="inp right num" name="qty" type="number" min="0.01" step="0.01" placeholder="Nhập số lượng" />
          <button type="button" class="btn btn-sm" data-act="inv-issue-remove-line" title="Xóa dòng" disabled><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <button type="button" class="btn btn-sm" data-act="inv-issue-add-line" style="margin-bottom:14px"><i class="fa-solid fa-plus"></i>Thêm ${itemLabel.toLowerCase()}</button>
      <div class="field"><label>Ghi chú</label><textarea class="inp" id="giNewNote" rows="2" placeholder="Diễn giải lý do xuất kho…"></textarea></div>
      <div class="alert-item" style="border-color:var(--primary);background:var(--surface-2);margin-top:12px">
        <span class="alert-ico t-blue"><i class="fa-solid fa-circle-info"></i></span>
        <span><div class="alert-sub">Phiếu xuất mới không dùng cho trả NCC. Hàng trả NCC được xử lý riêng từ yêu cầu trả nguyên liệu ở tab Kho nguyên liệu.</div></span>
      </div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button><button class="btn btn-primary" data-act="inv-issue-save-new"><i class="fa-solid fa-floppy-disk"></i>Xác nhận xuất kho</button>`,
  });
}

function openIssueDetailModal(id) {
  const gi=(DB.goodsIssues||[]).find(x=>x.id===id); if(!gi) return;
  Modal.open({title:`Chi tiết phiếu xuất ${gi.id}`,sub:`${Q.warehouseName(gi.warehouseId)} · ${fmtDate(gi.date)}`,size:'lg',body:`
    <div class="info-grid">${infoItem('Loại xuất',esc(gi.type))}${infoItem('Khu xuất',esc(Q.warehouseName(gi.warehouseId)))}${infoItem('Chứng từ tham chiếu',esc(gi.refDoc||'—'))}${infoItem('Người lập',esc(Q.employeeName(gi.createdBy)))}</div>
    <div class="form-sec-title" style="margin-top:16px"><i class="fa-solid fa-box-open"></i>Chi tiết hàng xuất</div>
    ${tableShell([{t:'Mã hàng'},{t:'Tên hàng'},{t:'Lô hệ thống'},{t:'Lô NCC'},{t:'Kệ'},{t:'Số lượng',cls:'right'}],(gi.items||[]).map(i=>{const lot=Q.lot(i.lotId);const item=Q.material(i.productId)||Q.product(i.productId);return `<tr><td><span class="code">${esc(i.productId)}</span></td><td>${esc(item?.name||i.productId)}</td><td><span class="code">${esc(lot?.lotNumber||'—')}</span></td><td>${esc(lot?.supplierLot||'—')}</td><td>${esc(Q.locationName(i.locationId)||'—')}</td><td class="right strong num">${fmtN(i.qty)} ${esc(i.unit||'')}</td></tr>`; }))}
    <div class="field" style="margin-top:14px"><label>Ghi chú</label><div class="inp" style="height:auto;min-height:42px">${esc(gi.note||'—')}</div></div>`,foot:'<button class="btn" data-act="modal-close">Đóng</button>'});
}

/* ---- Modal tạo phiếu chuyển kho ----- */
function openNewTransferModal(transferType = 'RAW_MATERIAL') {
  const TYPE_META = {
    RAW_MATERIAL: { label: 'nguyên liệu', title: 'Phiếu chuyển kho nguyên liệu' },
    SEMI_FINISHED: { label: 'bán thành phẩm', title: 'Phiếu chuyển kho bán thành phẩm' },
    FINISHED_GOODS: { label: 'thành phẩm', title: 'Phiếu chuyển kho thành phẩm' },
  };
  const meta = TYPE_META[transferType] || TYPE_META.RAW_MATERIAL;
  const warehouses = DB.warehouses.filter((w) => w.type === transferType && w.status === 'active');
  Modal.open({
    title: meta.title,
    sub: `Chuyển ${meta.label} giữa các kho vật lý cùng loại`,
    size: 'lg',
    body: `
      <input type="hidden" id="ckTransferType" value="${transferType}" />
      <div class="form-sec-title"><i class="fa-solid fa-circle-info"></i>Thông tin chung</div>
      <div class="form-grid">
        <div class="field"><label>Kho nguồn <span class="req">*</span></label>
          <select class="inp" id="ckFromWh">
            <option value="">-- Chọn kho nguồn --</option>
            ${warehouses.map((w) => `<option value="${w.id}">${esc(w.name)} · ${esc(w.address)}</option>`).join('')}
          </select></div>
        <div class="field"><label>Kho đích <span class="req">*</span></label>
          <select class="inp" id="ckToWh"><option value="">-- Chọn kho đích --</option></select></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Ngày chuyển</label><input class="inp" type="date" id="ckDate" value="${DB.today}" /></div>
        <div class="field"><label>Ghi chú</label><input class="inp" id="ckNote" placeholder="Lý do điều phối hàng giữa các kho…" /></div>
      </div>
      <div class="form-sec-title"><i class="fa-solid fa-boxes-stacked"></i>Hàng hóa chuyển kho</div>
      <div id="ckItemsArea">
        <div class="muted" style="padding:16px;text-align:center;border:1px dashed var(--border);border-radius:var(--r)">Chọn kho nguồn để thêm hàng hóa cần chuyển.</div>
      </div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button>
           <button class="btn btn-primary" data-act="inv-transfer-save-new"><i class="fa-solid fa-right-left"></i>Tạo phiếu chuyển kho</button>`,
  });

  let lineSeq = 0;
  const sourceRows = () => {
    const fromId = $('#ckFromWh')?.value || '';
    return DB.inventory
      .filter((inv) => inv.warehouseId === fromId && Number(inv.qtyAvailable ?? inv.qtyOnHand ?? 0) > 0)
      .sort((a,b) => {
        const ai = Q.material(a.productId) || Q.product(a.productId);
        const bi = Q.material(b.productId) || Q.product(b.productId);
        return String(ai?.name || a.productId).localeCompare(String(bi?.name || b.productId), 'vi', { numeric:true, sensitivity:'base' });
      });
  };
  const stockKey = (inv) => [inv.productId, inv.lotId, inv.locationId].join('|');
  const stockOptions = () => sourceRows().map((inv) => {
    const lot = Q.lot(inv.lotId);
    const item = Q.material(inv.productId) || Q.product(inv.productId);
    const available = Number(inv.qtyAvailable ?? inv.qtyOnHand ?? 0);
    return `<option value="${esc(stockKey(inv))}">${esc(item?.name || inv.productId)} · ${esc(lot?.lotNumber || '—')} · ${esc(Q.locationName(inv.locationId))} · Còn ${fmtDec(available,2)} ${esc(inv.unit||'')}</option>`;
  }).join('');

  const renderDestinationOptions = () => {
    const fromId = $('#ckFromWh')?.value || '';
    const to = $('#ckToWh');
    if (!to) return;
    const current = to.value;
    to.innerHTML = `<option value="">-- Chọn kho đích --</option>` + warehouses
      .filter(w => w.id !== fromId)
      .map(w => `<option value="${w.id}">${esc(w.name)} · ${esc(w.address)}</option>`).join('');
    if (current && current !== fromId && warehouses.some(w => w.id === current)) to.value = current;
  };

  const attachLineEvents = (row) => {
    row.querySelector('.ck-remove-line')?.addEventListener('click', () => {
      row.remove();
      const body = $('#ckTransferLines');
      if (body && !body.children.length) addLine();
    });
  };
  const addLine = () => {
    const body = $('#ckTransferLines');
    if (!body) return;
    const opts = stockOptions();
    if (!opts) return Toast.err('Không có tồn khả dụng', 'Kho nguồn hiện không có hàng để chuyển.');
    lineSeq += 1;
    const tr = document.createElement('tr');
    tr.className = 'ck-transfer-row';
    tr.innerHTML = `
      <td><select class="inp ck-stock-select"><option value="">-- Chọn ${meta.label} --</option>${opts}</select></td>
      <td class="right"><input class="inp right num ck-transfer-qty" type="number" min="0" step="0.01" value="0" style="width:130px" /></td>
      <td class="center"><button type="button" class="btn btn-sm ck-remove-line" title="Xóa dòng"><i class="fa-solid fa-trash"></i></button></td>`;
    body.appendChild(tr);
    attachLineEvents(tr);
  };
  const renderTransferItems = () => {
    const fromId = $('#ckFromWh')?.value || '';
    const area = $('#ckItemsArea');
    if (!area) return;
    if (!fromId) {
      area.innerHTML = '<div class="muted" style="padding:16px;text-align:center;border:1px dashed var(--border);border-radius:var(--r)">Chọn kho nguồn để thêm hàng hóa cần chuyển.</div>';
      return;
    }
    if (!sourceRows().length) {
      area.innerHTML = '<div class="muted" style="padding:16px;text-align:center;border:1px dashed var(--border);border-radius:var(--r)">Kho nguồn hiện không có tồn khả dụng để chuyển.</div>';
      return;
    }
    area.innerHTML = `
      <div class="tbl-wrap" style="border:1px solid var(--border);border-radius:var(--r)">
        <table class="line-tbl">
          <thead><tr><th>${meta.label.charAt(0).toUpperCase()+meta.label.slice(1)} / Lô / Vị trí nguồn</th><th class="right" style="width:150px">SL chuyển</th><th style="width:54px"></th></tr></thead>
          <tbody id="ckTransferLines"></tbody>
        </table>
      </div>
      <button type="button" class="btn btn-sm" id="ckAddLine" style="margin-top:10px"><i class="fa-solid fa-plus"></i>Thêm ${meta.label}</button>`;
    $('#ckAddLine')?.addEventListener('click', addLine);
    addLine();
  };

  $('#ckFromWh')?.addEventListener('change', () => {
    renderDestinationOptions();
    renderTransferItems();
  });
  renderDestinationOptions();
  renderTransferItems();
}
function openTransferDetailModal(id) {
  const t = DB.stockTransfers.find((x) => x.id === id);
  if (!t) return Toast.err('Không tìm thấy phiếu', id);
  const fromWh = Q.warehouse(t.fromWarehouseId);
  const toWh = Q.warehouse(t.toWarehouseId);
  Modal.open({
    title: `Phiếu chuyển kho ${t.id}`,
    sub: `${esc(fromWh?.name || t.fromWarehouseId)} → ${esc(toWh?.name || t.toWarehouseId)}`,
    size: 'lg',
    body: `
      <div class="form-grid">
        <div>${cell2('Ngày chuyển', fmtDate(t.date))}</div>
        <div>${cell2('Trạng thái', badge(t.status))}</div>
        <div>${cell2('Kho nguồn', esc(fromWh?.name || t.fromWarehouseId))}</div>
        <div>${cell2('Kho đích', esc(toWh?.name || t.toWarehouseId))}</div>
      </div>
      <div class="form-sec-title"><i class="fa-solid fa-boxes-stacked"></i>Chi tiết hàng chuyển</div>
      ${tableShell([{t:'Mã'},{t:'Hàng hóa'},{t:'Lô'},{t:'Vị trí nguồn'},{t:'Vị trí đích'},{t:'Số lượng',cls:'right'}],
        (t.items || []).map((i) => {
          const item = DB.materials.find((m) => m.id === i.productId) || DB.products.find((p) => p.id === i.productId);
          return `<tr><td><span class="code">${esc(i.productId)}</span></td><td>${esc(item?.name || i.productId)}</td><td>${esc(Q.lot(i.lotId)?.lotNumber || '—')}</td><td>${esc(Q.locationName(i.fromLocationId))}</td><td>${esc(Q.locationName(i.toLocationId))}</td><td class="right num strong">${fmtN(i.qty)} ${esc(i.unit || '')}</td></tr>`;
        }), {emptyTitle:'Không có dòng hàng'})}
      ${t.note ? `<div class="muted" style="margin-top:12px"><strong>Ghi chú:</strong> ${esc(t.note)}</div>` : ''}`,
    foot: `<button class="btn btn-primary" data-act="modal-close">Đóng</button>`,
  });
}

/* ---------------- SỔ GIAO DỊCH VÀ CẢNH BÁO THEO TÀI LIỆU ERP ---------------- */
const InventoryService = {
  apply({ productId, warehouseId = 'WH-001', locationId = '', lotId = '', quantity, type, refType = 'MANUAL', refId = '', note = '', userId = DB.currentUser.id, updateMaterial = true }) {
    const qty = Number(quantity);
    if (!productId || !Number.isFinite(qty) || qty <= 0) return { ok: false, message: 'Số lượng phải lớn hơn 0.' };
    const inbound = ['RECEIPT', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'RETURN_IN', 'PRODUCTION_RECEIPT'].includes(type);
    const delta = inbound ? qty : -qty;
    let row = DB.inventory.find((x) => x.productId === productId && x.warehouseId === warehouseId && x.locationId === locationId && x.lotId === lotId);
    if (!row) {
      if (!inbound) return { ok: false, message: 'Không tìm thấy tồn kho theo lô và vị trí đã chọn.' };
      const material = Q.material(productId); const product = Q.product(productId);
      row = { productId, warehouseId, locationId, lotId, qtyOnHand: 0, qtyReserved: 0, qtyAvailable: 0, unit: material?.unit || product?.unit || '', lastUpdated: DB.today };
      DB.inventory.push(row);
    }
    if (!inbound && qty > row.qtyAvailable) return { ok: false, message: `Không đủ tồn kho. Tồn khả dụng: ${fmtDec(row.qtyAvailable, 2)}, yêu cầu xuất: ${fmtDec(qty, 2)}.` };
    const before = row.qtyOnHand;
    row.qtyOnHand = Math.round((row.qtyOnHand + delta) * 100) / 100;
    row.qtyAvailable = Math.round((row.qtyOnHand - row.qtyReserved) * 100) / 100;
    row.lastUpdated = DB.today + ' 09:00';
    DB.inventoryTransactions.unshift({ id: nextCode('TX-', DB.inventoryTransactions), transactionNumber: refId || nextCode('TX-', DB.inventoryTransactions), type, productId, warehouseId, locationId, lotId, qty: delta, qtyBefore: before, qtyAfter: row.qtyOnHand, refType, refId, userId, date: DB.today, note });
    if (updateMaterial) { const material = Q.material(productId); if (material) material.stock = Math.round((material.stock + delta) * 100) / 100; }
    return { ok: true, row };
  },
};

Views['inv-warehouses'] = function () {
  const rows = DB.warehouses.map((warehouse) => {
    const locations = Q.locationsOf(warehouse.id);
    const stock = DB.inventory.filter((row) => row.warehouseId === warehouse.id).reduce((sum, row) => sum + row.qtyOnHand, 0);
    return `<tr><td><span class="code">${esc(warehouse.code)}</span></td><td class="strong">${esc(warehouse.name)}</td><td>${esc(warehouse.type)}</td><td>${locations.length}</td><td class="right num">${fmtDec(stock, 2)}</td><td>${warehouse.status === 'active' ? '<span class="badge green">Đang hoạt động</span>' : '<span class="badge slate">Ngừng hoạt động</span>'}</td><td class="muted">${esc(warehouse.note)}</td></tr>`;
  });
  return `${pageHead('Kho & vị trí lưu trữ', 'Quản lý kho nguyên liệu, sản xuất, bán thành phẩm, thành phẩm, cửa hàng, hàng lỗi và hàng trả về')}
    <div class="card">${tableShell([{ t: 'Mã kho' }, { t: 'Tên kho' }, { t: 'Loại kho' }, { t: 'Số vị trí' }, { t: 'Tồn hiện tại', cls: 'right' }, { t: 'Trạng thái' }, { t: 'Ghi chú' }], rows, { emptyTitle: 'Chưa có kho' })}</div>`;
};

Views['inv-transactions'] = function () {
  const rows = Q.txOf().map((tx) => `<tr><td><span class="code">${esc(tx.id)}</span><div class="cell-sub">${esc(tx.transactionNumber)}</div></td><td>${esc(tx.type)}</td><td><span class="code">${esc(tx.productId)}</span><div class="cell-sub">${esc(Q.material(tx.productId)?.name || Q.product(tx.productId)?.name || '')}</div></td><td>${esc(Q.warehouseName(tx.warehouseId))}</td><td>${esc(Q.lot(tx.lotId)?.lotNumber || '—')}</td><td class="right num" style="color:${tx.qty < 0 ? 'var(--orange)' : 'var(--green)'}">${tx.qty > 0 ? '+' : ''}${fmtDec(tx.qty, 2)}</td><td class="right num">${fmtDec(tx.qtyBefore, 2)} → ${fmtDec(tx.qtyAfter, 2)}</td><td class="num">${fmtDate(tx.date)}</td><td class="muted">${esc(tx.note || '')}</td></tr>`);
  return `${pageHead('Sổ giao dịch kho', 'Ledger bất biến của mọi biến động nhập, xuất, chuyển kho, sản xuất và điều chỉnh', '<button class="btn" data-act="inv-export-transactions"><i class="fa-solid fa-file-export"></i>Xuất Excel</button>')}
    <div class="card">${tableShell([{ t: 'Giao dịch' }, { t: 'Loại' }, { t: 'Sản phẩm' }, { t: 'Kho' }, { t: 'Lô' }, { t: 'Số lượng', cls: 'right' }, { t: 'Trước → Sau', cls: 'right' }, { t: 'Ngày' }, { t: 'Diễn giải' }], rows, { emptyTitle: 'Chưa có giao dịch kho' })}</div>`;
};

Views['inv-alerts'] = function () {
  const low = Q.lowStockAlerts();
  const over = DB.materials.filter((m) => m.maxStock != null && m.stock >= m.maxStock);
  const near = Q.nearExpiryLots();
  const expired = Q.expiredLots();
  const slow = Q.slowMoving();
  const rows = [
    ...low.map((x) => `<tr><td><span class="badge orange">LOW STOCK</span></td><td>${esc(x.material.id)} · ${esc(x.material.name)}</td><td class="right num">${fmtDec(x.available, 2)} / ${fmtDec(x.minimum, 2)} ${esc(x.material.unit)}</td><td>Đề nghị mua hàng</td></tr>`),
    ...over.map((m) => `<tr><td><span class="badge red">OVER STOCK</span></td><td>${esc(m.id)} · ${esc(m.name)}</td><td class="right num">${fmtDec(m.stock, 2)} / ${fmtDec(m.maxStock, 2)} ${esc(m.unit)}</td><td>Kiểm tra mức tồn tối đa</td></tr>`),
    ...near.map((lot) => `<tr><td><span class="badge orange">NEAR EXPIRY</span></td><td>${esc(lot.productId)} · ${esc(lot.lotNumber)}</td><td class="num">HSD ${fmtDate(lot.expiryDate)}</td><td>Ưu tiên FEFO</td></tr>`),
    ...expired.map((lot) => `<tr><td><span class="badge red">EXPIRED</span></td><td>${esc(lot.productId)} · ${esc(lot.lotNumber)}</td><td class="num">HSD ${fmtDate(lot.expiryDate)}</td><td>Chuyển kho lỗi / tiêu hủy</td></tr>`),
    ...slow.map((x) => `<tr><td><span class="badge slate">SLOW MOVING</span></td><td>${esc(x.material.id)} · ${esc(x.material.name)}</td><td class="num">${x.daysSinceIssue == null ? 'Chưa xuất' : x.daysSinceIssue + ' ngày không xuất'}</td><td>Rà soát kế hoạch sử dụng</td></tr>`),
  ];
  return `${pageHead('Cảnh báo tồn kho', 'Theo dõi tồn tối thiểu/tối đa, hạn sử dụng và hàng chậm luân chuyển theo cấu hình')}
    <div class="grid g-auto-sm" style="margin-bottom:14px">${mkpi('Tồn dưới min', low.length, 'fa-arrow-down', 'orange')}${mkpi('Tồn trên max', over.length, 'fa-arrow-up', 'red')}${mkpi('Lô cận hạn', near.length, 'fa-calendar-minus', 'orange')}${mkpi('Lô hết hạn', expired.length, 'fa-circle-xmark', 'red')}${mkpi('Chậm luân chuyển', slow.length, 'fa-hourglass-half', 'slate')}</div>
    <div class="card">${tableShell([{ t: 'Loại cảnh báo' }, { t: 'Đối tượng' }, { t: 'Thông tin' }, { t: 'Khuyến nghị' }], rows, { emptyTitle: 'Không có cảnh báo' })}</div>`;
};