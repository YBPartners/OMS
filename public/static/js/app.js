// ============================================================
// 다하다 OMS - 프론트엔드 애플리케이션 v1.0
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
  const colors = { info: 'bg-blue-500', success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500' };
  const el = document.createElement('div');
  el.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg text-white shadow-lg ${colors[type]} fade-in`;
  el.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info-circle'} mr-2"></i>${msg}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ─── 모달 ───
function showModal(title, content, actions = '') {
  const html = `
    <div id="modal-overlay" class="fixed inset-0 z-40 modal-overlay flex items-center justify-center" onclick="if(event.target===this)closeModal()">
      <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto fade-in">
        <div class="flex items-center justify-between p-5 border-b">
          <h3 class="text-lg font-bold text-gray-800">${title}</h3>
          <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
        </div>
        <div class="p-5">${content}</div>
        ${actions ? `<div class="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">${actions}</div>` : ''}
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}
function closeModal() { document.getElementById('modal-overlay')?.remove(); }

// ─── 라우팅 ───
let currentPage = 'dashboard';
function navigateTo(page) { currentPage = page; renderContent(); }

// ─── 메인 렌더 ───
function render() {
  const app = document.getElementById('app');
  if (!currentUser) {
    app.innerHTML = renderLoginPage();
    return;
  }
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
        <p class="text-gray-500 mt-1">주문관리시스템 v1.0</p>
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
      <div class="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500">
        <p class="font-semibold mb-1">테스트 계정:</p>
        <p>HQ관리자: admin / admin123</p>
        <p>서울법인: seoul_admin / admin123</p>
        <p>팀장: leader_seoul_1 / admin123</p>
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
      { id: 'distribute', icon: 'fa-share-nodes', label: '배분관리' },
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
      { id: 'kanban', icon: 'fa-columns', label: '칸반(배정)' },
      { id: 'review-region', icon: 'fa-clipboard-check', label: '1차검수' },
      { id: 'hr-management', icon: 'fa-users-gear', label: '팀장관리' },
      { id: 'statistics', icon: 'fa-chart-bar', label: '통계' },
    ];
  } else if (isLeader) {
    menuItems = [
      { id: 'my-orders', icon: 'fa-list', label: '내 주문' },
      { id: 'my-stats', icon: 'fa-chart-line', label: '내 현황' },
    ];
  }

  return `
  <div class="flex h-screen">
    <!-- Sidebar -->
    <aside class="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
      <div class="p-5 border-b">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <i class="fas fa-cubes text-white"></i>
          </div>
          <div>
            <div class="font-bold text-gray-800">다하다 OMS</div>
            <div class="text-xs text-gray-400">v1.0</div>
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
          <div class="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center">
            <i class="fas fa-user text-gray-500"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-gray-800 truncate">${currentUser.name}</div>
            <div class="text-xs text-gray-400">${currentUser.roles.join(', ')}</div>
          </div>
        </div>
        <button onclick="logout()" class="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition">
          <i class="fas fa-sign-out-alt"></i>로그아웃
        </button>
      </div>
    </aside>
    <!-- Main -->
    <main class="flex-1 overflow-y-auto bg-gray-50">
      <div id="content" class="p-6"></div>
    </main>
  </div>`;
}

// ─── 페이지 렌더링 ───
async function renderContent() {
  const el = document.getElementById('content');
  if (!el) return;
  el.innerHTML = '<div class="flex items-center justify-center h-64"><div class="pulse text-gray-400"><i class="fas fa-spinner fa-spin text-3xl"></i><p class="mt-3">로딩 중...</p></div></div>';
  
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

// ════════════════════════════════════════════
// 대시보드
// ════════════════════════════════════════════
async function renderDashboard(el) {
  const [dashRes, funnelRes] = await Promise.all([
    api('GET', '/stats/dashboard'),
    api('GET', '/orders/stats/funnel'),
  ]);
  if (!dashRes || !funnelRes) return;

  const d = dashRes.today || {};
  const cards = [
    { label: '총 주문', value: d.total || 0, icon: 'fa-boxes-stacked', color: 'blue' },
    { label: '오늘 수신', value: dashRes.today_received || 0, icon: 'fa-inbox', color: 'indigo' },
    { label: '검수 대기', value: dashRes.pending_review || 0, icon: 'fa-clipboard-list', color: 'amber' },
    { label: 'HQ검수 대기', value: dashRes.pending_hq_review || 0, icon: 'fa-shield-halved', color: 'orange' },
    { label: 'HQ 승인', value: d.hq_approved || 0, icon: 'fa-circle-check', color: 'green' },
    { label: '정산 확정', value: d.settlement_confirmed || 0, icon: 'fa-coins', color: 'emerald' },
    { label: '반려', value: d.rejected || 0, icon: 'fa-ban', color: 'red' },
    { label: '총 금액', value: formatAmount(d.total_amount), icon: 'fa-won-sign', color: 'purple', isText: true },
  ];

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-chart-pie mr-2 text-blue-600"></i>대시보드</h2>
      
      <!-- 카드 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        ${cards.map(c => `
          <div class="card bg-white rounded-xl p-5 border border-gray-100">
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-medium text-gray-500 uppercase">${c.label}</span>
              <div class="w-8 h-8 bg-${c.color}-100 rounded-lg flex items-center justify-center">
                <i class="fas ${c.icon} text-${c.color}-600 text-sm"></i>
              </div>
            </div>
            <div class="text-${c.isText ? 'lg' : '2xl'} font-bold text-gray-800">${c.value}</div>
          </div>
        `).join('')}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- 퍼널 -->
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <h3 class="text-lg font-semibold mb-4"><i class="fas fa-filter mr-2 text-blue-500"></i>주문 처리 퍼널</h3>
          <div class="space-y-2">
            ${(funnelRes.funnel || []).map(f => {
              const max = Math.max(...(funnelRes.funnel || []).map(x => x.count));
              const pct = max > 0 ? (f.count / max * 100) : 0;
              const s = STATUS[f.status] || { label: f.status, color: 'bg-gray-100 text-gray-600' };
              return `
                <div class="flex items-center gap-3">
                  <div class="w-24 text-xs text-gray-600 text-right">${s.label}</div>
                  <div class="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div class="h-full ${s.color.replace('text-', 'bg-').replace('100', '400')} rounded-full flex items-center justify-end pr-2 transition-all" style="width:${Math.max(pct, 8)}%">
                      <span class="text-xs font-bold text-white">${f.count}</span>
                    </div>
                  </div>
                  <div class="w-20 text-xs text-gray-500 text-right">${formatAmount(f.total_amount)}</div>
                </div>`;
            }).join('')}
          </div>
        </div>
        
        <!-- 지역별 요약 -->
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <h3 class="text-lg font-semibold mb-4"><i class="fas fa-building mr-2 text-indigo-500"></i>지역법인별 현황</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr class="border-b text-gray-500">
                <th class="py-2 text-left">지역법인</th><th class="py-2 text-right">진행중</th><th class="py-2 text-right">검수대기</th><th class="py-2 text-right">정산대기</th><th class="py-2 text-right">정산완료</th>
              </tr></thead>
              <tbody>
                ${(dashRes.region_summary || []).map(r => `
                  <tr class="border-b hover:bg-gray-50">
                    <td class="py-2 font-medium">${r.region_name}</td>
                    <td class="py-2 text-right text-blue-600">${r.active_orders}</td>
                    <td class="py-2 text-right text-amber-600">${r.pending_review}</td>
                    <td class="py-2 text-right text-green-600">${r.ready_for_settlement}</td>
                    <td class="py-2 text-right text-emerald-600">${r.settled}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 미해결 대사 이슈 -->
      ${(dashRes.recent_issues && dashRes.recent_issues.length > 0) ? `
      <div class="bg-white rounded-xl p-6 border border-gray-100">
        <h3 class="text-lg font-semibold mb-4"><i class="fas fa-exclamation-triangle mr-2 text-amber-500"></i>미해결 대사 이슈</h3>
        <div class="flex flex-wrap gap-3">
          ${dashRes.recent_issues.map(i => `
            <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-${i.severity === 'CRITICAL' ? 'red' : i.severity === 'HIGH' ? 'orange' : 'yellow'}-50 text-sm">
              <span class="font-medium text-${i.severity === 'CRITICAL' ? 'red' : i.severity === 'HIGH' ? 'orange' : 'yellow'}-700">${i.type}</span>
              <span class="bg-white px-2 py-0.5 rounded text-xs font-bold">${i.cnt}건</span>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
    </div>`;
}

// ════════════════════════════════════════════
// 주문 관리
// ════════════════════════════════════════════
async function renderOrders(el) {
  const params = new URLSearchParams(window._orderFilters || {});
  if (!params.has('limit')) params.set('limit', '15');
  const res = await api('GET', `/orders?${params.toString()}`);
  if (!res) return;

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-list-check mr-2 text-blue-600"></i>주문관리</h2>
        <div class="flex gap-2">
          <button onclick="showImportModal()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"><i class="fas fa-file-import mr-1"></i>일괄 수신</button>
          <button onclick="showNewOrderModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>수동 등록</button>
        </div>
      </div>
      
      <!-- 필터 -->
      <div class="bg-white rounded-xl p-4 mb-4 border border-gray-100 flex flex-wrap gap-3 items-end">
        <div>
          <label class="block text-xs text-gray-500 mb-1">상태</label>
          <select id="f-status" class="border rounded-lg px-3 py-2 text-sm" onchange="applyOrderFilter()">
            <option value="">전체</option>
            ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${params.get('status') === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">검색</label>
          <input id="f-search" class="border rounded-lg px-3 py-2 text-sm w-48" placeholder="고객명/주소/주문번호" value="${params.get('search') || ''}" onkeypress="if(event.key==='Enter')applyOrderFilter()">
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">시작일</label>
          <input id="f-from" type="date" class="border rounded-lg px-3 py-2 text-sm" value="${params.get('from') || ''}">
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">종료일</label>
          <input id="f-to" type="date" class="border rounded-lg px-3 py-2 text-sm" value="${params.get('to') || ''}">
        </div>
        <button onclick="applyOrderFilter()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"><i class="fas fa-search mr-1"></i>조회</button>
      </div>

      <!-- 테이블 -->
      <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-600">
              <tr>
                <th class="px-4 py-3 text-left">ID</th>
                <th class="px-4 py-3 text-left">주문번호</th>
                <th class="px-4 py-3 text-left">고객명</th>
                <th class="px-4 py-3 text-left">주소</th>
                <th class="px-4 py-3 text-right">금액</th>
                <th class="px-4 py-3 text-left">지역법인</th>
                <th class="px-4 py-3 text-left">팀장</th>
                <th class="px-4 py-3 text-center">상태</th>
                <th class="px-4 py-3 text-left">요청일</th>
                <th class="px-4 py-3 text-center">상세</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${(res.orders || []).map(o => `
                <tr class="hover:bg-gray-50 cursor-pointer" onclick="showOrderDetail(${o.order_id})">
                  <td class="px-4 py-3 text-gray-500">${o.order_id}</td>
                  <td class="px-4 py-3 font-mono text-xs">${o.external_order_no || '<span class="text-gray-400">미확정</span>'}</td>
                  <td class="px-4 py-3 font-medium">${o.customer_name || '-'}</td>
                  <td class="px-4 py-3 text-gray-600 max-w-[200px] truncate">${o.address_text || '-'}</td>
                  <td class="px-4 py-3 text-right font-medium">${formatAmount(o.base_amount)}</td>
                  <td class="px-4 py-3">${o.region_name || '<span class="text-gray-400">-</span>'}</td>
                  <td class="px-4 py-3">${o.team_leader_name || '<span class="text-gray-400">-</span>'}</td>
                  <td class="px-4 py-3 text-center">${statusBadge(o.status)}</td>
                  <td class="px-4 py-3 text-gray-500 text-xs">${o.requested_date || '-'}</td>
                  <td class="px-4 py-3 text-center"><i class="fas fa-chevron-right text-gray-400"></i></td>
                </tr>
              `).join('')}
              ${(res.orders || []).length === 0 ? '<tr><td colspan="10" class="px-4 py-8 text-center text-gray-400">데이터가 없습니다.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
          <span>총 ${res.total}건 중 ${(res.orders || []).length}건 표시</span>
          <div class="flex gap-2">
            ${Number(res.page) > 1 ? `<button onclick="window._orderFilters={...window._orderFilters||{},page:${Number(res.page)-1}};renderContent()" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">이전</button>` : ''}
            <span class="px-3 py-1">${res.page} / ${Math.ceil(res.total / Number(res.limit)) || 1}</span>
            ${Number(res.page) < Math.ceil(res.total / Number(res.limit)) ? `<button onclick="window._orderFilters={...window._orderFilters||{},page:${Number(res.page)+1}};renderContent()" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">다음</button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
}

function applyOrderFilter() {
  window._orderFilters = {
    status: document.getElementById('f-status')?.value || '',
    search: document.getElementById('f-search')?.value || '',
    from: document.getElementById('f-from')?.value || '',
    to: document.getElementById('f-to')?.value || '',
    page: 1,
  };
  Object.keys(window._orderFilters).forEach(k => { if (!window._orderFilters[k]) delete window._orderFilters[k]; });
  renderContent();
}

// ─── 주문 상세 모달 ───
async function showOrderDetail(orderId) {
  const res = await api('GET', `/orders/${orderId}`);
  if (!res?.order) return;
  const o = res.order;

  const content = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div><label class="text-xs text-gray-500">주문ID</label><div class="font-mono">${o.order_id}</div></div>
        <div><label class="text-xs text-gray-500">외부주문번호</label><div class="font-mono">${o.external_order_no || '미확정'}</div></div>
        <div><label class="text-xs text-gray-500">고객명</label><div class="font-medium">${o.customer_name || '-'}</div></div>
        <div><label class="text-xs text-gray-500">연락처</label><div>${o.customer_phone || '-'}</div></div>
        <div class="col-span-2"><label class="text-xs text-gray-500">주소</label><div>${o.address_text}</div></div>
        <div><label class="text-xs text-gray-500">행정동코드</label><div class="font-mono text-xs">${o.admin_dong_code || '-'}</div></div>
        <div><label class="text-xs text-gray-500">금액</label><div class="font-bold text-blue-600">${formatAmount(o.base_amount)}</div></div>
        <div><label class="text-xs text-gray-500">상태</label><div>${statusBadge(o.status)}</div></div>
        <div><label class="text-xs text-gray-500">지역법인</label><div>${o.region_name || '-'}</div></div>
        <div><label class="text-xs text-gray-500">배정팀장</label><div>${o.team_leader_name || '-'}</div></div>
        <div><label class="text-xs text-gray-500">요청일</label><div>${o.requested_date || '-'}</div></div>
      </div>
      
      ${res.reports?.length > 0 ? `
      <div class="border-t pt-4">
        <h4 class="font-semibold mb-2"><i class="fas fa-file-lines mr-1"></i>보고서 (v${res.reports[0].version})</h4>
        <div class="bg-gray-50 rounded-lg p-3 text-sm">
          <div><span class="text-gray-500">제출일:</span> ${formatDate(res.reports[0].submitted_at)}</div>
          <div><span class="text-gray-500">메모:</span> ${res.reports[0].note || '-'}</div>
          <div><span class="text-gray-500">체크리스트:</span> ${Object.entries(JSON.parse(res.reports[0].checklist_json || '{}')).map(([k,v]) => `<span class="${v ? 'text-green-600' : 'text-red-600'}">${k}: ${v ? '✓' : '✗'}</span>`).join(', ')}</div>
        </div>
      </div>` : ''}

      ${res.reviews?.length > 0 ? `
      <div class="border-t pt-4">
        <h4 class="font-semibold mb-2"><i class="fas fa-clipboard-check mr-1"></i>검수 이력</h4>
        <div class="space-y-2">
          ${res.reviews.map(r => `
            <div class="bg-gray-50 rounded-lg p-3 text-sm flex items-center justify-between">
              <div>
                <span class="font-medium">${r.stage === 'REGION' ? '지역 1차' : 'HQ 2차'}</span>
                <span class="ml-2 ${r.result === 'APPROVE' ? 'text-green-600' : 'text-red-600'}">${r.result === 'APPROVE' ? '승인' : '반려'}</span>
              </div>
              <div class="text-gray-500 text-xs">${r.reviewer_name} · ${formatDate(r.reviewed_at)}</div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      ${res.history?.length > 0 ? `
      <div class="border-t pt-4">
        <h4 class="font-semibold mb-2"><i class="fas fa-clock-rotate-left mr-1"></i>상태 이력</h4>
        <div class="space-y-1 max-h-40 overflow-y-auto">
          ${res.history.map(h => `
            <div class="flex items-center gap-2 text-xs text-gray-600">
              <span class="text-gray-400">${formatDate(h.created_at)}</span>
              <span>${statusBadge(h.from_status || 'NEW')}</span>→<span>${statusBadge(h.to_status)}</span>
              <span class="text-gray-400">${h.actor_name || ''}</span>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
    </div>`;
  showModal(`주문 상세 #${o.order_id}`, content);
}

// ─── 수동 등록 모달 ───
function showNewOrderModal() {
  const content = `
    <form id="new-order-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-xs text-gray-500 mb-1">외부주문번호</label><input name="external_order_no" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="AJD-2026-XXXX"></div>
        <div><label class="block text-xs text-gray-500 mb-1">서비스유형</label><input name="service_type" value="DEFAULT" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">고객명 *</label><input name="customer_name" required class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">연락처</label><input name="customer_phone" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div class="col-span-2"><label class="block text-xs text-gray-500 mb-1">주소 *</label><input name="address_text" required class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">행정동코드</label><input name="admin_dong_code" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="1168010100"></div>
        <div><label class="block text-xs text-gray-500 mb-1">금액 *</label><input name="base_amount" type="number" required class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">요청일</label><input name="requested_date" type="date" value="${new Date().toISOString().split('T')[0]}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
      </div>
    </form>`;
  showModal('주문 수동 등록', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitNewOrder()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">등록</button>
  `);
}

async function submitNewOrder() {
  const form = document.getElementById('new-order-form');
  const data = Object.fromEntries(new FormData(form));
  data.base_amount = Number(data.base_amount);
  const res = await api('POST', '/orders', data);
  if (res?._status === 201) { showToast('주문이 등록되었습니다.', 'success'); closeModal(); renderContent(); }
  else showToast(res?.error || res?.warning || '등록 실패', 'error');
}

// ─── 일괄 수신 모달 ───
function showImportModal() {
  const content = `
    <div class="space-y-4">
      <p class="text-sm text-gray-600">JSON 형태로 주문 데이터를 입력하세요. 실제 운영에서는 CSV/XLSX 파싱이 구현됩니다.</p>
      <textarea id="import-data" rows="8" class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder='{"orders":[{"customer_name":"테스트","address_text":"서울특별시 강남구 역삼동 100","admin_dong_code":"1168010100","base_amount":100000,"requested_date":"2026-03-03"}]}'></textarea>
    </div>`;
  showModal('주문 일괄 수신', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitImport()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">수신 실행</button>
  `);
}

async function submitImport() {
  try {
    const data = JSON.parse(document.getElementById('import-data').value);
    const res = await api('POST', '/orders/import', data);
    if (res?.batch_id) {
      showToast(`배치 #${res.batch_id}: 성공 ${res.success}건, 실패 ${res.fail}건`, res.fail > 0 ? 'warning' : 'success');
      closeModal(); renderContent();
    } else showToast(res?.error || '수신 실패', 'error');
  } catch (e) { showToast('JSON 파싱 오류', 'error'); }
}

// ════════════════════════════════════════════
// 배분 관리
// ════════════════════════════════════════════
async function renderDistribute(el) {
  const pendingRes = await api('GET', '/orders?status=VALIDATED&limit=100');
  const dpRes = await api('GET', '/orders?status=DISTRIBUTION_PENDING&limit=100');
  
  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-share-nodes mr-2 text-indigo-600"></i>배분관리</h2>
        <button onclick="executeDistribute()" class="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
          <i class="fas fa-play mr-2"></i>자동 배분 실행
        </button>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <h3 class="font-semibold mb-4"><i class="fas fa-hourglass-half mr-2 text-blue-500"></i>유효성 통과 (배분 대상) — ${(pendingRes?.orders || []).length}건</h3>
          <div class="space-y-2 max-h-96 overflow-y-auto">
            ${(pendingRes?.orders || []).map(o => `
              <div class="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <span class="text-xs text-gray-500">#${o.order_id}</span>
                  <span class="ml-2 font-medium">${o.customer_name || '-'}</span>
                  <div class="text-xs text-gray-500">${o.address_text?.substring(0, 30) || '-'}</div>
                </div>
                <span class="text-sm font-medium">${formatAmount(o.base_amount)}</span>
              </div>
            `).join('')}
            ${(pendingRes?.orders || []).length === 0 ? '<p class="text-gray-400 text-sm text-center py-8">배분 대상 없음</p>' : ''}
          </div>
        </div>
        
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <h3 class="font-semibold mb-4"><i class="fas fa-exclamation-triangle mr-2 text-amber-500"></i>배분 보류 (수동 필요) — ${(dpRes?.orders || []).length}건</h3>
          <div class="space-y-2 max-h-96 overflow-y-auto">
            ${(dpRes?.orders || []).map(o => `
              <div class="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div>
                  <span class="text-xs text-gray-500">#${o.order_id}</span>
                  <span class="ml-2 font-medium">${o.customer_name || '-'}</span>
                  <div class="text-xs text-gray-500">${o.address_text?.substring(0, 30) || '-'} <span class="text-red-500">행정동 매칭 실패</span></div>
                </div>
                <button onclick="showManualDistribute(${o.order_id})" class="px-3 py-1 bg-amber-100 text-amber-700 rounded text-xs hover:bg-amber-200">수동배분</button>
              </div>
            `).join('')}
            ${(dpRes?.orders || []).length === 0 ? '<p class="text-gray-400 text-sm text-center py-8">보류 건 없음</p>' : ''}
          </div>
        </div>
      </div>
    </div>`;
}

async function executeDistribute() {
  const res = await api('POST', '/orders/distribute');
  if (res) {
    showToast(`배분 완료: ${res.distributed}건 배분, ${res.pending}건 보류`, 'success');
    renderContent();
  }
}

async function showManualDistribute(orderId) {
  const orgsRes = await api('GET', '/auth/organizations');
  const regions = (orgsRes?.organizations || []).filter(o => o.org_type === 'REGION');
  const content = `
    <select id="manual-region" class="w-full border rounded-lg px-3 py-2 text-sm">
      ${regions.map(r => `<option value="${r.org_id}">${r.name}</option>`).join('')}
    </select>`;
  showModal('수동 배분', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitManualDistribute(${orderId})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">배분</button>
  `);
}

async function submitManualDistribute(orderId) {
  const regionOrgId = Number(document.getElementById('manual-region').value);
  const res = await api('PATCH', `/orders/${orderId}/distribution`, { region_org_id: regionOrgId });
  if (res?.ok) { showToast('수동 배분 완료', 'success'); closeModal(); renderContent(); }
}

// ════════════════════════════════════════════
// HQ 검수
// ════════════════════════════════════════════
async function renderReviewHQ(el) {
  const res = await api('GET', '/orders?status=REGION_APPROVED&limit=50');
  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-shield-halved mr-2 text-green-600"></i>HQ 최종 검수 — ${(res?.orders || []).length}건</h2>
      <div class="space-y-3">
        ${(res?.orders || []).map(o => `
          <div class="bg-white rounded-xl p-5 border border-gray-100 flex items-center gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-1">
                <span class="text-xs text-gray-500">#${o.order_id}</span>
                <span class="font-medium">${o.customer_name || '-'}</span>
                <span class="text-sm text-gray-500">${o.external_order_no || '번호미확정'}</span>
              </div>
              <div class="text-sm text-gray-500">${o.address_text || '-'}</div>
              <div class="text-sm mt-1">
                <span class="text-blue-600 font-medium">${formatAmount(o.base_amount)}</span>
                <span class="mx-2">·</span><span>${o.region_name || '-'}</span>
                <span class="mx-2">·</span><span>${o.team_leader_name || '-'}</span>
              </div>
            </div>
            <div class="flex gap-2">
              <button onclick="showOrderDetail(${o.order_id})" class="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"><i class="fas fa-eye mr-1"></i>상세</button>
              <button onclick="submitHQReview(${o.order_id},'APPROVE')" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"><i class="fas fa-check mr-1"></i>승인</button>
              <button onclick="promptHQReject(${o.order_id})" class="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200"><i class="fas fa-times mr-1"></i>반려</button>
            </div>
          </div>
        `).join('')}
        ${(res?.orders || []).length === 0 ? '<div class="bg-white rounded-xl p-12 text-center text-gray-400 border"><i class="fas fa-check-double text-4xl mb-3"></i><p>검수 대기 건이 없습니다.</p></div>' : ''}
      </div>
    </div>`;
}

async function submitHQReview(orderId, result, comment = '') {
  const res = await api('POST', `/orders/${orderId}/review/hq`, { result, comment });
  if (res?.ok) { showToast(`HQ ${result === 'APPROVE' ? '승인' : '반려'} 완료`, 'success'); renderContent(); }
  else showToast(res?.error || '검수 실패', 'error');
}

function promptHQReject(orderId) {
  const content = `<textarea id="reject-comment" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="반려 사유를 입력하세요"></textarea>`;
  showModal('HQ 반려 사유', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitHQReview(${orderId},'REJECT',document.getElementById('reject-comment').value);closeModal()" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">반려 확정</button>
  `);
}

// ════════════════════════════════════════════
// REGION 1차 검수
// ════════════════════════════════════════════
async function renderReviewRegion(el) {
  const res = await api('GET', '/orders?status=SUBMITTED&limit=50');
  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-clipboard-check mr-2 text-cyan-600"></i>지역 1차 검수 — ${(res?.orders || []).length}건</h2>
      <div class="space-y-3">
        ${(res?.orders || []).map(o => `
          <div class="bg-white rounded-xl p-5 border border-gray-100 flex items-center gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-1">
                <span class="text-xs text-gray-500">#${o.order_id}</span>
                <span class="font-medium">${o.customer_name || '-'}</span>
              </div>
              <div class="text-sm text-gray-500">${o.address_text || '-'}</div>
              <div class="text-sm mt-1">
                <span class="text-blue-600 font-medium">${formatAmount(o.base_amount)}</span>
                <span class="mx-2">·</span><span>팀장: ${o.team_leader_name || '-'}</span>
              </div>
            </div>
            <div class="flex gap-2">
              <button onclick="showOrderDetail(${o.order_id})" class="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"><i class="fas fa-eye mr-1"></i>상세</button>
              <button onclick="submitRegionReview(${o.order_id},'APPROVE')" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"><i class="fas fa-check mr-1"></i>승인</button>
              <button onclick="promptRegionReject(${o.order_id})" class="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200"><i class="fas fa-times mr-1"></i>반려</button>
            </div>
          </div>
        `).join('')}
        ${(res?.orders || []).length === 0 ? '<div class="bg-white rounded-xl p-12 text-center text-gray-400 border"><i class="fas fa-check-double text-4xl mb-3"></i><p>검수 대기 건이 없습니다.</p></div>' : ''}
      </div>
    </div>`;
}

async function submitRegionReview(orderId, result, comment = '') {
  const res = await api('POST', `/orders/${orderId}/review/region`, { result, comment });
  if (res?.ok) { showToast(`지역 ${result === 'APPROVE' ? '승인' : '반려'} 완료`, 'success'); renderContent(); }
  else showToast(res?.error || '검수 실패', 'error');
}

function promptRegionReject(orderId) {
  const content = `<textarea id="region-reject-comment" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="반려 사유를 입력하세요"></textarea>`;
  showModal('지역 반려 사유', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitRegionReview(${orderId},'REJECT',document.getElementById('region-reject-comment').value);closeModal()" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">반려 확정</button>
  `);
}

// ════════════════════════════════════════════
// 정산 관리
// ════════════════════════════════════════════
async function renderSettlement(el) {
  const runsRes = await api('GET', '/settlements/runs');
  const ledgerRes = await api('GET', '/settlements/ledger');

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-coins mr-2 text-emerald-600"></i>정산관리</h2>
        <button onclick="showNewRunModal()" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"><i class="fas fa-plus mr-1"></i>정산 Run 생성</button>
      </div>

      <!-- 정산 Run 목록 -->
      <div class="bg-white rounded-xl border border-gray-100 overflow-hidden mb-6">
        <div class="px-5 py-3 bg-gray-50 border-b font-medium text-sm">정산 Run 목록</div>
        <table class="w-full text-sm">
          <thead class="text-gray-500 text-xs"><tr>
            <th class="px-4 py-3 text-left">Run ID</th><th class="px-4 py-3 text-left">유형</th><th class="px-4 py-3 text-left">기간</th>
            <th class="px-4 py-3 text-right">건수</th><th class="px-4 py-3 text-right">기본금액</th><th class="px-4 py-3 text-right">수수료</th><th class="px-4 py-3 text-right">지급액</th>
            <th class="px-4 py-3 text-center">상태</th><th class="px-4 py-3 text-center">액션</th>
          </tr></thead>
          <tbody class="divide-y">
            ${(runsRes?.runs || []).map(r => `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3">#${r.run_id}</td>
                <td class="px-4 py-3"><span class="px-2 py-0.5 bg-blue-50 rounded text-xs font-medium">${r.period_type}</span></td>
                <td class="px-4 py-3 text-xs">${r.period_start} ~ ${r.period_end}</td>
                <td class="px-4 py-3 text-right">${r.total_count || 0}</td>
                <td class="px-4 py-3 text-right">${formatAmount(r.total_base_amount)}</td>
                <td class="px-4 py-3 text-right text-red-500">${formatAmount(r.total_commission_amount)}</td>
                <td class="px-4 py-3 text-right text-green-600 font-medium">${formatAmount(r.total_payable_amount)}</td>
                <td class="px-4 py-3 text-center"><span class="status-badge ${r.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : r.status === 'CALCULATED' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}">${r.status}</span></td>
                <td class="px-4 py-3 text-center flex gap-1 justify-center">
                  ${r.status === 'DRAFT' ? `<button onclick="calculateRun(${r.run_id})" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">산출</button>` : ''}
                  ${r.status === 'CALCULATED' ? `<button onclick="confirmRun(${r.run_id})" class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">확정</button>` : ''}
                  <button onclick="showRunDetails(${r.run_id})" class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200">상세</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- 원장 -->
      <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div class="px-5 py-3 bg-gray-50 border-b font-medium text-sm">팀장별 일자별 원장 (최근)</div>
        <table class="w-full text-sm">
          <thead class="text-gray-500 text-xs"><tr>
            <th class="px-4 py-3 text-left">일자</th><th class="px-4 py-3 text-left">팀장</th><th class="px-4 py-3 text-right">확정건수</th><th class="px-4 py-3 text-right">확정지급합계</th>
          </tr></thead>
          <tbody class="divide-y">
            ${(ledgerRes?.ledger || []).map(l => `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3">${l.date}</td>
                <td class="px-4 py-3 font-medium">${l.team_leader_name}</td>
                <td class="px-4 py-3 text-right">${l.confirmed_count}</td>
                <td class="px-4 py-3 text-right text-green-600 font-bold">${formatAmount(l.confirmed_payable_sum)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function showNewRunModal() {
  const today = new Date().toISOString().split('T')[0];
  const content = `
    <div class="space-y-4">
      <div><label class="block text-xs text-gray-500 mb-1">유형</label>
        <select id="run-type" class="w-full border rounded-lg px-3 py-2 text-sm">
          <option value="WEEKLY">주정산</option><option value="MONTHLY">월정산</option>
        </select></div>
      <div><label class="block text-xs text-gray-500 mb-1">시작일</label><input id="run-start" type="date" value="${today}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-xs text-gray-500 mb-1">종료일</label><input id="run-end" type="date" value="${today}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
    </div>`;
  showModal('정산 Run 생성', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="createRun()" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">생성</button>
  `);
}

async function createRun() {
  const data = {
    period_type: document.getElementById('run-type').value,
    period_start: document.getElementById('run-start').value,
    period_end: document.getElementById('run-end').value,
  };
  const res = await api('POST', '/settlements/runs', data);
  if (res?._status === 201) { showToast('정산 Run 생성', 'success'); closeModal(); renderContent(); }
}

async function calculateRun(runId) {
  const res = await api('POST', `/settlements/runs/${runId}/calculate`);
  if (res?.total_orders !== undefined) { showToast(`산출 완료: ${res.total_orders}건, 지급합계: ${formatAmount(res.total_payable_amount)}`, 'success'); renderContent(); }
  else showToast(res?.error || '산출 실패', 'error');
}

async function confirmRun(runId) {
  if (!confirm('정산을 확정하시겠습니까? 확정 후 원장에 반영됩니다.')) return;
  const res = await api('POST', `/settlements/runs/${runId}/confirm`);
  if (res?.ok) { showToast(`정산 확정 완료 (${res.confirmed_count}건)`, 'success'); renderContent(); }
  else showToast(res?.error || '확정 실패', 'error');
}

async function showRunDetails(runId) {
  const res = await api('GET', `/settlements/runs/${runId}/details`);
  if (!res?.run) return;
  const content = `
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead><tr class="text-gray-500 border-b">
          <th class="py-2 text-left">주문ID</th><th class="py-2 text-left">고객</th><th class="py-2 text-left">팀장</th>
          <th class="py-2 text-right">기본액</th><th class="py-2 text-center">수수료</th><th class="py-2 text-right">지급액</th><th class="py-2 text-center">상태</th>
        </tr></thead>
        <tbody class="divide-y">
          ${(res.settlements || []).map(s => `
            <tr><td class="py-2">#${s.order_id}</td><td class="py-2">${s.customer_name || '-'}</td><td class="py-2">${s.team_leader_name}</td>
            <td class="py-2 text-right">${formatAmount(s.base_amount)}</td>
            <td class="py-2 text-center">${s.commission_mode === 'FIXED' ? formatAmount(s.commission_rate) : s.commission_rate + '%'} → ${formatAmount(s.commission_amount)}</td>
            <td class="py-2 text-right font-bold text-green-600">${formatAmount(s.payable_amount)}</td>
            <td class="py-2 text-center">${statusBadge(s.status)}</td></tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  showModal(`정산 Run #${runId} 상세`, content);
}

// ════════════════════════════════════════════
// 대사(정합성)
// ════════════════════════════════════════════
async function renderReconciliation(el) {
  const runsRes = await api('GET', '/reconciliation/runs');
  const issuesRes = await api('GET', '/reconciliation/issues?resolved=false&limit=30');

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-scale-balanced mr-2 text-amber-600"></i>대사(정합성 검증)</h2>
        <button onclick="showReconcileModal()" class="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700"><i class="fas fa-play mr-1"></i>대사 실행</button>
      </div>

      <!-- Run 이력 -->
      <div class="bg-white rounded-xl border border-gray-100 overflow-hidden mb-6">
        <div class="px-5 py-3 bg-gray-50 border-b font-medium text-sm">대사 실행 이력</div>
        <table class="w-full text-sm">
          <thead class="text-gray-500 text-xs"><tr>
            <th class="px-4 py-3 text-left">Run ID</th><th class="px-4 py-3 text-left">기간</th><th class="px-4 py-3 text-right">발견 이슈</th>
            <th class="px-4 py-3 text-center">상태</th><th class="px-4 py-3 text-left">실행시각</th>
          </tr></thead>
          <tbody class="divide-y">
            ${(runsRes?.runs || []).map(r => `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3">#${r.run_id}</td>
                <td class="px-4 py-3 text-xs">${r.date_range_start} ~ ${r.date_range_end}</td>
                <td class="px-4 py-3 text-right font-bold ${r.total_issues > 0 ? 'text-red-600' : 'text-green-600'}">${r.total_issues}</td>
                <td class="px-4 py-3 text-center"><span class="status-badge ${r.status === 'DONE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${r.status}</span></td>
                <td class="px-4 py-3 text-xs text-gray-500">${formatDate(r.started_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- 미해결 이슈 -->
      <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div class="px-5 py-3 bg-gray-50 border-b font-medium text-sm">미해결 이슈 (${issuesRes?.total || 0}건)</div>
        <div class="divide-y">
          ${(issuesRes?.issues || []).map(i => `
            <div class="px-5 py-3 flex items-center gap-4 hover:bg-gray-50">
              <span class="status-badge ${i.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : i.severity === 'HIGH' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}">${i.severity}</span>
              <span class="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">${i.type}</span>
              <span class="text-sm flex-1">주문 #${i.order_id || '-'} ${i.external_order_no ? `(${i.external_order_no})` : ''} ${i.customer_name || ''}</span>
              <button onclick="resolveIssue(${i.issue_id})" class="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">해결</button>
            </div>
          `).join('')}
          ${(issuesRes?.issues || []).length === 0 ? '<div class="p-8 text-center text-gray-400"><i class="fas fa-check-circle text-3xl mb-2"></i><p>미해결 이슈 없음</p></div>' : ''}
        </div>
      </div>
    </div>`;
}

function showReconcileModal() {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];
  const content = `
    <div class="space-y-4">
      <div><label class="block text-xs text-gray-500 mb-1">시작일</label><input id="recon-start" type="date" value="${weekAgo}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-xs text-gray-500 mb-1">종료일</label><input id="recon-end" type="date" value="${today}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
    </div>`;
  showModal('대사(정합성 검증) 실행', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="executeReconcile()" class="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm">실행</button>
  `);
}

async function executeReconcile() {
  const res = await api('POST', '/reconciliation/runs', {
    date_range_start: document.getElementById('recon-start').value,
    date_range_end: document.getElementById('recon-end').value,
  });
  if (res?.run_id) { showToast(`대사 완료: ${res.total_issues}건 이슈 발견`, res.total_issues > 0 ? 'warning' : 'success'); closeModal(); renderContent(); }
}

async function resolveIssue(issueId) {
  const res = await api('PATCH', `/reconciliation/issues/${issueId}/resolve`);
  if (res?.ok) { showToast('이슈 해결 처리 완료', 'success'); renderContent(); }
}

// ════════════════════════════════════════════
// 통계
// ════════════════════════════════════════════
async function renderStatistics(el) {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];

  const [regionRes, leaderRes] = await Promise.all([
    api('GET', `/stats/regions/daily?from=${weekAgo}&to=${today}`),
    api('GET', `/stats/team-leaders/daily?from=${weekAgo}&to=${today}`),
  ]);

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-chart-bar mr-2 text-purple-600"></i>통계</h2>
        <div class="flex gap-2">
          <button onclick="downloadCSV('region')" class="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200"><i class="fas fa-download mr-1"></i>지역별 CSV</button>
          <button onclick="downloadCSV('team_leader')" class="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200"><i class="fas fa-download mr-1"></i>팀장별 CSV</button>
        </div>
      </div>

      <!-- 지역법인별 -->
      <div class="bg-white rounded-xl border border-gray-100 overflow-hidden mb-6">
        <div class="px-5 py-3 bg-gray-50 border-b font-medium text-sm">지역법인별 일자별 통계 (최근 7일)</div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead class="text-gray-500"><tr>
              <th class="px-3 py-2 text-left">날짜</th><th class="px-3 py-2 text-left">지역법인</th>
              <th class="px-3 py-2 text-right">인입</th><th class="px-3 py-2 text-right">배정</th>
              <th class="px-3 py-2 text-right">완료</th><th class="px-3 py-2 text-right">지역승인</th>
              <th class="px-3 py-2 text-right">HQ승인</th><th class="px-3 py-2 text-right">정산확정</th>
              <th class="px-3 py-2 text-right">기본액합</th><th class="px-3 py-2 text-right">지급액합</th>
            </tr></thead>
            <tbody class="divide-y">
              ${(regionRes?.stats || []).map(s => `
                <tr class="hover:bg-gray-50">
                  <td class="px-3 py-2">${s.date}</td><td class="px-3 py-2 font-medium">${s.region_name}</td>
                  <td class="px-3 py-2 text-right">${s.intake_count}</td><td class="px-3 py-2 text-right">${s.assigned_to_team_count}</td>
                  <td class="px-3 py-2 text-right">${s.completed_count}</td><td class="px-3 py-2 text-right">${s.region_approved_count}</td>
                  <td class="px-3 py-2 text-right">${s.hq_approved_count}</td><td class="px-3 py-2 text-right">${s.settlement_confirmed_count}</td>
                  <td class="px-3 py-2 text-right">${formatAmount(s.base_amount_sum)}</td>
                  <td class="px-3 py-2 text-right text-green-600">${formatAmount(s.payable_amount_sum)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 팀장별 -->
      <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div class="px-5 py-3 bg-gray-50 border-b font-medium text-sm">팀장별 일자별 통계 (최근 7일)</div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead class="text-gray-500"><tr>
              <th class="px-3 py-2 text-left">날짜</th><th class="px-3 py-2 text-left">팀장</th><th class="px-3 py-2 text-left">소속</th>
              <th class="px-3 py-2 text-right">수임</th><th class="px-3 py-2 text-right">완료</th><th class="px-3 py-2 text-right">제출</th>
              <th class="px-3 py-2 text-right">지역승인</th><th class="px-3 py-2 text-right">HQ승인</th><th class="px-3 py-2 text-right">반려</th>
              <th class="px-3 py-2 text-right">정산확정</th><th class="px-3 py-2 text-right">지급액합</th>
            </tr></thead>
            <tbody class="divide-y">
              ${(leaderRes?.stats || []).map(s => `
                <tr class="hover:bg-gray-50">
                  <td class="px-3 py-2">${s.date}</td><td class="px-3 py-2 font-medium">${s.team_leader_name}</td><td class="px-3 py-2">${s.org_name}</td>
                  <td class="px-3 py-2 text-right">${s.intake_count}</td><td class="px-3 py-2 text-right">${s.completed_count}</td><td class="px-3 py-2 text-right">${s.submitted_count}</td>
                  <td class="px-3 py-2 text-right">${s.region_approved_count}</td><td class="px-3 py-2 text-right">${s.hq_approved_count}</td><td class="px-3 py-2 text-right text-red-500">${s.rejected_count}</td>
                  <td class="px-3 py-2 text-right">${s.settlement_confirmed_count}</td>
                  <td class="px-3 py-2 text-right text-green-600">${formatAmount(s.payable_amount_sum)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

async function downloadCSV(groupBy) {
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
  const res = await api('GET', `/stats/export/csv?group_by=${groupBy}&from=${monthAgo}&to=${today}`);
  if (res instanceof Response) {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `stats_${groupBy}_${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  }
}

// ════════════════════════════════════════════
// 정책 관리
// ════════════════════════════════════════════
async function renderPolicies(el) {
  const [distRes, reportRes, commRes, terrRes] = await Promise.all([
    api('GET', '/stats/policies/distribution'),
    api('GET', '/stats/policies/report'),
    api('GET', '/stats/policies/commission'),
    api('GET', '/stats/territories'),
  ]);

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-gears mr-2 text-gray-600"></i>정책관리</h2>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- 배분 정책 -->
        <div class="bg-white rounded-xl border border-gray-100 p-5">
          <h3 class="font-semibold mb-3"><i class="fas fa-share-nodes mr-2 text-indigo-500"></i>배분 정책</h3>
          ${(distRes?.policies || []).map(p => `
            <div class="p-3 bg-gray-50 rounded-lg mb-2">
              <div class="font-medium">${p.name} (v${p.version})</div>
              <div class="text-xs text-gray-500">${p.effective_from}부터 · ${p.is_active ? '✅ 활성' : '❌ 비활성'}</div>
            </div>
          `).join('')}
        </div>

        <!-- 보고서 정책 -->
        <div class="bg-white rounded-xl border border-gray-100 p-5">
          <h3 class="font-semibold mb-3"><i class="fas fa-file-lines mr-2 text-cyan-500"></i>보고서 필수요건 정책</h3>
          ${(reportRes?.policies || []).map(p => `
            <div class="p-3 bg-gray-50 rounded-lg mb-2">
              <div class="font-medium">${p.name} (v${p.version}) - ${p.service_type}</div>
              <div class="text-xs text-gray-500">필수사진: ${p.required_photos_json} · 영수증: ${p.require_receipt ? '필수' : '선택'}</div>
            </div>
          `).join('')}
        </div>

        <!-- 수수료 정책 -->
        <div class="bg-white rounded-xl border border-gray-100 p-5 lg:col-span-2">
          <h3 class="font-semibold mb-3"><i class="fas fa-percent mr-2 text-emerald-500"></i>수수료 정책</h3>
          <table class="w-full text-sm">
            <thead class="text-gray-500 text-xs"><tr>
              <th class="py-2 text-left">지역법인</th><th class="py-2 text-left">팀장</th><th class="py-2 text-center">유형</th>
              <th class="py-2 text-right">값</th><th class="py-2 text-left">적용시작</th>
            </tr></thead>
            <tbody class="divide-y">
              ${(commRes?.policies || []).map(p => `
                <tr><td class="py-2">${p.org_name}</td>
                <td class="py-2">${p.team_leader_name || '<span class="text-gray-400">기본(전체)</span>'}</td>
                <td class="py-2 text-center"><span class="px-2 py-0.5 bg-${p.mode === 'FIXED' ? 'blue' : 'green'}-50 rounded text-xs">${p.mode === 'FIXED' ? '정액' : '정률'}</span></td>
                <td class="py-2 text-right font-medium">${p.mode === 'FIXED' ? formatAmount(p.value) : p.value + '%'}</td>
                <td class="py-2 text-xs text-gray-500">${p.effective_from}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- 지역권 매핑 -->
        <div class="bg-white rounded-xl border border-gray-100 p-5 lg:col-span-2">
          <h3 class="font-semibold mb-3"><i class="fas fa-map-location-dot mr-2 text-red-500"></i>행정동-지역법인 매핑</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead class="text-gray-500"><tr>
                <th class="py-2 text-left">시도</th><th class="py-2 text-left">시군구</th><th class="py-2 text-left">읍면동</th>
                <th class="py-2 text-left">행정동코드</th><th class="py-2 text-left">담당법인</th>
              </tr></thead>
              <tbody class="divide-y">
                ${(terrRes?.territories || []).map(t => `
                  <tr><td class="py-2">${t.sido}</td><td class="py-2">${t.sigungu}</td><td class="py-2">${t.eupmyeondong || '-'}</td>
                  <td class="py-2 font-mono">${t.admin_dong_code}</td><td class="py-2 font-medium">${t.org_name || '<span class="text-red-400">미매핑</span>'}</td></tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;
}

// ════════════════════════════════════════════
// 칸반 (REGION 전용)
// ════════════════════════════════════════════
async function renderKanban(el) {
  const [unassignedRes, leadersRes, assignedRes] = await Promise.all([
    api('GET', '/orders?status=DISTRIBUTED&limit=50'),
    api('GET', '/auth/team-leaders'),
    api('GET', '/orders?status=ASSIGNED&limit=100'),
  ]);

  const leaders = leadersRes?.team_leaders || [];
  const unassigned = unassignedRes?.orders || [];

  // 팀장별 그룹핑
  const leaderOrders = {};
  for (const l of leaders) leaderOrders[l.user_id] = [];
  for (const o of (assignedRes?.orders || [])) {
    if (o.team_leader_id && leaderOrders[o.team_leader_id]) {
      leaderOrders[o.team_leader_id].push(o);
    }
  }

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-columns mr-2 text-purple-600"></i>칸반 보드 (팀장 배정)</h2>
      <div class="flex gap-4 overflow-x-auto pb-4" style="min-height: 60vh;">
        <!-- 미배정 -->
        <div class="min-w-[280px] bg-gray-100 rounded-xl p-3 flex flex-col">
          <div class="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <i class="fas fa-inbox"></i>미배정 <span class="bg-gray-300 text-gray-700 text-xs px-2 py-0.5 rounded-full">${unassigned.length}</span>
          </div>
          <div class="flex-1 space-y-2 overflow-y-auto kanban-column" data-leader-id="0"
               ondragover="event.preventDefault();this.classList.add('drag-over')"
               ondragleave="this.classList.remove('drag-over')"
               ondrop="this.classList.remove('drag-over')">
            ${unassigned.map(o => kanbanCard(o)).join('')}
          </div>
        </div>

        ${leaders.map(l => `
        <div class="min-w-[280px] bg-blue-50 rounded-xl p-3 flex flex-col">
          <div class="font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <i class="fas fa-user"></i>${l.name} <span class="bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full">${(leaderOrders[l.user_id] || []).length}</span>
          </div>
          <div class="flex-1 space-y-2 overflow-y-auto kanban-column" data-leader-id="${l.user_id}"
               ondragover="event.preventDefault();this.classList.add('drag-over')"
               ondragleave="this.classList.remove('drag-over')"
               ondrop="handleKanbanDrop(event, ${l.user_id});this.classList.remove('drag-over')">
            ${(leaderOrders[l.user_id] || []).map(o => kanbanCard(o)).join('')}
          </div>
        </div>
        `).join('')}
      </div>
    </div>`;
}

function kanbanCard(o) {
  return `
    <div class="kanban-card bg-white rounded-lg p-3 shadow-sm border border-gray-200" draggable="true"
         data-order-id="${o.order_id}"
         ondragstart="event.dataTransfer.setData('text/plain','${o.order_id}')">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-gray-500">#${o.order_id}</span>
        ${statusBadge(o.status)}
      </div>
      <div class="font-medium text-sm">${o.customer_name || '-'}</div>
      <div class="text-xs text-gray-500 truncate">${o.address_text || '-'}</div>
      <div class="text-sm font-medium text-blue-600 mt-1">${formatAmount(o.base_amount)}</div>
    </div>`;
}

async function handleKanbanDrop(event, leaderId) {
  event.preventDefault();
  const orderId = event.dataTransfer.getData('text/plain');
  if (!orderId || !leaderId) return;
  const res = await api('POST', `/orders/${orderId}/assign`, { team_leader_id: leaderId });
  if (res?.ok) { showToast('배정 완료', 'success'); renderContent(); }
  else showToast(res?.error || '배정 실패', 'error');
}

// ════════════════════════════════════════════
// 팀장 - 내 주문
// ════════════════════════════════════════════
async function renderMyOrders(el) {
  const res = await api('GET', '/orders?limit=50');
  if (!res) return;

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-list mr-2 text-blue-600"></i>내 주문</h2>
      <div class="space-y-3">
        ${(res.orders || []).map(o => `
          <div class="bg-white rounded-xl p-5 border border-gray-100">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-3">
                <span class="text-sm text-gray-500">#${o.order_id}</span>
                <span class="font-medium">${o.customer_name || '-'}</span>
                ${statusBadge(o.status)}
              </div>
              <span class="text-lg font-bold text-blue-600">${formatAmount(o.base_amount)}</span>
            </div>
            <div class="text-sm text-gray-500 mb-3">${o.address_text || '-'}</div>
            <div class="flex gap-2">
              ${o.status === 'ASSIGNED' ? `<button onclick="startWork(${o.order_id})" class="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600"><i class="fas fa-play mr-1"></i>작업 시작</button>` : ''}
              ${['IN_PROGRESS', 'REGION_REJECTED', 'HQ_REJECTED'].includes(o.status) ? `<button onclick="showReportForm(${o.order_id})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-file-upload mr-1"></i>보고서 제출</button>` : ''}
              <button onclick="showOrderDetail(${o.order_id})" class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"><i class="fas fa-eye mr-1"></i>상세</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

async function startWork(orderId) {
  const res = await api('POST', `/orders/${orderId}/start`);
  if (res?.ok) { showToast('작업을 시작합니다.', 'success'); renderContent(); }
  else showToast(res?.error || '시작 실패', 'error');
}

function showReportForm(orderId) {
  const content = `
    <form id="report-form" class="space-y-4">
      <h4 class="font-semibold">체크리스트</h4>
      <div class="space-y-2">
        <label class="flex items-center gap-2"><input type="checkbox" name="chk_complete" checked class="rounded"><span class="text-sm">작업완료확인</span></label>
        <label class="flex items-center gap-2"><input type="checkbox" name="chk_sign" class="rounded"><span class="text-sm">고객서명확인</span></label>
        <label class="flex items-center gap-2"><input type="checkbox" name="chk_clean" checked class="rounded"><span class="text-sm">현장정리확인</span></label>
      </div>
      <h4 class="font-semibold">사진 (URL 입력)</h4>
      <div class="space-y-2">
        <input name="photo_before" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="작업전 사진 URL" value="https://placeholder.co/400x300?text=BEFORE">
        <input name="photo_after" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="작업후 사진 URL" value="https://placeholder.co/400x300?text=AFTER">
        <input name="photo_wash" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="세척 사진 URL" value="https://placeholder.co/400x300?text=WASH">
        <input name="photo_receipt" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="영수증 사진 URL" value="https://placeholder.co/400x300?text=RECEIPT">
      </div>
      <div><label class="block text-xs text-gray-500 mb-1">메모</label><textarea name="note" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="작업 메모"></textarea></div>
    </form>`;
  showModal('보고서 제출', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitReport(${orderId})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">제출</button>
  `);
}

async function submitReport(orderId) {
  const form = document.getElementById('report-form');
  const fd = new FormData(form);
  const data = {
    checklist: {
      '작업완료확인': !!fd.get('chk_complete'),
      '고객서명확인': !!fd.get('chk_sign'),
      '현장정리확인': !!fd.get('chk_clean'),
    },
    photos: [],
    note: fd.get('note'),
  };
  if (fd.get('photo_before')) data.photos.push({ category: 'BEFORE', file_url: fd.get('photo_before') });
  if (fd.get('photo_after')) data.photos.push({ category: 'AFTER', file_url: fd.get('photo_after') });
  if (fd.get('photo_wash')) data.photos.push({ category: 'WASH', file_url: fd.get('photo_wash') });
  if (fd.get('photo_receipt')) data.photos.push({ category: 'RECEIPT', file_url: fd.get('photo_receipt') });

  const res = await api('POST', `/orders/${orderId}/reports`, data);
  if (res?.ok) { showToast('보고서 제출 완료', 'success'); closeModal(); renderContent(); }
  else showToast(res?.error || '제출 실패', 'error');
}

// ════════════════════════════════════════════
// 팀장 - 내 통계
// ════════════════════════════════════════════
async function renderMyStats(el) {
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
  
  const [statsRes, ledgerRes] = await Promise.all([
    api('GET', `/stats/team-leaders/daily?from=${monthAgo}&to=${today}`),
    api('GET', `/settlements/ledger?from=${monthAgo}&to=${today}`),
  ]);

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-chart-line mr-2 text-green-600"></i>내 현황</h2>
      
      <div class="bg-white rounded-xl border border-gray-100 overflow-hidden mb-6">
        <div class="px-5 py-3 bg-gray-50 border-b font-medium text-sm">일자별 통계 (최근 30일)</div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-gray-500 text-xs"><tr>
              <th class="px-3 py-2 text-left">날짜</th><th class="px-3 py-2 text-right">수임</th><th class="px-3 py-2 text-right">제출</th>
              <th class="px-3 py-2 text-right">지역승인</th><th class="px-3 py-2 text-right">HQ승인</th><th class="px-3 py-2 text-right">반려</th>
              <th class="px-3 py-2 text-right">정산확정</th><th class="px-3 py-2 text-right">지급액</th>
            </tr></thead>
            <tbody class="divide-y">
              ${(statsRes?.stats || []).map(s => `
                <tr class="hover:bg-gray-50">
                  <td class="px-3 py-2">${s.date}</td><td class="px-3 py-2 text-right">${s.intake_count}</td>
                  <td class="px-3 py-2 text-right">${s.submitted_count}</td><td class="px-3 py-2 text-right">${s.region_approved_count}</td>
                  <td class="px-3 py-2 text-right">${s.hq_approved_count}</td><td class="px-3 py-2 text-right text-red-500">${s.rejected_count}</td>
                  <td class="px-3 py-2 text-right">${s.settlement_confirmed_count}</td>
                  <td class="px-3 py-2 text-right text-green-600 font-bold">${formatAmount(s.payable_amount_sum)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div class="px-5 py-3 bg-gray-50 border-b font-medium text-sm">정산 원장</div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-gray-500 text-xs"><tr>
              <th class="px-3 py-2 text-left">날짜</th><th class="px-3 py-2 text-right">확정건수</th><th class="px-3 py-2 text-right">확정지급합계</th>
            </tr></thead>
            <tbody class="divide-y">
              ${(ledgerRes?.ledger || []).map(l => `
                <tr><td class="px-3 py-2">${l.date}</td>
                <td class="px-3 py-2 text-right">${l.confirmed_count}</td>
                <td class="px-3 py-2 text-right text-green-600 font-bold">${formatAmount(l.confirmed_payable_sum)}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// ════════════════════════════════════════════
// 인사관리 (HR Management)
// ════════════════════════════════════════════

let hrCurrentTab = 'users'; // users, organizations, phone-verify

async function renderHRManagement(el) {
  const isHQ = currentUser.org_type === 'HQ' || currentUser.roles.includes('SUPER_ADMIN');

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-users-gear mr-2 text-violet-600"></i>${isHQ ? '인사관리' : '팀장관리'}</h2>
      </div>
      
      <!-- 탭 네비게이션 -->
      <div class="flex border-b mb-6 gap-1">
        <button onclick="hrCurrentTab='users';renderHRManagement(document.getElementById('content'))" 
                class="px-5 py-3 text-sm font-medium transition ${hrCurrentTab === 'users' ? 'tab-active' : 'text-gray-500 hover:text-gray-700'}">
          <i class="fas fa-users mr-1"></i>사용자 관리
        </button>
        ${isHQ ? `
        <button onclick="hrCurrentTab='organizations';renderHRManagement(document.getElementById('content'))" 
                class="px-5 py-3 text-sm font-medium transition ${hrCurrentTab === 'organizations' ? 'tab-active' : 'text-gray-500 hover:text-gray-700'}">
          <i class="fas fa-building mr-1"></i>조직 관리
        </button>` : ''}
        <button onclick="hrCurrentTab='phone-verify';renderHRManagement(document.getElementById('content'))" 
                class="px-5 py-3 text-sm font-medium transition ${hrCurrentTab === 'phone-verify' ? 'tab-active' : 'text-gray-500 hover:text-gray-700'}">
          <i class="fas fa-mobile-screen mr-1"></i>핸드폰 인증
        </button>
      </div>

      <div id="hr-content"></div>
    </div>`;

  const hrEl = document.getElementById('hr-content');
  switch (hrCurrentTab) {
    case 'users': await renderHRUsers(hrEl); break;
    case 'organizations': await renderHROrganizations(hrEl); break;
    case 'phone-verify': await renderPhoneVerify(hrEl); break;
  }
}

// ─── 사용자 관리 탭 ───
async function renderHRUsers(el) {
  const params = new URLSearchParams(window._hrFilters || {});
  if (!params.has('limit')) params.set('limit', '20');
  
  const [usersRes, orgsRes, rolesRes] = await Promise.all([
    api('GET', `/hr/users?${params.toString()}`),
    api('GET', '/hr/organizations'),
    api('GET', '/hr/roles'),
  ]);

  const ROLE_COLORS = {
    'SUPER_ADMIN': 'bg-red-100 text-red-700',
    'HQ_OPERATOR': 'bg-blue-100 text-blue-700',
    'REGION_ADMIN': 'bg-purple-100 text-purple-700',
    'TEAM_LEADER': 'bg-green-100 text-green-700',
    'AUDITOR': 'bg-gray-100 text-gray-700',
  };

  el.innerHTML = `
    <!-- 액션 바 -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex gap-2 items-end flex-wrap">
        <div>
          <label class="block text-xs text-gray-500 mb-1">조직</label>
          <select id="hr-f-org" class="border rounded-lg px-3 py-2 text-sm" onchange="applyHRFilter()">
            <option value="">전체</option>
            ${(orgsRes?.organizations || []).map(o => `<option value="${o.org_id}" ${params.get('org_id') === String(o.org_id) ? 'selected' : ''}>${o.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">역할</label>
          <select id="hr-f-role" class="border rounded-lg px-3 py-2 text-sm" onchange="applyHRFilter()">
            <option value="">전체</option>
            ${(rolesRes?.roles || []).map(r => `<option value="${r.code}" ${params.get('role') === r.code ? 'selected' : ''}>${r.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">상태</label>
          <select id="hr-f-status" class="border rounded-lg px-3 py-2 text-sm" onchange="applyHRFilter()">
            <option value="">전체</option>
            <option value="ACTIVE" ${params.get('status') === 'ACTIVE' ? 'selected' : ''}>활성</option>
            <option value="INACTIVE" ${params.get('status') === 'INACTIVE' ? 'selected' : ''}>비활성</option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">검색</label>
          <input id="hr-f-search" class="border rounded-lg px-3 py-2 text-sm w-44" placeholder="이름/ID/전화" value="${params.get('search') || ''}" onkeypress="if(event.key==='Enter')applyHRFilter()">
        </div>
        <button onclick="applyHRFilter()" class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"><i class="fas fa-search"></i></button>
      </div>
      <button onclick="showNewUserModal()" class="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 whitespace-nowrap">
        <i class="fas fa-user-plus mr-1"></i>신규 등록
      </button>
    </div>

    <!-- 사용자 테이블 -->
    <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-600">
            <tr>
              <th class="px-4 py-3 text-left">ID</th>
              <th class="px-4 py-3 text-left">이름</th>
              <th class="px-4 py-3 text-left">로그인ID</th>
              <th class="px-4 py-3 text-left">소속</th>
              <th class="px-4 py-3 text-left">역할</th>
              <th class="px-4 py-3 text-left">핸드폰</th>
              <th class="px-4 py-3 text-center">인증</th>
              <th class="px-4 py-3 text-center">상태</th>
              <th class="px-4 py-3 text-left">입사일</th>
              <th class="px-4 py-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            ${(usersRes?.users || []).map(u => `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-gray-500 text-xs">${u.user_id}</td>
                <td class="px-4 py-3 font-medium">${u.name}</td>
                <td class="px-4 py-3 font-mono text-xs">${u.login_id}</td>
                <td class="px-4 py-3 text-xs">
                  <span class="px-2 py-0.5 rounded ${u.org_type === 'HQ' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}">${u.org_name}</span>
                </td>
                <td class="px-4 py-3">
                  ${(u.roles || []).map(r => `<span class="status-badge ${ROLE_COLORS[r] || 'bg-gray-100 text-gray-600'} text-xs mr-1">${r}</span>`).join('')}
                </td>
                <td class="px-4 py-3 text-xs font-mono">${formatPhone(u.phone)}</td>
                <td class="px-4 py-3 text-center">
                  ${u.phone_verified ? '<i class="fas fa-check-circle text-green-500" title="인증완료"></i>' : '<i class="fas fa-times-circle text-red-400" title="미인증"></i>'}
                </td>
                <td class="px-4 py-3 text-center">
                  <span class="status-badge ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${u.status === 'ACTIVE' ? '활성' : '비활성'}</span>
                </td>
                <td class="px-4 py-3 text-xs text-gray-500">${u.joined_at || '-'}</td>
                <td class="px-4 py-3 text-center">
                  <div class="flex gap-1 justify-center">
                    <button onclick="showUserDetail(${u.user_id})" class="px-2 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200" title="상세"><i class="fas fa-eye"></i></button>
                    <button onclick="showEditUserModal(${u.user_id})" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200" title="수정"><i class="fas fa-pen"></i></button>
                    <button onclick="showSetCredentialsModal(${u.user_id}, '${u.name}', '${u.login_id}')" class="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs hover:bg-indigo-200" title="ID/PW"><i class="fas fa-key"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
            ${(usersRes?.users || []).length === 0 ? '<tr><td colspan="10" class="px-4 py-8 text-center text-gray-400">사용자가 없습니다.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
      <div class="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
        <span>총 ${usersRes?.total || 0}건</span>
        <div class="flex gap-2">
          ${Number(usersRes?.page) > 1 ? `<button onclick="window._hrFilters={...window._hrFilters||{},page:${Number(usersRes.page)-1}};renderHRManagement(document.getElementById('content'))" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">이전</button>` : ''}
          <span class="px-3 py-1">${usersRes?.page || 1} / ${Math.ceil((usersRes?.total || 0) / Number(usersRes?.limit || 20)) || 1}</span>
          ${Number(usersRes?.page) < Math.ceil((usersRes?.total || 0) / Number(usersRes?.limit || 20)) ? `<button onclick="window._hrFilters={...window._hrFilters||{},page:${Number(usersRes.page)+1}};renderHRManagement(document.getElementById('content'))" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">다음</button>` : ''}
        </div>
      </div>
    </div>`;
}

function formatPhone(phone) {
  if (!phone) return '-';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  return phone;
}

function applyHRFilter() {
  window._hrFilters = {
    org_id: document.getElementById('hr-f-org')?.value || '',
    role: document.getElementById('hr-f-role')?.value || '',
    status: document.getElementById('hr-f-status')?.value || '',
    search: document.getElementById('hr-f-search')?.value || '',
    page: 1,
  };
  Object.keys(window._hrFilters).forEach(k => { if (!window._hrFilters[k]) delete window._hrFilters[k]; });
  renderHRManagement(document.getElementById('content'));
}

// ─── 사용자 상세 모달 ───
async function showUserDetail(userId) {
  const res = await api('GET', `/hr/users/${userId}`);
  if (!res?.user) return;
  const u = res.user;
  const a = res.activity || {};

  const content = `
    <div class="space-y-5">
      <!-- 기본 정보 -->
      <div class="grid grid-cols-2 gap-4">
        <div><label class="text-xs text-gray-500">이름</label><div class="font-bold text-lg">${u.name}</div></div>
        <div><label class="text-xs text-gray-500">상태</label><div><span class="status-badge ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${u.status === 'ACTIVE' ? '활성' : '비활성'}</span></div></div>
        <div><label class="text-xs text-gray-500">로그인 ID</label><div class="font-mono">${u.login_id}</div></div>
        <div><label class="text-xs text-gray-500">소속</label><div>${u.org_name} (${u.org_type})</div></div>
        <div><label class="text-xs text-gray-500">핸드폰</label><div class="font-mono">${formatPhone(u.phone)} ${u.phone_verified ? '<i class="fas fa-check-circle text-green-500 ml-1"></i><span class="text-green-600 text-xs">인증완료</span>' : '<i class="fas fa-times-circle text-red-400 ml-1"></i><span class="text-red-500 text-xs">미인증</span>'}</div></div>
        <div><label class="text-xs text-gray-500">이메일</label><div>${u.email || '-'}</div></div>
        <div><label class="text-xs text-gray-500">입사일</label><div>${u.joined_at || '-'}</div></div>
        <div><label class="text-xs text-gray-500">메모</label><div>${u.memo || '-'}</div></div>
      </div>

      <!-- 역할 -->
      <div class="border-t pt-4">
        <h4 class="font-semibold mb-2"><i class="fas fa-shield-halved mr-1"></i>역할</h4>
        <div class="flex gap-2">
          ${(res.roles || []).map(r => `<span class="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">${r.name} (${r.code})</span>`).join('')}
        </div>
      </div>

      <!-- 활동 요약 (팀장인 경우) -->
      ${a.total_assigned !== undefined ? `
      <div class="border-t pt-4">
        <h4 class="font-semibold mb-2"><i class="fas fa-chart-line mr-1"></i>수행 실적</h4>
        <div class="grid grid-cols-4 gap-3">
          <div class="bg-blue-50 rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-blue-600">${a.total_assigned || 0}</div>
            <div class="text-xs text-gray-500">총 배정</div>
          </div>
          <div class="bg-green-50 rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-green-600">${a.total_approved || 0}</div>
            <div class="text-xs text-gray-500">승인</div>
          </div>
          <div class="bg-emerald-50 rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-emerald-600">${a.total_settled || 0}</div>
            <div class="text-xs text-gray-500">정산확정</div>
          </div>
          <div class="bg-red-50 rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-red-600">${a.total_rejected || 0}</div>
            <div class="text-xs text-gray-500">반려</div>
          </div>
        </div>
      </div>` : ''}

      <!-- 핸드폰 인증 이력 -->
      ${(res.phone_verifications || []).length > 0 ? `
      <div class="border-t pt-4">
        <h4 class="font-semibold mb-2"><i class="fas fa-mobile-screen mr-1"></i>핸드폰 인증 이력</h4>
        <div class="space-y-1 max-h-32 overflow-y-auto">
          ${res.phone_verifications.map(v => `
            <div class="flex items-center gap-3 text-xs py-1">
              <span class="font-mono">${formatPhone(v.phone)}</span>
              <span class="px-2 py-0.5 rounded ${v.verified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${v.verified ? '인증성공' : '미인증'}</span>
              <span class="text-gray-400">${v.purpose}</span>
              <span class="text-gray-400">${formatDate(v.created_at)}</span>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
    </div>`;

  const actions = `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>
    <button onclick="closeModal();showEditUserModal(${userId})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"><i class="fas fa-pen mr-1"></i>수정</button>
    <button onclick="closeModal();showSetCredentialsModal(${userId}, '${u.name}', '${u.login_id}')" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"><i class="fas fa-key mr-1"></i>ID/PW 설정</button>
    ${u.status === 'ACTIVE' ? 
      `<button onclick="toggleUserStatus(${userId}, 'INACTIVE')" class="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm"><i class="fas fa-user-slash mr-1"></i>비활성화</button>` :
      `<button onclick="toggleUserStatus(${userId}, 'ACTIVE')" class="px-4 py-2 bg-green-100 text-green-600 rounded-lg text-sm"><i class="fas fa-user-check mr-1"></i>활성화</button>`}
  `;

  showModal(`사용자 상세 — ${u.name}`, content, actions);
}

// ─── 신규 사용자 등록 모달 ───
async function showNewUserModal() {
  const [orgsRes, rolesRes] = await Promise.all([
    api('GET', '/hr/organizations'),
    api('GET', '/hr/roles'),
  ]);

  const isRegion = currentUser.org_type === 'REGION' && !currentUser.roles.includes('SUPER_ADMIN');
  const orgs = (orgsRes?.organizations || []).filter(o => isRegion ? o.org_id === currentUser.org_id : true);
  const roles = (rolesRes?.roles || []).filter(r => isRegion ? r.code === 'TEAM_LEADER' : true);

  const content = `
    <form id="new-user-form" class="space-y-4">
      <div class="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
        <i class="fas fa-info-circle mr-1"></i>
        등록 후 초기 비밀번호는 핸드폰 뒷자리 4자리 + "!" 로 자동 설정됩니다.
        (예: 폰번호 010-1234-5678 → 비밀번호: 5678!)
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs text-gray-500 mb-1">이름 <span class="text-red-500">*</span></label>
          <input name="name" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="홍길동">
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">핸드폰 <span class="text-red-500">*</span></label>
          <input name="phone" required class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="01012345678" maxlength="13"
                 oninput="this.value=this.value.replace(/[^0-9]/g,'')">
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">소속 조직 <span class="text-red-500">*</span></label>
          <select name="org_id" required class="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">선택...</option>
            ${orgs.map(o => `<option value="${o.org_id}">${o.name} (${o.org_type})</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">역할 <span class="text-red-500">*</span></label>
          <select name="role" required class="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">선택...</option>
            ${roles.map(r => `<option value="${r.code}">${r.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">이메일</label>
          <input name="email" type="email" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="user@example.com">
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">로그인 ID (미입력시 자동 생성)</label>
          <input name="login_id" class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="자동생성">
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">초기 비밀번호 (미입력시 폰뒷자리4+!)</label>
          <input name="password" type="password" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="자동생성">
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">메모</label>
          <input name="memo" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="담당 지역 등">
        </div>
      </div>
    </form>`;

  showModal('신규 사용자 등록', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitNewUser()" class="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm"><i class="fas fa-user-plus mr-1"></i>등록</button>
  `);
}

async function submitNewUser() {
  const form = document.getElementById('new-user-form');
  const data = Object.fromEntries(new FormData(form));
  if (!data.name || !data.phone || !data.org_id || !data.role) {
    showToast('필수 항목을 입력하세요.', 'error');
    return;
  }
  // 빈값 제거
  Object.keys(data).forEach(k => { if (!data[k]) delete data[k]; });
  data.org_id = Number(data.org_id);

  const res = await api('POST', '/hr/users', data);
  if (res?._status === 201) {
    closeModal();
    // 결과를 보여주는 모달
    showModal('등록 완료', `
      <div class="space-y-3">
        <div class="bg-green-50 rounded-lg p-4 text-green-800">
          <i class="fas fa-check-circle text-green-500 mr-2"></i>${res.message}
        </div>
        <div class="bg-gray-50 rounded-lg p-4 space-y-2">
          <div class="flex justify-between"><span class="text-gray-500">로그인 ID:</span><span class="font-mono font-bold">${res.login_id}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">초기 비밀번호:</span><span class="font-mono font-bold text-red-600">${res.initial_password}</span></div>
        </div>
        <p class="text-xs text-gray-500"><i class="fas fa-exclamation-triangle mr-1 text-amber-500"></i>초기 비밀번호를 사용자에게 안내하세요. 이 정보는 다시 확인할 수 없습니다.</p>
      </div>
    `, `<button onclick="closeModal();renderHRManagement(document.getElementById('content'))" class="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm">확인</button>`);
  } else {
    showToast(res?.error || '등록 실패', 'error');
  }
}

// ─── 사용자 수정 모달 ───
async function showEditUserModal(userId) {
  const [userRes, orgsRes] = await Promise.all([
    api('GET', `/hr/users/${userId}`),
    api('GET', '/hr/organizations'),
  ]);
  if (!userRes?.user) return;
  const u = userRes.user;
  const userRoles = (userRes.roles || []).map(r => r.code);

  const content = `
    <form id="edit-user-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs text-gray-500 mb-1">이름</label>
          <input name="name" value="${u.name}" class="w-full border rounded-lg px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">핸드폰</label>
          <input name="phone" value="${u.phone || ''}" class="w-full border rounded-lg px-3 py-2 text-sm font-mono" maxlength="13"
                 oninput="this.value=this.value.replace(/[^0-9]/g,'')">
          ${u.phone_verified ? '<p class="text-xs text-green-600 mt-1"><i class="fas fa-check-circle mr-1"></i>인증완료 — 번호 변경시 인증 초기화됩니다</p>' : '<p class="text-xs text-red-500 mt-1"><i class="fas fa-times-circle mr-1"></i>미인증</p>'}
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">이메일</label>
          <input name="email" value="${u.email || ''}" type="email" class="w-full border rounded-lg px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">역할</label>
          <select name="role" class="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">변경 안함</option>
            <option value="SUPER_ADMIN" ${userRoles.includes('SUPER_ADMIN') ? 'selected' : ''}>슈퍼관리자</option>
            <option value="HQ_OPERATOR" ${userRoles.includes('HQ_OPERATOR') ? 'selected' : ''}>HQ운영자</option>
            <option value="REGION_ADMIN" ${userRoles.includes('REGION_ADMIN') ? 'selected' : ''}>지역법인 관리자</option>
            <option value="TEAM_LEADER" ${userRoles.includes('TEAM_LEADER') ? 'selected' : ''}>팀장</option>
            <option value="AUDITOR" ${userRoles.includes('AUDITOR') ? 'selected' : ''}>감사/조회</option>
          </select>
        </div>
        ${currentUser.roles.includes('SUPER_ADMIN') ? `
        <div>
          <label class="block text-xs text-gray-500 mb-1">소속 조직</label>
          <select name="org_id" class="w-full border rounded-lg px-3 py-2 text-sm">
            ${(orgsRes?.organizations || []).map(o => `<option value="${o.org_id}" ${o.org_id === u.org_id ? 'selected' : ''}>${o.name}</option>`).join('')}
          </select>
        </div>` : ''}
        <div class="${currentUser.roles.includes('SUPER_ADMIN') ? '' : 'col-span-2'}">
          <label class="block text-xs text-gray-500 mb-1">메모</label>
          <input name="memo" value="${u.memo || ''}" class="w-full border rounded-lg px-3 py-2 text-sm">
        </div>
      </div>
    </form>`;

  showModal(`사용자 수정 — ${u.name}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="resetPassword(${userId})" class="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm"><i class="fas fa-redo mr-1"></i>비밀번호 초기화</button>
    <button onclick="submitEditUser(${userId})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"><i class="fas fa-save mr-1"></i>저장</button>
  `);
}

async function submitEditUser(userId) {
  const form = document.getElementById('edit-user-form');
  const data = Object.fromEntries(new FormData(form));
  // 빈값 제거 (변경 안함)
  Object.keys(data).forEach(k => { if (data[k] === '' || data[k] === undefined) delete data[k]; });
  if (data.org_id) data.org_id = Number(data.org_id);

  if (Object.keys(data).length === 0) {
    showToast('변경할 항목이 없습니다.', 'warning');
    return;
  }

  const res = await api('PUT', `/hr/users/${userId}`, data);
  if (res?.ok) {
    showToast('수정 완료', 'success');
    closeModal();
    renderHRManagement(document.getElementById('content'));
  } else {
    showToast(res?.error || '수정 실패', 'error');
  }
}

// ─── ID/PW 설정 모달 ───
function showSetCredentialsModal(userId, name, currentLoginId) {
  const content = `
    <form id="cred-form" class="space-y-4">
      <div class="bg-indigo-50 rounded-lg p-3 text-sm text-indigo-700">
        <i class="fas fa-key mr-1"></i>
        <strong>${name}</strong>님의 로그인 정보를 설정합니다.
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">새 로그인 ID</label>
        <input name="login_id" value="${currentLoginId}" class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="변경할 ID">
        <p class="text-xs text-gray-400 mt-1">현재: ${currentLoginId}</p>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">새 비밀번호</label>
        <div class="relative">
          <input name="password" type="password" id="cred-pw-input" class="w-full border rounded-lg px-3 py-2 text-sm pr-10" placeholder="새 비밀번호 (최소 4자)">
          <button type="button" onclick="togglePwVisibility()" class="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"><i id="pw-eye" class="fas fa-eye"></i></button>
        </div>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">비밀번호 확인</label>
        <input name="password_confirm" type="password" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="비밀번호 재입력">
      </div>
    </form>`;

  showModal(`ID/PW 설정 — ${name}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitSetCredentials(${userId}, '${currentLoginId}')" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"><i class="fas fa-save mr-1"></i>설정</button>
  `);
}

function togglePwVisibility() {
  const input = document.getElementById('cred-pw-input');
  const eye = document.getElementById('pw-eye');
  if (input.type === 'password') { input.type = 'text'; eye.className = 'fas fa-eye-slash'; }
  else { input.type = 'password'; eye.className = 'fas fa-eye'; }
}

async function submitSetCredentials(userId, currentLoginId) {
  const form = document.getElementById('cred-form');
  const data = Object.fromEntries(new FormData(form));

  const payload = {};
  if (data.login_id && data.login_id !== currentLoginId) payload.login_id = data.login_id;
  if (data.password) {
    if (data.password.length < 4) { showToast('비밀번호는 최소 4자 이상입니다.', 'error'); return; }
    if (data.password !== data.password_confirm) { showToast('비밀번호가 일치하지 않습니다.', 'error'); return; }
    payload.password = data.password;
  }

  if (Object.keys(payload).length === 0) { showToast('변경할 항목이 없습니다.', 'warning'); return; }

  const res = await api('POST', `/hr/users/${userId}/set-credentials`, payload);
  if (res?.ok) {
    showToast('ID/PW 설정 완료', 'success');
    closeModal();
    renderHRManagement(document.getElementById('content'));
  } else {
    showToast(res?.error || '설정 실패', 'error');
  }
}

// ─── 비밀번호 초기화 ───
async function resetPassword(userId) {
  if (!confirm('비밀번호를 핸드폰 뒷자리 4자리 + "!" 로 초기화합니다.\n계속하시겠습니까?')) return;
  const res = await api('POST', `/hr/users/${userId}/reset-password`);
  if (res?.ok) {
    closeModal();
    showModal('비밀번호 초기화 완료', `
      <div class="bg-amber-50 rounded-lg p-4">
        <p class="text-amber-800">${res.message}</p>
        <p class="mt-2 font-mono font-bold text-lg text-center bg-white rounded p-3">${res.new_password}</p>
        <p class="text-xs text-gray-500 mt-2"><i class="fas fa-exclamation-triangle mr-1 text-amber-500"></i>이 비밀번호를 사용자에게 안내하세요.</p>
      </div>
    `, `<button onclick="closeModal()" class="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm">확인</button>`);
  } else {
    showToast(res?.error || '초기화 실패', 'error');
  }
}

// ─── 사용자 활성/비활성 토글 ───
async function toggleUserStatus(userId, status) {
  const label = status === 'ACTIVE' ? '활성화' : '비활성화';
  if (!confirm(`이 사용자를 ${label} 하시겠습니까?${status === 'INACTIVE' ? '\n비활성화시 로그인이 불가능해집니다.' : ''}`)) return;
  const res = await api('PATCH', `/hr/users/${userId}/status`, { status });
  if (res?.ok) {
    showToast(res.message, 'success');
    closeModal();
    renderHRManagement(document.getElementById('content'));
  } else {
    showToast(res?.error || '상태 변경 실패', 'error');
  }
}

// ─── 조직 관리 탭 ───
async function renderHROrganizations(el) {
  const res = await api('GET', '/hr/organizations');
  const orgs = res?.organizations || [];

  el.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <p class="text-sm text-gray-500">총 ${orgs.length}개 조직</p>
      ${currentUser.roles.includes('SUPER_ADMIN') ? `
      <button onclick="showNewOrgModal()" class="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">
        <i class="fas fa-building-circle-arrow-right mr-1"></i>조직 등록
      </button>` : ''}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${orgs.map(o => `
        <div class="card bg-white rounded-xl p-5 border border-gray-100">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 ${o.org_type === 'HQ' ? 'bg-blue-100' : 'bg-purple-100'} rounded-lg flex items-center justify-center">
                <i class="fas ${o.org_type === 'HQ' ? 'fa-building' : 'fa-building-user'} ${o.org_type === 'HQ' ? 'text-blue-600' : 'text-purple-600'}"></i>
              </div>
              <div>
                <div class="font-bold">${o.name}</div>
                <div class="text-xs text-gray-500">${o.code || '코드없음'} · ${o.org_type}</div>
              </div>
            </div>
            <span class="status-badge ${o.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${o.status === 'ACTIVE' ? '활성' : '비활성'}</span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-gray-50 rounded-lg p-2">
              <div class="text-lg font-bold text-gray-800">${o.total_members || 0}</div>
              <div class="text-xs text-gray-500">전체인원</div>
            </div>
            <div class="bg-green-50 rounded-lg p-2">
              <div class="text-lg font-bold text-green-600">${o.active_members || 0}</div>
              <div class="text-xs text-gray-500">활성인원</div>
            </div>
            <div class="bg-blue-50 rounded-lg p-2">
              <div class="text-lg font-bold text-blue-600">${o.active_leaders || 0}</div>
              <div class="text-xs text-gray-500">활성팀장</div>
            </div>
          </div>
          ${currentUser.roles.includes('SUPER_ADMIN') ? `
          <div class="mt-3 pt-3 border-t flex justify-end">
            <button onclick="showEditOrgModal(${o.org_id}, '${o.name}', '${o.code || ''}', '${o.status}')" class="px-3 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200"><i class="fas fa-pen mr-1"></i>수정</button>
          </div>` : ''}
        </div>
      `).join('')}
    </div>`;
}

// ─── 조직 등록/수정 모달 ───
function showNewOrgModal() {
  const content = `
    <form id="new-org-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs text-gray-500 mb-1">조직명 <span class="text-red-500">*</span></label>
          <input name="name" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="대전지역법인">
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">유형 <span class="text-red-500">*</span></label>
          <select name="org_type" required class="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="REGION">지역법인 (REGION)</option>
            <option value="HQ">본사 (HQ)</option>
          </select>
        </div>
        <div class="col-span-2">
          <label class="block text-xs text-gray-500 mb-1">코드</label>
          <input name="code" class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="REGION_DAEJEON">
        </div>
      </div>
    </form>`;
  showModal('조직 등록', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitNewOrg()" class="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm">등록</button>
  `);
}

async function submitNewOrg() {
  const form = document.getElementById('new-org-form');
  const data = Object.fromEntries(new FormData(form));
  if (!data.name || !data.org_type) { showToast('조직명과 유형은 필수입니다.', 'error'); return; }
  const res = await api('POST', '/hr/organizations', data);
  if (res?._status === 201) { showToast('조직 등록 완료', 'success'); closeModal(); renderHRManagement(document.getElementById('content')); }
  else showToast(res?.error || '등록 실패', 'error');
}

function showEditOrgModal(orgId, name, code, status) {
  const content = `
    <form id="edit-org-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs text-gray-500 mb-1">조직명</label>
          <input name="name" value="${name}" class="w-full border rounded-lg px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">코드</label>
          <input name="code" value="${code}" class="w-full border rounded-lg px-3 py-2 text-sm font-mono">
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">상태</label>
          <select name="status" class="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="ACTIVE" ${status === 'ACTIVE' ? 'selected' : ''}>활성</option>
            <option value="INACTIVE" ${status === 'INACTIVE' ? 'selected' : ''}>비활성</option>
          </select>
        </div>
      </div>
    </form>`;
  showModal(`조직 수정 — ${name}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitEditOrg(${orgId})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">저장</button>
  `);
}

async function submitEditOrg(orgId) {
  const form = document.getElementById('edit-org-form');
  const data = Object.fromEntries(new FormData(form));
  const res = await api('PUT', `/hr/organizations/${orgId}`, data);
  if (res?.ok) { showToast('조직 수정 완료', 'success'); closeModal(); renderHRManagement(document.getElementById('content')); }
  else showToast(res?.error || '수정 실패', 'error');
}

// ─── 핸드폰 인증 탭 ───
async function renderPhoneVerify(el) {
  el.innerHTML = `
    <div class="max-w-lg mx-auto">
      <div class="bg-white rounded-xl border border-gray-100 p-6">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <i class="fas fa-mobile-screen text-violet-600 text-2xl"></i>
          </div>
          <h3 class="text-lg font-bold text-gray-800">핸드폰 번호 인증</h3>
          <p class="text-sm text-gray-500 mt-1">사용자 등록 시 핸드폰 인증을 진행합니다.</p>
        </div>

        <!-- Step 1: 전화번호 입력 -->
        <div id="verify-step-1" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">핸드폰 번호</label>
            <div class="flex gap-2">
              <input id="verify-phone" class="flex-1 border rounded-lg px-4 py-3 text-sm font-mono" placeholder="01012345678" maxlength="11"
                     oninput="this.value=this.value.replace(/[^0-9]/g,'')">
              <button onclick="sendOTP()" class="px-5 py-3 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 whitespace-nowrap">
                <i class="fas fa-paper-plane mr-1"></i>인증번호 발송
              </button>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">인증 목적</label>
            <select id="verify-purpose" class="w-full border rounded-lg px-4 py-3 text-sm">
              <option value="REGISTER">신규 등록</option>
              <option value="RESET_PW">비밀번호 재설정</option>
              <option value="LOGIN">로그인</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">대상 사용자 ID (선택)</label>
            <input id="verify-user-id" class="w-full border rounded-lg px-4 py-3 text-sm" placeholder="기존 사용자인 경우 입력" type="number">
          </div>
        </div>

        <!-- Step 2: OTP 입력 (숨김) -->
        <div id="verify-step-2" class="space-y-4" style="display:none;">
          <div class="bg-green-50 rounded-lg p-4 text-green-800 text-sm">
            <i class="fas fa-check-circle mr-1"></i>인증번호가 <strong id="verify-sent-phone"></strong>으로 발송되었습니다.
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">인증번호 (6자리)</label>
            <input id="verify-otp" class="w-full border-2 border-violet-300 rounded-lg px-4 py-4 text-center text-2xl font-mono tracking-widest" maxlength="6" placeholder="000000"
                   oninput="this.value=this.value.replace(/[^0-9]/g,'');if(this.value.length===6)verifyOTP()">
          </div>
          <div id="verify-dev-hint" class="bg-amber-50 rounded-lg p-3 text-xs text-amber-700" style="display:none;">
            <i class="fas fa-code mr-1"></i>개발환경 OTP: <strong id="dev-otp-code"></strong>
          </div>
          <div class="flex gap-2">
            <button onclick="resetVerify()" class="flex-1 px-4 py-3 bg-gray-100 rounded-lg text-sm">다시 시도</button>
            <button onclick="verifyOTP()" class="flex-1 px-4 py-3 bg-violet-600 text-white rounded-lg text-sm font-medium">
              <i class="fas fa-check mr-1"></i>인증 확인
            </button>
          </div>
          <div id="verify-timer" class="text-center text-sm text-gray-500"></div>
        </div>

        <!-- 결과 -->
        <div id="verify-result" style="display:none;" class="mt-4"></div>
      </div>

      <!-- 인증 상태 조회 -->
      <div class="bg-white rounded-xl border border-gray-100 p-6 mt-6">
        <h4 class="font-semibold mb-4"><i class="fas fa-search mr-1"></i>핸드폰 인증 상태 조회</h4>
        <div class="flex gap-2">
          <input id="check-phone" class="flex-1 border rounded-lg px-4 py-3 text-sm font-mono" placeholder="01012345678" maxlength="11"
                 oninput="this.value=this.value.replace(/[^0-9]/g,'')">
          <button onclick="checkPhoneStatus()" class="px-5 py-3 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-800">조회</button>
        </div>
        <div id="phone-status-result" class="mt-4"></div>
      </div>
    </div>`;
}

let verifyTimerInterval = null;

async function sendOTP() {
  const phone = document.getElementById('verify-phone').value;
  const purpose = document.getElementById('verify-purpose').value;
  const userId = document.getElementById('verify-user-id').value;
  
  if (!phone || phone.length < 10) { showToast('올바른 핸드폰 번호를 입력하세요.', 'error'); return; }

  const payload = { phone, purpose };
  if (userId) payload.user_id = Number(userId);

  const res = await api('POST', '/hr/phone/send-otp', payload);
  if (res?.ok) {
    showToast('인증번호가 발송되었습니다.', 'success');
    document.getElementById('verify-step-1').style.display = 'none';
    document.getElementById('verify-step-2').style.display = 'block';
    document.getElementById('verify-sent-phone').textContent = formatPhone(phone);
    
    // 개발환경 OTP 표시
    if (res._dev_otp) {
      document.getElementById('verify-dev-hint').style.display = 'block';
      document.getElementById('dev-otp-code').textContent = res._dev_otp;
    }

    // 타이머
    let remaining = 180;
    clearInterval(verifyTimerInterval);
    verifyTimerInterval = setInterval(() => {
      remaining--;
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      document.getElementById('verify-timer').textContent = `유효 시간: ${m}:${String(s).padStart(2, '0')}`;
      if (remaining <= 0) { clearInterval(verifyTimerInterval); document.getElementById('verify-timer').innerHTML = '<span class="text-red-500">시간 초과. 다시 요청하세요.</span>'; }
    }, 1000);

    document.getElementById('verify-otp').focus();
  } else {
    showToast(res?.error || '발송 실패', 'error');
  }
}

async function verifyOTP() {
  const phone = document.getElementById('verify-phone').value;
  const otpCode = document.getElementById('verify-otp').value;
  const purpose = document.getElementById('verify-purpose').value;

  if (!otpCode || otpCode.length !== 6) { showToast('6자리 인증번호를 입력하세요.', 'error'); return; }

  const res = await api('POST', '/hr/phone/verify-otp', { phone, otp_code: otpCode, purpose });
  const resultEl = document.getElementById('verify-result');
  resultEl.style.display = 'block';

  if (res?.verified) {
    clearInterval(verifyTimerInterval);
    resultEl.innerHTML = `
      <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <i class="fas fa-check-circle text-green-500 text-3xl mb-2"></i>
        <p class="font-bold text-green-800">인증 성공!</p>
        <p class="text-sm text-green-600 mt-1">${formatPhone(phone)} 번호가 인증되었습니다.</p>
      </div>`;
    showToast('핸드폰 인증 완료!', 'success');
  } else {
    resultEl.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
        <i class="fas fa-times-circle mr-1"></i>${res?.error || '인증 실패'}
      </div>`;
  }
}

function resetVerify() {
  clearInterval(verifyTimerInterval);
  document.getElementById('verify-step-1').style.display = 'block';
  document.getElementById('verify-step-2').style.display = 'none';
  document.getElementById('verify-result').style.display = 'none';
  document.getElementById('verify-otp').value = '';
}

async function checkPhoneStatus() {
  const phone = document.getElementById('check-phone').value;
  if (!phone) { showToast('전화번호를 입력하세요.', 'error'); return; }

  const res = await api('GET', `/hr/phone/status?phone=${phone}`);
  const resultEl = document.getElementById('phone-status-result');
  
  if (res) {
    resultEl.innerHTML = `
      <div class="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
        <div class="flex justify-between"><span class="text-gray-500">전화번호:</span><span class="font-mono">${formatPhone(res.phone)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500">인증 기록:</span>
          <span>${res.has_verified_record ? '<i class="fas fa-check-circle text-green-500 mr-1"></i>있음' : '<i class="fas fa-times-circle text-red-400 mr-1"></i>없음'}</span>
        </div>
        ${res.last_verified_at ? `<div class="flex justify-between"><span class="text-gray-500">마지막 인증:</span><span>${formatDate(res.last_verified_at)}</span></div>` : ''}
        <div class="flex justify-between"><span class="text-gray-500">등록 사용자:</span>
          <span>${res.registered_user ? `${res.registered_user.name} (ID:${res.registered_user.user_id}) ${res.registered_user.phone_verified ? '✅인증' : '❌미인증'}` : '미등록'}</span>
        </div>
      </div>`;
  }
}

// ─── 초기화 ───
(async () => {
  await checkAuth();
  render();
})();
