// ============================================================
// 다하다 OMS - 코어 프레임워크 v2.1
// 모듈별 분리 구조: app.js (코어) + pages/*.js (페이지별)
// ============================================================

const API = '/api';
let currentUser = null;
let sessionId = localStorage.getItem('session_id') || '';

// ─── API 헬퍼 ───
async function api(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (sessionId) opts.headers['X-Session-Id'] = sessionId;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  if (res.headers.get('Content-Type')?.includes('text/csv')) return res;
  const data = await res.json();
  if (res.status === 401 && !path.includes('/login')) { logout(); return null; }
  return { ...data, _status: res.status };
}

// ─── 상태 매핑 ───
const STATUS = {
  RECEIVED: { label: '수신', color: 'bg-gray-100 text-gray-700', icon: 'fa-inbox' },
  VALIDATED: { label: '유효성통과', color: 'bg-blue-100 text-blue-700', icon: 'fa-check-circle' },
  DISTRIBUTION_PENDING: { label: '배분대기', color: 'bg-yellow-100 text-yellow-700', icon: 'fa-clock' },
  DISTRIBUTED: { label: '배분완료', color: 'bg-indigo-100 text-indigo-700', icon: 'fa-share-nodes' },
  ASSIGNED: { label: '배정완료', color: 'bg-purple-100 text-purple-700', icon: 'fa-user-check' },
  IN_PROGRESS: { label: '작업중', color: 'bg-orange-100 text-orange-700', icon: 'fa-wrench' },
  SUBMITTED: { label: '보고서제출', color: 'bg-cyan-100 text-cyan-700', icon: 'fa-file-lines' },
  REGION_APPROVED: { label: '지역승인', color: 'bg-lime-100 text-lime-700', icon: 'fa-thumbs-up' },
  REGION_REJECTED: { label: '지역반려', color: 'bg-red-100 text-red-700', icon: 'fa-thumbs-down' },
  HQ_APPROVED: { label: 'HQ승인', color: 'bg-green-100 text-green-700', icon: 'fa-circle-check' },
  HQ_REJECTED: { label: 'HQ반려', color: 'bg-red-100 text-red-700', icon: 'fa-circle-xmark' },
  SETTLEMENT_CONFIRMED: { label: '정산확정', color: 'bg-emerald-100 text-emerald-700', icon: 'fa-coins' },
  PAID: { label: '지급완료', color: 'bg-teal-100 text-teal-700', icon: 'fa-money-check' },
};

function statusBadge(status) {
  const s = STATUS[status] || { label: status, color: 'bg-gray-100 text-gray-600', icon: 'fa-question' };
  return `<span class="status-badge ${s.color}"><i class="fas ${s.icon} mr-1"></i>${s.label}</span>`;
}

function formatAmount(v) { return v != null ? Number(v).toLocaleString('ko-KR') + '원' : '-'; }
function formatDate(d) { return d ? d.replace('T', ' ').substring(0, 16) : '-'; }
function formatPhone(phone) {
  if (!phone) return '-';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  return phone;
}

// ─── 로그인 ───
async function login(loginId, password) {
  const res = await api('POST', '/auth/login', { login_id: loginId, password });
  if (res?._status === 200) {
    currentUser = res.user;
    sessionId = res.session_id;
    localStorage.setItem('session_id', sessionId);
    render();
  } else {
    showToast(res?.error || '로그인 실패', 'error');
  }
}

function logout() {
  api('POST', '/auth/logout');
  currentUser = null;
  sessionId = '';
  localStorage.removeItem('session_id');
  render();
}

async function checkAuth() {
  if (!sessionId) return;
  const res = await api('GET', '/auth/me');
  if (res?._status === 200) currentUser = res.user;
  else { sessionId = ''; localStorage.removeItem('session_id'); }
}

// ─── 토스트 ───
function showToast(msg, type = 'info') {
  const colors = { info: 'bg-blue-500', success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500 text-gray-900' };
  const icons = { info: 'fa-info-circle', success: 'fa-check-circle', error: 'fa-exclamation-triangle', warning: 'fa-exclamation-circle' };
  const el = document.createElement('div');
  el.className = `fixed top-4 right-4 z-[60] px-6 py-3 rounded-lg text-white shadow-xl ${colors[type]} fade-in`;
  el.innerHTML = `<i class="fas ${icons[type]} mr-2"></i>${msg}`;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ─── 모달 시스템 (강화) ───
function showModal(title, content, actions = '', options = {}) {
  closeModal(); // 기존 모달 제거
  const sizeClass = options.large ? 'max-w-4xl' : options.xlarge ? 'max-w-6xl' : 'max-w-2xl';
  const html = `
    <div id="modal-overlay" class="fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()">
      <div class="bg-white rounded-2xl shadow-2xl ${sizeClass} w-full max-h-[85vh] flex flex-col fade-in">
        <div class="flex items-center justify-between px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
          <h3 class="text-lg font-bold text-gray-800">${title}</h3>
          <button onclick="closeModal()" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition"><i class="fas fa-times"></i></button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-5">${content}</div>
        ${actions ? `<div class="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">${actions}</div>` : ''}
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}
function closeModal() { document.getElementById('modal-overlay')?.remove(); }

// ─── 확인 모달 ───
function showConfirmModal(title, message, onConfirm, confirmText = '확인', confirmColor = 'bg-blue-600') {
  const content = `<div class="text-center py-4"><p class="text-gray-600">${message}</p></div>`;
  const actions = `
    <button onclick="closeModal()" class="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">취소</button>
    <button onclick="closeModal();(${onConfirm.toString()})()" class="px-5 py-2.5 ${confirmColor} text-white rounded-lg text-sm hover:opacity-90">${confirmText}</button>
  `;
  showModal(title, content, actions);
}

// ─── 라우팅 ───
let currentPage = 'dashboard';
function navigateTo(page) { currentPage = page; renderContent(); }

// ─── 메인 렌더 ───
function render() {
  const app = document.getElementById('app');
  if (!currentUser) { app.innerHTML = renderLoginPage(); return; }
  app.innerHTML = renderLayout();
  renderContent();
}

function renderLoginPage() {
  return `
  <div class="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center">
    <div class="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md fade-in">
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-cubes text-white text-2xl"></i>
        </div>
        <h1 class="text-2xl font-bold text-gray-800">다하다 OMS</h1>
        <p class="text-gray-500 mt-1">주문관리시스템 v2.1</p>
      </div>
      <form onsubmit="event.preventDefault();login(document.getElementById('lid').value,document.getElementById('lpw').value)">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">아이디</label>
          <input id="lid" type="text" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="admin" value="admin" required>
        </div>
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
          <input id="lpw" type="password" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="admin123" value="admin123" required>
        </div>
        <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
          <i class="fas fa-sign-in-alt mr-2"></i>로그인
        </button>
      </form>
      <div class="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
        <p class="font-semibold mb-2 text-gray-700">테스트 계정:</p>
        <p><span class="font-medium text-blue-600">HQ관리자:</span> admin / admin123</p>
        <p><span class="font-medium text-purple-600">서울파트장:</span> seoul_admin / admin123</p>
        <p><span class="font-medium text-purple-600">경기파트장:</span> gyeonggi_admin / admin123</p>
        <p><span class="font-medium text-purple-600">인천파트장:</span> incheon_admin / admin123</p>
        <p><span class="font-medium text-purple-600">부산파트장:</span> busan_admin / admin123</p>
        <p><span class="font-medium text-green-600">서울팀장:</span> leader_seoul_1 / admin123</p>
      </div>
    </div>
  </div>`;
}

function renderLayout() {
  const isHQ = currentUser.org_type === 'HQ';
  const isRegion = currentUser.org_type === 'REGION' && currentUser.roles.includes('REGION_ADMIN');
  const isLeader = currentUser.roles.includes('TEAM_LEADER');

  let menuItems = [];
  if (isHQ || currentUser.roles.includes('SUPER_ADMIN')) {
    menuItems = [
      { id: 'dashboard', icon: 'fa-chart-pie', label: '대시보드' },
      { id: 'orders', icon: 'fa-list-check', label: '주문관리' },
      { id: 'distribute', icon: 'fa-share-nodes', label: '자동배분' },
      { id: 'review-hq', icon: 'fa-clipboard-check', label: 'HQ검수' },
      { id: 'settlement', icon: 'fa-coins', label: '정산관리' },
      { id: 'reconciliation', icon: 'fa-scale-balanced', label: '대사(정합성)' },
      { id: 'statistics', icon: 'fa-chart-bar', label: '통계' },
      { id: 'hr-management', icon: 'fa-users-gear', label: '인사관리' },
      { id: 'policies', icon: 'fa-gears', label: '정책관리' },
    ];
  } else if (isRegion) {
    menuItems = [
      { id: 'dashboard', icon: 'fa-chart-pie', label: '대시보드' },
      { id: 'kanban', icon: 'fa-columns', label: '칸반(팀장배정)' },
      { id: 'review-region', icon: 'fa-clipboard-check', label: '1차검수' },
      { id: 'hr-management', icon: 'fa-users-gear', label: '인사/수수료' },
      { id: 'statistics', icon: 'fa-chart-bar', label: '통계' },
    ];
  } else if (isLeader) {
    menuItems = [
      { id: 'my-orders', icon: 'fa-list', label: '내 주문' },
      { id: 'my-stats', icon: 'fa-chart-line', label: '내 현황' },
    ];
  }

  const orgBadge = isHQ ? 'bg-blue-100 text-blue-700' : isRegion ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700';

  return `
  <div class="flex h-screen">
    <aside class="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
      <div class="p-5 border-b">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <i class="fas fa-cubes text-white"></i>
          </div>
          <div>
            <div class="font-bold text-gray-800">다하다 OMS</div>
            <div class="text-xs text-gray-400">v2.1</div>
          </div>
        </div>
      </div>
      <nav class="flex-1 p-3 overflow-y-auto">
        ${menuItems.map(m => `
          <button onclick="navigateTo('${m.id}')" class="sidebar-item w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-600 ${currentPage === m.id ? 'active' : ''}">
            <i class="fas ${m.icon} w-5 text-center"></i><span>${m.label}</span>
          </button>
        `).join('')}
      </nav>
      <div class="p-4 border-t">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center"><i class="fas fa-user text-gray-500"></i></div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-gray-800 truncate">${currentUser.name}</div>
            <div class="flex items-center gap-1 mt-0.5">
              <span class="text-[10px] px-1.5 py-0.5 rounded ${orgBadge}">${currentUser.org_name || currentUser.org_type}</span>
              <span class="text-[10px] text-gray-400">${currentUser.roles[0]}</span>
            </div>
          </div>
        </div>
        <button onclick="logout()" class="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition">
          <i class="fas fa-sign-out-alt"></i>로그아웃
        </button>
      </div>
    </aside>
    <main class="flex-1 overflow-y-auto bg-gray-50">
      <div id="content" class="p-6"></div>
    </main>
  </div>`;
}

// ─── 로딩 표시 ───
function showLoading(el) {
  el.innerHTML = '<div class="flex items-center justify-center h-64"><div class="pulse text-gray-400"><i class="fas fa-spinner fa-spin text-3xl"></i><p class="mt-3">로딩 중...</p></div></div>';
}

// ─── 페이지 렌더링 (모듈별 분기) ───
async function renderContent() {
  const el = document.getElementById('content');
  if (!el) return;
  showLoading(el);
  
  switch (currentPage) {
    case 'dashboard': await renderDashboard(el); break;
    case 'orders': await renderOrders(el); break;
    case 'distribute': await renderDistribute(el); break;
    case 'review-hq': await renderReviewHQ(el); break;
    case 'review-region': await renderReviewRegion(el); break;
    case 'settlement': await renderSettlement(el); break;
    case 'reconciliation': await renderReconciliation(el); break;
    case 'statistics': await renderStatistics(el); break;
    case 'policies': await renderPolicies(el); break;
    case 'kanban': await renderKanban(el); break;
    case 'hr-management': await renderHRManagement(el); break;
    case 'my-orders': await renderMyOrders(el); break;
    case 'my-stats': await renderMyStats(el); break;
    default: el.innerHTML = '<p>페이지를 찾을 수 없습니다.</p>';
  }
}

// ─── 초기화 ───
(async () => {
  await checkAuth();
  render();
})();
