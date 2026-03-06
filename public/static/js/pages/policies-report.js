// ============================================================
// 와이비 OMS — 보고서 정책 탭 v10.0 (R13 고도화)
// 동적 사진카테고리, 체크리스트 필수/선택, 영향도, 복제
// ============================================================

function renderReportPolicyTab(policies) {
  const canEditPolicy = canEdit('policy');
  const _photosCol = p => {
    let d = '-';
    try { const pj = typeof p.required_photos_json === 'string' ? JSON.parse(p.required_photos_json) : p.required_photos_json;
      d = Object.entries(pj || {}).map(([k,v]) => `<span class="inline-block px-1.5 py-0.5 rounded ${Number(v)>0?'bg-blue-50 text-blue-700':'bg-gray-100 text-gray-400'} text-[10px] mr-0.5 mb-0.5">${k}:${v}</span>`).join('');
    } catch { d = p.required_photos_json || '-'; }
    return d;
  };
  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h3 class="font-semibold text-lg">보고서 필수요건 정책</h3>
          <p class="text-xs text-gray-500 mt-1">작업 보고서 제출 시 필수 사진 수, 영수증 요구 여부, 체크리스트 항목을 정의합니다. <strong class="text-emerald-600">서비스유형별 1개</strong> 적용.</p>
        </div>
        ${canEditPolicy ? `<button onclick="showNewReportPolicyModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"><i class="fas fa-plus mr-1"></i>새 버전</button>` : ''}
      </div>
      ${renderDataTable({ columns: [
        { key: 'policy_id', label: 'ID', render: p => `<span class="font-mono text-xs text-gray-500">#${p.policy_id}</span>` },
        { key: 'name', label: '정책명', render: p => `<button onclick='showReportDetailModal(${p.policy_id})' class="text-left text-blue-700 hover:underline font-medium">${escapeHtml(p.name)}</button>` },
        { key: 'service_type', label: '서비스유형', render: p => `<span class="status-badge bg-gray-100 text-gray-700">${p.service_type||'DEFAULT'}</span>` },
        { key: '_photos', label: '필수사진', render: _photosCol },
        { key: 'require_receipt', label: '영수증', align: 'center', render: p => p.require_receipt ? '<i class="fas fa-check-circle text-green-600"></i>' : '<i class="fas fa-minus-circle text-gray-300"></i>' },
        { key: 'is_active', label: '상태', align: 'center', render: p => p.is_active ? '<span class="inline-flex items-center gap-1 text-green-600 font-bold"><i class="fas fa-circle text-[6px]"></i>활성</span>' : '<span class="text-gray-400">비활성</span>' },
        { key: '_actions', label: '관리', align: 'center', show: canEditPolicy, render: p => `<div class="flex gap-1 justify-center flex-wrap">
          <button onclick="showReportDetailModal(${p.policy_id})" class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs hover:bg-indigo-100"><i class="fas fa-eye"></i></button>
          <button onclick='showEditReportPolicyModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"><i class="fas fa-edit"></i></button>
          <button onclick="clonePolicy('report',${p.policy_id})" class="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs hover:bg-purple-100"><i class="fas fa-copy"></i></button>
          <button onclick="togglePolicyActive('report',${p.policy_id},${p.is_active?0:1})" class="px-2 py-1 ${p.is_active?'bg-red-50 text-red-600':'bg-green-50 text-green-600'} rounded text-xs">${p.is_active?'비활성':'활성'}</button>
          ${!p.is_active ? `<button onclick="deletePolicy('report',${p.policy_id})" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs"><i class="fas fa-trash"></i></button>` : ''}
        </div>` }
      ], rows: policies, compact: true, noBorder: true, emptyText: '보고서 정책이 없습니다.' })}
    </div>`;
}

// ── 보고서 상세 모달 (영향도 포함) ──
async function showReportDetailModal(policyId) {
  const p = (window._cachedReportPolicies||[]).find(x => x.policy_id === policyId);
  if (!p) { showToast('정책을 찾을 수 없습니다.', 'error'); return; }

  let photos = {};
  try { photos = typeof p.required_photos_json === 'string' ? JSON.parse(p.required_photos_json) : (p.required_photos_json||{}); } catch {}
  let checklist = [];
  try { checklist = typeof p.required_checklist_json === 'string' ? JSON.parse(p.required_checklist_json) : (p.required_checklist_json||[]); } catch {}
  const totalPhotos = Object.values(photos).reduce((a,b) => a + Number(b), 0);

  const photoIcons = { BEFORE:'fa-camera text-blue-500', AFTER:'fa-camera-retro text-green-500', WASH:'fa-droplet text-cyan-500', RECEIPT:'fa-receipt text-amber-500', INSTALL:'fa-screwdriver-wrench text-indigo-500', LABEL:'fa-tag text-purple-500', DAMAGE:'fa-triangle-exclamation text-red-500', EXTRA:'fa-images text-gray-500' };

  const content = `<div class="space-y-4">
    <div class="grid grid-cols-3 gap-3">
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">정책 ID</div><div class="font-mono font-bold text-lg">#${p.policy_id}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">서비스유형</div><div class="font-bold">${p.service_type||'DEFAULT'}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">상태</div><div class="${p.is_active?'text-green-600 font-bold':'text-gray-400'}">${p.is_active?'<i class="fas fa-circle text-[8px] mr-1"></i>활성':'비활성'}</div></div>
    </div>

    <div>
      <div class="text-xs font-semibold text-gray-600 mb-2"><i class="fas fa-camera mr-1"></i>필수 사진 요건 (총 <strong class="text-blue-700">${totalPhotos}</strong>장)</div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
        ${Object.entries(photos).map(([k,v]) => {
          const iconClass = photoIcons[k] || 'fa-image text-gray-500';
          return `<div class="text-center p-3 rounded-lg ${Number(v)>0?'bg-blue-50 border border-blue-200':'bg-gray-50 border border-gray-200'} transition">
            <i class="fas ${iconClass} text-lg mb-1"></i>
            <div class="text-2xl font-bold ${Number(v)>0?'text-blue-700':'text-gray-400'}">${v}</div>
            <div class="text-[10px] ${Number(v)>0?'text-blue-600 font-medium':'text-gray-400'}">${k}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="bg-gray-50 rounded-lg p-3">
        <div class="text-xs font-semibold text-gray-600 mb-2"><i class="fas fa-receipt mr-1"></i>영수증 필수</div>
        <div class="flex items-center gap-2">
          ${p.require_receipt
            ? '<i class="fas fa-check-circle text-green-600 text-xl"></i><span class="text-green-700 font-bold">필수</span>'
            : '<i class="fas fa-minus-circle text-gray-400 text-xl"></i><span class="text-gray-500">선택</span>'}
        </div>
      </div>
      <div class="bg-gray-50 rounded-lg p-3">
        <div class="text-xs font-semibold text-gray-600 mb-2"><i class="fas fa-list-check mr-1"></i>체크리스트 (${checklist.length}항목)</div>
        ${checklist.length ? `<ul class="text-xs text-gray-700 space-y-1">${checklist.map((c,i) => `<li class="flex items-center gap-1.5"><span class="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 text-[10px] flex items-center justify-center font-bold">${i+1}</span>${escapeHtml(c)}</li>`).join('')}</ul>` : '<span class="text-gray-400 text-xs">없음</span>'}
      </div>
    </div>

    <div id="report-impact-area"><div class="text-center py-3 text-gray-400 text-xs"><i class="fas fa-spinner fa-spin mr-1"></i>영향도 분석 중...</div></div>

    <div class="bg-emerald-50 rounded-lg p-3 text-xs text-emerald-700 leading-relaxed">
      <i class="fas fa-info-circle mr-1"></i><strong>적용 범위:</strong> 이 정책이 활성화되면 서비스유형 <strong>"${p.service_type||'DEFAULT'}"</strong>에 해당하는 모든 작업 보고서에 위 요건이 적용됩니다. 사진 수 부족 또는 체크리스트 미충족 시 보고서 제출이 거부됩니다.
    </div>
  </div>`;

  showModal(`<i class="fas fa-file-lines mr-2 text-emerald-600"></i>보고서 정책 상세 — ${escapeHtml(p.name)}`, content,
    `<button onclick="clonePolicy('report',${p.policy_id});closeModal()" class="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm"><i class="fas fa-copy mr-1"></i>복제</button>
     <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`, { large: true });

  // 비동기 영향도
  try {
    const impRes = await api('GET', `/stats/policies/report/${policyId}/impact`);
    const imp = impRes?.impact || {};
    const area = document.getElementById('report-impact-area');
    if (area) area.innerHTML = `
      <div class="text-xs font-semibold text-gray-600 mb-2"><i class="fas fa-chart-line mr-1"></i>영향도 분석 (최근 30일)</div>
      <div class="grid grid-cols-3 gap-2">
        <div class="bg-yellow-50 rounded-lg p-2.5 text-center border border-yellow-100"><div class="text-lg font-bold text-yellow-700">${imp.pending_reports||0}</div><div class="text-[10px] text-gray-500">검토 대기 보고서</div></div>
        <div class="bg-green-50 rounded-lg p-2.5 text-center border border-green-100"><div class="text-lg font-bold text-green-700">${imp.completed_30d||0}</div><div class="text-[10px] text-gray-500">승인 완료</div></div>
        <div class="bg-red-50 rounded-lg p-2.5 text-center border border-red-100"><div class="text-lg font-bold text-red-700">${imp.rejected_30d||0}</div><div class="text-[10px] text-gray-500">반려</div></div>
      </div>`;
  } catch {}
}

// ── 새 보고서 정책 (동적 사진카테고리) ──
function showNewReportPolicyModal() {
  const defaultCategories = ['BEFORE','AFTER','WASH','RECEIPT'];
  const extraCategories = ['INSTALL','LABEL','DAMAGE','EXTRA'];
  const content = `<div class="space-y-4">
    <div class="bg-emerald-50 rounded-lg p-3 text-xs text-emerald-700"><i class="fas fa-info-circle mr-1"></i>새 버전을 생성하면 같은 서비스유형의 기존 활성 정책이 비활성화됩니다.</div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="block text-xs text-gray-600 mb-1 font-semibold">정책명 *</label>
        <input id="rp-name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="예: 기본 보고서 정책 v2"></div>
      <div><label class="block text-xs text-gray-600 mb-1 font-semibold">서비스유형</label>
        <select id="rp-type" class="w-full border rounded-lg px-3 py-2 text-sm">
          <option value="DEFAULT" selected>DEFAULT (기본)</option>
          <option value="PREMIUM">PREMIUM (프리미엄)</option>
          <option value="BASIC">BASIC (간편)</option>
          <option value="REPAIR">REPAIR (수리)</option>
        </select></div>
    </div>

    <div class="bg-gray-50 rounded-lg p-4 border">
      <div class="text-xs font-semibold text-gray-600 mb-3"><i class="fas fa-camera mr-1"></i>필수 사진 카테고리 설정</div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3" id="rp-photo-grid">
        ${defaultCategories.map(cat => `
          <div class="text-center p-3 bg-white rounded-lg border border-blue-200">
            <div class="text-[10px] text-gray-500 mb-1">${cat}</div>
            <input type="number" id="rp-photo-${cat}" class="w-16 mx-auto border rounded px-2 py-1 text-center text-lg font-bold" value="1" min="0" max="10">
          </div>`).join('')}
      </div>
      <details class="mt-3">
        <summary class="text-xs text-blue-600 cursor-pointer hover:underline"><i class="fas fa-plus-circle mr-1"></i>추가 카테고리 표시</summary>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          ${extraCategories.map(cat => `
            <div class="text-center p-3 bg-white rounded-lg border border-dashed border-gray-300">
              <div class="text-[10px] text-gray-400 mb-1">${cat}</div>
              <input type="number" id="rp-photo-${cat}" class="w-16 mx-auto border rounded px-2 py-1 text-center text-lg font-bold text-gray-400" value="0" min="0" max="10">
            </div>`).join('')}
        </div>
      </details>
    </div>

    <div class="flex items-center gap-4 bg-gray-50 rounded-lg p-3 border">
      <label class="flex items-center gap-2 cursor-pointer"><input id="rp-require-receipt" type="checkbox" checked class="w-4 h-4 rounded text-blue-600"><span class="text-sm font-medium">영수증 필수</span></label>
    </div>

    <div><label class="block text-xs text-gray-600 mb-1 font-semibold"><i class="fas fa-list-check mr-1"></i>체크리스트 항목 (줄바꿈 구분)</label>
      <textarea id="rp-checklist" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="작업완료확인&#10;고객서명확인&#10;현장정리확인">작업완료확인\n고객서명확인\n현장정리확인</textarea>
      <p class="text-[10px] text-gray-400 mt-1">각 줄이 하나의 체크리스트 항목이 됩니다. 팀장이 보고서 작성 시 체크해야 합니다.</p>
    </div>
  </div>`;

  showModal('<i class="fas fa-plus mr-2 text-emerald-600"></i>새 보고서 정책 버전', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitNewReportPolicy()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">생성</button>`, { large: true });
}

async function submitNewReportPolicy() {
  const name = document.getElementById('rp-name')?.value;
  if (!name) { showToast('정책명을 입력하세요.', 'warning'); return; }
  const allCats = ['BEFORE','AFTER','WASH','RECEIPT','INSTALL','LABEL','DAMAGE','EXTRA'];
  const photos = {};
  allCats.forEach(cat => {
    const val = +(document.getElementById(`rp-photo-${cat}`)?.value || 0);
    if (val > 0) photos[cat] = val;
  });
  if (Object.keys(photos).length === 0) photos.BEFORE = 1; // 최소 1개

  const checklist = document.getElementById('rp-checklist').value.split('\n').map(s=>s.trim()).filter(Boolean);
  await _policyApiAction('POST', '/stats/policies/report', {
    name, service_type: document.getElementById('rp-type').value || 'DEFAULT',
    required_photos_json: photos, required_checklist_json: checklist,
    require_receipt: document.getElementById('rp-require-receipt').checked,
  }, { successMsg: d => `새 버전 v${d.version} 생성 완료` });
}

// ── 수정 모달 ──
function showEditReportPolicyModal(p) {
  let photos = {};
  try { photos = typeof p.required_photos_json === 'string' ? JSON.parse(p.required_photos_json) : (p.required_photos_json || {}); } catch {}
  let checklist = [];
  try { checklist = typeof p.required_checklist_json === 'string' ? JSON.parse(p.required_checklist_json) : (p.required_checklist_json || []); } catch {}
  const allCats = ['BEFORE','AFTER','WASH','RECEIPT','INSTALL','LABEL','DAMAGE','EXTRA'];

  const content = `<div class="space-y-4">
    <div class="bg-gray-50 rounded-lg p-3 text-sm flex items-center gap-3">
      <span>정책 ID: <strong>#${p.policy_id}</strong></span>
      <span class="status-badge bg-gray-100 text-gray-700">${p.service_type||'DEFAULT'}</span>
    </div>
    <div><label class="block text-xs text-gray-600 mb-1 font-semibold">정책명</label>
      <input id="rp-edit-name" class="w-full border rounded-lg px-3 py-2 text-sm" value="${escapeHtml(p.name)}"></div>
    <div class="bg-gray-50 rounded-lg p-4 border">
      <div class="text-xs font-semibold text-gray-600 mb-2">사진 카테고리별 필수 매수</div>
      <div class="grid grid-cols-4 gap-2">
        ${allCats.map(cat => `<div class="text-center p-2 bg-white rounded border">
          <div class="text-[10px] text-gray-500">${cat}</div>
          <input type="number" id="rp-edit-photo-${cat}" class="w-14 mx-auto border rounded px-1 py-0.5 text-center font-bold text-sm" value="${photos[cat]||0}" min="0">
        </div>`).join('')}
      </div>
    </div>
    <label class="flex items-center gap-2"><input id="rp-edit-require" type="checkbox" ${p.require_receipt?'checked':''} class="w-4 h-4 rounded text-blue-600"><span class="text-sm">영수증 필수</span></label>
    <div><label class="block text-xs text-gray-600 mb-1">체크리스트</label>
      <textarea id="rp-edit-checklist" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm">${checklist.join('\n')}</textarea></div>
  </div>`;

  showModal(`보고서 정책 수정 — ${escapeHtml(p.name)}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitEditReportPolicy(${p.policy_id})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">저장</button>`, { large: true });
}

async function submitEditReportPolicy(id) {
  const allCats = ['BEFORE','AFTER','WASH','RECEIPT','INSTALL','LABEL','DAMAGE','EXTRA'];
  const photos = {};
  allCats.forEach(cat => { const v = +(document.getElementById(`rp-edit-photo-${cat}`)?.value||0); if (v > 0) photos[cat] = v; });
  const checklist = document.getElementById('rp-edit-checklist').value.split('\n').map(s=>s.trim()).filter(Boolean);
  await _policyApiAction('PUT', `/stats/policies/report/${id}`, {
    name: document.getElementById('rp-edit-name').value,
    required_photos_json: photos, required_checklist_json: checklist,
    require_receipt: document.getElementById('rp-edit-require').checked,
  }, { successMsg: '수정 완료' });
}
