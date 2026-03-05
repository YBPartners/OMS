// ============================================================
// 다하다 OMS — 글로벌 검색 (Cmd+K) + 주문 타임라인 + 시스템 관리 v13.0
// ============================================================

// ════════ 글로벌 검색 (Cmd+K / Ctrl+K) ════════

let _searchDebounce = null;

function initGlobalSearch() {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      showGlobalSearchModal();
    }
  });
}

function showGlobalSearchModal() {
  closeModal();
  const html = `
    <div id="modal-overlay" class="fixed inset-0 z-50 modal-overlay flex items-start justify-center pt-[15vh]" onclick="if(event.target===this)closeModal()">
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full fade-in" style="max-height:70vh;">
        <div class="flex items-center gap-3 px-5 py-4 border-b">
          <i class="fas fa-search text-gray-400 text-lg"></i>
          <input id="global-search-input" type="text" autofocus
            class="flex-1 text-lg outline-none placeholder-gray-400"
            placeholder="주문, 사용자, 조직 검색... (2자 이상)"
            oninput="onGlobalSearchInput(this.value)">
          <kbd class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono">ESC</kbd>
        </div>
        <div id="global-search-results" class="overflow-y-auto" style="max-height:calc(70vh - 80px);">
          <div class="py-12 text-center text-gray-400">
            <i class="fas fa-compass text-3xl mb-3"></i>
            <p class="text-sm">검색어를 입력하세요</p>
            <p class="text-xs mt-1 text-gray-300">Cmd+K 또는 Ctrl+K로 빠르게 열 수 있습니다</p>
          </div>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('global-search-input')?.focus();
}

function onGlobalSearchInput(q) {
  clearTimeout(_searchDebounce);
  if (!q || q.length < 2) {
    document.getElementById('global-search-results').innerHTML = `
      <div class="py-12 text-center text-gray-400">
        <i class="fas fa-compass text-3xl mb-3"></i>
        <p class="text-sm">2자 이상 입력하세요</p>
      </div>`;
    return;
  }
  document.getElementById('global-search-results').innerHTML = `
    <div class="py-8 text-center text-gray-400"><i class="fas fa-spinner fa-spin text-xl"></i></div>`;
  _searchDebounce = setTimeout(() => executeGlobalSearch(q), 300);
}

async function executeGlobalSearch(q) {
  const res = await api('GET', `/system/search?q=${encodeURIComponent(q)}`);
  const results = res?.results || [];
  const el = document.getElementById('global-search-results');
  if (!el) return;

  if (results.length === 0) {
    el.innerHTML = `
      <div class="py-12 text-center text-gray-400">
        <i class="fas fa-search text-3xl mb-3"></i>
        <p class="text-sm">'${q}'에 대한 검색 결과가 없습니다</p>
      </div>`;
    return;
  }

  const typeIcons = { order: 'fa-box text-blue-500', user: 'fa-user text-teal-500', org: 'fa-building text-purple-500' };
  const typeLabels = { order: '주문', user: '사용자', org: '조직' };

  el.innerHTML = `
    <div class="py-2">
      <div class="px-4 py-1 text-xs text-gray-400">${results.length}건 검색됨</div>
      ${results.map((r, i) => `
        <button class="w-full flex items-center gap-3 px-5 py-3 hover:bg-blue-50 transition text-left group"
          onclick="closeModal();handleSearchResult(${JSON.stringify(r).replace(/"/g, '&quot;')})">
          <div class="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition">
            <i class="fas ${typeIcons[r.type] || 'fa-circle'}"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-sm truncate">${r.title}</div>
            <div class="text-xs text-gray-500 truncate">${r.subtitle || ''}</div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${r.status ? statusBadge(r.status) : ''}
            ${r.amount ? `<span class="text-xs font-medium text-blue-600">${formatAmount(r.amount)}</span>` : ''}
            <span class="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">${typeLabels[r.type] || r.type}</span>
          </div>
        </button>
      `).join('')}
    </div>`;
}

function handleSearchResult(r) {
  if (r.type === 'order') {
    showOrderTimelineModal(r.id);
  } else if (r.action) {
    if (r.filter?.tab) window._hrTab = r.filter.tab;
    navigateTo(r.action);
  }
}

// ════════ 주문 타임라인 ════════

async function showOrderTimelineModal(orderId) {
  showToast('타임라인 로딩 중...', 'info');

  const [timelineRes, orderRes] = await Promise.all([
    api('GET', `/system/order-timeline/${orderId}`),
    api('GET', `/orders/${orderId}`),
  ]);

  const timeline = timelineRes?.timeline || [];
  const order = orderRes?.order || orderRes || {};
  const counts = timelineRes?.counts || {};

  const actionIcons = {
    'ORDER.CREATED': { icon: 'fa-plus-circle', color: 'text-blue-500', bg: 'bg-blue-100' },
    'ORDER.UPDATED': { icon: 'fa-edit', color: 'text-yellow-500', bg: 'bg-yellow-100' },
    'ORDER.STATUS_CHANGED': { icon: 'fa-exchange-alt', color: 'text-indigo-500', bg: 'bg-indigo-100' },
    'DISTRIBUTED': { icon: 'fa-share-alt', color: 'text-purple-500', bg: 'bg-purple-100' },
    'ASSIGNED': { icon: 'fa-user-check', color: 'text-teal-500', bg: 'bg-teal-100' },
    'REPORT_SUBMITTED': { icon: 'fa-file-alt', color: 'text-cyan-500', bg: 'bg-cyan-100' },
    'REVIEW_APPROVED': { icon: 'fa-check-circle', color: 'text-green-500', bg: 'bg-green-100' },
    'REVIEW_REJECTED': { icon: 'fa-times-circle', color: 'text-red-500', bg: 'bg-red-100' },
    'SETTLEMENT': { icon: 'fa-coins', color: 'text-amber-500', bg: 'bg-amber-100' },
    'LOGIN_FAILED': { icon: 'fa-ban', color: 'text-red-500', bg: 'bg-red-100' },
  };
  const getIcon = (action) => actionIcons[action] || { icon: 'fa-circle', color: 'text-gray-400', bg: 'bg-gray-100' };

  const content = `
    <div class="space-y-5">
      <!-- 주문 요약 -->
      <div class="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <div class="flex items-center justify-between">
          <div>
            <span class="text-lg font-bold text-blue-800">#${orderId}</span>
            <span class="ml-2">${order.customer_name || ''}</span>
            ${order.status ? statusBadge(order.status) : ''}
          </div>
          <div class="text-right text-sm text-blue-600">
            ${order.base_amount ? formatAmount(order.base_amount) : ''}
          </div>
        </div>
        <div class="text-xs text-blue-500 mt-1">${order.address_text || ''}</div>
      </div>

      <!-- 이벤트 카운트 -->
      <div class="flex gap-2 flex-wrap">
        ${Object.entries(counts).map(([k, v]) => 
          v > 0 ? `<span class="px-2 py-1 bg-gray-100 rounded-lg text-xs"><i class="fas fa-hashtag text-gray-400 mr-1"></i>${k}: ${v}</span>` : ''
        ).join('')}
      </div>

      <!-- 타임라인 -->
      <div class="relative pl-6 border-l-2 border-gray-200 space-y-4">
        ${timeline.length === 0 ? '<p class="text-gray-400 text-sm py-4">이력 정보가 없습니다.</p>' : ''}
        ${timeline.map(t => {
          const icon = getIcon(t.action);
          const detailStr = t.detail ? Object.entries(t.detail)
            .filter(([k, v]) => v != null && k !== 'checklist')
            .map(([k, v]) => `<span class="inline-block mr-2">${k}: <strong>${v}</strong></span>`)
            .join('') : '';
          return `
          <div class="relative">
            <div class="absolute -left-[calc(0.75rem+13px)] w-6 h-6 rounded-full ${icon.bg} flex items-center justify-center">
              <i class="fas ${icon.icon} ${icon.color} text-xs"></i>
            </div>
            <div class="bg-white rounded-lg p-3 border border-gray-100 hover:shadow-sm transition">
              <div class="flex items-center justify-between">
                <div class="font-medium text-sm">${t.action}</div>
                <div class="text-xs text-gray-400">${formatDate(t.time)}</div>
              </div>
              <div class="text-xs text-gray-500 mt-1">
                <i class="fas fa-user text-gray-300 mr-1"></i>${t.actor}
              </div>
              ${detailStr ? `<div class="text-xs text-gray-600 mt-1.5 bg-gray-50 rounded px-2 py-1">${detailStr}</div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  showModal(
    `<i class="fas fa-timeline text-blue-500 mr-2"></i>주문 #${orderId} 타임라인`,
    content,
    `<button onclick="closeModal();window._orderFilters={order_id:${orderId}};navigateTo('orders')" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">주문 상세</button>
     <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">닫기</button>`,
    { large: true }
  );
}

// ════════ 시스템 관리 페이지 ════════

async function renderSystemAdmin(el) {
  const res = await api('GET', '/system/info');
  if (!res?.stats) { el.innerHTML = '<div class="text-center text-gray-400 py-16">시스템 정보를 불러올 수 없습니다.</div>'; return; }

  const s = res.stats;
  const sys = res.system;

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-cog mr-2 text-gray-600"></i>시스템 관리</h2>

      <!-- 시스템 카드 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-white rounded-xl p-5 border"><div class="text-xs text-gray-500 mb-1">버전</div><div class="text-xl font-bold text-blue-600">${sys.version}</div></div>
        <div class="bg-white rounded-xl p-5 border"><div class="text-xs text-gray-500 mb-1">사용자</div><div class="text-xl font-bold text-teal-600">${s.users}명</div></div>
        <div class="bg-white rounded-xl p-5 border"><div class="text-xs text-gray-500 mb-1">주문</div><div class="text-xl font-bold text-indigo-600">${formatNumber(s.orders)}건</div></div>
        <div class="bg-white rounded-xl p-5 border"><div class="text-xs text-gray-500 mb-1">활성 세션</div><div class="text-xl font-bold text-amber-600">${s.active_sessions}개</div></div>
      </div>

      <!-- 세션 관리 -->
      <div class="bg-white rounded-xl p-6 border mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold"><i class="fas fa-users-cog mr-2 text-amber-500"></i>활성 세션 관리</h3>
          <button onclick="purgeAllSessions()" class="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs hover:bg-red-200">
            <i class="fas fa-broom mr-1"></i>전체 세션 초기화
          </button>
        </div>
        <div id="session-list"><div class="text-center text-gray-400 py-4"><i class="fas fa-spinner fa-spin"></i> 로딩...</div></div>
      </div>

      <!-- 데이터 테이블 정보 -->
      <div class="bg-white rounded-xl p-6 border">
        <h3 class="text-lg font-semibold mb-4"><i class="fas fa-database mr-2 text-indigo-500"></i>데이터베이스 현황</h3>
        <div id="db-table-info"><div class="text-center text-gray-400 py-4"><i class="fas fa-spinner fa-spin"></i> 로딩...</div></div>
      </div>
    </div>`;

  // 세션 목록 로드
  loadSessionList();
  loadBackupInfo();
}

async function loadSessionList() {
  const res = await api('GET', '/system/sessions');
  const sessions = res?.sessions || [];
  const el = document.getElementById('session-list');
  if (!el) return;

  el.innerHTML = sessions.length === 0 ? '<p class="text-gray-400 text-sm">활성 세션이 없습니다.</p>' : `
    <table class="w-full text-sm">
      <thead class="bg-gray-50"><tr>
        <th class="px-3 py-2 text-left">사용자</th>
        <th class="px-3 py-2 text-left">로그인 ID</th>
        <th class="px-3 py-2 text-left">생성 시간</th>
        <th class="px-3 py-2 text-left">만료 시간</th>
        <th class="px-3 py-2 text-center">액션</th>
      </tr></thead>
      <tbody class="divide-y">${sessions.map(s => `
        <tr class="hover:bg-gray-50">
          <td class="px-3 py-2 font-medium">${s.user_name}</td>
          <td class="px-3 py-2 text-gray-600">${s.login_id}</td>
          <td class="px-3 py-2 text-xs text-gray-500">${formatDate(s.created_at)}</td>
          <td class="px-3 py-2 text-xs text-gray-500">${formatDate(s.expires_at)}</td>
          <td class="px-3 py-2 text-center">
            <button onclick="revokeSession('${s.session_id}')" class="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100">
              <i class="fas fa-ban mr-1"></i>강제종료
            </button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

async function loadBackupInfo() {
  const res = await api('GET', '/system/backup-info');
  const info = res?.backup_info;
  const el = document.getElementById('db-table-info');
  if (!el || !info) return;

  el.innerHTML = `
    <div class="mb-3 text-sm text-gray-600">총 <strong>${info.tables.length}</strong>개 테이블, <strong>${formatNumber(info.total_rows)}</strong>행</div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
      ${info.tables.map(t => `
        <div class="px-3 py-2 bg-gray-50 rounded-lg flex justify-between items-center">
          <span class="text-xs font-mono">${t.name}</span>
          <span class="text-xs font-bold ${t.row_count > 0 ? 'text-blue-600' : 'text-gray-400'}">${formatNumber(t.row_count)}</span>
        </div>`).join('')}
    </div>`;
}

async function revokeSession(sid) {
  showConfirmModal('세션 강제종료', '이 세션을 강제 종료하시겠습니까? 해당 사용자는 즉시 로그아웃됩니다.', async () => {
    const res = await api('DELETE', `/system/sessions/${sid}`);
    if (res?.ok) { showToast('세션 강제종료 완료', 'success'); loadSessionList(); }
    else showToast(res?.error || '처리 실패', 'error');
  }, '강제종료', 'bg-red-600');
}

async function purgeAllSessions() {
  showConfirmModal('전체 세션 초기화', '본인을 제외한 모든 활성 세션을 종료합니다. 다른 모든 사용자가 로그아웃됩니다. 계속하시겠습니까?', async () => {
    const res = await api('DELETE', '/system/sessions');
    if (res?.ok) { showToast(`${res.purged}개 세션 종료 완료`, 'success'); loadSessionList(); }
    else showToast(res?.error || '처리 실패', 'error');
  }, '전체 초기화', 'bg-red-600');
}

// 초기화 — DOM 로드 후 글로벌 검색 이벤트 등록
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initGlobalSearch);
}
