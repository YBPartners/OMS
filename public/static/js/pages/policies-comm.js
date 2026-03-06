// ============================================================
// Airflow OMS — 수수료 정책 탭 v10.0 (R13 고도화)
// 시뮬레이션 강화, 영향도 분석, 복제, 총판별 그룹뷰
// ============================================================

function renderCommPolicyTab(policies) {
  const canEditPolicy = canEdit('policy');
  // 총판별 그룹 요약
  const orgGroups = {};
  policies.forEach(p => { const k = p.org_name||'미지정'; orgGroups[k] = (orgGroups[k]||0)+1; });
  const orgSummary = Object.entries(orgGroups).map(([k,v]) => `<span class="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] mr-1 mb-1">${k}(${v})</span>`).join('');

  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h3 class="font-semibold text-lg">수수료(정률/정액) 정책</h3>
          <p class="text-xs text-gray-500 mt-1">정률(PERCENT): 주문금액의 %를 수수료로 차감 · 정액(FIXED): 건당 고정금액 차감</p>
          ${orgSummary ? `<div class="mt-2">${orgSummary}</div>` : ''}
        </div>
        <div class="flex gap-2">
          ${canEditPolicy ? `<button onclick="showCommSimulatorModal()" class="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs hover:bg-amber-200"><i class="fas fa-calculator mr-1"></i>시뮬레이션</button>` : ''}
          ${canEditPolicy ? `<button onclick="showNewCommissionModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>추가</button>` : ''}
        </div>
      </div>
      ${renderDataTable({ columns: [
        { key: 'commission_policy_id', label: 'ID', render: p => `<span class="font-mono text-xs text-gray-500">#${p.commission_policy_id}</span>` },
        { key: 'org_name', label: '지역총판', render: p => `<button onclick="showCommDetailModal(${p.commission_policy_id})" class="text-left text-blue-700 hover:underline font-medium">${escapeHtml(p.org_name||'-')}</button>` },
        { key: 'team_leader_name', label: '대상 팀장', render: p => escapeHtml(p.team_leader_name || '') || '<span class="text-gray-400 text-xs">총판 기본</span>' },
        { key: 'mode', label: '유형', align: 'center', render: p => `<span class="status-badge ${p.mode === 'PERCENT' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}">${p.mode === 'PERCENT' ? '정률%' : '정액원'}</span>` },
        { key: 'value', label: '값', align: 'right', render: p => `<span class="font-bold text-lg">${p.mode === 'PERCENT' ? p.value + '%' : formatAmount(p.value)}</span>` },
        { key: '_sim', label: '10만원 기준', align: 'right', render: p => {
          const fee = p.mode==='PERCENT' ? Math.round(100000*p.value/100) : Number(p.value);
          return `<span class="text-xs text-gray-500">수수료 ${fee.toLocaleString()}원</span>`;
        }},
        { key: 'effective_from', label: '적용일', render: p => `<span class="text-xs">${p.effective_from || '-'}</span>` },
        { key: 'is_active', label: '상태', align: 'center', render: p => p.is_active ? '<span class="inline-flex items-center gap-1 text-green-600 font-bold"><i class="fas fa-circle text-[6px]"></i>활성</span>' : '<span class="text-gray-400">비활성</span>' },
        { key: '_actions', label: '관리', align: 'center', show: canEditPolicy, render: p => `<div class="flex gap-1 justify-center flex-wrap">
          <button onclick="showCommDetailModal(${p.commission_policy_id})" class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs"><i class="fas fa-eye"></i></button>
          <button onclick='showEditCommissionModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"><i class="fas fa-edit"></i></button>
          <button onclick="cloneCommPolicy(${p.commission_policy_id})" class="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs"><i class="fas fa-copy"></i></button>
          <button onclick="toggleCommissionActive(${p.commission_policy_id},${p.is_active?0:1})" class="px-2 py-1 ${p.is_active?'bg-red-50 text-red-600':'bg-green-50 text-green-600'} rounded text-xs">${p.is_active?'비활성':'활성'}</button>
          ${!p.is_active ? `<button onclick="deleteCommissionPolicy(${p.commission_policy_id})" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs"><i class="fas fa-trash"></i></button>` : ''}
        </div>` }
      ], rows: policies, compact: true, noBorder: true, emptyText: '수수료 정책이 없습니다.' })}
    </div>`;
}

// ── 수수료 상세 모달 (영향도 포함) ──
async function showCommDetailModal(commId) {
  const p = (window._cachedCommPolicies||[]).find(x => x.commission_policy_id === commId);
  if (!p) { showToast('정책을 찾을 수 없습니다.', 'error'); return; }

  const simAmounts = [50000, 100000, 200000, 500000, 1000000];
  const simRows = simAmounts.map(amt => {
    const fee = p.mode==='PERCENT' ? Math.round(amt*p.value/100) : Number(p.value);
    return `<tr class="border-b border-gray-50"><td class="py-1.5 px-2 text-xs text-right">${amt.toLocaleString()}원</td><td class="py-1.5 px-2 text-xs text-right text-red-600 font-bold">${fee.toLocaleString()}원</td><td class="py-1.5 px-2 text-xs text-right text-green-700 font-bold">${(amt-fee).toLocaleString()}원</td><td class="py-1.5 px-2 text-xs text-right text-gray-400">${(fee/amt*100).toFixed(1)}%</td></tr>`;
  }).join('');

  const content = `<div class="space-y-4">
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">정책 ID</div><div class="font-mono font-bold text-lg">#${p.commission_policy_id}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">상태</div><div class="${p.is_active?'text-green-600 font-bold':'text-gray-400'}">${p.is_active?'<i class="fas fa-circle text-[8px] mr-1"></i>활성':'비활성'}</div></div>
    </div>

    <div class="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs text-amber-600 mb-1">수수료 유형</div>
          <div class="text-xl font-bold ${p.mode==='PERCENT'?'text-blue-700':'text-amber-700'}">${p.mode==='PERCENT'?'정률 (%)':'정액 (원)'}</div>
        </div>
        <div class="text-right">
          <div class="text-xs text-amber-600 mb-1">수수료 값</div>
          <div class="text-4xl font-bold text-gray-800">${p.mode==='PERCENT'?p.value+'%':formatAmount(p.value)}</div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1"><i class="fas fa-building mr-1"></i>대상 총판</div><div class="font-medium text-purple-700">${escapeHtml(p.org_name||'-')}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1"><i class="fas fa-user mr-1"></i>대상 팀장</div><div>${escapeHtml(p.team_leader_name||'') || '<span class="text-gray-400">총판 기본 (전체 적용)</span>'}</div></div>
    </div>

    <div>
      <div class="text-xs font-semibold text-gray-600 mb-2"><i class="fas fa-calculator mr-1"></i>금액별 시뮬레이션</div>
      <table class="w-full text-sm"><thead class="bg-gray-50"><tr><th class="py-1.5 px-2 text-right text-xs">주문금액</th><th class="py-1.5 px-2 text-right text-xs">수수료</th><th class="py-1.5 px-2 text-right text-xs">지급액</th><th class="py-1.5 px-2 text-right text-xs">실질요율</th></tr></thead><tbody>${simRows}</tbody></table>
    </div>

    <div id="comm-impact-area"><div class="text-center py-3 text-gray-400 text-xs"><i class="fas fa-spinner fa-spin mr-1"></i>영향도 분석 중...</div></div>
  </div>`;

  showModal(`<i class="fas fa-percent mr-2 text-amber-600"></i>수수료 정책 상세 — ${escapeHtml(p.org_name||'')}`, content,
    `<button onclick="cloneCommPolicy(${p.commission_policy_id});closeModal()" class="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm"><i class="fas fa-copy mr-1"></i>복제</button>
     <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`, { large: true });

  // 비동기 영향도
  try {
    const impRes = await api('GET', `/stats/policies/commission/${commId}/impact`);
    const imp = impRes?.impact || {};
    const area = document.getElementById('comm-impact-area');
    if (area) area.innerHTML = `
      <div class="text-xs font-semibold text-gray-600 mb-2"><i class="fas fa-chart-line mr-1"></i>영향도 분석 (최근 30일)</div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div class="bg-blue-50 rounded-lg p-2.5 text-center border border-blue-100"><div class="text-lg font-bold text-blue-700">${imp.recent_orders_30d||0}</div><div class="text-[10px] text-gray-500">정산 주문</div></div>
        <div class="bg-green-50 rounded-lg p-2.5 text-center border border-green-100"><div class="text-lg font-bold text-green-700">${formatAmount(imp.recent_amount_30d||0)}</div><div class="text-[10px] text-gray-500">정산 총액</div></div>
        <div class="bg-red-50 rounded-lg p-2.5 text-center border border-red-100"><div class="text-lg font-bold text-red-700">${formatAmount(imp.estimated_monthly_fee||0)}</div><div class="text-[10px] text-gray-500">예상 월 수수료</div></div>
        <div class="bg-purple-50 rounded-lg p-2.5 text-center border border-purple-100"><div class="text-lg font-bold text-purple-700">${imp.team_leader_count||0}명</div><div class="text-[10px] text-gray-500">소속 팀장</div></div>
      </div>
      ${imp.sibling_policies?.length ? `<div class="mt-2"><div class="text-[10px] text-gray-500 mb-1">동일 총판 다른 수수료 정책</div><div class="flex flex-wrap gap-1">${imp.sibling_policies.map(sp => `<span class="inline-block px-2 py-0.5 rounded text-[10px] ${sp.is_active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}">#${sp.commission_policy_id} ${sp.mode}=${sp.value} ${sp.team_leader_name||'기본'}</span>`).join('')}</div></div>` : ''}`;
  } catch {}
}

// ── 시뮬레이터 모달 ──
async function showCommSimulatorModal() {
  const orgsRes = await api('GET', '/auth/organizations');
  const orgs = (orgsRes?.organizations || []).filter(o => o.org_type === 'REGION');
  const content = `<div class="space-y-4">
    <div class="bg-amber-50 rounded-lg p-3 text-xs text-amber-700"><i class="fas fa-calculator mr-1"></i>총판을 선택하면 해당 총판의 활성 수수료 정책으로 다양한 금액을 시뮬레이션합니다.</div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="block text-xs text-gray-500 mb-1">대상 총판</label>
        <select id="sim-org" class="w-full border rounded-lg px-3 py-2 text-sm">
          <option value="">전체 총판</option>
          ${orgs.map(o => `<option value="${o.org_id}">${escapeHtml(o.name)}</option>`).join('')}
        </select></div>
      <div><label class="block text-xs text-gray-500 mb-1">시뮬레이션 금액 (콤마 구분)</label>
        <input id="sim-amounts" class="w-full border rounded-lg px-3 py-2 text-sm" value="50000, 100000, 200000, 500000, 1000000"></div>
    </div>
    <button onclick="_runCommSimulation()" class="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 w-full"><i class="fas fa-play mr-1"></i>시뮬레이션 실행</button>
    <div id="sim-results"></div>
  </div>`;
  showModal('<i class="fas fa-calculator mr-2 text-amber-600"></i>수수료 시뮬레이션', content, `<button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`, { large: true });
}

async function _runCommSimulation() {
  const el = document.getElementById('sim-results');
  if (!el) return;
  el.innerHTML = '<div class="text-center py-3 text-gray-400"><i class="fas fa-spinner fa-spin mr-1"></i>시뮬레이션 중...</div>';
  try {
    const org_id = document.getElementById('sim-org')?.value || undefined;
    const amounts = document.getElementById('sim-amounts')?.value.split(',').map(s => Number(s.trim())).filter(n => n > 0);
    const res = await api('POST', '/stats/policies/commission/simulate', { amounts, org_id: org_id ? Number(org_id) : undefined });
    const sims = res?.simulations || [];
    if (!sims.length) { el.innerHTML = '<div class="text-center py-3 text-gray-400">활성 수수료 정책이 없습니다.</div>'; return; }
    el.innerHTML = sims.map(s => `
      <div class="bg-white rounded-lg p-3 border mb-3">
        <div class="font-medium text-sm mb-2">${escapeHtml(s.org_name)} <span class="status-badge ${s.mode==='PERCENT'?'bg-blue-100 text-blue-700':'bg-amber-100 text-amber-700'}">${s.mode}=${s.value}</span> ${s.team_leader_id?'(팀장 #'+s.team_leader_id+')':'(기본)'}</div>
        <table class="w-full text-xs"><thead class="bg-gray-50"><tr><th class="py-1 px-2 text-right">주문금액</th><th class="py-1 px-2 text-right">수수료</th><th class="py-1 px-2 text-right">지급액</th><th class="py-1 px-2 text-right">실질요율</th></tr></thead>
        <tbody>${s.simulations.map(sim => `<tr class="border-b border-gray-50"><td class="py-1 px-2 text-right">${sim.amount.toLocaleString()}원</td><td class="py-1 px-2 text-right text-red-600 font-bold">${sim.fee.toLocaleString()}원</td><td class="py-1 px-2 text-right text-green-700 font-bold">${sim.net.toLocaleString()}원</td><td class="py-1 px-2 text-right text-gray-400">${sim.rate}</td></tr>`).join('')}</tbody></table>
      </div>`).join('');
  } catch (e) { el.innerHTML = `<div class="text-red-500 text-sm">${e.message||e}</div>`; }
}

// ── 새 수수료 추가 ──
async function showNewCommissionModal() {
  const orgsRes = await api('GET', '/auth/organizations');
  const orgs = orgsRes?.organizations || [];
  const content = `<div class="space-y-4">
    <div class="bg-amber-50 rounded-lg p-3 text-xs text-amber-700"><i class="fas fa-info-circle mr-1"></i>정률: 주문금액에서 %를 수수료로 차감 · 정액: 건당 고정 금액 차감. 총판 기본으로 설정하면 해당 총판의 모든 팀장에게 적용됩니다.</div>
    <div><label class="block text-xs text-gray-600 mb-1 font-semibold">대상 총판 *</label>
      <select id="cp-org" class="w-full border rounded-lg px-3 py-2 text-sm">${orgs.map(o => `<option value="${o.org_id}">${escapeHtml(o.name)} (${o.org_type})</option>`).join('')}</select></div>
    <div><label class="block text-xs text-gray-600 mb-1 font-semibold">대상 팀장 ID <span class="font-normal text-gray-400">(비우면 총판 기본)</span></label>
      <input id="cp-leader" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="선택사항"></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="block text-xs text-gray-600 mb-1 font-semibold">유형 *</label>
        <select id="cp-mode" class="w-full border rounded-lg px-3 py-2 text-sm" onchange="_cpPreview()"><option value="PERCENT">정률 (%)</option><option value="FIXED">정액 (원)</option></select></div>
      <div><label class="block text-xs text-gray-600 mb-1 font-semibold">값 *</label>
        <input id="cp-value" type="number" step="0.1" class="w-full border rounded-lg px-3 py-2 text-sm" value="7.5" oninput="_cpPreview()"></div>
    </div>
    <div id="cp-preview" class="bg-gray-50 rounded-lg p-3 text-xs text-gray-600"><i class="fas fa-calculator mr-1"></i>10만원 주문 기준: 수수료 7,500원 / 지급액 92,500원</div>
    <div><label class="block text-xs text-gray-600 mb-1">적용 시작일</label>
      <input id="cp-from" type="date" class="w-full border rounded-lg px-3 py-2 text-sm" value="${new Date().toISOString().split('T')[0]}"></div>
  </div>`;
  showModal('<i class="fas fa-plus mr-2 text-amber-600"></i>수수료 정책 추가', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitNewCommission()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">추가</button>`);
}

function _cpPreview() {
  const mode = document.getElementById('cp-mode')?.value || document.getElementById('cp-edit-mode')?.value;
  const val = +(document.getElementById('cp-value')?.value || document.getElementById('cp-edit-value')?.value || 0);
  const el = document.getElementById('cp-preview') || document.getElementById('cp-edit-preview');
  if (!el) return;
  if (mode === 'PERCENT') {
    const fee = Math.round(100000 * val / 100);
    el.innerHTML = `<i class="fas fa-calculator mr-1"></i>10만원 주문 기준: 수수료 <strong class="text-red-600">${fee.toLocaleString()}원</strong> / 지급액 <strong class="text-green-700">${(100000-fee).toLocaleString()}원</strong>`;
  } else {
    el.innerHTML = `<i class="fas fa-calculator mr-1"></i>건당 수수료: <strong class="text-red-600">${Number(val).toLocaleString()}원</strong> 차감`;
  }
}

async function submitNewCommission() {
  const orgId = +document.getElementById('cp-org').value;
  const leaderId = document.getElementById('cp-leader').value ? +document.getElementById('cp-leader').value : null;
  await _policyApiAction('POST', '/stats/policies/commission', {
    org_id: orgId, team_leader_id: leaderId,
    mode: document.getElementById('cp-mode').value,
    value: +document.getElementById('cp-value').value,
    effective_from: document.getElementById('cp-from')?.value,
  }, { successMsg: '수수료 정책 추가 완료' });
}

// ── 수정 모달 ──
function showEditCommissionModal(p) {
  const content = `<div class="space-y-4">
    <div class="bg-gray-50 rounded-lg p-3 text-sm"><strong>${escapeHtml(p.org_name||'-')}</strong> ${p.team_leader_name ? '· 팀장: ' + escapeHtml(p.team_leader_name) : '· 총판 기본 (전체 적용)'}</div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="block text-xs text-gray-500 mb-1">유형</label>
        <select id="cp-edit-mode" class="w-full border rounded-lg px-3 py-2 text-sm" onchange="_cpPreview()"><option value="PERCENT" ${p.mode==='PERCENT'?'selected':''}>정률 (%)</option><option value="FIXED" ${p.mode==='FIXED'?'selected':''}>정액 (원)</option></select></div>
      <div><label class="block text-xs text-gray-500 mb-1">값</label>
        <input id="cp-edit-value" type="number" step="0.1" class="w-full border rounded-lg px-3 py-2 text-sm" value="${p.value}" oninput="_cpPreview()"></div>
    </div>
    <div id="cp-edit-preview" class="bg-gray-50 rounded-lg p-3 text-xs text-gray-600"><i class="fas fa-calculator mr-1"></i>${p.mode==='PERCENT'?`10만원 기준: 수수료 ${Math.round(100000*p.value/100).toLocaleString()}원`:`건당 ${Number(p.value).toLocaleString()}원 차감`}</div>
  </div>`;
  showModal(`수수료 수정 — ${escapeHtml(p.org_name||'')}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitEditCommission(${p.commission_policy_id})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">저장</button>`);
}

async function submitEditCommission(id) {
  await _policyApiAction('PUT', `/stats/policies/commission/${id}`, {
    mode: document.getElementById('cp-edit-mode').value,
    value: +document.getElementById('cp-edit-value').value,
  }, { successMsg: '수정 완료' });
}

async function toggleCommissionActive(id, newActive) {
  await _policyApiAction('PUT', `/stats/policies/commission/${id}`, { is_active: !!newActive }, { successMsg: newActive ? '활성화 완료' : '비활성화 완료' });
}

async function deleteCommissionPolicy(id) {
  showConfirmModal('수수료 정책 삭제', `#${id} 수수료 정책을 삭제하시겠습니까?\n(비활성 정책만 삭제 가능)`, async () => {
    const res = await api('DELETE', `/stats/policies/commission/${id}`);
    if (res?.ok) { showToast('삭제 완료', 'success'); renderContent(); }
    else showToast(res?.error || '삭제 실패', 'error');
  }, '삭제', 'bg-red-600');
}

async function cloneCommPolicy(id) {
  try {
    const res = await api('POST', `/stats/policies/commission/${id}/clone`);
    if (res?.ok) { showToast('복제 완료', 'success'); renderContent(); }
    else showToast(res?.error || '복제 실패', 'error');
  } catch (e) { showToast('복제 실패: ' + (e.message||e), 'error'); }
}
