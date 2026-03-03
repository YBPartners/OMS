// ============================================================
// 다하다 OMS - 정산관리 + 대사(정합성) 페이지 v3.1
// 모달 강화, 팀장별 그룹핑, 이슈 상세
// ============================================================

// ════════ 정산관리 ════════
async function renderSettlement(el) {
  const res = await api('GET', '/settlements/runs');
  const runs = res?.runs || [];

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-coins mr-2 text-amber-500"></i>정산관리</h2>
        <div class="flex gap-2">
          <button onclick="navigateTo('reconciliation')" class="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm hover:bg-indigo-200"><i class="fas fa-scale-balanced mr-1"></i>대사 이동</button>
          ${canEdit('policy') ? `<button onclick="showCreateRunModal()" class="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700"><i class="fas fa-plus mr-1"></i>정산 Run 생성</button>` : ''}
        </div>
      </div>

      <!-- 요약 카드 -->
      ${runs.length > 0 ? `
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-2xl font-bold text-gray-700">${runs.length}</div>
          <div class="text-xs text-gray-500">총 Run</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-2xl font-bold text-green-600">${runs.filter(r => r.status === 'CONFIRMED').length}</div>
          <div class="text-xs text-gray-500">확정 완료</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
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
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 font-mono text-gray-500 link-item" onclick="viewRunDetail(${r.run_id})">${r.run_id}</td>
                <td class="px-4 py-3"><span class="text-xs px-2 py-0.5 rounded bg-gray-100">${r.period_type === 'WEEKLY' ? '주간' : '월간'}</span></td>
                <td class="px-4 py-3 text-xs">${r.period_start} ~ ${r.period_end}</td>
                <td class="px-4 py-3 text-center"><span class="status-badge ${rs.color}"><i class="fas ${rs.icon} mr-1"></i>${rs.label}</span></td>
                <td class="px-4 py-3 text-right link-item" onclick="viewRunDetail(${r.run_id})">${r.total_count || 0}건</td>
                <td class="px-4 py-3 text-right">${formatAmount(r.total_base_amount)}</td>
                <td class="px-4 py-3 text-right text-red-600">${formatAmount(r.total_commission_amount)}</td>
                <td class="px-4 py-3 text-right font-bold text-green-600">${formatAmount(r.total_payable_amount)}</td>
                <td class="px-4 py-3 text-center">
                  <div class="flex gap-1 justify-center">
                    <button onclick="viewRunDetail(${r.run_id})" class="px-2 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200" title="상세"><i class="fas fa-eye"></i></button>
                    ${r.status === 'DRAFT' && canEdit('policy') ? `<button onclick="calculateRun(${r.run_id})" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200" title="산출"><i class="fas fa-calculator mr-1"></i>산출</button>` : ''}
                    ${r.status === 'CALCULATED' && canEdit('policy') ? `<button onclick="confirmRun(${r.run_id})" class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200" title="확정"><i class="fas fa-check mr-1"></i>확정</button>` : ''}
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

      <!-- 팀장별 그룹 -->
      ${Object.keys(grouped).length > 0 ? `
      <div>
        <h4 class="font-semibold mb-3"><i class="fas fa-users mr-1 text-purple-500"></i>팀장별 정산 요약</h4>
        <div class="space-y-2">
          ${Object.entries(grouped).map(([id, g]) => `
            <div class="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
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
              <tr class="hover:bg-gray-50">
                <td class="px-3 py-2 font-mono text-xs link-item" onclick="showOrderDetail(${s.order_id})">#${s.order_id}</td>
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

// ════════ 대사(정합성) ════════
async function renderReconciliation(el) {
  const [runsRes, issuesRes] = await Promise.all([
    api('GET', '/reconciliation/runs'),
    api('GET', '/reconciliation/issues?resolved=false&limit=50'),
  ]);
  const runs = runsRes?.runs || [];
  const issues = issuesRes?.issues || [];

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
        ${canEdit('policy') ? `<button onclick="showReconcileModal()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"><i class="fas fa-play mr-1"></i>대사 실행</button>` : ''}
      </div>

      <!-- 이슈 유형별 요약 -->
      ${Object.keys(issuesByType).length > 0 ? `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        ${Object.entries(issuesByType).map(([type, cnt]) => {
          const it = OMS.ISSUE_TYPES[type] || { label: type, icon: 'fa-question', color: 'text-gray-600' };
          return `
          <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
            <i class="fas ${it.icon} ${it.color} text-xl mb-2"></i>
            <div class="text-2xl font-bold">${cnt}</div>
            <div class="text-xs text-gray-500">${it.label}</div>
          </div>`;
        }).join('')}
      </div>` : ''}

      <!-- 미해결 이슈 -->
      <div class="bg-white rounded-xl p-5 border border-gray-100 mb-6">
        <h3 class="font-semibold mb-4"><i class="fas fa-exclamation-triangle mr-2 text-amber-500"></i>미해결 이슈 (${issues.length}건)</h3>
        <div class="space-y-2 max-h-80 overflow-y-auto">
          ${issues.map(i => {
            const it = OMS.ISSUE_TYPES[i.type] || { label: i.type, icon: 'fa-question' };
            const sv = OMS.SEVERITY[i.severity] || { color: 'bg-gray-100', label: i.severity };
            return `
            <div class="flex items-center justify-between p-3 rounded-lg border ${sv.color} text-sm">
              <div class="flex items-center gap-3 flex-1">
                <i class="fas ${it.icon} w-5 text-center"></i>
                <span class="font-bold">${sv.label}</span>
                <span class="font-medium">${it.label}</span>
                <span class="text-gray-500 link-item" onclick="showOrderDetail(${i.order_id})">#${i.order_id} ${i.customer_name || ''}</span>
              </div>
              <div class="flex gap-2">
                <button onclick="showIssueDetailModal(${JSON.stringify(i).replace(/"/g, '&quot;')})" class="px-2 py-1 bg-white border rounded text-xs hover:bg-gray-50" title="상세"><i class="fas fa-eye"></i></button>
                ${canEdit('policy') ? `<button onclick="resolveIssue(${i.issue_id})" class="px-2 py-1 bg-white border rounded text-xs hover:bg-gray-50 text-green-600" title="해결 처리"><i class="fas fa-check"></i></button>` : ''}
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
        <div><span class="text-xs text-gray-500">주문번호</span><div class="link-item" onclick="closeModal();showOrderDetail(${i.order_id})">#${i.order_id}</div></div>
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
