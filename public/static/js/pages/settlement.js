// ============================================================
// 다하다 OMS - 정산관리 + 대사(정합성) 페이지
// ============================================================

// ════════ 정산관리 ════════
async function renderSettlement(el) {
  const res = await api('GET', '/settlements/runs');
  const runs = res?.runs || [];

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-coins mr-2 text-amber-500"></i>정산관리</h2>
        <button onclick="showCreateRunModal()" class="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700"><i class="fas fa-plus mr-1"></i>정산 Run 생성</button>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-600"><tr>
            <th class="px-4 py-3 text-left">ID</th><th class="px-4 py-3 text-left">유형</th>
            <th class="px-4 py-3 text-left">기간</th><th class="px-4 py-3 text-center">상태</th>
            <th class="px-4 py-3 text-right">건수</th><th class="px-4 py-3 text-right">기본금액</th>
            <th class="px-4 py-3 text-right">수수료</th><th class="px-4 py-3 text-right">지급액</th>
            <th class="px-4 py-3 text-center">관리</th>
          </tr></thead>
          <tbody class="divide-y">
            ${runs.map(r => {
              const statusColors = { DRAFT: 'bg-gray-100 text-gray-700', CALCULATED: 'bg-blue-100 text-blue-700', CONFIRMED: 'bg-green-100 text-green-700' };
              return `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 font-mono text-gray-500">${r.run_id}</td>
                <td class="px-4 py-3">${r.period_type}</td>
                <td class="px-4 py-3 text-xs">${r.period_start} ~ ${r.period_end}</td>
                <td class="px-4 py-3 text-center"><span class="status-badge ${statusColors[r.status] || 'bg-gray-100'}">${r.status}</span></td>
                <td class="px-4 py-3 text-right">${r.total_count || 0}건</td>
                <td class="px-4 py-3 text-right">${formatAmount(r.total_base_amount)}</td>
                <td class="px-4 py-3 text-right text-red-600">${formatAmount(r.total_commission_amount)}</td>
                <td class="px-4 py-3 text-right font-bold text-green-600">${formatAmount(r.total_payable_amount)}</td>
                <td class="px-4 py-3 text-center">
                  <div class="flex gap-1 justify-center">
                    <button onclick="viewRunDetail(${r.run_id})" class="px-2 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200"><i class="fas fa-eye"></i></button>
                    ${r.status === 'DRAFT' ? `<button onclick="calculateRun(${r.run_id})" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"><i class="fas fa-calculator mr-1"></i>산출</button>` : ''}
                    ${r.status === 'CALCULATED' ? `<button onclick="confirmRun(${r.run_id})" class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"><i class="fas fa-check mr-1"></i>확정</button>` : ''}
                  </div>
                </td>
              </tr>`;
            }).join('')}
            ${runs.length === 0 ? '<tr><td colspan="9" class="px-4 py-8 text-center text-gray-400">정산 Run이 없습니다.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>`;
}

function showCreateRunModal() {
  const today = new Date().toISOString().split('T')[0];
  const content = `
    <div class="space-y-4">
      <div><label class="block text-xs text-gray-500 mb-1">정산 유형</label>
        <select id="run-type" class="w-full border rounded-lg px-3 py-2 text-sm">
          <option value="WEEKLY">주간</option><option value="MONTHLY">월간</option>
        </select></div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-xs text-gray-500 mb-1">시작일</label>
          <input id="run-start" type="date" class="w-full border rounded-lg px-3 py-2 text-sm" value="${today}"></div>
        <div><label class="block text-xs text-gray-500 mb-1">종료일</label>
          <input id="run-end" type="date" class="w-full border rounded-lg px-3 py-2 text-sm" value="${today}"></div>
      </div>
      <p class="text-xs text-gray-400">HQ_APPROVED 상태인 주문을 대상으로 정산을 산출합니다.</p>
    </div>`;
  showModal('정산 Run 생성', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="createRun()" class="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm">생성</button>`);
}

async function createRun() {
  const res = await api('POST', '/settlements/runs', {
    period_type: document.getElementById('run-type').value,
    period_start: document.getElementById('run-start').value,
    period_end: document.getElementById('run-end').value,
  });
  if (res?.run_id) { showToast(`Run #${res.run_id} 생성 완료`, 'success'); closeModal(); renderContent(); }
  else showToast(res?.error || '생성 실패', 'error');
}

async function calculateRun(runId) {
  showConfirmModal('정산 산출', `Run #${runId}의 정산을 산출하시겠습니까?<br><span class="text-xs text-gray-400">수수료 정책에 따라 자동 계산됩니다.</span>`,
    async () => {
      showToast('산출 중...', 'info');
      const res = await api('POST', `/settlements/runs/${runId}/calculate`);
      if (res?.run_id) {
        showToast(`산출 완료 — ${res.total_orders}건, 지급액 ${formatAmount(res.total_payable_amount)}`, 'success');
        renderContent();
      } else showToast(res?.error || '산출 실패', 'error');
    }, '산출 실행', 'bg-blue-600');
}

async function confirmRun(runId) {
  showConfirmModal('정산 확정', `Run #${runId}의 정산을 확정하시겠습니까?<br><span class="text-xs text-red-500">확정 후에는 되돌릴 수 없습니다.</span>`,
    async () => {
      const res = await api('POST', `/settlements/runs/${runId}/confirm`);
      if (res?.ok) { showToast(`확정 완료 — ${res.confirmed_count}건`, 'success'); renderContent(); }
      else showToast(res?.error || '확정 실패', 'error');
    }, '확정', 'bg-green-600');
}

async function viewRunDetail(runId) {
  const res = await api('GET', `/settlements/runs/${runId}/details`);
  if (!res?.run) return;
  const run = res.run;
  const settlements = res.settlements || [];

  const content = `
    <div class="space-y-4">
      <div class="grid grid-cols-4 gap-3">
        <div class="bg-gray-50 rounded-lg p-3 text-center"><div class="text-lg font-bold">${run.total_count || 0}</div><div class="text-xs text-gray-500">건수</div></div>
        <div class="bg-blue-50 rounded-lg p-3 text-center"><div class="text-lg font-bold">${formatAmount(run.total_base_amount)}</div><div class="text-xs text-gray-500">기본금액</div></div>
        <div class="bg-red-50 rounded-lg p-3 text-center"><div class="text-lg font-bold">${formatAmount(run.total_commission_amount)}</div><div class="text-xs text-gray-500">수수료</div></div>
        <div class="bg-green-50 rounded-lg p-3 text-center"><div class="text-lg font-bold text-green-600">${formatAmount(run.total_payable_amount)}</div><div class="text-xs text-gray-500">지급액</div></div>
      </div>
      <div class="max-h-60 overflow-y-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 sticky top-0"><tr>
            <th class="px-3 py-2 text-left">주문</th><th class="px-3 py-2 text-left">고객</th><th class="px-3 py-2 text-left">법인</th>
            <th class="px-3 py-2 text-left">팀장</th><th class="px-3 py-2 text-right">금액</th>
            <th class="px-3 py-2 text-center">수수료</th><th class="px-3 py-2 text-right">지급액</th>
          </tr></thead>
          <tbody class="divide-y">${settlements.map(s => `
            <tr class="hover:bg-gray-50">
              <td class="px-3 py-2 font-mono text-xs">#${s.order_id}</td>
              <td class="px-3 py-2">${s.customer_name || '-'}</td>
              <td class="px-3 py-2 text-gray-500">${s.region_name || '-'}</td>
              <td class="px-3 py-2">${s.team_leader_name || '-'}</td>
              <td class="px-3 py-2 text-right">${formatAmount(s.base_amount)}</td>
              <td class="px-3 py-2 text-center text-red-600">${s.commission_mode === 'PERCENT' ? s.commission_rate + '%' : formatAmount(s.commission_rate)}<br><span class="text-xs">${formatAmount(s.commission_amount)}</span></td>
              <td class="px-3 py-2 text-right font-bold text-green-600">${formatAmount(s.payable_amount)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  showModal(`정산 상세 — Run #${runId} (${run.status})`, content, '', { large: true });
}

// ════════ 대사(정합성) ════════
async function renderReconciliation(el) {
  const [runsRes, issuesRes] = await Promise.all([
    api('GET', '/reconciliation/runs'),
    api('GET', '/reconciliation/issues?resolved=false&limit=50'),
  ]);
  const runs = runsRes?.runs || [];
  const issues = issuesRes?.issues || [];

  const severityColors = { CRITICAL: 'bg-red-100 text-red-700 border-red-300', HIGH: 'bg-orange-100 text-orange-700 border-orange-300', MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-300', LOW: 'bg-gray-100 text-gray-700' };

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-scale-balanced mr-2 text-indigo-600"></i>대사(정합성 검증)</h2>
        <button onclick="showReconcileModal()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"><i class="fas fa-play mr-1"></i>대사 실행</button>
      </div>

      <!-- 미해결 이슈 -->
      <div class="bg-white rounded-xl p-5 border border-gray-100 mb-6">
        <h3 class="font-semibold mb-4"><i class="fas fa-exclamation-triangle mr-2 text-amber-500"></i>미해결 이슈 (${issues.length}건)</h3>
        <div class="space-y-2 max-h-64 overflow-y-auto">
          ${issues.map(i => `
            <div class="flex items-center justify-between p-3 rounded-lg border ${severityColors[i.severity] || ''} text-sm">
              <div class="flex items-center gap-3">
                <span class="font-bold">${i.severity}</span>
                <span>${i.type}</span>
                <span class="text-gray-500">#${i.order_id} ${i.customer_name || ''}</span>
              </div>
              <button onclick="resolveIssue(${i.issue_id})" class="px-2 py-1 bg-white border rounded text-xs hover:bg-gray-50">해결</button>
            </div>
          `).join('')}
          ${issues.length === 0 ? '<p class="text-center text-gray-400 py-4">미해결 이슈 없음</p>' : ''}
        </div>
      </div>

      <!-- Run 이력 -->
      <div class="bg-white rounded-xl p-5 border border-gray-100">
        <h3 class="font-semibold mb-4"><i class="fas fa-history mr-2 text-indigo-500"></i>대사 실행 이력</h3>
        <table class="w-full text-sm">
          <thead class="bg-gray-50"><tr>
            <th class="px-4 py-2 text-left">ID</th><th class="px-4 py-2 text-left">기간</th>
            <th class="px-4 py-2 text-center">상태</th><th class="px-4 py-2 text-right">이슈 수</th>
            <th class="px-4 py-2 text-left">실행시간</th>
          </tr></thead>
          <tbody class="divide-y">${runs.map(r => `
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-2 font-mono text-gray-500">${r.run_id}</td>
              <td class="px-4 py-2 text-xs">${r.date_range_start} ~ ${r.date_range_end}</td>
              <td class="px-4 py-2 text-center"><span class="status-badge ${r.status === 'DONE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${r.status}</span></td>
              <td class="px-4 py-2 text-right font-bold ${(r.total_issues || 0) > 0 ? 'text-red-600' : 'text-green-600'}">${r.total_issues || 0}</td>
              <td class="px-4 py-2 text-xs text-gray-500">${formatDate(r.started_at)}</td>
            </tr>`).join('')}
            ${runs.length === 0 ? '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">대사 실행 기록 없음</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>`;
}

function showReconcileModal() {
  const today = new Date().toISOString().split('T')[0];
  const content = `
    <div class="space-y-4">
      <p class="text-sm text-gray-600">데이터 정합성을 검증합니다. (중복주문, 배분누락, 보고서누락, 금액불일치 등)</p>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-xs text-gray-500 mb-1">시작일</label>
          <input id="recon-start" type="date" class="w-full border rounded-lg px-3 py-2 text-sm" value="2026-01-01"></div>
        <div><label class="block text-xs text-gray-500 mb-1">종료일</label>
          <input id="recon-end" type="date" class="w-full border rounded-lg px-3 py-2 text-sm" value="${today}"></div>
      </div>
    </div>`;
  showModal('대사 실행', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="executeReconciliation()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">실행</button>`);
}

async function executeReconciliation() {
  const start = document.getElementById('recon-start').value;
  const end = document.getElementById('recon-end').value;
  closeModal();
  showToast('대사 실행 중...', 'info');
  const res = await api('POST', '/reconciliation/runs', { date_range_start: start, date_range_end: end });
  if (res?.run_id) {
    showToast(`대사 완료 — ${res.total_issues}건 이슈 발견`, res.total_issues > 0 ? 'warning' : 'success');
    renderContent();
  } else showToast(res?.error || '대사 실패', 'error');
}

async function resolveIssue(issueId) {
  const res = await api('PATCH', `/reconciliation/issues/${issueId}/resolve`);
  if (res?.ok) { showToast('해결 처리 완료', 'success'); renderContent(); }
  else showToast(res?.error || '처리 실패', 'error');
}
