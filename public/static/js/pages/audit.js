// ============================================================
// 와이비 OMS - 감사 로그(Audit Log) 페이지 v5.5
// SUPER_ADMIN, HQ_OPERATOR, AUDITOR 전용
// ============================================================

// ─── 감사 로그 상태 ───
const auditState = {
  tab: 'list',  // 'list' | 'stats'
  filters: {
    entity_type: '',
    action: '',
    actor_id: '',
    from: '',
    to: '',
    search: '',
    page: 1,
    limit: 20,
  },
};

async function renderAuditLog(el) {
  const tab = auditState.tab;
  
  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">
          <i class="fas fa-scroll mr-2 text-indigo-600"></i>감사 로그
        </h2>
        <div class="flex gap-2">
          <button onclick="auditState.tab='list';renderContent()" 
            class="px-4 py-2 ${tab === 'list' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'} rounded-lg text-sm">
            <i class="fas fa-list mr-1"></i>로그 목록
          </button>
          <button onclick="auditState.tab='stats';renderContent()" 
            class="px-4 py-2 ${tab === 'stats' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'} rounded-lg text-sm">
            <i class="fas fa-chart-bar mr-1"></i>통계
          </button>
        </div>
      </div>
      <div id="audit-content"></div>
    </div>`;

  const contentEl = document.getElementById('audit-content');
  if (tab === 'list') await renderAuditList(contentEl);
  else await renderAuditStats(contentEl);
}

// ─── 로그 목록 ───
async function renderAuditList(el) {
  const f = auditState.filters;
  const params = new URLSearchParams();
  if (f.entity_type) params.set('entity_type', f.entity_type);
  if (f.action) params.set('action', f.action);
  if (f.actor_id) params.set('actor_id', f.actor_id);
  if (f.from) params.set('from', f.from);
  if (f.to) params.set('to', f.to);
  if (f.search) params.set('search', f.search);
  params.set('page', f.page);
  params.set('limit', f.limit);

  const res = await api('GET', `/audit?${params.toString()}`);
  if (!res) return;

  const logs = res.logs || [];
  const total = res.total || 0;
  const totalPages = Math.ceil(total / f.limit) || 1;

  const entityTypes = ['ORDER', 'USER', 'ORG', 'SIGNUP', 'SETTLEMENT', 'COMMISSION', 'REGION', 'AUTH', 'SESSION'];
  const today = new Date().toISOString().split('T')[0];

  el.innerHTML = `
    <!-- 필터 -->
    <div class="bg-white rounded-xl p-4 mb-4 border border-gray-100">
      <div class="flex flex-wrap gap-3 items-end">
        <div>
          <label class="block text-xs text-gray-500 mb-1">엔티티</label>
          <select id="af-entity" class="border rounded-lg px-3 py-2 text-sm" onchange="auditApplyFilter()">
            <option value="">전체</option>
            ${entityTypes.map(e => `<option value="${e}" ${f.entity_type === e ? 'selected' : ''}>${e}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">액션</label>
          <input id="af-action" class="border rounded-lg px-3 py-2 text-sm w-36" placeholder="예: LOGIN" 
            value="${f.action}" onkeypress="if(event.key==='Enter')auditApplyFilter()">
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">검색</label>
          <input id="af-search" class="border rounded-lg px-3 py-2 text-sm w-44" placeholder="이름/상세 검색..." 
            value="${f.search}" onkeypress="if(event.key==='Enter')auditApplyFilter()">
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">시작일</label>
          <input id="af-from" type="date" class="border rounded-lg px-3 py-2 text-sm" value="${f.from}">
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">종료일</label>
          <input id="af-to" type="date" class="border rounded-lg px-3 py-2 text-sm" value="${f.to || today}">
        </div>
        <button onclick="auditApplyFilter()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
          <i class="fas fa-search mr-1"></i>조회
        </button>
        <button onclick="auditResetFilter()" class="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
          <i class="fas fa-undo mr-1"></i>초기화
        </button>
      </div>
    </div>

    <!-- 결과 -->
    <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div class="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <span class="text-sm text-gray-600">
          <i class="fas fa-database mr-1 text-indigo-400"></i>총 <strong>${total.toLocaleString()}</strong>건
        </span>
        <div class="flex items-center gap-2 text-sm text-gray-500">
          <span>${f.page} / ${totalPages} 페이지</span>
        </div>
      </div>
      
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-600">
            <tr>
              <th class="px-3 py-2.5 text-left w-16">ID</th>
              <th class="px-3 py-2.5 text-left">시각</th>
              <th class="px-3 py-2.5 text-left">엔티티</th>
              <th class="px-3 py-2.5 text-left">액션</th>
              <th class="px-3 py-2.5 text-left">실행자</th>
              <th class="px-3 py-2.5 text-left">상세</th>
              <th class="px-3 py-2.5 text-center w-14">보기</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            ${logs.map(log => {
              const entityColor = auditEntityColor(log.entity_type);
              const actionParts = (log.action || '').split('.');
              const actionLabel = actionParts.length > 1 ? actionParts[1] : log.action;
              let detailPreview = '';
              try {
                const detail = JSON.parse(log.detail_json || '{}');
                const keys = Object.keys(detail).slice(0, 3);
                detailPreview = keys.map(k => `${k}: ${String(detail[k]).substring(0, 20)}`).join(', ');
              } catch { detailPreview = (log.detail_json || '').substring(0, 50); }
              
              return `
              <tr class="hover:bg-gray-50">
                <td class="px-3 py-2.5 font-mono text-xs text-gray-400">${log.log_id}</td>
                <td class="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">${formatDate(log.created_at)}</td>
                <td class="px-3 py-2.5">
                  <span class="inline-flex items-center gap-1 ${entityColor.badge} text-xs px-2 py-0.5 rounded-full font-medium">
                    <i class="fas ${entityColor.icon} text-[10px]"></i>${log.entity_type}
                  </span>
                  ${log.entity_id ? `<span class="text-xs text-gray-400 ml-1">#${log.entity_id}</span>` : ''}
                </td>
                <td class="px-3 py-2.5">
                  <span class="text-xs font-mono ${auditActionColor(actionLabel)}">${log.action}</span>
                </td>
                <td class="px-3 py-2.5">
                  <div class="flex items-center gap-1.5">
                    <div class="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                      <i class="fas fa-user text-gray-400 text-[10px]"></i>
                    </div>
                    <div>
                      <div class="text-xs font-medium">${log.actor_name || '시스템'}</div>
                      <div class="text-[10px] text-gray-400">${log.actor_org_name || ''}</div>
                    </div>
                  </div>
                </td>
                <td class="px-3 py-2.5 text-xs text-gray-500 max-w-[200px] truncate" title="${detailPreview}">
                  ${detailPreview || '<span class="text-gray-300">-</span>'}
                </td>
                <td class="px-3 py-2.5 text-center">
                  <button onclick="showAuditDetail(${log.log_id})" class="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-indigo-100 text-gray-500 hover:text-indigo-600">
                    <i class="fas fa-eye text-xs"></i>
                  </button>
                </td>
              </tr>`;
            }).join('')}
            ${logs.length === 0 ? '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400"><i class="fas fa-scroll text-3xl mb-2 block text-gray-300"></i>감사 로그가 없습니다.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
      
      <!-- 페이지네이션 -->
      <div class="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
        <span>총 ${total.toLocaleString()}건</span>
        <div class="flex gap-2">
          ${f.page > 1 ? `<button onclick="auditState.filters.page=${f.page - 1};renderContent()" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">이전</button>` : ''}
          <span class="px-3 py-1 font-medium">${f.page} / ${totalPages}</span>
          ${f.page < totalPages ? `<button onclick="auditState.filters.page=${f.page + 1};renderContent()" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">다음</button>` : ''}
        </div>
      </div>
    </div>`;
}

// ─── 통계 뷰 ───
async function renderAuditStats(el) {
  const res = await api('GET', '/audit/stats');
  if (!res) return;

  const byEntity = res.by_entity || [];
  const byAction = res.by_action || [];
  const byActor = res.by_actor || [];
  const daily = res.daily || [];

  el.innerHTML = `
    <div class="space-y-6">
      <!-- 전체 요약 -->
      <div class="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
            <i class="fas fa-scroll text-3xl"></i>
          </div>
          <div>
            <div class="text-4xl font-bold">${(res.total || 0).toLocaleString()}</div>
            <div class="text-indigo-200">총 감사 로그</div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- 엔티티 유형별 -->
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <h3 class="font-semibold mb-4"><i class="fas fa-cubes mr-2 text-blue-500"></i>엔티티 유형별</h3>
          <div class="space-y-2">
            ${byEntity.map(e => {
              const max = Math.max(...byEntity.map(x => x.count), 1);
              const pct = (e.count / max * 100);
              const color = auditEntityColor(e.entity_type);
              return `
              <div class="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-lg p-1 -mx-1"
                   onclick="auditState.tab='list';auditState.filters.entity_type='${e.entity_type}';auditState.filters.page=1;renderContent()">
                <div class="w-20 text-xs font-medium text-right">
                  <span class="${color.badge} px-1.5 py-0.5 rounded-full text-[10px]">${e.entity_type}</span>
                </div>
                <div class="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div class="h-full ${color.bar} rounded-full flex items-center justify-end pr-2" style="width:${Math.max(pct, 8)}%">
                    <span class="text-[10px] font-bold text-white">${e.count}</span>
                  </div>
                </div>
              </div>`;
            }).join('')}
            ${byEntity.length === 0 ? '<p class="text-gray-400 text-sm text-center py-4">데이터 없음</p>' : ''}
          </div>
        </div>

        <!-- 액션별 상위 -->
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <h3 class="font-semibold mb-4"><i class="fas fa-bolt mr-2 text-amber-500"></i>액션별 상위 20</h3>
          <div class="space-y-1 max-h-80 overflow-y-auto">
            ${byAction.map((a, i) => `
              <div class="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer text-sm"
                   onclick="auditState.tab='list';auditState.filters.action='${a.action}';auditState.filters.page=1;renderContent()">
                <div class="flex items-center gap-2">
                  <span class="w-5 text-xs text-gray-400 text-right">${i + 1}</span>
                  <span class="font-mono text-xs ${auditActionColor(a.action)}">${a.action}</span>
                </div>
                <span class="bg-gray-100 px-2 py-0.5 rounded text-xs font-bold">${a.count}</span>
              </div>
            `).join('')}
            ${byAction.length === 0 ? '<p class="text-gray-400 text-sm text-center py-4">데이터 없음</p>' : ''}
          </div>
        </div>

        <!-- 사용자별 활동 -->
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <h3 class="font-semibold mb-4"><i class="fas fa-users mr-2 text-purple-500"></i>사용자별 활동 상위 10</h3>
          <div class="space-y-2">
            ${byActor.map((a, i) => {
              const max = Math.max(...byActor.map(x => x.count), 1);
              const pct = (a.count / max * 100);
              return `
              <div class="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-lg p-1 -mx-1"
                   onclick="auditState.tab='list';auditState.filters.actor_id='${a.actor_id}';auditState.filters.page=1;renderContent()">
                <div class="w-24 flex items-center gap-2">
                  <span class="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center text-[10px] text-purple-600 font-bold">${i + 1}</span>
                  <span class="text-xs font-medium truncate">${a.actor_name || '시스템'}</span>
                </div>
                <div class="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div class="h-full bg-purple-400 rounded-full flex items-center justify-end pr-2" style="width:${Math.max(pct, 10)}%">
                    <span class="text-[10px] font-bold text-white">${a.count}</span>
                  </div>
                </div>
              </div>`;
            }).join('')}
            ${byActor.length === 0 ? '<p class="text-gray-400 text-sm text-center py-4">데이터 없음</p>' : ''}
          </div>
        </div>

        <!-- 일별 추이 -->
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <h3 class="font-semibold mb-4"><i class="fas fa-calendar-days mr-2 text-green-500"></i>일별 추이 (최근 30일)</h3>
          <div class="space-y-1 max-h-80 overflow-y-auto">
            ${daily.map(d => {
              const max = Math.max(...daily.map(x => x.count), 1);
              const pct = (d.count / max * 100);
              return `
              <div class="flex items-center gap-3">
                <div class="w-20 text-xs text-gray-500 text-right">${d.date}</div>
                <div class="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div class="h-full bg-green-400 rounded-full" style="width:${Math.max(pct, 3)}%"></div>
                </div>
                <span class="w-10 text-xs text-right font-medium">${d.count}</span>
              </div>`;
            }).join('')}
            ${daily.length === 0 ? '<p class="text-gray-400 text-sm text-center py-4">데이터 없음</p>' : ''}
          </div>
        </div>
      </div>
    </div>`;
}

// ─── 상세 모달 ───
async function showAuditDetail(logId) {
  const res = await api('GET', `/audit/${logId}`);
  if (!res?.log) return;
  const log = res.log;

  let detail = {};
  try { detail = JSON.parse(log.detail_json || '{}'); } catch {}

  const detailRows = Object.entries(detail).map(([k, v]) => {
    const val = typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
    return `
    <tr class="border-b last:border-0">
      <td class="px-3 py-2 text-gray-500 text-xs font-medium align-top w-32">${k}</td>
      <td class="px-3 py-2 font-mono text-xs break-all">${val.length > 100 ? `<pre class="whitespace-pre-wrap text-xs">${val}</pre>` : val}</td>
    </tr>`;
  }).join('');

  const entityColor = auditEntityColor(log.entity_type);

  const content = `
    <div class="space-y-4">
      <!-- 메타 정보 -->
      <div class="grid grid-cols-2 gap-4">
        <div><span class="text-xs text-gray-500">로그 ID</span><div class="font-mono text-sm">${log.log_id}</div></div>
        <div><span class="text-xs text-gray-500">시각</span><div class="text-sm">${formatDate(log.created_at)}</div></div>
        <div><span class="text-xs text-gray-500">엔티티</span>
          <div><span class="${entityColor.badge} text-xs px-2 py-0.5 rounded-full">${log.entity_type}</span>
          ${log.entity_id ? `<span class="text-gray-500 text-xs ml-1">#${log.entity_id}</span>` : ''}</div>
        </div>
        <div><span class="text-xs text-gray-500">액션</span>
          <div class="font-mono text-sm ${auditActionColor(log.action)}">${log.action}</div>
        </div>
        <div><span class="text-xs text-gray-500">실행자</span>
          <div class="text-sm">${log.actor_name || '시스템'} ${log.actor_login_id ? `(${log.actor_login_id})` : ''}</div>
          <div class="text-xs text-gray-400">${log.actor_org_name || ''}</div>
        </div>
        <div><span class="text-xs text-gray-500">IP 주소</span><div class="font-mono text-sm">${log.ip_address || '-'}</div></div>
      </div>

      <!-- 상세 데이터 -->
      ${Object.keys(detail).length > 0 ? `
      <div>
        <h4 class="font-semibold text-sm mb-2"><i class="fas fa-code mr-1 text-indigo-400"></i>상세 데이터</h4>
        <div class="bg-gray-50 rounded-lg overflow-hidden">
          <table class="w-full text-sm">
            <tbody>${detailRows}</tbody>
          </table>
        </div>
      </div>` : ''}

      <!-- Raw JSON -->
      <div>
        <button onclick="document.getElementById('audit-raw').classList.toggle('hidden')" 
          class="text-xs text-indigo-500 hover:underline"><i class="fas fa-code mr-1"></i>Raw JSON 보기</button>
        <pre id="audit-raw" class="hidden mt-2 bg-gray-900 text-green-400 p-3 rounded-lg text-xs overflow-x-auto max-h-40">${JSON.stringify(detail, null, 2)}</pre>
      </div>
    </div>`;

  showModal(`감사 로그 상세 — #${log.log_id}`, content, 
    `<button onclick="closeModal()" class="px-5 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`, { large: true });
}

// ─── 필터 ───
function auditApplyFilter() {
  auditState.filters.entity_type = document.getElementById('af-entity')?.value || '';
  auditState.filters.action = document.getElementById('af-action')?.value || '';
  auditState.filters.search = document.getElementById('af-search')?.value || '';
  auditState.filters.from = document.getElementById('af-from')?.value || '';
  auditState.filters.to = document.getElementById('af-to')?.value || '';
  auditState.filters.page = 1;
  renderContent();
}

function auditResetFilter() {
  auditState.filters = { entity_type: '', action: '', actor_id: '', from: '', to: '', search: '', page: 1, limit: 20 };
  renderContent();
}

// ─── 색상 헬퍼 ───
function auditEntityColor(type) {
  const colors = {
    ORDER:     { badge: 'bg-blue-100 text-blue-700', bar: 'bg-blue-400', icon: 'fa-box' },
    USER:      { badge: 'bg-purple-100 text-purple-700', bar: 'bg-purple-400', icon: 'fa-user' },
    ORG:       { badge: 'bg-indigo-100 text-indigo-700', bar: 'bg-indigo-400', icon: 'fa-building' },
    SIGNUP:    { badge: 'bg-green-100 text-green-700', bar: 'bg-green-400', icon: 'fa-user-plus' },
    SETTLEMENT:{ badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400', icon: 'fa-coins' },
    COMMISSION:{ badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-400', icon: 'fa-percent' },
    REGION:    { badge: 'bg-cyan-100 text-cyan-700', bar: 'bg-cyan-400', icon: 'fa-map' },
    AUTH:      { badge: 'bg-red-100 text-red-700', bar: 'bg-red-400', icon: 'fa-lock' },
    SESSION:   { badge: 'bg-gray-100 text-gray-700', bar: 'bg-gray-400', icon: 'fa-key' },
  };
  return colors[type] || { badge: 'bg-gray-100 text-gray-600', bar: 'bg-gray-400', icon: 'fa-question' };
}

function auditActionColor(action) {
  if (!action) return 'text-gray-600';
  const lower = action.toLowerCase();
  if (lower.includes('create') || lower.includes('approved')) return 'text-green-600';
  if (lower.includes('delete') || lower.includes('deactivat') || lower.includes('rejected')) return 'text-red-600';
  if (lower.includes('update') || lower.includes('changed')) return 'text-amber-600';
  if (lower.includes('login') || lower.includes('auth')) return 'text-blue-600';
  return 'text-gray-600';
}
