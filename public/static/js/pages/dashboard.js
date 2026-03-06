// ============================================================
// 와이비 OMS - 대시보드 페이지 v14.0
// Chart.js 실시간 차트, 인터랙션 디자인, 드릴다운
// 매출 추이, 정산 현황 차트 추가
// ============================================================

// 차트 인스턴스 관리 (메모리 누수 방지)
const _dashCharts = {};
function _destroyCharts() {
  Object.keys(_dashCharts).forEach(k => {
    if (_dashCharts[k]) { _dashCharts[k].destroy(); delete _dashCharts[k]; }
  });
}

async function renderDashboard(el) {
  try {
  _destroyCharts();
  showSkeletonLoading(el, 'cards');

  const isTeam = currentUser && (currentUser.org_type === 'TEAM' || currentUser.roles.includes('TEAM_LEADER'));
  const isAgency = currentUser && currentUser.is_agency === true;

  const [dashRes, funnelRes] = await Promise.all([
    api('GET', '/stats/dashboard'),
    api('GET', '/orders/stats/funnel'),
  ]);
  if (!dashRes || !funnelRes) return;

  const d = dashRes.today || {};

  // ★ TEAM/AGENCY 유저: 카드 라벨을 '내 주문' 관점으로 변경
  const myPrefix = (isTeam || isAgency) ? '내 ' : '';
  const cards = isTeam ? [
    { label: '내 전체 주문', value: d.total || 0, icon: 'fa-boxes-stacked', color: 'blue', click: () => navigateTo('my-orders'), desc: '내 주문 목록으로 이동' },
    { label: '배정됨(준비)', value: (d.distributed || 0) + (d.assigned || 0), icon: 'fa-inbox', color: 'indigo', click: () => navigateTo('my-orders'), desc: '배정된 주문 보기' },
    { label: '수행중', value: d.in_progress || 0, icon: 'fa-wrench', color: 'amber', click: () => navigateTo('my-orders'), desc: '수행 중인 주문 보기' },
    { label: '제출/완료', value: (d.submitted || 0) + (d.hq_approved || 0), icon: 'fa-clipboard-check', color: 'green', click: () => navigateTo('my-orders'), desc: '제출/승인 주문 보기' },
    { label: '반려', value: d.rejected || 0, icon: 'fa-ban', color: 'red', click: () => navigateTo('my-orders'), desc: '반려된 주문 보기' },
    { label: '정산확정', value: d.settlement_confirmed || 0, icon: 'fa-coins', color: 'emerald', click: () => navigateTo('my-stats'), desc: '내 현황 보기' },
    { label: '총 금액', value: formatAmount(d.total_amount), icon: 'fa-won-sign', color: 'purple', isText: true, click: () => navigateTo('my-stats'), desc: '내 현황 보기' },
  ] : [
    { label: `${myPrefix}총 주문`, value: d.total || 0, icon: 'fa-boxes-stacked', color: 'blue', click: () => navigateTo(isAgency ? 'agency-orders' : 'orders'), desc: '전체 주문 목록으로 이동' },
    { label: '오늘 수신', value: dashRes.today_received || 0, icon: 'fa-inbox', color: 'indigo', click: () => { window._orderFilters = { status: 'RECEIVED' }; navigateTo('orders'); }, desc: '수신 상태 주문 보기' },
    { label: '검수 대기', value: dashRes.pending_review || 0, icon: 'fa-clipboard-list', color: 'amber', click: () => navigateTo(currentUser.org_type === 'HQ' ? 'review-hq' : 'review-region'), desc: '검수 대기 목록으로 이동' },
    { label: 'HQ검수 대기', value: dashRes.pending_hq_review || 0, icon: 'fa-shield-halved', color: 'orange', click: () => navigateTo('review-hq'), desc: 'HQ 2차 검수 목록' },
    { label: 'HQ 승인', value: d.hq_approved || 0, icon: 'fa-circle-check', color: 'green', click: () => { window._orderFilters = { status: 'HQ_APPROVED' }; navigateTo('orders'); }, desc: 'HQ 승인 완료 주문' },
    { label: '정산 확정', value: d.settlement_confirmed || 0, icon: 'fa-coins', color: 'emerald', click: () => navigateTo('settlement'), desc: '정산관리 페이지로 이동' },
    { label: '반려', value: d.rejected || 0, icon: 'fa-ban', color: 'red', click: () => { window._orderFilters = { status: 'REGION_REJECTED' }; navigateTo('orders'); }, desc: '반려된 주문 목록' },
    { label: '총 금액', value: formatAmount(d.total_amount), icon: 'fa-won-sign', color: 'purple', isText: true, click: () => navigateTo('statistics'), desc: '통계 페이지로 이동' },
  ];

  window._dashCardHandlers = {};
  window._dashRegionSummary = dashRes.region_summary || [];
  cards.forEach((c, i) => { window._dashCardHandlers[i] = c.click; });

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-chart-pie mr-2 text-blue-600"></i>${isTeam ? '내 대시보드' : '대시보드'}</h2>
      
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
          <h3 class="text-sm font-semibold mb-4"><i class="fas fa-chart-pie mr-2 text-pink-500"></i>${isTeam ? '내 주문 ' : ''}상태별 분포</h3>
          <div class="relative" style="height:220px;">
            <canvas id="chart-status-donut"></canvas>
          </div>
        </div>

        <!-- 지역총판별 바 차트 (TEAM은 퍼널로 대체) -->
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <h3 class="text-sm font-semibold mb-4"><i class="fas fa-chart-bar mr-2 text-indigo-500"></i>${isTeam ? '내 주문 진행 현황' : '지역총판별 주문 현황'}</h3>
          <div class="relative" style="height:220px;">
            <canvas id="chart-region-bar"></canvas>
          </div>
        </div>

        <!-- 금액 도넛 차트 -->
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <h3 class="text-sm font-semibold mb-4"><i class="fas fa-won-sign mr-2 text-emerald-500"></i>${isTeam ? '내 ' : ''}상태별 금액 비중</h3>
          <div class="relative" style="height:220px;">
            <canvas id="chart-amount-donut"></canvas>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 ${isTeam ? '' : 'lg:grid-cols-2'} gap-6 mb-8">
        <!-- 주문 퍼널 -->
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold"><i class="fas fa-filter mr-2 text-blue-500"></i>${isTeam ? '내 주문 처리 현황' : '주문 처리 퍼널'}</h3>
            <button onclick="navigateTo('${isTeam ? 'my-orders' : 'orders'}')" class="text-xs text-blue-500 hover:text-blue-700 transition" data-tooltip="${isTeam ? '내 주문으로 이동' : '주문관리로 이동'}">
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
        
        ${!isTeam ? `
        <!-- 지역총판별 현황 테이블 -->
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold"><i class="fas fa-building mr-2 text-indigo-500"></i>지역총판별 현황</h3>
            <button onclick="navigateTo('statistics')" class="text-xs text-blue-500 hover:text-blue-700 transition" data-tooltip="통계 페이지로 이동">
              <i class="fas fa-chart-bar mr-1"></i>통계
            </button>
          </div>
          ${renderDataTable({
            tableId: 'dash-region-table',
            caption: '지역총판별 주문 현황',
            columns: [
              { key: 'region_name', label: '지역총판', render: r => `<span class="font-medium text-blue-700"><i class="fas fa-building text-[10px] mr-1 text-blue-400"></i>${r.region_name}</span>` },
              { key: 'active_orders', label: '진행중', align: 'right', render: r => `<span class="font-medium text-blue-600">${r.active_orders}</span>` },
              { key: 'pending_review', label: '검수대기', align: 'right', render: r => `<span class="font-medium text-amber-600">${r.pending_review}</span>` },
              { key: 'ready_for_settlement', label: '정산대기', align: 'right', render: r => `<span class="font-medium text-green-600">${r.ready_for_settlement}</span>` },
              { key: 'settled', label: '정산완료', align: 'right', render: r => `<span class="font-medium text-emerald-600">${r.settled}</span>` },
            ],
            rows: dashRes.region_summary || [],
            onRowClick: '_dashRegionClick',
            emptyText: '지역총판 데이터 없음',
          })}
        </div>
        ` : ''}
      </div>

      ${!isTeam ? `
      <!-- 지역 히트맵 -->
      <div class="bg-white rounded-xl p-6 border border-gray-100 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold"><i class="fas fa-map mr-2 text-teal-500"></i>지역별 주문 현황 히트맵</h3>
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded" style="background:#dbeafe"></span>적음</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded" style="background:#3b82f6"></span>보통</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded" style="background:#1e3a8a"></span>많음</span>
          </div>
        </div>
        <div id="region-heatmap" class="flex items-center justify-center" style="min-height:320px;"></div>
      </div>
      ` : ''}

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

  // ─── 히트맵 렌더링 (HQ/REGION만) ───
  if (!isTeam) {
    _renderRegionHeatmap(dashRes.region_summary || []);
  }

  // ─── v14.0: 매출 추이 + 정산 현황 (HQ/REGION만; TEAM/AGENCY는 자기 퍼널로 충분) ───
  if (currentUser && !isTeam && (currentUser.org_type === 'HQ' || currentUser.org_type === 'REGION')) {
    const extraContainer = document.createElement('div');
    extraContainer.id = 'dashboard-extra';
    el.querySelector('.fade-in')?.appendChild(extraContainer);

    // 비동기로 추가 차트 로드 (메인 대시보드 블로킹 방지)
    Promise.all([renderRevenueTrendSection(), renderSettlementSummarySection()]).then(([trendHtml, settleHtml]) => {
      const extra = document.getElementById('dashboard-extra');
      if (extra) {
        extra.innerHTML = `
          ${trendHtml ? `<h3 class="text-lg font-bold text-gray-800 mb-4 mt-4"><i class="fas fa-chart-line mr-2 text-green-500"></i>매출 추이</h3>${trendHtml}` : ''}
          ${settleHtml ? `<h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-coins mr-2 text-emerald-500"></i>정산 현황</h3>${settleHtml}` : ''}
        `;
        // 추가 차트 렌더링
        api('GET', '/stats/revenue-trend?days=30').then(res => {
          if (res?.daily) _renderRevenueTrendCharts(res.daily, res.by_region || []);
        });
        api('GET', '/stats/settlement-summary').then(res => {
          if (res?.status_summary) _renderSettlementCharts(res.status_summary, res.by_region || []);
        });
      }
    });
  }

  } catch (e) {
  console.error('[renderDashboard]', e);
  el.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1 text-gray-400">' + (e.message||e) + '</p></div>';
  }

  // ★ v22.0: 배너 광고 자동 삽입
  if (typeof injectDashboardBanners === 'function') {
    injectDashboardBanners().catch(e => console.error('[Banner] inject error:', e));
  }
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

  // 2) 지역총판별 바 차트 / TEAM은 진행현황 수평 바 차트
  const barCtx = document.getElementById('chart-region-bar');
  if (barCtx) {
    const isTeamDash = currentUser && (currentUser.org_type === 'TEAM' || currentUser.roles.includes('TEAM_LEADER'));
    if (isTeamDash && funnel.length > 0) {
      // TEAM 유저: 퍼널 데이터로 수평 바 차트
      const funnelLabels = funnel.map(f => STATUS_LABELS[f.status] || f.status);
      const funnelData = funnel.map(f => f.count);
      const funnelColors = funnel.map(f => STATUS_COLORS[f.status] || '#cbd5e1');
      _dashCharts.regionBar = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: funnelLabels,
          datasets: [{
            label: '주문 수',
            data: funnelData,
            backgroundColor: funnelColors,
            borderRadius: 6,
            borderSkipped: false,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.parsed.x}건`,
              }
            }
          },
          scales: {
            x: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: '#f1f5f9' } },
            y: { grid: { display: false }, ticks: { font: { size: 10 } } },
          },
        }
      });
    } else if (regionSummary.length > 0) {
      // HQ/REGION 유저: 지역총판별 바 차트
      const regionColors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'];
      _dashCharts.regionBar = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: regionSummary.map(r => r.region_name.replace('지역총판', '')),
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
function _dashRegionClick(idx) {
  const summary = window._dashRegionSummary || [];
  const r = summary[idx];
  if (r) showRegionDetailModal(r.org_id, r.region_name);
}

function _dashSettleRunClick() {
  navigateTo('settlement');
}

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

// ─── 지역총판 컨텍스트 메뉴 ───
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

// ─── 지역총판 상세 모달 (Chart.js 포함) ───
async function showRegionDetailModal(orgId, regionName) {
  try {
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
        ${renderDataTable({ columns: [
          { key: 'date', label: '날짜', render: s => `<span class="text-xs">${s.date}</span>` },
          { key: 'intake_count', label: '인입', align: 'right', render: s => s.intake_count || 0 },
          { key: 'assigned_to_team_count', label: '배정', align: 'right', render: s => s.assigned_to_team_count || 0 },
          { key: 'hq_approved_count', label: '승인', align: 'right', render: s => s.hq_approved_count || 0 },
          { key: 'settlement_confirmed_count', label: '정산', align: 'right', render: s => `<span class="font-bold text-green-600">${s.settlement_confirmed_count || 0}</span>` }
        ], rows: stats, compact: true, noBorder: true })}
      </div>` : '<p class="text-gray-400 text-sm text-center py-4">일별 통계 데이터가 없습니다.</p>'}

      ${leaders.length > 0 ? `
      <div>
        <h4 class="font-semibold mb-3"><i class="fas fa-users mr-1 text-purple-500"></i>소속 팀장 현황</h4>
        ${renderDataTable({ columns: [
          { key: 'team_leader_name', label: '팀장', render: l => `<span class="font-medium">${escapeHtml(l.team_leader_name)}</span>` },
          { key: 'intake_count', label: '수임', align: 'right', render: l => l.intake_count || 0 },
          { key: 'submitted_count', label: '제출', align: 'right', render: l => l.submitted_count || 0 },
          { key: 'hq_approved_count', label: '승인', align: 'right', render: l => l.hq_approved_count || 0 },
          { key: 'payable_amount_sum', label: '지급액', align: 'right', render: l => `<span class="font-bold text-green-600">${formatAmount(l.payable_amount_sum)}</span>` }
        ], rows: leaders, compact: true, noBorder: true,
           rowAttrs: l => `data-preview="user" data-preview-id="${l.team_leader_id || ''}" data-preview-title="${escapeHtml(l.team_leader_name)}"` })}
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

  } catch (e) {
  console.error('[showRegionDetailModal]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ════════ 매출 추이 차트 ════════
async function renderRevenueTrendSection() {
  try {
  const trendRes = await api('GET', '/stats/revenue-trend?days=30');
  if (!trendRes?.daily) return '';

  const daily = trendRes.daily || [];
  const byRegion = trendRes.by_region || [];
  if (daily.length === 0 && byRegion.length === 0) return '';

  return `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- 일별 매출 추이 -->
      <div class="bg-white rounded-xl p-6 border border-gray-100">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold"><i class="fas fa-chart-line mr-2 text-green-500"></i>일별 매출 추이 (30일)</h3>
          <div class="flex gap-1">
            <button onclick="_toggleTrendView('daily')" id="btn-trend-daily" class="px-2 py-1 text-[10px] rounded bg-green-100 text-green-700 font-medium">일별</button>
            <button onclick="_toggleTrendView('cumulative')" id="btn-trend-cum" class="px-2 py-1 text-[10px] rounded bg-gray-100 text-gray-500">누적</button>
          </div>
        </div>
        <div style="height:250px;"><canvas id="chart-revenue-trend"></canvas></div>
      </div>

      <!-- 지역별 매출 비교 -->
      <div class="bg-white rounded-xl p-6 border border-gray-100">
        <h3 class="text-sm font-semibold mb-4"><i class="fas fa-map mr-2 text-purple-500"></i>지역별 매출 비교</h3>
        <div style="height:250px;"><canvas id="chart-region-revenue"></canvas></div>
      </div>
    </div>`;

  } catch (e) {
  console.error('[renderRevenueTrendSection]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

function _renderRevenueTrendCharts(daily, byRegion) {
  if (typeof Chart === 'undefined') return;

  // 1) 일별 매출 추이 라인 차트
  const trendCtx = document.getElementById('chart-revenue-trend');
  if (trendCtx && daily.length > 0) {
    _dashCharts.revenueTrend = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: daily.map(d => d.date?.substring(5) || ''),
        datasets: [
          {
            label: '매출액 (만원)',
            data: daily.map(d => Math.round((d.revenue || 0) / 10000)),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.1)',
            fill: true, tension: 0.3, pointRadius: 2, pointHoverRadius: 5,
            yAxisID: 'y',
          },
          {
            label: '지급액 (만원)',
            data: daily.map(d => Math.round((d.payable || 0) / 10000)),
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderDash: [5, 3], tension: 0.3, pointRadius: 2,
            yAxisID: 'y',
          },
          {
            label: '주문건수',
            data: daily.map(d => d.orders || 0),
            borderColor: '#3b82f6',
            backgroundColor: 'transparent',
            tension: 0.3, pointRadius: 2, borderWidth: 1.5,
            yAxisID: 'y1',
          },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 8 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.datasetIndex < 2) return ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}만원`;
                return ` ${ctx.dataset.label}: ${ctx.parsed.y}건`;
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 10 } },
          y: { position: 'left', beginAtZero: true, ticks: { font: { size: 9 }, callback: v => v + '만' }, grid: { color: '#f1f5f9' } },
          y1: { position: 'right', beginAtZero: true, ticks: { font: { size: 9 }, stepSize: 1 }, grid: { display: false } },
        }
      }
    });
  }

  // 2) 지역별 매출 비교 수평 바 차트
  const regionCtx = document.getElementById('chart-region-revenue');
  if (regionCtx && byRegion.length > 0) {
    _dashCharts.regionRevenue = new Chart(regionCtx, {
      type: 'bar',
      data: {
        labels: byRegion.map(r => r.region_name?.replace('지역총판', '') || ''),
        datasets: [
          {
            label: '매출액 (만원)',
            data: byRegion.map(r => Math.round((r.revenue || 0) / 10000)),
            backgroundColor: 'rgba(16,185,129,0.7)',
            borderRadius: 4,
          },
          {
            label: '지급액 (만원)',
            data: byRegion.map(r => Math.round((r.payable || 0) / 10000)),
            backgroundColor: 'rgba(245,158,11,0.7)',
            borderRadius: 4,
          },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 8 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.x.toLocaleString()}만원` } },
        },
        scales: {
          x: { beginAtZero: true, ticks: { font: { size: 9 }, callback: v => v + '만' }, grid: { color: '#f1f5f9' } },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } },
        }
      }
    });
  }
}

function _toggleTrendView(mode) {
  // 시각적 버튼 토글만 (실제 데이터 변환 불필요 - 일별이 기본)
  document.getElementById('btn-trend-daily')?.classList.toggle('bg-green-100', mode === 'daily');
  document.getElementById('btn-trend-daily')?.classList.toggle('text-green-700', mode === 'daily');
  document.getElementById('btn-trend-daily')?.classList.toggle('bg-gray-100', mode !== 'daily');
  document.getElementById('btn-trend-cum')?.classList.toggle('bg-green-100', mode === 'cumulative');
  document.getElementById('btn-trend-cum')?.classList.toggle('text-green-700', mode === 'cumulative');
  document.getElementById('btn-trend-cum')?.classList.toggle('bg-gray-100', mode !== 'cumulative');
}

// ════════ 정산 현황 차트 ════════
async function renderSettlementSummarySection() {
  try {
  const settleRes = await api('GET', '/stats/settlement-summary');
  if (!settleRes?.status_summary) return '';

  const statuses = settleRes.status_summary || [];
  const byRegion = settleRes.by_region || [];
  const recentRuns = settleRes.recent_runs || [];

  const totalConfirmed = statuses.find(s => s.status === 'CONFIRMED');
  const totalPaid = statuses.find(s => s.status === 'PAID');
  const totalCalc = statuses.find(s => s.status === 'CALCULATED');

  return `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <!-- 정산 현황 카드 -->
      <div class="bg-white rounded-xl p-6 border border-gray-100">
        <h3 class="text-sm font-semibold mb-4"><i class="fas fa-coins mr-2 text-emerald-500"></i>정산 현황 요약</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
            <div class="flex items-center gap-2"><i class="fas fa-calculator text-yellow-600"></i><span class="text-sm">산출완료</span></div>
            <div class="text-right">
              <div class="text-lg font-bold text-yellow-700">${(totalCalc?.count || 0)}건</div>
              <div class="text-xs text-yellow-600">${formatAmount(totalCalc?.payable_total)}</div>
            </div>
          </div>
          <div class="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div class="flex items-center gap-2"><i class="fas fa-check-double text-green-600"></i><span class="text-sm">확정</span></div>
            <div class="text-right">
              <div class="text-lg font-bold text-green-700">${(totalConfirmed?.count || 0)}건</div>
              <div class="text-xs text-green-600">${formatAmount(totalConfirmed?.payable_total)}</div>
            </div>
          </div>
          <div class="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
            <div class="flex items-center gap-2"><i class="fas fa-money-check text-emerald-600"></i><span class="text-sm">지급완료</span></div>
            <div class="text-right">
              <div class="text-lg font-bold text-emerald-700">${(totalPaid?.count || 0)}건</div>
              <div class="text-xs text-emerald-600">${formatAmount(totalPaid?.payable_total)}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 정산 도넛 차트 -->
      <div class="bg-white rounded-xl p-6 border border-gray-100">
        <h3 class="text-sm font-semibold mb-4"><i class="fas fa-chart-pie mr-2 text-teal-500"></i>정산 상태 분포</h3>
        <div style="height:220px;"><canvas id="chart-settlement-donut"></canvas></div>
      </div>

      <!-- 지역별 정산 바 차트 -->
      <div class="bg-white rounded-xl p-6 border border-gray-100">
        <h3 class="text-sm font-semibold mb-4"><i class="fas fa-building mr-2 text-blue-500"></i>지역별 정산</h3>
        <div style="height:220px;"><canvas id="chart-settlement-region"></canvas></div>
      </div>
    </div>

    ${recentRuns.length > 0 ? `
    <div class="bg-white rounded-xl p-6 border border-gray-100 mb-8">
      <h3 class="text-sm font-semibold mb-4"><i class="fas fa-history mr-2 text-indigo-500"></i>최근 정산 Run</h3>
      ${renderDataTable({
        tableId: 'dash-settle-runs',
        caption: '최근 정산 실행 목록',
        columns: [
          { key: 'run_id', label: 'Run ID', render: r => `<span class="font-mono text-xs text-blue-600">#${r.run_id}</span>` },
          { key: 'period', label: '기간', render: r => `<span class="text-xs">${r.period_start || ''} ~ ${r.period_end || ''}</span>` },
          { key: 'status', label: '상태', align: 'center', render: r => { const st = OMS.RUN_STATUS[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-600' }; return `<span class="status-badge ${st.color}">${st.label}</span>`; } },
          { key: 'settlement_count', label: '건수', align: 'right', render: r => `<span class="font-medium">${r.settlement_count}</span>` },
          { key: 'total_base', label: '기본금액', align: 'right', render: r => `<span class="text-xs">${formatAmount(r.total_base)}</span>` },
          { key: 'total_payable', label: '지급액', align: 'right', render: r => `<span class="font-bold text-green-600">${formatAmount(r.total_payable)}</span>` },
          { key: 'created_at', label: '생성일', render: r => `<span class="text-xs text-gray-500">${formatDate(r.created_at)}</span>` },
        ],
        rows: recentRuns,
        onRowClick: '_dashSettleRunClick',
        emptyText: '정산 기록 없음',
      })}
    </div>` : ''}`;

  } catch (e) {
  console.error('[renderSettlementSummarySection]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

function _renderSettlementCharts(statuses, byRegion) {
  if (typeof Chart === 'undefined') return;

  // 정산 상태 도넛
  const donutCtx = document.getElementById('chart-settlement-donut');
  if (donutCtx && statuses.length > 0) {
    const SETTLE_COLORS = { CALCULATED: '#fbbf24', CONFIRMED: '#22c55e', PAID: '#10b981' };
    const SETTLE_LABELS = { CALCULATED: '산출완료', CONFIRMED: '확정', PAID: '지급완료' };

    _dashCharts.settlementDonut = new Chart(donutCtx, {
      type: 'doughnut',
      data: {
        labels: statuses.map(s => SETTLE_LABELS[s.status] || s.status),
        datasets: [{
          data: statuses.map(s => s.count),
          backgroundColor: statuses.map(s => SETTLE_COLORS[s.status] || '#cbd5e1'),
          borderWidth: 2, borderColor: '#fff',
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '55%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 8 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const s = statuses[ctx.dataIndex];
                return ` ${ctx.label}: ${ctx.parsed}건 (${formatAmount(s.payable_total)})`;
              }
            }
          }
        },
      }
    });
  }

  // 지역별 정산 스택 바
  const regionCtx = document.getElementById('chart-settlement-region');
  if (regionCtx && byRegion.length > 0) {
    _dashCharts.settlementRegion = new Chart(regionCtx, {
      type: 'bar',
      data: {
        labels: byRegion.map(r => r.region_name?.replace('지역총판', '') || ''),
        datasets: [
          { label: '확정', data: byRegion.map(r => r.confirmed || 0), backgroundColor: '#22c55e', borderRadius: 4 },
          { label: '지급', data: byRegion.map(r => r.paid || 0), backgroundColor: '#10b981', borderRadius: 4 },
          { label: '산출', data: byRegion.map(r => r.calculated || 0), backgroundColor: '#fbbf24', borderRadius: 4 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 8 } },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: '#f1f5f9' } },
        }
      }
    });
  }
}

// ════════ 대시보드 자동 폴링 ════════
let _dashPollTimer = null;
const _dashPollInterval = 60000; // 60초

function startDashboardPolling() {
  stopDashboardPolling();
  _dashPollTimer = setInterval(async () => {
    if (typeof currentPage !== 'undefined' && currentPage !== 'dashboard') {
      stopDashboardPolling();
      return;
    }
    try {
      const [dashRes, unreadRes] = await Promise.all([
        api('GET', '/stats/dashboard'),
        api('GET', '/notifications/unread-count'),
      ]);
      if (dashRes?.today) _updateDashCards(dashRes);
      if (unreadRes?.unread_count !== undefined) _updateNotifBadge(unreadRes.unread_count);
    } catch (e) { /* 폴링 실패 무시 */ }
  }, _dashPollInterval);
}

function stopDashboardPolling() {
  if (_dashPollTimer) { clearInterval(_dashPollTimer); _dashPollTimer = null; }
}

function _updateDashCards(dashRes) {
  const d = dashRes.today || {};
  const isTeam = currentUser && (currentUser.org_type === 'TEAM' || currentUser.roles.includes('TEAM_LEADER'));
  const isAgency = currentUser && currentUser.is_agency === true;
  const values = isTeam ? [
    d.total || 0,
    (d.distributed || 0) + (d.assigned || 0),
    d.in_progress || 0,
    (d.submitted || 0) + (d.hq_approved || 0),
    d.rejected || 0,
    d.settlement_confirmed || 0,
    formatAmount(d.total_amount),
  ] : [
    d.total || 0, dashRes.today_received || 0, dashRes.pending_review || 0,
    dashRes.pending_hq_review || 0, d.hq_approved || 0, d.settlement_confirmed || 0,
    d.rejected || 0, formatAmount(d.total_amount),
  ];
  const countEls = document.querySelectorAll('.ix-count-animate');
  countEls.forEach((el, i) => {
    if (i < values.length) {
      const newVal = String(values[i]);
      if (el.textContent !== newVal) {
        el.style.transition = 'color 0.3s, transform 0.3s';
        el.style.color = '#2563eb';
        el.style.transform = 'scale(1.15)';
        el.textContent = newVal;
        setTimeout(() => { el.style.color = ''; el.style.transform = ''; }, 600);
      }
    }
  });
}

function _updateNotifBadge(count) {
  document.querySelectorAll('.notif-badge-count').forEach(el => {
    el.textContent = count > 99 ? '99+' : count;
    el.style.display = count > 0 ? '' : 'none';
  });
}

// ════════ 글로벌 알림 폴링 (30초) ════════
let _globalNotifTimer = null;
function startGlobalNotifPolling() {
  if (_globalNotifTimer) return;
  _globalNotifTimer = setInterval(async () => {
    try {
      const res = await api('GET', '/notifications/unread-count');
      if (res?.unread_count !== undefined) _updateNotifBadge(res.unread_count);
    } catch (e) { /* ignore */ }
  }, 30000);
}
function stopGlobalNotifPolling() {
  if (_globalNotifTimer) { clearInterval(_globalNotifTimer); _globalNotifTimer = null; }
}

// ════════ 지역 히트맵 SVG 렌더링 ════════
function _renderRegionHeatmap(regionSummary) {
  const el = document.getElementById('region-heatmap');
  if (!el) return;

  // 지역총판 코드 → region_name 매핑 (대시보드 region_summary에서)
  const regionData = {};
  (regionSummary || []).forEach(r => {
    const total = (r.active_orders || 0) + (r.pending_review || 0) + (r.ready_for_settlement || 0) + (r.settled || 0);
    regionData[r.region_name] = { total, ...r };
  });

  // 한국 광역시/도 SVG 경로 (간이 버전)
  const regions = [
    { id: 'seoul', name: '서울', cx: 148, cy: 122, r: 16, match: '서울' },
    { id: 'gyeonggi', name: '경기', cx: 155, cy: 100, r: 30, match: '경기', isRing: true },
    { id: 'incheon', name: '인천', cx: 118, cy: 112, r: 14, match: '인천' },
    { id: 'gangwon', name: '강원', cx: 220, cy: 80, r: 28, match: '강원' },
    { id: 'chungbuk', name: '충북', cx: 195, cy: 155, r: 22, match: '충북' },
    { id: 'chungnam', name: '충남', cx: 130, cy: 175, r: 24, match: '충남' },
    { id: 'sejong', name: '세종', cx: 160, cy: 165, r: 10, match: '세종' },
    { id: 'daejeon', name: '대전', cx: 162, cy: 185, r: 12, match: '대전' },
    { id: 'jeonbuk', name: '전북', cx: 125, cy: 220, r: 22, match: '전북' },
    { id: 'jeonnam', name: '전남', cx: 110, cy: 275, r: 26, match: '전남' },
    { id: 'gwangju', name: '광주', cx: 110, cy: 250, r: 12, match: '광주' },
    { id: 'gyeongbuk', name: '경북', cx: 240, cy: 180, r: 28, match: '경북' },
    { id: 'daegu', name: '대구', cx: 230, cy: 210, r: 13, match: '대구' },
    { id: 'gyeongnam', name: '경남', cx: 210, cy: 260, r: 26, match: '경남' },
    { id: 'ulsan', name: '울산', cx: 265, cy: 230, r: 13, match: '울산' },
    { id: 'busan', name: '부산', cx: 250, cy: 265, r: 15, match: '부산' },
    { id: 'jeju', name: '제주', cx: 115, cy: 345, r: 20, match: '제주' },
  ];

  // 지역총판이 관할하는 광역시/도 매핑
  const orgToRegions = {};
  for (const [rName, rData] of Object.entries(regionData)) {
    regions.forEach(reg => {
      if (rName.includes(reg.match)) {
        orgToRegions[reg.id] = { orgName: rName, data: rData };
      }
    });
  }

  // 최대값 계산 (히트맵 색상 스케일)
  const maxTotal = Math.max(...Object.values(regionData).map(d => d.total), 1);

  // 색상 함수
  function getHeatColor(value) {
    if (value === 0) return '#f3f4f6'; // gray-100
    const ratio = Math.min(value / maxTotal, 1);
    if (ratio < 0.25) return '#dbeafe'; // blue-100
    if (ratio < 0.5) return '#93c5fd';  // blue-300
    if (ratio < 0.75) return '#3b82f6'; // blue-500
    return '#1e3a8a';                    // blue-900
  }

  function getTextColor(value) {
    if (value === 0) return '#9ca3af';
    const ratio = Math.min(value / maxTotal, 1);
    return ratio >= 0.5 ? '#ffffff' : '#1e3a8a';
  }

  let svgContent = `<svg viewBox="40 30 270 340" width="100%" style="max-width:420px;max-height:360px" xmlns="http://www.w3.org/2000/svg">`;
  
  // 배경 한반도 아웃라인 (간이)
  svgContent += `<path d="M130,40 Q170,35 200,50 Q240,55 260,75 Q275,100 270,140 Q265,170 270,200 Q275,230 260,260 Q240,290 230,300 Q210,310 200,290 Q180,280 170,290 Q155,300 140,295 Q120,290 110,280 Q95,260 90,230 Q85,200 95,180 Q105,160 100,140 Q95,120 105,100 Q110,80 120,60 Q125,45 130,40 Z" fill="#e5e7eb" stroke="#d1d5db" stroke-width="1" opacity="0.3"/>`;
  
  // 제주도 아웃라인
  svgContent += `<ellipse cx="115" cy="345" rx="30" ry="14" fill="#e5e7eb" stroke="#d1d5db" stroke-width="1" opacity="0.3"/>`;

  // 각 지역 원
  regions.forEach(reg => {
    const orgInfo = orgToRegions[reg.id];
    const value = orgInfo ? orgInfo.data.total : 0;
    const hasOrg = !!orgInfo;
    const fillColor = hasOrg ? getHeatColor(value) : '#f9fafb';
    const strokeColor = hasOrg ? '#2563eb' : '#e5e7eb';
    const strokeWidth = hasOrg ? 2 : 1;
    const textColor = hasOrg ? getTextColor(value) : '#d1d5db';
    const cursor = hasOrg ? 'pointer' : 'default';
    const opacity = hasOrg ? 1 : 0.5;

    if (reg.isRing) {
      // 경기도: 링 형태
      svgContent += `<circle cx="${reg.cx}" cy="${reg.cy}" r="${reg.r}" fill="none" stroke="${fillColor}" stroke-width="12" opacity="${opacity}" style="cursor:${cursor}" data-region="${reg.id}">
        <title>${reg.name}: ${value}건${orgInfo ? ` (${orgInfo.orgName})` : ''}</title></circle>`;
      svgContent += `<circle cx="${reg.cx}" cy="${reg.cy}" r="${reg.r}" fill="none" stroke="${strokeColor}" stroke-width="1" opacity="0.3"/>`;
    } else {
      svgContent += `<circle cx="${reg.cx}" cy="${reg.cy}" r="${reg.r}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" opacity="${opacity}" style="cursor:${cursor}" data-region="${reg.id}">
        <title>${reg.name}: ${value}건${orgInfo ? ` (${orgInfo.orgName})` : ''}</title></circle>`;
    }

    // 레이블
    const fontSize = reg.r < 14 ? 7 : 9;
    svgContent += `<text x="${reg.cx}" y="${reg.cy - 2}" text-anchor="middle" fill="${textColor}" font-size="${fontSize}" font-weight="600" style="pointer-events:none">${reg.name}</text>`;
    if (hasOrg) {
      svgContent += `<text x="${reg.cx}" y="${reg.cy + 8}" text-anchor="middle" fill="${textColor}" font-size="${fontSize - 1}" font-weight="700" style="pointer-events:none">${value}건</text>`;
    }
  });

  svgContent += `</svg>`;

  // 하단에 활성 지역총판 요약
  let summaryHtml = '<div class="flex flex-wrap gap-3 mt-4 justify-center">';
  for (const [rName, rData] of Object.entries(regionData)) {
    const total = rData.total;
    summaryHtml += `<div class="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
      <div class="w-3 h-3 rounded-full" style="background:${getHeatColor(total)}"></div>
      <span class="text-sm font-medium text-blue-800">${rName}</span>
      <span class="text-sm font-bold text-blue-600">${total}건</span>
    </div>`;
  }
  summaryHtml += '</div>';

  el.innerHTML = svgContent + summaryHtml;
}
