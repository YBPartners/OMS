// ============================================================
// Airflow OMS — Core Auth & Routing Module v7.0
// 인증, 권한, 라우팅, 레이아웃
// v7.0: AGENCY_LEADER 라우팅 지원
// ============================================================

window.OMS = window.OMS || {};

let currentUser = null;
let currentPage = 'dashboard';

// ─── 로그인 ───
async function login(loginId, password) {
  const res = await api('POST', '/auth/login', { login_id: loginId, password });
  if (res?._status === 200) {
    currentUser = res.user;
    setSessionId(res.session_id);
    if (typeof startGlobalNotifPolling === 'function') startGlobalNotifPolling();
    if (typeof preloadCriticalPages === 'function') preloadCriticalPages();
    render();
  } else {
    showToast(res?.error || '로그인 실패', 'error');
  }
}

function logout() {
  api('POST', '/auth/logout');
  currentUser = null;
  setSessionId('');
  if (typeof stopGlobalNotifPolling === 'function') stopGlobalNotifPolling();
  if (typeof stopDashboardPolling === 'function') stopDashboardPolling();
  render();
}

async function checkAuth() {
  if (!getSessionId()) return;
  const res = await api('GET', '/auth/me');
  if (res?._status === 200) currentUser = res.user;
  else { setSessionId(''); }
}

// ─── 권한 체크 ───
function hasPermission(page) {
  if (!currentUser) return false;
  const roles = currentUser.roles || [];
  for (const role of roles) {
    if (OMS.PERMISSIONS[role]?.includes(page)) return true;
  }
  return false;
}

function canEdit(entity) {
  if (!currentUser) return false;
  const roles = currentUser.roles || [];
  if (roles.includes('SUPER_ADMIN')) return true;
  switch (entity) {
    case 'order': return roles.some(r => ['HQ_OPERATOR', 'SUPER_ADMIN'].includes(r));
    case 'user': return roles.some(r => ['HQ_OPERATOR', 'REGION_ADMIN', 'SUPER_ADMIN'].includes(r));
    case 'commission': return roles.some(r => ['HQ_OPERATOR', 'REGION_ADMIN', 'SUPER_ADMIN'].includes(r));
    case 'organization': return roles.includes('SUPER_ADMIN');
    case 'policy': return roles.some(r => ['HQ_OPERATOR', 'SUPER_ADMIN'].includes(r));
    case 'agency': return roles.some(r => ['HQ_OPERATOR', 'REGION_ADMIN', 'SUPER_ADMIN'].includes(r));
    case 'admin': return roles.includes('SUPER_ADMIN');
    default: return false;
  }
}

// ─── 대리점 여부 확인 ───
function isAgencyLeader() {
  return currentUser && currentUser.is_agency === true;
}

// ─── 라우팅 ───
function navigateTo(page) {
  if (!hasPermission(page)) { showToast('접근 권한이 없습니다.', 'error'); return; }
  currentPage = page;
  renderContent();
  history.pushState(null, '', `#${page}`);
}

// ─── 페이지 렌더링 (모듈별 분기, 지연 로딩 지원) ───
async function renderContent() {
  const el = document.getElementById('content');
  if (!el) return;
  showLoading(el);
  
  document.querySelectorAll('.sidebar-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === currentPage);
  });
  
  try {
    // 대시보드 폴링 관리
    if (typeof stopDashboardPolling === 'function') stopDashboardPolling();
    // 배너 자동재생 정리
    if (typeof stopAllBannerAutoplay === 'function') stopAllBannerAutoplay();
    
    // ★ 지연 로딩: 해당 페이지 스크립트를 동적으로 로드
    if (typeof loadPageScripts === 'function') {
      // 알림 모듈은 항상 필요 (뱃지 폴링)
      await loadPageScripts('notifications');
      await loadPageScripts(currentPage);
    }
    
    switch (currentPage) {
      case 'dashboard': 
        await renderDashboard(el); 
        if (typeof startDashboardPolling === 'function') startDashboardPolling();
        break;
      case 'orders': await renderOrders(el); break;
      case 'distribute': await renderDistribute(el); break;
      case 'channels': await renderChannels(el); break;
      case 'review-hq': await renderReviewHQ(el); break;
      case 'review-region': await renderReviewRegion(el); break;
      case 'settlement': await renderSettlement(el); break;
      case 'reconciliation': await renderReconciliation(el); break;
      case 'statistics': await renderStatistics(el); break;
      case 'policies': await renderPolicies(el); break;
      case 'kanban': await renderKanban(el); break;
      case 'hr-management': await renderHRManagement(el); break;
      case 'audit-log': await renderAuditLog(el); break;
      case 'notifications': await renderNotifications(el); break;
      case 'my-orders': await renderMyOrders(el); break;
      case 'my-stats': await renderMyStats(el); break;
      case 'my-profile': await renderMyProfile(el); break;
      // v7.0: 대리점 전용 페이지
      case 'agency-dashboard': await renderAgencyDashboard(el); break;
      case 'agency-orders': await renderAgencyOrders(el); break;
      case 'agency-team': await renderAgencyTeam(el); break;
      case 'agency-statement': await renderAgencyStatement(); break;
      // v13.0: 시스템 관리
      case 'system-admin': await renderSystemAdmin(el); break;
      // v22.0: 배너/광고 관리
      case 'banner-manage': await renderBannerManage(el); break;
      default: el.innerHTML = '<div class="text-center py-16 text-gray-400"><i class="fas fa-compass text-5xl mb-4"></i><p class="text-lg">페이지를 찾을 수 없습니다.</p></div>';
    }
  } catch (err) {
    console.error('[Render Error]', currentPage, err);
    el.innerHTML = `<div class="text-center py-16 text-red-400"><i class="fas fa-exclamation-triangle text-5xl mb-4"></i><p class="text-lg">페이지 로드 중 오류 발생</p><p class="text-sm mt-2">${err.message}</p><button onclick="renderContent()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"><i class="fas fa-redo mr-1"></i>다시 시도</button></div>`;
  }
}
