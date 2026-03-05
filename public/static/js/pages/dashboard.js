// ============================================================
// 다하다 OMS - 대시보드 페이지 v8.0
// Chart.js 실시간 차트, 인터랙션 디자인, 드릴다운
// ============================================================

// 차트 인스턴스 관리 (메모리 누수 방지)
const _dashCharts = {};
function _destroyCharts() {
  Object.keys(_dashCharts).forEach(k => {
    if (_dashCharts[k]) { _dashCharts[k].destroy(); delete _dashCharts[k]; }
  });
}

async function renderDashboard(el) {
  _destroyCharts();
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
      
      <!-- 요약 카드 -->
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

      <!-- 차트 영역 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <!-- 주문 상태 도넛 차트 -->
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <h3 class="text-sm font-semibold mb-4"><i class="fas fa-chart-pie mr-2 text-pink-500"></i>상태별 주문 분포</h3>
          <div class="relative" style="height:220px;">
            <canvas id="chart-status-donut"></canvas>
          </div>
        </div>

        <!-- 지역법인별 바 차트 -->
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <h3 class="text-sm font-semibold mb-4"><i class="fas fa-chart-bar mr-2 text-indigo-500"></i>지역법인별 주문 현황</h3>
          <div class="relative" style="height:220px;">
            <canvas id="chart-region-bar"></canvas>
          </div>
        </div>

        <!-- 금액 도넛 차트 -->
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <h3 class="text-sm font-semibold mb-4"><i class="fas fa-won-sign mr-2 text-emerald-500"></i>상태별 금액 비중</h3>
          <div class="relative" style="height:220px;">
            <canvas id="chart-amount-donut"></canvas>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- 주문 퍼널 -->
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
        
        <!-- 지역법인별 현황 테이블 -->
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

  // ─── Chart.js 렌더링 ───
  _renderDashCharts(funnelRes.funnel || [], dashRes.region_summary || []);
}

// ─── Chart.js 차트 생성 ───
function _renderDashCharts(funnel, regionSummary) {
  // Chart.js 로드 확인
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded');
    return;
  }

  const STATUS_COLORS = {
    RECEIVED: '#94a3b8', VALIDATED: '#60a5fa', DISTRIBUTED: '#818cf8',
    DISTRIBUTION_PENDING: '#fbbf24', ASSIGNED: '#a78bfa',
    IN_PROGRESS: '#fb923c', SUBMITTED: '#38bdf8',
    REGION_APPROVED: '#34d399', REGION_REJECTED: '#f87171',
    HQ_APPROVED: '#22c55e', HQ_REJECTED: '#ef4444',
    SETTLEMENT_CONFIRMED: '#10b981', SETTLEMENT_COMPLETE: '#059669',
  };

  const STATUS_LABELS = {
    RECEIVED: '수신', VALIDATED: '유효성통과', DISTRIBUTED: '배분완료',
    DISTRIBUTION_PENDING: '배분보류', ASSIGNED: '배정완료',
    IN_PROGRESS: '작업중', SUBMITTED: '제출',
    REGION_APPROVED: '지역승인', REGION_REJECTED: '지역반려',
    HQ_APPROVED: 'HQ승인', HQ_REJECTED: 'HQ반려',
    SETTLEMENT_CONFIRMED: '정산확정', SETTLEMENT_COMPLETE: '정산완료',
  };

  // 1) 상태별 주문 도넛 차트
  const donutCtx = document.getElementById('chart-status-donut');
  if (donutCtx && funnel.length > 0) {
    const labels = funnel.map(f => STATUS_LABELS[f.status] || f.status);
    const data = funnel.map(f => f.count);
    const bgColors = funnel.map(f => STATUS_COLORS[f.status] || '#cbd5e1');

    _dashCharts.statusDonut = new Chart(donutCtx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: '#fff',
          hoverBorderWidth: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 }, padding: 8 } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed}건 (${((ctx.parsed / data.reduce((a,b)=>a+b,0)) * 100).toFixed(1)}%)`,
            }
          }
        },
        onClick: (e, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const status = funnel[idx].status;
            window._orderFilters = { status };
            navigateTo('orders');
          }
        }
      }
    });
  }

  // 2) 지역법인별 바 차트
  const barCtx = document.getElementById('chart-region-bar');
  if (barCtx && regionSummary.length > 0) {
    const regionColors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'];
    _dashCharts.regionBar = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: regionSummary.map(r => r.region_name.replace('지역법인', '')),
        datasets: [
          { label: '진행중', data: regionSummary.map(r => r.active_orders), backgroundColor: '#60a5fa', borderRadius: 4 },
          { label: '검수대기', data: regionSummary.map(r => r.pending_review), backgroundColor: '#fbbf24', borderRadius: 4 },
          { label: '정산대기', data: regionSummary.map(r => r.ready_for_settlement), backgroundColor: '#34d399', borderRadius: 4 },
          { label: '정산완료', data: regionSummary.map(r => r.settled), backgroundColor: '#10b981', borderRadius: 4 },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 8 } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}건`,
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: '#f1f5f9' } },
        },
        onClick: (e, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const r = regionSummary[idx];
            showRegionDetailModal(r.org_id, r.region_name);
          }
        }
      }
    });
  }

  // 3) 상태별 금액 도넛 차트
  const amountCtx = document.getElementById('chart-amount-donut');
  if (amountCtx && funnel.length > 0) {
    const topFunnel = funnel.filter(f => f.total_amount > 0).sort((a, b) => b.total_amount - a.total_amount);
    const labels = topFunnel.map(f => STATUS_LABELS[f.status] || f.status);
    const data = topFunnel.map(f => f.total_amount);
    const bgColors = topFunnel.map(f => STATUS_COLORS[f.status] || '#cbd5e1');

    _dashCharts.amountDonut = new Chart(amountCtx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: '#fff',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 }, padding: 8 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = data.reduce((a,b)=>a+b,0);
                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${(ctx.parsed/10000).toFixed(1)}만원 (${pct}%)`;
              },
            }
          }
        },
        onClick: (e, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const status = topFunnel[idx].status;
            window._orderFilters = { status };
            navigateTo('orders');
          }
        }
      }
    });
  }
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

// ─── 지역법인 상세 모달 (Chart.js 포함) ───
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
              class="px-3 py-1.5 bg-purple-200 text-purple-800 rounded-lg text-xs hover:bg-purple-300 transition">
              <i class="fas fa-list mr-1"></i>주문보기
            </button>
            <button onclick="closeModal();navigateTo('statistics')" 
              class="px-3 py-1.5 bg-purple-200 text-purple-800 rounded-lg text-xs hover:bg-purple-300 transition">
              <i class="fas fa-chart-bar mr-1"></i>통계
            </button>
          </div>
        </div>
      </div>

      ${stats.length > 0 ? `
      <div>
        <h4 class="font-semibold mb-3"><i class="fas fa-chart-line mr-1 text-blue-500"></i>일별 추이</h4>
        <div style="height:180px;"><canvas id="chart-region-daily"></canvas></div>
      </div>
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
      </div>` : '<p class="text-gray-400 text-sm text-center py-4">일별 통계 데이터가 없습니다.</p>'}

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

  // 모달 내 차트 렌더링
  if (stats.length > 0) {
    setTimeout(() => {
      const dailyCtx = document.getElementById('chart-region-daily');
      if (dailyCtx && typeof Chart !== 'undefined') {
        const reversed = [...stats].reverse();
        new Chart(dailyCtx, {
          type: 'line',
          data: {
            labels: reversed.map(s => s.date?.substring(5) || ''),
            datasets: [
              { label: '인입', data: reversed.map(s => s.intake_count || 0), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.3, fill: true, pointRadius: 4, pointHoverRadius: 6 },
              { label: '배정', data: reversed.map(s => s.assigned_to_team_count || 0), borderColor: '#8b5cf6', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3 },
              { label: '승인', data: reversed.map(s => s.hq_approved_count || 0), borderColor: '#22c55e', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3 },
              { label: '정산', data: reversed.map(s => s.settlement_confirmed_count || 0), borderColor: '#10b981', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3, borderDash: [5, 3] },
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 8 } } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 10 } } },
              y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: '#f1f5f9' } },
            }
          }
        });
      }
    }, 200);
  }
}
