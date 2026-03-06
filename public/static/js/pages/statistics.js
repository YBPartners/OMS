// ============================================================
// 와이비 OMS - 통계 + 정책관리 페이지 v7.0
// Interaction Design: 행 호버프리뷰, 컨텍스트메뉴,
// 드릴다운 행, CSV 다운로드, 인터랙티브 테이블
// ============================================================

// ════════ 통계 ════════
async function renderStatistics(el) {
  try {
  showSkeletonLoading(el, 'table');
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  
  const [regionRes, tlRes] = await Promise.all([
    api('GET', `/stats/regions/daily?from=${weekAgo}&to=${today}`),
    api('GET', `/stats/team-leaders/daily?from=${weekAgo}&to=${today}`),
  ]);

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-chart-bar mr-2 text-purple-600"></i>통계</h2>
        <div class="flex gap-2">
          <button onclick="exportCSV('region')" class="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200 transition" data-tooltip="지역별 통계 CSV 다운로드">
            <i class="fas fa-download mr-1"></i>지역별 CSV
          </button>
          <button onclick="exportCSV('team_leader')" class="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200 transition" data-tooltip="팀장별 통계 CSV 다운로드">
            <i class="fas fa-download mr-1"></i>팀장별 CSV
          </button>
        </div>
      </div>

      <!-- 날짜 필터 -->
      <div class="bg-white rounded-xl p-4 mb-6 border border-gray-100 flex flex-wrap gap-3 items-end">
        <div><label class="block text-xs text-gray-500 mb-1">시작일</label>
          <input id="stat-from" type="date" class="border rounded-lg px-3 py-2 text-sm" value="${weekAgo}"></div>
        <div><label class="block text-xs text-gray-500 mb-1">종료일</label>
          <input id="stat-to" type="date" class="border rounded-lg px-3 py-2 text-sm" value="${today}"></div>
        <button onclick="refreshStats()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"><i class="fas fa-search mr-1"></i>조회</button>
      </div>

      <!-- 지역총판별 통계 -->
      <div class="bg-white rounded-xl p-5 border border-gray-100 mb-6">
        <h3 class="font-semibold mb-4"><i class="fas fa-building mr-2 text-blue-500"></i>지역총판별 통계</h3>
        <div id="region-stats-container">
          ${_renderRegionStatsTable(regionRes?.stats || [])}
        </div>
      </div>

      <!-- 팀장별 통계 -->
      <div class="bg-white rounded-xl p-5 border border-gray-100">
        <h3 class="font-semibold mb-4"><i class="fas fa-users mr-2 text-purple-500"></i>팀장별 통계</h3>
        <div id="tl-stats-container">
          ${_renderTLStatsTable(tlRes?.stats || [])}
        </div>
      </div>
    </div>`;
}

// ─── 통계 테이블 헬퍼 (renderDataTable 사용) ───
function _renderRegionStatsTable(stats) {
  window._regionStats = stats;
  return renderDataTable({
    tableId: 'region-stats-table',
    caption: '지역총판별 일별 통계',
    columns: [
      { key: 'date', label: '날짜', render: s => `<span class="text-xs">${s.date}</span>` },
      { key: 'region_name', label: '지역총판', render: s => `<span class="font-medium text-blue-700"><i class="fas fa-building text-[10px] mr-1 text-blue-400"></i>${s.region_name}</span>` },
      { key: 'intake_count', label: '인입', align: 'right', render: s => s.intake_count || 0 },
      { key: 'assigned_to_team_count', label: '팀장배정', align: 'right', render: s => s.assigned_to_team_count || 0 },
      { key: 'completed_count', label: '완료', align: 'right', render: s => s.completed_count || 0 },
      { key: 'region_approved_count', label: '지역승인', align: 'right', render: s => s.region_approved_count || 0 },
      { key: 'hq_approved_count', label: 'HQ승인', align: 'right', render: s => s.hq_approved_count || 0 },
      { key: 'settlement_confirmed_count', label: '정산확정', align: 'right', render: s => `<span class="font-bold text-green-600">${s.settlement_confirmed_count || 0}</span>` },
    ],
    rows: stats,
    onRowClick: '_statRegionRowClick',
    emptyText: '데이터 없음',
  });
}

function _renderTLStatsTable(stats) {
  window._tlStats = stats;
  return renderDataTable({
    tableId: 'tl-stats-table',
    caption: '팀장별 일별 통계',
    columns: [
      { key: 'date', label: '날짜', render: s => `<span class="text-xs">${s.date}</span>` },
      { key: 'team_leader_name', label: '팀장명', render: s => `<span class="font-medium">${s.team_leader_name}</span>` },
      { key: 'org_name', label: '총판', render: s => `<span class="text-gray-500">${s.org_name || '-'}</span>` },
      { key: 'intake_count', label: '수임', align: 'right', render: s => s.intake_count || 0 },
      { key: 'submitted_count', label: '제출', align: 'right', render: s => s.submitted_count || 0 },
      { key: 'hq_approved_count', label: 'HQ승인', align: 'right', render: s => s.hq_approved_count || 0 },
      { key: 'settlement_confirmed_count', label: '정산확정', align: 'right', render: s => s.settlement_confirmed_count || 0 },
      { key: 'payable_amount_sum', label: '지급액합', align: 'right', render: s => `<span class="font-bold text-green-600">${formatAmount(s.payable_amount_sum)}</span>` },
    ],
    rows: stats,
    onRowClick: '_statTLRowClick',
    emptyText: '데이터 없음',
  });
}

function _statRegionRowClick(idx) {
  const stats = window._regionStats || [];
  const s = stats[idx];
  if (s) drilldownRegionStat(s.region_name, s.region_org_id || '');
}

function _statTLRowClick(idx) {
  const stats = window._tlStats || [];
  const s = stats[idx];
  if (s) drilldownTeamLeaderStat(s.team_leader_name, s.team_leader_id || '');
}

// ─── 통계 행 드릴다운 ───
function drilldownRegionStat(regionName, orgId) {
  if (orgId) {
    window._orderFilters = { region_org_id: orgId };
    navigateTo('orders');
  } else {
    showToast(`${regionName} 주문 목록으로 이동`, 'info');
  }
}

function drilldownTeamLeaderStat(leaderName, leaderId) {
  if (leaderId) {
    window._orderFilters = { search: leaderName };
    navigateTo('orders');
  } else {
    showToast(`${leaderName} 관련 주문 보기`, 'info');
  }
}

// ─── 통계 행 컨텍스트 메뉴 ───
function showStatRowContextMenu(event, type, name, id) {
  event.preventDefault();
  event.stopPropagation();

  const items = [];
  if (type === 'region') {
    items.push(
      { icon: 'fa-list', label: `${name} 주문 목록`, action: () => { window._orderFilters = { region_org_id: id }; navigateTo('orders'); } },
      { icon: 'fa-building', label: `${name} 상세 보기`, action: () => showRegionDetailModal(Number(id), name) },
      { divider: true },
      { icon: 'fa-users-gear', label: '인사관리에서 확인', action: () => navigateTo('hr-management') },
      { icon: 'fa-coins', label: '정산에서 확인', action: () => navigateTo('settlement') }
    );
  } else {
    items.push(
      { icon: 'fa-list', label: `${name} 주문 목록`, action: () => { window._orderFilters = { search: name }; navigateTo('orders'); } },
      { divider: true },
      { icon: 'fa-users-gear', label: '인사관리에서 확인', action: () => navigateTo('hr-management') },
      { icon: 'fa-coins', label: '정산에서 확인', action: () => navigateTo('settlement') }
    );
  }

  showContextMenu(event.clientX, event.clientY, items, { title: name });
  } catch (e) { el.innerHTML = `<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1">${escapeHtml(e.message)}</p></div>`; }
}

async function refreshStats() {
  try {
  const from = document.getElementById('stat-from')?.value || '';
  const to = document.getElementById('stat-to')?.value || '';
  
  const [regionRes, tlRes] = await Promise.all([
    api('GET', `/stats/regions/daily?from=${from}&to=${to}`),
    api('GET', `/stats/team-leaders/daily?from=${from}&to=${to}`),
  ]);

  // 지역총판별 테이블 업데이트 (renderDataTable 사용)
  const regionContainer = document.getElementById('region-stats-container');
  if (regionContainer) {
    regionContainer.innerHTML = _renderRegionStatsTable(regionRes?.stats || []);
  }

  // 팀장별 테이블 업데이트 (renderDataTable 사용)
  const tlContainer = document.getElementById('tl-stats-container');
  if (tlContainer) {
    tlContainer.innerHTML = _renderTLStatsTable(tlRes?.stats || []);
  }

  showToast('통계가 갱신되었습니다.', 'success');
  } catch (e) { showToast('처리 실패: ' + e.message, 'error'); }
}

async function exportCSV(groupBy) {
  try {
  const from = document.getElementById('stat-from')?.value || '';
  const to = document.getElementById('stat-to')?.value || '';
  const res = await api('GET', `/stats/export/csv?group_by=${groupBy}&from=${from}&to=${to}`);
  if (res instanceof Response) {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `stats_${groupBy}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast('CSV 다운로드 완료', 'success');
  } else {
    showToast('다운로드 실패', 'error');
  }
  } catch (e) { showToast('처리 실패: ' + e.message, 'error'); }
}

// ════════ 정책관리 ════════
async function renderPolicies(el) {
  try {
  showSkeletonLoading(el, 'table');
  const [distRes, reportRes, commRes, terRes, metricsRes] = await Promise.all([
    api('GET', '/stats/policies/distribution'),
    api('GET', '/stats/policies/report'),
    api('GET', '/stats/policies/commission'),
    api('GET', '/stats/territories'),
    api('GET', '/stats/policies/metrics'),
  ]);

  const activeTab = window._policyTab || 'distribution';

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-gears mr-2 text-gray-600"></i>정책관리</h2>

      <!-- 탭 -->
      <div class="flex gap-1 mb-6 border-b">
        ${['distribution', 'report', 'commission', 'territory', 'metrics'].map(tab => {
          const labels = { distribution: '배분 정책', report: '보고서 정책', commission: '수수료 정책', territory: '지역권 매핑', metrics: '지표 정책' };
          const icons = { distribution: 'fa-share-nodes', report: 'fa-file-lines', commission: 'fa-percent', territory: 'fa-map-location-dot', metrics: 'fa-chart-bar' };
          return `<button onclick="window._policyTab='${tab}';renderContent()" class="px-4 py-2 text-sm ${activeTab === tab ? 'tab-active' : 'text-gray-500 hover:text-gray-700'} transition"><i class="fas ${icons[tab]} mr-1"></i>${labels[tab]}</button>`;
        }).join('')}
      </div>

      <div id="policy-content">
        ${activeTab === 'distribution' ? renderDistPolicyTable(distRes?.policies || []) : ''}
        ${activeTab === 'report' ? renderReportPolicyTable(reportRes?.policies || []) : ''}
        ${activeTab === 'commission' ? renderCommissionPolicyTable(commRes?.policies || []) : ''}
        ${activeTab === 'territory' ? renderTerritoryTable(terRes?.territories || []) : ''}
        ${activeTab === 'metrics' ? renderMetricsPolicyTable(metricsRes?.policies || []) : ''}
      </div>
    </div>`;
}

function renderDistPolicyTable(policies) {
  const canEditPolicy = canEdit('policy');
  const _activeCell = p => p.is_active ? '<span class="text-green-600 font-bold">활성</span>' : '<span class="text-gray-400">비활성</span>';
  const _distActions = p => `<div class="flex gap-1 justify-center">
    <button onclick='showEditDistPolicyModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"><i class="fas fa-edit"></i></button>
    <button onclick="togglePolicyActive('distribution',${p.policy_id},${p.is_active?0:1})" class="px-2 py-1 ${p.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} rounded text-xs hover:opacity-80">${p.is_active ? '비활성' : '활성'}</button>
    ${!p.is_active ? `<button onclick="deletePolicy('distribution',${p.policy_id})" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"><i class="fas fa-trash"></i></button>` : ''}
  </div>`;
  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold">배분 정책 (행정동 기반 자동배분)</h3>
        ${canEditPolicy ? `<button onclick="showNewDistPolicyModal()" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>새 버전</button>` : ''}
      </div>
      ${renderDataTable({ columns: [
        { key: 'policy_id', label: 'ID' },
        { key: 'name', label: '이름' },
        { key: 'version', label: '버전', align: 'center', render: p => `v${p.version}` },
        { key: 'is_active', label: '활성', align: 'center', render: _activeCell },
        { key: 'effective_from', label: '적용일', render: p => `<span class="text-xs">${p.effective_from || '-'}</span>` },
        { key: '_actions', label: '관리', align: 'center', show: canEditPolicy, render: _distActions }
      ], rows: policies, compact: true, noBorder: true, emptyText: '배분 정책이 없습니다.' })}
    </div>`;
}

function renderReportPolicyTable(policies) {
  const canEditPolicy = canEdit('policy');
  const _photosCol = p => { let d = '-'; try { const pj = typeof p.required_photos_json === 'string' ? JSON.parse(p.required_photos_json) : p.required_photos_json; d = Object.entries(pj || {}).map(([k,v]) => `${k}:${v}`).join(', '); } catch { d = p.required_photos_json || '-'; } return `<span class="text-xs">${d}</span>`; };
  const _reportActions = p => `<div class="flex gap-1 justify-center">
    <button onclick='showEditReportPolicyModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"><i class="fas fa-edit"></i></button>
    <button onclick="togglePolicyActive('report',${p.policy_id},${p.is_active?0:1})" class="px-2 py-1 ${p.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} rounded text-xs hover:opacity-80">${p.is_active ? '비활성' : '활성'}</button>
    ${!p.is_active ? `<button onclick="deletePolicy('report',${p.policy_id})" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"><i class="fas fa-trash"></i></button>` : ''}
  </div>`;
  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold">보고서 필수요건 정책</h3>
        ${canEditPolicy ? `<button onclick="showNewReportPolicyModal()" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>새 버전</button>` : ''}
      </div>
      ${renderDataTable({ columns: [
        { key: 'policy_id', label: 'ID' },
        { key: 'name', label: '이름' },
        { key: 'service_type', label: '서비스유형' },
        { key: '_photos', label: '필수사진', render: _photosCol },
        { key: 'require_receipt', label: '영수증', align: 'center', render: p => p.require_receipt ? '<span class="text-green-600">Y</span>' : 'N' },
        { key: 'is_active', label: '활성', align: 'center', render: p => p.is_active ? '<span class="text-green-600 font-bold">활성</span>' : '<span class="text-gray-400">비활성</span>' },
        { key: '_actions', label: '관리', align: 'center', show: canEditPolicy, render: _reportActions }
      ], rows: policies, compact: true, noBorder: true, emptyText: '보고서 정책이 없습니다.' })}
    </div>`;
}

function renderCommissionPolicyTable(policies) {
  const canEditPolicy = canEdit('policy');
  const _commActions = p => `<div class="flex gap-1 justify-center">
    <button onclick='showEditCommissionModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"><i class="fas fa-edit"></i></button>
    <button onclick="toggleCommissionActive(${p.commission_policy_id},${p.is_active?0:1})" class="px-2 py-1 ${p.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} rounded text-xs hover:opacity-80">${p.is_active ? '비활성' : '활성'}</button>
    ${!p.is_active ? `<button onclick="deleteCommissionPolicy(${p.commission_policy_id})" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"><i class="fas fa-trash"></i></button>` : ''}
  </div>`;
  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold">수수료(정률/정액) 정책</h3>
        ${canEditPolicy ? `<button onclick="showNewCommissionModal()" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>추가</button>` : ''}
      </div>
      <p class="text-xs text-gray-500 mb-3">정률(PERCENT): 주문금액의 %를 수수료로 차감 · 정액(FIXED): 건당 고정금액 차감</p>
      ${renderDataTable({ columns: [
        { key: 'commission_policy_id', label: 'ID' },
        { key: 'org_name', label: '지역총판' },
        { key: 'team_leader_name', label: '대상 팀장', render: p => escapeHtml(p.team_leader_name || '') || '<span class="text-gray-400">총판 기본</span>' },
        { key: 'mode', label: '유형', align: 'center', render: p => `<span class="status-badge ${p.mode === 'PERCENT' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}">${p.mode === 'PERCENT' ? '정률' : '정액'}</span>` },
        { key: 'value', label: '값', align: 'right', render: p => `<span class="font-bold">${p.mode === 'PERCENT' ? p.value + '%' : formatAmount(p.value)}</span>` },
        { key: 'effective_from', label: '적용일', render: p => `<span class="text-xs">${p.effective_from || '-'}</span>` },
        { key: 'is_active', label: '활성', align: 'center', render: p => p.is_active ? '<span class="text-green-600 font-bold">활성</span>' : '<span class="text-gray-400">비활성</span>' },
        { key: '_actions', label: '관리', align: 'center', show: canEditPolicy, render: _commActions }
      ], rows: policies, compact: true, noBorder: true, emptyText: '수수료 정책이 없습니다.' })}
    </div>`;
}

function renderTerritoryTable(territories) {
  const canEditPolicy = canEdit('policy');
  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <h3 class="font-semibold mb-4">지역권 ↔ 지역총판 매핑</h3>
      ${renderDataTable({ columns: [
        { key: 'sido', label: '시도' },
        { key: 'sigungu', label: '시군구' },
        { key: 'eupmyeondong', label: '읍면동', render: t => escapeHtml(t.eupmyeondong || '-') },
        { key: 'admin_dong_code', label: '행정동코드', render: t => `<span class="font-mono text-xs">${t.admin_dong_code}</span>` },
        { key: 'org_name', label: '배정 총판', render: t => `<span class="font-medium ${t.org_name ? 'text-purple-700' : 'text-red-500'}">${escapeHtml(t.org_name || '') || '미매핑'}</span>` },
        { key: '_actions', label: '관리', align: 'center', show: canEditPolicy, render: t => `<button onclick="showTerritoryMappingModal(${t.territory_id}, '${(t.org_name||'').replace(/'/g,"\\'")}')" class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"><i class="fas fa-edit mr-1"></i>변경</button>` }
      ], rows: territories, compact: true, noBorder: true, emptyText: '지역권 매핑이 없습니다.' })}
    </div>`;
}

// ═══════ 정책 CRUD 모달/핸들러 ═══════

// ── 지표 정책 테이블 ──
function renderMetricsPolicyTable(policies) {
  const canEditPolicy = canEdit('policy');
  const _metricsActions = p => `<div class="flex gap-1 justify-center">
    <button onclick='showEditMetricsPolicyModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"><i class="fas fa-edit"></i></button>
    <button onclick="toggleMetricsActive(${p.metrics_policy_id},${p.is_active?0:1})" class="px-2 py-1 ${p.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} rounded text-xs hover:opacity-80">${p.is_active ? '비활성' : '활성'}</button>
    ${!p.is_active ? `<button onclick="deleteMetricsPolicy(${p.metrics_policy_id})" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"><i class="fas fa-trash"></i></button>` : ''}
  </div>`;
  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="font-semibold">지표(Metrics) 정책</h3>
          <p class="text-xs text-gray-500 mt-1">완료 기준 및 지역접수 기준을 정의합니다.</p>
        </div>
        ${canEditPolicy ? `<button onclick="showNewMetricsPolicyModal()" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>추가</button>` : ''}
      </div>
      ${renderDataTable({ columns: [
        { key: 'metrics_policy_id', label: 'ID', render: p => `<span class="font-mono text-xs">${p.metrics_policy_id}</span>` },
        { key: 'completion_basis', label: '완료 기준', render: p => p.completion_basis || '-' },
        { key: 'region_intake_basis', label: '지역접수 기준', render: p => p.region_intake_basis || '-' },
        { key: 'effective_from', label: '적용일', render: p => `<span class="text-xs">${p.effective_from || '-'}</span>` },
        { key: 'is_active', label: '활성', align: 'center', render: p => p.is_active ? '<span class="text-green-600 font-bold">활성</span>' : '<span class="text-gray-400">비활성</span>' },
        { key: '_actions', label: '관리', align: 'center', show: canEditPolicy, render: _metricsActions }
      ], rows: policies, compact: true, noBorder: true, emptyText: '지표 정책이 없습니다.' })}
    </div>`;
}
function showNewMetricsPolicyModal() {
  const content = `<div class="space-y-4">
    <div><label class="block text-xs text-gray-500 mb-1">완료 기준 *</label>
      <select id="mp-completion" class="w-full border rounded-lg px-3 py-2 text-sm">
        <option value="SUBMITTED_AT">제출일(SUBMITTED_AT) 기준</option>
        <option value="HQ_APPROVED_AT">HQ승인일(HQ_APPROVED_AT) 기준</option>
        <option value="SETTLEMENT_CONFIRMED_AT">정산확정일(SETTLEMENT_CONFIRMED_AT) 기준</option>
      </select></div>
    <div><label class="block text-xs text-gray-500 mb-1">지역접수 기준 *</label>
      <select id="mp-intake" class="w-full border rounded-lg px-3 py-2 text-sm">
        <option value="DISTRIBUTED_AT">배분완료(DISTRIBUTED_AT) 기준</option>
        <option value="REGION_ACCEPT_AT">지역접수(REGION_ACCEPT_AT) 기준</option>
      </select></div>
    <div><label class="block text-xs text-gray-500 mb-1">적용일</label>
      <input id="mp-from" type="date" class="w-full border rounded-lg px-3 py-2 text-sm" value="${new Date().toISOString().split('T')[0]}"></div>
  </div>`;
  showModal('새 지표 정책', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitNewMetricsPolicy()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">생성</button>`);
  } catch (e) { el.innerHTML = `<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1">${escapeHtml(e.message)}</p></div>`; }
}
async function submitNewMetricsPolicy() {
  const data = { completion_basis: document.getElementById('mp-completion')?.value, region_intake_basis: document.getElementById('mp-intake')?.value, effective_from: document.getElementById('mp-from')?.value };
  await apiAction('POST', '/stats/policies/metrics', data, { successMsg: '지표 정책 생성 완료', closeModal: true, refresh: true });
}
function showEditMetricsPolicyModal(p) {
  const content = `<div class="space-y-4">
    <div><label class="block text-xs text-gray-500 mb-1">완료 기준</label>
      <select id="mp-completion" class="w-full border rounded-lg px-3 py-2 text-sm">
        ${['SUBMITTED_AT','HQ_APPROVED_AT','SETTLEMENT_CONFIRMED_AT'].map(v => `<option value="${v}" ${p.completion_basis===v?'selected':''}>${v}</option>`).join('')}
      </select></div>
    <div><label class="block text-xs text-gray-500 mb-1">지역접수 기준</label>
      <select id="mp-intake" class="w-full border rounded-lg px-3 py-2 text-sm">
        ${['DISTRIBUTED_AT','REGION_ACCEPT_AT'].map(v => `<option value="${v}" ${p.region_intake_basis===v?'selected':''}>${v}</option>`).join('')}
      </select></div>
  </div>`;
  showModal(`지표 정책 수정 — #${p.metrics_policy_id}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitEditMetricsPolicy(${p.metrics_policy_id})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">저장</button>`);
}
async function submitEditMetricsPolicy(id) {
  const data = { completion_basis: document.getElementById('mp-completion')?.value, region_intake_basis: document.getElementById('mp-intake')?.value };
  await apiAction('PUT', `/stats/policies/metrics/${id}`, data, { successMsg: '지표 정책 수정 완료', closeModal: true, refresh: true });
}
async function toggleMetricsActive(id, val) {
  await apiAction('PUT', `/stats/policies/metrics/${id}`, { is_active: !!val }, { successMsg: val ? '활성화 완료' : '비활성화 완료', refresh: true });
}
async function deleteMetricsPolicy(id) {
  try {
  showConfirmModal('지표 정책 삭제', `#${id} 정책을 삭제하시겠습니까?`, async () => {
    const res = await api('DELETE', `/stats/policies/metrics/${id}`);
    if (res?.ok) { showToast('삭제 완료', 'success'); renderContent(); }
    else showToast(res?.error || '삭제 실패', 'error');
  });
}

// 배분 정책 — 새 버전 생성
function showNewDistPolicyModal() {
  const content = `<div class="space-y-4">
    <div><label class="block text-xs text-gray-500 mb-1">정책명</label>
      <input id="dp-name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="예: 행정동 기반 자동배분 v2"></div>
    <div><label class="block text-xs text-gray-500 mb-1">규칙 (JSON)</label>
      <textarea id="dp-rule" rows="4" class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder='{"method":"admin_dong_code","fallback":"DISTRIBUTION_PENDING"}'>{"method":"admin_dong_code","fallback":"DISTRIBUTION_PENDING"}</textarea></div>
    <div><label class="block text-xs text-gray-500 mb-1">적용일</label>
      <input id="dp-from" type="date" class="w-full border rounded-lg px-3 py-2 text-sm" value="${new Date().toISOString().split('T')[0]}"></div>
  </div>`;
  showModal('새 배분 정책 버전', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitNewDistPolicy()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">생성</button>`);
  } catch (e) { showToast('처리 실패: ' + e.message, 'error'); }
}
async function submitNewDistPolicy() {
  const name = document.getElementById('dp-name')?.value;
  const rule_json = document.getElementById('dp-rule')?.value || '{}';
  const effective_from = document.getElementById('dp-from')?.value;
  if (!name) { showToast('정책명을 입력하세요.', 'warning'); return; }
  await apiAction('POST', '/stats/policies/distribution', { name, rule_json, effective_from }, { successMsg: d => `새 버전 v${d.version} 생성 완료`, closeModal: true, refresh: true });
}

// 배분 정책 — 수정
function showEditDistPolicyModal(p) {
  const content = `<div class="space-y-4">
    <div><label class="block text-xs text-gray-500 mb-1">정책명</label>
      <input id="dp-edit-name" class="w-full border rounded-lg px-3 py-2 text-sm" value="${p.name}"></div>
    <div><label class="block text-xs text-gray-500 mb-1">규칙 (JSON)</label>
      <textarea id="dp-edit-rule" rows="4" class="w-full border rounded-lg px-3 py-2 text-sm font-mono">${typeof p.rule_json === 'string' ? p.rule_json : JSON.stringify(p.rule_json || {})}</textarea></div>
  </div>`;
  showModal(`배분 정책 수정 — v${p.version}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitEditDistPolicy(${p.policy_id})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">저장</button>`);
}
async function submitEditDistPolicy(id) {
  const name = document.getElementById('dp-edit-name')?.value;
  const rule_json = document.getElementById('dp-edit-rule')?.value;
  await apiAction('PUT', `/stats/policies/distribution/${id}`, { name, rule_json }, { successMsg: '수정 완료', closeModal: true, refresh: true });
}

// 활성/비활성 토글 (배분/보고서 공용)
async function togglePolicyActive(type, id, newActive) {
  await apiAction('PUT', `/stats/policies/${type}/${id}`, { is_active: !!newActive }, { successMsg: newActive ? '활성화 완료' : '비활성화 완료', refresh: true });
}

// 보고서 정책 — 새 버전 생성
function showNewReportPolicyModal() {
  const content = `<div class="space-y-4">
    <div><label class="block text-xs text-gray-500 mb-1">정책명</label>
      <input id="rp-name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="예: 기본 보고서 정책 v2"></div>
    <div><label class="block text-xs text-gray-500 mb-1">서비스유형</label>
      <input id="rp-type" class="w-full border rounded-lg px-3 py-2 text-sm" value="DEFAULT"></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="block text-xs text-gray-500 mb-1">BEFORE 사진 수</label><input id="rp-before" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" value="1" min="0"></div>
      <div><label class="block text-xs text-gray-500 mb-1">AFTER 사진 수</label><input id="rp-after" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" value="1" min="0"></div>
      <div><label class="block text-xs text-gray-500 mb-1">WASH 사진 수</label><input id="rp-wash" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" value="1" min="0"></div>
      <div><label class="block text-xs text-gray-500 mb-1">RECEIPT 사진 수</label><input id="rp-receipt" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" value="1" min="0"></div>
    </div>
    <div><label class="flex items-center gap-2 cursor-pointer"><input id="rp-require-receipt" type="checkbox" checked class="w-4 h-4 rounded text-blue-600"><span class="text-sm">영수증 필수</span></label></div>
    <div><label class="block text-xs text-gray-500 mb-1">체크리스트 항목 (줄바꿈 구분)</label>
      <textarea id="rp-checklist" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="작업완료확인\n고객서명확인\n현장정리확인">작업완료확인\n고객서명확인\n현장정리확인</textarea></div>
  </div>`;
  showModal('새 보고서 정책 버전', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitNewReportPolicy()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">생성</button>`);
}
async function submitNewReportPolicy() {
  const name = document.getElementById('rp-name')?.value;
  if (!name) { showToast('정책명을 입력하세요.', 'warning'); return; }
  const photos = { BEFORE: +document.getElementById('rp-before').value, AFTER: +document.getElementById('rp-after').value, WASH: +document.getElementById('rp-wash').value, RECEIPT: +document.getElementById('rp-receipt').value };
  const checklist = document.getElementById('rp-checklist').value.split('\n').map(s=>s.trim()).filter(Boolean);
  await apiAction('POST', '/stats/policies/report', {
    name, service_type: document.getElementById('rp-type').value || 'DEFAULT',
    required_photos_json: photos, required_checklist_json: checklist,
    require_receipt: document.getElementById('rp-require-receipt').checked,
  }, { successMsg: d => `새 버전 v${d.version} 생성 완료`, closeModal: true, refresh: true });
}

// 보고서 정책 — 수정
function showEditReportPolicyModal(p) {
  let photos = {};
  try { photos = typeof p.required_photos_json === 'string' ? JSON.parse(p.required_photos_json) : (p.required_photos_json || {}); } catch {}
  let checklist = [];
  try { checklist = typeof p.required_checklist_json === 'string' ? JSON.parse(p.required_checklist_json) : (p.required_checklist_json || []); } catch {}
  const content = `<div class="space-y-4">
    <div><label class="block text-xs text-gray-500 mb-1">정책명</label>
      <input id="rp-edit-name" class="w-full border rounded-lg px-3 py-2 text-sm" value="${p.name}"></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="block text-xs text-gray-500 mb-1">BEFORE</label><input id="rp-edit-before" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" value="${photos.BEFORE||0}" min="0"></div>
      <div><label class="block text-xs text-gray-500 mb-1">AFTER</label><input id="rp-edit-after" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" value="${photos.AFTER||0}" min="0"></div>
      <div><label class="block text-xs text-gray-500 mb-1">WASH</label><input id="rp-edit-wash" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" value="${photos.WASH||0}" min="0"></div>
      <div><label class="block text-xs text-gray-500 mb-1">RECEIPT</label><input id="rp-edit-receipt" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" value="${photos.RECEIPT||0}" min="0"></div>
    </div>
    <div><label class="flex items-center gap-2"><input id="rp-edit-require" type="checkbox" ${p.require_receipt ? 'checked' : ''} class="w-4 h-4 rounded text-blue-600"><span class="text-sm">영수증 필수</span></label></div>
    <div><label class="block text-xs text-gray-500 mb-1">체크리스트</label>
      <textarea id="rp-edit-checklist" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm">${checklist.join('\n')}</textarea></div>
  </div>`;
  showModal(`보고서 정책 수정 — ${p.name}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitEditReportPolicy(${p.policy_id})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">저장</button>`);
}
async function submitEditReportPolicy(id) {
  const photos = { BEFORE: +document.getElementById('rp-edit-before').value, AFTER: +document.getElementById('rp-edit-after').value, WASH: +document.getElementById('rp-edit-wash').value, RECEIPT: +document.getElementById('rp-edit-receipt').value };
  const checklist = document.getElementById('rp-edit-checklist').value.split('\n').map(s=>s.trim()).filter(Boolean);
  await apiAction('PUT', `/stats/policies/report/${id}`, {
    name: document.getElementById('rp-edit-name').value,
    required_photos_json: photos, required_checklist_json: checklist,
    require_receipt: document.getElementById('rp-edit-require').checked,
  }, { successMsg: '수정 완료', closeModal: true, refresh: true });
}

// 수수료 정책 — 새로 추가
async function showNewCommissionModal() {
  try {
  const orgsRes = await api('GET', '/auth/organizations');
  const orgs = orgsRes?.organizations || [];
  const content = `<div class="space-y-4">
    <div><label class="block text-xs text-gray-500 mb-1">대상 총판</label>
      <select id="cp-org" class="w-full border rounded-lg px-3 py-2 text-sm">${orgs.map(o => `<option value="${o.org_id}">${o.name} (${o.org_type})</option>`).join('')}</select></div>
    <div><label class="block text-xs text-gray-500 mb-1">대상 팀장 ID (비우면 총판 기본)</label>
      <input id="cp-leader" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="선택사항"></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="block text-xs text-gray-500 mb-1">유형</label>
        <select id="cp-mode" class="w-full border rounded-lg px-3 py-2 text-sm"><option value="PERCENT">정률 (%)</option><option value="FIXED">정액 (원)</option></select></div>
      <div><label class="block text-xs text-gray-500 mb-1">값</label>
        <input id="cp-value" type="number" step="0.1" class="w-full border rounded-lg px-3 py-2 text-sm" value="7.5"></div>
    </div>
  </div>`;
  showModal('수수료 정책 추가', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitNewCommission()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">추가</button>`);
  } catch (e) { showToast('로드 실패: ' + e.message, 'error'); }
}
async function submitNewCommission() {
  const orgId = +document.getElementById('cp-org').value;
  const leaderId = document.getElementById('cp-leader').value ? +document.getElementById('cp-leader').value : null;
  await apiAction('POST', '/stats/policies/commission', {
    org_id: orgId, team_leader_id: leaderId,
    mode: document.getElementById('cp-mode').value,
    value: +document.getElementById('cp-value').value,
  }, { successMsg: '수수료 정책 추가 완료', closeModal: true, refresh: true });
}

// 수수료 정책 — 수정
function showEditCommissionModal(p) {
  const content = `<div class="space-y-4">
    <div class="bg-gray-50 rounded-lg p-3 text-sm"><strong>${p.org_name}</strong> ${p.team_leader_name ? '· 팀장: ' + p.team_leader_name : '· 총판 기본'}</div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="block text-xs text-gray-500 mb-1">유형</label>
        <select id="cp-edit-mode" class="w-full border rounded-lg px-3 py-2 text-sm"><option value="PERCENT" ${p.mode==='PERCENT'?'selected':''}>정률 (%)</option><option value="FIXED" ${p.mode==='FIXED'?'selected':''}>정액 (원)</option></select></div>
      <div><label class="block text-xs text-gray-500 mb-1">값</label>
        <input id="cp-edit-value" type="number" step="0.1" class="w-full border rounded-lg px-3 py-2 text-sm" value="${p.value}"></div>
    </div>
  </div>`;
  showModal(`수수료 수정 — ${p.org_name}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitEditCommission(${p.commission_policy_id})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">저장</button>`);
}
async function submitEditCommission(id) {
  await apiAction('PUT', `/stats/policies/commission/${id}`, {
    mode: document.getElementById('cp-edit-mode').value,
    value: +document.getElementById('cp-edit-value').value,
  }, { successMsg: '수정 완료', closeModal: true, refresh: true });
}

// 수수료 활성/비활성 토글
async function toggleCommissionActive(id, newActive) {
  await apiAction('PUT', `/stats/policies/commission/${id}`, { is_active: !!newActive }, { successMsg: newActive ? '활성화 완료' : '비활성화 완료', refresh: true });
}

// 배분/보고서 정책 삭제
async function deletePolicy(type, id) {
  try {
  const typeLabel = type === 'distribution' ? '배분' : '보고서';
  showConfirmModal(`${typeLabel} 정책 삭제`, `#${id} ${typeLabel} 정책을 삭제하시겠습니까?\n(비활성 정책만 삭제 가능)`, async () => {
    const res = await api('DELETE', `/stats/policies/${type}/${id}`);
    if (res?.ok) { showToast('삭제 완료', 'success'); renderContent(); }
    else showToast(res?.error || '삭제 실패', 'error');
  });
  } catch (e) { showToast('처리 실패: ' + e.message, 'error'); }
}

// 수수료 정책 삭제
async function deleteCommissionPolicy(id) {
  try {
  showConfirmModal('수수료 정책 삭제', `#${id} 수수료 정책을 삭제하시겠습니까?\n(비활성 정책만 삭제 가능)`, async () => {
    const res = await api('DELETE', `/stats/policies/commission/${id}`);
    if (res?.ok) { showToast('삭제 완료', 'success'); renderContent(); }
    else showToast(res?.error || '삭제 실패', 'error');
  });
  } catch (e) { showToast('처리 실패: ' + e.message, 'error'); }
}

// 지역권 매핑 변경
async function showTerritoryMappingModal(territoryId, currentOrgName) {
  try {
  const orgsRes = await api('GET', '/auth/organizations');
  const orgs = (orgsRes?.organizations || []).filter(o => o.org_type === 'REGION');
  const content = `<div class="space-y-4">
    <div class="bg-gray-50 rounded-lg p-3 text-sm">현재 배정: <strong class="${currentOrgName ? 'text-purple-700' : 'text-red-500'}">${currentOrgName || '미매핑'}</strong></div>
    <div><label class="block text-xs text-gray-500 mb-1">새 배정 총판 (REGION)</label>
      <select id="tm-org" class="w-full border rounded-lg px-3 py-2 text-sm">${orgs.map(o => `<option value="${o.org_id}">${o.name}</option>`).join('')}</select></div>
  </div>`;
  showModal(`지역권 매핑 변경 — #${territoryId}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitTerritoryMapping(${territoryId})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">변경</button>`);
  } catch (e) { showToast('로드 실패: ' + e.message, 'error'); }
}
async function submitTerritoryMapping(territoryId) {
  const orgId = +document.getElementById('tm-org').value;
  await apiAction('PUT', `/stats/territories/${territoryId}/mapping`, { org_id: orgId }, { successMsg: '매핑 변경 완료', closeModal: true, refresh: true });
}
