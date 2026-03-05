// ============================================================
// 다하다 OMS - 인사관리(HR) + 수수료 설정 페이지 v7.0
// Interaction Design: 컨텍스트메뉴, 호버프리뷰, 인라인토글,
// 탭 트랜지션, 유저행 드릴다운
// ============================================================

async function renderHRManagement(el) {
  const activeTab = window._hrTab || 'users';
  const isAdmin = currentUser.roles.includes('SUPER_ADMIN') || currentUser.roles.includes('HQ_OPERATOR');
  const isRegion = currentUser.org_type === 'REGION' && currentUser.roles.includes('REGION_ADMIN');
  const canManageSignup = isAdmin || isRegion;

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-users-gear mr-2 text-teal-600"></i>인사관리</h2>
      <div class="flex gap-1 mb-6 border-b overflow-x-auto">
        <button onclick="window._hrTab='users';renderContent()" class="px-4 py-2 text-sm whitespace-nowrap ${activeTab === 'users' ? 'tab-active' : 'text-gray-500'}"><i class="fas fa-users mr-1"></i>사용자</button>
        ${isAdmin ? `<button onclick="window._hrTab='orgs';renderContent()" class="px-4 py-2 text-sm whitespace-nowrap ${activeTab === 'orgs' ? 'tab-active' : 'text-gray-500'}"><i class="fas fa-building mr-1"></i>조직</button>` : ''}
        ${isAdmin ? `<button onclick="window._hrTab='org-tree';renderContent()" class="px-4 py-2 text-sm whitespace-nowrap ${activeTab === 'org-tree' ? 'tab-active' : 'text-gray-500'}"><i class="fas fa-sitemap mr-1"></i>조직트리</button>` : ''}
        ${canManageSignup ? `<button onclick="window._hrTab='signup';renderContent()" class="px-4 py-2 text-sm whitespace-nowrap ${activeTab === 'signup' ? 'tab-active' : 'text-gray-500'}"><i class="fas fa-user-plus mr-1"></i>가입관리</button>` : ''}
        ${isAdmin ? `<button onclick="window._hrTab='region-add';renderContent()" class="px-4 py-2 text-sm whitespace-nowrap ${activeTab === 'region-add' ? 'tab-active' : 'text-gray-500'}"><i class="fas fa-map-pin mr-1"></i>추가지역</button>` : ''}
        <button onclick="window._hrTab='commission';renderContent()" class="px-4 py-2 text-sm whitespace-nowrap ${activeTab === 'commission' ? 'tab-active' : 'text-gray-500'}"><i class="fas fa-percent mr-1"></i>수수료 설정</button>
        <button onclick="window._hrTab='phone';renderContent()" class="px-4 py-2 text-sm whitespace-nowrap ${activeTab === 'phone' ? 'tab-active' : 'text-gray-500'}"><i class="fas fa-mobile-alt mr-1"></i>폰인증</button>
        ${isAdmin || isRegion ? `<button onclick="window._hrTab='agency';renderContent()" class="px-4 py-2 text-sm whitespace-nowrap ${activeTab === 'agency' ? 'tab-active' : 'text-gray-500'}"><i class="fas fa-store mr-1"></i>대리점 관리</button>` : ''}
      </div>
      <div id="hr-content"></div>
    </div>`;
  
  const hrEl = document.getElementById('hr-content');
  switch (activeTab) {
    case 'users': await renderHRUsers(hrEl); break;
    case 'orgs': await renderHROrgs(hrEl); break;
    case 'org-tree': await renderHROrgTree(hrEl); break;
    case 'signup': await renderHRSignupRequests(hrEl); break;
    case 'region-add': await renderHRRegionAddRequests(hrEl); break;
    case 'commission': await renderHRCommission(hrEl); break;
    case 'phone': renderHRPhone(hrEl); break;
    case 'agency': await renderHRAgency(hrEl); break;
  }
}

// ─── 사용자 목록 ───
async function renderHRUsers(el) {
  const params = new URLSearchParams(window._hrUserFilters || {});
  if (!params.has('limit')) params.set('limit', '30');
  const res = await api('GET', `/hr/users?${params.toString()}`);
  const users = res?.users || [];

  el.innerHTML = `
    <div class="bg-white rounded-xl p-4 mb-4 border border-gray-100 flex flex-wrap gap-3 items-end">
      <div><label class="block text-xs text-gray-500 mb-1">검색</label>
        <input id="hr-search" class="border rounded-lg px-3 py-2 text-sm w-48" placeholder="이름/ID/전화" value="${params.get('search') || ''}" onkeypress="if(event.key==='Enter')applyHRUserFilter()"></div>
      <div><label class="block text-xs text-gray-500 mb-1">상태</label>
        <select id="hr-status" class="border rounded-lg px-3 py-2 text-sm">
          <option value="">전체</option><option value="ACTIVE" ${params.get('status')==='ACTIVE'?'selected':''}>활성</option><option value="INACTIVE" ${params.get('status')==='INACTIVE'?'selected':''}>비활성</option>
        </select></div>
      <button onclick="applyHRUserFilter()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm"><i class="fas fa-search mr-1"></i>조회</button>
      <button onclick="showCreateUserModal()" class="ml-auto px-4 py-2 bg-teal-600 text-white rounded-lg text-sm"><i class="fas fa-user-plus mr-1"></i>신규 등록</button>
    </div>

    <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50"><tr>
          <th class="px-3 py-2 text-left">ID</th><th class="px-3 py-2 text-left">이름</th>
          <th class="px-3 py-2 text-left">로그인ID</th><th class="px-3 py-2 text-left">소속</th>
          <th class="px-3 py-2 text-left">역할</th><th class="px-3 py-2 text-left">연락처</th>
          <th class="px-3 py-2 text-center">폰인증</th><th class="px-3 py-2 text-center">상태</th>
          <th class="px-3 py-2 text-center">관리</th>
        </tr></thead>
        <tbody class="divide-y">${users.map(u => `
          <tr class="ix-table-row"
              oncontextmenu="showHRUserContextMenu(event, ${JSON.stringify(u).replace(/"/g, '&quot;')})"
              data-preview="user" data-preview-id="${u.user_id}" data-preview-title="${u.name}">
            <td class="px-3 py-2 font-mono text-xs text-gray-500">${u.user_id}</td>
            <td class="px-3 py-2 font-medium">${u.name}</td>
            <td class="px-3 py-2 font-mono text-xs">${u.login_id}</td>
            <td class="px-3 py-2 text-xs">${u.org_name || '-'} <span class="text-gray-400">(${u.org_type})</span></td>
            <td class="px-3 py-2">${(u.roles || []).map(r => `<span class="status-badge bg-gray-100 text-gray-700 text-[10px]">${r}</span>`).join(' ')}</td>
            <td class="px-3 py-2 text-xs">${formatPhone(u.phone)}</td>
            <td class="px-3 py-2 text-center">${u.phone_verified ? '<i class="fas fa-check-circle text-green-500"></i>' : '<i class="fas fa-times-circle text-gray-300"></i>'}</td>
            <td class="px-3 py-2 text-center"><span class="status-badge ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${u.status}</span></td>
            <td class="px-3 py-2 text-center" onclick="event.stopPropagation()">
              <div class="flex gap-1 justify-center">
                <button onclick="showEditUserModal(${u.user_id})" class="px-2 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200" data-tooltip="수정"><i class="fas fa-edit"></i></button>
                <button onclick="showCredentialModal(${u.user_id}, '${u.name}')" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200" data-tooltip="ID/PW 설정"><i class="fas fa-key"></i></button>
                <button onclick="resetUserPw(${u.user_id}, '${u.name}')" class="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs hover:bg-amber-200" data-tooltip="PW 초기화"><i class="fas fa-undo"></i></button>
                <button onclick="toggleUserStatus(${u.user_id}, '${u.status}', '${u.name}')" class="px-2 py-1 ${u.status === 'ACTIVE' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} rounded text-xs hover:opacity-80" data-tooltip="${u.status === 'ACTIVE' ? '비활성화' : '활성화'}"><i class="fas ${u.status === 'ACTIVE' ? 'fa-ban' : 'fa-check'}"></i></button>
              </div>
            </td>
          </tr>`).join('')}
          ${users.length === 0 ? '<tr><td colspan="9" class="px-3 py-8 text-center text-gray-400">사용자가 없습니다.</td></tr>' : ''}
        </tbody>
      </table>
    </div>`;
}

function applyHRUserFilter() {
  window._hrUserFilters = { search: document.getElementById('hr-search')?.value, status: document.getElementById('hr-status')?.value };
  Object.keys(window._hrUserFilters).forEach(k => { if (!window._hrUserFilters[k]) delete window._hrUserFilters[k]; });
  renderContent();
}

// ─── 사용자 신규등록 모달 ───
async function showCreateUserModal() {
  const orgsRes = await api('GET', '/auth/organizations');
  const rolesRes = await api('GET', '/hr/roles');
  const orgs = (orgsRes?.organizations || []).filter(o => o.status === 'ACTIVE');
  const roles = rolesRes?.roles || [];

  const content = `
    <form id="create-user-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-xs text-gray-500 mb-1">이름 *</label><input name="name" required class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">핸드폰 *</label><input name="phone" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="01012345678"></div>
        <div><label class="block text-xs text-gray-500 mb-1">소속 조직 *</label>
          <select name="org_id" required class="w-full border rounded-lg px-3 py-2 text-sm">
            ${orgs.map(o => `<option value="${o.org_id}" ${o.org_id === currentUser.org_id ? 'selected' : ''}>${o.name} (${o.org_type})</option>`).join('')}
          </select></div>
        <div><label class="block text-xs text-gray-500 mb-1">역할 *</label>
          <select name="role" required class="w-full border rounded-lg px-3 py-2 text-sm">
            ${roles.map(r => `<option value="${r.code}">${r.name} (${r.code})</option>`).join('')}
          </select></div>
        <div><label class="block text-xs text-gray-500 mb-1">로그인ID (비워두면 자동)</label><input name="login_id" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="auto_generated"></div>
        <div><label class="block text-xs text-gray-500 mb-1">비밀번호 (비워두면 폰 뒷4자리+!)</label><input name="password" type="password" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">이메일</label><input name="email" type="email" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">메모</label><input name="memo" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
      </div>
    </form>`;
  showModal('사용자 신규 등록', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitCreateUser()" class="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm">등록</button>`);
}

async function submitCreateUser() {
  const data = Object.fromEntries(new FormData(document.getElementById('create-user-form')));
  data.org_id = Number(data.org_id);
  if (!data.login_id) delete data.login_id;
  if (!data.password) delete data.password;
  const res = await api('POST', '/hr/users', data);
  if (res?.user_id) {
    showToast(`${res.message}`, 'success');
    closeModal();
    // 초기 비밀번호 안내 모달
    showModal('등록 완료', `
      <div class="p-4 bg-green-50 rounded-lg border border-green-200">
        <p class="font-semibold text-green-800 mb-2">사용자 등록 성공</p>
        <div class="space-y-1 text-sm">
          <div><span class="text-gray-500">로그인 ID:</span> <strong class="font-mono">${res.login_id}</strong></div>
          <div><span class="text-gray-500">초기 비밀번호:</span> <strong class="font-mono text-red-600">${res.initial_password}</strong></div>
        </div>
        <p class="text-xs text-gray-500 mt-3">* 이 정보를 사용자에게 전달하세요.</p>
      </div>
    `, `<button onclick="closeModal();renderContent()" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">확인</button>`);
  } else showToast(res?.error || '등록 실패', 'error');
}

// ─── 사용자 수정 모달 ───
async function showEditUserModal(userId) {
  const res = await api('GET', `/hr/users/${userId}`);
  if (!res?.user) return showToast('사용자 정보를 불러올 수 없습니다.', 'error');
  const u = res.user;
  const roles = res.roles || [];
  const currentRole = roles.length > 0 ? roles[0].code : '';

  const orgsRes = await api('GET', '/auth/organizations');
  const rolesRes = await api('GET', '/hr/roles');
  const orgs = (orgsRes?.organizations || []).filter(o => o.status === 'ACTIVE');
  const allRoles = rolesRes?.roles || [];

  const content = `
    <form id="edit-user-form" class="space-y-4">
      <input type="hidden" name="user_id" value="${userId}">
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-xs text-gray-500 mb-1">이름</label><input name="name" value="${u.name || ''}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">핸드폰</label><input name="phone" value="${u.phone || ''}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">소속</label>
          <select name="org_id" class="w-full border rounded-lg px-3 py-2 text-sm">
            ${orgs.map(o => `<option value="${o.org_id}" ${o.org_id === u.org_id ? 'selected' : ''}>${o.name}</option>`).join('')}
          </select></div>
        <div><label class="block text-xs text-gray-500 mb-1">역할</label>
          <select name="role" class="w-full border rounded-lg px-3 py-2 text-sm">
            ${allRoles.map(r => `<option value="${r.code}" ${r.code === currentRole ? 'selected' : ''}>${r.name}</option>`).join('')}
          </select></div>
        <div><label class="block text-xs text-gray-500 mb-1">이메일</label><input name="email" value="${u.email || ''}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">메모</label><input name="memo" value="${u.memo || ''}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
      </div>
      ${res.activity ? `
      <div class="border-t pt-3">
        <h4 class="text-xs text-gray-500 mb-2">활동 현황</h4>
        <div class="flex gap-4 text-sm">
          <span>배정: <strong>${res.activity.total_assigned || 0}</strong></span>
          <span class="text-green-600">승인: <strong>${res.activity.total_approved || 0}</strong></span>
          <span class="text-blue-600">정산: <strong>${res.activity.total_settled || 0}</strong></span>
          <span class="text-red-600">반려: <strong>${res.activity.total_rejected || 0}</strong></span>
        </div>
      </div>` : ''}
    </form>`;
  showModal(`사용자 수정 — ${u.name}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitEditUser(${userId})" class="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm">저장</button>`, { large: false });
}

async function submitEditUser(userId) {
  const data = Object.fromEntries(new FormData(document.getElementById('edit-user-form')));
  data.org_id = Number(data.org_id);
  delete data.user_id;
  const res = await api('PUT', `/hr/users/${userId}`, data);
  if (res?.ok) { showToast('수정 완료', 'success'); closeModal(); renderContent(); }
  else showToast(res?.error || '수정 실패', 'error');
}

// ─── ID/PW 설정 모달 ───
function showCredentialModal(userId, name) {
  const content = `
    <div class="space-y-4">
      <p class="text-sm text-gray-600"><strong>${name}</strong>의 로그인 자격 증명을 설정합니다.</p>
      <div><label class="block text-xs text-gray-500 mb-1">새 로그인 ID</label><input id="cred-login" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="변경할 ID (비워두면 유지)"></div>
      <div><label class="block text-xs text-gray-500 mb-1">새 비밀번호</label><input id="cred-pw" type="password" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="변경할 PW (비워두면 유지)"></div>
    </div>`;
  showModal('ID/PW 직접 설정', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitCredentials(${userId})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">설정</button>`);
}

async function submitCredentials(userId) {
  const loginId = document.getElementById('cred-login').value;
  const password = document.getElementById('cred-pw').value;
  if (!loginId && !password) return showToast('변경할 항목을 입력하세요.', 'warning');
  const body = {};
  if (loginId) body.login_id = loginId;
  if (password) body.password = password;
  const res = await api('POST', `/hr/users/${userId}/set-credentials`, body);
  if (res?.ok) { showToast('자격 증명 설정 완료', 'success'); closeModal(); }
  else showToast(res?.error || '설정 실패', 'error');
}

async function resetUserPw(userId, name) {
  showConfirmModal('비밀번호 초기화', `<strong>${name}</strong>의 비밀번호를 핸드폰 뒷4자리+!로 초기화하시겠습니까?`,
    async () => {
      const res = await api('POST', `/hr/users/${userId}/reset-password`);
      if (res?.ok) showToast(`초기화 완료: ${res.new_password}`, 'success');
      else showToast(res?.error || '초기화 실패', 'error');
    }, '초기화', 'bg-amber-600');
}

async function toggleUserStatus(userId, currentStatus, name) {
  const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  const action = newStatus === 'ACTIVE' ? '활성화' : '비활성화';
  showConfirmModal(`사용자 ${action}`, `<strong>${name}</strong>을(를) ${action}하시겠습니까?${newStatus === 'INACTIVE' ? '<br><span class="text-red-500 text-xs">비활성화 시 로그인이 불가능합니다.</span>' : ''}`,
    async () => {
      const res = await api('PATCH', `/hr/users/${userId}/status`, { status: newStatus });
      if (res?.ok) { showToast(res.message, 'success'); renderContent(); }
      else showToast(res?.error || '실패', 'error');
    }, action, newStatus === 'ACTIVE' ? 'bg-green-600' : 'bg-red-600');
}

// ─── 조직 관리 ───
async function renderHROrgs(el) {
  const res = await api('GET', '/hr/organizations');
  const orgs = res?.organizations || [];

  el.innerHTML = `
    <div class="bg-white rounded-xl p-4 mb-4 border border-gray-100 flex items-center justify-between">
      <span class="text-sm text-gray-600">조직 <strong>${orgs.length}</strong>개</span>
      <button onclick="showCreateOrgModal()" class="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm"><i class="fas fa-plus mr-1"></i>조직 등록</button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${orgs.map(o => `
        <div class="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 ${o.org_type === 'HQ' ? 'bg-blue-100' : 'bg-purple-100'} rounded-lg flex items-center justify-center">
                <i class="fas ${o.org_type === 'HQ' ? 'fa-building' : 'fa-map-location-dot'} ${o.org_type === 'HQ' ? 'text-blue-600' : 'text-purple-600'}"></i>
              </div>
              <div>
                <div class="font-bold">${o.name}</div>
                <div class="text-xs text-gray-500">${o.code || '-'} · ${o.org_type}</div>
              </div>
            </div>
            <span class="status-badge ${o.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${o.status}</span>
          </div>
          <div class="flex items-center gap-4 text-sm text-gray-600">
            <span><i class="fas fa-users mr-1"></i>활성 ${o.active_members || 0}명 / 전체 ${o.total_members || 0}명</span>
            <span><i class="fas fa-user-tie mr-1"></i>팀장 ${o.active_leaders || 0}명</span>
          </div>
        </div>
      `).join('')}
    </div>`;
}

function showCreateOrgModal() {
  const content = `
    <form id="create-org-form" class="space-y-4">
      <div><label class="block text-xs text-gray-500 mb-1">조직명 *</label><input name="name" required class="w-full border rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-xs text-gray-500 mb-1">유형 *</label>
        <select name="org_type" required class="w-full border rounded-lg px-3 py-2 text-sm"><option value="REGION">REGION</option><option value="HQ">HQ</option></select></div>
      <div><label class="block text-xs text-gray-500 mb-1">코드 (영문대문자)</label><input name="code" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="REGION_DAEJEON"></div>
    </form>`;
  showModal('조직 등록', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitCreateOrg()" class="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm">등록</button>`);
}

async function submitCreateOrg() {
  const data = Object.fromEntries(new FormData(document.getElementById('create-org-form')));
  const res = await api('POST', '/hr/organizations', data);
  if (res?.org_id) { showToast('조직 등록 완료', 'success'); closeModal(); renderContent(); }
  else showToast(res?.error || '등록 실패', 'error');
}

// ─── 수수료(정률/요율) 설정 ───
async function renderHRCommission(el) {
  const [commRes, orgsRes, leadersRes] = await Promise.all([
    api('GET', '/hr/commission-policies'),
    api('GET', '/auth/organizations'),
    api('GET', '/auth/team-leaders'),
  ]);
  const policies = commRes?.policies || [];
  const orgs = (orgsRes?.organizations || []).filter(o => o.org_type === 'REGION');
  const leaders = leadersRes?.team_leaders || [];

  el.innerHTML = `
    <div class="bg-white rounded-xl p-4 mb-4 border border-gray-100 flex items-center justify-between">
      <div class="text-sm text-gray-600">
        <span><i class="fas fa-percent mr-1 text-blue-500"></i>정률(PERCENT): 주문금액의 %를 수수료로 차감</span>
        <span class="ml-4"><i class="fas fa-coins mr-1 text-amber-500"></i>정액(FIXED): 건당 고정금액 차감</span>
      </div>
      <button onclick="showCreateCommissionModal()" class="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm"><i class="fas fa-plus mr-1"></i>수수료 정책 추가</button>
    </div>

    <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50"><tr>
          <th class="px-4 py-3 text-left">ID</th><th class="px-4 py-3 text-left">지역법인</th>
          <th class="px-4 py-3 text-left">대상 팀장</th><th class="px-4 py-3 text-center">유형</th>
          <th class="px-4 py-3 text-right">값</th><th class="px-4 py-3 text-left">적용시작</th>
          <th class="px-4 py-3 text-center">활성</th><th class="px-4 py-3 text-center">관리</th>
        </tr></thead>
        <tbody class="divide-y">${policies.map(p => `
          <tr class="hover:bg-gray-50">
            <td class="px-4 py-3 font-mono text-xs">${p.commission_policy_id}</td>
            <td class="px-4 py-3">${p.org_name}</td>
            <td class="px-4 py-3">${p.team_leader_name || '<span class="text-gray-400">법인 기본</span>'}</td>
            <td class="px-4 py-3 text-center"><span class="status-badge ${p.mode === 'PERCENT' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}">${p.mode === 'PERCENT' ? '정률' : '정액'}</span></td>
            <td class="px-4 py-3 text-right font-bold">${p.mode === 'PERCENT' ? p.value + '%' : formatAmount(p.value)}</td>
            <td class="px-4 py-3 text-xs">${p.effective_from || '-'}</td>
            <td class="px-4 py-3 text-center">${p.is_active ? '<span class="text-green-600 font-bold">활성</span>' : '비활성'}</td>
            <td class="px-4 py-3 text-center">
              <div class="flex gap-1 justify-center">
                <button onclick="showEditCommissionModal(${p.commission_policy_id}, ${JSON.stringify(p).replace(/"/g, '&quot;')})" class="px-2 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200"><i class="fas fa-edit"></i></button>
                ${currentUser.roles.includes('SUPER_ADMIN') || currentUser.roles.includes('HQ_OPERATOR') ? `
                  <button onclick="deleteCommission(${p.commission_policy_id})" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"><i class="fas fa-trash"></i></button>
                ` : ''}
              </div>
            </td>
          </tr>`).join('')}
          ${policies.length === 0 ? '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">수수료 정책이 없습니다.</td></tr>' : ''}
        </tbody>
      </table>
    </div>`;

  // 모달에서 사용할 데이터 저장
  window._commOrgs = orgs;
  window._commLeaders = leaders;
}

function showCreateCommissionModal() {
  const orgs = window._commOrgs || [];
  const leaders = window._commLeaders || [];
  const today = new Date().toISOString().split('T')[0];

  const content = `
    <form id="create-comm-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-xs text-gray-500 mb-1">지역법인 *</label>
          <select id="comm-org" name="org_id" required class="w-full border rounded-lg px-3 py-2 text-sm" onchange="updateCommLeaderOptions()">
            <option value="">선택</option>
            ${orgs.map(o => `<option value="${o.org_id}" ${o.org_id === currentUser.org_id ? 'selected' : ''}>${o.name}</option>`).join('')}
          </select></div>
        <div><label class="block text-xs text-gray-500 mb-1">대상 팀장 (비워두면 법인 기본)</label>
          <select id="comm-leader" name="team_leader_id" class="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">법인 기본</option>
            ${leaders.map(l => `<option value="${l.user_id}" data-org="${l.org_id}">${l.name} (${l.org_name})</option>`).join('')}
          </select></div>
        <div><label class="block text-xs text-gray-500 mb-1">수수료 유형 *</label>
          <select name="mode" required class="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="PERCENT">정률 (PERCENT)</option><option value="FIXED">정액 (FIXED)</option>
          </select></div>
        <div><label class="block text-xs text-gray-500 mb-1">값 * (정률: %, 정액: 원)</label>
          <input name="value" type="number" step="0.1" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="7.5 또는 50000"></div>
        <div class="col-span-2"><label class="block text-xs text-gray-500 mb-1">적용 시작일</label>
          <input name="effective_from" type="date" value="${today}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
      </div>
    </form>`;
  showModal('수수료 정책 추가', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitCreateCommission()" class="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm">등록</button>`);
}

function updateCommLeaderOptions() {
  const orgId = document.getElementById('comm-org')?.value;
  const select = document.getElementById('comm-leader');
  if (!select) return;
  Array.from(select.options).forEach(opt => {
    if (opt.value) { opt.style.display = (!orgId || opt.dataset.org === orgId) ? '' : 'none'; }
  });
}

async function submitCreateCommission() {
  const data = Object.fromEntries(new FormData(document.getElementById('create-comm-form')));
  data.org_id = Number(data.org_id);
  data.value = Number(data.value);
  if (data.team_leader_id) data.team_leader_id = Number(data.team_leader_id);
  else delete data.team_leader_id;
  const res = await api('POST', '/hr/commission-policies', data);
  if (res?.commission_policy_id) { showToast('수수료 정책 등록 완료', 'success'); closeModal(); renderContent(); }
  else showToast(res?.error || '등록 실패', 'error');
}

function showEditCommissionModal(policyId, policyData) {
  const p = typeof policyData === 'string' ? JSON.parse(policyData) : policyData;
  const content = `
    <form id="edit-comm-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-xs text-gray-500 mb-1">지역법인</label>
          <input disabled class="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" value="${p.org_name}"></div>
        <div><label class="block text-xs text-gray-500 mb-1">대상 팀장</label>
          <input disabled class="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" value="${p.team_leader_name || '법인 기본'}"></div>
        <div><label class="block text-xs text-gray-500 mb-1">수수료 유형</label>
          <select name="mode" class="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="PERCENT" ${p.mode === 'PERCENT' ? 'selected' : ''}>정률</option>
            <option value="FIXED" ${p.mode === 'FIXED' ? 'selected' : ''}>정액</option>
          </select></div>
        <div><label class="block text-xs text-gray-500 mb-1">값</label>
          <input name="value" type="number" step="0.1" value="${p.value}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div class="col-span-2"><label class="block text-xs text-gray-500 mb-1">적용 시작일</label>
          <input name="effective_from" type="date" value="${p.effective_from || ''}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
      </div>
    </form>`;
  showModal(`수수료 정책 수정 — #${policyId}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitEditCommission(${policyId})" class="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm">저장</button>`);
}

async function submitEditCommission(policyId) {
  const data = Object.fromEntries(new FormData(document.getElementById('edit-comm-form')));
  data.value = Number(data.value);
  const res = await api('PUT', `/hr/commission-policies/${policyId}`, data);
  if (res?.ok) { showToast('수수료 정책 수정 완료', 'success'); closeModal(); renderContent(); }
  else showToast(res?.error || '수정 실패', 'error');
}

async function deleteCommission(policyId) {
  showConfirmModal('수수료 정책 삭제', `정책 #${policyId}를 삭제하시겠습니까?`,
    async () => {
      const res = await api('DELETE', `/hr/commission-policies/${policyId}`);
      if (res?.ok) { showToast('삭제 완료', 'success'); renderContent(); }
      else showToast(res?.error || '삭제 실패', 'error');
    }, '삭제', 'bg-red-600');
}

// ─── 핸드폰 인증 ───
function renderHRPhone(el) {
  el.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl p-6 border border-gray-100">
        <h3 class="font-semibold mb-4"><i class="fas fa-mobile-alt mr-2 text-blue-500"></i>OTP 인증 요청</h3>
        <div id="phone-step1">
          <div class="space-y-4">
            <div><label class="block text-xs text-gray-500 mb-1">핸드폰 번호</label>
              <input id="otp-phone" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="01012345678"></div>
            <div><label class="block text-xs text-gray-500 mb-1">용도</label>
              <select id="otp-purpose" class="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="REGISTER">회원가입</option><option value="RESET_PW">비밀번호 재설정</option><option value="LOGIN">로그인</option>
              </select></div>
            <button onclick="sendOTP()" class="w-full px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium"><i class="fas fa-paper-plane mr-1"></i>인증번호 발송</button>
          </div>
        </div>
        <div id="phone-step2" style="display:none" class="space-y-4">
          <p id="otp-info" class="text-sm text-gray-600"></p>
          <div id="otp-dev" class="hidden p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-sm text-yellow-700"></div>
          <div><label class="block text-xs text-gray-500 mb-1">인증번호 (6자리)</label>
            <input id="otp-code" maxlength="6" class="w-full border rounded-lg px-3 py-3 text-sm text-center font-mono text-xl tracking-widest" placeholder="000000" oninput="if(this.value.length===6)verifyOTP()"></div>
          <div class="text-center text-sm" id="verify-timer"></div>
          <button onclick="resetVerify()" class="w-full px-4 py-2 bg-gray-100 rounded-lg text-sm">다시 요청</button>
        </div>
      </div>

      <div class="bg-white rounded-xl p-6 border border-gray-100">
        <h3 class="font-semibold mb-4"><i class="fas fa-search mr-2 text-indigo-500"></i>인증 상태 확인</h3>
        <div class="space-y-4">
          <div class="flex gap-2">
            <input id="check-phone" class="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="01012345678">
            <button onclick="checkPhoneStatus()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">확인</button>
          </div>
          <div id="phone-status-result"></div>
        </div>
      </div>
    </div>`;
}

let verifyTimerInterval;

async function sendOTP() {
  const phone = document.getElementById('otp-phone').value;
  const purpose = document.getElementById('otp-purpose').value;
  if (!phone) return showToast('핸드폰 번호를 입력하세요.', 'warning');
  const res = await api('POST', '/hr/phone/send-otp', { phone, purpose });
  if (res?.ok) {
    showToast(res.message, 'success');
    document.getElementById('phone-step1').style.display = 'none';
    document.getElementById('phone-step2').style.display = 'block';
    document.getElementById('otp-info').textContent = `${phone}으로 인증번호 발송됨`;
    if (res._dev_otp) {
      const devEl = document.getElementById('otp-dev');
      devEl.classList.remove('hidden');
      devEl.innerHTML = `<i class="fas fa-bug mr-1"></i>개발모드 OTP: <strong>${res._dev_otp}</strong>`;
    }
    // 타이머
    let sec = 180;
    clearInterval(verifyTimerInterval);
    verifyTimerInterval = setInterval(() => {
      sec--;
      document.getElementById('verify-timer').textContent = `남은 시간: ${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
      if (sec <= 0) { clearInterval(verifyTimerInterval); document.getElementById('verify-timer').textContent = '시간 만료'; }
    }, 1000);
  } else showToast(res?.error || '발송 실패', 'error');
}

async function verifyOTP() {
  const phone = document.getElementById('otp-phone').value;
  const otp_code = document.getElementById('otp-code').value;
  const purpose = document.getElementById('otp-purpose').value;
  const res = await api('POST', '/hr/phone/verify-otp', { phone, otp_code, purpose });
  if (res?.verified) { showToast('인증 성공!', 'success'); clearInterval(verifyTimerInterval); }
  else showToast(res?.error || '인증 실패', 'error');
}

function resetVerify() {
  clearInterval(verifyTimerInterval);
  document.getElementById('phone-step1').style.display = 'block';
  document.getElementById('phone-step2').style.display = 'none';
}

async function checkPhoneStatus() {
  const phone = document.getElementById('check-phone').value;
  if (!phone) return;
  const res = await api('GET', `/hr/phone/status?phone=${encodeURIComponent(phone)}`);
  const el = document.getElementById('phone-status-result');
  if (res) {
    el.innerHTML = `
      <div class="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
        <div><span class="text-gray-500">전화번호:</span> ${res.phone}</div>
        <div><span class="text-gray-500">인증기록:</span> ${res.has_verified_record ? '<span class="text-green-600 font-bold">있음</span>' : '<span class="text-gray-400">없음</span>'}</div>
        <div><span class="text-gray-500">최종인증:</span> ${res.last_verified_at ? formatDate(res.last_verified_at) : '-'}</div>
        ${res.registered_user ? `<div><span class="text-gray-500">등록사용자:</span> ${res.registered_user.name} (ID:${res.registered_user.user_id}) · 폰인증: ${res.registered_user.phone_verified ? 'Y' : 'N'}</div>` : `<div class="text-gray-400">미등록 번호</div>`}
      </div>`;
  }
}

// ─── HR 사용자 컨텍스트 메뉴 ───
function showHRUserContextMenu(event, user) {
  event.preventDefault();
  const u = typeof user === 'string' ? JSON.parse(user) : user;

  const items = [
    { icon: 'fa-edit', label: '사용자 수정', action: () => showEditUserModal(u.user_id) },
    { icon: 'fa-key', label: 'ID/PW 설정', action: () => showCredentialModal(u.user_id, u.name) },
    { icon: 'fa-undo', label: '비밀번호 초기화', action: () => resetUserPw(u.user_id, u.name) },
    { divider: true },
    { icon: u.status === 'ACTIVE' ? 'fa-ban' : 'fa-check', 
      label: u.status === 'ACTIVE' ? '비활성화' : '활성화',
      danger: u.status === 'ACTIVE',
      action: () => toggleUserStatus(u.user_id, u.status, u.name) },
    { divider: true },
    { icon: 'fa-list', label: '이 사용자의 주문 보기', action: () => { window._orderFilters = { search: u.name }; navigateTo('orders'); } },
    { icon: 'fa-chart-bar', label: '통계에서 확인', action: () => navigateTo('statistics') },
  ];

  showContextMenu(event.clientX, event.clientY, items, { title: `${u.name} (${u.login_id})` });
}

// ─── 대리점(AGENCY) 관리 탭 ───
async function renderHRAgency(el) {
  const res = await api('GET', '/hr/agencies');
  const agencies = res?.agencies || [];

  el.innerHTML = `
    <div class="bg-white rounded-xl p-4 mb-4 border border-gray-100 flex items-center justify-between">
      <div class="text-sm text-gray-600">
        <i class="fas fa-store mr-1 text-teal-500"></i>대리점: <strong>${agencies.length}</strong>개
        <span class="ml-4 text-xs text-gray-400">팀장에게 대리점 권한을 부여하면 하위 팀장을 관리할 수 있습니다.</span>
      </div>
      <button onclick="showPromoteAgencyModal()" class="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700">
        <i class="fas fa-store mr-1"></i>대리점 지정
      </button>
    </div>

    ${agencies.length > 0 ? `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${agencies.map(a => `
        <div class="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 bg-teal-100 rounded-xl flex items-center justify-center">
                <i class="fas fa-store text-teal-600"></i>
              </div>
              <div>
                <div class="font-bold text-gray-800">${a.name}
                  <span class="ml-2 status-badge bg-teal-100 text-teal-700">대리점장</span>
                </div>
                <div class="text-xs text-gray-500">${a.region_name || ''} · ${a.org_name || ''} · ${formatPhone(a.phone)}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-xl font-bold text-purple-600">${a.team_count || 0}</div>
              <div class="text-[10px] text-gray-400">소속 팀장</div>
            </div>
          </div>
          <div class="flex gap-2 border-t pt-3">
            <button onclick="showAgencyDetailModal(${a.user_id}, '${a.name}')" class="flex-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs hover:bg-blue-100">
              <i class="fas fa-eye mr-1"></i>상세/팀장관리
            </button>
            <button onclick="demoteAgency(${a.user_id}, '${a.name}')" class="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs hover:bg-red-100">
              <i class="fas fa-ban mr-1"></i>대리점 해제
            </button>
          </div>
        </div>
      `).join('')}
    </div>
    ` : `
    <div class="bg-white rounded-xl p-12 text-center text-gray-400 border">
      <i class="fas fa-store text-5xl mb-4"></i>
      <p class="text-lg">등록된 대리점이 없습니다</p>
      <p class="text-sm mt-2">팀장에게 대리점 권한을 부여하세요.</p>
    </div>
    `}`;
}

// ─── 대리점 지정 (팀장 → AGENCY_LEADER) ───
async function showPromoteAgencyModal() {
  const leadersRes = await api('GET', '/auth/team-leaders');
  const leaders = leadersRes?.team_leaders || [];

  const content = `
    <div class="space-y-4">
      <p class="text-sm text-gray-600">대리점장으로 지정할 팀장을 선택하세요. 대리점장은 하위 팀장의 주문을 관리할 수 있습니다.</p>
      <div class="space-y-2 max-h-96 overflow-y-auto">
        ${leaders.map(l => `
          <button onclick="promoteToAgency(${l.user_id}, '${l.name}')"
            class="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg hover:bg-teal-50 hover:border-teal-300 border border-gray-200 transition text-left">
            <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <i class="fas fa-user text-green-600"></i>
            </div>
            <div class="flex-1">
              <div class="font-medium">${l.name}</div>
              <div class="text-xs text-gray-500">${l.org_name || ''} · ${formatPhone(l.phone)}</div>
            </div>
            <i class="fas fa-arrow-right text-gray-300"></i>
          </button>
        `).join('')}
        ${leaders.length === 0 ? '<p class="text-center text-gray-400 py-4">팀장이 없습니다</p>' : ''}
      </div>
    </div>`;
  showModal('대리점 지정', content);
}

async function promoteToAgency(userId, name) {
  closeModal();
  showConfirmModal('대리점 지정', `<strong>${name}</strong>님을 대리점장으로 지정하시겠습니까?<br><span class="text-xs text-gray-400">대리점장은 하위 팀장의 주문 관리/검수 권한을 가집니다.</span>`,
    async () => {
      const res = await api('POST', '/hr/agencies/promote', { user_id: userId });
      if (res?.ok) { showToast(res.message || '대리점 지정 완료', 'success'); renderContent(); }
      else showToast(res?.error || '지정 실패', 'error');
    }, '지정', 'bg-teal-600');
}

function demoteAgency(userId, name) {
  showConfirmModal('대리점 해제', `<strong>${name}</strong>님의 대리점 권한을 해제하시겠습니까?<br><span class="text-xs text-red-500">하위 팀장 매핑도 모두 해제됩니다.</span>`,
    async () => {
      const res = await api('POST', '/hr/agencies/demote', { user_id: userId });
      if (res?.ok) { showToast('대리점 해제 완료', 'success'); renderContent(); }
      else showToast(res?.error || '해제 실패', 'error');
    }, '해제', 'bg-red-600');
}

// ─── 대리점 상세 모달 (하위 팀장 관리) ───
async function showAgencyDetailModal(agencyUserId, agencyName) {
  const [detailRes, candidatesRes] = await Promise.all([
    api('GET', `/hr/agencies/${agencyUserId}`),
    api('GET', `/hr/agencies/${agencyUserId}/candidates`),
  ]);
  const teamMembers = detailRes?.team_members || [];
  const candidates = candidatesRes?.candidates || [];

  const content = `
    <div class="space-y-6">
      <div class="bg-teal-50 rounded-xl p-4 border border-teal-200">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 bg-teal-200 rounded-xl flex items-center justify-center">
            <i class="fas fa-store text-teal-600 text-xl"></i>
          </div>
          <div>
            <div class="text-lg font-bold text-teal-800">${agencyName}</div>
            <div class="text-sm text-teal-600">소속 팀장 ${teamMembers.length}명</div>
          </div>
        </div>
      </div>

      <!-- 현재 소속 팀장 -->
      <div>
        <h4 class="font-semibold mb-3"><i class="fas fa-users mr-1 text-purple-500"></i>소속 팀장 (${teamMembers.length}명)</h4>
        ${teamMembers.length > 0 ? `
        <div class="space-y-2">
          ${teamMembers.map(m => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <i class="fas fa-user text-purple-600 text-xs"></i>
                </div>
                <div>
                  <div class="font-medium text-sm">${m.name}</div>
                  <div class="text-xs text-gray-400">${m.org_name} · 활성주문 ${m.active_orders || 0}건</div>
                </div>
              </div>
              <button onclick="removeTeamFromAgency(${agencyUserId}, ${m.user_id}, '${m.name}', '${agencyName}')"
                class="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100">
                <i class="fas fa-times mr-1"></i>제거
              </button>
            </div>
          `).join('')}
        </div>
        ` : '<p class="text-sm text-gray-400 text-center py-4">소속 팀장이 없습니다</p>'}
      </div>

      <!-- 추가 가능한 팀장 -->
      <div>
        <h4 class="font-semibold mb-3"><i class="fas fa-user-plus mr-1 text-green-500"></i>추가 가능한 팀장 (${candidates.length}명)</h4>
        ${candidates.length > 0 ? `
        <div class="space-y-2 max-h-48 overflow-y-auto">
          ${candidates.map(c => `
            <div class="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <i class="fas fa-user text-green-600 text-xs"></i>
                </div>
                <div>
                  <div class="font-medium text-sm">${c.name}</div>
                  <div class="text-xs text-gray-400">${c.org_name} · ${formatPhone(c.phone)}</div>
                </div>
              </div>
              <button onclick="addTeamToAgency(${agencyUserId}, ${c.user_id}, '${c.name}', '${agencyName}')"
                class="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                <i class="fas fa-plus mr-1"></i>추가
              </button>
            </div>
          `).join('')}
        </div>
        ` : '<p class="text-sm text-gray-400 text-center py-4">추가 가능한 팀장이 없습니다</p>'}
      </div>
    </div>`;

  showModal(`대리점 상세 — ${agencyName}`, content, `
    <button onclick="closeModal();renderContent()" class="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">닫기</button>`, { large: true });
}

async function addTeamToAgency(agencyUserId, teamUserId, teamName, agencyName) {
  const res = await api('POST', `/hr/agencies/${agencyUserId}/add-team`, { team_user_id: teamUserId });
  if (res?.ok) {
    showToast(`${teamName}님이 ${agencyName} 대리점에 추가되었습니다.`, 'success');
    closeModal();
    showAgencyDetailModal(agencyUserId, agencyName);
  } else showToast(res?.error || '추가 실패', 'error');
}

async function removeTeamFromAgency(agencyUserId, teamUserId, teamName, agencyName) {
  showConfirmModal('팀장 제거', `<strong>${teamName}</strong>님을 <strong>${agencyName}</strong> 대리점에서 제거하시겠습니까?`,
    async () => {
      const res = await api('POST', `/hr/agencies/${agencyUserId}/remove-team`, { team_user_id: teamUserId });
      if (res?.ok) {
        showToast('제거 완료', 'success');
        closeModal();
        showAgencyDetailModal(agencyUserId, agencyName);
      } else showToast(res?.error || '제거 실패', 'error');
    }, '제거', 'bg-red-600');
}
