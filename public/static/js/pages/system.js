// ============================================================
// 와이비 OMS — 글로벌 검색 (Cmd+K) + 주문 타임라인 + 시스템 관리 v14.0
// v14.0: 데이터 임포트/백업 + 푸시 알림 + 매출/정산 차트
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
        <p class="text-sm">'${escapeHtml(q)}'에 대한 검색 결과가 없습니다</p>
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
            <div class="font-medium text-sm truncate">${escapeHtml(r.title)}</div>
            <div class="text-xs text-gray-500 truncate">${escapeHtml(r.subtitle || '')}</div></div>
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

      <!-- 탭 네비게이션 -->
      <div class="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        <button onclick="switchSystemTab('sessions')" id="sys-tab-sessions" class="flex-1 px-4 py-2 rounded-md text-sm font-medium bg-white shadow text-blue-600">
          <i class="fas fa-users-cog mr-1"></i>세션 관리
        </button>
        <button onclick="switchSystemTab('database')" id="sys-tab-database" class="flex-1 px-4 py-2 rounded-md text-sm font-medium text-gray-600">
          <i class="fas fa-database mr-1"></i>DB 현황
        </button>
        <button onclick="switchSystemTab('import')" id="sys-tab-import" class="flex-1 px-4 py-2 rounded-md text-sm font-medium text-gray-600">
          <i class="fas fa-file-import mr-1"></i>데이터 임포트
        </button>
        <button onclick="switchSystemTab('backup')" id="sys-tab-backup" class="flex-1 px-4 py-2 rounded-md text-sm font-medium text-gray-600">
          <i class="fas fa-shield-halved mr-1"></i>백업/복원
        </button>
      </div>

      <div id="sys-tab-content">
        <!-- 세션 관리 (기본) -->
        <div id="sys-panel-sessions">
          <div class="bg-white rounded-xl p-6 border">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold"><i class="fas fa-users-cog mr-2 text-amber-500"></i>활성 세션 관리</h3>
              <button onclick="purgeAllSessions()" class="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs hover:bg-red-200">
                <i class="fas fa-broom mr-1"></i>전체 세션 초기화
              </button>
            </div>
            <div id="session-list"><div class="text-center text-gray-400 py-4"><i class="fas fa-spinner fa-spin"></i> 로딩...</div></div>
          </div>
        </div>

        <!-- DB 현황 (숨김) -->
        <div id="sys-panel-database" style="display:none;">
          <div class="bg-white rounded-xl p-6 border">
            <h3 class="text-lg font-semibold mb-4"><i class="fas fa-database mr-2 text-indigo-500"></i>데이터베이스 현황</h3>
            <div id="db-table-info"><div class="text-center text-gray-400 py-4"><i class="fas fa-spinner fa-spin"></i> 로딩...</div></div>
          </div>
        </div>

        <!-- 데이터 임포트 (숨김) -->
        <div id="sys-panel-import" style="display:none;">
          <div class="bg-white rounded-xl p-6 border">
            <h3 class="text-lg font-semibold mb-4"><i class="fas fa-file-import mr-2 text-green-500"></i>데이터 임포트</h3>
            <p class="text-sm text-gray-500 mb-4">CSV 또는 JSON 형식의 데이터를 업로드하여 시스템에 일괄 입력할 수 있습니다.</p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- 임포트 설정 -->
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">대상 테이블</label>
                  <select id="import-table" class="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="orders">주문 (orders)</option>
                    <option value="users">사용자 (users)</option>
                    <option value="organizations">조직 (organizations)</option>
                    <option value="commission_policies">수수료 정책 (commission_policies)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">임포트 모드</label>
                  <select id="import-mode" class="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="insert">신규 삽입 (중복 무시)</option>
                    <option value="upsert">Upsert (있으면 업데이트)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">데이터 (JSON 배열)</label>
                  <textarea id="import-data" class="w-full border rounded-lg px-3 py-2 text-sm font-mono h-40" 
                    placeholder='[{"external_order_no":"ORD-001","customer_name":"홍길동","base_amount":50000}]'></textarea>
                </div>
                <div class="flex items-center gap-2">
                  <input type="file" id="import-file" accept=".csv,.json" onchange="handleImportFile(this)" class="text-sm text-gray-500">
                  <span class="text-xs text-gray-400">CSV/JSON 파일 업로드</span>
                </div>
              </div>

              <!-- 임포트 가이드 -->
              <div class="bg-gray-50 rounded-xl p-4 space-y-3">
                <h4 class="font-semibold text-sm"><i class="fas fa-info-circle mr-1 text-blue-500"></i>임포트 가이드</h4>
                <div id="import-guide">
                  <p class="text-xs text-gray-600 mb-2"><strong>orders</strong> 허용 컬럼:</p>
                  <div class="flex flex-wrap gap-1 mb-3">
                    ${['external_order_no','customer_name','customer_phone','address_text','service_type','base_amount','requested_date','memo'].map(c => 
                      `<span class="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-mono">${c}</span>`
                    ).join('')}
                  </div>
                  <p class="text-xs text-gray-600 mb-2"><strong>users</strong> 허용 컬럼:</p>
                  <div class="flex flex-wrap gap-1 mb-3">
                    ${['login_id','name','phone','email','org_id'].map(c => 
                      `<span class="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-[10px] font-mono">${c}</span>`
                    ).join('')}
                  </div>
                  <div class="mt-3 p-2 bg-yellow-50 rounded-lg">
                    <p class="text-[10px] text-yellow-700"><i class="fas fa-exclamation-triangle mr-1"></i>최대 500행까지 한번에 임포트 가능합니다.</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-3 mt-4">
              <button onclick="executeImport()" class="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                <i class="fas fa-upload mr-1"></i>임포트 실행
              </button>
              <div id="import-result" class="text-sm"></div>
            </div>
          </div>
        </div>

        <!-- 백업/복원 (숨김) -->
        <div id="sys-panel-backup" style="display:none;">
          <div class="space-y-6">
            <!-- 스냅샷 백업 -->
            <div class="bg-white rounded-xl p-6 border">
              <h3 class="text-lg font-semibold mb-4"><i class="fas fa-download mr-2 text-blue-500"></i>스냅샷 백업</h3>
              <p class="text-sm text-gray-500 mb-4">전체 데이터를 JSON 파일로 다운로드합니다. 복원 시 이 파일을 업로드하세요.</p>
              <div class="space-y-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">백업 대상 테이블</label>
                  <div class="flex flex-wrap gap-2" id="backup-table-checks">
                    ${['orders','users','organizations','user_roles','order_distributions','order_assignments','settlements','commission_policies','order_channels'].map(t => `
                      <label class="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded text-xs cursor-pointer hover:bg-blue-50">
                        <input type="checkbox" value="${t}" checked class="w-3 h-3"> ${t}
                      </label>
                    `).join('')}
                  </div>
                </div>
                <button onclick="createSnapshot()" class="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  <i class="fas fa-camera mr-1"></i>스냅샷 생성 & 다운로드
                </button>
              </div>
            </div>

            <!-- 스냅샷 복원 -->
            <div class="bg-white rounded-xl p-6 border">
              <h3 class="text-lg font-semibold mb-4"><i class="fas fa-upload mr-2 text-amber-500"></i>스냅샷 복원</h3>
              <p class="text-sm text-gray-500 mb-4">이전에 백업한 JSON 스냅샷 파일을 업로드하여 데이터를 복원합니다.</p>
              <div class="space-y-3">
                <input type="file" id="restore-file" accept=".json" class="text-sm text-gray-500">
                <label class="flex items-center gap-2 text-sm">
                  <input type="checkbox" id="restore-clear" class="w-4 h-4 text-red-600">
                  <span class="text-red-600 font-medium">기존 데이터 삭제 후 복원</span>
                  <span class="text-xs text-gray-400">(주의: 되돌릴 수 없음)</span>
                </label>
                <button onclick="restoreSnapshot()" class="px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">
                  <i class="fas fa-undo mr-1"></i>복원 실행
                </button>
                <div id="restore-result" class="text-sm"></div>
              </div>
            </div>
          </div>
        </div>
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

// ════════ 시스템 탭 전환 ════════
function switchSystemTab(tab) {
  ['sessions', 'database', 'import', 'backup'].forEach(t => {
    const panel = document.getElementById(`sys-panel-${t}`);
    const btn = document.getElementById(`sys-tab-${t}`);
    if (panel) panel.style.display = t === tab ? '' : 'none';
    if (btn) {
      btn.className = t === tab
        ? 'flex-1 px-4 py-2 rounded-md text-sm font-medium bg-white shadow text-blue-600'
        : 'flex-1 px-4 py-2 rounded-md text-sm font-medium text-gray-600';
    }
  });
  // 탭 전환 시 데이터 로드
  if (tab === 'database') loadBackupInfo();
  if (tab === 'sessions') loadSessionList();
}

// ════════ 데이터 임포트 ════════
function handleImportFile(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    try {
      if (file.name.endsWith('.json')) {
        // JSON 파일
        const data = JSON.parse(text);
        document.getElementById('import-data').value = JSON.stringify(Array.isArray(data) ? data : [data], null, 2);
      } else if (file.name.endsWith('.csv')) {
        // CSV → JSON 변환
        const rows = parseCSV(text);
        document.getElementById('import-data').value = JSON.stringify(rows, null, 2);
        showToast(`CSV ${rows.length}행 파싱 완료`, 'success');
      }
    } catch (err) {
      showToast('파일 파싱 오류: ' + err.message, 'error');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  
  // BOM 제거
  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => {
      if (values[i] !== undefined && values[i] !== '') {
        // 숫자인지 판별
        obj[h] = isNaN(values[i]) ? values[i] : Number(values[i]);
      }
    });
    return obj;
  }).filter(obj => Object.keys(obj).length > 0);
}

async function executeImport() {
  const table = document.getElementById('import-table')?.value;
  const mode = document.getElementById('import-mode')?.value;
  const dataText = document.getElementById('import-data')?.value?.trim();
  const resultEl = document.getElementById('import-result');

  if (!dataText) { showToast('데이터를 입력하세요.', 'warning'); return; }

  let rows;
  try {
    rows = JSON.parse(dataText);
    if (!Array.isArray(rows)) rows = [rows];
  } catch {
    showToast('JSON 형식이 올바르지 않습니다.', 'error'); return;
  }

  showConfirmModal(
    '데이터 임포트 확인',
    `<strong>${table}</strong> 테이블에 <strong>${rows.length}</strong>행을 <strong>${mode === 'upsert' ? 'Upsert' : '신규 삽입'}</strong> 모드로 임포트합니다. 계속하시겠습니까?`,
    async () => {
      if (resultEl) resultEl.innerHTML = '<i class="fas fa-spinner fa-spin text-blue-500"></i> 처리 중...';
      const res = await api('POST', `/system/import/${table}`, { rows, mode });
      if (res?.ok) {
        if (resultEl) resultEl.innerHTML = `
          <span class="text-green-600"><i class="fas fa-check-circle mr-1"></i>
            ${res.imported}건 임포트 / ${res.skipped}건 스킵
            ${res.errors?.length ? `<span class="text-red-500 ml-2">${res.errors.length}개 오류</span>` : ''}
          </span>`;
        showToast(`${res.imported}건 임포트 완료`, 'success');
      } else {
        if (resultEl) resultEl.innerHTML = `<span class="text-red-600"><i class="fas fa-times-circle mr-1"></i>${res?.error || '처리 실패'}</span>`;
        showToast(res?.error || '임포트 실패', 'error');
      }
    },
    '임포트 실행', 'bg-green-600'
  );
}

// ════════ 스냅샷 백업/복원 ════════
async function createSnapshot() {
  const checks = document.querySelectorAll('#backup-table-checks input[type="checkbox"]:checked');
  const tables = Array.from(checks).map(c => c.value);
  if (tables.length === 0) { showToast('백업할 테이블을 선택하세요.', 'warning'); return; }

  showToast('스냅샷 생성 중...', 'info');
  const res = await api('GET', `/system/snapshot?tables=${tables.join(',')}`);
  if (!res?.snapshot) { showToast('스냅샷 생성 실패', 'error'); return; }

  // JSON 다운로드
  const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `yb-oms-snapshot_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${res.meta.total_rows}행 스냅샷 다운로드 완료`, 'success');
}

async function restoreSnapshot() {
  const file = document.getElementById('restore-file')?.files[0];
  if (!file) { showToast('스냅샷 파일을 선택하세요.', 'warning'); return; }

  const clearBefore = document.getElementById('restore-clear')?.checked || false;
  const resultEl = document.getElementById('restore-result');

  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    showToast('올바른 JSON 파일이 아닙니다.', 'error'); return;
  }

  if (!data.snapshot) { showToast('유효한 스냅샷 파일이 아닙니다.', 'error'); return; }

  const tableCount = Object.keys(data.snapshot).length;
  const rowCount = data.meta?.total_rows || '알 수 없는';

  showConfirmModal(
    '스냅샷 복원',
    `<div class="text-left space-y-2">
      <p>${tableCount}개 테이블, ${rowCount}행을 복원합니다.</p>
      ${clearBefore ? '<p class="text-red-600 font-bold"><i class="fas fa-exclamation-triangle mr-1"></i>기존 데이터가 삭제됩니다!</p>' : ''}
      <p class="text-gray-500 text-xs">스냅샷 생성일: ${data.meta?.created_at || '알 수 없음'}</p>
    </div>`,
    async () => {
      if (resultEl) resultEl.innerHTML = '<i class="fas fa-spinner fa-spin text-amber-500"></i> 복원 중...';
      const res = await api('POST', '/system/snapshot/restore', {
        snapshot: data.snapshot,
        options: { clear_before: clearBefore },
      });
      if (res?.ok) {
        const summary = Object.entries(res.results).map(([t, r]) =>
          `${t}: ${r.restored}건 복원${r.errors ? `, ${r.errors}건 오류` : ''}`
        ).join('\n');
        if (resultEl) resultEl.innerHTML = `<span class="text-green-600"><i class="fas fa-check-circle mr-1"></i>복원 완료</span>`;
        showToast('스냅샷 복원 완료', 'success');
      } else {
        if (resultEl) resultEl.innerHTML = `<span class="text-red-600">${res?.error || '복원 실패'}</span>`;
        showToast(res?.error || '복원 실패', 'error');
      }
    },
    clearBefore ? '삭제 후 복원' : '복원', clearBefore ? 'bg-red-600' : 'bg-amber-600'
  );
}

// ════════ 웹 푸시 알림 ════════
async function initPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[Push] Service Worker 등록 성공');

    // 기존 구독 확인
    const sub = await reg.pushManager.getSubscription();
    window._pushSubscription = sub;
    window._swRegistration = reg;
  } catch (err) {
    console.warn('[Push] Service Worker 등록 실패:', err);
  }
}

async function subscribePush() {
  if (!window._swRegistration) { showToast('Service Worker가 아직 준비되지 않았습니다.', 'warning'); return; }

  try {
    // VAPID key가 없으면 로컬 알림만 사용
    const sub = await window._swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: null, // VAPID key 미설정 시 null
    });
    window._pushSubscription = sub;
    await api('POST', '/system/push/subscribe', { subscription: sub.toJSON() });
    showToast('푸시 알림이 활성화되었습니다.', 'success');
  } catch (err) {
    // Push subscription 실패 시 로컬 알림 모드
    console.warn('[Push] 서버 푸시 구독 실패, 로컬 알림 모드:', err);
    showToast('로컬 알림 모드로 전환됩니다.', 'info');
    window._pushLocalMode = true;
  }
}

async function unsubscribePush() {
  if (window._pushSubscription) {
    try {
      await window._pushSubscription.unsubscribe();
    } catch { /* ignore */ }
  }
  window._pushSubscription = null;
  await api('POST', '/system/push/unsubscribe');
  showToast('푸시 알림이 비활성화되었습니다.', 'success');
}

// 로컬 알림 발송 (Service Worker 메시지)
function showLocalNotification(title, body, url = '/') {
  if (!window._swRegistration) return;
  window._swRegistration.active?.postMessage({
    type: 'SHOW_NOTIFICATION',
    title, body, url,
    tag: 'yb-' + Date.now(),
  });
}

// Service Worker 알림 클릭 핸들링
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'NOTIFICATION_CLICK' && e.data.url) {
      window.location.hash = e.data.url.replace('/', '');
    }
  });
}

// 초기화
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initPushNotifications();
  });
}
