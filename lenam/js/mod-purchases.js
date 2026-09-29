/* ------------------------------------------------------------ MUA SẮM */


Views.purchases = function (params = {}) {
  const currentTab = params.tab || State.tab || 'pr';
  const f = F('purchases', {
    q: '',
    status: '',
    supplier: '',
    tab: currentTab,
    prId: '',
    materialId: ''
  });

  f.tab = currentTab;
  State.tab = currentTab;

  const handledTabs = ['dashboard', 'pr', 'approval', 'quotes', 'po', 'debts', 'price_history', 'suppliers'];
  if (!handledTabs.includes(currentTab)) return '';

  if (State.params && State.params.filter === 'pending') {
    f.status = 'mh_cho_duyet';
    f.tab = 'pr';
    State.tab = 'pr';
    State.params.filter = null;
  }

  const q = (f.q || '').toLowerCase().trim();


const purchaseTabCounts = {
  pr: DB.purchases.length,

  quotes:
    DB.supplierQuotations.length,

  po:
    DB.purchaseOrders.length,


  debts:
    DB.supplierPayments.length,

  price_history:
    DB.purchasePriceHistory.length,

  suppliers:
    DB.suppliers.length
};


const tabs =
  PURCHASE_INVENTORY_CONFIG.purchaseTabs.map(
    (tab) => ({
      ...tab,

      count:
        tab.id === 'dashboard'
          ? ''
          : purchaseTabCounts[tab.id] ?? ''
    })
  );

  /* -------------------------------------------------- TAB 1: PR (YÊU CẦU MUA) */
  const renderPrTab = () => {
    const list = DB.purchases.filter((p) => {
      if (f.status && p.status !== f.status) return false;
        const itemSupplierIds = (p.items || []).flatMap((item) => item.supplierIds || (item.supplierId ? [item.supplierId] : []));
        if (f.supplier && p.supplierId !== f.supplier && !itemSupplierIds.includes(f.supplier)) return false;
        const supplierText = itemSupplierIds.map((supplierId) => Q.supplierName(supplierId)).join(' ');
        if (q && ![p.id, supplierText, Q.employeeName(p.requesterId), p.reason].some((v) => String(v).toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => b.id.localeCompare(a.id));
    const pg = paged(list, 'purchases');
    const suppliers = DB.suppliers.map((s) => [s.id, s.name]);
    const cnt = (s) => DB.purchases.filter((p) => p.status === s).length;

    const rows = pg.items.map((p) => {
  const isApproved =
  PURCHASE_INVENTORY_CONFIG
    .prStatus
    .approved
    .includes(p.status);

  const isPending =
  PURCHASE_INVENTORY_CONFIG
    .prStatus
    .pending
    .includes(p.status);

  /* Danh sách vật tư thuộc PR */
  const materialHtml = (p.items || []).length
    ? p.items.map((it) => `
        <div style="
          display:flex;
          align-items:center;
          gap:7px;
          margin-bottom:5px;
        ">
          <span class="code">${esc(it.materialId)}</span>

          <span style="flex:1">
            ${esc(it.name)}
          </span>

          <span class="num muted" style="white-space:nowrap">
            ${fmtDec(it.qty, 2)} ${esc(it.unit)}
          </span>
          ${Array.isArray(it.poHistory) && it.poHistory.length ? (() => {
            const event = it.poHistory[it.poHistory.length - 1];
            return `<span class="chip" title="${esc(event.note || '')}" style="font-size:10.5px"><i class="fa-solid fa-ban"></i>${esc(event.poId)} đã hủy${event.replacementPrId ? ` → ${esc(event.replacementPrId)}` : ''}</span>`;
          })() : ''}
        </div>
      `).join('')
    : `
      <span class="muted">
        Chưa có vật tư
      </span>
    `;

  return `
    <tr
      class="clickable"
      data-act="open-pr"
      data-id="${p.id}"
    >

      <td>
        <span class="code">${p.id}</span>

        <div class="cell-sub">
          ${esc(p.reason || '')}
        </div>
      </td>

      <td class="hide-sm">
        <div style="
          display:flex;
          align-items:center;
          gap:8px
        ">
          ${avatarHTML(Q.employeeName(p.requesterId))}

          <span>
            ${esc(Q.employeeName(p.requesterId))}
          </span>
        </div>
      </td>

      <!-- NGUYÊN LIỆU ĐỀ NGHỊ MUA -->
      <td>
        ${materialHtml}
      </td>

      <!-- NHÀ CUNG CẤP -->
      <td>
          ${(p.items || []).map((it) => `<div style="margin-bottom:5px"><span class="muted">${esc(it.name)}:</span> <span class="strong">${(it.supplierIds || (it.supplierId ? [it.supplierId] : [])).map((supplierId) => esc(Q.supplierName(supplierId))).join(', ') || 'Chưa chọn NCC'}</span></div>`).join('')}
      </td>

      <td class="right strong num">
        ${fmtVND(p.total)}
      </td>

      <td class="num">
        ${fmtDate(p.date)}
      </td>

      <td class="num hide-sm">
        ${fmtDate(p.expectedDate)}
      </td>

      <td>
        ${badge(p.status)}
      </td>

      <td>
        ${rowActions([
          {
            act: 'open-pr',
            data: `data-id="${p.id}"`,
            icon: 'fa-eye',
            title: 'Xem chi tiết'
          },
          ...(!DB.supplierQuotations.some(q => q.prId === p.id && (q.confirmed || q.confirmedAt)) ? [{
            act: 'pr-edit',
            data: `data-id="${p.id}"`,
            icon: 'fa-pen-to-square',
            title: 'Sửa đề nghị mua hàng'
          }] : []),

          ...(isPending ? [{
            act: 'pr-approve-action',
            data: `data-id="${p.id}"`,
            icon: 'fa-check',
            title: 'Duyệt đề nghị mua hàng'
          }, {
            act: 'pr-reject-modal',
            data: `data-id="${p.id}"`,
            icon: 'fa-xmark',
            title: 'Từ chối đề nghị mua hàng'
          }, {
            act: 'pr-delete',
            data: `data-id="${p.id}"`,
            icon: 'fa-trash',
            title: 'Xóa PR chưa duyệt'
          }] : []),
        ])}
      </td>

    </tr>
  `;
});

    return `
    <div class="card" style="margin-bottom:14px">
      <div class="card-head"><div><h3>Quy trình Đề nghị mua hàng</h3><p>Số yêu cầu đang xử lý theo từng giai đoạn</p></div></div>
      <div class="card-body">
        <div class="flow">
          ${PR_FLOW.map((s) => {
            const n = cnt(s.key);
            return `<div class="flow-step ${n ? 'doing' : 'pending'}" data-act="filter-pr" data-status="${s.key}" style="cursor:pointer">
              <div class="flow-ico"><i class="fa-solid ${s.icon}"></i></div>
              <div class="flow-name">${esc(s.name)}</div>
              <div class="flow-date">${n} yêu cầu</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <div class="grid g-auto-sm" style="margin-bottom:14px">
      ${mkpi('Tổng đề nghị', DB.purchases.length, 'fa-cart-shopping', 'blue')}
      ${mkpi('Chờ duyệt', cnt('mh_cho_duyet') + cnt('PENDING_APPROVAL'), 'fa-hourglass-half', 'orange')}
      ${mkpi('Đã phê duyệt', cnt('mh_da_duyet') + cnt('APPROVED'), 'fa-circle-check', 'green')}
      ${mkpi('Từ chối', cnt('mh_tu_choi') + cnt('REJECTED'), 'fa-circle-xmark', 'red')}
      ${mkpi('Giá trị đề xuất', fmtShort(DB.purchases
  .filter((p) =>
    !PURCHASE_INVENTORY_CONFIG
      .prStatus
      .rejected
      .includes(p.status)).reduce((s, p) => s + p.total, 0)), 'fa-sack-dollar', 'indigo')}
    </div>

    <div class="card">
      <div class="toolbar">
        ${searchBox('purchases', 'Tìm mã đề nghị, nhà cung cấp, người yêu cầu…')}
        ${selectFilter('purchases', 'status', statusOptions('mh_'), 'Tất cả trạng thái')}
        ${selectFilter('purchases', 'supplier', suppliers, 'Tất cả nhà cung cấp')}
        ${(f.q || f.status || f.supplier) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="purchases"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
        <span class="spacer"></span>
        <span class="chip"><i class="fa-solid fa-list"></i> ${fmtN(list.length)} yêu cầu</span>
        <button class="btn btn-primary" data-act="create-pr">
          <i class="fa-solid fa-plus"></i>
          Tạo đề nghị mua
        </button>
      </div>
      ${tableShell(
        [{ t: 'Mã đề nghị', w: '130px' }, { t: 'Người yêu cầu', cls: 'hide-sm' }, { t: 'Nguyên liệu' }, { t: 'Nhà cung cấp' }, { t: 'Giá trị', cls: 'right' },
         { t: 'Ngày yêu cầu' }, { t: 'Dự kiến về', cls: 'hide-sm' }, { t: 'Trạng thái', w: '128px' }, { t: 'Thao tác', cls: 'right', w: '130px' },],
        rows, { emptyTitle: 'Không tìm thấy đề nghị mua hàng' })}
      ${pagiHTML('purchases', pg, 'yêu cầu')}
    </div>`;
  };

  /* -------------------------------------------------- TAB 2: DUYỆT MUA HÀNG */
  const renderApprovalTab = () => {
    const pending = DB.purchases
      .filter((p) => PURCHASE_INVENTORY_CONFIG.prStatus.pending.includes(p.status))
      .sort((a, b) => b.id.localeCompare(a.id));
    const pendingValue = pending.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const approved = DB.purchases.filter((p) => PURCHASE_INVENTORY_CONFIG.prStatus.approved.includes(p.status)).length;
    const rejected = DB.purchases.filter((p) => PURCHASE_INVENTORY_CONFIG.prStatus.rejected.includes(p.status)).length;
    const rows = pending.map((p) => `<tr class="clickable" data-act="open-pr" data-id="${p.id}">
      <td><span class="code">${p.id}</span><div class="cell-sub">${esc(p.reason || '')}</div></td>
      <td>${avatarHTML(Q.employeeName(p.requesterId))} ${esc(Q.employeeName(p.requesterId))}<div class="cell-sub">${esc(p.dept || 'Sản xuất')}</div></td>
      <td>${(p.items || []).map((item) => `<div>${esc(item.name)} <span class="muted">(${fmtDec(item.qty, 2)} ${esc(item.unit)})</span></div>`).join('')}</td>
      <td class="right strong num">${fmtVND(p.total)}</td>
      <td class="num">${fmtDate(p.expectedDate)}</td>
      <td>${badge(p.status)}</td>
      <td class="right">${rowActions([
        { act: 'open-pr', data: `data-id="${p.id}"`, icon: 'fa-eye', title: 'Xem và duyệt đề nghị' },
        { act: 'pr-approve-action', data: `data-id="${p.id}"`, icon: 'fa-check', title: 'Phê duyệt đề nghị' },
        { act: 'pr-reject-modal', data: `data-id="${p.id}"`, icon: 'fa-xmark', title: 'Từ chối đề nghị' },
      ])}</td>
    </tr>`);
    const pendingOrders = DB.purchaseOrders.filter((po) => po.status === 'PENDING_APPROVAL').sort((a, b) => b.id.localeCompare(a.id));
    const orderRows = pendingOrders.map((po) => `<tr>
      <td><span class="code">${po.id}</span><div class="cell-sub">Từ ${po.prId}</div></td>
      <td><div class="strong">${esc(Q.supplierName(po.supplierId))}</div><div class="cell-sub">${esc(po.quoteId || 'Báo giá đã chọn')}</div></td>
      <td>${po.items.map((item) => `<div>${esc(item.name)} <span class="muted">(${fmtN(item.qty)} ${esc(item.unit)})</span></div>`).join('')}</td>
      <td class="right strong num">${fmtVND(po.total)}</td>
      <td class="num">${fmtDate(po.expectedDate)}</td>
      <td>${badge(po.status)}</td>
      <td class="right">${rowActions([
        { act: 'open-po', data: `data-id="${po.id}"`, icon: 'fa-eye', title: 'Xem đơn mua' },
        { act: 'po-approve-action', data: `data-id="${po.id}"`, icon: 'fa-check', title: 'Duyệt đơn mua hàng' },
      ])}</td>
    </tr>`);

    return `<div class="grid g-auto-sm" style="margin-bottom:14px">
      ${mkpi('Chờ duyệt', pending.length, 'fa-hourglass-half', 'orange')}
      ${mkpi('Giá trị chờ duyệt', fmtShort(pendingValue), 'fa-sack-dollar', 'blue')}
      ${mkpi('Đã phê duyệt', approved, 'fa-circle-check', 'green')}
      ${mkpi('Đã từ chối', rejected, 'fa-circle-xmark', 'red')}
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Danh sách duyệt mua hàng</h3><p>Kiểm tra nhu cầu, ngân sách và vật tư trước khi chuyển sang bước báo giá nhà cung cấp.</p></div><span class="chip"><i class="fa-solid fa-list-check"></i> ${pending.length} đề nghị chờ xử lý</span></div>
      ${tableShell([
        { t: 'Mã đề nghị', w: '140px' }, { t: 'Người đề nghị' }, { t: 'Vật tư' }, { t: 'Giá trị', cls: 'right' },
        { t: 'Ngày cần hàng' }, { t: 'Trạng thái' }, { t: 'Thao tác', cls: 'right', w: '150px' },
      ], rows, { emptyTitle: 'Không có đề nghị mua hàng chờ duyệt' })}
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Đơn mua hàng chờ duyệt</h3><p>Đối chiếu báo giá đã chọn trước khi phát hành đơn đặt hàng cho nhà cung cấp.</p></div><span class="chip"><i class="fa-solid fa-file-signature"></i> ${pendingOrders.length} đơn chờ duyệt</span></div>
      ${tableShell([
        { t: 'Mã đơn mua', w: '130px' }, { t: 'Nhà cung cấp' }, { t: 'Vật tư' }, { t: 'Giá trị', cls: 'right' },
        { t: 'Giao dự kiến' }, { t: 'Trạng thái' }, { t: 'Thao tác', cls: 'right', w: '130px' },
      ], orderRows, { emptyTitle: 'Không có đơn mua hàng chờ duyệt' })}
    </div>`;
  };

  /* -------------------------------------------------- TAB 3: BÁO GIÁ NCC */
  const renderQuotesTab = () => {
    const approvedStatuses = PURCHASE_INVENTORY_CONFIG.prStatus.approved;
    const quoteStatus = f.quoteStatus || '';
    const quoteSupplier = f.quoteSupplier || '';
    const approvedPrs = DB.purchases.filter((p) => {
      if (!approvedStatuses.includes(p.status)) return false;
      if (quoteStatus && p.status !== quoteStatus) return false;
      const supplierIds = (p.items || []).flatMap((item) => item.supplierIds || (item.supplierId ? [item.supplierId] : []));
      return !quoteSupplier || supplierIds.includes(quoteSupplier);
    }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

    const quotePage = paged(approvedPrs, 'purchaseQuotePrs', 5);
    const quoteStatuses = approvedStatuses.map((status) => [status, statusLabel(status)]);
    const quoteSuppliers = DB.suppliers.map((supplier) => [supplier.id, supplier.name]);

    const renderInlineQuote = (pr) => {
      const prQuotes = DB.supplierQuotations.filter((quote) => quote.prId === pr.id);
      const quotationLocked = prQuotes.some((quote) => quote.confirmed || quote.confirmedAt);

      const itemRows = (pr.items || []).map((item) => {
        const existingSupplierIds = prQuotes
          .flatMap((quote) => (quote.items || [])
            .filter((quoteItem) => quoteItem.materialId === item.materialId)
            .map(() => quote.supplierId));
        const supplierIds = [...new Set([...(item.supplierIds || (item.supplierId ? [item.supplierId] : [])), ...existingSupplierIds])];
        const savedItems = prQuotes.flatMap((quote) => (quote.items || []).map((quoteItem) => ({
          ...quoteItem,
          supplierId: quoteItem.supplierId || quote.supplierId,
          quoteSelected: quote.selected,
        })));
        const enteredPrices = supplierIds.map((supplierId) => ({
          supplierId,
          price: Number(savedItems.find((savedItem) => savedItem.materialId === item.materialId && savedItem.supplierId === supplierId)?.price || 0),
        })).filter((entry) => entry.price > 0);
        const lowestPrice = enteredPrices.length ? Math.min(...enteredPrices.map((entry) => entry.price)) : 0;
        const selectedSupplierId = savedItems.find((savedItem) => savedItem.materialId === item.materialId && savedItem.selected)?.supplierId
          || savedItems.find((savedItem) => savedItem.materialId === item.materialId && savedItem.quoteSelected)?.supplierId
          || '';

        return `<tr>
          <td><div class="strong">${esc(item.name)}</div><div class="cell-sub">${esc(item.materialId)}</div></td>
          <td class="right num">${fmtN(item.qty)} ${esc(item.unit)}</td>
          <td class="right strong num">${fmtVND(item.expectedPrice || item.price || 0)}</td>
          <td>${supplierIds.length ? supplierIds.map((supplierId) => {
            const oldItem = savedItems.find((quoteItem) => quoteItem.materialId === item.materialId && quoteItem.supplierId === supplierId);
            const price = Number(oldItem?.price || 0);
            const isLowest = price > 0 && price === lowestPrice;
            const isSelected = selectedSupplierId === supplierId;
            return `<div class="quote-supplier-line" style="display:grid;grid-template-columns:minmax(220px,1fr) 150px auto;align-items:center;gap:10px;padding:9px 11px;margin:5px 0;border:1px solid ${quotationLocked || isLowest ? 'var(--green)' : 'var(--border)'};border-radius:var(--r);background:${quotationLocked || isLowest ? 'var(--green-soft)' : 'var(--surface)'}">
              <label style="display:flex;align-items:center;gap:7px;min-width:0"><input type="radio" class="quote-supplier-choice" name="quoteSupplier_${pr.id}_${item.materialId}" data-pr-id="${pr.id}" data-material-id="${item.materialId}" data-supplier-id="${supplierId}" ${isSelected ? 'checked' : ''} ${quotationLocked ? 'disabled' : ''}/><span class="strong">${esc(Q.supplierName(supplierId))}</span></label>
              <input class="inp right num quote-supplier-price" data-pr-id="${pr.id}" data-material-id="${item.materialId}" data-supplier-id="${supplierId}" type="number" min="1" value="${price || ''}" placeholder="Nhập giá" ${quotationLocked ? 'disabled' : ''} style="width:150px;${quotationLocked || isLowest ? 'border-color:var(--green);font-weight:700;' : ''}" />
              ${quotationLocked ? '<span class="badge green"><i class="fa-solid fa-lock"></i> Đã xác nhận</span>' : (isLowest ? '<span class="badge green"><i class="fa-solid fa-arrow-down"></i> Giá tốt nhất</span>' : '<span></span>')}
            </div>`;
          }).join('') : '<span class="muted">Chưa có NCC được chọn trong đề nghị</span>'}</td>
        </tr>`;
      });

      return `<div style="padding:4px 2px 8px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:4px 0 10px">
          <div><div class="strong" style="font-size:13.5px">Báo giá cho ${esc(pr.id)}</div><div class="muted">Nhập giá và chọn nhà cung cấp theo từng nguyên liệu ngay tại đây.</div></div>
          ${quotationLocked ? '<span class="chip"><i class="fa-solid fa-lock"></i> Chỉ xem</span>' : `<button class="btn btn-sm btn-primary" data-act="quote-confirm-pr" data-id="${pr.id}"><i class="fa-solid fa-check"></i>Xác nhận chọn NCC</button>`}
        </div>
        ${tableShell([{ t: 'Nguyên liệu' }, { t: 'Số lượng', cls: 'right' }, { t: 'Giá dự kiến', cls: 'right' }, { t: 'Nhà cung cấp và giá báo' }], itemRows, { emptyTitle: 'Đề nghị chưa có nguyên liệu' })}
      </div>`;
    };

    const prRows = quotePage.items.map((p) => {
      const supplierIds = [...new Set((p.items || []).flatMap((item) => item.supplierIds || (item.supplierId ? [item.supplierId] : [])))];
      const expanded = f.prId === p.id;
      return `<tr class="clickable quote-parent-row ${expanded ? 'quote-parent-selected' : ''}" data-act="quote-select-pr" data-id="${p.id}">
        <td><span class="code">${p.id}</span><div class="cell-sub">${esc(p.reason || '')}</div></td>
        <td>${(p.items || []).length} sản phẩm</td>
        <td>${supplierIds.map((id) => `<span class="chip" style="margin:2px">${esc(Q.supplierName(id))}</span>`).join('') || '<span class="muted">Chưa có NCC</span>'}</td>
        <td class="right strong num">${fmtVND(p.total)}</td>
        <td class="num">${fmtDate(p.date)}</td>
        <td style="white-space:nowrap">${badge(p.status)} <i class="fa-solid fa-chevron-${expanded ? 'up' : 'down'} muted" style="margin-left:6px"></i></td>
      </tr>
      ${expanded ? `<tr class="quote-inline-detail"><td colspan="6" style="padding:0 14px 14px 28px;background:var(--surface-2);border-top:0"><div class="quote-child-panel">${renderInlineQuote(p)}</div></td></tr>` : ''}`;
    });

    return `<div class="card">
      <div class="card-head"><div><h3>Báo giá nhà cung cấp theo đề nghị mua</h3><p>Click vào từng đề nghị để mở báo giá ngay bên dưới dòng đó. Click lại để thu gọn.</p></div><span class="chip"><i class="fa-solid fa-list"></i> ${approvedPrs.length} đề nghị</span></div>
      <div class="toolbar">
        ${selectFilter('purchases', 'quoteStatus', quoteStatuses, 'Tất cả trạng thái đã duyệt')}
        ${selectFilter('purchases', 'quoteSupplier', quoteSuppliers, 'Tất cả nhà cung cấp')}
        ${(quoteStatus || quoteSupplier) ? '<button class="btn btn-sm" data-act="clear-quote-filters"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
      </div>
      ${tableShell([{ t: 'Mã đề nghị', w: '150px' }, { t: 'Sản phẩm' }, { t: 'Nhà cung cấp đã chọn' }, { t: 'Giá trị dự kiến', cls: 'right' }, { t: 'Ngày tạo' }, { t: 'Trạng thái' }], prRows, { emptyTitle: 'Chưa có đề nghị mua hàng đã duyệt' })}
      ${pagiHTML('purchaseQuotePrs', quotePage, 'đề nghị')}
    </div>`;
  };

  /* -------------------------------------------------- TAB 3: PO (ĐƠN ĐẶT HÀNG) */
  const renderPoTab = () => {
    const list = DB.purchaseOrders.filter((po) => {
      if (f.status && po.status !== f.status) return false;
      if (f.supplier && po.supplierId !== f.supplier) return false;
      if (q && ![po.id, po.prId, Q.supplierName(po.supplierId), po.note].some((v) => String(v).toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => b.id.localeCompare(a.id));
    const pg = paged(list, 'purchases');
    const suppliers = DB.suppliers.map((s) => [s.id, s.name]);

    const rows = pg.items.map((po) => `
      <tr class="clickable" data-act="open-po" data-id="${po.id}">
        <td><span class="code">${po.id}</span><div class="cell-sub">từ ${po.prId}</div></td>
        <td>${cell2(esc(Q.supplierName(po.supplierId)), esc(po.items.map((i) => i.name).join(', ')))}</td>
        <td class="num">${fmtDate(po.date)}</td>
        <td class="num hide-sm">${fmtDate(po.expectedDate)}</td>
        <td class="right strong num">${fmtVND(po.total)}</td>
        <td class="right num hide-sm" style="color:var(--green)">${fmtVND(po.paid)}</td>
        <td>${badge(po.status)}</td>
        <td>${rowActions([
          { act: 'open-po', data: `data-id="${po.id}"`, icon: 'fa-eye', title: 'Xem chi tiết PO' },
          ...(['DRAFT', 'APPROVED'].includes(po.status) ? [{ act: 'po-edit', data: `data-id="${po.id}"`, icon: 'fa-pen-to-square', title: 'Sửa và chuyển lại thành đề nghị mua' }] : []),
          ...(po.status === 'APPROVED' ? [{ act: 'po-change-status', data: `data-id="${po.id}" data-status="SENT_TO_SUPPLIER"`, icon: 'fa-paper-plane', title: 'Gửi cho Nhà cung cấp' }] : []),
          ...(po.status === 'SENT_TO_SUPPLIER' ? [{ act: 'po-change-status', data: `data-id="${po.id}" data-status="SHIPPING"`, icon: 'fa-truck-fast', title: 'Xác nhận đã giao hàng' }] : []),
          ...(po.status === 'RECEIVED' && !(DB.supplierEvaluationHistory || []).some(e => e.poId === po.id) ? [{ act: 'po-evaluate-supplier', data: `data-id="${po.id}"`, icon: 'fa-star', title: 'Đánh giá nhà cung cấp' }] : []),
          ...((DB.goodsIssues || []).some(x => x.type === 'RETURN_OUT' && (x.refDoc === po.id || x.poId === po.id)) ? [{ act: 'po-create-return-pr', data: `data-id="${po.id}"`, icon: 'fa-cart-plus', title: 'Gửi đề nghị mua thêm cho hàng đã trả' }] : []),
          ...(!['RECEIVED', 'PARTIAL_RECEIVED', 'CANCELLED', 'SHIPPING'].includes(po.status) ? [{ act: 'po-cancel', data: `data-id="${po.id}"`, icon: 'fa-ban', title: 'Hủy đơn đặt hàng' }] : []),
        ])}</td>
      </tr>`);

    return `
    <div class="grid g-auto-sm" style="margin-bottom:14px">
      ${mkpi('Tổng đơn đặt hàng', DB.purchaseOrders.length, 'fa-file-invoice-dollar', 'blue')}
      ${mkpi('Đang giao hàng', DB.purchaseOrders.filter((p) => p.status === 'SHIPPING').length, 'fa-truck-fast', 'teal')}
      ${mkpi('Nhận 1 phần', DB.purchaseOrders.filter((p) => p.status === 'PARTIAL_RECEIVED').length, 'fa-boxes-packing', 'orange')}
      ${mkpi('Đã nhận đủ', DB.purchaseOrders.filter((p) => p.status === 'RECEIVED').length, 'fa-circle-check', 'green')}
      ${mkpi('Tổng giá trị đơn hàng', fmtShort(DB.purchaseOrders.reduce((s, p) => s + p.total, 0)), 'fa-sack-dollar', 'indigo')}
    </div>

    <div class="card">
      <div class="toolbar">
        ${searchBox('purchases', 'Tìm mã đơn hàng, mã đề nghị, nhà cung cấp…')}
        ${selectFilter('purchases', 'status', statusOptions('po_'), 'Tất cả trạng thái đơn hàng')}
        ${selectFilter('purchases', 'supplier', suppliers, 'Tất cả nhà cung cấp')}
        ${(f.q || f.status || f.supplier) ? '<button class="btn btn-sm" data-act="clear-filter" data-key="purchases"><i class="fa-solid fa-filter-circle-xmark"></i>Xóa lọc</button>' : ''}
        <span class="spacer"></span>
        <span class="chip"><i class="fa-solid fa-list"></i> ${fmtN(list.length)} đơn PO</span>
      </div>
      ${tableShell(
        [{ t: 'Mã đơn hàng', w: '130px' }, { t: 'Nhà cung cấp' }, { t: 'Ngày đặt' }, { t: 'Giao dự kiến', cls: 'hide-sm' },
         { t: 'Tổng giá trị đơn hàng', cls: 'right' }, { t: 'Đã thanh toán', cls: 'right hide-sm' }, { t: 'Trạng thái đơn hàng', w: '140px' }, { t: 'Thao tác', cls: 'right', w: '120px' }],
        rows, { emptyTitle: 'Chưa có đơn đặt hàng nào' })}
      ${pagiHTML('purchases', pg, 'đơn hàng')}
    </div>`;
  };

  /* -------------------------------------------------- TAB 4: NHẬP KHO (GOODS RECEIPTS) */
  const renderReceiptsTab = () => {
    const list = [...DB.goodsReceipts].sort((a, b) => b.date.localeCompare(a.date));
    const rows = list.map((g) => `
      <tr>
        <td><span class="code">${g.id}</span></td>
        <td><span class="code" style="color:var(--primary)">${g.poId}</span></td>
        <td class="num">${fmtDate(g.date)}</td>
        <td>${esc(Q.employeeName(g.receivedBy))}</td>
        <td><span class="chip">${esc(g.warehouse)}</span></td>
        <td>${esc(g.items.map((i) => `${i.name} (+${fmtN(i.qty)} ${i.unit})`).join(', '))}</td>
        <td>${badge(g.status)}</td>
        <td class="muted">${esc(g.note)}</td>
      </tr>`);

    return `
    <div class="card">
      <div class="toolbar">
        ${searchBox('purchases', 'Tìm phiếu nhập, mã PO, người nhận…')}
        <span class="spacer"></span>
        <span class="chip"><i class="fa-solid fa-warehouse"></i> ${list.length} lượt nhập kho</span>
      </div>
      ${tableShell(
        [{ t: 'Số phiếu nhập', w: '130px' }, { t: 'Mã PO', w: '120px' }, { t: 'Ngày nhận' }, { t: 'Người nhận' },
         { t: 'Kho nhận' }, { t: 'Vật tư nhận' }, { t: 'Trạng thái' }, { t: 'Ghi chú' }],
        rows, { emptyTitle: 'Chưa có lượt nhập kho nào' })}
    </div>`;
  };

  /* -------------------------------------------------- TAB 5: CÔNG NỢ NCC */
  const renderDebtsTab = () => {
    const pos = DB.purchaseOrders;
    const totalPoVal = pos.reduce((s, p) => s + p.total, 0);
    const totalPaidVal = pos.reduce((s, p) => s + p.paid, 0);
    const remainingDebt = totalPoVal - totalPaidVal;

    const rows = pos.map((p) => {
      const remain = p.total - p.paid;
      const payStatus = remain <= 0 ? 'PAID' : p.paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
      return `<tr>
        <td><span class="code">${p.id}</span></td>
        <td><div class="strong">${esc(Q.supplierName(p.supplierId))}</div></td>
        <td class="num hide-sm">${fmtDate(p.date)}</td>
        <td class="right num strong">${fmtVND(p.total)}</td>
        <td class="right num" style="color:var(--green)">${fmtVND(p.paid)}</td>
        <td class="right num strong" style="color:${remain > 0 ? 'var(--red)' : 'var(--text-3)'}">${fmtVND(remain)}</td>
        <td>${badge(payStatus)}</td>
        <td class="right">${remain > 0 ? `<button class="btn btn-xs btn-primary" data-act="supplier-pay-modal" data-id="${p.id}"><i class="fa-solid fa-hand-holding-dollar"></i>Thanh toán</button>` : '<span class="muted">Tất toán</span>'}</td>
      </tr>`;
    });

    return `
    <div class="grid g-auto-sm" style="margin-bottom:14px">
      ${mkpi('Tổng giá trị mua PO', fmtShort(totalPoVal), 'fa-sack-dollar', 'blue')}
      ${mkpi('Đã thanh toán', fmtShort(totalPaidVal), 'fa-circle-check', 'green')}
      ${mkpi('Công nợ còn lại', fmtShort(remainingDebt), 'fa-file-invoice-dollar', 'red')}
      ${mkpi('Số đợt thanh toán', DB.supplierPayments.length, 'fa-receipt', 'indigo')}
    </div>

    <div class="card">
      <div class="card-head"><div><h3>Sổ theo dõi công nợ nhà cung cấp theo PO</h3><p>Công nợ còn lại = Tổng giá trị PO − Đã thanh toán</p></div></div>
      ${tableShell(
        [{ t: 'Mã PO', w: '120px' }, { t: 'Nhà cung cấp' }, { t: 'Ngày PO', cls: 'hide-sm' },
         { t: 'Tổng PO', cls: 'right' }, { t: 'Đã thanh toán', cls: 'right' }, { t: 'Công nợ còn lại', cls: 'right' }, { t: 'Trạng thái', w: '130px' }, { t: 'Thao tác', cls: 'right' }],
        rows, { emptyTitle: 'Không có dữ liệu công nợ' })}
    </div>`;
  };

  /* -------------------------------------------------- TAB 6: LỊCH SỬ GIÁ MUA */
  const renderPriceHistoryTab = () => {
    const list = [...DB.purchasePriceHistory].sort((a, b) => b.date.localeCompare(a.date));
    const matList = DB.materials.map((m) => [m.id, m.name]);
    const selMatId = f.materialId || '';
    const filtered = selMatId ? list.filter((x) => x.materialId === selMatId) : list;

    // Cảnh báo tăng giá > 10%
    let alertHtml = '';
    if (selMatId && filtered.length >= 2) {
      const newest = filtered[0];
      const prev = filtered[1];
      const pct = prev.price ? Math.round(((newest.price - prev.price) / prev.price) * 1000) / 10 : 0;
      if (pct > 10) {
        alertHtml = `
        <div class="alert-item" style="border-color:var(--red);background:var(--red-soft);margin-bottom:14px">
          <span class="alert-ico t-red"><i class="fa-solid fa-arrow-trend-up"></i></span>
          <span style="min-width:0">
            <span class="alert-title" style="color:var(--red)">CẢNH BÁO TĂNG GIÁ MUA VƯỢT NGƯỠNG 10%</span>
            <div class="alert-sub">Sản phẩm <b>${esc(Q.material(selMatId)?.name)}</b> tăng <b>+${pct}%</b> (từ ${fmtVND(prev.price)} lên ${fmtVND(newest.price)}) vào ngày ${fmtDate(newest.date)}</div>
          </span>
        </div>`;
      }
    }

    const rows = filtered.map((x) => `
      <tr>
        <td><span class="code">${x.materialId}</span></td>
        <td><div class="strong">${esc(Q.material(x.materialId)?.name)}</div></td>
        <td>${esc(Q.supplierName(x.supplierId))}</td>
        <td><span class="code" style="color:var(--primary)">${x.poId}</span></td>
        <td class="num">${fmtDate(x.date)}</td>
        <td class="right num">${fmtN(x.qty)}</td>
        <td class="right strong num" style="color:var(--primary)">${fmtVND(x.price)}</td>
        <td class="right strong num">${fmtVND(x.amount)}</td>
      </tr>`);

    return `
    ${alertHtml}
    <div class="card">
      <div class="toolbar">
        ${selectFilter('purchases', 'materialId', matList, 'Tất cả vật tư')}
        <span class="spacer"></span>
        <span class="chip"><i class="fa-solid fa-chart-line"></i> ${filtered.length} lượt theo dõi giá</span>
      </div>
      ${tableShell(
        [{ t: 'Mã VT', w: '90px' }, { t: 'Tên nguyên vật liệu' }, { t: 'Nhà cung cấp' }, { t: 'Đơn PO', w: '110px' },
         { t: 'Ngày mua' }, { t: 'Số lượng', cls: 'right' }, { t: 'Đơn giá mua', cls: 'right' }, { t: 'Thành tiền', cls: 'right' }],
        rows, { emptyTitle: 'Chưa có lịch sử giá mua nào' })}
    </div>`;
  };

  /* -------------------------------------------------- TAB 7: ĐÁNH GIÁ NCC */
  const renderEvaluationsTab = () => {
    const ef = F('supplierEvaluations', { q: '', sort: 'high' });
    const q = (ef.q || '').toLowerCase().trim();
    const sort = ef.sort || 'high';
    let list = DB.suppliers.filter((supplier) => {
      return !q || [supplier.id, supplier.name, supplier.contact, supplier.group].some((value) => String(value || '').toLowerCase().includes(q));
    });
    const scoreOf = (supplier) => Number(Q.supplierEvaluation(supplier.id)?.totalScore ?? supplier.rating ?? 0);
    list = list.sort((a, b) => {
      if (sort === 'low') return scoreOf(a) - scoreOf(b);
      if (sort === 'name') return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
      return scoreOf(b) - scoreOf(a);
    });
    const rows = list.map((supplier) => {
      const e = Q.supplierEvaluation(supplier.id) || {};
      const score = scoreOf(supplier);
      const low = score > 0 && score < 4;
      const rowStyle = low ? 'background:var(--red-soft);' : '';
      return `<tr style="${rowStyle}">
        <td><span class="code">${esc(supplier.id)}</span></td>
        <td><div class="strong">${esc(supplier.name)}</div><div class="cell-sub">${esc(supplier.group || '')}</div></td>
        <td class="center strong num" style="${low ? 'color:var(--red);' : ''}">${score ? score.toFixed(1) : '—'} / 5${low ? ' <span class="badge red" style="margin-left:5px">Đánh giá thấp</span>' : ''}</td>
        <td class="center"><input class="inp right num supplier-rating-input" data-supplier-id="${supplier.id}" type="number" min="0" max="5" step="0.1" value="${score ? score : ''}" placeholder="0–5" style="width:95px;${low ? 'border-color:var(--red);' : ''}" /></td>
        <td><input class="inp supplier-rating-note" data-supplier-id="${supplier.id}" value="${esc(e.notes || '')}" placeholder="Nhận xét / ghi chú" style="min-width:180px" /></td>
        <td class="right"><button class="btn btn-sm btn-primary" data-act="supplier-evaluation-save" data-id="${supplier.id}"><i class="fa-solid fa-floppy-disk"></i>Lưu</button></td>
      </tr>`;
    });
    return `
    <div class="card">
      <div class="card-head"><div><h3>Đánh giá nhà cung cấp</h3><p>Danh sách toàn bộ nhà cung cấp, tìm kiếm, sắp xếp theo điểm và cập nhật đánh giá trực tiếp.</p></div></div>
      <div class="toolbar">
        ${searchBox('supplierEvaluations', 'Tìm theo mã hoặc tên nhà cung cấp…')}
        ${selectFilter('supplierEvaluations', 'sort', [['high', 'Đánh giá cao → thấp'], ['low', 'Đánh giá thấp → cao'], ['name', 'Tên nhà cung cấp A → Z']], 'Sắp xếp')}
        <span class="spacer"></span><span class="chip"><i class="fa-solid fa-list"></i> ${list.length} nhà cung cấp</span>
      </div>
      ${tableShell(
        [{ t: 'Mã NCC', w: '90px' }, { t: 'Nhà cung cấp' }, { t: 'Đánh giá hiện tại', cls: 'center' }, { t: 'Nhập đánh giá', cls: 'center' }, { t: 'Nhận xét' }, { t: 'Thao tác', cls: 'right' }],
        rows, { emptyTitle: 'Không tìm thấy nhà cung cấp' })}
    </div>`;
  };

  /* -------------------------------------------------- TAB 8: DASHBOARD MUA HÀNG */
  const renderDashboardTab = () => {
    const pendingPR = DB.purchases.filter((p) => ['mh_cho_duyet', 'PENDING_APPROVAL'].includes(p.status)).length;
    const shippingPO = DB.purchaseOrders.filter((p) => p.status === 'SHIPPING').length;
    const partialPO = DB.purchaseOrders.filter((p) => p.status === 'PARTIAL_RECEIVED').length;
    const fullPO = DB.purchaseOrders.filter((p) => p.status === 'RECEIVED').length;
    const totalPoVal = DB.purchaseOrders.reduce((s, p) => s + p.total, 0);
    const totalPaidVal = DB.purchaseOrders.reduce((s, p) => s + p.paid, 0);
    const remainingDebt = totalPoVal - totalPaidVal;
    const lowStockCount = Q.lowStock().length;

    return `
    <div class="grid g-4" style="margin-bottom:14px">
      ${mkpi('PR chờ duyệt', pendingPR, 'fa-hourglass-half', 'orange')}
      ${mkpi('PO đang giao', shippingPO, 'fa-truck-fast', 'teal')}
      ${mkpi('PO nhận 1 phần', partialPO, 'fa-boxes-packing', 'indigo')}
      ${mkpi('PO đã nhận đủ', fullPO, 'fa-circle-check', 'green')}
      ${mkpi('Tổng giá trị mua PO', fmtShort(totalPoVal), 'fa-sack-dollar', 'blue')}
      ${mkpi('Nợ phải trả NCC', fmtShort(remainingDebt), 'fa-file-invoice-dollar', 'red')}
      ${mkpi('Vật tư sắp hết tồn', lowStockCount, 'fa-triangle-exclamation', 'orange')}
      ${mkpi('Nhà cung cấp', DB.suppliers.length, 'fa-handshake', 'teal')}
    </div>

    <div class="grid g-21" style="margin-bottom:14px">
      <div class="card">
        <div class="card-head"><div><h3>Phân bổ giá trị mua hàng theo Nhà cung cấp</h3><p>Tỷ trọng mua sắm theo từng nhà đối tác</p></div></div>
        <div class="card-body"><div class="chart-box"><canvas id="chPurchaseSupplier"></canvas></div></div>
      </div>

      <div class="card">
        <div class="card-head"><div><h3>Trạng thái các Đơn đặt hàng (PO)</h3><p>Tổng ${DB.purchaseOrders.length} đơn PO đang theo dõi</p></div></div>
        <div class="card-body"><div class="chart-box sm"><canvas id="chPoStatus"></canvas></div></div>
      </div>
    </div>`;
  };

  /* --- RENDER CHÍNH THEO TAB --- */
  let tabContent = '';
  if (f.tab === 'quotes') tabContent = renderQuotesTab();
  else if (f.tab === 'approval') tabContent = renderApprovalTab();
  else if (f.tab === 'po') tabContent = renderPoTab();
  else if (f.tab === 'debts') tabContent = renderDebtsTab();
  else if (f.tab === 'price_history') tabContent = renderPriceHistoryTab();
  else if (f.tab === 'dashboard') tabContent = renderDashboardTab();
  else if (f.tab === 'suppliers') tabContent = Views.suppliers ? Views.suppliers() : '';
  else tabContent = renderPrTab();

  return `
    ${tabContent}
  `;
};

Views.purchases.after = function () {

  const f = F('purchases', { tab: 'pr' });

  if (f.tab === 'dashboard') {

    const suppliers = DB.suppliers.slice(0, 5);

    const supplierVals = suppliers.map(s =>
      DB.purchaseOrders
        .filter(p => p.supplierId === s.id)
        .reduce((sum, p) => sum + p.total, 0)
    );

    Charts.bar(
      'chPurchaseSupplier',
      suppliers.map(s => s.name.slice(0, 18) + '…'),
      [
        {
          label: 'Giá trị mua (VND)',
          data: supplierVals,
          color: 'blue'
        }
      ]
    );

    const poStatuses = [
      'po_draft',
      'po_sent_to_supplier',
      'po_shipping',
      'po_partial_received',
      'po_received'
    ];

    const poCounts = [
      DB.purchaseOrders.filter(p => p.status === 'DRAFT').length,
      DB.purchaseOrders.filter(p => p.status === 'SENT_TO_SUPPLIER').length,
      DB.purchaseOrders.filter(p => p.status === 'SHIPPING').length,
      DB.purchaseOrders.filter(p => p.status === 'PARTIAL_RECEIVED').length,
      DB.purchaseOrders.filter(p => p.status === 'RECEIVED').length,
    ];

    Charts.donut(
      'chPoStatus',
      ['Nháp PO', 'Đã gửi NCC', 'Đang giao', 'Nhận 1 phần', 'Đã nhận đủ'],
      poCounts,
      ['slate', 'blue', 'teal', 'orange', 'green']
    );

  }

};

/* ------------------------------------------------------------ MODALS MUA HÀNG */

/** Modal xem chi tiết Đề nghị mua hàng (PR) */
function openPRModal(id) {
  const p = Q.purchase(id);
  if (!p) return;
  // PR không còn chọn NCC ở bước này
  const s = p.supplierId
    ? Q.supplier(p.supplierId)
    : null;
  const supplierLabel = s ? s.name : 'Chưa chọn nhà cung cấp';
  const isPending =
  PURCHASE_INVENTORY_CONFIG
    .prStatus
    .pending
    .includes(p.status);


const isApproved =
  PURCHASE_INVENTORY_CONFIG
    .prStatus
    .approved
    .includes(p.status);
  const approvals = DB.purchaseApprovals.filter((a) => a.prId === id);

  Modal.open({
    title: `Đề nghị mua hàng (PR) ${p.id}`,
    sub: `${esc(supplierLabel)} · Người yêu cầu ${esc(Q.employeeName(p.requesterId))}`,
    size: 'md',
    body: `
      <div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:16px">
        ${badge(p.status)}
        <span class="chip"><i class="fa-regular fa-calendar"></i> Ngày tạo: ${fmtDate(p.date)}</span>
        <span class="chip"><i class="fa-solid fa-truck"></i> Ngày cần hàng: ${fmtDate(p.expectedDate)}</span>
      </div>

      <div class="form-sec-title"><i class="fa-solid fa-circle-info"></i>Thông tin đề nghị</div>
      <div class="info-grid" style="margin-bottom:16px">
        ${infoItem('Bộ phận đề nghị', esc(p.dept || 'Sản xuất'))}
        ${infoItem('Nhà cung cấp dự kiến', esc(supplierLabel))}
        ${infoItem('Người phê duyệt', p.approvedBy ? esc(Q.employeeName(p.approvedBy)) : '<span class="muted">Chưa duyệt</span>')}
        ${infoItem('Tổng giá trị đề xuất', `<b class="num" style="color:var(--primary);font-size:15px">${fmtVND(p.total)}</b>`)}
      </div>

      <div style="font-size:12.8px;color:var(--text-2);background:var(--surface-2);border-radius:var(--r);padding:10px 12px;margin-bottom:16px">
        <b>Mục đích / Lý do đề xuất:</b> ${esc(p.reason)}
      </div>

      <div class="form-sec-title"><i class="fa-solid fa-list-check"></i>Danh sách vật tư đề nghị</div>
      ${tableShell(
        [{ t: 'Mã VT', w: '88px' }, { t: 'Tên vật tư' }, { t: 'Số lượng', cls: 'right' }, { t: 'ĐVT' }, { t: 'Đơn giá dự kiến', cls: 'right' }, { t: 'Thành tiền', cls: 'right' }, { t: 'Xử lý PO' }],
        p.items.map((it) => {
          const history = Array.isArray(it.poHistory) ? it.poHistory : [];
          const poTrace = history.length
            ? history.slice().reverse().map((event) => `<div style="margin-bottom:5px">
                <span class="chip" style="font-size:11px"><i class="fa-solid fa-ban"></i> ${esc(event.poId || 'PO')} đã hủy</span>
                ${event.replacementPrId ? `<div class="cell-sub" style="margin-top:3px">Đề nghị thay thế: <span class="code">${esc(event.replacementPrId)}</span></div>` : ''}
              </div>`).join('')
            : '<span class="muted">—</span>';
          return `<tr>
          <td><span class="code">${it.materialId}</span></td>
          <td class="strong">${esc(it.name)}</td>
          <td class="right num strong">${fmtN(it.qty)}</td>
          <td>${esc(it.unit)}</td>
          <td class="right num">${fmtVND(it.price)}</td>
          <td class="right strong num">${fmtVND(it.amount)}</td>
          <td>${poTrace}</td></tr>`;
        }))}

      ${approvals.length ? `
      <div class="form-sec-title" style="margin-top:16px"><i class="fa-solid fa-clock-rotate-left"></i>Lịch sử phê duyệt</div>
      <div class="tline" style="margin-bottom:16px">
        ${approvals.map((a) => `<div class="tline-item done">
          <span class="tline-dot t-${a.action === 'approve' ? 'green' : 'red'}"><i class="fa-solid fa-${a.action === 'approve' ? 'check' : 'xmark'}"></i></span>
          <div class="tline-title">${esc(Q.employeeName(a.approverId))} — <span style="color:var(--${a.action === 'approve' ? 'green' : 'red'})">${a.action === 'approve' ? 'Phê duyệt' : 'Từ chối'}</span></div>
          <div class="tline-sub">${esc(a.note)} · ${fmtDate(a.time)}</div>
        </div>`).join('')}
      </div>` : ''}`,
        foot: `${isPending ? `<button class="btn btn-danger left" data-act="pr-delete" data-id="${p.id}"><i class="fa-solid fa-trash"></i>Xóa PR</button>
          <button class="btn" data-act="pr-reject-modal" data-id="${p.id}"><i class="fa-solid fa-xmark"></i>Từ chối PR</button>
          <button class="btn btn-success" data-act="pr-approve-action" data-id="${p.id}"><i class="fa-solid fa-check"></i>Duyệt PR</button>` : ''}
          <button class="btn" data-act="modal-close">Đóng</button>`,
  });
}

/** Modal Form Tạo Đề nghị mua hàng (PR) — Kiểm soát Ngân sách & Tồn kho tối thiểu */

function openPRForm(materialId) {

  const cfg = PURCHASE_INVENTORY_CONFIG.defaultPR;
  const draft = State.prFormDraft || {};
  const isResuming = !materialId && Array.isArray(State.prFormMaterials) && Object.keys(draft).length > 0;

  // =========================================================
  // DANH SÁCH NGUYÊN LIỆU ĐƯỢC CHỌN TRONG FORM
  // =========================================================

  const normalizePurchaseItem = (base) => {
    if (!base) return null;
    const isFinished = !Q.material(base.id) && !!Q.product(base.id);
    const stock = isFinished
      ? DB.inventory.filter(row => row.productId === base.id).reduce((sum, row) => sum + Number(row.qtyOnHand || 0), 0)
      : Number(base.stock || 0);
    return {
      ...base,
      group: base.group || (isFinished ? 'Thành phẩm' : ''),
      stock,
      minStock: isFinished ? Number(DB.finishedMinStock?.[base.id] || 0) : Number(base.minStock || 0),
      supplierId: base.supplierId || base.supplier || null,
    };
  };

  State.prFormMaterials = materialId
    ? [normalizePurchaseItem(Q.material(materialId) || Q.product(materialId))].filter(Boolean)
    : (isResuming ? State.prFormMaterials : []);


  // =========================================================
  // NGÂN SÁCH
  // =========================================================

  const deptBudget =
    Q.deptBudget(cfg.department) || {
      totalBudget: 2500000000,
      usedBudget: 1850000000,
      remaining: 650000000
    };


  // =========================================================
  // CẢNH BÁO TỒN KHO
  // =========================================================

  let minStockWarn = '';

  if (materialId) {

    const m = Q.material(materialId);

    if (m && m.stock >= m.minStock) {

      minStockWarn = `
        <div
          class="alert-item"
          style="
            border-color:var(--orange);
            background:var(--orange-soft);
            margin-bottom:14px
          "
        >

          <span class="alert-ico t-orange">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </span>

          <span style="min-width:0">

            <span
              class="alert-title"
              style="color:var(--orange)"
            >
              CẢNH BÁO TỒN KHO TRÊN MỨC TỐI THIỂU
            </span>

            <div class="alert-sub">
              Vật tư <b>${esc(m.name)}</b>
              hiện đang có tồn kho

              <b>
                ${fmtDec(m.stock, 2)} ${m.unit}
              </b>

              (>= Định mức tối thiểu
              ${fmtDec(m.minStock, 2)} ${m.unit}).

              Cân nhắc xem có thực sự cần mua thêm không.
            </div>

          </span>

        </div>
      `;
    }
  }


  // =========================================================
  // MODAL
  // =========================================================

  Modal.open({

    title: State.prEditingExistingPrId ? `Sửa Đề nghị mua hàng (PR) ${State.prEditingExistingPrId}` : 'Tạo Đề nghị mua hàng (Purchase Request)',

    sub:
      State.prEditingExistingPrId ? 'Cập nhật đề nghị mua hàng gốc rồi thực hiện lại quy trình phê duyệt.' : 'Điền thông tin nguyên liệu cần mua sắm phục vụ sản xuất / dự phòng tồn kho',

    size: 'md',


    body: `

      ${minStockWarn}


      <!-- ===================================================
           THÔNG TIN CHUNG
      ==================================================== -->

      <div class="form-grid">

        <div class="field">

          <label>
            Bộ phận đề nghị
          </label>

          <select class="inp" id="prDept">

            ${DB.departments.map(d => `
              <option
                value="${esc(d)}"
                ${d === (draft.dept || cfg.department) ? 'selected' : ''}
              >
                ${esc(d)}
              </option>
            `).join('')}

          </select>

        </div>


        <div class="field">

          <label>
            Người đề nghị
            <span class="req">*</span>
          </label>

          <select class="inp" id="prRequester">

            ${DB.employees.slice(0, 25).map(e => `
              <option
                value="${e.id}"
                ${e.id === (draft.requester || cfg.requesterId) ? 'selected' : ''}
              >
                ${esc(e.name)} — ${esc(e.dept)}
              </option>
            `).join('')}

          </select>

        </div>

      </div>


      <div class="form-grid">

        <div class="field">

          <label>
            Ngày cần hàng
            <span class="req">*</span>
          </label>

          <input
            class="inp"
            type="date"
            id="prExpectedDate"
            value="${draft.expectedDate || addDays(DB.today, cfg.expectedDays)}"
          />

        </div>

      </div>


      <div class="field">

        <label>
          Mục đích / Lý do đề nghị mua
          <span class="req">*</span>
        </label>

        <input
          class="inp"
          id="prReason"
          value="${esc(draft.reason || 'Bổ sung vật tư phục vụ sản xuất / dự phòng tồn kho')}"
          placeholder="Nhập lý do mua sắm…"
        />

      </div>


      <!-- ===================================================
           NGÂN SÁCH
      ==================================================== -->

      <div
        style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          background:var(--surface-2);
          border:1px solid var(--border);
          border-radius:var(--r);
          padding:10px 14px;
          margin-bottom:14px;
          font-size:12.4px
        "
      >

        <span>

          Ngân sách còn lại:

          <b
            class="num"
            style="color:var(--green)"
          >
            ${fmtVND(deptBudget.remaining)}
          </b>

          / Total
          ${fmtShort(deptBudget.totalBudget)}

        </span>

        <span class="chip t-blue">

          <i class="fa-solid fa-piggy-bank"></i>

          Trong hạn mức

        </span>

      </div>


      <!-- ===================================================
           DANH SÁCH NGUYÊN LIỆU
      ==================================================== -->

      <div class="form-sec-title">

        <i class="fa-solid fa-list-check"></i>

        DANH SÁCH NGUYÊN LIỆU ĐỀ NGHỊ MUA

      </div>


      <!-- SEARCH -->

      <div
        style="
          position:relative;
          margin-bottom:12px
        "
      >

        <i
          class="fa-solid fa-magnifying-glass"
          style="
            position:absolute;
            left:12px;
            top:50%;
            transform:translateY(-50%);
            color:var(--text-3)
          "
        ></i>


        <input
          class="inp"
          id="prMaterialSearch"
          type="text"
          placeholder="Tìm kiếm & chọn nguyên liệu cần đề nghị mua..."
          autocomplete="off"
          style="padding-left:36px"
        />


        <!-- DANH SÁCH GỢI Ý -->

        <div
          id="prMaterialSuggestions"
          style="
            position:absolute;
            left:0;
            right:0;
            top:calc(100% + 4px);
            z-index:100;
            display:none;
            background:var(--surface);
            border:1px solid var(--border);
            border-radius:var(--r);
            box-shadow:var(--shadow);
            max-height:240px;
            overflow:auto;
          "
        ></div>

      </div>


      <!-- ===================================================
           DANH SÁCH ĐÃ CHỌN
      ==================================================== -->

      <div id="prSelectedMaterials">

      ${

        State.prFormMaterials.length
          ? State.prFormMaterials
              .map(m => renderPRMaterialItem(m))
              .join('')
          : `
            <div
              id="prEmptyState"
              style="
                padding:32px 20px;
                text-align:center;
                border:1px dashed var(--border);
                border-radius:var(--r);
                color:var(--text-3);
              "
            >
              <i
                class="fa-solid fa-box-open"
                style="
                  font-size:30px;
                  margin-bottom:10px;
                  display:block;
                "
              ></i>

              <div class="strong">
                Chưa có nguyên liệu nào được chọn.
              </div>

              <div
                style="
                  margin-top:4px;
                  font-size:12px
                "
              >
                Vui lòng tìm kiếm để thêm nguyên liệu.
              </div>
            </div>
          `
      }

      </div>

    `,


    // =======================================================
    // FOOTER
    // =======================================================

    foot: `

      <button
        class="btn"
        data-act="modal-close"
      >
        Hủy
      </button>

      <button
        class="btn btn-primary"
        data-act="pr-save"
      >
        <i class="fa-solid fa-paper-plane"></i>
        ${State.prEditingExistingPrId ? 'Lưu thay đổi' : 'Gửi đề nghị mua'}
      </button>

    `
  });


  // =========================================================
  // SEARCH NGUYÊN LIỆU
  // =========================================================

  const searchInput =
    document.getElementById('prMaterialSearch');

  const suggestions =
    document.getElementById('prMaterialSuggestions');

  const selectedContainer =
    document.getElementById('prSelectedMaterials');


  if (!searchInput || !suggestions || !selectedContainer) {
    return;
  }


  // =========================================================
  // RENDER DANH SÁCH NGUYÊN LIỆU ĐÃ CHỌN
  // =========================================================

  const renderSelectedMaterials = () => {

    const materials = State.prFormMaterials || [];

    if (!materials.length) {

      selectedContainer.innerHTML = `
        <div
          id="prEmptyState"
          style="
            padding:32px 20px;
            text-align:center;
            border:1px dashed var(--border);
            border-radius:var(--r);
            color:var(--text-3);
          "
        >
          <i
            class="fa-solid fa-box-open"
            style="
              font-size:30px;
              margin-bottom:10px;
              display:block;
            "
          ></i>

          <div class="strong">
            Chưa có nguyên liệu nào được chọn.
          </div>

          <div
            style="
              margin-top:4px;
              font-size:12px
            "
          >
            Vui lòng tìm kiếm để thêm nguyên liệu.
          </div>
        </div>
      `;

      return;
    }

    selectedContainer.innerHTML =
      materials
        .map(m => renderPRMaterialItem(m))
        .join('');
  };


  // =========================================================
  // SEARCH
  // =========================================================

  searchInput.addEventListener('input', () => {

    const keyword =
      searchInput.value.trim().toLowerCase();


    const selectedIds =
      new Set(
        (State.prFormMaterials || []).map(m => m.id)
      );


    const results =
      DB.materials
        .filter(m => {

          if (selectedIds.has(m.id)) {
            return false;
          }

          const text =
            `${m.id} ${m.name} ${m.group || ''}`
              .toLowerCase();

          return text.includes(keyword);
        })
        .slice(0, 10);


    if (!results.length) {

      suggestions.innerHTML = `
        <div
          style="
            padding:14px;
            color:var(--text-3);
            font-size:12px
          "
        >
          Không tìm thấy nguyên liệu phù hợp.
        </div>
      `;

      suggestions.style.display = 'block';

      return;
    }


    suggestions.innerHTML =
      results.map(m => `

        <div
          class="pr-material-suggestion"
          data-id="${m.id}"
          style="
            padding:10px 12px;
            cursor:pointer;
            border-bottom:1px solid var(--border);
          "
        >

          <div class="strong">
            ${esc(m.name)}
          </div>

          <div
            class="muted"
            style="
              font-size:11.5px;
              margin-top:3px
            "
          >
            ${esc(m.id)}
            ·
            ${esc(m.group || '')}
            ·
            Tồn:
            ${fmtDec(m.stock, 2)}
            ${esc(m.unit)}
          </div>

        </div>

      `).join('');


    suggestions.style.display = 'block';


    // =======================================================
    // CLICK CHỌN NGUYÊN LIỆU
    // =======================================================

    suggestions
      .querySelectorAll('.pr-material-suggestion')
      .forEach(item => {

        item.addEventListener('click', () => {

          const id = item.dataset.id;
          const m = Q.material(id);

          if (!m) return;

          // Không cho trùng
          const materials = State.prFormMaterials || [];

          if (
            materials.some(
              x => String(x.id) === String(m.id)
            )
          ) {
            return;
          }

          // Thêm vào STATE duy nhất
          // State.prFormMaterials.push(m);
          State.prFormMaterials.push({
            ...m,
            supplierId: null
          });

          // Xóa ô search
          searchInput.value = '';
          suggestions.innerHTML = '';
          suggestions.style.display = 'none';

          // Render lại danh sách
          renderSelectedMaterials();
        });

      });

  });

  searchInput.addEventListener('focus', () => {
    // Chỉ bung danh sách khi người dùng chủ động click/focus vào ô tìm kiếm.
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  });


  // =========================================================
  // CLICK RA NGOÀI → ĐÓNG GỢI Ý
  // =========================================================

  document.addEventListener(
    'click',
    function closePRSuggestions(e) {

      if (
        !e.target.closest('#prMaterialSearch') &&
        !e.target.closest('#prMaterialSuggestions')
      ) {

        suggestions.style.display = 'none';

      }

    }
  );

}

function renderPRMaterialItem(m) {

  const supplierIds = m.supplierIds || (m.supplierId ? [m.supplierId] : []);
  const suppliers = supplierIds
    .map(id => (DB.suppliers || []).find(s => String(s.id) === String(id)))
    .filter(Boolean);

  return `
    <div
      class="pr-material-item"
      data-material-id="${m.id}"
      style="
        border:1px solid var(--border);
        border-radius:var(--r);
        margin-bottom:12px;
        background:var(--surface);
        overflow:hidden;
      "
    >

      <!-- Header nguyên liệu -->
      <div
        style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding:12px 14px;
          background:var(--surface-2);
          border-bottom:1px solid var(--border);
        "
      >
        <div>
          <div class="strong">
            ${esc(m.name)}
          </div>

          <div
            class="muted"
            style="font-size:11.5px;margin-top:3px"
          >
            ${esc(m.id)} · ${esc(m.group || '')}
          </div>
        </div>

        <!-- GIỮ NGUYÊN NÚT XÓA -->
        <button
          type="button"
          class="btn btn-danger"
          data-act="pr-remove-material"
          data-id="${m.id}"
        >
          <i class="fa-solid fa-trash"></i>
          Xóa
        </button>
      </div>


      <!-- Thông tin yêu cầu -->
      <div style="padding:14px">

        <div class="form-grid">

          <div class="field">
            <label>
              Số lượng yêu cầu
              <span class="req">*</span>
            </label>

            <input
              class="inp right num pr-qty"
              data-id="${m.id}"
              type="number"
              min="1"
              value="${esc(State.prFormDraft?.quantities?.[m.id] || Math.max(m.minStock * 2 - m.stock, m.minStock))}"
            />
          </div>


          <div class="field">
            <label>
              Giá dự kiến
              <span
                class="muted"
                style="font-weight:normal"
              >
                (giá tham chiếu)
              </span>
            </label>

            <input
              class="inp right num pr-expected-price"
              data-id="${m.id}"
              type="number"
              min="0"
              value="${esc(State.prFormDraft?.prices?.[m.id] || Number(m.price || 0))}"
              placeholder="Nhập giá dự kiến"
            />
          </div>

        </div>


        <!-- NCC -->
        <div
          class="form-sec-title"
          style="margin-top:14px"
        >
          <i class="fa-solid fa-truck-field"></i>
          Nhà cung cấp đề xuất
        </div>


        <div
          class="pr-suppliers"
          data-material-id="${m.id}"
        >

          ${
            suppliers.length
              ? `
                <div
                  style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:10px;
                    padding:10px 12px;
                    border:1px solid var(--border);
                    border-radius:var(--r);
                    background:var(--surface-2);
                  "
                >

                  <div style="min-width:0">

                    <div
                      class="strong"
                      style="font-size:12.8px"
                    >
                      <i
                        class="fa-solid fa-building"
                        style="color:var(--primary);margin-right:5px"
                      ></i>
                      ${suppliers.map(supplier => `<span style="display:block;margin-bottom:4px"><i class="fa-solid fa-building" style="color:var(--primary);margin-right:5px"></i>${esc(supplier.name)}</span>`).join('')}
                    </div>

                    <div
                      class="muted"
                      style="
                        font-size:11.5px;
                        margin-top:4px;
                      "
                    >
                      ${suppliers.map(supplier => `${esc(supplier.id)} · ${esc(supplier.contact || '')} · ${esc(supplier.phone || '')}`).join('<br>')}
                    </div>

                  </div>

                  <span class="badge green">
                    Đã chọn
                  </span>

                </div>
              `
              : `
                <div
                  class="muted"
                  style="font-size:12px"
                >
                  Chưa có nhà cung cấp nào.
                </div>
              `
          }

        </div>


        <!-- NÚT THÊM / ĐỔI NCC -->
        <button
          type="button"
          class="btn"
          style="margin-top:10px"
          data-act="pr-add-supplier"
          data-id="${m.id}"
        >
          <i class="fa-solid fa-${suppliers.length ? 'arrows-rotate' : 'plus'}"></i>
          ${suppliers.length ? 'Chọn lại nhà cung cấp' : 'Thêm nhà cung cấp'}
        </button>

      </div>

    </div>
  `;
}

function openPRSupplierModal(materialId) {
  const material = Q.material(materialId) || Q.product(materialId);
  if (!material) return;

  const currentSupplierIds = State.prFormMaterials
    ?.find(m => String(m.id) === String(materialId))
    ?.supplierIds || [];
  const category = material.group || material.category || 'Chưa phân loại';
  const matchedSuppliers = (DB.suppliers || []).filter((supplier) => supplierMatchesCategory(supplier, category));
  const supplierCards = matchedSuppliers.length ? matchedSuppliers.map((s) => {
    const selected = currentSupplierIds.includes(s.id);
    const rating = Number(s.rating || Q.supplierEvaluation?.(s.id)?.totalScore || 0);
    return `<label class="pr-supplier-card" style="display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:14px;border:1px solid ${selected ? 'var(--primary)' : 'var(--border)'};border-radius:14px;cursor:pointer;background:${selected ? 'var(--primary-soft)' : 'var(--surface)'};transition:.15s ease">
      <input type="checkbox" name="prSupplier" value="${esc(s.id)}" ${selected ? 'checked' : ''} style="width:17px;height:17px">
      <div style="min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="strong" style="font-size:13.5px">${esc(s.name)}</span>
          <span class="chip" style="font-size:10.5px"><i class="fa-solid fa-tags"></i>${esc(s.group || category)}</span>
        </div>
        <div class="muted" style="font-size:11.5px;margin-top:5px">${esc(s.id)} · ${esc(s.contact || 'Chưa có người liên hệ')} · ${esc(s.phone || 'Chưa có SĐT')}</div>
        <div class="muted" style="font-size:11px;margin-top:4px"><i class="fa-regular fa-envelope" style="margin-right:4px"></i>${esc(s.email || 'Chưa có email')} ${s.paymentTerm ? ` · ${esc(s.paymentTerm)}` : ''}</div>
      </div>
      <div style="text-align:right;white-space:nowrap">
        <div style="font-weight:700;color:${rating >= 4 ? 'var(--green)' : rating ? 'var(--orange)' : 'var(--text-3)'}">★ ${rating ? rating.toFixed(1) : '—'}</div>
        <div class="muted" style="font-size:10.5px;margin-top:5px">${selected ? 'Đang chọn' : 'Có thể chọn'}</div>
      </div>
    </label>`;
  }).join('') : `<div class="empty" style="padding:26px 16px"><div class="empty-ico"><i class="fa-solid fa-building-circle-exclamation"></i></div><h4>Chưa có nhà cung cấp phù hợp</h4><p>Nguyên liệu này thuộc danh mục <b>${esc(category)}</b>, nhưng chưa có nhà cung cấp nào thuộc cùng nhóm cung ứng.</p><button class="btn btn-primary" data-act="supplier-add"><i class="fa-solid fa-plus"></i>Thêm nhà cung cấp</button></div>`;

  Modal.open({
    title: 'Chọn nhà cung cấp cho đề nghị mua',
    sub: `${material.id} · ${esc(material.name)}`,
    size: 'lg',
    body: `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;margin-bottom:14px;padding:12px 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface-2)">
      <div><div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.04em">Danh mục nguyên liệu</div><div class="strong" style="margin-top:3px">${esc(category)}</div></div>
      <span class="chip"><i class="fa-solid fa-filter"></i>${matchedSuppliers.length} NCC phù hợp</span>
    </div>
    <div class="alert info" style="margin-bottom:12px"><i class="fa-solid fa-circle-info"></i><span>Hệ thống chỉ hiển thị nhà cung cấp có <b>Nhóm cung ứng = ${esc(category)}</b>. Bạn có thể chọn một hoặc nhiều NCC để lấy báo giá.</span></div>
    <div id="prSupplierList" style="display:flex;flex-direction:column;gap:9px;max-height:460px;overflow:auto;padding-right:3px">${supplierCards}</div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button>${matchedSuppliers.length ? `<button class="btn btn-primary" data-act="pr-select-supplier" data-material-id="${esc(materialId)}"><i class="fa-solid fa-check"></i>Xác nhận nhà cung cấp</button>` : ''}`
  });
}
/** Modal Từ chối PR kèm ghi lý do */
function openPRRejectModal(prId) {
  Modal.open({
    title: 'Từ chối Đề nghị mua hàng',
    sub: `Mã PR: ${prId} — Nhập lý do từ chối để gửi thông báo cho người đề xuất`,
    body: `<div class="field"><label>Lý do từ chối <span class="req">*</span></label>
      <textarea class="inp" id="prRejectReason" rows="3" placeholder="Nhập lý do từ chối cụ thể (ví dụ: tồn kho hiện tại vẫn đủ dùng, đề xuất vượt ngân sách…)"></textarea></div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button>
           <button class="btn btn-danger" data-act="pr-reject-save" data-id="${prId}"><i class="fa-solid fa-xmark"></i>Xác nhận từ chối</button>`,
  });
}

/** Modal Thêm Báo giá Nhà cung cấp cho 1 PR */
// function openQuotationModal(prId) {
//   const pr = Q.purchase(prId);

//   if (!pr) {
//     Toast.err('Không tìm thấy Đề nghị mua hàng', `PR ${prId} không tồn tại.`);
//     return;
//   }
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
//           <thead><tr><th>Nguyên liệu</th><th class="right">SL yêu cầu</th><th class="right">Đơn giá báo (VND)</th></tr></thead>
//           <tbody>
//             ${pr.items.map((it) => `<tr>
//               <td><div class="strong">${esc(it.name)}</div><div class="cell-sub">${it.materialId}</div></td>
//               <td class="right num">${fmtN(it.qty)} ${esc(it.unit)}</td>
//               <td class="right"><input class="inp right num sq-price" data-id="${it.materialId}" data-qty="${it.qty}" type="number" value="" style="width:130px" /></td>
//             </tr>`).join('')}
//           </tbody>
//         </table>
//       </div>`,
//     foot: `<button class="btn" data-act="modal-close">Hủy</button>
//            <button class="btn btn-primary" data-act="quote-save-supplier" data-prid="${pr ? pr.id : ''}"><i class="fa-solid fa-floppy-disk"></i>Lưu báo giá NCC</button>`,
//   });
// }

function openQuotationModal(prId) {
  const pr = Q.purchase(prId);

  if (!pr) {
    Toast.err(
      'Không tìm thấy Đề nghị mua hàng',
      `PR ${prId} không tồn tại.`
    );
    return;
  }

  // Chỉ cho phép báo giá từ PR đã được duyệt
  if (pr.status !== 'mh_da_duyet') {
    Toast.err(
      'PR chưa được duyệt',
      'Chỉ có thể tạo báo giá NCC từ Đề nghị mua hàng đã được duyệt.'
    );
    return;
  }

  const proposedSupplierIds = [...new Set((pr.items || []).flatMap((item) => item.supplierIds || (item.supplierId ? [item.supplierId] : [])))];
  const quotationSuppliers = proposedSupplierIds.length
    ? DB.suppliers.filter((supplier) => proposedSupplierIds.includes(supplier.id))
    : DB.suppliers;

  Modal.open({
    title: 'Thêm Báo giá Nhà cung cấp',
    sub: `Báo giá cho Đề nghị mua ${pr.id}`,
    size: 'md',

    body: `
      <div class="form-grid">

        <div class="field">
          <label>
            Nhà cung cấp <span class="req">*</span>
          </label>

          <select class="inp" id="sqSupplier">
            ${quotationSuppliers.map(s => `
              <option value="${s.id}">
                ${esc(s.name)}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="field">
          <label>Thời gian giao hàng (Lead time)</label>

          <input
            class="inp num"
            type="number"
            id="sqLeadTime"
            value="7"
            min="1"
            placeholder="Số ngày giao hàng"
          />
        </div>

      </div>

      <div class="form-grid">

        <div class="field">
          <label>Ngày báo giá</label>

          <input
            class="inp"
            type="date"
            id="sqDate"
            value="${DB.today}"
          />
        </div>

        <div class="field">
          <label>Thời hạn hiệu lực</label>

          <input
            class="inp"
            type="date"
            id="sqValid"
            value="${addDays(DB.today, 15)}"
          />
        </div>

      </div>

      <div class="field">
        <label>Điều khoản thanh toán</label>

        <input
          class="inp"
          id="sqTerm"
          value="30% tạm ứng, 70% sau khi giao hàng"
        />
      </div>

      <div class="form-sec-title">
        <i class="fa-solid fa-tags"></i>
        Đơn giá báo cho các vật tư
      </div>

      <div class="tbl-wrap"
           style="border:1px solid var(--border);border-radius:var(--r)">

        <table class="line-tbl">

          <thead>
            <tr>
              <th>Vật tư</th>
              <th class="right">SL yêu cầu</th>
              <th class="right">Giá dự kiến</th>
              <th class="right">Giá NCC cung cấp (VND)</th>
            </tr>
          </thead>

          <tbody>

            ${pr.items.map(it => `
              <tr>

                <td>
                  <div class="strong">
                    ${esc(it.name)}
                  </div>

                  <div class="cell-sub">
                    ${esc(it.materialId)}
                  </div>
                </td>

                <td class="right num">
                  ${fmtN(it.qty)} ${esc(it.unit)}
                </td>

                <td class="right num">
                  ${fmtVND(it.expectedPrice || it.price || 0)}
                </td>

                <td class="right">

                  <input
                    class="inp right num sq-price"
                    data-id="${it.materialId}"
                    data-qty="${it.qty}"
                    type="number"
                    min="0"
                    value="${Number(it.supplierPrice || 0) || ''}"
                    placeholder="Nhập giá"
                    style="width:130px"
                  />

                </td>

              </tr>
            `).join('')}

          </tbody>

        </table>
      </div>
    `,

    foot: `
      <button
        class="btn"
        data-act="modal-close">
        Hủy
      </button>

      <button
        class="btn btn-primary"
        data-act="quote-save-supplier"
        data-prid="${pr.id}">
        <i class="fa-solid fa-floppy-disk"></i>
        Lưu báo giá NCC
      </button>
    `,
  });
}

function openPOEditRequest(id) {
  const po = Q.purchaseOrder(id);
  if (!po) return;
  if (!['DRAFT', 'APPROVED'].includes(po.status)) {
    Toast.err('Không thể sửa PO', 'Chỉ PO chưa gửi Nhà cung cấp mới được chuyển về Đề nghị mua hàng.');
    return;
  }
  const sourcePr = Q.purchase(po.prId);
  if (!sourcePr) {
    Toast.err('Không tìm thấy đề nghị gốc', `PO ${po.id} không còn liên kết với đề nghị mua hàng.`);
    return;
  }

  // Giữ PR gốc làm lịch sử. Khi lưu sẽ tạo một PR mới chỉ cho các dòng của PO đang sửa.
  State.prEditingPoId = po.id;
  State.prEditingPrId = sourcePr.id;
  State.prEditingSupplierId = po.supplierId || '';
  State.prEditingPoItemIds = (po.items || []).map((item) => String(item.materialId));

  State.prFormMaterials = (po.items || []).map((item) => {
    const material = Q.material(item.materialId) || {};
    return {
      ...material,
      id: item.materialId,
      name: item.name,
      unit: item.unit,
      supplierId: po.supplierId || '',
      supplierIds: [po.supplierId].filter(Boolean),
    };
  });
  State.prFormDraft = {
    dept: sourcePr.dept || 'Sản xuất',
    requester: sourcePr.requesterId || DB.currentUser.id,
    expectedDate: sourcePr.expectedDate || po.expectedDate,
    reason: sourcePr.reason || po.note || `Chỉnh sửa đơn ${po.id}`,
    quantities: Object.fromEntries((po.items || []).map((item) => [item.materialId, item.qty])),
    prices: Object.fromEntries((po.items || []).map((item) => [item.materialId, item.price])),
  };
  Modal.close();
  openPRForm();
  Toast.info('Đang tạo đề nghị thay thế', `${po.id} · Khi lưu sẽ tạo YCM mới; ${sourcePr.id} vẫn giữ nguyên.`);
}

/** Modal Xem Chi tiết Đơn đặt hàng PO */
function openPOModal(id) {
  const po = Q.purchaseOrder(id);
  if (!po) return;
  const s = Q.supplier(po.supplierId);
  const receipts = Q.receiptsOfPo(id);
  const payments = Q.paymentsOfPo(id);
  const returns = (DB.goodsIssues || []).filter(x => x.type === 'RETURN_OUT' && (x.refDoc === id || x.poId === id));

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

      <div class="form-sec-title" style="margin-top:16px"><i class="fa-solid fa-warehouse"></i>Lịch sử nhập kho</div>
      ${tableShell(
        [{ t: 'Phiếu nhập' }, { t: 'Ngày nhận' }, { t: 'Nguyên liệu' }, { t: 'Số lượng nhập', cls: 'right' }, { t: 'Kho / Kệ' }, { t: 'Người nhận' }],
        receipts.flatMap((r) => (r.items || []).map((it) => `<tr><td><span class="code">${r.id}</span></td><td class="num">${fmtDate(r.date)}</td><td>${cell2(esc(it.name || Q.material(it.materialId)?.name || it.materialId), esc(it.materialId || ''))}</td><td class="right num strong">${fmtN(it.qty)} ${esc(it.unit || '')}</td><td>${cell2(esc(r.warehouse || Q.warehouseName(r.warehouseId)), esc(r.location || Q.locationName(it.locationId || r.locationId) || '—'))}</td><td>${esc(Q.employeeName(r.receivedBy))}</td></tr>`)),
        { emptyTitle: 'Chưa có lịch sử nhập kho' })}

      <div class="form-sec-title" style="margin-top:16px"><i class="fa-solid fa-rotate-left"></i>Lịch sử trả hàng</div>
      ${tableShell(
        [{ t: 'Phiếu xuất trả' }, { t: 'Ngày trả' }, { t: 'Nguyên liệu' }, { t: 'Số lượng trả', cls: 'right' }, { t: 'Lô hệ thống' }, { t: 'Lý do' }],
        returns.flatMap((r) => (r.items || []).map((it) => `<tr><td><span class="code">${r.id}</span></td><td class="num">${fmtDate(r.date)}</td><td>${esc(Q.material(it.productId)?.name || it.productId)}</td><td class="right num strong">${fmtN(it.qty)} ${esc(it.unit || '')}</td><td><span class="code">${esc(Q.lot(it.lotId)?.lotNumber || it.lotId || '—')}</span></td><td class="muted">${esc(r.note || '')}</td></tr>`)),
        { emptyTitle: 'Chưa có lịch sử trả hàng' })}`,
        foot: `          ${['DRAFT', 'APPROVED'].includes(po.status) ? `<button class="btn btn-warning" data-act="po-edit" data-id="${po.id}"><i class="fa-solid fa-pen-to-square"></i>Sửa đơn</button>` : ''}
          ${returns.length ? `<button class="btn btn-success left" data-act="po-create-return-pr" data-id="${po.id}"><i class="fa-solid fa-cart-plus"></i>Gửi đề nghị mua thêm</button>` : ''}
          ${po.status === 'RECEIVED' && !(DB.supplierEvaluationHistory || []).some(e => e.poId === po.id) ? `<button class="btn btn-primary" data-act="po-evaluate-supplier" data-id="${po.id}"><i class="fa-solid fa-star"></i>Đánh giá NCC</button>` : ''}
           <button class="btn" data-act="modal-close">Đóng</button>`,
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
