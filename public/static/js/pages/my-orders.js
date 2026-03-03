// ============================================================
// 다하다 OMS - 팀장 뷰 (내 주문 + 내 현황)
// ============================================================

// ════════ 내 주문 ════════
async function renderMyOrders(el) {
  const params = new URLSearchParams(window._myOrderFilters || {});
  if (!params.has('limit')) params.set('limit', '20');
  const res = await api('GET', `/orders?${params.toString()}`);
  const orders = res?.orders || [];

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-list mr-2 text-green-600"></i>내 주문</h2>

      <!-- 상태별 카드 -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        ${[
          { status: '', label: '전체', icon: 'fa-list', color: 'gray', count: res?.total || 0 },
          { status: 'ASSIGNED', label: '배정됨', icon: 'fa-user-check', color: 'purple' },
          { status: 'IN_PROGRESS', label: '작업중', icon: 'fa-wrench', color: 'orange' },
          { status: 'SUBMITTED', label: '제출됨', icon: 'fa-file-lines', color: 'cyan' },
          { status: 'REGION_REJECTED,HQ_REJECTED', label: '반려', icon: 'fa-times-circle', color: 'red' },
        ].map(c => {
          const count = c.count !== undefined ? c.count : orders.filter(o => c.status.split(',').includes(o.status)).length;
          const active = params.get('status') === c.status;
          return `
          <button onclick="window._myOrderFilters={status:'${c.status}',page:1};renderContent()" 
            class="card bg-white rounded-xl p-4 border ${active ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-100'} text-center">
            <i class="fas ${c.icon} text-${c.color}-500 text-lg mb-1"></i>
            <div class="text-2xl font-bold">${count}</div>
            <div class="text-xs text-gray-500">${c.label}</div>
          </button>`;
        }).join('')}
      </div>

      <!-- 주문 목록 -->
      <div class="space-y-3">
        ${orders.map(o => `
          <div class="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-3">
                <span class="font-mono text-gray-400 text-xs">#${o.order_id}</span>
                <span class="font-bold">${o.customer_name || '-'}</span>
                ${statusBadge(o.status)}
              </div>
              <span class="font-medium text-blue-600">${formatAmount(o.base_amount)}</span>
            </div>
            <div class="text-sm text-gray-500 mb-3">${o.address_text || '-'}</div>
            <div class="flex flex-wrap gap-2">
              <button onclick="showOrderDetail(${o.order_id})" class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs"><i class="fas fa-eye mr-1"></i>상세</button>
              ${o.status === 'ASSIGNED' ? `<button onclick="startWork(${o.order_id})" class="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs"><i class="fas fa-play mr-1"></i>작업시작</button>` : ''}
              ${['IN_PROGRESS', 'REGION_REJECTED', 'HQ_REJECTED'].includes(o.status) ? `<button onclick="showReportModal(${o.order_id})" class="px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs"><i class="fas fa-file-pen mr-1"></i>보고서 제출</button>` : ''}
            </div>
          </div>
        `).join('')}
        ${orders.length === 0 ? '<div class="bg-white rounded-xl p-8 text-center text-gray-400 border"><i class="fas fa-inbox text-4xl mb-3"></i><p>주문이 없습니다.</p></div>' : ''}
      </div>
    </div>`;
}

async function startWork(orderId) {
  showConfirmModal('작업 시작', `주문 #${orderId}의 작업을 시작하시겠습니까?`,
    async () => {
      const res = await api('POST', `/orders/${orderId}/start`);
      if (res?.ok) { showToast('작업 시작!', 'success'); renderContent(); }
      else showToast(res?.error || '실패', 'error');
    }, '시작', 'bg-orange-600');
}

function showReportModal(orderId) {
  const content = `
    <form id="report-form" class="space-y-4">
      <div>
        <h4 class="font-semibold mb-2">체크리스트</h4>
        <div class="space-y-2">
          ${['외부촬영', '내부촬영', '세척전', '세척후', '영수증', '고객확인'].map(item => `
            <label class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
              <input type="checkbox" name="checklist" value="${item}" class="w-4 h-4 rounded">
              <span class="text-sm">${item}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">작업 메모</label>
        <textarea id="report-note" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="작업 내용을 기록하세요..."></textarea>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">사진 URL (쉼표 구분)</label>
        <input id="report-photos" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://example.com/photo1.jpg, ...">
        <p class="text-[10px] text-gray-400 mt-1">* 데모에서는 URL 입력으로 대체합니다.</p>
      </div>
    </form>`;
  showModal(`보고서 제출 — 주문 #${orderId}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitReport(${orderId})" class="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm">제출</button>`);
}

async function submitReport(orderId) {
  const checks = Array.from(document.querySelectorAll('input[name="checklist"]:checked')).map(el => el.value);
  const note = document.getElementById('report-note')?.value || '';
  const photoStr = document.getElementById('report-photos')?.value || '';
  const photos = photoStr.split(',').filter(s => s.trim()).map(url => ({ category: 'GENERAL', file_url: url.trim() }));

  const checklist = {};
  checks.forEach(c => { checklist[c] = true; });

  const res = await api('POST', `/orders/${orderId}/reports`, { checklist, note, photos });
  if (res?.ok) {
    showToast(`보고서 v${res.version} 제출 완료`, 'success');
    closeModal();
    renderContent();
  } else showToast(res?.error || '제출 실패', 'error');
}

// ════════ 내 현황 ════════
async function renderMyStats(el) {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const [statsRes, ledgerRes, funnelRes] = await Promise.all([
    api('GET', `/stats/team-leaders/daily?from=${weekAgo}&to=${today}`),
    api('GET', `/settlements/ledger?from=${weekAgo}&to=${today}`),
    api('GET', '/orders/stats/funnel'),
  ]);

  const stats = statsRes?.stats || [];
  const ledger = ledgerRes?.ledger || [];
  const funnel = funnelRes?.funnel || [];

  // 합산
  const totals = stats.reduce((acc, s) => ({
    intake: acc.intake + (s.intake_count || 0),
    submitted: acc.submitted + (s.submitted_count || 0),
    approved: acc.approved + (s.hq_approved_count || 0),
    settled: acc.settled + (s.settlement_confirmed_count || 0),
    payable: acc.payable + (s.payable_amount_sum || 0),
  }), { intake: 0, submitted: 0, approved: 0, settled: 0, payable: 0 });

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-chart-line mr-2 text-green-600"></i>내 현황</h2>

      <!-- 요약 카드 -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div class="card bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-2xl font-bold text-blue-600">${totals.intake}</div>
          <div class="text-xs text-gray-500">수임 건수</div>
        </div>
        <div class="card bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-2xl font-bold text-cyan-600">${totals.submitted}</div>
          <div class="text-xs text-gray-500">제출 건수</div>
        </div>
        <div class="card bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-2xl font-bold text-green-600">${totals.approved}</div>
          <div class="text-xs text-gray-500">HQ승인</div>
        </div>
        <div class="card bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-2xl font-bold text-emerald-600">${totals.settled}</div>
          <div class="text-xs text-gray-500">정산확정</div>
        </div>
        <div class="card bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-xl font-bold text-purple-600">${formatAmount(totals.payable)}</div>
          <div class="text-xs text-gray-500">예상지급액</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- 내 주문 퍼널 -->
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <h3 class="font-semibold mb-4"><i class="fas fa-filter mr-2 text-blue-500"></i>내 주문 상태 분포</h3>
          <div class="space-y-2">
            ${funnel.map(f => {
              const max = Math.max(...funnel.map(x => x.count), 1);
              const pct = (f.count / max * 100);
              const s = STATUS[f.status] || { label: f.status, color: 'bg-gray-100 text-gray-600' };
              return `
                <div class="flex items-center gap-3">
                  <div class="w-20 text-xs text-right text-gray-500">${s.label}</div>
                  <div class="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div class="h-full bg-blue-400 rounded-full flex items-center justify-end pr-2" style="width:${Math.max(pct, 10)}%">
                      <span class="text-[10px] font-bold text-white">${f.count}</span>
                    </div>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>

        <!-- 일별 통계 -->
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <h3 class="font-semibold mb-4"><i class="fas fa-calendar-days mr-2 text-green-500"></i>일별 현황 (최근 7일)</h3>
          <table class="w-full text-sm">
            <thead class="bg-gray-50"><tr>
              <th class="px-3 py-2 text-left">날짜</th><th class="px-3 py-2 text-right">수임</th>
              <th class="px-3 py-2 text-right">제출</th><th class="px-3 py-2 text-right">승인</th>
              <th class="px-3 py-2 text-right">지급액</th>
            </tr></thead>
            <tbody class="divide-y">${stats.map(s => `
              <tr class="hover:bg-gray-50">
                <td class="px-3 py-2 text-xs">${s.date}</td>
                <td class="px-3 py-2 text-right">${s.intake_count || 0}</td>
                <td class="px-3 py-2 text-right">${s.submitted_count || 0}</td>
                <td class="px-3 py-2 text-right">${s.hq_approved_count || 0}</td>
                <td class="px-3 py-2 text-right font-bold text-green-600">${formatAmount(s.payable_amount_sum)}</td>
              </tr>`).join('')}
              ${stats.length === 0 ? '<tr><td colspan="5" class="px-3 py-4 text-center text-gray-400">데이터 없음</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>

      ${ledger.length > 0 ? `
      <!-- 원장 -->
      <div class="bg-white rounded-xl p-5 border border-gray-100 mt-6">
        <h3 class="font-semibold mb-4"><i class="fas fa-wallet mr-2 text-amber-500"></i>정산 원장</h3>
        <table class="w-full text-sm">
          <thead class="bg-gray-50"><tr>
            <th class="px-3 py-2 text-left">날짜</th><th class="px-3 py-2 text-right">확정건수</th>
            <th class="px-3 py-2 text-right">확정지급액</th><th class="px-3 py-2 text-right">전금액</th>
          </tr></thead>
          <tbody class="divide-y">${ledger.map(l => `
            <tr class="hover:bg-gray-50">
              <td class="px-3 py-2 text-xs">${l.date}</td>
              <td class="px-3 py-2 text-right">${l.confirmed_count}</td>
              <td class="px-3 py-2 text-right font-bold text-green-600">${formatAmount(l.confirmed_payable_sum)}</td>
              <td class="px-3 py-2 text-right">${formatAmount(l.transferred_amount)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}
    </div>`;
}
