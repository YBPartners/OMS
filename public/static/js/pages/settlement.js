// ============================================================
// 다하다 OMS - 정산관리 + 대사(정합성) 페이지 v7.0
// Interaction Design: 행 컨텍스트메뉴, 호버프리뷰, 확장가능행,
// 인라인 미리보기, 이슈 배치해결, 드릴다운
// ============================================================

// ════════ 정산관리 ════════
async function renderSettlement(el) {
  showSkeletonLoading(el, 'table');
  const res = await api('GET', '/settlements/runs');
  const runs = res?.runs || [];

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-coins mr-2 text-amber-500"></i>정산관리</h2>
        <div class="flex gap-2">
          <button onclick="navigateTo('reconciliation')" class="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm hover:bg-indigo-200 transition"><i class="fas fa-scale-balanced mr-1"></i>대사 이동</button>
          ${canEdit('policy') ? `<button onclick="showCreateRunModal()" class="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition"><i class="fas fa-plus mr-1"></i>정산 Run 생성</button>` : ''}
        </div>
      </div>

      <!-- 요약 카드 -->
      ${runs.length > 0 ? `
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="ix-card bg-white rounded-xl p-4 border border-gray-100 text-center" onclick="showSettlementSummary('all')" data-tooltip="전체 Run 목록">
          <div class="text-2xl font-bold text-gray-700">${runs.length}</div>
          <div class="text-xs text-gray-500">총 Run</div>
        </div>
        <div class="ix-card bg-white rounded-xl p-4 border border-gray-100 text-center" onclick="showSettlementSummary('confirmed')" data-tooltip="확정 완료 Run">
          <div class="text-2xl font-bold text-green-600">${runs.filter(r => r.status === 'CONFIRMED').length}</div>
          <div class="text-xs text-gray-500">확정 완료</div>
        </div>
        <div class="ix-card bg-white rounded-xl p-4 border border-gray-100 text-center" onclick="showSettlementSummary('amount')" data-tooltip="총 지급액 상세">
          <div class="text-xl font-bold text-blue-600">${formatAmount(runs.reduce((s, r) => s + (r.total_payable_amount || 0), 0))}</div>
          <div class="text-xs text-gray-500">총 지급액</div>
        </div>
      </div>` : ''}

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
              const rs = OMS.RUN_STATUS[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-700' };
              return `
              <tr class="ix-table-row" onclick="viewRunDetail(${r.run_id})"
                  oncontextmenu="showRunContextMenu(event, ${JSON.stringify(r).replace(/"/g, '&quot;')})">
                <td class="px-4 py-3 font-mono text-gray-500 link-item">${r.run_id}</td>
                <td class="px-4 py-3"><span class="text-xs px-2 py-0.5 rounded bg-gray-100">${r.period_type === 'WEEKLY' ? '주간' : '월간'}</span></td>
                <td class="px-4 py-3 text-xs">${r.period_start} ~ ${r.period_end}</td>
                <td class="px-4 py-3 text-center"><span class="status-badge ${rs.color}"><i class="fas ${rs.icon} mr-1"></i>${rs.label}</span></td>
                <td class="px-4 py-3 text-right link-item">${r.total_count || 0}건</td>
                <td class="px-4 py-3 text-right">${formatAmount(r.total_base_amount)}</td>
                <td class="px-4 py-3 text-right text-red-600">${formatAmount(r.total_commission_amount)}</td>
                <td class="px-4 py-3 text-right font-bold text-green-600">${formatAmount(r.total_payable_amount)}</td>
                <td class="px-4 py-3 text-center" onclick="event.stopPropagation()">
                  <div class="flex gap-1 justify-center">
                    <button onclick="viewRunDetail(${r.run_id})" class="px-2 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200" data-tooltip="상세"><i class="fas fa-eye"></i></button>
                    ${r.status === 'DRAFT' && canEdit('policy') ? `<button onclick="calculateRun(${r.run_id})" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200" data-tooltip="산출"><i class="fas fa-calculator mr-1"></i>산출</button>` : ''}
                    ${r.status === 'CALCULATED' && canEdit('policy') ? `<button onclick="confirmRun(${r.run_id})" class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200" data-tooltip="확정"><i class="fas fa-check mr-1"></i>확정</button>` : ''}
                  </div>
                </td>
              </tr>`;
            }).join('')}
            ${runs.length === 0 ? '<tr><td colspan="9" class="px-4 py-8 text-center text-gray-400">정산 Run이 없습니다. "정산 Run 생성" 버튼을 클릭하세요.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ─── 정산 Run 컨텍스트 메뉴 ───
function showRunContextMenu(event, run) {
  event.preventDefault();
  event.stopPropagation();
  const r = typeof run === 'string' ? JSON.parse(run) : run;

  const items = [
    { icon: 'fa-eye', label: '상세 보기', action: () => viewRunDetail(r.run_id) },
    { divider: true },
  ];

  if (r.status === 'DRAFT' && canEdit('policy')) {
    items.push({ icon: 'fa-calculator', label: '정산 산출', badge: 'DRAFT', badgeColor: 'bg-yellow-100 text-yellow-700', action: () => calculateRun(r.run_id) });
  }
  if (r.status === 'CALCULATED' && canEdit('policy')) {
    items.push({ icon: 'fa-check', label: '정산 확정', badge: 'CALCULATED', badgeColor: 'bg-blue-100 text-blue-700', action: () => confirmRun(r.run_id) });
  }

  items.push(
    { divider: true },
    { icon: 'fa-print', label: '보고서 인쇄', action: () => printSettlementReport(r.run_id) },
    { icon: 'fa-file-csv', label: 'CSV 내보내기', action: () => exportSettlementCSV(r.run_id) },
    { icon: 'fa-file-excel', label: '엑셀 내보내기', action: () => exportSettlementExcel(r.run_id) },
    { divider: true },
    { icon: 'fa-scale-balanced', label: '대사 페이지로 이동', action: () => navigateTo('reconciliation') },
    { icon: 'fa-chart-bar', label: '통계 확인', action: () => navigateTo('statistics') }
  );

  showContextMenu(event.clientX, event.clientY, items, { title: `Run #${r.run_id} (${r.period_type === 'WEEKLY' ? '주간' : '월간'})` });
}

// ─── 정산 요약 드릴다운 ───
function showSettlementSummary(type) {
  if (type === 'all') navigateTo('settlement');
  else if (type === 'confirmed') showToast('확정 완료 Run만 필터링합니다', 'info');
  else showToast('총 지급액 상세 분석 기능 준비 중', 'info');
}

function showCreateRunModal() {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const content = `
    <div class="space-y-4">
      <div class="bg-amber-50 rounded-lg p-4 border border-amber-200 text-sm text-amber-800">
        <i class="fas fa-info-circle mr-1"></i>HQ_APPROVED 상태인 주문을 대상으로 정산을 산출합니다.
      </div>
      <div><label class="block text-xs text-gray-500 mb-1">정산 유형</label>
        <select id="run-type" class="w-full border rounded-lg px-3 py-2 text-sm">
          <option value="WEEKLY">주간(WEEKLY)</option><option value="MONTHLY">월간(MONTHLY)</option>
        </select></div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-xs text-gray-500 mb-1">시작일</label>
          <input id="run-start" type="date" class="w-full border rounded-lg px-3 py-2 text-sm" value="${weekAgo}"></div>
        <div><label class="block text-xs text-gray-500 mb-1">종료일</label>
          <input id="run-end" type="date" class="w-full border rounded-lg px-3 py-2 text-sm" value="${today}"></div>
      </div>
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
  const rs = OMS.RUN_STATUS[run.status] || { label: run.status, color: 'bg-gray-100' };

  // 팀장별 그룹핑
  const grouped = {};
  settlements.forEach(s => {
    const key = s.team_leader_id;
    if (!grouped[key]) grouped[key] = { name: s.team_leader_name, region: s.region_name, items: [], totalBase: 0, totalComm: 0, totalPay: 0 };
    grouped[key].items.push(s);
    grouped[key].totalBase += s.base_amount;
    grouped[key].totalComm += s.commission_amount;
    grouped[key].totalPay += s.payable_amount;
  });

  const content = `
    <div class="space-y-5">
      <!-- Run 요약 -->
      <div class="grid grid-cols-5 gap-3">
        <div class="bg-gray-50 rounded-lg p-3 text-center">
          <div class="text-xs text-gray-500 mb-1">상태</div>
          <span class="status-badge ${rs.color}">${rs.label}</span>
        </div>
        <div class="bg-gray-50 rounded-lg p-3 text-center">
          <div class="text-xs text-gray-500 mb-1">건수</div>
          <div class="text-lg font-bold">${run.total_count || 0}</div>
        </div>
        <div class="bg-blue-50 rounded-lg p-3 text-center">
          <div class="text-xs text-gray-500 mb-1">기본금액</div>
          <div class="text-sm font-bold">${formatAmount(run.total_base_amount)}</div>
        </div>
        <div class="bg-red-50 rounded-lg p-3 text-center">
          <div class="text-xs text-gray-500 mb-1">수수료</div>
          <div class="text-sm font-bold text-red-600">${formatAmount(run.total_commission_amount)}</div>
        </div>
        <div class="bg-green-50 rounded-lg p-3 text-center">
          <div class="text-xs text-gray-500 mb-1">지급액</div>
          <div class="text-sm font-bold text-green-600">${formatAmount(run.total_payable_amount)}</div>
        </div>
      </div>

      <!-- 팀장별 그룹 (확장 가능) -->
      ${Object.keys(grouped).length > 0 ? `
      <div>
        <h4 class="font-semibold mb-3"><i class="fas fa-users mr-1 text-purple-500"></i>팀장별 정산 요약</h4>
        <div class="space-y-2">
          ${Object.entries(grouped).map(([id, g]) => `
            <div class="ix-clickable bg-gray-50 rounded-lg p-3" onclick="toggleSettlementExpand(this)">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <i class="fas fa-user text-purple-600 text-sm"></i>
                  </div>
                  <div>
                    <span class="font-medium">${g.name}</span>
                    <span class="text-xs text-gray-500 ml-2">${g.region}</span>
                  </div>
                </div>
                <div class="flex items-center gap-6 text-sm">
                  <span>${g.items.length}건</span>
                  <span class="text-red-600">수수료 ${formatAmount(g.totalComm)}</span>
                  <span class="font-bold text-green-600">${formatAmount(g.totalPay)}</span>
                  <i class="fas fa-chevron-down text-gray-400 text-xs ix-expand-icon transition-transform"></i>
                </div>
              </div>
              <div class="ix-expand-content hidden mt-3 border-t pt-3">
                <table class="w-full text-xs">
                  <thead class="text-gray-400"><tr>
                    <th class="py-1 text-left">주문</th><th class="py-1 text-left">고객</th>
                    <th class="py-1 text-right">금액</th><th class="py-1 text-right">수수료</th>
                    <th class="py-1 text-right">지급액</th>
                  </tr></thead>
                  <tbody class="divide-y divide-gray-100">${g.items.map(s => `
                    <tr class="hover:bg-white cursor-pointer" onclick="event.stopPropagation();closeModal();showOrderDetailDrawer(${s.order_id})">
                      <td class="py-1.5 text-blue-600">#${s.order_id}</td>
                      <td class="py-1.5">${s.customer_name || '-'}</td>
                      <td class="py-1.5 text-right">${formatAmount(s.base_amount)}</td>
                      <td class="py-1.5 text-right text-red-500">${formatAmount(s.commission_amount)}</td>
                      <td class="py-1.5 text-right font-bold text-green-600">${formatAmount(s.payable_amount)}</td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <!-- 상세 테이블 -->
      <div>
        <h4 class="font-semibold mb-3"><i class="fas fa-list mr-1 text-gray-500"></i>개별 정산 내역</h4>
        <div class="max-h-60 overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 sticky top-0"><tr>
              <th class="px-3 py-2 text-left">주문</th><th class="px-3 py-2 text-left">고객</th><th class="px-3 py-2 text-left">법인</th>
              <th class="px-3 py-2 text-left">팀장</th><th class="px-3 py-2 text-right">금액</th>
              <th class="px-3 py-2 text-center">수수료</th><th class="px-3 py-2 text-right">지급액</th>
            </tr></thead>
            <tbody class="divide-y">${settlements.map(s => `
              <tr class="ix-table-row" onclick="closeModal();showOrderDetailDrawer(${s.order_id})"
                  data-preview="order" data-preview-id="${s.order_id}" data-preview-title="주문 #${s.order_id}">
                <td class="px-3 py-2 font-mono text-xs link-item">#${s.order_id}</td>
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
      </div>
    </div>`;
  showModal(`정산 상세 — Run #${runId}`, content, '', { xlarge: true });
}

// ─── 확장 토글 ───
function toggleSettlementExpand(el) {
  const content = el.querySelector('.ix-expand-content');
  const icon = el.querySelector('.ix-expand-icon');
  if (content) {
    content.classList.toggle('hidden');
    icon?.classList.toggle('rotate-180');
  }
}

// ════════ 대사(정합성) ════════

// ─── 대사 이슈 선택 상태 ───
const reconcileState = {
  selectedIssues: new Set(),
};

async function renderReconciliation(el) {
  showSkeletonLoading(el, 'cards');
  const [runsRes, issuesRes] = await Promise.all([
    api('GET', '/reconciliation/runs'),
    api('GET', '/reconciliation/issues?resolved=false&limit=50'),
  ]);
  const runs = runsRes?.runs || [];
  const issues = issuesRes?.issues || [];

  // 선택 상태 정리
  const currentIds = new Set(issues.map(i => i.issue_id));
  for (const id of reconcileState.selectedIssues) {
    if (!currentIds.has(id)) reconcileState.selectedIssues.delete(id);
  }

  // 이슈 유형별 집계
  const issuesByType = {};
  issues.forEach(i => {
    if (!issuesByType[i.type]) issuesByType[i.type] = 0;
    issuesByType[i.type]++;
  });

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-scale-balanced mr-2 text-indigo-600"></i>대사(정합성 검증)</h2>
        <div class="flex gap-2">
          ${reconcileState.selectedIssues.size > 0 ? `
            <span class="text-sm text-purple-600 font-medium"><i class="fas fa-check-square mr-1"></i>${reconcileState.selectedIssues.size}건 선택</span>
            <button onclick="batchResolveIssues()" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"><i class="fas fa-check-double mr-1"></i>일괄 해결</button>
            <button onclick="reconcileState.selectedIssues.clear();renderContent()" class="px-3 py-2 bg-gray-100 text-gray-500 rounded-lg text-xs hover:bg-gray-200">해제</button>
          ` : ''}
          ${canEdit('policy') ? `<button onclick="showReconcileModal()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition"><i class="fas fa-play mr-1"></i>대사 실행</button>` : ''}
        </div>
      </div>

      <!-- 이슈 유형별 요약 — 클릭으로 필터링 -->
      ${Object.keys(issuesByType).length > 0 ? `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        ${Object.entries(issuesByType).map(([type, cnt]) => {
          const it = OMS.ISSUE_TYPES[type] || { label: type, icon: 'fa-question', color: 'text-gray-600' };
          return `
          <div class="ix-card bg-white rounded-xl p-4 border border-gray-100 text-center" 
               onclick="filterIssuesByType('${type}')" data-tooltip="${it.label} 이슈만 보기">
            <i class="fas ${it.icon} ${it.color} text-xl mb-2"></i>
            <div class="text-2xl font-bold">${cnt}</div>
            <div class="text-xs text-gray-500">${it.label}</div>
          </div>`;
        }).join('')}
      </div>` : ''}

      <!-- 미해결 이슈 -->
      <div class="bg-white rounded-xl p-5 border border-gray-100 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold"><i class="fas fa-exclamation-triangle mr-2 text-amber-500"></i>미해결 이슈 (${issues.length}건)</h3>
          <div class="flex gap-2 text-xs text-gray-400">
            <span><i class="fas fa-hand-pointer mr-1"></i>행 클릭: 선택</span>
            <span><i class="fas fa-mouse mr-1"></i>우클릭: 액션</span>
          </div>
        </div>
        <div class="space-y-2 max-h-80 overflow-y-auto">
          ${issues.map(i => {
            const it = OMS.ISSUE_TYPES[i.type] || { label: i.type, icon: 'fa-question' };
            const sv = OMS.SEVERITY[i.severity] || { color: 'bg-gray-100', label: i.severity };
            const sel = reconcileState.selectedIssues.has(i.issue_id);
            return `
            <div class="flex items-center justify-between p-3 rounded-lg border ${sel ? 'border-purple-300 bg-purple-50' : sv.color} text-sm ix-clickable"
                 onclick="toggleIssueSelect(${i.issue_id})"
                 oncontextmenu="showIssueContextMenu(event, ${JSON.stringify(i).replace(/"/g, '&quot;')})">
              <div class="flex items-center gap-3 flex-1">
                ${sel ? '<div class="w-5 h-5 bg-purple-600 rounded flex items-center justify-center"><i class="fas fa-check text-white text-[10px]"></i></div>' : `<i class="fas ${it.icon} w-5 text-center"></i>`}
                <span class="font-bold">${sv.label}</span>
                <span class="font-medium">${it.label}</span>
                <span class="text-gray-500 link-item" onclick="event.stopPropagation();showOrderDetailDrawer(${i.order_id})"
                      data-preview="order" data-preview-id="${i.order_id}" data-preview-title="주문 #${i.order_id}">#${i.order_id} ${i.customer_name || ''}</span>
              </div>
              <div class="flex gap-2" onclick="event.stopPropagation()">
                <button onclick="showIssueDetailModal(${JSON.stringify(i).replace(/"/g, '&quot;')})" class="px-2 py-1 bg-white border rounded text-xs hover:bg-gray-50" data-tooltip="상세"><i class="fas fa-eye"></i></button>
                ${canEdit('policy') ? `<button onclick="resolveIssue(${i.issue_id})" class="px-2 py-1 bg-white border rounded text-xs hover:bg-gray-50 text-green-600" data-tooltip="해결 처리"><i class="fas fa-check"></i></button>` : ''}
              </div>
            </div>`;
          }).join('')}
          ${issues.length === 0 ? '<p class="text-center text-gray-400 py-4"><i class="fas fa-check-circle text-green-400 text-2xl mb-2"></i><br>미해결 이슈 없음</p>' : ''}
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

// ─── 이슈 선택 ───
function toggleIssueSelect(issueId) {
  if (reconcileState.selectedIssues.has(issueId)) {
    reconcileState.selectedIssues.delete(issueId);
  } else {
    reconcileState.selectedIssues.add(issueId);
  }
  renderContent();
}

// ─── 이슈 컨텍스트 메뉴 ───
function showIssueContextMenu(event, issue) {
  event.preventDefault();
  event.stopPropagation();
  const i = typeof issue === 'string' ? JSON.parse(issue) : issue;
  const it = OMS.ISSUE_TYPES[i.type] || { label: i.type };

  showContextMenu(event.clientX, event.clientY, [
    { icon: 'fa-eye', label: '이슈 상세 보기', action: () => showIssueDetailModal(i) },
    { icon: 'fa-expand', label: '관련 주문 상세', action: () => showOrderDetailDrawer(i.order_id) },
    { divider: true },
    ...(canEdit('policy') ? [
      { icon: 'fa-check', label: '해결 처리', action: () => resolveIssue(i.issue_id) },
    ] : []),
    { divider: true },
    { icon: 'fa-scroll', label: '감사 로그 보기', action: () => showOrderAuditDrawer(i.order_id) },
  ], { title: `이슈 #${i.issue_id} — ${it.label}` });
}

// ─── 이슈 유형별 필터링 ───
function filterIssuesByType(type) {
  showToast(`${OMS.ISSUE_TYPES[type]?.label || type} 유형 이슈 필터링`, 'info');
}

// ─── 배치 이슈 해결 ───
async function batchResolveIssues() {
  const ids = [...reconcileState.selectedIssues];
  if (ids.length === 0) return;

  showConfirmModal(
    '일괄 이슈 해결',
    `선택된 <strong>${ids.length}</strong>건의 이슈를 모두 해결 처리하시겠습니까?`,
    async () => {
      showToast(`${ids.length}건 해결 처리 중...`, 'info');
      let success = 0, fail = 0;
      for (const id of ids) {
        const res = await api('PATCH', `/reconciliation/issues/${id}/resolve`);
        if (res?.ok) success++;
        else fail++;
      }
      reconcileState.selectedIssues.clear();
      showToast(`해결 처리 완료: 성공 ${success}건${fail > 0 ? `, 실패 ${fail}건` : ''}`, fail > 0 ? 'warning' : 'success');
      renderContent();
    },
    '일괄 해결', 'bg-green-600'
  );
}

// 이슈 상세 모달 (detail_json 파싱)
function showIssueDetailModal(issue) {
  const i = typeof issue === 'string' ? JSON.parse(issue) : issue;
  const it = OMS.ISSUE_TYPES[i.type] || { label: i.type, icon: 'fa-question' };
  const sv = OMS.SEVERITY[i.severity] || { label: i.severity, color: 'bg-gray-100' };

  let detail = {};
  try { detail = JSON.parse(i.detail_json || '{}'); } catch {}

  const detailRows = Object.entries(detail).map(([k, v]) => {
    const labels = {
      fingerprint: '핑거프린트', duplicate_count: '중복 수', related_orders: '관련 주문',
      current_status: '현재 상태', report_id: '보고서 ID', category: '카테고리',
      required: '필요 수', actual: '실제 수', issue: '이슈 설명',
      settlement_base: '정산 기본금액', order_base: '주문 기본금액',
      base: '기본금액', commission: '수수료', payable: '지급액', diff: '차이',
    };
    const label = labels[k] || k;
    const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return `<tr><td class="px-3 py-2 text-gray-500 text-xs">${label}</td><td class="px-3 py-2 font-mono text-xs">${val}</td></tr>`;
  }).join('');

  const content = `
    <div class="space-y-4">
      <div class="flex items-center gap-4 p-4 rounded-xl border ${sv.color}">
        <i class="fas ${it.icon} text-2xl"></i>
        <div>
          <div class="font-bold">${it.label}</div>
          <div class="text-sm">심각도: <strong>${sv.label}</strong> · 주문 #${i.order_id}</div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div><span class="text-xs text-gray-500">주문번호</span><div class="link-item" onclick="closeModal();showOrderDetailDrawer(${i.order_id})">#${i.order_id}</div></div>
        <div><span class="text-xs text-gray-500">고객명</span><div>${i.customer_name || '-'}</div></div>
        <div><span class="text-xs text-gray-500">주문상태</span><div>${statusBadge(i.order_status)}</div></div>
        <div><span class="text-xs text-gray-500">발견일시</span><div class="text-xs">${formatDate(i.created_at)}</div></div>
      </div>
      ${detailRows ? `
      <div>
        <h4 class="font-semibold text-sm mb-2"><i class="fas fa-code mr-1"></i>상세 데이터</h4>
        <table class="w-full text-sm bg-gray-50 rounded-lg overflow-hidden">
          <tbody class="divide-y">${detailRows}</tbody>
        </table>
      </div>` : ''}
    </div>`;

  const actions = `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>
    ${canEdit('policy') ? `<button onclick="closeModal();resolveIssue(${i.issue_id})" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm"><i class="fas fa-check mr-1"></i>해결 처리</button>` : ''}`;
  showModal(`이슈 상세 — #${i.issue_id}`, content, actions, { large: true });
}

function showReconcileModal() {
  const today = new Date().toISOString().split('T')[0];
  const content = `
    <div class="space-y-4">
      <div class="bg-indigo-50 rounded-lg p-4 border border-indigo-200 text-sm">
        <p class="font-medium text-indigo-800 mb-2"><i class="fas fa-info-circle mr-1"></i>7가지 정합성 규칙 검증</p>
        <div class="grid grid-cols-2 gap-1 text-xs text-indigo-700">
          ${Object.entries(OMS.ISSUE_TYPES).map(([k, v]) => `<div><i class="fas ${v.icon} mr-1"></i>${v.label}</div>`).join('')}
        </div>
      </div>
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
  showConfirmModal('이슈 해결 처리', `이슈 #${issueId}를 해결 처리하시겠습니까?`,
    async () => {
      const res = await api('PATCH', `/reconciliation/issues/${issueId}/resolve`);
      if (res?.ok) { showToast('해결 처리 완료', 'success'); renderContent(); }
      else showToast(res?.error || '처리 실패', 'error');
    }, '해결 처리', 'bg-green-600');
}

// ════════ 정산 보고서 인쇄 ════════
async function printSettlementReport(runId) {
  showToast('보고서 생성 중...', 'info');
  const res = await api('GET', `/settlements/runs/${runId}/report`);
  if (!res?.report) return showToast('보고서 생성 실패', 'error');

  const { run, summary, grouped, generated_at } = res.report;
  const fmt = n => Number(n).toLocaleString('ko-KR') + '원';
  const periodLabel = run.period_type === 'WEEKLY' ? '주간' : '월간';

  const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>정산 보고서 — Run #${run.run_id}</title>
<style>
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body { font-family: 'Pretendard', -apple-system, sans-serif; font-size: 12px; color: #333; padding: 20px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 20px; text-align: center; margin-bottom: 4px; }
  .subtitle { text-align: center; color: #666; margin-bottom: 24px; font-size: 13px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .summary-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
  .summary-box .label { font-size: 11px; color: #888; margin-bottom: 4px; }
  .summary-box .value { font-size: 16px; font-weight: 700; }
  .green { color: #16a34a; } .red { color: #dc2626; } .blue { color: #2563eb; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
  th { background: #f3f4f6; padding: 6px 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #d1d5db; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
  .text-right { text-align: right; }
  .section-title { font-size: 14px; font-weight: 700; margin: 20px 0 10px; padding-bottom: 4px; border-bottom: 2px solid #333; }
  .subtotal { background: #f9fafb; font-weight: 600; }
  .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #ccc; text-align: center; color: #999; font-size: 10px; }
  .no-print { margin-bottom: 16px; text-align: center; }
  @media print { .no-print { display: none; } }
</style></head><body>
<div class="no-print"><button onclick="window.print()" style="padding:8px 24px;background:#2563eb;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">🖨️ 인쇄하기</button>
<button onclick="window.close()" style="padding:8px 24px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;margin-left:8px">닫기</button></div>
<h1>다하다 OMS — 정산 보고서</h1>
<div class="subtitle">Run #${run.run_id} | ${periodLabel} | ${run.period_start} ~ ${run.period_end}</div>
<div class="summary-grid">
  <div class="summary-box"><div class="label">총 건수</div><div class="value">${summary.total_count}건</div></div>
  <div class="summary-box"><div class="label">기본금액</div><div class="value blue">${fmt(summary.total_base)}</div></div>
  <div class="summary-box"><div class="label">수수료 합계</div><div class="value red">${fmt(summary.total_commission)}</div></div>
  <div class="summary-box"><div class="label">지급액 합계</div><div class="value green">${fmt(summary.total_payable)}</div></div>
</div>
${grouped.map(g => `
<div class="section-title">${g.name} (${g.region}) — ${g.count}건</div>
<table>
  <thead><tr><th>주문번호</th><th>고객명</th><th>주소</th><th class="text-right">금액</th><th class="text-right">수수료</th><th class="text-right">지급액</th></tr></thead>
  <tbody>
    ${g.items.map(i => `<tr>
      <td>${i.external_order_no || '#' + i.order_id}</td><td>${i.customer_name || '-'}</td>
      <td>${(i.address_text || '').substring(0, 30)}</td>
      <td class="text-right">${fmt(i.base_amount)}</td><td class="text-right red">${fmt(i.commission_amount)}</td>
      <td class="text-right green">${fmt(i.payable_amount)}</td>
    </tr>`).join('')}
    <tr class="subtotal"><td colspan="3">소계 (${g.count}건)</td>
      <td class="text-right">${fmt(g.total_base)}</td><td class="text-right red">${fmt(g.total_commission)}</td>
      <td class="text-right green">${fmt(g.total_payable)}</td></tr>
  </tbody>
</table>`).join('')}
<div class="footer">다하다 OMS | 생성일: ${generated_at} | 이 문서는 자동 생성되었습니다.</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (w) { w.document.write(html); w.document.close(); }
  else showToast('팝업이 차단되었습니다. 팝업을 허용해주세요.', 'warning');
}

// ════════ 정산 CSV 내보내기 ════════
async function exportSettlementCSV(runId) {
  showToast('CSV 생성 중...', 'info');
  const res = await api('GET', `/settlements/runs/${runId}/export`);
  if (!res?.rows) return showToast('내보내기 실패', 'error');

  const headers = ['정산ID', '주문ID', '외부주문번호', '고객명', '주소', '서비스', '기본금액', '수수료방식', '수수료율', '수수료', '지급액', '상태', '팀장', '지역법인'];
  const rows = res.rows.map(r => [
    r.settlement_id, r.order_id, r.external_order_no || '', r.customer_name || '', r.address_text || '',
    r.service_type || '', r.base_amount, r.commission_mode, r.commission_rate,
    r.commission_amount, r.payable_amount, r.status, r.team_leader_name, r.region_name
  ]);

  exportToCSV(`settlement_run_${runId}.csv`, headers, rows);
  showToast('CSV 다운로드 완료', 'success');
}

// ════════ 대리점 정산 내역서 ════════
async function renderAgencyStatement() {
  const el = document.getElementById('content');
  if (!el) return;
  showSkeletonLoading(el, 'table');

  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const res = await api('GET', `/settlements/agency-statement?from=${monthAgo}&to=${today}`);
  const st = res?.statement;
  if (!st) { el.innerHTML = '<div class="text-center py-16 text-gray-400">정산 내역이 없습니다.</div>'; return; }

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-file-invoice-dollar mr-2 text-emerald-500"></i>대리점 정산 내역서</h2>
        <button onclick="printAgencyStatement()" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"><i class="fas fa-print mr-1"></i>인쇄</button>
      </div>

      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl p-4 border text-center"><div class="text-2xl font-bold">${st.totals.count}</div><div class="text-xs text-gray-500">총 건수</div></div>
        <div class="bg-white rounded-xl p-4 border text-center"><div class="text-xl font-bold text-blue-600">${formatAmount(st.totals.base)}</div><div class="text-xs text-gray-500">기본금액</div></div>
        <div class="bg-white rounded-xl p-4 border text-center"><div class="text-xl font-bold text-red-600">${formatAmount(st.totals.commission)}</div><div class="text-xs text-gray-500">수수료</div></div>
        <div class="bg-white rounded-xl p-4 border text-center"><div class="text-xl font-bold text-green-600">${formatAmount(st.totals.payable)}</div><div class="text-xs text-gray-500">지급액</div></div>
      </div>

      ${st.leaders.map(l => `
      <div class="bg-white rounded-xl border mb-4 overflow-hidden">
        <div class="px-5 py-3 bg-gray-50 flex items-center justify-between cursor-pointer" onclick="this.nextElementSibling.classList.toggle('hidden')">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center"><i class="fas fa-user text-purple-600 text-sm"></i></div>
            <span class="font-medium">${l.name}</span>
            <span class="text-xs text-gray-400">${l.count}건</span>
          </div>
          <div class="flex items-center gap-4 text-sm">
            <span class="text-red-600">${formatAmount(l.total_commission)}</span>
            <span class="font-bold text-green-600">${formatAmount(l.total_payable)}</span>
            <i class="fas fa-chevron-down text-gray-400 text-xs"></i>
          </div>
        </div>
        <div class="hidden">
          <table class="w-full text-sm">
            <thead class="bg-gray-50"><tr><th class="px-4 py-2 text-left">주문</th><th class="px-4 py-2 text-left">고객</th><th class="px-4 py-2 text-right">금액</th><th class="px-4 py-2 text-right">수수료</th><th class="px-4 py-2 text-right">지급액</th><th class="px-4 py-2 text-center">상태</th></tr></thead>
            <tbody class="divide-y">${l.items.map(i => `
              <tr class="hover:bg-gray-50"><td class="px-4 py-2 text-xs text-blue-600">#${i.order_id}</td><td class="px-4 py-2">${i.customer_name || '-'}</td>
              <td class="px-4 py-2 text-right">${formatAmount(i.base_amount)}</td><td class="px-4 py-2 text-right text-red-600">${formatAmount(i.commission_amount)}</td>
              <td class="px-4 py-2 text-right font-bold text-green-600">${formatAmount(i.payable_amount)}</td>
              <td class="px-4 py-2 text-center"><span class="status-badge ${i.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}">${i.status === 'PAID' ? '지급완료' : '확정'}</span></td></tr>
            `).join('')}</tbody>
          </table>
        </div>
      </div>`).join('')}
    </div>`;
}

// ─── 대리점 내역서 인쇄 ───
async function printAgencyStatement() {
  showToast('내역서 생성 중...', 'info');
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const res = await api('GET', `/settlements/agency-statement?from=${monthAgo}&to=${today}`);
  if (!res?.statement) return showToast('생성 실패', 'error');

  const st = res.statement;
  const fmt = n => Number(n).toLocaleString('ko-KR') + '원';

  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>대리점 정산 내역서</title>
<style>
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none; } }
  body { font-family: 'Pretendard', sans-serif; font-size: 12px; color: #333; padding: 20px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 18px; text-align: center; } .subtitle { text-align: center; color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
  th { background: #f3f4f6; padding: 6px 8px; text-align: left; border-bottom: 2px solid #d1d5db; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; } .text-right { text-align: right; }
  .green { color: #16a34a; } .red { color: #dc2626; }
  .summary { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 20px; }
  .summary-box { border: 1px solid #ddd; border-radius: 6px; padding: 10px; text-align: center; }
  .summary-box .val { font-size: 15px; font-weight: 700; }
  .section { font-size: 13px; font-weight: 700; margin: 16px 0 8px; border-bottom: 1px solid #333; padding-bottom: 4px; }
  .subtotal { background: #f9fafb; font-weight: 600; }
  .footer { margin-top: 24px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #ccc; padding-top: 10px; }
</style></head><body>
<div class="no-print" style="text-align:center;margin-bottom:16px">
  <button onclick="window.print()" style="padding:8px 24px;background:#059669;color:white;border:none;border-radius:8px;cursor:pointer">🖨️ 인쇄</button>
  <button onclick="window.close()" style="padding:8px 24px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;margin-left:8px">닫기</button>
</div>
<h1>대리점 정산 내역서</h1>
<div class="subtitle">${monthAgo} ~ ${today} | ${currentUser.name}</div>
<div class="summary">
  <div class="summary-box"><div style="font-size:10px;color:#888">총 건수</div><div class="val">${st.totals.count}건</div></div>
  <div class="summary-box"><div style="font-size:10px;color:#888">기본금액</div><div class="val">${fmt(st.totals.base)}</div></div>
  <div class="summary-box"><div style="font-size:10px;color:#888">수수료</div><div class="val red">${fmt(st.totals.commission)}</div></div>
  <div class="summary-box"><div style="font-size:10px;color:#888">지급액</div><div class="val green">${fmt(st.totals.payable)}</div></div>
</div>
${st.leaders.map(l => `<div class="section">${l.name} — ${l.count}건</div>
<table><thead><tr><th>주문</th><th>고객</th><th class="text-right">금액</th><th class="text-right">수수료</th><th class="text-right">지급액</th></tr></thead>
<tbody>${l.items.map(i => `<tr><td>#${i.order_id}</td><td>${i.customer_name||'-'}</td><td class="text-right">${fmt(i.base_amount)}</td><td class="text-right red">${fmt(i.commission_amount)}</td><td class="text-right green">${fmt(i.payable_amount)}</td></tr>`).join('')}
<tr class="subtotal"><td colspan="2">소계</td><td class="text-right">${fmt(l.total_base)}</td><td class="text-right red">${fmt(l.total_commission)}</td><td class="text-right green">${fmt(l.total_payable)}</td></tr></tbody></table>`).join('')}
<div class="footer">다하다 OMS | 생성일: ${today}</div></body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (w) { w.document.write(html); w.document.close(); }
}

// ════════ 정산 엑셀 내보내기 ════════
async function exportSettlementExcel(runId) {
  showToast('엑셀 생성 중...', 'info');
  const res = await api('GET', `/settlements/runs/${runId}/export`);
  if (!res?.rows) return showToast('내보내기 실패', 'error');

  const columns = [
    { label: '정산ID', key: 'settlement_id' },
    { label: '주문ID', key: 'order_id' },
    { label: '외부주문번호', key: 'external_order_no' },
    { label: '고객명', key: 'customer_name' },
    { label: '주소', key: 'address_text' },
    { label: '기본금액', key: 'base_amount' },
    { label: '수수료방식', key: 'commission_mode' },
    { label: '수수료율', key: 'commission_rate' },
    { label: '수수료', key: 'commission_amount' },
    { label: '지급액', key: 'payable_amount' },
    { label: '상태', key: 'status' },
    { label: '팀장', key: 'team_leader_name' },
    { label: '지역법인', key: 'region_name' },
  ];

  exportToExcel(res.rows, columns, `settlement_run_${runId}`, '정산내역');
}
