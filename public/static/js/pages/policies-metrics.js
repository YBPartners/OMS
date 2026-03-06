// ============================================================
// 와이비 OMS — 지표 정책 탭 v10.1 (실 DB 스키마 기반)
// 완료기준/지역접수기준 설정, CRUD, 상세 모달
// ============================================================

function renderMetricsPolicyTab(policies) {
  const canEditPolicy = canEdit('policy');

  const basisLabel = {
    'SUBMITTED_AT': '보고서 제출일',
    'HQ_APPROVED_AT': 'HQ 승인일',
    'SETTLEMENT_CONFIRMED_AT': '정산 확정일',
    'DISTRIBUTED_AT': '배분일',
    'REGION_ACCEPT_AT': '지역 접수일',
  };

  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h3 class="font-semibold text-lg"><i class="fas fa-chart-bar mr-2 text-purple-500"></i>지표 산출 기준 정책</h3>
          <p class="text-xs text-gray-500 mt-1">팀장 완료율, 지역 접수 통계 등 지표 산출 시 사용하는 <strong>기준일 정의</strong>입니다. <strong class="text-purple-600">활성 정책 1개만 적용</strong>됩니다.</p>
        </div>
        ${canEditPolicy ? `<button onclick="showNewMetricsPolicyModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"><i class="fas fa-plus mr-1"></i>새 정책</button>` : ''}
      </div>

      <div class="bg-purple-50 rounded-lg p-3 mb-4 text-xs text-purple-700 leading-relaxed">
        <i class="fas fa-info-circle mr-1"></i><strong>설명:</strong>
        <strong>완료 기준</strong> — 주문이 "완료"로 간주되는 시점 (보고서 제출? HQ 승인? 정산 확정?).
        <strong>지역 접수 기준</strong> — 지역 통계에서 "접수"로 카운팅되는 시점 (배분일? 지역 접수일?).
        이 설정에 따라 대시보드·통계 수치가 달라집니다.
      </div>

      ${renderDataTable({ columns: [
        { key: 'metrics_policy_id', label: 'ID', render: p => `<span class="font-mono text-xs text-gray-500">#${p.metrics_policy_id}</span>` },
        { key: 'completion_basis', label: '완료 기준', render: p => `<button onclick="showMetricsDetailModal(${p.metrics_policy_id})" class="text-left text-blue-700 hover:underline"><span class="status-badge bg-blue-100 text-blue-700">${basisLabel[p.completion_basis] || p.completion_basis}</span></button>` },
        { key: 'region_intake_basis', label: '지역 접수 기준', render: p => `<span class="status-badge bg-emerald-100 text-emerald-700">${basisLabel[p.region_intake_basis] || p.region_intake_basis}</span>` },
        { key: 'effective_from', label: '적용일', render: p => `<span class="text-xs">${p.effective_from || '-'}</span>` },
        { key: 'is_active', label: '상태', align: 'center', render: p => p.is_active ? '<span class="inline-flex items-center gap-1 text-green-600 font-bold"><i class="fas fa-circle text-[6px]"></i>활성</span>' : '<span class="text-gray-400">비활성</span>' },
        { key: '_actions', label: '관리', align: 'center', show: canEditPolicy, render: p => `<div class="flex gap-1 justify-center flex-wrap">
          <button onclick="showMetricsDetailModal(${p.metrics_policy_id})" class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs hover:bg-indigo-100"><i class="fas fa-eye"></i></button>
          <button onclick='showEditMetricsPolicyModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"><i class="fas fa-edit"></i></button>
          <button onclick="togglePolicyActive('metrics',${p.metrics_policy_id},${p.is_active?0:1})" class="px-2 py-1 ${p.is_active?'bg-red-50 text-red-600':'bg-green-50 text-green-600'} rounded text-xs">${p.is_active?'비활성':'활성'}</button>
          ${!p.is_active ? `<button onclick="deleteMetricsPolicy(${p.metrics_policy_id})" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs"><i class="fas fa-trash"></i></button>` : ''}
        </div>` }
      ], rows: policies, compact: true, noBorder: true, emptyText: '지표 정책이 없습니다.' })}
    </div>`;
}

// ── 지표 정책 상세 모달 ──
function showMetricsDetailModal(policyId) {
  const p = (window._cachedMetricsPolicies||[]).find(x => x.metrics_policy_id === policyId);
  if (!p) { showToast('정책을 찾을 수 없습니다.', 'error'); return; }

  const basisInfo = {
    'SUBMITTED_AT': { label: '보고서 제출일', icon: 'fa-file-lines', color: 'blue', desc: '팀장이 보고서를 제출한 시점을 기준으로 완료 처리합니다. 빠른 통계 반영.' },
    'HQ_APPROVED_AT': { label: 'HQ 승인일', icon: 'fa-check-double', color: 'green', desc: '본사(HQ)가 최종 승인한 시점을 기준으로 완료 처리합니다. 품질 검증 후 카운팅.' },
    'SETTLEMENT_CONFIRMED_AT': { label: '정산 확정일', icon: 'fa-calculator', color: 'amber', desc: '정산이 확정된 시점을 기준으로 완료 처리합니다. 재무적으로 가장 보수적.' },
    'DISTRIBUTED_AT': { label: '배분일', icon: 'fa-share-nodes', color: 'indigo', desc: '주문이 지역총판에 배분된 시점을 지역 접수로 간주합니다.' },
    'REGION_ACCEPT_AT': { label: '지역 접수일', icon: 'fa-building', color: 'teal', desc: '지역총판이 실제로 접수 확인한 시점을 기준으로 합니다.' },
  };

  const comp = basisInfo[p.completion_basis] || { label: p.completion_basis, icon: 'fa-question', color: 'gray', desc: '' };
  const region = basisInfo[p.region_intake_basis] || { label: p.region_intake_basis, icon: 'fa-question', color: 'gray', desc: '' };

  const content = `<div class="space-y-4">
    <div class="grid grid-cols-3 gap-3">
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">정책 ID</div><div class="font-mono font-bold text-lg">#${p.metrics_policy_id}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">적용일</div><div class="text-sm font-medium">${p.effective_from || '-'}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">상태</div><div class="${p.is_active?'text-green-600 font-bold':'text-gray-400'}">${p.is_active?'<i class="fas fa-circle text-[8px] mr-1"></i>활성':'비활성'}</div></div>
    </div>

    <div class="bg-${comp.color}-50 rounded-xl p-4 border border-${comp.color}-200">
      <div class="flex items-center gap-2 mb-2">
        <div class="w-8 h-8 rounded-lg bg-${comp.color}-100 flex items-center justify-center"><i class="fas ${comp.icon} text-${comp.color}-600"></i></div>
        <div>
          <div class="text-xs text-gray-500">완료 기준 (completion_basis)</div>
          <div class="font-bold text-${comp.color}-800">${comp.label}</div>
        </div>
      </div>
      <div class="text-xs text-${comp.color}-700 leading-relaxed">${comp.desc}</div>
      <div class="mt-2 text-[10px] text-gray-400 font-mono bg-white rounded px-2 py-1">${p.completion_basis}</div>
    </div>

    <div class="bg-${region.color}-50 rounded-xl p-4 border border-${region.color}-200">
      <div class="flex items-center gap-2 mb-2">
        <div class="w-8 h-8 rounded-lg bg-${region.color}-100 flex items-center justify-center"><i class="fas ${region.icon} text-${region.color}-600"></i></div>
        <div>
          <div class="text-xs text-gray-500">지역 접수 기준 (region_intake_basis)</div>
          <div class="font-bold text-${region.color}-800">${region.label}</div>
        </div>
      </div>
      <div class="text-xs text-${region.color}-700 leading-relaxed">${region.desc}</div>
      <div class="mt-2 text-[10px] text-gray-400 font-mono bg-white rounded px-2 py-1">${p.region_intake_basis}</div>
    </div>

    <div class="bg-yellow-50 rounded-lg p-3 text-xs text-yellow-700 leading-relaxed">
      <i class="fas fa-lightbulb mr-1"></i><strong>영향:</strong> 이 설정에 따라 대시보드의 '완료율', '일일 통계', '지역별 접수 건수' 등이 다르게 산출됩니다. 변경 시 과거 데이터의 통계도 소급 변경됩니다.
    </div>
    ${p.created_at ? `<div class="text-[11px] text-gray-400 text-right">생성: ${new Date(p.created_at).toLocaleString('ko-KR')}</div>` : ''}
  </div>`;

  showModal(`<i class="fas fa-chart-bar mr-2 text-purple-600"></i>지표 산출 기준 상세 — #${p.metrics_policy_id}`, content,
    `<button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`, { large: true });
}

// ── 새 지표 정책 생성 ──
function showNewMetricsPolicyModal() {
  const content = `<div class="space-y-4">
    <div class="bg-purple-50 rounded-lg p-3 text-xs text-purple-700"><i class="fas fa-info-circle mr-1"></i>새 정책을 생성하면 기존 활성 정책은 자동으로 비활성화됩니다.</div>

    <div class="bg-gray-50 rounded-lg p-4 border">
      <div class="text-xs font-semibold text-gray-600 mb-3"><i class="fas fa-flag-checkered mr-1"></i>완료 기준 (completion_basis) *</div>
      <p class="text-[10px] text-gray-400 mb-2">주문이 "완료"로 카운팅되는 시점을 결정합니다.</p>
      <div class="space-y-2">
        <label class="flex items-start gap-2 p-2 rounded-lg bg-white border cursor-pointer hover:bg-blue-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-300">
          <input type="radio" name="mp-completion" value="SUBMITTED_AT" checked class="mt-0.5 text-blue-600">
          <div><div class="text-sm font-medium">보고서 제출일</div><div class="text-[10px] text-gray-500">팀장이 보고서를 제출한 시점. 가장 빠른 반영.</div></div>
        </label>
        <label class="flex items-start gap-2 p-2 rounded-lg bg-white border cursor-pointer hover:bg-blue-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-300">
          <input type="radio" name="mp-completion" value="HQ_APPROVED_AT" class="mt-0.5 text-blue-600">
          <div><div class="text-sm font-medium">HQ 승인일</div><div class="text-[10px] text-gray-500">본사(HQ)가 최종 승인한 시점. 품질 검증 후 카운팅.</div></div>
        </label>
        <label class="flex items-start gap-2 p-2 rounded-lg bg-white border cursor-pointer hover:bg-blue-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-300">
          <input type="radio" name="mp-completion" value="SETTLEMENT_CONFIRMED_AT" class="mt-0.5 text-blue-600">
          <div><div class="text-sm font-medium">정산 확정일</div><div class="text-[10px] text-gray-500">정산이 확정된 시점. 재무적으로 가장 보수적.</div></div>
        </label>
      </div>
    </div>

    <div class="bg-gray-50 rounded-lg p-4 border">
      <div class="text-xs font-semibold text-gray-600 mb-3"><i class="fas fa-building mr-1"></i>지역 접수 기준 (region_intake_basis) *</div>
      <p class="text-[10px] text-gray-400 mb-2">지역 통계에서 "접수"로 카운팅되는 시점을 결정합니다.</p>
      <div class="space-y-2">
        <label class="flex items-start gap-2 p-2 rounded-lg bg-white border cursor-pointer hover:bg-emerald-50 has-[:checked]:bg-emerald-50 has-[:checked]:border-emerald-300">
          <input type="radio" name="mp-region" value="DISTRIBUTED_AT" checked class="mt-0.5 text-emerald-600">
          <div><div class="text-sm font-medium">배분일</div><div class="text-[10px] text-gray-500">주문이 지역총판에 배분된 시점.</div></div>
        </label>
        <label class="flex items-start gap-2 p-2 rounded-lg bg-white border cursor-pointer hover:bg-emerald-50 has-[:checked]:bg-emerald-50 has-[:checked]:border-emerald-300">
          <input type="radio" name="mp-region" value="REGION_ACCEPT_AT" class="mt-0.5 text-emerald-600">
          <div><div class="text-sm font-medium">지역 접수일</div><div class="text-[10px] text-gray-500">지역총판이 실제로 접수 확인한 시점.</div></div>
        </label>
      </div>
    </div>

    <div><label class="block text-xs text-gray-600 mb-1 font-semibold">적용 시작일</label>
      <input id="mp-from" type="date" class="w-full border rounded-lg px-3 py-2 text-sm" value="${new Date().toISOString().split('T')[0]}"></div>
  </div>`;

  showModal('<i class="fas fa-plus mr-2 text-purple-600"></i>새 지표 산출 기준 정책', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitNewMetricsPolicy()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">생성</button>`, { large: true });
}

async function submitNewMetricsPolicy() {
  const completion = document.querySelector('input[name="mp-completion"]:checked')?.value;
  const region = document.querySelector('input[name="mp-region"]:checked')?.value;
  if (!completion || !region) { showToast('기준을 모두 선택하세요.', 'warning'); return; }

  await _policyApiAction('POST', '/stats/policies/metrics', {
    completion_basis: completion,
    region_intake_basis: region,
    effective_from: document.getElementById('mp-from')?.value,
  }, { successMsg: '새 지표 정책 생성 완료' });
}

// ── 수정 모달 ──
function showEditMetricsPolicyModal(p) {
  const content = `<div class="space-y-4">
    <div class="bg-gray-50 rounded-lg p-3 text-sm flex items-center gap-3">
      <span>정책 ID: <strong>#${p.metrics_policy_id}</strong></span>
      <span class="${p.is_active?'text-green-600 font-semibold':'text-gray-400'}">${p.is_active?'활성':'비활성'}</span>
    </div>

    <div>
      <label class="block text-xs text-gray-600 mb-1 font-semibold">완료 기준</label>
      <select id="mp-edit-completion" class="w-full border rounded-lg px-3 py-2 text-sm">
        <option value="SUBMITTED_AT" ${p.completion_basis==='SUBMITTED_AT'?'selected':''}>보고서 제출일</option>
        <option value="HQ_APPROVED_AT" ${p.completion_basis==='HQ_APPROVED_AT'?'selected':''}>HQ 승인일</option>
        <option value="SETTLEMENT_CONFIRMED_AT" ${p.completion_basis==='SETTLEMENT_CONFIRMED_AT'?'selected':''}>정산 확정일</option>
      </select>
    </div>
    <div>
      <label class="block text-xs text-gray-600 mb-1 font-semibold">지역 접수 기준</label>
      <select id="mp-edit-region" class="w-full border rounded-lg px-3 py-2 text-sm">
        <option value="DISTRIBUTED_AT" ${p.region_intake_basis==='DISTRIBUTED_AT'?'selected':''}>배분일</option>
        <option value="REGION_ACCEPT_AT" ${p.region_intake_basis==='REGION_ACCEPT_AT'?'selected':''}>지역 접수일</option>
      </select>
    </div>
    <div>
      <label class="block text-xs text-gray-600 mb-1 font-semibold">적용일</label>
      <input id="mp-edit-from" type="date" class="w-full border rounded-lg px-3 py-2 text-sm" value="${p.effective_from ? p.effective_from.split(' ')[0] : ''}">
    </div>
  </div>`;

  showModal(`지표 정책 수정 — #${p.metrics_policy_id}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitEditMetricsPolicy(${p.metrics_policy_id})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">저장</button>`);
}

async function submitEditMetricsPolicy(id) {
  await _policyApiAction('PUT', `/stats/policies/metrics/${id}`, {
    completion_basis: document.getElementById('mp-edit-completion')?.value,
    region_intake_basis: document.getElementById('mp-edit-region')?.value,
    effective_from: document.getElementById('mp-edit-from')?.value,
  }, { successMsg: '수정 완료' });
}

async function deleteMetricsPolicy(id) {
  showConfirmModal('지표 정책 삭제', `#${id} 지표 정책을 삭제하시겠습니까?\n(비활성 정책만 삭제 가능)`, async () => {
    const res = await api('DELETE', `/stats/policies/metrics/${id}`);
    if (res?.ok) { showToast('삭제 완료', 'success'); renderContent(); }
    else showToast(res?.error || '삭제 실패', 'error');
  }, '삭제', 'bg-red-600');
}
