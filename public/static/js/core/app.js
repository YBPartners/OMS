// ============================================================
// 와이비 OMS — App Bootstrap v9.0
// 메인 렌더링, 레이아웃, 초기화
// v9.0: 모바일 반응형 (바텀네비, 햄버거, 풀투리프레시, 스와이프)
// ============================================================

// ─── 모바일 감지 ───
function isMobile() { return window.innerWidth <= 768; }

// ─── 메인 렌더 ───
function render() {
  const app = document.getElementById('app');
  if (!currentUser) {
    stopNotificationPolling();
    if (window.location.hash === '#signup') { app.innerHTML = ''; openSignupWizard(); return; }
    app.innerHTML = renderLoginPage(); return;
  }
  
  const hash = window.location.hash.replace('#', '');
  if (hash === 'signup') { window.location.hash = ''; }
  if (hash && hash !== 'signup' && hasPermission(hash)) { currentPage = hash; }
  else if (!hasPermission(currentPage)) {
    const isAgency = currentUser.is_agency === true;
    const isLeader = currentUser.roles.includes('TEAM_LEADER');
    currentPage = isAgency ? 'agency-dashboard' : 'dashboard';
  }
  
  app.innerHTML = renderLayout();
  renderContent();
  startNotificationPolling();
  if (isMobile()) initPullToRefresh();
}

function renderLoginPage() {
  return `
  <div class="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl p-8 sm:p-10 w-full max-w-md fade-in">
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <i class="fas fa-cubes text-white text-2xl"></i>
        </div>
        <h1 class="text-2xl font-bold text-gray-800">와이비 OMS</h1>
        <p class="text-gray-500 mt-1">주문관리시스템 v9.0</p>
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
      <div class="mt-4 text-center">
        <button onclick="window.location.hash='signup';render()" class="text-sm text-teal-600 hover:text-teal-700 font-medium hover:underline">
          <i class="fas fa-user-plus mr-1"></i>팀장 가입 신청
        </button>
      </div>
      <div class="mt-4 p-4 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
        <p class="font-semibold mb-2 text-gray-700"><i class="fas fa-info-circle mr-1"></i>테스트 계정:</p>
        <div class="grid grid-cols-2 gap-x-4">
          <p><span class="font-medium text-blue-600">HQ관리자:</span> admin / admin123</p>
          <p><span class="font-medium text-purple-600">서울파트장:</span> seoul_admin / admin123</p>
          <p><span class="font-medium text-purple-600">경기파트장:</span> gyeonggi_admin / admin123</p>
          <p><span class="font-medium text-purple-600">인천파트장:</span> incheon_admin / admin123</p>
          <p><span class="font-medium text-purple-600">부산파트장:</span> busan_admin / admin123</p>
          <p><span class="font-medium text-green-600">서울팀장:</span> leader_seoul_1 / admin123</p>
          <p><span class="font-medium text-teal-600">대리점장:</span> leader_seoul_1 / admin123</p>
        </div>
      </div>
    </div>
  </div>`;
}

// ─── 바텀네비 메뉴 선정 (역할별 주요 4개 + 더보기) ───
function getBottomNavItems(menuKey) {
  const configs = {
    HQ: [
      { id: 'dashboard', icon: 'fa-chart-pie', label: '대시보드' },
      { id: 'orders', icon: 'fa-list-check', label: '주문' },
      { id: 'review-hq', icon: 'fa-clipboard-check', label: '검수' },
      { id: 'statistics', icon: 'fa-chart-bar', label: '통계' },
    ],
    REGION: [
      { id: 'dashboard', icon: 'fa-chart-pie', label: '대시보드' },
      { id: 'kanban', icon: 'fa-columns', label: '칸반' },
      { id: 'review-region', icon: 'fa-clipboard-check', label: '검수' },
      { id: 'statistics', icon: 'fa-chart-bar', label: '통계' },
    ],
    AGENCY: [
      { id: 'agency-dashboard', icon: 'fa-store', label: '현황' },
      { id: 'agency-orders', icon: 'fa-list-check', label: '주문' },
      { id: 'kanban', icon: 'fa-columns', label: '칸반' },
      { id: 'my-orders', icon: 'fa-list', label: '내주문' },
    ],
    TEAM_LEADER: [
      { id: 'dashboard', icon: 'fa-chart-pie', label: '대시보드' },
      { id: 'my-orders', icon: 'fa-list', label: '내주문' },
      { id: 'my-stats', icon: 'fa-chart-line', label: '현황' },
      { id: 'notifications', icon: 'fa-bell', label: '알림' },
    ],
  };
  return configs[menuKey] || configs.HQ;
}

function renderLayout() {
  const isHQ = currentUser.org_type === 'HQ';
  const isRegion = currentUser.org_type === 'REGION' && currentUser.roles.includes('REGION_ADMIN');
  const isTeam = currentUser.org_type === 'TEAM';
  const isLeader = currentUser.roles.includes('TEAM_LEADER');
  const isAgency = currentUser.is_agency === true;

  let menuKey = isAgency ? 'AGENCY' : (isTeam || isLeader) ? 'TEAM_LEADER' : isRegion ? 'REGION' : 'HQ';
  const menuItems = OMS.MENU_ITEMS[menuKey] || [];

  const orgBadge = isAgency ? 'bg-teal-100 text-teal-700' : isHQ ? 'bg-blue-100 text-blue-700' : isRegion ? 'bg-purple-100 text-purple-700' : isTeam ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700';
  const roleLabel = OMS.ROLE_LABELS || {};

  // ─── 사이드바 메뉴 HTML (데스크탑) ───
  let lastGroup = '';
  const menuHtml = menuItems.map(m => {
    let groupHeader = '';
    if (m.group !== lastGroup) {
      lastGroup = m.group;
      groupHeader = `<div class="px-4 pt-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">${m.group}</div>`;
    }
    const badge = m.id === 'notifications' ? `<span id="notif-menu-badge" class="ml-auto min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ${_notifUnreadCount > 0 ? '' : 'hidden'}">${_notifUnreadCount}</span>` : '';
    return `${groupHeader}
      <button data-page="${m.id}" onclick="navigateTo('${m.id}')" class="sidebar-item w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-gray-600 ${currentPage === m.id ? 'active' : ''}">
        <i class="fas ${m.icon} w-5 text-center"></i><span>${m.label}</span>${badge}
      </button>`;
  }).join('');

  // ─── 바텀네비 HTML (모바일) ───
  const bottomItems = getBottomNavItems(menuKey);
  const bottomNavHtml = bottomItems.map(item => {
    const isActive = currentPage === item.id;
    const notifBadge = item.id === 'notifications' && _notifUnreadCount > 0 
      ? `<span class="nav-badge">${_notifUnreadCount > 99 ? '99+' : _notifUnreadCount}</span>` : '';
    return `<button class="bottom-nav-item ${isActive ? 'active' : ''}" onclick="navigateTo('${item.id}');updateBottomNav()">
      <i class="fas ${item.icon}"></i>${notifBadge}<span>${item.label}</span>
    </button>`;
  }).join('');

  // 더보기 버튼
  const moreBtn = `<button class="bottom-nav-item ${!bottomItems.some(b => b.id === currentPage) && currentPage !== 'my-profile' ? 'active' : ''}" onclick="openMobileMoreMenu()">
    <i class="fas fa-bars"></i><span>더보기</span>
  </button>`;

  // 페이지 타이틀 찾기
  const curMenu = menuItems.find(m => m.id === currentPage);
  const pageTitle = curMenu ? curMenu.label : '와이비 OMS';

  return `
  <div class="layout-root flex h-screen">
    <!-- 데스크탑 사이드바 -->
    <aside class="desktop-sidebar w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
      <div class="p-5 border-b">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <i class="fas fa-cubes text-white"></i>
          </div>
          <div>
            <div class="font-bold text-gray-800">와이비 OMS</div>
            <div class="text-xs text-gray-400">v14.0 · ${menuKey}</div>
          </div>
        </div>
      </div>
      <nav class="flex-1 p-3 overflow-y-auto">
        <button onclick="showGlobalSearchModal()" class="w-full flex items-center gap-3 px-4 py-2.5 mb-2 rounded-lg text-sm text-gray-400 bg-gray-50 hover:bg-gray-100 transition border border-gray-200">
          <i class="fas fa-search w-5 text-center"></i><span class="flex-1 text-left">검색...</span>
          <kbd class="px-1.5 py-0.5 bg-white text-gray-400 rounded text-[10px] font-mono border">⌘K</kbd>
        </button>
        ${menuHtml}</nav>
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
          <div class="relative">${getNotifBellHtml()}</div>
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

    <!-- 모바일 헤더 -->
    <div class="mobile-header" style="display:none">
      <div class="logo"><i class="fas fa-cubes"></i></div>
      <div class="title">${pageTitle}</div>
      <div class="header-actions">
        <button class="header-btn" onclick="showGlobalSearchModal()" aria-label="검색">
          <i class="fas fa-search"></i>
        </button>
        <button class="header-btn" onclick="toggleNotifDropdown()" aria-label="알림">
          <i class="fas fa-bell"></i>
          ${_notifUnreadCount > 0 ? `<span style="position:absolute;top:4px;right:4px;width:8px;height:8px;background:#ef4444;border-radius:50%;border:2px solid white;"></span>` : ''}
        </button>
      </div>
    </div>

    <!-- 메인 컨텐츠 -->
    <main class="main-content flex-1 overflow-y-auto bg-gray-50">
      <div id="content" class="p-6"></div>
    </main>

    <!-- 바텀 네비게이션 (모바일) -->
    <nav class="bottom-nav" id="bottom-nav" style="display:none">
      <div class="bottom-nav-inner">
        ${bottomNavHtml}
        ${moreBtn}
      </div>
    </nav>
  </div>`;
}

// ─── 바텀네비 상태 갱신 ───
function updateBottomNav() {
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    // 더보기 버튼 제외
    if (btn.querySelector('.fa-bars')) return;
    const onclick = btn.getAttribute('onclick') || '';
    const match = onclick.match(/navigateTo\('([^']+)'\)/);
    if (match) btn.classList.toggle('active', match[1] === currentPage);
  });
  // 모바일 헤더 타이틀 갱신
  const titleEl = document.querySelector('.mobile-header .title');
  if (titleEl) {
    const isAgency = currentUser.is_agency === true;
    const isLeader = currentUser.roles.includes('TEAM_LEADER');
    const isRegion = currentUser.org_type === 'REGION' && currentUser.roles.includes('REGION_ADMIN');
    const menuKey = isAgency ? 'AGENCY' : (currentUser.org_type === 'TEAM' || isLeader) ? 'TEAM_LEADER' : isRegion ? 'REGION' : 'HQ';
    const menuItems = OMS.MENU_ITEMS[menuKey] || [];
    const cur = menuItems.find(m => m.id === currentPage);
    titleEl.textContent = cur ? cur.label : '와이비 OMS';
  }
}

// ─── 더보기 메뉴 (모바일) ───
function openMobileMoreMenu() {
  const isAgency = currentUser.is_agency === true;
  const isLeader = currentUser.roles.includes('TEAM_LEADER');
  const isRegion = currentUser.org_type === 'REGION' && currentUser.roles.includes('REGION_ADMIN');
  const menuKey = isAgency ? 'AGENCY' : (currentUser.org_type === 'TEAM' || isLeader) ? 'TEAM_LEADER' : isRegion ? 'REGION' : 'HQ';
  const menuItems = OMS.MENU_ITEMS[menuKey] || [];
  const roleLabel = OMS.ROLE_LABELS || {};
  const orgBadge = isAgency ? 'bg-teal-100 text-teal-700' : currentUser.org_type === 'HQ' ? 'bg-blue-100 text-blue-700' : isRegion ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700';

  let lastGroup = '';
  const menuHtml = menuItems.map(m => {
    let groupLabel = '';
    if (m.group !== lastGroup) {
      lastGroup = m.group;
      groupLabel = `<div class="menu-group-label">${m.group}</div>`;
    }
    return `${groupLabel}<button class="more-menu-item ${currentPage === m.id ? 'active' : ''}" onclick="closeMobileMoreMenu();navigateTo('${m.id}');updateBottomNav()">
      <i class="fas ${m.icon}"></i><span>${m.label}</span>
    </button>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.className = 'mobile-more-menu';
  overlay.id = 'mobile-more-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeMobileMoreMenu(); };
  overlay.innerHTML = `
    <div class="mobile-more-panel" onclick="event.stopPropagation()">
      <div class="drag-handle"></div>
      ${menuHtml}
      <div class="user-section">
        <div class="avatar"><i class="fas fa-user"></i></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600;color:#1f2937">${currentUser.name}</div>
          <div style="display:flex;align-items:center;gap:4px;margin-top:2px">
            <span class="text-[10px] px-1.5 py-0.5 rounded ${orgBadge}">${currentUser.org_name || currentUser.org_type}</span>
            <span style="font-size:10px;color:#9ca3af">${roleLabel[currentUser.roles[0]] || currentUser.roles[0]}</span>
          </div>
        </div>
      </div>
      <div class="user-actions">
        <button onclick="closeMobileMoreMenu();navigateTo('my-profile')"><i class="fas fa-key"></i> 프로필</button>
        <button class="logout-btn" onclick="closeMobileMoreMenu();logout()"><i class="fas fa-sign-out-alt"></i> 로그아웃</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function closeMobileMoreMenu() {
  const overlay = document.getElementById('mobile-more-overlay');
  if (overlay) overlay.remove();
}

// ─── 풀투리프레시 ───
function initPullToRefresh() {
  const main = document.querySelector('.main-content');
  if (!main || main._ptrInit) return;
  main._ptrInit = true;

  let startY = 0, pulling = false, indicator = null;

  main.addEventListener('touchstart', (e) => {
    if (main.scrollTop <= 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  main.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 30 && main.scrollTop <= 0) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'ptr-indicator';
        indicator.innerHTML = '<i class="fas fa-arrow-rotate-right"></i>';
        document.body.appendChild(indicator);
      }
      indicator.classList.add('active');
      if (dy > 80) indicator.style.transform = `translateX(-50%) translateY(${Math.min(dy * 0.4, 60)}px)`;
    }
  }, { passive: true });

  main.addEventListener('touchend', () => {
    if (indicator && indicator.classList.contains('active')) {
      indicator.classList.add('refreshing');
      renderContent();
      setTimeout(() => {
        if (indicator) { indicator.remove(); indicator = null; }
      }, 600);
    } else if (indicator) {
      indicator.remove(); indicator = null;
    }
    pulling = false;
  }, { passive: true });
}

// ─── 해시 라우팅 ───
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'signup' && !currentUser) { render(); return; }
  if (hash && currentUser && hasPermission(hash)) {
    currentPage = hash;
    renderContent();
    if (isMobile()) { updateBottomNav(); closeMobileMoreMenu(); }
  }
});

// ─── 리사이즈 대응 ───
let _prevMobile = null;
window.addEventListener('resize', () => {
  const m = isMobile();
  if (_prevMobile !== null && _prevMobile !== m) render();
  _prevMobile = m;
});

// ─── 초기화 ───
(async () => {
  _prevMobile = isMobile();
  await checkAuth();
  render();
})();
