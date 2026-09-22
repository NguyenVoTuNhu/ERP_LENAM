/* ============================================================================
 * MODULE: QUY TRÌNH PHÊ DUYỆT (APPROVALS)
 * ----------------------------------------------------------------------------
 * Cung cấp:
 *  - Quy trình phê duyệt nhiều cấp cho 9 loại chứng từ:
 *    Đề nghị mua hàng, Đơn đặt hàng, Thanh toán, Chi tiền, Giảm giá,
 *    Hủy đơn hàng, Xuất kho đặc biệt, Sản xuất ngoài định mức, Đổi trả hàng
 *  - Phân quyền theo cấp (mỗi cấp gắn 1 vai trò trong DB.roles, có thể đặt
 *    ngưỡng giá trị để tự thêm cấp duyệt cao hơn)
 *  - Nhật ký phê duyệt (audit log) cho mọi thao tác tạo/duyệt/từ chối/hủy
 *  - Chữ ký điện tử (chữ ký dạng văn bản có mã xác thực + dấu thời gian)
 *  - Cảnh báo quá hạn duyệt (theo SLA giờ cấu hình cho từng quy trình)
 * ==========================================================================*/

/* ---------------------------------------------------------------------------
 * 1. DANH MỤC LOẠI CHỨNG TỪ ÁP DỤNG PHÊ DUYỆT
 * -------------------------------------------------------------------------*/
const APPROVAL_DOC_TYPES = {
  PR:                   { label: 'Đề nghị mua hàng',        icon: 'fa-cart-shopping',       tone: 'orange' },
  PO:                   { label: 'Đơn đặt hàng',            icon: 'fa-file-invoice',         tone: 'blue'   },
  PAYMENT:              { label: 'Thanh toán',              icon: 'fa-money-bill-transfer',  tone: 'green'  },
  CASH_OUT:             { label: 'Chi tiền',                icon: 'fa-sack-dollar',          tone: 'red'    },
  DISCOUNT:             { label: 'Giảm giá',                icon: 'fa-tags',                 tone: 'indigo' },
  ORDER_CANCEL:         { label: 'Hủy đơn hàng',             icon: 'fa-ban',                  tone: 'red'    },
  SPECIAL_ISSUE:        { label: 'Xuất kho đặc biệt',        icon: 'fa-dolly',                tone: 'teal'   },
  OVER_NORM_PRODUCTION: { label: 'Sản xuất ngoài định mức',  icon: 'fa-industry',             tone: 'orange' },
  RETURN_EXCHANGE:      { label: 'Đổi trả hàng',             icon: 'fa-rotate-left',          tone: 'slate'  },
};
const APPROVAL_DOC_TYPE_LIST = Object.keys(APPROVAL_DOC_TYPES);

/* ---------------------------------------------------------------------------
 * 2. DỮ LIỆU NỀN — quy trình mặc định + kho lưu trữ runtime
 *    (chỉ khởi tạo nếu chưa có, để không ghi đè khi module load lại)
 * -------------------------------------------------------------------------*/
DB.approvalWorkflows = DB.approvalWorkflows || [
  { id: 'WF-PR',     docType: 'PR',     name: 'Đề nghị mua hàng',       slaHours: 24,
    levels: [
      { level: 1, role: 'R07', label: 'Trưởng phòng Mua hàng duyệt', minAmount: 0 },
      { level: 2, role: 'R02', label: 'Ban giám đốc duyệt (giá trị lớn)', minAmount: 50000000 },
    ] },
  { id: 'WF-PO',     docType: 'PO',     name: 'Đơn đặt hàng',           slaHours: 24,
    levels: [
      { level: 1, role: 'R07', label: 'Trưởng phòng Mua hàng duyệt', minAmount: 0 },
      { level: 2, role: 'R02', label: 'Ban giám đốc duyệt (giá trị lớn)', minAmount: 100000000 },
    ] },
  { id: 'WF-PAYMENT', docType: 'PAYMENT', name: 'Thanh toán',          slaHours: 12,
    levels: [
      { level: 1, role: 'R08', label: 'Kế toán trưởng duyệt', minAmount: 0 },
      { level: 2, role: 'R02', label: 'Ban giám đốc duyệt (giá trị lớn)', minAmount: 20000000 },
    ] },
  { id: 'WF-CASH',   docType: 'CASH_OUT', name: 'Chi tiền',            slaHours: 8,
    levels: [
      { level: 1, role: 'R08', label: 'Kế toán trưởng duyệt', minAmount: 0 },
      { level: 2, role: 'R01', label: 'Giám đốc điều hành duyệt (giá trị lớn)', minAmount: 10000000 },
    ] },
  { id: 'WF-DISCOUNT', docType: 'DISCOUNT', name: 'Giảm giá',          slaHours: 24,
    levels: [
      { level: 1, role: 'R03', label: 'Trưởng phòng Kinh doanh duyệt', minAmount: 0 },
      { level: 2, role: 'R02', label: 'Ban giám đốc duyệt (mức giảm lớn)', minAmount: 10 },
    ] },
  { id: 'WF-CANCEL', docType: 'ORDER_CANCEL', name: 'Hủy đơn hàng',    slaHours: 24,
    levels: [
      { level: 1, role: 'R03', label: 'Trưởng phòng Kinh doanh duyệt', minAmount: 0 },
    ] },
  { id: 'WF-ISSUE',  docType: 'SPECIAL_ISSUE', name: 'Xuất kho đặc biệt', slaHours: 12,
    levels: [
      { level: 1, role: 'R06', label: 'Thủ kho xác nhận', minAmount: 0 },
      { level: 2, role: 'R05', label: 'Quản đốc Sản xuất duyệt', minAmount: 0 },
    ] },
  { id: 'WF-OVERNORM', docType: 'OVER_NORM_PRODUCTION', name: 'Sản xuất ngoài định mức', slaHours: 24,
    levels: [
      { level: 1, role: 'R05', label: 'Quản đốc Sản xuất duyệt', minAmount: 0 },
      { level: 2, role: 'R02', label: 'Ban giám đốc duyệt (chênh lệch lớn)', minAmount: 5000000 },
    ] },
  { id: 'WF-RETURN', docType: 'RETURN_EXCHANGE', name: 'Đổi trả hàng', slaHours: 24,
    levels: [
      { level: 1, role: 'R03', label: 'Trưởng phòng Kinh doanh duyệt', minAmount: 0 },
      { level: 2, role: 'R08', label: 'Kế toán đối chiếu công nợ', minAmount: 0 },
    ] },
];
DB.approvalRequests = DB.approvalRequests || [];
DB.approvalLogs = DB.approvalLogs || [];
DB.eSignatures = DB.eSignatures || [];

/* ---------------------------------------------------------------------------
 * 3. TIỆN ÍCH DÙNG CHUNG
 * -------------------------------------------------------------------------*/
function approvalRoleName(roleId) { return (DB.roles.find((r) => r.id === roleId) || {}).name || roleId; }
function approvalWorkflowOf(docType) { return DB.approvalWorkflows.find((w) => w.docType === docType); }
function approvalActiveLevels(workflow, amount) {
  return (workflow.levels || []).filter((l) => Number(amount || 0) >= Number(l.minAmount || 0)).sort((a, b) => a.level - b.level);
}
function approvalDjb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().slice(0, 6);
}
function approvalSignText(name) {
  const stamp = new Date().toLocaleString('vi-VN');
  const code = approvalDjb2(name + stamp + Math.random());
  return `${name} — ký điện tử lúc ${stamp} — mã xác thực #${code}`;
}
function approvalMySignature() {
  const uid = DB.currentUser?.userId || DB.currentUser?.id || '';
  return (DB.eSignatures || []).find((s) => s.userId === uid);
}
function approvalLog(requestId, docType, docId, level, action, note) {
  DB.approvalLogs.unshift({
    id: nextCode('NKPD-', DB.approvalLogs),
    requestId, docType, docId, level, action,
    actorId: DB.currentUser?.userId || DB.currentUser?.id || '',
    actorName: DB.currentUser?.name || '',
    time: new Date().toISOString(),
    note: note || '',
  });
}
function approvalIsOverdue(req) {
  return req.status === 'PENDING' && new Date() > new Date(req.dueAt);
}
function approvalOverdueHours(req) {
  return Math.max(0, Math.round((new Date() - new Date(req.dueAt)) / 3600000));
}
function approvalStatusBadge(s) {
  const map = { PENDING: ['Đang chờ duyệt', 'orange'], APPROVED: ['Đã duyệt', 'green'], REJECTED: ['Từ chối', 'red'], CANCELLED: ['Đã hủy', 'slate'] };
  const [label, tone] = map[s] || [s, 'slate'];
  return `<span class="badge ${tone}">${esc(label)}</span>`;
}
function approvalDocTypeChip(docType) {
  const t = APPROVAL_DOC_TYPES[docType] || { label: docType, icon: 'fa-file', tone: 'slate' };
  return `<span class="chip"><i class="fa-solid ${t.icon}" style="color:var(--${t.tone})"></i>${esc(t.label)}</span>`;
}

/* ---------------------------------------------------------------------------
 * 4. ENGINE PHÊ DUYỆT
 * -------------------------------------------------------------------------*/
const ApprovalEngine = {
  create({ docType, docId, title, amount, note }) {
    const workflow = approvalWorkflowOf(docType);
    if (!workflow) {
      Toast.err('Chưa cấu hình quy trình', `Chưa có quy trình phê duyệt cho loại "${(APPROVAL_DOC_TYPES[docType] || {}).label || docType}".`);
      return null;
    }
    const levels = approvalActiveLevels(workflow, amount).map((l) => ({
      level: l.level, role: l.role, label: l.label, status: 'PENDING',
      approverId: '', approverName: '', time: '', note: '', signature: '',
    }));
    if (!levels.length) {
      Toast.err('Không xác định được cấp duyệt', 'Vui lòng kiểm tra lại cấu hình mức ngưỡng của quy trình.');
      return null;
    }
    const now = new Date();
    const due = new Date(now.getTime() + (workflow.slaHours || 24) * 3600 * 1000);
    const req = {
      id: nextCode('DUYET-2026-', DB.approvalRequests),
      workflowId: workflow.id, docType, docId: docId || '',
      title: title || `${(APPROVAL_DOC_TYPES[docType] || {}).label || docType}${docId ? ' — ' + docId : ''}`,
      amount: Number(amount || 0),
      requestedBy: DB.currentUser?.userId || DB.currentUser?.id || '',
      requestedByName: DB.currentUser?.name || '',
      requestedAt: now.toISOString(),
      status: 'PENDING', currentLevel: levels[0].level,
      levels, dueAt: due.toISOString(), note: note || '',
    };
    DB.approvalRequests.unshift(req);
    approvalLog(req.id, docType, req.docId, levels[0].level, 'CREATE', `Tạo yêu cầu phê duyệt${req.amount ? ' — ' + fmtVND(req.amount) : ''}`);
    return req;
  },

  currentLevelOf(req) { return (req.levels || []).find((l) => l.level === req.currentLevel); },

  canAct(req) {
    const lvl = this.currentLevelOf(req);
    if (!lvl) return false;
    const role = Auth.currentRole();
    if (!role) return false;
    return role.id === lvl.role || role.id === 'R01';
  },

  approve(requestId, { note = '', signature = '' } = {}) {
    const req = DB.approvalRequests.find((r) => r.id === requestId);
    if (!req || req.status !== 'PENDING') { Toast.err('Không thể duyệt', 'Yêu cầu không ở trạng thái chờ duyệt.'); return false; }
    if (!this.canAct(req)) { Toast.err('Không có quyền duyệt', 'Vai trò hiện tại không thuộc cấp duyệt hiện tại của yêu cầu này.'); return false; }
    const lvl = this.currentLevelOf(req);
    lvl.status = 'APPROVED';
    lvl.approverId = DB.currentUser?.userId || DB.currentUser?.id || '';
    lvl.approverName = DB.currentUser?.name || '';
    lvl.time = new Date().toISOString();
    lvl.note = note;
    lvl.signature = signature || approvalSignText(DB.currentUser?.name || '');
    approvalLog(req.id, req.docType, req.docId, lvl.level, 'APPROVE', note);
    const remaining = (req.levels || []).filter((l) => l.level > lvl.level);
    if (remaining.length) {
      req.currentLevel = remaining[0].level;
      Toast.ok('Đã duyệt cấp ' + lvl.level, `Chuyển sang cấp duyệt tiếp theo: ${approvalRoleName(remaining[0].role)}`);
    } else {
      req.status = 'APPROVED';
      req.completedAt = new Date().toISOString();
      approvalLog(req.id, req.docType, req.docId, lvl.level, 'FINALIZE', 'Hoàn tất tất cả các cấp phê duyệt');
      Toast.ok('Đã phê duyệt hoàn tất', req.title);
    }
    return true;
  },

  reject(requestId, { reason = '' } = {}) {
    const req = DB.approvalRequests.find((r) => r.id === requestId);
    if (!req || req.status !== 'PENDING') { Toast.err('Không thể từ chối', 'Yêu cầu không ở trạng thái chờ duyệt.'); return false; }
    if (!this.canAct(req)) { Toast.err('Không có quyền từ chối', 'Vai trò hiện tại không thuộc cấp duyệt hiện tại của yêu cầu này.'); return false; }
    if (!reason.trim()) { Toast.err('Thiếu lý do', 'Vui lòng nhập lý do từ chối.'); return false; }
    const lvl = this.currentLevelOf(req);
    lvl.status = 'REJECTED';
    lvl.approverId = DB.currentUser?.userId || DB.currentUser?.id || '';
    lvl.approverName = DB.currentUser?.name || '';
    lvl.time = new Date().toISOString();
    lvl.note = reason;
    req.status = 'REJECTED';
    req.completedAt = new Date().toISOString();
    approvalLog(req.id, req.docType, req.docId, lvl.level, 'REJECT', reason);
    Toast.warn('Đã từ chối yêu cầu', req.title);
    return true;
  },

  cancel(requestId, reason) {
    const req = DB.approvalRequests.find((r) => r.id === requestId);
    if (!req || req.status !== 'PENDING') return false;
    req.status = 'CANCELLED';
    req.completedAt = new Date().toISOString();
    approvalLog(req.id, req.docType, req.docId, req.currentLevel, 'CANCEL', reason || '');
    return true;
  },
};

/* Gắn đếm "đang chờ duyệt" + cảnh báo quá hạn lên sidebar (mục Approvals đã có sẵn trong NAV) */
(function attachApprovalsNavCount() {
  const item = (typeof NAV !== 'undefined' ? NAV : []).flatMap((g) => g.items).find((i) => i.id === 'approvals');
  if (item) {
    item.count = () => DB.approvalRequests.filter((r) => r.status === 'PENDING').length;
    item.alert = () => DB.approvalRequests.some((r) => approvalIsOverdue(r));
  }
})();

/* ---------------------------------------------------------------------------
 * 5. GIAO DIỆN — Views.approvals
 * -------------------------------------------------------------------------*/
const APPROVALS_TABS = [
  { id: 'approvals', label: 'Tổng quan', tab: 'dashboard' },
  { id: 'approvals', label: 'Việc cần duyệt', tab: 'pending' },
  { id: 'approvals', label: 'Quy trình phê duyệt', tab: 'workflows' },
  { id: 'approvals', label: 'Nhật ký phê duyệt', tab: 'logs' },
  { id: 'approvals', label: 'Cảnh báo quá hạn', tab: 'overdue' },
  { id: 'approvals', label: 'Chữ ký điện tử', tab: 'signature' },
];

function approvalsHeadActions() {
  return `<button class="btn btn-primary btn-sm" data-act="approval-new"><i class="fa-solid fa-plus"></i>Tạo yêu cầu phê duyệt</button>`;
}

function approvalsDashboardView() {
  const all = DB.approvalRequests;
  const pending = all.filter((r) => r.status === 'PENDING');
  const overdue = pending.filter(approvalIsOverdue);
  const thisMonth = (new Date()).toISOString().slice(0, 7);
  const approvedMonth = all.filter((r) => r.status === 'APPROVED' && String(r.completedAt || '').slice(0, 7) === thisMonth).length;
  const rejectedMonth = all.filter((r) => r.status === 'REJECTED' && String(r.completedAt || '').slice(0, 7) === thisMonth).length;

  const byType = APPROVAL_DOC_TYPE_LIST.map((dt) => ({
    dt, count: pending.filter((r) => r.docType === dt).length,
  })).filter((x) => x.count > 0);

  const recentLogs = DB.approvalLogs.slice(0, 8);

  return `
    <div class="grid g-4" style="margin-bottom:16px">
      ${mkpi('Đang chờ duyệt', fmtN(pending.length), 'fa-hourglass-half', 'orange', 'approval-filter-pending')}
      ${mkpi('Quá hạn duyệt', fmtN(overdue.length), 'fa-triangle-exclamation', 'red', 'approval-filter-overdue')}
      ${mkpi('Đã duyệt tháng này', fmtN(approvedMonth), 'fa-circle-check', 'green')}
      ${mkpi('Từ chối tháng này', fmtN(rejectedMonth), 'fa-circle-xmark', 'slate')}
    </div>
    <div class="grid g-21">
      <div class="card">
        <div class="card-head"><div><h3>Việc cần duyệt theo loại chứng từ</h3><p>Bấm để lọc nhanh sang danh sách chờ duyệt</p></div></div>
        <div class="card-body">
          ${byType.length ? byType.map((x) => {
            const t = APPROVAL_DOC_TYPES[x.dt];
            return `<button type="button" class="alert-item" style="width:100%;text-align:left;margin-bottom:9px" data-act="approval-filter-type" data-type="${x.dt}">
              <span class="alert-ico t-${t.tone}"><i class="fa-solid ${t.icon}"></i></span>
              <span style="min-width:0;flex:1"><span class="alert-title">${esc(t.label)}</span><div class="alert-sub">${x.count} yêu cầu đang chờ duyệt</div></span>
              <i class="fa-solid fa-chevron-right"></i>
            </button>`;
          }).join('') : `<div class="empty" style="padding:20px"><div class="empty-ico"><i class="fa-solid fa-check"></i></div><h4>Không có việc cần duyệt</h4><p>Mọi yêu cầu phê duyệt hiện đã được xử lý.</p></div>`}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Hoạt động phê duyệt gần đây</h3></div></div>
        <div class="card-body">
          <div class="tline">
            ${recentLogs.length ? recentLogs.map((l) => `
              <div class="tline-item ${l.action === 'APPROVE' || l.action === 'FINALIZE' ? 'done' : ''} ${l.action === 'CREATE' ? 'doing' : ''}">
                <span class="tline-dot"><i class="fa-solid ${l.action === 'REJECT' ? 'fa-xmark' : l.action === 'CREATE' ? 'fa-plus' : 'fa-check'}"></i></span>
                <div class="tline-title">${esc(l.actorName || '—')} ${esc(approvalActionLabel(l.action))}</div>
                <div class="tline-sub">${approvalDocTypeChip(l.docType)} ${esc(l.docId)} · ${esc(l.note || '')} · ${fmtDateTimeVN(l.time)}</div>
              </div>`).join('') : `<div class="empty" style="padding:16px"><p>Chưa có hoạt động nào.</p></div>`}
          </div>
        </div>
      </div>
    </div>`;
}

function approvalActionLabel(action) {
  return { CREATE: 'đã tạo yêu cầu', APPROVE: 'đã duyệt', REJECT: 'đã từ chối', FINALIZE: 'đã hoàn tất phê duyệt', CANCEL: 'đã hủy yêu cầu' }[action] || action;
}
function fmtDateTimeVN(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('vi-VN');
}

function approvalsPendingView() {
  const f = F('approvals', { q: '', docType: '', status: 'PENDING' });
  let list = DB.approvalRequests.filter((r) => (!f.status || r.status === f.status) && (!f.docType || r.docType === f.docType));
  if (f.q) {
    const q = f.q.toLowerCase();
    list = list.filter((r) => (r.title + ' ' + r.docId + ' ' + r.requestedByName).toLowerCase().includes(q));
  }
  list.sort((a, b) => (approvalIsOverdue(b) - approvalIsOverdue(a)) || b.requestedAt.localeCompare(a.requestedAt));
  const pg = paged(list, 'approvals', 10);

  const rows = pg.items.map((r) => {
    const lvl = ApprovalEngine.currentLevelOf(r);
    const canAct = r.status === 'PENDING' && ApprovalEngine.canAct(r);
    const overdue = approvalIsOverdue(r);
    return `<tr>
      <td>${cell2(`<span class="code">${esc(r.id)}</span>`, approvalDocTypeChip(r.docType))}</td>
      <td>${cell2(esc(r.title), r.docId ? `Tham chiếu: <span class="code">${esc(r.docId)}</span>` : '')}</td>
      <td>${cell2(esc(r.requestedByName || '—'), fmtDateTimeVN(r.requestedAt))}</td>
      <td class="right num">${r.amount ? fmtVND(r.amount) : '—'}</td>
      <td>${r.status === 'PENDING' && lvl ? `Cấp ${lvl.level}/${r.levels.length}<div class="cell-sub">${esc(approvalRoleName(lvl.role))}</div>` : '—'}</td>
      <td>${approvalStatusBadge(r.status)}${overdue ? `<div class="cell-sub" style="color:var(--red);font-weight:700">Quá hạn ${approvalOverdueHours(r)} giờ</div>` : ''}</td>
      <td>${rowActions([
        { act: 'approval-view', data: `data-id="${r.id}"`, icon: 'fa-eye', title: 'Xem chi tiết' },
        ...(canAct ? [
          { act: 'approval-approve', data: `data-id="${r.id}"`, icon: 'fa-check', title: 'Duyệt' },
          { act: 'approval-reject', data: `data-id="${r.id}"`, icon: 'fa-xmark', title: 'Từ chối' },
        ] : []),
      ])}</td>
    </tr>`;
  });

  return `<div class="card">
    <div class="toolbar">
      ${searchBox('approvals', 'Tìm theo tiêu đề, mã tham chiếu, người đề nghị…')}
      ${selectFilter('approvals', 'docType', APPROVAL_DOC_TYPE_LIST.map((dt) => [dt, APPROVAL_DOC_TYPES[dt].label]), 'Tất cả loại chứng từ')}
      ${selectFilter('approvals', 'status', [['PENDING', 'Đang chờ duyệt'], ['APPROVED', 'Đã duyệt'], ['REJECTED', 'Từ chối'], ['CANCELLED', 'Đã hủy']], 'Tất cả trạng thái')}
    </div>
    ${tableShell([
      { t: 'Mã yêu cầu' }, { t: 'Nội dung' }, { t: 'Người đề nghị' }, { t: 'Giá trị', cls: 'right' },
      { t: 'Cấp hiện tại' }, { t: 'Trạng thái' }, { t: '', w: '120px' },
    ], rows, { emptyTitle: 'Không có yêu cầu phù hợp' })}
    ${pagiHTML('approvals', pg, 'yêu cầu')}
  </div>`;
}

function approvalsWorkflowsView() {
  const canEdit = ['R01', 'R02'].includes((Auth.currentRole() || {}).id);
  const rows = DB.approvalWorkflows.map((w) => {
    const t = APPROVAL_DOC_TYPES[w.docType] || { label: w.docType };
    return `<tr>
      <td>${cell2(esc(t.label), `Mã quy trình: <span class="code">${esc(w.id)}</span>`)}</td>
      <td>${(w.levels || []).map((l) => `<div class="cell-sub">Cấp ${l.level}: <b>${esc(approvalRoleName(l.role))}</b>${l.minAmount ? ` — áp dụng khi ≥ ${fmtVND(l.minAmount)}` : ' — luôn áp dụng'}</div>`).join('')}</td>
      <td class="center">${w.slaHours} giờ</td>
      <td>${rowActions([{ act: 'approval-wf-edit', data: `data-id="${w.id}"`, icon: canEdit ? 'fa-pen' : 'fa-eye', title: canEdit ? 'Sửa quy trình' : 'Xem quy trình' }])}</td>
    </tr>`;
  });
  return `<div class="card">${tableShell([
    { t: 'Loại chứng từ' }, { t: 'Các cấp phê duyệt' }, { t: 'Hạn xử lý (SLA)', cls: 'center', w: '140px' }, { t: '', w: '70px' },
  ], rows)}</div>
  ${!canEdit ? `<div class="alert info" style="margin-top:12px;padding:12px 14px;border-radius:var(--r);background:var(--surface-2);border:1px solid var(--border);display:flex;gap:10px;align-items:center"><i class="fa-solid fa-circle-info" style="color:var(--primary)"></i><span style="font-size:12.5px;color:var(--text-2)">Chỉ Quản trị viên hoặc Ban giám đốc mới có quyền chỉnh sửa cấu hình quy trình phê duyệt.</span></div>` : ''}`;
}

function approvalsLogsView() {
  const f = F('approvalsLogs', { q: '', docType: '' });
  let list = DB.approvalLogs.filter((l) => !f.docType || l.docType === f.docType);
  if (f.q) {
    const q = f.q.toLowerCase();
    list = list.filter((l) => (l.docId + ' ' + l.actorName + ' ' + l.note).toLowerCase().includes(q));
  }
  const pg = paged(list, 'approvalsLogs', 15);
  const rows = pg.items.map((l) => `<tr>
    <td class="num">${fmtDateTimeVN(l.time)}</td>
    <td>${cell2(esc(l.actorName || '—'), approvalActionLabel(l.action))}</td>
    <td>${approvalDocTypeChip(l.docType)}</td>
    <td>${l.requestId ? `<span class="code" data-act="approval-view" data-id="${esc(l.requestId)}" style="cursor:pointer">${esc(l.requestId)}</span>` : '—'}${l.docId ? `<div class="cell-sub">${esc(l.docId)}</div>` : ''}</td>
    <td>${esc(l.note || '—')}</td>
  </tr>`);
  return `<div class="card">
    <div class="toolbar">
      ${searchBox('approvalsLogs', 'Tìm theo mã chứng từ, người thực hiện, ghi chú…')}
      ${selectFilter('approvalsLogs', 'docType', APPROVAL_DOC_TYPE_LIST.map((dt) => [dt, APPROVAL_DOC_TYPES[dt].label]), 'Tất cả loại chứng từ')}
    </div>
    ${tableShell([{ t: 'Thời gian', w: '160px' }, { t: 'Người thực hiện / Hành động' }, { t: 'Loại chứng từ' }, { t: 'Yêu cầu / Tham chiếu' }, { t: 'Ghi chú' }], rows, { emptyTitle: 'Chưa có nhật ký phê duyệt' })}
    ${pagiHTML('approvalsLogs', pg, 'dòng nhật ký')}
  </div>`;
}

function approvalsOverdueView() {
  const list = DB.approvalRequests.filter(approvalIsOverdue).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const rows = list.map((r) => {
    const lvl = ApprovalEngine.currentLevelOf(r);
    const canAct = ApprovalEngine.canAct(r);
    return `<tr>
      <td>${cell2(`<span class="code">${esc(r.id)}</span>`, approvalDocTypeChip(r.docType))}</td>
      <td>${cell2(esc(r.title), esc(r.requestedByName || ''))}</td>
      <td>${cell2(`Cấp ${lvl ? lvl.level : '—'}`, esc(approvalRoleName(lvl ? lvl.role : '')))}</td>
      <td class="num">${fmtDateTimeVN(r.dueAt)}</td>
      <td><span class="badge red">Quá hạn ${approvalOverdueHours(r)} giờ</span></td>
      <td>${rowActions([
        { act: 'approval-view', data: `data-id="${r.id}"`, icon: 'fa-eye', title: 'Xem chi tiết' },
        { act: 'approval-remind', data: `data-id="${r.id}"`, icon: 'fa-bell', title: 'Nhắc duyệt' },
        ...(canAct ? [{ act: 'approval-approve', data: `data-id="${r.id}"`, icon: 'fa-check', title: 'Duyệt ngay' }] : []),
      ])}</td>
    </tr>`;
  });
  return `<div class="card">${tableShell([
    { t: 'Mã yêu cầu' }, { t: 'Nội dung' }, { t: 'Đang chờ ở cấp' }, { t: 'Hạn duyệt', w: '160px' }, { t: 'Tình trạng' }, { t: '', w: '110px' },
  ], rows, { emptyTitle: 'Không có yêu cầu nào quá hạn', emptyDesc: 'Tất cả yêu cầu đang chờ duyệt vẫn còn trong hạn xử lý.' })}</div>`;
}

function approvalsSignatureView() {
  const mine = approvalMySignature();
  const myName = DB.currentUser?.name || '';
  return `<div class="grid g-21">
    <div class="card">
      <div class="card-head"><div><h3>Đăng ký chữ ký điện tử</h3><p>Chữ ký dùng để xác thực khi bạn phê duyệt các chứng từ</p></div></div>
      <div class="card-body">
        <div class="field"><label>Họ tên hiển thị trên chữ ký *</label><input class="inp" id="apSignName" value="${esc(mine ? mine.fullName : myName)}"></div>
        <label style="display:flex;gap:9px;align-items:flex-start;font-size:12.5px;color:var(--text-2);margin-bottom:14px">
          <input type="checkbox" id="apSignConsent" style="margin-top:3px" ${mine ? 'checked' : ''}>
          <span>Tôi xác nhận đây là chữ ký điện tử cá nhân, có giá trị pháp lý tương đương chữ ký tay khi phê duyệt chứng từ trên hệ thống Lê Nam ERP.</span>
        </label>
        <button class="btn btn-primary" data-act="approval-sign-save"><i class="fa-solid fa-signature"></i>Lưu chữ ký điện tử</button>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Chữ ký hiện tại</h3></div></div>
      <div class="card-body">
        ${mine ? `<div class="detail-list">
          <div class="detail-row"><span class="muted">Họ tên</span><strong>${esc(mine.fullName)}</strong></div>
          <div class="detail-row"><span class="muted">Mã xác thực</span><strong class="code">${esc(mine.code)}</strong></div>
          <div class="detail-row"><span class="muted">Đăng ký lúc</span><strong>${fmtDateTimeVN(mine.createdAt)}</strong></div>
          <div class="detail-row"><span class="muted">Mẫu chữ ký</span><strong style="font-style:italic">${esc(mine.preview)}</strong></div>
        </div>` : `<div class="empty" style="padding:20px"><div class="empty-ico"><i class="fa-solid fa-signature"></i></div><h4>Chưa đăng ký chữ ký</h4><p>Đăng ký chữ ký điện tử để có thể phê duyệt chứng từ trên hệ thống.</p></div>`}
      </div>
    </div>
  </div>`;
}

Views.approvals = function approvalsMainView() {
  const tab = State.tab || 'dashboard';
  const bodyFn = {
    dashboard: approvalsDashboardView,
    pending: approvalsPendingView,
    workflows: approvalsWorkflowsView,
    logs: approvalsLogsView,
    overdue: approvalsOverdueView,
    signature: approvalsSignatureView,
  }[tab] || approvalsDashboardView;
  return `${pageHead('Quy trình phê duyệt', 'Phân quyền theo cấp · Nhật ký phê duyệt · Chữ ký điện tử · Cảnh báo quá hạn', approvalsHeadActions())}
    ${moduleTabs(APPROVALS_TABS, tab)}
    ${bodyFn()}`;
};

/* ---------------------------------------------------------------------------
 * 6. MODAL / FORM
 * -------------------------------------------------------------------------*/
function openApprovalNewForm() {
  const options = APPROVAL_DOC_TYPE_LIST.map((dt) => `<option value="${dt}">${esc(APPROVAL_DOC_TYPES[dt].label)}</option>`).join('');
  Modal.open({
    title: 'Tạo yêu cầu phê duyệt',
    sub: 'Yêu cầu sẽ được chuyển lần lượt qua các cấp theo quy trình đã cấu hình',
    body: `<div class="form-grid cols-2">
        <div class="field"><label>Loại chứng từ *</label><select class="inp" id="apNewType">${options}</select></div>
        <div class="field"><label>Mã tham chiếu (nếu có)</label><input class="inp" id="apNewDocId" placeholder="VD: YCM-2026-0046, DH-2026-0088…"></div>
        <div class="field" style="grid-column:1/-1"><label>Tiêu đề</label><input class="inp" id="apNewTitle" placeholder="Để trống sẽ tự sinh theo loại chứng từ"></div>
        <div class="field"><label>Giá trị liên quan (VND, hoặc % nếu là giảm giá)</label><input class="inp right num" id="apNewAmount" type="number" min="0" value="0"></div>
        <div class="field" style="grid-column:1/-1"><label>Ghi chú / lý do đề nghị</label><textarea class="inp" id="apNewNote" rows="3"></textarea></div>
      </div>`,
    foot: `<button class="btn" data-act="modal-close">Hủy</button><button class="btn btn-primary" data-act="approval-new-save"><i class="fa-solid fa-paper-plane"></i>Gửi yêu cầu</button>`,
  });
}

function approvalDetailBody(req) {
  const steps = (req.levels || []).map((l) => {
    const cls = l.status === 'APPROVED' ? 'done' : (l.status === 'REJECTED' ? 'done' : (req.currentLevel === l.level && req.status === 'PENDING' ? 'doing' : ''));
    return `<div class="tline-item ${cls}">
      <span class="tline-dot"><i class="fa-solid ${l.status === 'APPROVED' ? 'fa-check' : l.status === 'REJECTED' ? 'fa-xmark' : 'fa-clock'}"></i></span>
      <div class="tline-title">Cấp ${l.level} — ${esc(l.label)} (${esc(approvalRoleName(l.role))})</div>
      <div class="tline-sub">
        ${l.status === 'PENDING' ? 'Đang chờ duyệt' : `${l.status === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'} bởi <b>${esc(l.approverName || '—')}</b> · ${fmtDateTimeVN(l.time)}`}
        ${l.note ? `<br>Ghi chú: ${esc(l.note)}` : ''}
        ${l.signature ? `<br><i style="font-style:italic">${esc(l.signature)}</i>` : ''}
      </div>
    </div>`;
  }).join('');
  return `<div class="detail-list" style="margin-bottom:16px">
      <div class="detail-row"><span class="muted">Loại chứng từ</span><strong>${approvalDocTypeChip(req.docType)}</strong></div>
      <div class="detail-row"><span class="muted">Mã tham chiếu</span><strong>${esc(req.docId || '—')}</strong></div>
      <div class="detail-row"><span class="muted">Người đề nghị</span><strong>${esc(req.requestedByName || '—')} · ${fmtDateTimeVN(req.requestedAt)}</strong></div>
      <div class="detail-row"><span class="muted">Giá trị</span><strong>${req.amount ? fmtVND(req.amount) : '—'}</strong></div>
      <div class="detail-row"><span class="muted">Hạn xử lý</span><strong>${fmtDateTimeVN(req.dueAt)}${approvalIsOverdue(req) ? ` <span class="badge red">Quá hạn ${approvalOverdueHours(req)} giờ</span>` : ''}</strong></div>
      <div class="detail-row"><span class="muted">Trạng thái</span><strong>${approvalStatusBadge(req.status)}</strong></div>
      <div class="detail-row"><span class="muted">Ghi chú đề nghị</span><strong>${esc(req.note || '—')}</strong></div>
    </div>
    <div class="form-sec-title"><i class="fa-solid fa-route"></i>Luồng phê duyệt</div>
    <div class="tline">${steps}</div>`;
}

function openApprovalDetail(id) {
  const req = DB.approvalRequests.find((r) => r.id === id);
  if (!req) return;
  const canAct = req.status === 'PENDING' && ApprovalEngine.canAct(req);
  Modal.open({
    title: `Chi tiết yêu cầu · ${req.id}`, sub: req.title, size: 'lg',
    body: approvalDetailBody(req),
    foot: `<button class="btn" data-act="modal-close">Đóng</button>
      ${canAct ? `<button class="btn btn-danger" data-act="approval-reject" data-id="${esc(req.id)}"><i class="fa-solid fa-xmark"></i>Từ chối</button>
        <button class="btn btn-primary" data-act="approval-approve" data-id="${esc(req.id)}"><i class="fa-solid fa-check"></i>Duyệt</button>` : ''}`,
  });
}

function openApprovalActionModal(id, kind) {
  const req = DB.approvalRequests.find((r) => r.id === id);
  if (!req) return;
  if (!ApprovalEngine.canAct(req)) { Toast.err('Không có quyền', 'Vai trò hiện tại không thuộc cấp duyệt hiện tại.'); return; }
  const lvl = ApprovalEngine.currentLevelOf(req);
  const mine = approvalMySignature();
  if (kind === 'approve') {
    Modal.open({
      title: `Duyệt yêu cầu · ${req.id}`, sub: `Cấp ${lvl.level} — ${lvl.label}`,
      body: `<div class="alert info" style="margin-bottom:12px;padding:11px 13px;border-radius:var(--r);background:var(--surface-2);border:1px solid var(--border);font-size:12.5px;color:var(--text-2)">${esc(req.title)}${req.amount ? ' · ' + fmtVND(req.amount) : ''}</div>
        <div class="field"><label>Ghi chú (không bắt buộc)</label><textarea class="inp" id="apNote" rows="2"></textarea></div>
        <div class="field"><label>Chữ ký điện tử</label><input class="inp" id="apSigText" value="${esc(mine ? approvalSignText(mine.fullName) : approvalSignText(DB.currentUser?.name || ''))}"></div>
        <label style="display:flex;gap:9px;align-items:flex-start;font-size:12.3px;color:var(--text-2)">
          <input type="checkbox" id="apSigConfirm" style="margin-top:3px">
          <span>Tôi xác nhận sử dụng chữ ký điện tử trên để phê duyệt chứng từ này.</span>
        </label>`,
      foot: `<button class="btn" data-act="modal-close">Hủy</button><button class="btn btn-primary" data-act="approval-approve-save" data-id="${esc(req.id)}"><i class="fa-solid fa-check"></i>Xác nhận duyệt</button>`,
    });
  } else {
    Modal.open({
      title: `Từ chối yêu cầu · ${req.id}`, sub: `Cấp ${lvl.level} — ${lvl.label}`,
      body: `<div class="field"><label>Lý do từ chối *</label><textarea class="inp" id="apReason" rows="3"></textarea></div>`,
      foot: `<button class="btn" data-act="modal-close">Hủy</button><button class="btn btn-danger" data-act="approval-reject-save" data-id="${esc(req.id)}"><i class="fa-solid fa-xmark"></i>Xác nhận từ chối</button>`,
    });
  }
}

function openWorkflowEditForm(id) {
  const w = DB.approvalWorkflows.find((x) => x.id === id);
  if (!w) return;
  const canEdit = ['R01', 'R02'].includes((Auth.currentRole() || {}).id);
  const roleOptions = (sel) => DB.roles.map((r) => `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
  const levelRows = (w.levels || []).map((l) => `<div class="ap-wf-level-line" style="display:grid;grid-template-columns:70px 1fr 1fr 160px 34px;gap:8px;margin-bottom:8px;align-items:center">
      <div class="cell-sub" style="text-align:center">Cấp ${l.level}</div>
      <select class="inp" name="role">${roleOptions(l.role)}</select>
      <input class="inp" name="label" value="${esc(l.label)}" placeholder="Diễn giải cấp duyệt">
      <input class="inp right num" name="minAmount" type="number" min="0" value="${Number(l.minAmount || 0)}" title="Áp dụng khi giá trị ≥ số này (0 = luôn áp dụng)">
      <button class="btn btn-sm" type="button" data-act="approval-wf-remove-level" ${!canEdit ? 'disabled' : ''}><i class="fa-solid fa-trash"></i></button>
    </div>`).join('');
  Modal.open({
    title: `Quy trình phê duyệt · ${(APPROVAL_DOC_TYPES[w.docType] || {}).label || w.docType}`,
    sub: canEdit ? 'Thêm/xóa cấp duyệt, đổi vai trò phụ trách và ngưỡng áp dụng' : 'Chỉ xem — không có quyền chỉnh sửa',
    size: 'lg',
    body: `<div class="form-grid cols-2" style="margin-bottom:10px">
        <div class="field"><label>Hạn xử lý (SLA — giờ)</label><input class="inp right num" id="apWfSla" type="number" min="1" value="${w.slaHours}" ${!canEdit ? 'disabled' : ''}></div>
      </div>
      <div class="form-sec-title"><i class="fa-solid fa-sitemap"></i>Các cấp phê duyệt (theo thứ tự)</div>
      <div id="apWfLevels">${levelRows}</div>
      ${canEdit ? `<button class="btn btn-sm" type="button" data-act="approval-wf-add-level"><i class="fa-solid fa-plus"></i>Thêm cấp duyệt</button>` : ''}`,
    foot: `<button class="btn" data-act="modal-close">Đóng</button>${canEdit ? `<button class="btn btn-primary" data-act="approval-wf-save" data-id="${esc(w.id)}"><i class="fa-solid fa-floppy-disk"></i>Lưu quy trình</button>` : ''}`,
  });
}

/* ---------------------------------------------------------------------------
 * 7. ACTIONS
 * -------------------------------------------------------------------------*/
Object.assign(Actions, {
  'approval-new': () => openApprovalNewForm(),
  'approval-new-save': () => {
    const docType = $('#apNewType')?.value || '';
    const docId = $('#apNewDocId')?.value.trim() || '';
    const title = $('#apNewTitle')?.value.trim() || '';
    const amount = Number($('#apNewAmount')?.value || 0);
    const note = $('#apNewNote')?.value.trim() || '';
    const req = ApprovalEngine.create({ docType, docId, title, amount, note });
    if (!req) return;
    Modal.close();
    go('approvals', { tab: 'pending' });
    Toast.ok('Đã tạo yêu cầu phê duyệt', `${req.id} · Cấp duyệt đầu tiên: ${approvalRoleName(req.levels[0].role)}`);
  },
  'approval-view': (d) => openApprovalDetail(d.id),
  'approval-approve': (d) => openApprovalActionModal(d.id, 'approve'),
  'approval-reject': (d) => openApprovalActionModal(d.id, 'reject'),
  'approval-approve-save': (d) => {
    if (!$('#apSigConfirm')?.checked) { Toast.err('Chưa xác nhận chữ ký', 'Vui lòng tick xác nhận sử dụng chữ ký điện tử trước khi duyệt.'); return; }
    const note = $('#apNote')?.value.trim() || '';
    const signature = $('#apSigText')?.value.trim() || '';
    if (ApprovalEngine.approve(d.id, { note, signature })) { Modal.close(); render(); }
  },
  'approval-reject-save': (d) => {
    const reason = $('#apReason')?.value.trim() || '';
    if (ApprovalEngine.reject(d.id, { reason })) { Modal.close(); render(); }
  },
  'approval-cancel': (d) => {
    confirmBox({
      title: 'Hủy yêu cầu phê duyệt', icon: 'fa-ban', okText: 'Hủy yêu cầu',
      message: `Hủy yêu cầu <b>${esc(d.id)}</b>? Yêu cầu sẽ không thể tiếp tục xử lý.`,
      onOk: () => { ApprovalEngine.cancel(d.id, 'Người đề nghị hủy yêu cầu'); render(); Toast.ok('Đã hủy yêu cầu', d.id); },
    });
  },
  'approval-remind': (d) => Toast.info('Đã gửi nhắc duyệt', `Thông báo nhắc duyệt cho yêu cầu ${d.id} đã được ghi nhận (bản demo).`),
  'approval-filter-pending': () => { const f = F('approvals'); f.status = 'PENDING'; f.docType = ''; State.page.approvals = 1; go('approvals', { tab: 'pending' }); },
  'approval-filter-overdue': () => go('approvals', { tab: 'overdue' }),
  'approval-filter-type': (d) => { const f = F('approvals'); f.status = 'PENDING'; f.docType = d.type; State.page.approvals = 1; go('approvals', { tab: 'pending' }); },
  'approval-wf-edit': (d) => openWorkflowEditForm(d.id),
  'approval-wf-add-level': () => {
    const host = $('#apWfLevels'); if (!host) return;
    const n = host.querySelectorAll('.ap-wf-level-line').length + 1;
    const roleOptions = DB.roles.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
    const row = document.createElement('div');
    row.className = 'ap-wf-level-line';
    row.style.cssText = 'display:grid;grid-template-columns:70px 1fr 1fr 160px 34px;gap:8px;margin-bottom:8px;align-items:center';
    row.innerHTML = `<div class="cell-sub" style="text-align:center">Cấp ${n}</div><select class="inp" name="role">${roleOptions}</select><input class="inp" name="label" placeholder="Diễn giải cấp duyệt"><input class="inp right num" name="minAmount" type="number" min="0" value="0"><button class="btn btn-sm" type="button" data-act="approval-wf-remove-level"><i class="fa-solid fa-trash"></i></button>`;
    host.appendChild(row);
  },
  'approval-wf-remove-level': (d, el) => {
    const host = $('#apWfLevels');
    if (!host || host.querySelectorAll('.ap-wf-level-line').length <= 1) { Toast.warn('Cần ít nhất 1 cấp duyệt', 'Quy trình phải có tối thiểu một cấp phê duyệt.'); return; }
    el.closest('.ap-wf-level-line')?.remove();
    host.querySelectorAll('.ap-wf-level-line').forEach((row, i) => { row.querySelector('.cell-sub').textContent = 'Cấp ' + (i + 1); });
  },
  'approval-wf-save': (d) => {
    const w = DB.approvalWorkflows.find((x) => x.id === d.id); if (!w) return;
    const sla = Number($('#apWfSla')?.value || 24);
    const levels = [];
    document.querySelectorAll('.ap-wf-level-line').forEach((row, i) => {
      levels.push({
        level: i + 1,
        role: row.querySelector('[name="role"]')?.value || 'R01',
        label: row.querySelector('[name="label"]')?.value.trim() || `Cấp ${i + 1} duyệt`,
        minAmount: Number(row.querySelector('[name="minAmount"]')?.value || 0),
      });
    });
    if (!levels.length) { Toast.err('Thiếu cấp duyệt', 'Quy trình phải có ít nhất một cấp phê duyệt.'); return; }
    w.slaHours = sla > 0 ? sla : 24;
    w.levels = levels;
    Modal.close(); render();
    Toast.ok('Đã lưu quy trình phê duyệt', `${(APPROVAL_DOC_TYPES[w.docType] || {}).label || w.docType}`);
  },
  'approval-sign-save': () => {
    const fullName = $('#apSignName')?.value.trim() || '';
    if (!fullName) { Toast.err('Thiếu họ tên', 'Vui lòng nhập họ tên hiển thị trên chữ ký.'); return; }
    if (!$('#apSignConsent')?.checked) { Toast.err('Chưa xác nhận', 'Vui lòng tick xác nhận trước khi lưu chữ ký điện tử.'); return; }
    const uid = DB.currentUser?.userId || DB.currentUser?.id || '';
    let sig = (DB.eSignatures || []).find((s) => s.userId === uid);
    const code = approvalDjb2(fullName + uid + Date.now());
    const preview = approvalSignText(fullName);
    if (sig) { Object.assign(sig, { fullName, code, preview }); }
    else { sig = { userId: uid, fullName, code, preview, createdAt: new Date().toISOString() }; DB.eSignatures.unshift(sig); }
    render();
    Toast.ok('Đã lưu chữ ký điện tử', fullName);
  },
});
