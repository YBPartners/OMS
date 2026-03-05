// ============================================================
// 다하다 OMS - 대시보드 페이지 v6.0
// Interaction Design: 호버 프리뷰, 컨텍스트 액션,
// 드릴다운 강화, 스켈레톤 로딩, 카드 인터랙션
// ============================================================

async function renderDashboard(el) {
  showSkeletonLoading(el, 'cards');

  const [dashRes, funnelRes] = await Promise.all([
    api('GET', '/stats/dashboard'),
    api('GET', '/orders/stats/funnel'),
  ]);
  if (!dashRes || !funnelRes) return;

  const d = dashRes.today || {};
  const cards = [
    { label: '총 주문', value: d.total || 0, icon: 'fa-boxes-stacked', color: 'blue', click: () => navigateTo('orders'), desc: '전체 주문 목록으로 이동' },
    { label: '오늘 수신', value: dashRes.today_received || 0, icon: 'fa-inbox', color: 'indigo', click: () => { window._orderFilters = { status: 'RECEIVED' }; navigateTo('orders'); }, desc: '수신 상태 주문 보기' },
    { label: '검수 대기', value: dashRes.pending_review || 0, icon: 'fa-clipboard-list', color: 'amber', click: () => navigateTo(currentUser.org_type === 'HQ' ? 'review-hq' : 'review-region'), desc: '검수 대기 목록으로 이동' },
    { label: 'HQ검수 대기', value: dashRes.pending_hq_review || 0, icon: 'fa-shield-halved', color: 'orange', click: () => navigateTo('review-hq'), desc: 'HQ 2차 검수 목록' },
    { label: 'HQ 승인', value: d.hq_approved || 0, icon: 'fa-circle-check', color: 'green', click: () => { window._orderFilters = { status: 'HQ_APPROVED' }; navigateTo('orders'); }, desc: 'HQ 승인 완료 주문' },
    { label: '정산 확정', value: d.settlement_confirmed || 0, icon: 'fa-coins', color: 'emerald', click: () => navigateTo('settlement'), desc: '정산관리 페이지로 이동' },
    { label: '반려', value: d.rejected || 0, icon: 'fa-ban', color: 'red', click: () => { window._orderFilters = { status: 'REGION_REJECTED' }; navigateTo('orders'); }, desc: '반려된 주문 목록' },
    { label: '총 금액', value: formatAmount(d.total_amount), icon: 'fa-won-sign', color: 'purple', isText: true, click: () => navigateTo('statistics'), desc: '통계 페이지로 이동' },
  ];

  window._dashCardHandlers = {};
  cards.forEach((c, i) => { window._dashCardHandlers[i] = c.click; });

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-chart-pie mr-2 text-blue-600"></i>대시보드</h2>
      
      <!-- 요약 카드 — 호버 시 설명 표시, 클릭 시 네비게이션 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        ${cards.map((c, i) => `
          <div class="ix-card bg-white rounded-xl p-5 border border-gray-100 relative group" 
               onclick="window._dashCardHandlers[${i}]()" 
               data-tooltip="${c.desc}"
               oncontextmenu="event.preventDefault();showDashCardContextMenu(event,${i},'${c.label}')">
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-medium text-gray-500 uppercase">${c.label}</span>
              <div class="w-8 h-8 bg-${c.color}-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <i class="fas ${c.icon} text-${c.color}-600 text-sm"></i>
              </div>
            </div>
            <div class="text-${c.isText ? 'lg' : '2xl'} font-bold text-gray-800 ix-count-animate">${c.value}</div>
            <div class="flex items-center justify-between mt-2">
              <div class="text-[10px] text-gray-400"><i class="fas fa-arrow-right mr-1"></i>클릭하여 이동</div>
              <div class="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-blue-500">
                <i class="fas fa-external-link mr-1"></i>열기
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- 주문 퍼널 — 클릭 + 호버 프리뷰 -->
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold"><i class="fas fa-filter mr-2 text-blue-500"></i>주문 처리 퍼널</h3>
            <button onclick="navigateTo('orders')" class="text-xs text-blue-500 hover:text-blue-700 transition" data-tooltip="주문관리로 이동">
              <i class="fas fa-external-link mr-1"></i>전체보기
            </button>
          </div>
          <div class="space-y-2">
            ${(funnelRes.funnel || []).map(f => {
              const max = Math.max(...(funnelRes.funnel || []).map(x => x.count));
              const pct = max > 0 ? (f.count / max * 100) : 0;
              const s = OMS.STATUS[f.status] || { label: f.status, color: 'bg-gray-100 text-gray-600' };
              return `
                <div class="ix-clickable flex items-center gap-3 rounded-lg p-1.5 -mx-1.5 group" 
                     onclick="window._orderFilters={status:'${f.status}'};navigateTo('orders')"
                     oncontextmenu="event.preventDefault();showFunnelContextMenu(event,'${f.status}','${s.label}',${f.count})"
                     data-tooltip="${s.label}: ${f.count}건, ${formatAmount(f.total_amount)}">
                  <div class="w-24 text-xs text-gray-600 text-right flex items-center justify-end gap-1">
                    <i class="fas ${s.icon || 'fa-circle'} text-[10px] opacity-60"></i>${s.label}
                  </div>
                  <div class="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div class="h-full ${s.color.replace('text-', 'bg-').replace('100', '400')} rounded-full flex items-center justify-end pr-2 transition-all duration-500" style="width:${Math.max(pct, 8)}%">
                      <span class="text-xs font-bold text-white">${f.count}</span>
                    </div>
                  </div>
                  <div class="w-20 text-xs text-gray-500 text-right group-hover:text-blue-600 transition-colors">${formatAmount(f.total_amount)}</div>
                </div>`;
            }).join('')}
          </div>
        </div>
        
        <!-- 지역법인별 현황 — 호버 프리뷰 + 컨텍스트 메뉴 -->
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold"><i class="fas fa-building mr-2 text-indigo-500"></i>지역법인별 현황</h3>
            <button onclick="navigateTo('statistics')" class="text-xs text-blue-500 hover:text-blue-700 transition" data-tooltip="통계 페이지로 이동">
              <i class="fas fa-chart-bar mr-1"></i>통계
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr class="border-b text-gray-500">
                <th class="py-2 text-left">지역법인</th><th class="py-2 text-right">진행중</th><th class="py-2 text-right">검수대기</th><th class="py-2 text-right">정산대기</th><th class="py-2 text-right">정산완료</th>
              </tr></thead>
              <tbody>
                ${(dashRes.region_summary || []).map(r => `
                  <tr class="ix-table-row border-b"
                      onclick="showRegionDetailModal(${r.org_id}, '${r.region_name}')"
                      oncontextmenu="showRegionContextMenu(event, ${r.org_id}, '${r.region_name}')"
                      data-preview="region" data-preview-id="${r.org_id}" data-preview-title="${r.region_name} 최근 현황">
                    <td class="py-2.5 font-medium text-blue-700">
                      <i class="fas fa-building text-[10px] mr-1 text-blue-400"></i>${r.region_name}
                    </td>
                    <td class="py-2.5 text-right font-medium text-blue-600">${r.active_orders}</td>
                    <td class="py-2.5 text-right font-medium text-amber-600">${r.pending_review}</td>
                    <td class="py-2.5 text-right font-medium text-green-600">${r.ready_for_settlement}</td>
                    <td class="py-2.5 text-right font-medium text-emerald-600">${r.settled}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      ${(dashRes.recent_issues && dashRes.recent_issues.length > 0) ? `
      <div class="bg-white rounded-xl p-6 border border-gray-100">
        <h3 class="text-lg font-semibold mb-4">
          <i class="fas fa-exclamation-triangle mr-2 text-amber-500"></i>미해결 대사 이슈
          <button onclick="navigateTo('reconciliation')" class="ml-3 text-sm font-normal text-blue-600 hover:underline">전체보기 <i class="fas fa-arrow-right text-xs"></i></button>
        </h3>
        <div class="flex flex-wrap gap-3">
          ${dashRes.recent_issues.map(i => {
            const it = OMS.ISSUE_TYPES[i.type] || { label: i.type, icon: 'fa-question', color: 'text-gray-600' };
            const sv = OMS.SEVERITY[i.severity] || { color: 'bg-gray-50' };
            return `
            <div class="ix-clickable flex items-center gap-2 px-3 py-2 rounded-lg ${sv.color} text-sm" 
                 onclick="navigateTo('reconciliation')"
                 data-tooltip="${it.label}: ${i.cnt}건 (${sv.label || ''})">
              <i class="fas ${it.icon} ${it.color}"></i>
              <span class="font-medium">${it.label}</span>
              <span class="bg-white px-2 py-0.5 rounded text-xs font-bold ix-badge-pulse">${i.cnt}건</span>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}
    </div>`;
}

// ─── 대시보드 카드 컨텍스트 메뉴 ───
function showDashCardContextMenu(e, idx, label) {
  const card = Object.values(window._dashCardHandlers || {});
  showContextMenu(e.clientX, e.clientY, [
    { icon: 'fa-external-link', label: `${label} 페이지 열기`, action: card[idx] },
    { icon: 'fa-window-restore', label: '새 탭에서 열기', disabled: true },
    { divider: true },
    { icon: 'fa-chart-bar', label: '통계에서 확인', action: () => navigateTo('statistics') },
    { icon: 'fa-scroll', label: '감사 로그 확인', action: () => navigateTo('audit-log') },
  ], { title: label });
}

// ─── 퍼널 항목 컨텍스트 메뉴 ───
function showFunnelContextMenu(e, status, label, count) {
  showContextMenu(e.clientX, e.clientY, [
    { icon: 'fa-list', label: `${label} 주문 목록 (${count}건)`, action: () => { window._orderFilters = { status }; navigateTo('orders'); } },
    { icon: 'fa-filter', label: '이 상태로 필터링', action: () => { window._orderFilters = { status }; navigateTo('orders'); } },
    { divider: true },
    { icon: 'fa-chart-bar', label: '상태별 통계', action: () => navigateTo('statistics') },
  ], { title: `${label} (${count}건)` });
}

// ─── 지역법인 컨텍스트 메뉴 ───
function showRegionContextMenu(e, orgId, regionName) {
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY, [
    { icon: 'fa-chart-line', label: '상세 현황 보기', action: () => showRegionDetailModal(orgId, regionName) },
    { icon: 'fa-list', label: '진행중 주문 보기', action: () => { window._orderFilters = { status: 'DISTRIBUTED', region_org_id: orgId }; navigateTo('orders'); } },
    { icon: 'fa-clipboard-check', label: '검수 대기 보기', action: () => { window._orderFilters = { status: 'SUBMITTED' }; navigateTo('orders'); } },
    { divider: true },
    { icon: 'fa-users', label: '소속 팀장 관리', action: () => { window._hrTab = 'users'; navigateTo('hr-management'); } },
    { icon: 'fa-chart-bar', label: '통계 보기', action: () => navigateTo('statistics') },
  ], { title: regionName });
}

// ─── 지역법인 상세 모달 (강화) ───
async function showRegionDetailModal(orgId, regionName) {
  const [statsRes, leadersRes] = await Promise.all([
    api('GET', `/stats/regions/daily?region_org_id=${orgId}`),
    api('GET', `/stats/team-leaders/daily?region_org_id=${orgId}`),
  ]);
  const stats = statsRes?.stats?.slice(0, 7) || [];
  const leaders = leadersRes?.stats?.slice(0, 10) || [];

  const content = `
    <div class="space-y-6">
      <div class="bg-purple-50 rounded-xl p-4 border border-purple-200">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 bg-purple-200 rounded-xl flex items-center justify-center">
            <i class="fas fa-building text-purple-600 text-xl"></i>
          </div>
          <div class="flex-1">
            <div class="text-lg font-bold text-purple-800">${regionName}</div>
            <div class="text-sm text-purple-600">최근 통계 현황</div>
          </div>
          <div class="flex gap-2">
            <button onclick="closeModal();window._orderFilters={region_org_id:'${orgId}'};navigateTo('orders')" 
              class="px-3 py-1.5 bg-purple-200 text-purple-800 rounded-lg text-xs hover:bg-purple-300 transition"
              data-tooltip="이 법인의 주문 보기">
              <i class="fas fa-list mr-1"></i>주문보기
            </button>
            <button onclick="closeModal();navigateTo('statistics')" 
              class="px-3 py-1.5 bg-purple-200 text-purple-800 rounded-lg text-xs hover:bg-purple-300 transition"
              data-tooltip="통계 페이지에서 상세 확인">
              <i class="fas fa-chart-bar mr-1"></i>통계
            </button>
          </div>
        </div>
      </div>

      ${stats.length > 0 ? `
      <div>
        <h4 class="font-semibold mb-3"><i class="fas fa-calendar-days mr-1 text-blue-500"></i>일별 현황</h4>
        <table class="w-full text-sm">
          <thead class="bg-gray-50"><tr>
            <th class="px-3 py-2 text-left">날짜</th><th class="px-3 py-2 text-right">인입</th>
            <th class="px-3 py-2 text-right">배정</th><th class="px-3 py-2 text-right">승인</th>
            <th class="px-3 py-2 text-right">정산</th>
          </tr></thead>
          <tbody class="divide-y">${stats.map(s => `
            <tr class="hover:bg-gray-50">
              <td class="px-3 py-2 text-xs">${s.date}</td>
              <td class="px-3 py-2 text-right">${s.intake_count || 0}</td>
              <td class="px-3 py-2 text-right">${s.assigned_to_team_count || 0}</td>
              <td class="px-3 py-2 text-right">${s.hq_approved_count || 0}</td>
              <td class="px-3 py-2 text-right font-bold text-green-600">${s.settlement_confirmed_count || 0}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      ${leaders.length > 0 ? `
      <div>
        <h4 class="font-semibold mb-3"><i class="fas fa-users mr-1 text-purple-500"></i>소속 팀장 현황</h4>
        <table class="w-full text-sm">
          <thead class="bg-gray-50"><tr>
            <th class="px-3 py-2 text-left">팀장</th><th class="px-3 py-2 text-right">수임</th>
            <th class="px-3 py-2 text-right">제출</th><th class="px-3 py-2 text-right">승인</th>
            <th class="px-3 py-2 text-right">지급액</th>
          </tr></thead>
          <tbody class="divide-y">${leaders.map(l => `
            <tr class="ix-table-row"
                data-preview="user" data-preview-id="${l.team_leader_id || ''}" data-preview-title="${l.team_leader_name}">
              <td class="px-3 py-2 font-medium">${l.team_leader_name}</td>
              <td class="px-3 py-2 text-right">${l.intake_count || 0}</td>
              <td class="px-3 py-2 text-right">${l.submitted_count || 0}</td>
              <td class="px-3 py-2 text-right">${l.hq_approved_count || 0}</td>
              <td class="px-3 py-2 text-right font-bold text-green-600">${formatAmount(l.payable_amount_sum)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}
    </div>`;

  showModal(`<i class="fas fa-building text-purple-500 mr-2"></i>${regionName} 상세`, content, 
    `<button onclick="closeModal()" class="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm">닫기</button>`, { large: true });
}
