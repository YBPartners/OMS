// ============================================================
// Airflow OMS — 가입신청 관리 + 추가지역 요청 관리 v5.0
// HR 탭: signup-requests, region-add
// ============================================================

// ─── 가입신청 목록 (HR 탭) ───
async function renderHRSignupRequests(el) {
  try {
  const params = new URLSearchParams(window._signupFilters || {});
  if (!params.has('limit')) params.set('limit', '20');
  const res = await api('GET', `/signup/requests?${params.toString()}`);
  const requests = res?.requests || [];
  const total = res?.total || 0;
  const pg = { page: res?.page || 1, limit: res?.limit || 20 };

  const statusOpts = [
    { value: 'PENDING', label: '대기중' },
    { value: 'APPROVED', label: '승인' },
    { value: 'REJECTED', label: '반려' },
  ];

  el.innerHTML = `
    ${renderFilterBar([
      { id: 'sr-status', label: '상태', type: 'select', options: statusOpts, value: params.get('status') || '' },
    ], 'applySignupFilter', `
      <span class="ml-auto text-sm text-gray-500">총 <strong>${total}</strong>건</span>
    `)}
    
    ${renderDataTable({
      columns: [
        { key: 'request_id', label: 'ID', render: r => `<span class="font-mono text-xs text-gray-500">${r.request_id}</span>` },
        { key: 'name', label: '신청자', render: r => `<span class="font-medium">${escapeHtml(r.name)}</span>` },
        { key: 'team_name', label: '팀명', render: r => `<span class="text-xs">${escapeHtml(r.team_name)}</span>` },
        { key: 'distributor_name', label: '총판', render: r => `<span class="text-xs">${escapeHtml(r.distributor_name)}</span>` },
        { key: 'region_count', label: '구역', align: 'center', render: r => r.region_count || 0 },
        { key: 'outside_region_count', label: '관할외', align: 'center', render: r => r.outside_region_count > 0 ? `<span class="text-amber-600 font-medium">${r.outside_region_count}</span>` : '-' },
        { key: 'conflict_count', label: '충돌', align: 'center', render: r => r.conflict_count > 0 ? `<span class="text-red-600 font-medium">${r.conflict_count}</span>` : '-' },
        { key: 'status', label: '상태', align: 'center', render: r => { const sBadge = r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : r.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'; const sLabel = r.status === 'APPROVED' ? '승인' : r.status === 'REJECTED' ? '반려' : '대기'; return `<span class="status-badge ${sBadge}">${sLabel}</span>`; } },
        { key: 'created_at', label: '신청일', render: r => `<span class="text-xs text-gray-500">${(r.created_at || '').split('T')[0]}</span>` },
        { key: '_actions', label: '관리', align: 'center', render: r => `
          <button onclick="showSignupDetail(${r.request_id})" class="px-2 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200" title="상세"><i class="fas fa-eye"></i></button>
          ${r.status === 'PENDING' ? `
            <button onclick="approveSignup(${r.request_id}, '${escapeHtml(r.name)}')" class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 ml-1" title="승인"><i class="fas fa-check"></i></button>
            <button onclick="rejectSignup(${r.request_id}, '${escapeHtml(r.name)}')" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 ml-1" title="반려"><i class="fas fa-times"></i></button>
          ` : ''}` },
      ],
      rows: requests,
      emptyText: '가입 신청이 없습니다.',
      caption: '가입신청 목록',
    })}
      ${total > pg.limit ? renderPagination(total, pg.page, pg.limit, 'goSignupPage') : ''}
    </div>`;

  } catch (e) {
  console.error('[renderHRSignupRequests]', e);
  el.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1 text-gray-400">' + (e.message||e) + '</p></div>';
  }
}

function applySignupFilter() {
  window._signupFilters = { status: document.getElementById('sr-status')?.value };
  Object.keys(window._signupFilters).forEach(k => { if (!window._signupFilters[k]) delete window._signupFilters[k]; });
  renderContent();
}

function goSignupPage(page) {
  window._signupFilters = { ...(window._signupFilters || {}), page };
  renderContent();
}

// ─── 가입신청 상세 모달 ───
async function showSignupDetail(requestId) {
  try {
  const res = await api('GET', `/signup/requests/${requestId}`);
  if (!res?.request) return showToast('상세 정보를 불러올 수 없습니다.', 'error');
  
  const r = res.request;
  const regions = res.regions || [];
  const regionAddReqs = res.region_add_requests || [];
  
  const sBadge = r.status === 'APPROVED' ? 'bg-green-100 text-green-700' 
    : r.status === 'REJECTED' ? 'bg-red-100 text-red-700' 
    : 'bg-yellow-100 text-yellow-700';
  const sLabel = r.status === 'APPROVED' ? '승인' : r.status === 'REJECTED' ? '반려' : '대기중';
  
  const content = `
    <div class="space-y-4">
      <!-- 기본 정보 -->
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div><span class="text-gray-500">신청번호:</span> <strong>#${r.request_id}</strong></div>
        <div><span class="text-gray-500">상태:</span> <span class="status-badge ${sBadge}">${sLabel}</span></div>
        <div><span class="text-gray-500">이름:</span> <strong>${r.name}</strong></div>
        <div><span class="text-gray-500">팀명:</span> ${r.team_name}</div>
        <div><span class="text-gray-500">로그인 ID:</span> <span class="font-mono">${r.login_id}</span></div>
        <div><span class="text-gray-500">전화번호:</span> ${r.phone}</div>
        <div><span class="text-gray-500">이메일:</span> ${r.email || '<span class="text-gray-400">미입력</span>'}</div>
        <div><span class="text-gray-500">총판:</span> ${r.distributor_name} (${r.distributor_code})</div>
        <div><span class="text-gray-500">신청일:</span> ${(r.created_at || '').replace('T', ' ').slice(0,16)}</div>
        ${r.commission_mode ? `<div><span class="text-gray-500">수수료:</span> ${r.commission_mode === 'PERCENT' ? r.commission_value + '%' : r.commission_value?.toLocaleString() + '원'}</div>` : ''}
        ${r.reject_reason ? `<div class="col-span-2 p-2 bg-red-50 rounded border border-red-200 text-red-700"><i class="fas fa-exclamation-triangle mr-1"></i>반려사유: ${r.reject_reason}</div>` : ''}
        ${r.reviewed_at ? `<div><span class="text-gray-500">처리일:</span> ${(r.reviewed_at || '').replace('T', ' ').slice(0,16)}</div>` : ''}
        ${r.created_org_id ? `<div><span class="text-gray-500">생성된 조직:</span> <strong>org#${r.created_org_id}</strong></div>` : ''}
        ${r.created_user_id ? `<div><span class="text-gray-500">생성된 사용자:</span> <strong>user#${r.created_user_id}</strong></div>` : ''}
      </div>
      
      <!-- 선택 구역 -->
      <div>
        <h4 class="text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-map-marker-alt mr-1 text-indigo-500"></i>선택 구역 (${regions.length}개)</h4>
        <div class="max-h-40 overflow-y-auto border rounded">
          ${renderDataTable({ columns: [
            { key: 'sido', label: '시/도' },
            { key: 'sigungu', label: '시/군/구' },
            { key: 'eupmyeondong', label: '읍/면/동' },
            { key: 'is_within_distributor', label: '관할내', align: 'center', render: rg => rg.is_within_distributor ? '<i class="fas fa-check text-green-500"></i>' : '<i class="fas fa-exclamation-triangle text-amber-500"></i>' }
          ], rows: regions, compact: true, noBorder: true,
             rowClass: rg => rg.is_within_distributor ? '' : 'bg-amber-50' })}
        </div>
      </div>
      
      <!-- 추가 지역 요청 -->
      ${regionAddReqs.length > 0 ? `
      <div>
        <h4 class="text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-plus-circle mr-1 text-amber-500"></i>추가 지역 요청 (${regionAddReqs.length}건)</h4>
        <div class="space-y-2">
          ${regionAddReqs.map(ar => {
            const arBadge = ar.status === 'APPROVED' ? 'bg-green-100 text-green-700' 
              : ar.status === 'REJECTED' ? 'bg-red-100 text-red-700'
              : ar.status === 'CONFLICT' ? 'bg-orange-100 text-orange-700' 
              : 'bg-yellow-100 text-yellow-700';
            const arLabel = ar.status === 'APPROVED' ? '승인' : ar.status === 'REJECTED' ? '반려' : ar.status === 'CONFLICT' ? '충돌' : '대기';
            return `
              <div class="flex items-center justify-between p-2 border rounded text-xs ${ar.status === 'CONFLICT' ? 'border-orange-200 bg-orange-50' : ''}">
                <div>
                  <span class="font-medium">${ar.region_name || `${ar.sido} ${ar.sigungu} ${ar.eupmyeondong}`}</span>
                  ${ar.conflict_org_name ? `<span class="text-orange-600 ml-1">(충돌: ${ar.conflict_org_name})</span>` : ''}
                </div>
                <span class="status-badge ${arBadge}">${arLabel}</span>
              </div>`;
          }).join('')}
        </div>
      </div>` : ''}
    </div>`;
  
  let footer = `<button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`;
  if (r.status === 'PENDING') {
    footer += `
      <button onclick="closeModal();approveSignup(${r.request_id}, '${r.name}')" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm"><i class="fas fa-check mr-1"></i>승인</button>
      <button onclick="closeModal();rejectSignup(${r.request_id}, '${r.name}')" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm"><i class="fas fa-times mr-1"></i>반려</button>
    `;
  }
  
  showModal(`가입 신청 상세 — #${requestId}`, content, footer, { large: true });

  } catch (e) {
  console.error('[showSignupDetail]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ─── 가입 승인 ───
function approveSignup(requestId, name) {
  showConfirmModal('가입 승인', `
    <strong>${name}</strong>님의 가입을 승인하시겠습니까?<br>
    <span class="text-sm text-gray-500">조직, 사용자, 역할이 자동으로 생성됩니다.</span>
  `, async () => {
    const res = await api('POST', `/signup/requests/${requestId}/approve`, {});
    if (res?.ok) {
      showToast(res.message || '승인 완료', 'success');
      // 생성 결과 안내
      showModal('승인 완료', `
        <div class="p-4 bg-green-50 rounded-lg border border-green-200 space-y-2 text-sm">
          <p class="font-semibold text-green-800"><i class="fas fa-check-circle mr-1"></i>가입 승인 성공</p>
          <div><span class="text-gray-500">로그인 ID:</span> <strong class="font-mono">${res.login_id}</strong></div>
          <div><span class="text-gray-500">조직 ID:</span> <strong>${res.created_org_id}</strong></div>
          <div><span class="text-gray-500">팀 코드:</span> <strong class="font-mono">${res.team_code}</strong></div>
          <div><span class="text-gray-500">사용자 ID:</span> <strong>${res.created_user_id}</strong></div>
        </div>
      `, `<button onclick="closeModal();renderContent()" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">확인</button>`);
    } else showToast(res?.error || '승인 실패', 'error');
  }, '승인', 'bg-green-600');
}

// ─── 가입 반려 ───
function rejectSignup(requestId, name) {
  const content = `
    <div class="space-y-3">
      <p class="text-sm text-gray-600"><strong>${name}</strong>님의 가입을 반려합니다.</p>
      <div>
        <label class="block text-xs text-gray-500 mb-1">반려 사유 <span class="text-red-500">*</span></label>
        <textarea id="reject-reason" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="반려 사유를 입력하세요."></textarea>
      </div>
    </div>`;
  showModal('가입 반려', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitRejectSignup(${requestId})" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm"><i class="fas fa-times mr-1"></i>반려</button>
  `);
}

async function submitRejectSignup(requestId) {
  try {
  const reason = document.getElementById('reject-reason')?.value?.trim();
  if (!reason) return showToast('반려 사유를 입력하세요.', 'warning');
  const res = await api('POST', `/signup/requests/${requestId}/reject`, { reason });
  if (res?.ok) {
    showToast(res.message || '반려 완료', 'success');
    closeModal();
    renderContent();
  } else showToast(res?.error || '반려 실패', 'error');

  } catch (e) {
  console.error('[submitRejectSignup]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 추가 지역 요청 관리
// ═══════════════════════════════════════════════════════════════

async function renderHRRegionAddRequests(el) {
  try {
  const params = new URLSearchParams(window._regionAddFilters || {});
  if (!params.has('limit')) params.set('limit', '20');
  const res = await api('GET', `/signup/region-add-requests?${params.toString()}`);
  const requests = res?.requests || [];
  const total = res?.total || 0;
  const pg = { page: res?.page || 1, limit: res?.limit || 20 };

  const statusOpts = [
    { value: 'PENDING', label: '대기중' },
    { value: 'CONFLICT', label: '충돌' },
    { value: 'APPROVED', label: '승인' },
    { value: 'REJECTED', label: '반려' },
  ];

  el.innerHTML = `
    ${renderFilterBar([
      { id: 'ra-status', label: '상태', type: 'select', options: statusOpts, value: params.get('status') || '' },
    ], 'applyRegionAddFilter', `
      <span class="ml-auto text-sm text-gray-500">총 <strong>${total}</strong>건</span>
    `)}
    
    ${renderDataTable({
      columns: [
        { key: 'request_id', label: 'ID', render: r => `<span class="font-mono text-xs text-gray-500">${r.request_id}</span>` },
        { key: 'applicant_name', label: '신청자/팀', render: r => `<div class="text-xs">${escapeHtml(r.applicant_name || '-')}</div><div class="text-[10px] text-gray-400">${escapeHtml(r.team_name || '')}</div>` },
        { key: 'region', label: '요청 구역', render: r => `<span class="text-xs">${escapeHtml(r.sido)} ${escapeHtml(r.sigungu)}<br><span class="text-gray-500">${escapeHtml(r.eupmyeondong)}</span></span>` },
        { key: 'distributor_name', label: '총판', render: r => `<span class="text-xs">${escapeHtml(r.distributor_name)}</span>` },
        { key: 'conflict', label: '충돌', align: 'center', render: r => r.conflict_org_name ? `<span class="text-orange-600 text-xs" title="${escapeHtml(r.conflict_detail || '')}">${escapeHtml(r.conflict_org_name)}</span>` : '-' },
        { key: 'status', label: '상태', align: 'center', render: r => { const sBadge = r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : r.status === 'REJECTED' ? 'bg-red-100 text-red-700' : r.status === 'CONFLICT' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'; const sLabel = r.status === 'APPROVED' ? '승인' : r.status === 'REJECTED' ? '반려' : r.status === 'CONFLICT' ? '충돌' : '대기'; return `<span class="status-badge ${sBadge}">${sLabel}</span>`; } },
        { key: '_actions', label: '관리', align: 'center', render: r => r.status === 'PENDING' || r.status === 'CONFLICT' ? `
          <button onclick="approveRegionAdd(${r.request_id}, ${r.status === 'CONFLICT'}, '${escapeHtml((r.conflict_org_name||'').replace(/'/g, "\\'"))}')" class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200" title="승인"><i class="fas fa-check"></i></button>
          <button onclick="rejectRegionAdd(${r.request_id})" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 ml-1" title="반려"><i class="fas fa-times"></i></button>
        ` : `<button onclick="showRegionAddDetail(${r.request_id})" class="px-2 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200"><i class="fas fa-eye"></i></button>` },
      ],
      rows: requests,
      emptyText: '추가 지역 요청이 없습니다.',
      caption: '추가지역 요청 목록',
    })}
      ${total > pg.limit ? renderPagination(total, pg.page, pg.limit, 'goRegionAddPage') : ''}
    </div>`;

  } catch (e) {
  console.error('[renderHRRegionAddRequests]', e);
  el.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1 text-gray-400">' + (e.message||e) + '</p></div>';
  }
}

function applyRegionAddFilter() {
  window._regionAddFilters = { status: document.getElementById('ra-status')?.value };
  Object.keys(window._regionAddFilters).forEach(k => { if (!window._regionAddFilters[k]) delete window._regionAddFilters[k]; });
  renderContent();
}

function goRegionAddPage(page) {
  window._regionAddFilters = { ...(window._regionAddFilters || {}), page };
  renderContent();
}

function approveRegionAdd(requestId, isConflict, conflictOrgName) {
  if (isConflict) {
    showConfirmModal('충돌 구역 승인', `
      <div class="space-y-2">
        <p class="text-sm">이 구역은 <strong class="text-orange-600">${conflictOrgName}</strong>에 이미 매핑되어 있습니다.</p>
        <p class="text-sm text-gray-600">승인 시 기존 매핑을 해제하고 새 총판에 매핑합니다.</p>
        <label class="flex items-center gap-2 mt-3 p-2 bg-orange-50 rounded border border-orange-200">
          <input type="checkbox" id="ra-remove-conflict" checked class="rounded text-orange-600">
          <span class="text-sm">기존 매핑 해제 후 승인</span>
        </label>
      </div>
    `, async () => {
      const removeConflict = document.getElementById('ra-remove-conflict')?.checked;
      const res = await api('POST', `/signup/region-add-requests/${requestId}/approve`, { remove_conflict: removeConflict });
      if (res?.ok) { showToast('승인 완료', 'success'); renderContent(); }
      else showToast(res?.error || '승인 실패', 'error');
    }, '승인', 'bg-green-600');
  } else {
    showConfirmModal('추가 지역 승인', '이 구역을 총판에 매핑하시겠습니까?', async () => {
      const res = await api('POST', `/signup/region-add-requests/${requestId}/approve`, {});
      if (res?.ok) { showToast('승인 완료', 'success'); renderContent(); }
      else showToast(res?.error || '승인 실패', 'error');
    }, '승인', 'bg-green-600');
  }
}

function rejectRegionAdd(requestId) {
  const content = `
    <div><label class="block text-xs text-gray-500 mb-1">반려 사유 <span class="text-red-500">*</span></label>
      <textarea id="ra-reject-reason" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="반려 사유를 입력하세요."></textarea>
    </div>`;
  showModal('추가 지역 반려', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitRejectRegionAdd(${requestId})" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">반려</button>
  `);
}

async function submitRejectRegionAdd(requestId) {
  try {
  const reason = document.getElementById('ra-reject-reason')?.value?.trim();
  if (!reason) return showToast('반려 사유를 입력하세요.', 'warning');
  const res = await api('POST', `/signup/region-add-requests/${requestId}/reject`, { reason });
  if (res?.ok) { showToast('반려 완료', 'success'); closeModal(); renderContent(); }
  else showToast(res?.error || '반려 실패', 'error');

  } catch (e) {
  console.error('[submitRejectRegionAdd]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

async function showRegionAddDetail(requestId) {
  try {
  const res = await api('GET', `/signup/region-add-requests/${requestId}`);
  if (!res?.request) return showToast('상세 정보를 불러올 수 없습니다.', 'error');
  const r = res.request;
  const mappings = res.current_mappings || [];
  
  const content = `
    <div class="space-y-3 text-sm">
      <div class="grid grid-cols-2 gap-3">
        <div><span class="text-gray-500">요청 ID:</span> <strong>#${r.request_id}</strong></div>
        <div><span class="text-gray-500">상태:</span> <span class="font-medium">${r.status}</span></div>
        <div><span class="text-gray-500">구역:</span> ${r.sido} ${r.sigungu} ${r.eupmyeondong}</div>
        <div><span class="text-gray-500">총판:</span> ${r.distributor_name}</div>
        <div><span class="text-gray-500">신청자:</span> ${r.applicant_name || '-'} / ${r.team_name || '-'}</div>
        ${r.reject_reason ? `<div class="col-span-2 p-2 bg-red-50 rounded border border-red-200 text-red-700">반려사유: ${r.reject_reason}</div>` : ''}
      </div>
      ${mappings.length > 0 ? `
        <div>
          <h4 class="font-semibold text-gray-700 mb-1">현재 매핑된 조직</h4>
          ${mappings.map(m => `<div class="p-2 bg-gray-50 rounded text-xs">${m.org_name} (${m.org_type}) — ${m.org_code || ''}</div>`).join('')}
        </div>
      ` : ''}
    </div>`;
  showModal(`추가 지역 요청 상세 — #${requestId}`, content, `<button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`);

  } catch (e) {
  console.error('[showRegionAddDetail]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 조직 트리 뷰 (HQ → REGION → TEAM)
// ═══════════════════════════════════════════════════════════════

async function renderHROrgTree(el) {
  try {
  const res = await api('GET', '/hr/distributors/tree');
  const tree = res?.tree || [];
  
  el.innerHTML = `
    <div class="bg-white rounded-xl p-4 mb-4 border border-gray-100">
      <h3 class="text-sm font-semibold text-gray-700 mb-3"><i class="fas fa-sitemap mr-2 text-indigo-500"></i>조직 트리 (HQ → 총판 → 팀)</h3>
      <div class="space-y-3" id="org-tree-view">
        ${tree.length > 0 ? tree.map(org => renderTreeNode(org, 0)).join('') : '<p class="text-gray-400 text-sm text-center py-4">조직 데이터를 불러오는 중...</p>'}
      </div>
    </div>
    
    <!-- 폴백: 직접 API로 트리 구성 -->
    ${tree.length === 0 ? '<div id="org-tree-fallback"></div>' : ''}
  `;
  
  if (tree.length === 0) {
    await loadOrgTreeFallback(el);
  }

  } catch (e) {
  console.error('[renderHROrgTree]', e);
  el.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1 text-gray-400">' + (e.message||e) + '</p></div>';
  }
}

function renderTreeNode(org, depth) {
  const indent = depth * 24;
  const colors = { HQ: 'blue', REGION: 'purple', TEAM: 'green' };
  const icons = { HQ: 'fa-building', REGION: 'fa-map-location-dot', TEAM: 'fa-users' };
  const c = colors[org.org_type] || 'gray';
  const ic = icons[org.org_type] || 'fa-circle';
  const children = org.children || [];
  
  return `
    <div style="margin-left:${indent}px" class="border-l-2 border-${c}-200 pl-3 py-1">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 bg-${c}-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <i class="fas ${ic} text-${c}-600 text-xs"></i>
        </div>
        <div class="flex-1 min-w-0">
          <span class="text-sm font-medium">${org.name}</span>
          <span class="text-[10px] text-gray-400 ml-1">${org.org_type}${org.code ? ' · ' + org.code : ''}</span>
        </div>
        ${org.member_count !== undefined ? `<span class="text-xs text-gray-400">${org.member_count}명</span>` : ''}
        <span class="status-badge ${org.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} text-[10px]">${org.status}</span>
      </div>
      ${children.map(ch => renderTreeNode(ch, depth + 1)).join('')}
    </div>`;
}

async function loadOrgTreeFallback(el) {
  try {
  // org 목록에서 직접 트리 구성
  const res = await api('GET', '/hr/organizations');
  const orgs = res?.organizations || [];
  
  if (orgs.length === 0) return;
  
  // 트리 구성
  const hq = orgs.filter(o => o.org_type === 'HQ');
  const regions = orgs.filter(o => o.org_type === 'REGION');
  const teams = orgs.filter(o => o.org_type === 'TEAM');
  
  const treeEl = document.getElementById('org-tree-view');
  if (!treeEl) return;
  
  let html = '';
  hq.forEach(h => {
    html += renderTreeNode({
      ...h,
      children: regions.map(r => ({
        ...r,
        children: teams.filter(t => t.parent_org_id === r.org_id).map(t => ({ ...t, children: [] }))
      }))
    }, 0);
  });
  
  treeEl.innerHTML = html || '<p class="text-gray-400 text-sm text-center py-4">조직이 없습니다.</p>';

  } catch (e) {
  console.error('[loadOrgTreeFallback]', e);
  el.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1 text-gray-400">' + (e.message||e) + '</p></div>';
  }
}
