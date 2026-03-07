// ============================================================
// Airflow OMS — 배분 정책 탭 v10.0 (R13 고도화)
// 비주얼 규칙빌더, 영향도 분석, 복제, 상세 모달 강화
// ============================================================

function renderDistPolicyTab(policies) {
  const canEditPolicy = canEdit('policy');
  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h3 class="font-semibold text-lg">배분 정책 (시군구 기반 자동배분)</h3>
          <p class="text-xs text-gray-500 mt-1">주문 인입 시 주소의 시군구를 기반으로 총판에 자동 배분하는 규칙을 정의합니다. <strong class="text-blue-600">활성 정책 1개만 적용</strong>됩니다.</p>
        </div>
        ${canEditPolicy ? `<button onclick="showNewDistPolicyModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"><i class="fas fa-plus mr-1"></i>새 버전</button>` : ''}
      </div>
      ${renderDataTable({ columns: [
        { key: 'policy_id', label: 'ID', render: p => `<span class="font-mono text-xs text-gray-500">#${p.policy_id}</span>` },
        { key: 'name', label: '정책명', render: p => `<button onclick='showDistDetailModal(${p.policy_id})' class="text-left text-blue-700 hover:underline font-medium">${escapeHtml(p.name)}</button>` },
        { key: 'version', label: '버전', align: 'center', render: p => `<span class="status-badge bg-blue-100 text-blue-700">v${p.version}</span>` },
        { key: '_rule', label: '배분 방식', render: p => { try { const r = typeof p.rule_json==='string'?JSON.parse(p.rule_json):p.rule_json; return `<span class="text-xs"><span class="status-badge bg-gray-100 text-gray-700">${r.method||'-'}</span> <span class="text-gray-400">fallback:</span> ${r.fallback||'-'}</span>`; } catch { return '-'; }} },
        { key: 'is_active', label: '상태', align: 'center', render: p => p.is_active ? '<span class="inline-flex items-center gap-1 text-green-600 font-bold"><i class="fas fa-circle text-[6px]"></i>활성</span>' : '<span class="text-gray-400">비활성</span>' },
        { key: 'effective_from', label: '적용일', render: p => `<span class="text-xs">${p.effective_from || '-'}</span>` },
        { key: '_actions', label: '관리', align: 'center', show: canEditPolicy, render: p => `<div class="flex gap-1 justify-center flex-wrap">
          <button onclick="showDistDetailModal(${p.policy_id})" class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs hover:bg-indigo-100" title="상세/영향도"><i class="fas fa-eye"></i></button>
          <button onclick='showEditDistPolicyModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200" title="수정"><i class="fas fa-edit"></i></button>
          <button onclick="clonePolicy('distribution',${p.policy_id})" class="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs hover:bg-purple-100" title="복제"><i class="fas fa-copy"></i></button>
          <button onclick="togglePolicyActive('distribution',${p.policy_id},${p.is_active?0:1})" class="px-2 py-1 ${p.is_active?'bg-red-50 text-red-600':'bg-green-50 text-green-600'} rounded text-xs hover:opacity-80">${p.is_active?'비활성':'활성'}</button>
          ${!p.is_active ? `<button onclick="deletePolicy('distribution',${p.policy_id})" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200" title="삭제"><i class="fas fa-trash"></i></button>` : ''}
        </div>` }
      ], rows: policies, compact: true, noBorder: true, emptyText: '배분 정책이 없습니다. 새 버전을 추가하세요.' })}
    </div>`;
}

// ── 배분 정책 상세 모달 (영향도 분석 포함) ──
async function showDistDetailModal(policyId) {
  const p = (window._cachedDistPolicies||[]).find(x => x.policy_id === policyId);
  if (!p) { showToast('정책을 찾을 수 없습니다.', 'error'); return; }

  let ruleDisplay = '-';
  let ruleObj = {};
  try { ruleObj = typeof p.rule_json === 'string' ? JSON.parse(p.rule_json) : (p.rule_json || {}); ruleDisplay = JSON.stringify(ruleObj, null, 2); } catch { ruleDisplay = p.rule_json || '-'; }

  // 영향도 로딩
  let impactHtml = '<div class="text-center py-3 text-gray-400 text-xs"><i class="fas fa-spinner fa-spin mr-1"></i>영향도 분석 중...</div>';
  
  const content = `<div class="space-y-4">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">정책 ID</div><div class="font-mono font-bold text-lg">#${p.policy_id}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">버전</div><div class="font-bold text-blue-700 text-lg">v${p.version}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">상태</div><div class="${p.is_active ? 'text-green-600 font-bold' : 'text-gray-400'}">${p.is_active ? '<i class="fas fa-circle text-[8px] mr-1"></i>활성' : '비활성'}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">적용일</div><div class="text-sm">${p.effective_from || '-'}</div></div>
    </div>

    <div>
      <div class="text-xs font-semibold text-gray-600 mb-2"><i class="fas fa-sliders mr-1"></i>배분 규칙 설정</div>
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <div class="text-[10px] text-blue-500 mb-1">매칭 방식</div>
          <div class="font-bold text-blue-800">${ruleObj.method === 'sigungu_code' ? '시군구 코드' : ruleObj.method === 'sido_sigungu' ? '시도·시군구' : ruleObj.method || '-'}</div>
          <div class="text-[10px] text-blue-500 mt-1">${ruleObj.method === 'sigungu_code' ? '시군구 단위 매칭' : ruleObj.method === 'sido_sigungu' ? '시군구 단위 매칭' : ''}</div>
        </div>
        <div class="bg-amber-50 rounded-lg p-3 border border-amber-200">
          <div class="text-[10px] text-amber-500 mb-1">매칭 실패 시 (Fallback)</div>
          <div class="font-bold text-amber-800">${ruleObj.fallback === 'DISTRIBUTION_PENDING' ? '배분 대기' : ruleObj.fallback === 'MANUAL' ? '수동 배분' : ruleObj.fallback || '-'}</div>
          <div class="text-[10px] text-amber-500 mt-1">${ruleObj.fallback === 'DISTRIBUTION_PENDING' ? '관리자가 수동으로 배분' : ''}</div>
        </div>
      </div>
    </div>

    <div>
      <div class="text-xs font-semibold text-gray-600 mb-2"><i class="fas fa-code mr-1"></i>규칙 JSON (원문)</div>
      <pre class="bg-gray-900 text-green-300 rounded-lg p-3 text-xs overflow-x-auto max-h-32 font-mono">${escapeHtml(ruleDisplay)}</pre>
    </div>

    <div id="dist-impact-area">
      ${impactHtml}
    </div>

    <div class="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 leading-relaxed">
      <i class="fas fa-info-circle mr-1"></i><strong>동작 원리:</strong> 주문의 설치 주소에서 시군구를 식별 → <code class="bg-blue-100 px-1 rounded">region_sigungu_map</code>에서 매칭된 총판 검색 → 해당 총판에 자동 배분. 매칭 실패 시 <code class="bg-blue-100 px-1 rounded">${ruleObj.fallback || 'DISTRIBUTION_PENDING'}</code> 상태로 전환.
    </div>
    ${p.created_at ? `<div class="text-[11px] text-gray-400 text-right">생성: ${new Date(p.created_at).toLocaleString('ko-KR')}</div>` : ''}
  </div>`;

  showModal(`<i class="fas fa-share-nodes mr-2 text-blue-600"></i>배분 정책 상세 — ${escapeHtml(p.name)}`, content,
    `<button onclick="clonePolicy('distribution',${p.policy_id});closeModal()" class="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200"><i class="fas fa-copy mr-1"></i>복제</button>
     <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`, { large: true });

  // 비동기 영향도 로드
  try {
    const impactRes = await api('GET', `/stats/policies/distribution/${policyId}/impact`);
    const imp = impactRes?.impact || {};
    const area = document.getElementById('dist-impact-area');
    if (area) {
      area.innerHTML = `
        <div class="text-xs font-semibold text-gray-600 mb-2"><i class="fas fa-chart-line mr-1"></i>영향도 분석</div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div class="bg-orange-50 rounded-lg p-2.5 text-center border border-orange-100"><div class="text-lg font-bold text-orange-700">${imp.pending_orders||0}</div><div class="text-[10px] text-gray-500">배분 대기 주문</div></div>
          <div class="bg-green-50 rounded-lg p-2.5 text-center border border-green-100"><div class="text-lg font-bold text-green-700">${imp.mapping_rate||0}%</div><div class="text-[10px] text-gray-500">시군구 매핑률</div></div>
          <div class="bg-blue-50 rounded-lg p-2.5 text-center border border-blue-100"><div class="text-lg font-bold text-blue-700">${imp.mapped_sigungu||0}/${imp.total_sigungu||0}</div><div class="text-[10px] text-gray-500">매핑된 시군구</div></div>
          <div class="bg-red-50 rounded-lg p-2.5 text-center border border-red-100"><div class="text-lg font-bold text-red-700">${imp.unmapped_sigungu||0}</div><div class="text-[10px] text-gray-500">미매핑 시군구</div></div>
        </div>
        ${imp.unmapped_sigungu > 0 ? `<div class="mt-2 bg-red-50 rounded-lg p-2 text-xs text-red-700"><i class="fas fa-exclamation-triangle mr-1"></i><strong>${imp.unmapped_sigungu}개</strong> 시군구가 매핑되지 않았습니다. 해당 시군구의 주문은 자동 배분되지 않습니다. <button onclick="window._policyTab='territory';closeModal();renderContent()" class="underline font-bold ml-1">시군구 매핑 →</button></div>` : ''}
        ${imp.sido_mapping?.length ? `<div class="mt-2"><div class="text-[10px] text-gray-500 mb-1">시도별 매핑 현황</div><div class="flex flex-wrap gap-1">${imp.sido_mapping.map(s => {
          const pct = s.total ? Math.round(s.mapped/s.total*100) : 0;
          const color = pct === 100 ? 'bg-green-100 text-green-700' : pct > 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
          return `<span class="inline-block px-2 py-0.5 rounded ${color} text-[10px]">${s.sido} ${s.mapped}/${s.total} (${pct}%)</span>`;
        }).join('')}</div></div>` : ''}`;
    }
  } catch (e) {
    const area = document.getElementById('dist-impact-area');
    if (area) area.innerHTML = `<div class="text-xs text-gray-400">영향도 분석 실패: ${e.message||e}</div>`;
  }
}

// ── 새 배분 정책 생성 (비주얼 빌더) ──
function showNewDistPolicyModal() {
  const content = `<div class="space-y-4">
    <div class="bg-blue-50 rounded-lg p-3 text-xs text-blue-700"><i class="fas fa-info-circle mr-1"></i>새 버전을 생성하면 기존 활성 버전은 자동으로 비활성화됩니다.</div>
    <div><label class="block text-xs text-gray-600 mb-1 font-semibold">정책명 *</label>
      <input id="dp-name" class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none" placeholder="예: 시군구 기반 자동배분 v2"></div>

    <div class="bg-gray-50 rounded-lg p-4 border">
      <div class="text-xs font-semibold text-gray-600 mb-3"><i class="fas fa-sliders mr-1"></i>배분 규칙 설정</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs text-gray-500 mb-1">매칭 방식 *</label>
          <select id="dp-method" class="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="sigungu_code" selected>시군구 코드 매칭 (기본)</option>
            <option value="sido_sigungu">시도·시군구 매칭 (넓은 범위)</option>
            <option value="postal_code">우편번호 매칭</option>
          </select>
          <p class="text-[10px] text-gray-400 mt-1">주문의 설치 주소에서 추출한 코드를 지역권 테이블과 매칭합니다.</p>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">매칭 실패 시 처리 *</label>
          <select id="dp-fallback" class="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="DISTRIBUTION_PENDING" selected>배분 대기 (관리자가 수동 배분)</option>
            <option value="HQ_DIRECT">본사 직접 처리</option>
            <option value="REJECT">주문 반려</option>
          </select>
          <p class="text-[10px] text-gray-400 mt-1">일치하는 지역권이 없을 때 주문의 상태를 결정합니다.</p>
        </div>
      </div>
    </div>

    <div><label class="block text-xs text-gray-600 mb-1 font-semibold">적용 시작일</label>
      <input id="dp-from" type="date" class="w-full border rounded-lg px-3 py-2 text-sm" value="${new Date().toISOString().split('T')[0]}"></div>

    <details class="bg-gray-50 rounded-lg border">
      <summary class="px-4 py-2 text-xs text-gray-500 cursor-pointer hover:bg-gray-100 rounded-lg"><i class="fas fa-code mr-1"></i>고급: JSON 직접 편집</summary>
      <div class="px-4 pb-3">
        <textarea id="dp-rule-raw" rows="3" class="w-full border rounded-lg px-3 py-2 text-xs font-mono mt-2" placeholder='{"method":"sigungu_code","fallback":"DISTRIBUTION_PENDING"}'></textarea>
        <p class="text-[10px] text-gray-400 mt-1">위 비주얼 설정 대신 JSON을 직접 입력하면 JSON이 우선 적용됩니다.</p>
      </div>
    </details>
  </div>`;

  showModal('<i class="fas fa-plus mr-2 text-blue-600"></i>새 배분 정책 버전', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitNewDistPolicy()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">생성</button>`, { large: true });
}

async function submitNewDistPolicy() {
  const name = document.getElementById('dp-name')?.value;
  if (!name) { showToast('정책명을 입력하세요.', 'warning'); return; }

  // JSON 직접 입력 우선, 없으면 비주얼빌더에서 생성
  let rule_json;
  const rawJson = document.getElementById('dp-rule-raw')?.value?.trim();
  if (rawJson) {
    try { JSON.parse(rawJson); rule_json = rawJson; } catch { showToast('JSON 형식이 올바르지 않습니다.', 'warning'); return; }
  } else {
    rule_json = JSON.stringify({
      method: document.getElementById('dp-method')?.value || 'sigungu_code',
      fallback: document.getElementById('dp-fallback')?.value || 'DISTRIBUTION_PENDING'
    });
  }

  await _policyApiAction('POST', '/stats/policies/distribution',
    { name, rule_json, effective_from: document.getElementById('dp-from')?.value },
    { successMsg: d => `새 버전 v${d.version} 생성 완료` });
}

// ── 수정 모달 ──
function showEditDistPolicyModal(p) {
  let ruleObj = {};
  try { ruleObj = typeof p.rule_json === 'string' ? JSON.parse(p.rule_json) : (p.rule_json||{}); } catch {}

  const content = `<div class="space-y-4">
    <div class="bg-gray-50 rounded-lg p-3 text-sm flex items-center gap-3">
      <span>정책 ID: <strong>#${p.policy_id}</strong></span>
      <span class="status-badge bg-blue-100 text-blue-700">v${p.version}</span>
      <span class="${p.is_active?'text-green-600':'text-gray-400'}">${p.is_active?'활성':'비활성'}</span>
    </div>
    <div><label class="block text-xs text-gray-600 mb-1 font-semibold">정책명</label>
      <input id="dp-edit-name" class="w-full border rounded-lg px-3 py-2 text-sm" value="${escapeHtml(p.name)}"></div>
    <div class="bg-gray-50 rounded-lg p-4 border">
      <div class="text-xs font-semibold text-gray-600 mb-3"><i class="fas fa-sliders mr-1"></i>배분 규칙</div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-xs text-gray-500 mb-1">매칭 방식</label>
          <select id="dp-edit-method" class="w-full border rounded-lg px-3 py-2 text-sm">
            ${['sigungu_code','sido_sigungu','postal_code'].map(v => `<option value="${v}" ${ruleObj.method===v?'selected':''}>${v==='sigungu_code'?'시군구 코드':v==='sido_sigungu'?'시도·시군구':'우편번호'}</option>`).join('')}
          </select></div>
        <div><label class="block text-xs text-gray-500 mb-1">매칭 실패 시</label>
          <select id="dp-edit-fallback" class="w-full border rounded-lg px-3 py-2 text-sm">
            ${['DISTRIBUTION_PENDING','HQ_DIRECT','REJECT'].map(v => `<option value="${v}" ${ruleObj.fallback===v?'selected':''}>${v==='DISTRIBUTION_PENDING'?'배분 대기':v==='HQ_DIRECT'?'본사 직접':v==='REJECT'?'주문 반려':v}</option>`).join('')}
          </select></div>
      </div>
    </div>
  </div>`;

  showModal(`배분 정책 수정 — v${p.version}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitEditDistPolicy(${p.policy_id})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">저장</button>`);
}

async function submitEditDistPolicy(id) {
  const rule_json = JSON.stringify({
    method: document.getElementById('dp-edit-method')?.value,
    fallback: document.getElementById('dp-edit-fallback')?.value
  });
  await _policyApiAction('PUT', `/stats/policies/distribution/${id}`,
    { name: document.getElementById('dp-edit-name')?.value, rule_json },
    { successMsg: '수정 완료' });
}
