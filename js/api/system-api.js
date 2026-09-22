/* ============================================================================
 * SYSTEM API — AUTH / ROLE / PERMISSION / AUDIT
 * ----------------------------------------------------------------------------
 * Không thay đổi business logic nghiệp vụ. File này chỉ cung cấp identity,
 * phân quyền truy cập và dấu vết thao tác cho các action hiện có.
 *
 * Nguyên tắc:
 *   - DB.employees: toàn bộ nhân sự (không đồng nghĩa có tài khoản ERP).
 *   - DB.users: chỉ actor thực sự đăng nhập/thao tác trên ERP.
 *   - Mỗi actor có username riêng để Audit biết chính xác ai tạo/duyệt.
 * ========================================================================== */
const SystemAPI = (() => {
  const TABLES = KIO_CONFIG.systemTables;
  const CACHE_KEY = KIO_CONFIG.storageKeys.systemCache;
  const SESSION_KEY = KIO_CONFIG.storageKeys.authSession;

  const ROLE_DEFS = [
    { id:'ROLE_ADMIN', name:'Quản trị hệ thống', permissions:['*'], modules:{'*':'*'} },
    { id:'ROLE_DIRECTOR', name:'Ban giám đốc', permissions:['VIEW_ALL','PURCHASE_VIEW','INVENTORY_VIEW','QC_VIEW','PRODUCTION_VIEW','CRM_VIEW','ACCOUNTING_VIEW','HR_VIEW','MAINTENANCE_VIEW','APPROVE_HIGH_LEVEL','PURCHASE_PR_APPROVE','PURCHASE_PO_APPROVE','PAYMENT_APPROVE','VIEW_AUDIT'], modules:{dashboard:'*',purchases:'*',warehouse:'*',production:'*',subcontracting:'*',restaurant:'*',accounting:'*',hr:'*',quality:'*',maintenance:'*',crm:'*',logistics:'*',rnd:'*',approvals:'*',bi:'*'} },
    { id:'ROLE_PURCHASE_MANAGER', name:'Trưởng bộ phận Mua hàng', permissions:['PURCHASE_VIEW','PURCHASE_PR_CREATE','PURCHASE_PR_APPROVE','PURCHASE_PO_CREATE','PURCHASE_PO_APPROVE','PURCHASE_SUPPLIER_MANAGE','PURCHASE_REPORT'], modules:{purchases:'*',warehouse:['inventory','receipts']} },
    { id:'ROLE_PURCHASE_STAFF', name:'Nhân viên Mua hàng', permissions:['PURCHASE_VIEW','PURCHASE_PR_CREATE','PURCHASE_PO_CREATE','PURCHASE_SUPPLIER_MANAGE','PURCHASE_REPORT'], modules:{purchases:['dashboard','pr','quotes','po','price_history','stock_control','suppliers'],warehouse:['inventory']} },
    { id:'ROLE_WAREHOUSE_MANAGER', name:'Trưởng/Thủ kho', permissions:['INVENTORY_VIEW','INVENTORY_OPERATE','INVENTORY_ADJUST','PURCHASE_PR_CREATE'], modules:{warehouse:'*',purchases:['pr']} },
    { id:'ROLE_QC_MANAGER', name:'Trưởng QC/ATTP', permissions:['QC_VIEW','QC_INSPECT','QC_APPROVE','INVENTORY_VIEW'], modules:{quality:'*',warehouse:['inventory','batches','defects','receipts']} },
    { id:'ROLE_QC_STAFF', name:'Nhân viên QC/ATTP', permissions:['QC_VIEW','QC_INSPECT','INVENTORY_VIEW'], modules:{quality:['dashboard','iqc','pqc','fqc','coa','traceability','defects'],warehouse:['inventory','batches','receipts']} },
    { id:'ROLE_PRODUCTION_MANAGER', name:'Quản đốc/Trưởng Sản xuất', permissions:['PRODUCTION_VIEW','PRODUCTION_OPERATE','PRODUCTION_APPROVE','INVENTORY_VIEW','PURCHASE_PR_CREATE'], modules:{production:'*',warehouse:['inventory'],purchases:['pr']} },
    { id:'ROLE_PRODUCTION_STAFF', name:'Nhân viên/Kế hoạch Sản xuất', permissions:['PRODUCTION_VIEW','PRODUCTION_OPERATE','INVENTORY_VIEW','PURCHASE_PR_CREATE'], modules:{production:['dashboard','orders','bom','routing','plan','progress','issue_nvl','receipt_tp','wip','scrap'],warehouse:['inventory'],purchases:['pr']} },
    { id:'ROLE_SALES_MANAGER', name:'Trưởng Kinh doanh', permissions:['CRM_VIEW','CRM_OPERATE','CRM_DELETE_CUSTOMER','SALES_ORDER_OPERATE','SALES_APPROVE'], modules:{crm:'*'} },
    { id:'ROLE_SALES_STAFF', name:'Nhân viên Kinh doanh', permissions:['CRM_VIEW','CRM_OPERATE','SALES_ORDER_OPERATE'], modules:{crm:['dashboard','customers','transactions','orders']} },
    { id:'ROLE_CHIEF_ACCOUNTANT', name:'Kế toán trưởng', permissions:['ACCOUNTING_VIEW','ACCOUNTING_OPERATE','PAYMENT_APPROVE','PURCHASE_VIEW'], modules:{accounting:'*',purchases:['dashboard','po','debts']} },
    { id:'ROLE_ACCOUNTANT', name:'Kế toán viên', permissions:['ACCOUNTING_VIEW','ACCOUNTING_OPERATE','PURCHASE_VIEW'], modules:{accounting:['dashboard','general_ledger','ar','ap','cashflow_inout','banking','costing','tax','reports'],purchases:['debts','po']} },
    { id:'ROLE_HR_MANAGER', name:'Trưởng Hành chính - Nhân sự', permissions:['HR_VIEW','HR_OPERATE'], modules:{hr:'*'} },
    { id:'ROLE_MAINTENANCE_MANAGER', name:'Trưởng Bảo trì', permissions:['MAINTENANCE_VIEW','MAINTENANCE_OPERATE'], modules:{maintenance:'*'} },
  ];

  // Chỉ các actor thực sự tạo/duyệt/kiểm soát chứng từ mới có tài khoản.
  // Công nhân sản xuất vẫn nằm trong DB.employees để truy xuất ca/năng suất nhưng KHÔNG có user ERP.
  const ACTORS = [
    { id:'USR-DIR-001', empId:'NV-001', username:'tu.ha',       fullName:'Hà Minh Tú',          dept:'Ban giám đốc',          roleId:'ROLE_DIRECTOR' },
    { id:'USR-SALES-MGR',empId:'NV-002',username:'anh.nd',      fullName:'Nguyễn Đức Anh',      dept:'Kinh doanh',             roleId:'ROLE_SALES_MANAGER' },
    { id:'USR-SALES-001',empId:'NV-003',username:'ha.tt',       fullName:'Trần Thu Hà',         dept:'Kinh doanh',             roleId:'ROLE_SALES_STAFF' },
    { id:'USR-PROD-MGR', empId:'NV-005',username:'bao.pq',      fullName:'Phạm Quốc Bảo',       dept:'Sản xuất',               roleId:'ROLE_PRODUCTION_MANAGER' },
    { id:'USR-PROD-001', empId:'NV-006',username:'xay.vv',      fullName:'Vũ Văn Xay',          dept:'Sản xuất',               roleId:'ROLE_PRODUCTION_STAFF' },
    { id:'USR-QC-MGR',   empId:'NV-015',username:'lan.nt',      fullName:'Ngô Thị Lan',         dept:'QC/ATTP',                roleId:'ROLE_QC_MANAGER' },
    { id:'USR-QC-001',   empId:'NV-016',username:'kiem.tv',     fullName:'Trịnh Văn Kiểm',      dept:'QC/ATTP',                roleId:'ROLE_QC_STAFF' },
    { id:'USR-WH-MGR',   empId:'NV-018',username:'thang.cv',    fullName:'Cao Văn Thắng',       dept:'Kho vận',                roleId:'ROLE_WAREHOUSE_MANAGER' },
    { id:'USR-PUR-MGR',  empId:'NV-020',username:'loi.tv',      fullName:'Tạ Văn Lợi',          dept:'Mua hàng',               roleId:'ROLE_PURCHASE_MANAGER' },
    { id:'USR-PUR-001',  empId:'NV-021',username:'ngan.vtk',    fullName:'Võ Thị Kim Ngân',     dept:'Mua hàng',               roleId:'ROLE_PURCHASE_STAFF' },
    { id:'USR-ACC-MGR',  empId:'NV-022',username:'thao.ctt',    fullName:'Chu Thị Thanh Thảo',  dept:'Kế toán',                roleId:'ROLE_CHIEF_ACCOUNTANT' },
    { id:'USR-ACC-001',  empId:'NV-023',username:'ngoc.dt',     fullName:'Dương Thị Ngọc',      dept:'Kế toán',                roleId:'ROLE_ACCOUNTANT' },
    { id:'USR-HR-MGR',   empId:'NV-024',username:'nhung.mth',   fullName:'Mai Thị Hồng Nhung',  dept:'Hành chính - Nhân sự',   roleId:'ROLE_HR_MANAGER' },
    { id:'USR-MAINT-MGR',empId:'NV-025',username:'tri.lv',      fullName:'Lâm Văn Trí',         dept:'Bảo trì - Vệ sinh',      roleId:'ROLE_MAINTENANCE_MANAGER' },
    { id:'USR-ADMIN',    empId:'',      username:'admin',       fullName:'Admin ERP',            dept:'Hệ thống',               roleId:'ROLE_ADMIN' },
  ];

  const PERMISSIONS = [...new Set(ROLE_DEFS.flatMap(r => r.permissions).filter(p => p !== '*'))]
    .map(code => ({ id:`PERM-${code}`, code, name:code }));
  const ROLE_PERMISSIONS = ROLE_DEFS.flatMap(role => role.permissions.filter(p => p !== '*').map(code => ({ id:`${role.id}::${code}`, roleId:role.id, permissionCode:code })));

  const nowText = () => {
    const d = new Date();
    const p = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
  }

  async function buildDefaultUsers() {
    const hash = await sha256('123456');
    return ACTORS.map(u => ({ ...u, name:u.fullName, passwordHash:hash, state:'active', lastLogin:'', createdAt:'2026-09-11' }));
  }

  function cacheWrite(data) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (_) {} }
  const SYSTEM_REFRESH_TTL = 5 * 60 * 1000;
  function cacheRead() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (_) { return null; } }

  async function loadTable(key) { return KioStore.listCollection(TABLES[key]); }
  async function syncTable(key, rows) { return KioStore.syncCollection(TABLES[key], rows); }

  async function bootstrap() {
    const defaults = await buildDefaultUsers();
    const cache = cacheRead();

    // [PERFORMANCE] Auth dùng cache/actor mặc định để login tức thì. Không đọc
    // 5 bảng KIO ở boot vì các bảng quyền rất ít thay đổi và việc đó từng chặn
    // queue LIST của Purchase/Kho/CRM trong hàng chục giây.
    const users = cache?.users?.length ? cache.users : defaults;
    const roles = cache?.roles?.length ? cache.roles : ROLE_DEFS;
    const auditLogs = Array.isArray(cache?.auditLogs) ? cache.auditLogs : [];

    DB.users = users;
    DB.roles = roles.map(r => ({...r, perms:r.permissions || [], desc:r.desc || r.name, users:users.filter(u => u.roleId === r.id).length}));
    DB.auditLogs = auditLogs;
    return true;
  }

  // Chỉ gọi khi thật sự cần làm mới cấu hình người dùng/quyền (ví dụ màn
  // Quản trị người dùng), không tự chạy mỗi lần login.
  async function refreshFromServer() {
    const defaults = await buildDefaultUsers();
    const [remoteUsers, remoteRoles, remotePerms, remoteRP, remoteAudit] = await Promise.all([
      loadTable('users'), loadTable('roles'), loadTable('permissions'), loadTable('rolePermissions'), loadTable('auditLogs')
    ]);

    const byUser = new Map((remoteUsers || []).map(x => [x.id, x]));
    const mergedUsers = defaults.map(d => ({ ...d, ...(byUser.get(d.id) || {}) }));
    const byRole = new Map((remoteRoles || []).map(x => [x.id, x]));
    const mergedRoles = ROLE_DEFS.map(d => ({ ...d, ...(byRole.get(d.id) || {}), permissions:d.permissions, modules:d.modules }));
    const mergedAudit = Array.isArray(remoteAudit) ? remoteAudit : [];

    DB.users = mergedUsers;
    DB.roles = mergedRoles.map(r => ({...r, perms:r.permissions || [], desc:r.desc || r.name, users:mergedUsers.filter(u => u.roleId === r.id).length}));
    DB.auditLogs = mergedAudit;
    cacheWrite({users:mergedUsers, roles:mergedRoles, auditLogs:mergedAudit, syncedAt:Date.now()});

    const seeds = [];
    if (!(remoteUsers || []).length) seeds.push(syncTable('users', mergedUsers));
    if (!(remoteRoles || []).length) seeds.push(syncTable('roles', mergedRoles));
    if (!(remotePerms || []).length) seeds.push(syncTable('permissions', PERMISSIONS));
    if (!(remoteRP || []).length) seeds.push(syncTable('rolePermissions', ROLE_PERMISSIONS));
    if (seeds.length) await Promise.all(seeds);

    console.info('[SystemAPI] Đã refresh actor/role/permission từ KIO server.');
    return true;
  }

  function sessionGet() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { return null; } }
  function sessionSet(v) { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(v)); } catch (_) {} }
  function sessionClear() { try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {} }

  function setCurrentUser(user) {
    const role = (DB.roles || []).find(r => r.id === user.roleId);
    DB.currentUser = {
      id: user.empId || user.id,
      userId: user.id,
      username: user.username,
      name: user.fullName || user.name || user.username,
      roleId: user.roleId,
      role: role?.name || user.roleId,
      dept: user.dept || '',
      initials: typeof initials === 'function' ? initials(user.fullName || user.username) : '',
      email: user.empId ? ((DB.employees || []).find(e => e.id === user.empId)?.email || '') : '',
    };
  }

  function restoreSession() {
    const sess = sessionGet();
    if (!sess?.userId) return false;
    const user = (DB.users || []).find(u => u.id === sess.userId && u.state === 'active');
    if (!user) return false;
    setCurrentUser(user);
    return true;
  }

  async function login(username, password) {
    const u = (DB.users || []).find(x => String(x.username).toLowerCase() === String(username).trim().toLowerCase());
    if (!u || u.state !== 'active') return {ok:false,message:'Tài khoản không tồn tại hoặc đã bị khóa.'};
    const hash = await sha256(password);
    if (hash !== u.passwordHash) return {ok:false,message:'Mật khẩu không đúng.'};
    u.lastLogin = nowText();
    sessionSet({userId:u.id,loginAt:u.lastLogin});
    setCurrentUser(u);
    // Session có hiệu lực ngay. Không sync toàn bộ lenam_users mỗi lần login
    // vì thao tác đó phải đọc lại cả bảng và từng làm chậm các request nghiệp vụ.
    cacheWrite({users:DB.users||[], roles:DB.roles||[], auditLogs:DB.auditLogs||[]});
    audit({module:'AUTH',entityType:'USER',entityId:u.id,action:'LOGIN',description:`${u.fullName} đăng nhập hệ thống`}).catch(() => {});
    return {ok:true,user:u};
  }

  async function logout() {
    const user = currentUser();
    if (user) audit({module:'AUTH',entityType:'USER',entityId:user.id,action:'LOGOUT',description:`${user.fullName} đăng xuất hệ thống`}).catch(() => {});
    sessionClear();
    return true;
  }

  function currentUser() {
    const id = DB.currentUser?.userId;
    return (DB.users || []).find(u => u.id === id) || null;
  }

  async function audit({module='SYSTEM',entityType='ACTION',entityId='',action='ACTION',description='',oldData=null,newData=null}={}) {
    const user = currentUser();
    if (!user) return null;
    const role = (DB.roles || []).find(r => r.id === user.roleId);
    const item = {
      id:`AUD-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      userId:user.id, employeeId:user.empId || '', username:user.username,
      fullName:user.fullName || user.name || user.username,
      roleId:user.roleId, roleName:role?.name || user.roleId, department:user.dept || '',
      module, entityType, entityId:String(entityId || ''), action,
      description, oldData, newData, createdAt:nowText(),
    };
    DB.auditLogs = Array.isArray(DB.auditLogs) ? DB.auditLogs : [];
    DB.auditLogs.unshift(item);
    try {
      if (typeof KioStore.appendCollection === 'function') await KioStore.appendCollection(TABLES.auditLogs, [item]);
      else await syncTable('auditLogs', [item]);
    } catch (err) { console.warn('[Audit] Chưa ghi được KIO:', err); }
    return item;
  }

  function auditFor(entityId, entityType='') {
    return (DB.auditLogs || []).filter(a => String(a.entityId) === String(entityId) && (!entityType || a.entityType === entityType)).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  function showLogin() {
    return new Promise(resolve => {
      document.querySelector('.app')?.classList.add('hidden');
      let host=document.getElementById('authLoginHost');
      if (!host) { host=document.createElement('div'); host.id='authLoginHost'; document.body.appendChild(host); }
      host.innerHTML=`<div class="auth-screen"><form class="auth-card" id="authLoginForm">
        <div class="auth-logo"><i class="fa-solid fa-shield-halved"></i></div>
        <h2>Lê Nam ERP</h2><p>Đăng nhập bằng tài khoản actor được cấp để mọi thao tác có dấu vết.</p>
        <label>Tên đăng nhập</label><input class="inp" id="authUsername" autocomplete="username" required placeholder="Ví dụ: ngan.vtk">
        <label>Mật khẩu</label><input class="inp" id="authPassword" type="password" autocomplete="current-password" required placeholder="123456">
        <div class="auth-error" id="authError"></div>
        <button class="btn btn-primary" style="width:100%;justify-content:center" type="submit"><i class="fa-solid fa-right-to-bracket"></i> Đăng nhập</button>
        <div class="cell-sub" style="margin-top:12px;text-align:center">Tài khoản demo dùng mật khẩu <b>123456</b></div>
      </form></div>`;
      const style=document.createElement('style'); style.id='authStyle'; style.textContent=`
        .auth-screen{position:fixed;inset:0;z-index:99999;background:linear-gradient(135deg,var(--surface-2),var(--bg));display:flex;align-items:center;justify-content:center;padding:20px}
        .auth-card{width:min(420px,100%);background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:30px;box-shadow:0 24px 60px rgba(0,0,0,.16)}
        .auth-card h2{text-align:center;margin:8px 0}.auth-card>p{text-align:center;color:var(--text-3);font-size:13px;line-height:1.5;margin-bottom:22px}.auth-card label{display:block;font-size:12px;font-weight:700;margin:12px 0 6px}.auth-logo{width:56px;height:56px;margin:auto;border-radius:16px;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px}.auth-error{min-height:30px;color:var(--red);font-size:12px;padding-top:7px}`;
      if (!document.getElementById('authStyle')) document.head.appendChild(style);
      const form=document.getElementById('authLoginForm');
      form.addEventListener('submit', async e => {
        e.preventDefault(); const btn=form.querySelector('button'); btn.disabled=true;
        const res=await login(document.getElementById('authUsername').value,document.getElementById('authPassword').value);
        btn.disabled=false;
        if (!res.ok) { document.getElementById('authError').textContent=res.message; return; }
        host.remove(); document.querySelector('.app')?.classList.remove('hidden'); resolve(true);
      });
      setTimeout(()=>document.getElementById('authUsername')?.focus(),0);
    });
  }

  async function saveUsers() { await syncTable('users', DB.users || []); cacheWrite({users:DB.users||[],roles:DB.roles||[],auditLogs:DB.auditLogs||[],syncedAt:Date.now()}); return true; }

  return {bootstrap,refreshFromServer,restoreSession,showLogin,login,logout,audit,auditFor,currentUser,saveUsers,ROLE_DEFS,ACTORS,SESSION_KEY};
})();
