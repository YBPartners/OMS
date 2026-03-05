// ============================================================
// 와이비 OMS - 대리점(AGENCY) 전용 페이지 v7.0
// agency-dashboard, agency-orders, agency-team
// 대리점장(AGENCY_LEADER) 전용 뷰: 자기 주문 + 하위 팀장 관리
// ============================================================

// ════════ 대리점 대시보드 ════════
async function renderAgencyDashboard(el) {
  showSkeletonLoading(el, 'cards');

  const [funnelRes, agencyRes] = await Promise.all([
    api('GET', '/orders/stats/funnel'),
    api('GET', `/hr/agencies/${currentUser.user_id}`),
  ]);

  const funnel = funnelRes?.funnel || [];
  const teamMembers = agencyRes?.team_members || [];

  // 퍼널에서 합산 통계
  const totalOrders = funnel.reduce((s, f) => s + (f.count || 0), 0);
  const totalAmount = funnel.reduce((s, f) => s + (f.total_amount || 0), 0);
  const inProgress = funnel.filter(f => ['IN_PROGRESS', 'SUBMITTED'].includes(f.status)).reduce((s, f) => s + f.count, 0);
  const completed = funnel.filter(f => ['HQ_APPROVED', 'SETTLEMENT_CONFIRMED', 'PAID'].includes(f.status)).reduce((s, f) => s + f.count, 0);
  const pendingReview = funnel.filter(f => f.status === 'SUBMITTED').reduce((s, f) => s + f.count, 0);
  const activeTeamCount = teamMembers.filter(m => m.status === 'ACTIVE').length;

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">
          <i class="fas fa-store mr-2 text-teal-600"></i>대리점 현황
        </h2>
        <div class="flex items-center gap-2 text-sm text-gray-500">
          <span class="px-3 py-1 bg-teal-50 text-teal-700 rounded-full font-medium">
            <i class="fas fa-store mr-1"></i>대리점장: ${currentUser.name}
          </span>
          <span class="px-3 py-1 bg-purple-50 text-purple-700 rounded-full font-medium">
            <i class="fas fa-people-group mr-1"></i>소속 팀장: ${activeTeamCount}명
          </span>
        </div>
      </div>

      <!-- 요약 카드 -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div class="ix-card bg-white rounded-xl p-5 border border-gray-100 text-center" onclick="navigateTo('agency-orders')" data-tooltip="전체 주문 보기">
          <div class="text-3xl font-bold text-blue-600 ix-count-animate">${totalOrders}</div>
          <div class="text-xs text-gray-500 mt-1"><i class="fas fa-boxes-stacked mr-1"></i>총 주문</div>
        </div>
        <div class="ix-card bg-white rounded-xl p-5 border border-orange-200 bg-orange-50 text-center" onclick="navigateTo('agency-orders')" data-tooltip="진행중 주문">
          <div class="text-3xl font-bold text-orange-600 ix-count-animate">${inProgress}</div>
          <div class="text-xs text-orange-600 mt-1"><i class="fas fa-wrench mr-1"></i>작업중</div>
        </div>
        <div class="ix-card bg-white rounded-xl p-5 border border-cyan-200 bg-cyan-50 text-center" onclick="navigateTo('review-region')" data-tooltip="검수 대기">
          <div class="text-3xl font-bold text-cyan-600 ix-count-animate">${pendingReview}</div>
          <div class="text-xs text-cyan-600 mt-1"><i class="fas fa-clipboard-check mr-1"></i>검수대기</div>
        </div>
        <div class="ix-card bg-white rounded-xl p-5 border border-green-200 bg-green-50 text-center" data-tooltip="완료 건수">
          <div class="text-3xl font-bold text-green-600 ix-count-animate">${completed}</div>
          <div class="text-xs text-green-600 mt-1"><i class="fas fa-check-double mr-1"></i>승인완료</div>
        </div>
        <div class="ix-card bg-white rounded-xl p-5 border border-purple-200 bg-purple-50 text-center" onclick="navigateTo('agency-team')" data-tooltip="소속 팀장 관리">
          <div class="text-3xl font-bold text-purple-600 ix-count-animate">${activeTeamCount}</div>
          <div class="text-xs text-purple-600 mt-1"><i class="fas fa-people-group mr-1"></i>소속 팀장</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- 주문 퍼널 -->
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold"><i class="fas fa-filter mr-2 text-blue-500"></i>주문 상태 분포</h3>
            <button onclick="navigateTo('agency-orders')" class="text-xs text-blue-500 hover:text-blue-700">
              <i class="fas fa-external-link mr-1"></i>전체보기
            </button>
          </div>
          <div class="space-y-2">
            ${funnel.map(f => {
              const max = Math.max(...funnel.map(x => x.count), 1);
              const pct = (f.count / max * 100);
              const s = OMS.STATUS[f.status] || { label: f.status, color: 'bg-gray-100 text-gray-600', icon: 'fa-circle' };
              return `
                <div class="flex items-center gap-3 rounded-lg p-1 -mx-1">
                  <div class="w-20 text-xs text-right text-gray-500">${s.label}</div>
                  <div class="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div class="h-full bg-blue-400 rounded-full flex items-center justify-end pr-2 transition-all duration-500" style="width:${Math.max(pct, 10)}%">
                      <span class="text-[10px] font-bold text-white">${f.count}</span>
                    </div>
                  </div>
                  <div class="w-20 text-xs text-gray-500 text-right">${formatAmount(f.total_amount)}</div>
                </div>`;
            }).join('')}
            ${funnel.length === 0 ? '<p class="text-center text-gray-400 text-sm py-6">데이터 없음</p>' : ''}
          </div>
        </div>

        <!-- 팀장별 실적 -->
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold"><i class="fas fa-people-group mr-2 text-purple-500"></i>팀장별 현황</h3>
            <button onclick="navigateTo('agency-team')" class="text-xs text-blue-500 hover:text-blue-700">
              <i class="fas fa-users-gear mr-1"></i>관리
            </button>
          </div>
          ${teamMembers.length > 0 ? `
          <div class="space-y-3">
            ${teamMembers.map(m => `
              <div class="flex items-center gap-3 p-3 rounded-lg ${m.status === 'ACTIVE' ? 'bg-gray-50 hover:bg-gray-100' : 'bg-red-50'} transition">
                <div class="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center">
                  <i class="fas fa-user text-purple-600 text-sm"></i>
                </div>
                <div class="flex-1">
                  <div class="font-medium text-sm">${m.name}</div>
                  <div class="text-xs text-gray-400">${m.org_name || ''} · ${formatPhone(m.phone)}</div>
                </div>
                <div class="text-right">
                  <div class="text-sm font-bold text-blue-600">${m.active_orders || 0}건</div>
                  <div class="text-[10px] text-gray-400">진행중</div>
                </div>
              </div>
            `).join('')}
          </div>
          ` : `
          <div class="text-center py-8 text-gray-400">
            <i class="fas fa-people-group text-4xl mb-3"></i>
            <p>소속 팀장이 없습니다.</p>
            <p class="text-xs mt-1">관리자에게 팀장 배정을 요청하세요.</p>
          </div>
          `}
        </div>
      </div>
    </div>`;
}

// ════════ 대리점 주문관리 ════════
async function renderAgencyOrders(el) {
  showSkeletonLoading(el, 'table');
  const params = new URLSearchParams(window._agencyOrderFilters || {});
  if (!params.has('limit')) params.set('limit', '20');
  const res = await api('GET', `/orders?${params.toString()}`);
  const orders = res?.orders || [];

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">
          <i class="fas fa-list-check mr-2 text-teal-600"></i>대리점 주문관리
        </h2>
        <span class="text-sm text-gray-500">
          <i class="fas fa-info-circle mr-1"></i>본인 + 소속 팀장 주문이 표시됩니다
        </span>
      </div>

      <!-- 상태별 카드 -->
      <div class="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        ${[
          { status: '', label: '전체', icon: 'fa-list', color: 'gray', count: res?.total || 0 },
          { status: 'DISTRIBUTED', label: '배분완료', icon: 'fa-share-nodes', color: 'indigo' },
          { status: 'ASSIGNED', label: '배정됨', icon: 'fa-user-check', color: 'purple' },
          { status: 'IN_PROGRESS', label: '작업중', icon: 'fa-wrench', color: 'orange' },
          { status: 'SUBMITTED', label: '제출됨', icon: 'fa-file-lines', color: 'cyan' },
          { status: 'HQ_APPROVED', label: 'HQ승인', icon: 'fa-check-double', color: 'green' },
        ].map(c => {
          const count = c.count !== undefined ? c.count : orders.filter(o => c.status.split(',').includes(o.status)).length;
          const active = params.get('status') === c.status;
          return `
          <div class="ix-card card bg-white rounded-xl p-3 border ${active ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-100'} text-center"
               onclick="window._agencyOrderFilters={status:'${c.status}',page:1};renderContent()">
            <i class="fas ${c.icon} text-${c.color}-500 text-lg mb-1"></i>
            <div class="text-xl font-bold">${count}</div>
            <div class="text-[10px] text-gray-500">${c.label}</div>
          </div>`;
        }).join('')}
      </div>

      <!-- 필터 -->
      <div class="bg-white rounded-xl p-4 mb-4 border border-gray-100 flex flex-wrap gap-3 items-end">
        <div><label class="block text-xs text-gray-500 mb-1">검색</label>
          <input id="agency-f-search" class="border rounded-lg px-3 py-2 text-sm w-48" placeholder="고객명/주소/주문번호" value="${params.get('search') || ''}" onkeypress="if(event.key==='Enter')applyAgencyOrderFilter()"></div>
        <div><label class="block text-xs text-gray-500 mb-1">상태</label>
          <select id="agency-f-status" class="border rounded-lg px-3 py-2 text-sm" onchange="applyAgencyOrderFilter()">
            <option value="">전체</option>
            ${Object.entries(OMS.STATUS).map(([k, v]) => `<option value="${k}" ${params.get('status') === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select></div>
        <button onclick="applyAgencyOrderFilter()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"><i class="fas fa-search mr-1"></i>조회</button>
      </div>

      <!-- 주문 목록 -->
      <div class="space-y-3">
        ${orders.map(o => `
          <div class="ix-card bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition"
               onclick="showOrderDetailDrawer(${o.order_id})"
               data-preview="order" data-preview-id="${o.order_id}" data-preview-title="주문 #${o.order_id}">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-3">
                <span class="font-mono text-gray-400 text-xs">#${o.order_id}</span>
                <span class="font-bold">${o.customer_name || '-'}</span>
                ${statusBadge(o.status)}
              </div>
              <span class="font-medium text-blue-600">${formatAmount(o.base_amount)}</span>
            </div>
            <div class="text-sm text-gray-500 mb-2">${o.address_text || '-'}</div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3 text-xs text-gray-400">
                <span><i class="fas fa-user mr-1"></i>${o.team_leader_name || '미배정'}</span>
                <span><i class="fas fa-calendar mr-1"></i>${o.requested_date || '-'}</span>
              </div>
              ${_renderStatusProgress(o.status)}
            </div>
            <div class="flex flex-wrap gap-2 mt-3" onclick="event.stopPropagation()">
              <button onclick="showOrderDetailDrawer(${o.order_id})" class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200">
                <i class="fas fa-eye mr-1"></i>상세
              </button>
              ${o.status === 'SUBMITTED' ? `
                <button onclick="quickApprove(${o.order_id},'region')" class="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">
                  <i class="fas fa-check mr-1"></i>승인
                </button>
                <button onclick="showReviewModal(${o.order_id}, 'region', 'REJECT')" class="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700">
                  <i class="fas fa-times mr-1"></i>반려
                </button>
              ` : ''}
              ${o.status === 'ASSIGNED' && o.team_leader_id === currentUser.user_id ? `
                <button onclick="startWork(${o.order_id})" class="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs hover:bg-orange-700">
                  <i class="fas fa-play mr-1"></i>작업시작
                </button>
              ` : ''}
              ${['IN_PROGRESS', 'REGION_REJECTED', 'HQ_REJECTED'].includes(o.status) && o.team_leader_id === currentUser.user_id ? `
                <button onclick="showReportModal(${o.order_id})" class="px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs hover:bg-cyan-700">
                  <i class="fas fa-file-pen mr-1"></i>보고서
                </button>
              ` : ''}
            </div>
          </div>
        `).join('')}
        ${orders.length === 0 ? '<div class="bg-white rounded-xl p-8 text-center text-gray-400 border"><i class="fas fa-inbox text-4xl mb-3"></i><p>주문이 없습니다.</p></div>' : ''}
      </div>

      <!-- 페이지네이션 -->
      ${res?.total > 0 ? `
      <div class="flex items-center justify-between mt-4 text-sm text-gray-500">
        <span>총 ${res.total}건</span>
        <div class="flex gap-2">
          ${Number(res.page) > 1 ? `<button onclick="window._agencyOrderFilters={...window._agencyOrderFilters||{},page:${Number(res.page)-1}};renderContent()" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">이전</button>` : ''}
          <span class="px-3 py-1">${res.page} / ${Math.ceil(res.total / Number(res.limit)) || 1}</span>
          ${Number(res.page) < Math.ceil(res.total / Number(res.limit)) ? `<button onclick="window._agencyOrderFilters={...window._agencyOrderFilters||{},page:${Number(res.page)+1}};renderContent()" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">다음</button>` : ''}
        </div>
      </div>` : ''}
    </div>`;
}

function applyAgencyOrderFilter() {
  window._agencyOrderFilters = {
    status: document.getElementById('agency-f-status')?.value,
    search: document.getElementById('agency-f-search')?.value,
    page: 1
  };
  Object.keys(window._agencyOrderFilters).forEach(k => { if (!window._agencyOrderFilters[k]) delete window._agencyOrderFilters[k]; });
  renderContent();
}

// ════════ 대리점 소속 팀장 관리 ════════
async function renderAgencyTeam(el) {
  showSkeletonLoading(el, 'cards');

  const res = await api('GET', `/hr/agencies/${currentUser.user_id}`);
  const agency = res?.agency;
  const teamMembers = res?.team_members || [];

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">
          <i class="fas fa-people-group mr-2 text-purple-600"></i>소속 팀장 관리
        </h2>
        <div class="flex gap-2">
          <button onclick="renderContent()" class="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
            <i class="fas fa-refresh mr-1"></i>새로고침
          </button>
        </div>
      </div>

      <!-- 대리점 정보 카드 -->
      <div class="bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl p-6 text-white mb-6">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
            <i class="fas fa-store text-2xl"></i>
          </div>
          <div class="flex-1">
            <div class="text-lg font-bold">${agency?.name || currentUser.name}</div>
            <div class="text-teal-100 text-sm">${agency?.region_name || ''} 소속 · ${agency?.org_name || ''}</div>
          </div>
          <div class="text-right">
            <div class="text-3xl font-bold">${teamMembers.length}</div>
            <div class="text-teal-100 text-sm">소속 팀장</div>
          </div>
        </div>
      </div>

      <!-- 팀장 목록 -->
      <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div class="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
          <div class="font-semibold text-gray-700">
            <i class="fas fa-users mr-2 text-purple-500"></i>소속 팀장 목록
          </div>
          <span class="text-xs text-gray-400">
            총 ${teamMembers.length}명 · 활성 ${teamMembers.filter(m => m.status === 'ACTIVE').length}명
          </span>
        </div>
        
        ${teamMembers.length > 0 ? `
        <div class="divide-y">
          ${teamMembers.map(m => `
            <div class="p-5 hover:bg-gray-50 transition">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 ${m.status === 'ACTIVE' ? 'bg-purple-100' : 'bg-red-100'} rounded-full flex items-center justify-center">
                    <i class="fas fa-user ${m.status === 'ACTIVE' ? 'text-purple-600' : 'text-red-400'}"></i>
                  </div>
                  <div>
                    <div class="font-medium text-gray-800">${m.name}
                      <span class="ml-2 status-badge ${m.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${m.status}</span>
                    </div>
                    <div class="text-sm text-gray-500 mt-0.5">
                      <span class="font-mono">${m.login_id}</span>
                      <span class="mx-2 text-gray-300">|</span>
                      ${formatPhone(m.phone)}
                      <span class="mx-2 text-gray-300">|</span>
                      ${m.org_name || ''}
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-4">
                  <div class="text-center">
                    <div class="text-xl font-bold ${(m.active_orders || 0) > 0 ? 'text-blue-600' : 'text-gray-400'}">${m.active_orders || 0}</div>
                    <div class="text-[10px] text-gray-400">진행중 주문</div>
                  </div>
                  <div class="text-center">
                    <div class="text-xs text-gray-400">${m.mapped_at ? formatDate(m.mapped_at) : '-'}</div>
                    <div class="text-[10px] text-gray-400">배정일</div>
                  </div>
                  <button onclick="showAgencyTeamOrdersDrawer(${m.user_id}, '${m.name}')"
                    class="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs hover:bg-blue-100 transition">
                    <i class="fas fa-list mr-1"></i>주문보기
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        ` : `
        <div class="text-center py-12 text-gray-400">
          <i class="fas fa-user-plus text-5xl mb-4"></i>
          <p class="text-lg font-medium">소속 팀장이 없습니다</p>
          <p class="text-sm mt-2">관리자(파트장/본사)에게 팀장 배정을 요청하세요.</p>
        </div>
        `}
      </div>
    </div>`;
}

// ─── 특정 팀장의 주문 보기 드로어 ───
async function showAgencyTeamOrdersDrawer(teamUserId, teamName) {
  const res = await api('GET', `/orders?team_leader_id=${teamUserId}&limit=50`);
  const orders = res?.orders || [];

  const content = `
    <div class="space-y-4">
      <div class="bg-purple-50 rounded-lg p-3 border border-purple-200">
        <div class="flex items-center gap-2">
          <i class="fas fa-user text-purple-600"></i>
          <span class="font-medium text-purple-800">${teamName}</span>
          <span class="ml-auto text-sm text-purple-600">${orders.length}건</span>
        </div>
      </div>
      
      <div class="space-y-2 max-h-[60vh] overflow-y-auto">
        ${orders.map(o => `
          <div class="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition cursor-pointer"
               onclick="closeDrawer();showOrderDetailDrawer(${o.order_id})">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono text-gray-400">#${o.order_id}</span>
                <span class="text-sm font-medium">${o.customer_name || '-'}</span>
                ${statusBadge(o.status)}
              </div>
              <div class="text-xs text-gray-500 mt-1">${o.address_text?.substring(0, 40) || '-'}</div>
            </div>
            <span class="text-sm font-medium text-blue-600 whitespace-nowrap ml-3">${formatAmount(o.base_amount)}</span>
          </div>
        `).join('')}
        ${orders.length === 0 ? '<p class="text-center text-gray-400 text-sm py-8">주문이 없습니다</p>' : ''}
      </div>
    </div>`;

  showDrawer(content, {
    title: `${teamName}의 주문`,
    subtitle: `총 ${orders.length}건`,
    width: '480px',
    footer: `<button onclick="closeDrawer()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">닫기</button>`,
  });
}

// ════════ 대리점 온보딩 관리 (HQ/REGION 전용) ════════

async function showAgencyOnboardingModal() {
  const res = await api('GET', '/hr/agency-onboarding');
  if (!res) return;
  const requests = res.onboarding_requests || [];

  const statusColors = { PENDING: 'bg-yellow-100 text-yellow-700', APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700' };
  const statusLabels = { PENDING: '대기중', APPROVED: '승인', REJECTED: '반려' };

  const content = `
    <div class="space-y-4">
      <div class="flex gap-2 mb-4">
        <button onclick="showAgencyOnboardRequestModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>온보딩 신청</button>
      </div>
      ${requests.length === 0 ? '<p class="text-center text-gray-400 py-8">온보딩 신청 내역이 없습니다.</p>' : `
      <table class="w-full text-sm">
        <thead class="bg-gray-50"><tr>
          <th class="px-3 py-2 text-left">신청자</th>
          <th class="px-3 py-2 text-left">소속</th>
          <th class="px-3 py-2 text-center">상태</th>
          <th class="px-3 py-2 text-left">비고</th>
          <th class="px-3 py-2 text-left">신청일</th>
          <th class="px-3 py-2 text-center">액션</th>
        </tr></thead>
        <tbody class="divide-y">${requests.map(r => `
          <tr class="hover:bg-gray-50">
            <td class="px-3 py-2 font-medium">${r.agency_name}</td>
            <td class="px-3 py-2 text-gray-600">${r.region_name || ''} / ${r.org_name}</td>
            <td class="px-3 py-2 text-center"><span class="px-2 py-0.5 rounded text-xs font-medium ${statusColors[r.status] || 'bg-gray-100'}">${statusLabels[r.status] || r.status}</span></td>
            <td class="px-3 py-2 text-gray-500 text-xs">${r.note || '-'}</td>
            <td class="px-3 py-2 text-xs text-gray-500">${formatDate(r.created_at)}</td>
            <td class="px-3 py-2 text-center">${r.status === 'PENDING' ? `
              <button onclick="approveOnboarding(${r.id})" class="px-2 py-1 bg-green-500 text-white rounded text-xs mr-1 hover:bg-green-600">승인</button>
              <button onclick="rejectOnboarding(${r.id})" class="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">반려</button>
            ` : `<span class="text-xs text-gray-400">${r.approved_by_name || '-'}</span>`}</td>
          </tr>`).join('')}
        </tbody>
      </table>`}
    </div>`;

  showModal('<i class="fas fa-store text-blue-500 mr-2"></i>대리점 온보딩 관리', content,
    `<button onclick="closeModal()" class="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm">닫기</button>`, { large: true });
}

async function showAgencyOnboardRequestModal() {
  closeModal();
  const usersRes = await api('GET', '/hr/users');
  const users = (usersRes?.users || []).filter(u => u.status === 'ACTIVE');

  const content = `
    <div class="space-y-4">
      <div><label class="block text-sm font-medium mb-1">대상 팀장 선택</label>
        <select id="onboard-user" class="w-full border rounded-lg px-3 py-2 text-sm">
          <option value="">선택하세요</option>
          ${users.map(u => `<option value="${u.user_id}">${u.name} (${u.login_id}) — ${u.org_name || ''}</option>`).join('')}
        </select>
      </div>
      <div><label class="block text-sm font-medium mb-1">메모 (선택)</label>
        <textarea id="onboard-note" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="온보딩 사유나 메모"></textarea>
      </div>
    </div>`;

  const sid = '_onboard_' + Date.now();
  showModal('<i class="fas fa-user-plus mr-2 text-blue-500"></i>온보딩 신청', content,
    `<button onclick="closeModal();showAgencyOnboardingModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
     <button id="${sid}" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">신청</button>`);
  document.getElementById(sid).addEventListener('click', async () => {
    const userId = document.getElementById('onboard-user').value;
    const note = document.getElementById('onboard-note').value;
    if (!userId) { showToast('대상을 선택하세요', 'warning'); return; }
    const res = await api('POST', '/hr/agency-onboarding', { user_id: Number(userId), note });
    if (res?.ok) { showToast('온보딩 신청 완료', 'success'); closeModal(); showAgencyOnboardingModal(); }
    else showToast(res?.error || '신청 실패', 'error');
  });
}

async function approveOnboarding(id) {
  showConfirmModal('온보딩 승인', '이 신청을 승인하면 자동으로 대리점 권한이 부여됩니다. 승인하시겠습니까?', async () => {
    const res = await api('PUT', `/hr/agency-onboarding/${id}`, { status: 'APPROVED' });
    if (res?.ok) { showToast('온보딩 승인 완료', 'success'); showAgencyOnboardingModal(); }
    else showToast(res?.error || '처리 실패', 'error');
  }, '승인', 'bg-green-600');
}

async function rejectOnboarding(id) {
  const content = `<div class="space-y-3"><p class="text-gray-600">반려 사유를 입력해주세요.</p>
    <textarea id="reject-note" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="반려 사유"></textarea></div>`;
  const sid = '_reject_' + Date.now();
  showModal('온보딩 반려', content,
    `<button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
     <button id="${sid}" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">반려</button>`);
  document.getElementById(sid).addEventListener('click', async () => {
    const note = document.getElementById('reject-note').value;
    const res = await api('PUT', `/hr/agency-onboarding/${id}`, { status: 'REJECTED', note });
    if (res?.ok) { showToast('반려 완료', 'success'); closeModal(); showAgencyOnboardingModal(); }
    else showToast(res?.error || '처리 실패', 'error');
  });
}
