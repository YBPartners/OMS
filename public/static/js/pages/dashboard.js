// ============================================================
// 다하다 OMS - 대시보드 페이지
// ============================================================

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
