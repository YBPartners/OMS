// ============================================================
// Airflow OMS — 시군구 매핑 탭 v11.0 (REFACTOR-1 시군구 전환)
// 시도 드릴다운, 일괄매핑/해제, 전국 검색, CSV 내보내기
// ============================================================

function renderTerritoryTab(territories) {
  const canEditPolicy = canEdit('policy');
  const mapped = territories.filter(t => t.org_name);
  const unmapped = territories.filter(t => !t.org_name);
  const mappingRate = territories.length ? Math.round(mapped.length / territories.length * 100) : 0;

  // 시도별 집계
  const sidoMap = {};
  territories.forEach(t => {
    const s = t.sido || '미분류';
    if (!sidoMap[s]) sidoMap[s] = { total: 0, mapped: 0 };
    sidoMap[s].total++;
    if (t.org_name) sidoMap[s].mapped++;
  });

  const filterSido = window._terrFilterSido || '';
  const filterStatus = window._terrFilterStatus || ''; // '', 'mapped', 'unmapped'
  let filtered = territories;
  if (filterSido) filtered = filtered.filter(t => t.sido === filterSido);
  if (filterStatus === 'mapped') filtered = filtered.filter(t => t.org_name);
  if (filterStatus === 'unmapped') filtered = filtered.filter(t => !t.org_name);

  const sidos = [...new Set(territories.map(t => t.sido).filter(Boolean))].sort();

  return `
    <div class="space-y-4">
      <!-- 매핑 현황 요약 -->
      <div class="bg-white rounded-xl p-5 border border-gray-100">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-semibold text-lg"><i class="fas fa-map-location-dot mr-2 text-rose-500"></i>시군구 매핑 현황</h3>
            <p class="text-xs text-gray-500 mt-1">주문 자동 배분을 위한 시군구-총판 매핑을 관리합니다.</p>
          </div>
          <div class="flex gap-2">
            ${canEditPolicy ? `<button onclick="showBulkMappingModal()" class="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700"><i class="fas fa-layer-group mr-1"></i>일괄 매핑</button>` : ''}
            <button onclick="exportTerritoryCSV()" class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200"><i class="fas fa-download mr-1"></i>CSV</button>
            <button onclick="showTerritorySearchModal()" class="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs hover:bg-blue-200"><i class="fas fa-search mr-1"></i>검색</button>
          </div>
        </div>

        <!-- 매핑률 + 통계 -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div class="bg-gradient-to-r from-rose-50 to-pink-50 rounded-lg p-3 border border-rose-100">
            <div class="text-[10px] text-gray-500 mb-1">전체 시군구</div>
            <div class="text-2xl font-bold text-gray-800">${territories.length}</div>
          </div>
          <div class="bg-green-50 rounded-lg p-3 border border-green-100 cursor-pointer hover:shadow-sm" onclick="window._terrFilterStatus='mapped';renderContent()">
            <div class="text-[10px] text-gray-500 mb-1">매핑 완료</div>
            <div class="text-2xl font-bold text-green-700">${mapped.length}</div>
          </div>
          <div class="bg-red-50 rounded-lg p-3 border border-red-100 cursor-pointer hover:shadow-sm" onclick="window._terrFilterStatus='unmapped';renderContent()">
            <div class="text-[10px] text-gray-500 mb-1">미매핑</div>
            <div class="text-2xl font-bold text-red-700">${unmapped.length}</div>
          </div>
          <div class="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div class="text-[10px] text-gray-500 mb-1">매핑률</div>
            <div class="text-2xl font-bold text-blue-700">${mappingRate}%</div>
            <div class="w-full bg-gray-200 rounded-full h-1.5 mt-1"><div class="bg-blue-600 h-1.5 rounded-full" style="width:${mappingRate}%"></div></div>
          </div>
        </div>

        <!-- 시도별 드릴다운 -->
        <div class="mb-4">
          <div class="text-xs font-semibold text-gray-600 mb-2"><i class="fas fa-earth-asia mr-1"></i>시도별 매핑 현황 <span class="text-gray-400 font-normal">(클릭하면 필터)</span></div>
          <div class="flex flex-wrap gap-1.5">
            <button onclick="window._terrFilterSido='';window._terrFilterStatus='';renderContent()" class="px-2.5 py-1 rounded-full text-xs ${!filterSido?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'} transition">전체</button>
            ${sidos.map(s => {
              const info = sidoMap[s] || { total: 0, mapped: 0 };
              const pct = info.total ? Math.round(info.mapped / info.total * 100) : 0;
              const color = pct === 100 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
              const isActive = filterSido === s;
              return `<button onclick="window._terrFilterSido='${s}';renderContent()" class="px-2.5 py-1 rounded-full text-xs ${isActive ? 'bg-blue-600 text-white ring-2 ring-blue-300' : color + ' hover:opacity-80'} transition">${s} ${info.mapped}/${info.total}</button>`;
            }).join('')}
          </div>
        </div>

        <!-- 상태 필터 -->
        <div class="flex gap-2 mb-3">
          ${[{id:'', label:'전체', cnt:territories.length}, {id:'mapped', label:'매핑완료', cnt:mapped.length}, {id:'unmapped', label:'미매핑', cnt:unmapped.length}].map(f =>
            `<button onclick="window._terrFilterStatus='${f.id}';renderContent()" class="px-3 py-1 rounded-lg text-xs ${filterStatus===f.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} transition">${f.label} (${f.cnt})</button>`
          ).join('')}
          ${filterSido ? `<span class="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs"><i class="fas fa-filter mr-1"></i>${filterSido} <button onclick="window._terrFilterSido='';renderContent()" class="ml-1 text-blue-400 hover:text-blue-600">×</button></span>` : ''}
        </div>

        <!-- 테이블 -->
        ${renderDataTable({ columns: [
          { key: 'code', label: 'ID', render: t => `<span class="font-mono text-xs text-gray-500">${t.code}</span>` },
          { key: 'sido', label: '시도', render: t => `<button onclick="window._terrFilterSido='${t.sido}';renderContent()" class="text-xs text-blue-600 hover:underline">${t.sido||'-'}</button>` },
          { key: 'sigungu', label: '시군구', render: t => `<span class="text-xs">${t.sigungu||'-'}</span>` },
          { key: 'eupmyeondong', label: '읍면동', render: t => `<span class="text-xs">${t.eupmyeondong||'-'}</span>` },
          { key: 'code', label: '시군구코드', render: t => `<span class="font-mono text-[10px] text-gray-400">${t.code||'-'}</span>` },
          { key: 'org_name', label: '매핑 조직', render: t => t.org_name ? `<span class="status-badge bg-green-100 text-green-700">${escapeHtml(t.org_name)}</span>` : `<span class="status-badge bg-red-100 text-red-700">미매핑</span>` },
          { key: '_actions', label: '관리', align: 'center', show: canEditPolicy, render: t => `
            <button onclick="showTerritoryMappingModal(${t.territory_id})" class="px-2 py-1 ${t.org_name ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'} rounded text-xs hover:opacity-80">${t.org_name ? '<i class="fas fa-edit"></i>' : '<i class="fas fa-link"></i> 매핑'}</button>
            ${t.org_name ? `<button onclick="unmapTerritory(${t.territory_id})" class="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100 ml-1"><i class="fas fa-unlink"></i></button>` : ''}
          ` }
        ], rows: filtered, compact: true, noBorder: true, emptyText: filterSido || filterStatus ? '조건에 맞는 시군구가 없습니다.' : '시군구 데이터가 없습니다.' })}
      </div>
    </div>`;
}

// ── 시군구 검색 모달 ──
async function showTerritorySearchModal() {
  const content = `<div class="space-y-3">
    <div class="flex gap-2">
      <input id="terr-search-q" class="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="읍면동/시군구/시도 검색..." oninput="_terrSearchDebounce()">
      <select id="terr-search-sido" class="border rounded-lg px-3 py-2 text-sm" onchange="_terrSearchFilter()">
        <option value="">전체 시도</option>
        ${[...new Set((window._cachedTerritories||[]).map(t=>t.sido).filter(Boolean))].sort().map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>
    <div id="terr-search-results" class="max-h-[50vh] overflow-y-auto"><div class="text-center text-gray-400 py-8 text-sm">검색어를 입력하세요</div></div>
  </div>`;
  showModal('<i class="fas fa-search mr-2 text-blue-600"></i>시군구 검색', content, `<button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`, { large: true });
}

let _terrSearchTimer = null;
function _terrSearchDebounce() { clearTimeout(_terrSearchTimer); _terrSearchTimer = setTimeout(_terrSearchFilter, 300); }

async function _terrSearchFilter() {
  const q = document.getElementById('terr-search-q')?.value?.trim();
  const sido = document.getElementById('terr-search-sido')?.value;
  const el = document.getElementById('terr-search-results');
  if (!el) return;
  if (!q && !sido) { el.innerHTML = '<div class="text-center text-gray-400 py-8 text-sm">검색어를 입력하세요</div>'; return; }
  el.innerHTML = '<div class="text-center py-4 text-gray-400"><i class="fas fa-spinner fa-spin mr-1"></i>검색 중...</div>';
  try {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (sido) params.set('sido', sido);
    const res = await api('GET', `/stats/territories/search?${params}`);
    const list = res?.territories || [];
    if (!list.length) { el.innerHTML = '<div class="text-center text-gray-400 py-8 text-sm">검색 결과가 없습니다.</div>'; return; }
    el.innerHTML = `<div class="text-xs text-gray-400 mb-2">${list.length}건</div><div class="space-y-1">${list.map(t => `
      <div class="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
        <div class="flex-1 min-w-0">
          <span class="font-mono text-[10px] text-gray-400 mr-1">${t.code}</span>
          <span class="text-sm font-medium">${escapeHtml(t.sido||'')} ${escapeHtml(t.sigungu||'')}</span>
        </div>
        <div class="shrink-0 ml-2">${t.org_name ? `<span class="status-badge bg-green-100 text-green-700 text-[10px]">${escapeHtml(t.org_name)}</span>` : `<button onclick="showTerritoryMappingModal(${t.territory_id})" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"><i class="fas fa-link mr-1"></i>매핑</button>`}</div>
      </div>`).join('')}</div>`;
  } catch (e) { el.innerHTML = `<div class="text-red-500 text-sm">${e.message||e}</div>`; }
}

// ── 단건 매핑 모달 ──
async function showTerritoryMappingModal(territoryId) {
  const t = (window._cachedTerritories||[]).find(x => x.territory_id === territoryId);
  if (!t) { showToast('시군구을 찾을 수 없습니다.', 'error'); return; }
  const orgsRes = await api('GET', '/auth/organizations');
  const orgs = (orgsRes?.organizations || []).filter(o => o.org_type === 'REGION');

  const content = `<div class="space-y-4">
    <div class="bg-gray-50 rounded-lg p-3 text-sm">
      <div><strong>${escapeHtml(t.sido||'')} ${escapeHtml(t.sigungu||'')}</strong></div>
      <div class="text-xs text-gray-400 mt-1">시군구코드: ${t.code||'-'}</div>
      ${t.org_name ? `<div class="mt-2 text-xs">현재 매핑: <span class="status-badge bg-green-100 text-green-700">${escapeHtml(t.org_name)}</span></div>` : '<div class="mt-2 text-xs text-red-500"><i class="fas fa-exclamation-triangle mr-1"></i>현재 미매핑 상태</div>'}
    </div>
    <div><label class="block text-xs text-gray-600 mb-1 font-semibold">매핑할 조직 (지역총판) *</label>
      <select id="terr-map-org" class="w-full border rounded-lg px-3 py-2 text-sm">
        <option value="">-- 조직 선택 --</option>
        ${orgs.map(o => `<option value="${o.org_id}" ${t.org_id === o.org_id ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}
      </select>
    </div>
  </div>`;

  showModal(`<i class="fas fa-link mr-2 text-blue-600"></i>시군구 매핑 — #${territoryId}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitTerritoryMapping(${territoryId})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">매핑 저장</button>`);
}

async function submitTerritoryMapping(territoryId) {
  const orgId = document.getElementById('terr-map-org')?.value;
  if (!orgId) { showToast('조직을 선택하세요.', 'warning'); return; }
  await _policyApiAction('PUT', `/stats/territories/${territoryId}/mapping`, { org_id: Number(orgId) }, { successMsg: '매핑 완료' });
}

// ── 매핑 해제 ──
function unmapTerritory(territoryId) {
  showConfirmModal('매핑 해제', `시군구 #${territoryId}의 조직 매핑을 해제하시겠습니까?\n해제 후 해당 지역의 주문은 자동 배분되지 않습니다.`, async () => {
    try {
      const res = await api('PUT', `/stats/territories/${territoryId}/mapping`, { org_id: null });
      if (res?.ok) { showToast('매핑 해제 완료', 'success'); renderContent(); }
      else showToast(res?.error || '해제 실패', 'error');
    } catch (e) { showToast('해제 실패: ' + (e.message||e), 'error'); }
  }, '해제', 'bg-red-600');
}

// ── 일괄 매핑 모달 ──
async function showBulkMappingModal() {
  // 시도 목록 + 조직 목록 로드
  const [sidoRes, orgsRes] = await Promise.all([
    api('GET', '/stats/territories/sido-stats'),
    api('GET', '/auth/organizations'),
  ]);
  const sidos = sidoRes?.sido_stats || [];
  const orgs = (orgsRes?.organizations || []).filter(o => o.org_type === 'REGION');

  const content = `<div class="space-y-4">
    <div class="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-700"><i class="fas fa-info-circle mr-1"></i>시도와 시군구를 선택하면 해당 지역의 <strong>미매핑</strong> 시군구을 선택한 조직에 일괄 매핑합니다.</div>

    <div class="grid grid-cols-2 gap-3">
      <div><label class="block text-xs text-gray-600 mb-1 font-semibold">대상 조직 (지역총판) *</label>
        <select id="bulk-org" class="w-full border rounded-lg px-3 py-2 text-sm">
          ${orgs.map(o => `<option value="${o.org_id}">${escapeHtml(o.name)}</option>`).join('')}
        </select></div>
      <div><label class="block text-xs text-gray-600 mb-1 font-semibold">시도 선택 *</label>
        <select id="bulk-sido" class="w-full border rounded-lg px-3 py-2 text-sm" onchange="_loadBulkSigungu()">
          <option value="">-- 시도 선택 --</option>
          ${sidos.map(s => `<option value="${s.sido}">${s.sido} (전체 ${s.total}, 미매핑 ${s.unmapped})</option>`).join('')}
        </select></div>
    </div>

    <div id="bulk-sigungu-area" class="hidden">
      <label class="block text-xs text-gray-600 mb-1 font-semibold">시군구 선택 <span class="font-normal text-gray-400">(비우면 시도 전체)</span></label>
      <div id="bulk-sigungu-list" class="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-lg border"></div>
    </div>

    <div id="bulk-preview" class="bg-gray-50 rounded-lg p-3 text-sm text-gray-500 text-center">시도를 선택하면 매핑 대상이 표시됩니다.</div>

    <button onclick="_executeBulkMapping()" class="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition"><i class="fas fa-layer-group mr-1"></i>일괄 매핑 실행</button>
  </div>`;

  showModal('<i class="fas fa-layer-group mr-2 text-indigo-600"></i>시군구 일괄 매핑', content, `<button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`, { large: true });
}

async function _loadBulkSigungu() {
  const sido = document.getElementById('bulk-sido')?.value;
  const area = document.getElementById('bulk-sigungu-area');
  const list = document.getElementById('bulk-sigungu-list');
  const preview = document.getElementById('bulk-preview');
  if (!sido || !area || !list) return;

  area.classList.remove('hidden');
  list.innerHTML = '<span class="text-gray-400 text-xs"><i class="fas fa-spinner fa-spin mr-1"></i>로딩...</span>';

  try {
    const res = await api('GET', `/stats/territories/sigungu?sido=${encodeURIComponent(sido)}`);
    const sigungus = res?.sigungu_list || res?.sigungu_stats || [];
    list.innerHTML = `
      <label class="flex items-center gap-1 px-2 py-1 rounded bg-white border cursor-pointer">
        <input type="checkbox" class="bulk-sigungu-chk" value="" checked onchange="_updateBulkPreview()"><span class="text-xs font-bold">전체</span>
      </label>
      ${sigungus.map(s => `
        <label class="flex items-center gap-1 px-2 py-1 rounded bg-white border cursor-pointer hover:bg-gray-50">
          <input type="checkbox" class="bulk-sigungu-chk" value="${s.sigungu}" onchange="_updateBulkPreview()">
          <span class="text-xs">${s.sigungu} <span class="text-gray-400">(${s.total - (s.mapped||0)}/${s.total})</span></span>
        </label>`).join('')}`;

    _updateBulkPreview();
  } catch (e) { list.innerHTML = `<span class="text-red-500 text-xs">${e.message||e}</span>`; }
}

function _updateBulkPreview() {
  const sido = document.getElementById('bulk-sido')?.value || '';
  const checks = [...document.querySelectorAll('.bulk-sigungu-chk:checked')].map(c => c.value);
  const el = document.getElementById('bulk-preview');
  if (!el) return;

  const all = window._cachedTerritories || [];
  let target = all.filter(t => t.sido === sido && !t.org_name);
  if (checks.length && !checks.includes('')) {
    target = target.filter(t => checks.includes(t.sigungu));
  }
  window._bulkTargetIds = target.map(t => t.territory_id);
  el.innerHTML = target.length
    ? `<div class="text-left"><div class="text-indigo-700 font-bold mb-1"><i class="fas fa-map-pin mr-1"></i>${target.length}개 시군구을 일괄 매핑합니다</div><div class="text-[10px] text-gray-400 max-h-20 overflow-y-auto">${target.slice(0, 20).map(t => `${t.sido} ${t.sigungu} ${t.eupmyeondong||''}`).join(', ')}${target.length > 20 ? ` 외 ${target.length - 20}건` : ''}</div></div>`
    : '<span class="text-gray-400">매핑할 미매핑 시군구이 없습니다.</span>';
}

async function _executeBulkMapping() {
  const orgId = +document.getElementById('bulk-org')?.value;
  const ids = window._bulkTargetIds || [];
  if (!orgId) { showToast('조직을 선택하세요.', 'warning'); return; }
  if (!ids.length) { showToast('매핑 대상이 없습니다.', 'warning'); return; }

  try {
    const res = await api('POST', '/stats/territories/bulk-mapping', { org_id: orgId, territory_ids: ids });
    if (res?.ok) {
      showToast(`일괄 매핑 완료: ${res.mapped}건 성공${res.skipped ? ', ' + res.skipped + '건 건너뜀' : ''}`, 'success');
      closeModal();
      renderContent();
    } else showToast(res?.error || '일괄 매핑 실패', 'error');
  } catch (e) { showToast('일괄 매핑 실패: ' + (e.message||e), 'error'); }
}

// ── CSV 내보내기 ──
function exportTerritoryCSV() {
  const data = window._cachedTerritories || [];
  if (!data.length) { showToast('데이터가 없습니다.', 'warning'); return; }
  const rows = [['ID', '시도', '시군구', '읍면동', '행정코드', '법정코드', '매핑조직', '상태']];
  data.forEach(t => rows.push([t.code, t.sido, t.sigungu, t.full_name, t.org_name || '', t.org_name ? '매핑' : '미매핑']));
  if (typeof exportToCSV === 'function') exportToCSV(rows, '시군구매핑현황');
  else {
    const csv = rows.map(r => r.map(c => `"${(c+'').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `시군구매핑_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  }
}
