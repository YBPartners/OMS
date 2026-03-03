// ============================================================
// 다하다 OMS — App Bootstrap v3.0
// 메인 렌더링, 레이아웃, 초기화 (최종 로드)
// ============================================================

// ─── 메인 렌더 ───
function render() {
  const app = document.getElementById('app');
  if (!currentUser) { app.innerHTML = renderLoginPage(); return; }
  
  // 기본 페이지 설정 (첫 접근 가능한 페이지)
  const hash = window.location.hash.replace('#', '');
  if (hash && hasPermission(hash)) { currentPage = hash; }
  else if (!hasPermission(currentPage)) {
    const isHQ = currentUser.org_type === 'HQ';
    const isLeader = currentUser.roles.includes('TEAM_LEADER');
    currentPage = isLeader ? 'my-orders' : 'dashboard';
  }
  
  app.innerHTML = renderLayout();
  renderContent();
}

function renderLoginPage() {
  return `
  <div class="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md fade-in">
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <i class="fas fa-cubes text-white text-2xl"></i>
        </div>
        <h1 class="text-2xl font-bold text-gray-800">다하다 OMS</h1>
        <p class="text-gray-500 mt-1">주문관리시스템 v3.0</p>
      </div>
      <form onsubmit="event.preventDefault();login(document.getElementById('lid').value,document.getElementById('lpw').value)">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1"><i class="fas fa-user mr-1 text-gray-400"></i>아이디</label>
          <input id="lid" type="text" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="admin" value="admin" required>
        </div>
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1"><i class="fas fa-lock mr-1 text-gray-400"></i>비밀번호</label>
          <input id="lpw" type="password" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="admin123" value="admin123" required>
        </div>
        <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition shadow-md hover:shadow-lg">
          <i class="fas fa-sign-in-alt mr-2"></i>로그인
        </button>
      </form>
      <div class="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
        <p class="font-semibold mb-2 text-gray-700"><i class="fas fa-info-circle mr-1"></i>테스트 계정:</p>
        <div class="grid grid-cols-2 gap-x-4">
          <p><span class="font-medium text-blue-600">HQ관리자:</span> admin / admin123</p>
          <p><span class="font-medium text-purple-600">서울파트장:</span> seoul_admin / admin123</p>
          <p><span class="font-medium text-purple-600">경기파트장:</span> gyeonggi_admin / admin123</p>
          <p><span class="font-medium text-purple-600">인천파트장:</span> incheon_admin / admin123</p>
          <p><span class="font-medium text-purple-600">부산파트장:</span> busan_admin / admin123</p>
          <p><span class="font-medium text-green-600">서울팀장:</span> leader_seoul_1 / admin123</p>
        </div>
      </div>
    </div>
  </div>`;
}

function renderLayout() {
  const isHQ = currentUser.org_type === 'HQ';
  const isRegion = currentUser.org_type === 'REGION' && currentUser.roles.includes('REGION_ADMIN');
  const isLeader = currentUser.roles.includes('TEAM_LEADER');

  let menuKey = isLeader ? 'TEAM_LEADER' : isRegion ? 'REGION' : 'HQ';
  const menuItems = OMS.MENU_ITEMS[menuKey] || [];

  const orgBadge = isHQ ? 'bg-blue-100 text-blue-700' : isRegion ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700';
  const roleLabel = { SUPER_ADMIN: '총괄관리자', HQ_OPERATOR: 'HQ운영자', REGION_ADMIN: '파트장', TEAM_LEADER: '팀장', AUDITOR: '감사' };

  // 그룹별 메뉴
  let lastGroup = '';
  const menuHtml = menuItems.map(m => {
    let groupHeader = '';
    if (m.group !== lastGroup) {
      lastGroup = m.group;
      groupHeader = `<div class="px-4 pt-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">${m.group}</div>`;
    }
    return `${groupHeader}
      <button data-page="${m.id}" onclick="navigateTo('${m.id}')" class="sidebar-item w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-gray-600 ${currentPage === m.id ? 'active' : ''}">
        <i class="fas ${m.icon} w-5 text-center"></i><span>${m.label}</span>
      </button>`;
  }).join('');

  return `
  <div class="flex h-screen">
    <aside class="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
      <div class="p-5 border-b">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <i class="fas fa-cubes text-white"></i>
          </div>
          <div>
            <div class="font-bold text-gray-800">다하다 OMS</div>
            <div class="text-xs text-gray-400">v3.0 · ${menuKey}</div>
          </div>
        </div>
      </div>
      <nav class="flex-1 p-3 overflow-y-auto">${menuHtml}</nav>
      <div class="p-4 border-t">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-9 h-9 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center shadow">
            <i class="fas fa-user text-white text-sm"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-gray-800 truncate">${currentUser.name}</div>
            <div class="flex items-center gap-1 mt-0.5">
              <span class="text-[10px] px-1.5 py-0.5 rounded ${orgBadge}">${currentUser.org_name || currentUser.org_type}</span>
              <span class="text-[10px] text-gray-400">${roleLabel[currentUser.roles[0]] || currentUser.roles[0]}</span>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <button onclick="navigateTo('my-profile')" class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 rounded-lg transition" title="비밀번호 변경">
            <i class="fas fa-key"></i><span>프로필</span>
          </button>
          <button onclick="logout()" class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition">
            <i class="fas fa-sign-out-alt"></i><span>로그아웃</span>
          </button>
        </div>
      </div>
    </aside>
    <main class="flex-1 overflow-y-auto bg-gray-50">
      <div id="content" class="p-6"></div>
    </main>
  </div>`;
}

// ─── 해시 라우팅 ───
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '');
  if (hash && currentUser && hasPermission(hash)) {
    currentPage = hash;
    renderContent();
  }
});

// ─── 초기화 ───
(async () => {
  await checkAuth();
  render();
})();
