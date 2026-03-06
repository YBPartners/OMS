// ============================================================
// 와이비 OMS - 통계 + 정책관리 페이지 v9.0 (R13 고도화)
// Interaction Design: 행 호버프리뷰, 컨텍스트메뉴,
// 드릴다운 행, CSV 다운로드, 인터랙티브 테이블
// 정책 UI 고도화: 상세 모달, 요약 대시보드, 권역 검색, 연관 데이터
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

  } catch (e) {
  console.error('[renderStatistics]', e);
  el.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1 text-gray-400">' + (e.message||e) + '</p></div>';
  }
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

  } catch (e) {
  console.error('[refreshStats]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
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

  } catch (e) {
  console.error('[exportCSV]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}


// ════════ 정책 관리 (v9.0 — R13 고도화) ════════

async function renderPolicies(el) {
  try {
  showSkeletonLoading(el, 'table');
  const [distRes, reportRes, commRes, terRes, metricsRes, summaryRes] = await Promise.all([
    api('GET', '/stats/policies/distribution'),
    api('GET', '/stats/policies/report'),
    api('GET', '/stats/policies/commission'),
    api('GET', '/stats/territories'),
    api('GET', '/stats/policies/metrics'),
    api('GET', '/stats/policies/summary').catch(() => null),
  ]);

  const activeTab = window._policyTab || 'overview';
  const summary = summaryRes || {};
  const distPolicies = distRes?.policies || [];
  const reportPolicies = reportRes?.policies || [];
  const commPolicies = commRes?.policies || [];
  const territories = terRes?.territories || [];
  const metricsPolicies = metricsRes?.policies || [];

  window._cachedTerritories = territories;
  window._cachedAdminRegionMappings = terRes?.admin_region_mappings || [];

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-gears mr-2 text-gray-600"></i>정책관리</h2>
        <button onclick="renderContent()" class="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 transition"><i class="fas fa-sync mr-1"></i>새로고침</button>
      </div>

      <!-- 요약 카드 -->
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        ${_policySummaryCards(summary)}
      </div>

      <!-- 탭 -->
      <div class="flex gap-1 mb-6 border-b overflow-x-auto">
        ${['overview','distribution','report','commission','territory','metrics'].map(tab => {
          const labels = { overview:'전체 현황', distribution:'배분 정책', report:'보고서 정책', commission:'수수료 정책', territory:'지역권 매핑', metrics:'지표 정책' };
          const icons = { overview:'fa-gauge-high', distribution:'fa-share-nodes', report:'fa-file-lines', commission:'fa-percent', territory:'fa-map-location-dot', metrics:'fa-chart-bar' };
          const counts = { overview:'', distribution:distPolicies.length, report:reportPolicies.length, commission:commPolicies.length, territory:territories.length, metrics:metricsPolicies.length };
          const badge = counts[tab] ? `<span class="ml-1 px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full text-[10px]">${counts[tab]}</span>` : '';
          return `<button onclick="window._policyTab='${tab}';renderContent()" class="px-4 py-2 text-sm whitespace-nowrap ${activeTab === tab ? 'tab-active' : 'text-gray-500 hover:text-gray-700'} transition"><i class="fas ${icons[tab]} mr-1"></i>${labels[tab]}${badge}</button>`;
        }).join('')}
      </div>

      <div id="policy-content">
        ${activeTab === 'overview' ? _policyOverviewTab(summary) : ''}
        ${activeTab === 'distribution' ? renderDistPolicyTable(distPolicies) : ''}
        ${activeTab === 'report' ? renderReportPolicyTable(reportPolicies) : ''}
        ${activeTab === 'commission' ? renderCommissionPolicyTable(commPolicies) : ''}
        ${activeTab === 'territory' ? renderTerritoryTable(territories) : ''}
        ${activeTab === 'metrics' ? renderMetricsPolicyTable(metricsPolicies) : ''}
      </div>
    </div>`;

  } catch (e) {
  console.error('[renderPolicies]', e);
  el.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1 text-gray-400">' + (e.message||e) + '</p></div>';
  }
}

// ─── 요약 카드 ───
function _policySummaryCards(s) {
  const cards = [
    { icon:'fa-share-nodes', color:'blue', label:'배분', val:`${s.distribution?.active||0}/${s.distribution?.total||0}`, sub:'활성/전체' },
    { icon:'fa-file-lines', color:'emerald', label:'보고서', val:`${s.report?.active||0}/${s.report?.total||0}`, sub:'활성/전체' },
    { icon:'fa-percent', color:'amber', label:'수수료', val:`${s.commission?.active||0}/${s.commission?.total||0}`, sub:'활성/전체' },
    { icon:'fa-chart-bar', color:'purple', label:'지표', val:`${s.metrics?.active||0}/${s.metrics?.total||0}`, sub:'활성/전체' },
    { icon:'fa-map-location-dot', color:'rose', label:'지역권', val:`${s.territories?.total||0}`, sub:`${s.territories?.sido_cnt||0}개 시도` },
    { icon:'fa-earth-asia', color:'cyan', label:'행정구역', val:`${s.admin_regions?.total||0}`, sub:`${s.admin_regions?.sigungu_cnt||0}개 시군구` },
    { icon:'fa-boxes-stacked', color:'orange', label:'활성주문', val:`${s.active_orders||0}`, sub:'배분 대기' },
  ];
  return cards.map(c => `
    <div class="bg-white rounded-xl p-3 border border-gray-100 hover:shadow-md transition">
      <div class="flex items-center gap-2 mb-1"><div class="w-7 h-7 rounded-lg bg-${c.color}-100 flex items-center justify-center"><i class="fas ${c.icon} text-${c.color}-600 text-xs"></i></div><span class="text-[11px] text-gray-500">${c.label}</span></div>
      <div class="text-lg font-bold text-gray-800">${c.val}</div>
      <div class="text-[10px] text-gray-400">${c.sub}</div>
    </div>`).join('');
}

// ─── 전체 현황 탭 ───
function _policyOverviewTab(s) {
  const audit = s.recent_audit || [];
  const _icon = a => a === 'CREATE' ? '<i class="fas fa-plus text-green-500 text-xs"></i>' : a === 'UPDATE' ? '<i class="fas fa-pen text-blue-500 text-xs"></i>' : a === 'DELETE' ? '<i class="fas fa-trash text-red-500 text-xs"></i>' : '<i class="fas fa-circle text-gray-400 text-xs"></i>';
  const _lbl = t => ({ DISTRIBUTION_POLICY:'배분', REPORT_POLICY:'보고서', COMMISSION_POLICY:'수수료', METRICS_POLICY:'지표', TERRITORY:'지역권', ORG_REGION_MAPPING:'행정구역매핑' }[t] || t);
  return `<div class="space-y-6">
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <h3 class="font-semibold mb-4"><i class="fas fa-chart-pie mr-2 text-indigo-500"></i>정책 활성률</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-3">
          ${[{l:'배분 정책',d:s.distribution,c:'blue'},{l:'보고서 정책',d:s.report,c:'emerald'},{l:'수수료 정책',d:s.commission,c:'amber'},{l:'지표 정책',d:s.metrics,c:'purple'}].map(x => {
            const pct = x.d?.total ? Math.round((x.d.active/x.d.total)*100) : 0;
            return `<div><div class="flex justify-between text-xs mb-1"><span class="text-gray-600">${x.l}</span><span class="font-bold">${pct}% (${x.d?.active||0}/${x.d?.total||0})</span></div><div class="w-full bg-gray-200 rounded-full h-2"><div class="bg-${x.c}-600 h-2 rounded-full transition-all" style="width:${pct}%"></div></div></div>`;
          }).join('')}
        </div>
        <div class="space-y-3">
          <div class="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-4">
            <div class="text-xs text-gray-500 mb-1"><i class="fas fa-earth-asia mr-1"></i>전국 행정구역</div>
            <div class="text-2xl font-bold text-indigo-700">${s.admin_regions?.total||0}<span class="text-sm font-normal text-gray-500 ml-1">행정동</span></div>
            <div class="text-xs text-gray-500 mt-1">${s.admin_regions?.sido_cnt||0}개 시도 · ${s.admin_regions?.sigungu_cnt||0}개 시군구</div>
          </div>
          <div class="bg-gradient-to-r from-rose-50 to-pink-50 rounded-lg p-4">
            <div class="text-xs text-gray-500 mb-1"><i class="fas fa-map-pin mr-1"></i>지역권 매핑</div>
            <div class="text-2xl font-bold text-rose-700">${s.territories?.total||0}<span class="text-sm font-normal text-gray-500 ml-1">지역권</span></div>
            <div class="text-xs text-gray-500 mt-1">조직 매핑: ${s.org_region_mappings?.total||0}건</div>
          </div>
        </div>
      </div>
    </div>
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <h3 class="font-semibold mb-4"><i class="fas fa-clock-rotate-left mr-2 text-gray-500"></i>최근 정책 변경 이력 (최근 10건)</h3>
      ${audit.length ? `<div class="space-y-1">${audit.map(a => {
        let detail = '-';
        try { const d = JSON.parse(a.detail_json||'{}'); detail = Object.entries(d).slice(0,3).map(([k,v])=>k+'='+v).join(', '); } catch { detail = (a.detail_json||'').substring(0,60); }
        return `<div class="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded px-2">
          <div class="w-6 text-center">${_icon(a.action)}</div>
          <div class="flex-1 min-w-0"><div class="text-sm"><span class="font-medium">${_lbl(a.entity_type)}</span> #${a.entity_id||'-'} ${a.action}</div><div class="text-[11px] text-gray-400 truncate">${detail}</div></div>
          <div class="text-right shrink-0"><div class="text-[11px] text-gray-500">${a.actor_name||'-'}</div><div class="text-[10px] text-gray-400">${a.created_at ? new Date(a.created_at).toLocaleString('ko-KR') : '-'}</div></div>
        </div>`;
      }).join('')}</div>` : '<div class="text-center text-gray-400 py-4 text-sm">이력 없음</div>'}
    </div>
  </div>`;
}

// ═══════════════════════════════════════════
// 배분 정책 테이블 + 상세 모달
// ═══════════════════════════════════════════
function renderDistPolicyTable(policies) {
  const canEditPolicy = canEdit('policy');
  const _activeCell = p => p.is_active ? '<span class="text-green-600 font-bold">활성</span>' : '<span class="text-gray-400">비활성</span>';
  const _rulePreview = p => { try { const r = typeof p.rule_json === 'string' ? JSON.parse(p.rule_json) : p.rule_json; return `<span class="text-xs text-gray-500">${r.method||'-'} / ${r.fallback||'-'}</span>`; } catch { return '<span class="text-xs text-gray-400">-</span>'; }};
  const _distActions = p => `<div class="flex gap-1 justify-center">
    <button onclick='showDistPolicyDetailModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs hover:bg-indigo-100" title="상세보기"><i class="fas fa-eye"></i></button>
    <button onclick='showEditDistPolicyModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"><i class="fas fa-edit"></i></button>
    <button onclick="togglePolicyActive('distribution',${p.policy_id},${p.is_active?0:1})" class="px-2 py-1 ${p.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} rounded text-xs hover:opacity-80">${p.is_active ? '비활성' : '활성'}</button>
    ${!p.is_active ? `<button onclick="deletePolicy('distribution',${p.policy_id})" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"><i class="fas fa-trash"></i></button>` : ''}
  </div>`;
  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <div class="flex items-center justify-between mb-2">
        <div>
          <h3 class="font-semibold">배분 정책 (행정동 기반 자동배분)</h3>
          <p class="text-xs text-gray-500 mt-1">주문 인입 시 행정동 코드를 기반으로 지역총판에 자동 배분하는 규칙을 정의합니다. 활성 정책 1개만 적용됩니다.</p>
        </div>
        ${canEditPolicy ? `<button onclick="showNewDistPolicyModal()" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>새 버전</button>` : ''}
      </div>
      ${renderDataTable({ columns: [
        { key: 'policy_id', label: 'ID', render: p => `<span class="font-mono text-xs">${p.policy_id}</span>` },
        { key: 'name', label: '이름', render: p => `<button onclick='showDistPolicyDetailModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="text-left text-blue-700 hover:underline font-medium">${escapeHtml(p.name)}</button>` },
        { key: 'version', label: '버전', align: 'center', render: p => `<span class="status-badge bg-blue-100 text-blue-700">v${p.version}</span>` },
        { key: '_rule', label: '배분 규칙', render: _rulePreview },
        { key: 'is_active', label: '상태', align: 'center', render: _activeCell },
        { key: 'effective_from', label: '적용일', render: p => `<span class="text-xs">${p.effective_from || '-'}</span>` },
        { key: '_actions', label: '관리', align: 'center', show: canEditPolicy, render: _distActions }
      ], rows: policies, compact: true, noBorder: true, emptyText: '배분 정책이 없습니다.' })}
    </div>`;
}

// 배분 정책 상세 모달
function showDistPolicyDetailModal(p) {
  let ruleDisplay = '-';
  try {
    const r = typeof p.rule_json === 'string' ? JSON.parse(p.rule_json) : (p.rule_json || {});
    ruleDisplay = JSON.stringify(r, null, 2);
  } catch { ruleDisplay = p.rule_json || '-'; }
  const content = `<div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">정책 ID</div><div class="font-mono font-bold">#${p.policy_id}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">버전</div><div class="font-bold text-blue-700">v${p.version}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">상태</div><div class="${p.is_active ? 'text-green-600 font-bold' : 'text-gray-400'}">${p.is_active ? '활성' : '비활성'}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">적용일</div><div>${p.effective_from || '-'}</div></div>
    </div>
    <div>
      <div class="text-xs text-gray-500 mb-1 font-semibold"><i class="fas fa-code mr-1"></i>배분 규칙 (JSON)</div>
      <pre class="bg-gray-900 text-green-300 rounded-lg p-3 text-xs overflow-x-auto max-h-48">${escapeHtml(ruleDisplay)}</pre>
    </div>
    <div class="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
      <i class="fas fa-info-circle mr-1"></i><strong>동작 원리:</strong> 주문의 설치 주소에서 행정동 코드를 추출한 후, <code>territories</code> 테이블에서 일치하는 지역권을 찾아 해당 지역총판에 자동 배분합니다. 매칭 실패 시 <code>fallback</code> 상태로 전환됩니다.
    </div>
    ${p.created_at ? `<div class="text-[11px] text-gray-400 text-right">생성: ${new Date(p.created_at).toLocaleString('ko-KR')}</div>` : ''}
  </div>`;
  showModal(`배분 정책 상세 — ${escapeHtml(p.name)}`, content, `<button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`);
}

// ═══════════════════════════════════════════
// 보고서 정책 테이블 + 상세 모달
// ═══════════════════════════════════════════
function renderReportPolicyTable(policies) {
  const canEditPolicy = canEdit('policy');
  const _photosCol = p => {
    let d = '-';
    try { const pj = typeof p.required_photos_json === 'string' ? JSON.parse(p.required_photos_json) : p.required_photos_json;
      d = Object.entries(pj || {}).map(([k,v]) => `<span class="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-[10px] mr-0.5">${k}:${v}</span>`).join('');
    } catch { d = p.required_photos_json || '-'; }
    return d;
  };
  const _reportActions = p => `<div class="flex gap-1 justify-center">
    <button onclick='showReportPolicyDetailModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs hover:bg-indigo-100" title="상세보기"><i class="fas fa-eye"></i></button>
    <button onclick='showEditReportPolicyModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"><i class="fas fa-edit"></i></button>
    <button onclick="togglePolicyActive('report',${p.policy_id},${p.is_active?0:1})" class="px-2 py-1 ${p.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} rounded text-xs hover:opacity-80">${p.is_active ? '비활성' : '활성'}</button>
    ${!p.is_active ? `<button onclick="deletePolicy('report',${p.policy_id})" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"><i class="fas fa-trash"></i></button>` : ''}
  </div>`;
  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <div class="flex items-center justify-between mb-2">
        <div>
          <h3 class="font-semibold">보고서 필수요건 정책</h3>
          <p class="text-xs text-gray-500 mt-1">작업 보고서 제출 시 필수 사진(BEFORE/AFTER/WASH/RECEIPT) 수, 영수증 요구 여부, 체크리스트 항목을 정의합니다.</p>
        </div>
        ${canEditPolicy ? `<button onclick="showNewReportPolicyModal()" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>새 버전</button>` : ''}
      </div>
      ${renderDataTable({ columns: [
        { key: 'policy_id', label: 'ID', render: p => `<span class="font-mono text-xs">${p.policy_id}</span>` },
        { key: 'name', label: '이름', render: p => `<button onclick='showReportPolicyDetailModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="text-left text-blue-700 hover:underline font-medium">${escapeHtml(p.name)}</button>` },
        { key: 'service_type', label: '서비스유형', render: p => `<span class="status-badge bg-gray-100 text-gray-700">${p.service_type||'DEFAULT'}</span>` },
        { key: '_photos', label: '필수사진', render: _photosCol },
        { key: 'require_receipt', label: '영수증', align: 'center', render: p => p.require_receipt ? '<i class="fas fa-check-circle text-green-600"></i>' : '<i class="fas fa-minus-circle text-gray-300"></i>' },
        { key: 'is_active', label: '상태', align: 'center', render: p => p.is_active ? '<span class="text-green-600 font-bold">활성</span>' : '<span class="text-gray-400">비활성</span>' },
        { key: '_actions', label: '관리', align: 'center', show: canEditPolicy, render: _reportActions }
      ], rows: policies, compact: true, noBorder: true, emptyText: '보고서 정책이 없습니다.' })}
    </div>`;
}

// 보고서 정책 상세 모달
function showReportPolicyDetailModal(p) {
  let photos = {};
  try { photos = typeof p.required_photos_json === 'string' ? JSON.parse(p.required_photos_json) : (p.required_photos_json||{}); } catch {}
  let checklist = [];
  try { checklist = typeof p.required_checklist_json === 'string' ? JSON.parse(p.required_checklist_json) : (p.required_checklist_json||[]); } catch {}
  const totalPhotos = Object.values(photos).reduce((a,b) => a + Number(b), 0);

  const content = `<div class="space-y-4">
    <div class="grid grid-cols-3 gap-3">
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">정책 ID</div><div class="font-mono font-bold">#${p.policy_id}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">서비스유형</div><div class="font-bold">${p.service_type||'DEFAULT'}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">상태</div><div class="${p.is_active ? 'text-green-600 font-bold' : 'text-gray-400'}">${p.is_active ? '활성' : '비활성'}</div></div>
    </div>
    <div>
      <div class="text-xs font-semibold text-gray-600 mb-2"><i class="fas fa-camera mr-1"></i>필수 사진 요건 (총 ${totalPhotos}장)</div>
      <div class="grid grid-cols-4 gap-2">
        ${Object.entries(photos).map(([k,v]) => `
          <div class="text-center p-2 rounded-lg ${Number(v)>0?'bg-blue-50 border border-blue-200':'bg-gray-50 border border-gray-200'}">
            <div class="text-lg font-bold ${Number(v)>0?'text-blue-700':'text-gray-400'}">${v}</div>
            <div class="text-[10px] ${Number(v)>0?'text-blue-600':'text-gray-400'}">${k}</div>
          </div>`).join('')}
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-gray-50 rounded-lg p-3">
        <div class="text-xs font-semibold text-gray-600 mb-1"><i class="fas fa-receipt mr-1"></i>영수증 필수</div>
        <div class="${p.require_receipt ? 'text-green-600 font-bold' : 'text-gray-400'}">${p.require_receipt ? '필수' : '선택'}</div>
      </div>
      <div class="bg-gray-50 rounded-lg p-3">
        <div class="text-xs font-semibold text-gray-600 mb-1"><i class="fas fa-list-check mr-1"></i>체크리스트 (${checklist.length}항목)</div>
        ${checklist.length ? `<ul class="text-xs text-gray-700 space-y-0.5">${checklist.map(c => `<li><i class="fas fa-check text-green-500 mr-1 text-[10px]"></i>${escapeHtml(c)}</li>`).join('')}</ul>` : '<span class="text-gray-400 text-xs">없음</span>'}
      </div>
    </div>
    <div class="bg-emerald-50 rounded-lg p-3 text-xs text-emerald-700">
      <i class="fas fa-info-circle mr-1"></i><strong>적용 범위:</strong> 이 정책이 활성화되면 서비스유형 <strong>"${p.service_type||'DEFAULT'}"</strong>에 해당하는 모든 작업 보고서에 위 요건이 적용됩니다. 사진 수가 부족하거나 체크리스트 미충족 시 보고서 제출이 거부됩니다.
    </div>
  </div>`;
  showModal(`보고서 정책 상세 — ${escapeHtml(p.name)}`, content, `<button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`);
}

// ═══════════════════════════════════════════
// 수수료 정책 테이블 + 상세 모달
// ═══════════════════════════════════════════
function renderCommissionPolicyTable(policies) {
  const canEditPolicy = canEdit('policy');
  const _commActions = p => `<div class="flex gap-1 justify-center">
    <button onclick='showCommissionDetailModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs hover:bg-indigo-100" title="상세보기"><i class="fas fa-eye"></i></button>
    <button onclick='showEditCommissionModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"><i class="fas fa-edit"></i></button>
    <button onclick="toggleCommissionActive(${p.commission_policy_id},${p.is_active?0:1})" class="px-2 py-1 ${p.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} rounded text-xs hover:opacity-80">${p.is_active ? '비활성' : '활성'}</button>
    ${!p.is_active ? `<button onclick="deleteCommissionPolicy(${p.commission_policy_id})" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"><i class="fas fa-trash"></i></button>` : ''}
  </div>`;
  // 총판별 그룹 요약
  const orgGroups = {};
  policies.forEach(p => { const k = p.org_name||'미지정'; orgGroups[k] = (orgGroups[k]||0)+1; });
  const orgSummary = Object.entries(orgGroups).map(([k,v]) => `<span class="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] mr-1 mb-1">${k}(${v})</span>`).join('');

  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <div class="flex items-center justify-between mb-2">
        <div>
          <h3 class="font-semibold">수수료(정률/정액) 정책</h3>
          <p class="text-xs text-gray-500 mt-1">정률(PERCENT): 주문금액의 %를 수수료로 차감 · 정액(FIXED): 건당 고정금액 차감</p>
          ${orgSummary ? `<div class="mt-2">${orgSummary}</div>` : ''}
        </div>
        ${canEditPolicy ? `<button onclick="showNewCommissionModal()" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>추가</button>` : ''}
      </div>
      ${renderDataTable({ columns: [
        { key: 'commission_policy_id', label: 'ID', render: p => `<span class="font-mono text-xs">${p.commission_policy_id}</span>` },
        { key: 'org_name', label: '지역총판', render: p => `<button onclick='showCommissionDetailModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="text-left text-blue-700 hover:underline font-medium">${escapeHtml(p.org_name||'-')}</button>` },
        { key: 'team_leader_name', label: '대상 팀장', render: p => escapeHtml(p.team_leader_name || '') || '<span class="text-gray-400">총판 기본</span>' },
        { key: 'mode', label: '유형', align: 'center', render: p => `<span class="status-badge ${p.mode === 'PERCENT' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}">${p.mode === 'PERCENT' ? '정률' : '정액'}</span>` },
        { key: 'value', label: '값', align: 'right', render: p => `<span class="font-bold text-lg">${p.mode === 'PERCENT' ? p.value + '%' : formatAmount(p.value)}</span>` },
        { key: 'effective_from', label: '적용일', render: p => `<span class="text-xs">${p.effective_from || '-'}</span>` },
        { key: 'is_active', label: '상태', align: 'center', render: p => p.is_active ? '<span class="text-green-600 font-bold">활성</span>' : '<span class="text-gray-400">비활성</span>' },
        { key: '_actions', label: '관리', align: 'center', show: canEditPolicy, render: _commActions }
      ], rows: policies, compact: true, noBorder: true, emptyText: '수수료 정책이 없습니다.' })}
    </div>`;
}

// 수수료 상세 모달
function showCommissionDetailModal(p) {
  const simExample = p.mode === 'PERCENT' ? `주문금액 100,000원 기준 수수료: ${(100000 * p.value / 100).toLocaleString()}원 (지급액: ${(100000 - 100000*p.value/100).toLocaleString()}원)` : `건당 수수료: ${Number(p.value).toLocaleString()}원 차감`;
  const content = `<div class="space-y-4">
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">정책 ID</div><div class="font-mono font-bold">#${p.commission_policy_id}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">상태</div><div class="${p.is_active?'text-green-600 font-bold':'text-gray-400'}">${p.is_active?'활성':'비활성'}</div></div>
    </div>
    <div class="bg-amber-50 rounded-lg p-4 border border-amber-200">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs text-amber-600 mb-1">수수료 유형</div>
          <div class="text-xl font-bold ${p.mode==='PERCENT'?'text-blue-700':'text-amber-700'}">${p.mode==='PERCENT'?'정률 (%)':'정액 (원)'}</div>
        </div>
        <div class="text-right">
          <div class="text-xs text-amber-600 mb-1">수수료 값</div>
          <div class="text-3xl font-bold text-gray-800">${p.mode==='PERCENT'?p.value+'%':formatAmount(p.value)}</div>
        </div>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">대상 총판</div><div class="font-medium text-purple-700">${escapeHtml(p.org_name||'-')}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">대상 팀장</div><div>${escapeHtml(p.team_leader_name||'') || '<span class="text-gray-400">총판 기본 (전체 적용)</span>'}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">적용일</div><div>${p.effective_from||'-'}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">최종수정</div><div class="text-xs">${p.updated_at ? new Date(p.updated_at).toLocaleString('ko-KR') : '-'}</div></div>
    </div>
    <div class="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
      <i class="fas fa-calculator mr-1"></i><strong>시뮬레이션:</strong> ${simExample}
    </div>
  </div>`;
  showModal(`수수료 정책 상세 — ${escapeHtml(p.org_name||'')}`, content, `<button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`);
}

// ═══════════════════════════════════════════
// 지역권 매핑 테이블 + 전국 검색
// ═══════════════════════════════════════════
function renderTerritoryTable(territories) {
  const canEditPolicy = canEdit('policy');
  // 시도별 통계
  const sidoMap = {};
  territories.forEach(t => { sidoMap[t.sido] = sidoMap[t.sido] || { total: 0, mapped: 0 }; sidoMap[t.sido].total++; if (t.org_name) sidoMap[t.sido].mapped++; });
  const sidoList = Object.entries(sidoMap).sort((a,b) => a[0].localeCompare(b[0]));
  const totalMapped = territories.filter(t => t.org_name).length;
  const mappingRate = territories.length ? Math.round(totalMapped/territories.length*100) : 0;

  // 필터 상태
  const filterSido = window._terrFilterSido || '';
  const filterSearch = window._terrFilterSearch || '';
  let filtered = territories;
  if (filterSido) filtered = filtered.filter(t => t.sido === filterSido);
  if (filterSearch) { const q = filterSearch.toLowerCase(); filtered = filtered.filter(t => (t.sido+t.sigungu+t.eupmyeondong+(t.org_name||'')).toLowerCase().includes(q)); }

  return `
    <div class="space-y-4">
      <!-- 매핑 현황 바 -->
      <div class="bg-white rounded-xl p-4 border border-gray-100">
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm font-semibold"><i class="fas fa-map-location-dot mr-1 text-rose-500"></i>지역권 ↔ 지역총판 매핑</div>
          <div class="text-xs text-gray-500">전체 ${territories.length}개 지역권 · 매핑 ${totalMapped}개 (${mappingRate}%)</div>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2 mb-3"><div class="bg-rose-500 h-2 rounded-full transition-all" style="width:${mappingRate}%"></div></div>
        <div class="flex flex-wrap gap-1">
          ${sidoList.map(([sido, info]) => `<span class="inline-block px-2 py-0.5 rounded text-[10px] cursor-pointer transition hover:opacity-80 ${filterSido===sido?'bg-rose-600 text-white':'bg-gray-100 text-gray-600'}" onclick="window._terrFilterSido=${filterSido===sido?"''":"'"+sido+"'"};renderContent()">${sido} <span class="font-bold">${info.mapped}/${info.total}</span></span>`).join('')}
          ${filterSido ? `<span class="inline-block px-2 py-0.5 rounded text-[10px] bg-gray-700 text-white cursor-pointer" onclick="window._terrFilterSido='';renderContent()"><i class="fas fa-times mr-0.5"></i>필터해제</span>` : ''}
        </div>
      </div>

      <!-- 검색 + 테이블 -->
      <div class="bg-white rounded-xl p-5 border border-gray-100">
        <div class="flex items-center justify-between mb-4">
          <div class="flex gap-2 items-center">
            <div class="relative">
              <i class="fas fa-search absolute left-3 top-2.5 text-gray-400 text-xs"></i>
              <input id="terr-search" type="text" placeholder="시도/시군구/읍면동/총판 검색..." class="pl-8 pr-3 py-2 border rounded-lg text-sm w-64" value="${filterSearch}" onkeydown="if(event.key==='Enter'){window._terrFilterSearch=this.value;renderContent()}">
            </div>
            <button onclick="window._terrFilterSearch=document.getElementById('terr-search')?.value||'';renderContent()" class="px-3 py-2 bg-gray-100 rounded-lg text-xs hover:bg-gray-200"><i class="fas fa-filter"></i></button>
            ${filterSearch ? `<button onclick="window._terrFilterSearch='';renderContent()" class="px-2 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg"><i class="fas fa-times"></i> 초기화</button>` : ''}
          </div>
          <div class="flex gap-2">
            ${canEditPolicy ? `<button onclick="showTerritorySearchAddModal()" class="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700"><i class="fas fa-search-plus mr-1"></i>전국 검색 추가</button>` : ''}
          </div>
        </div>
        <div class="text-xs text-gray-400 mb-2">검색 결과: ${filtered.length}건 ${filterSido ? `(${filterSido})` : ''}</div>
        ${renderDataTable({ columns: [
          { key: 'territory_id', label: 'ID', render: t => `<span class="font-mono text-xs">${t.territory_id}</span>` },
          { key: 'sido', label: '시도', render: t => `<span class="font-medium">${t.sido}</span>` },
          { key: 'sigungu', label: '시군구' },
          { key: 'eupmyeondong', label: '읍면동', render: t => escapeHtml(t.eupmyeondong || '-') },
          { key: 'admin_dong_code', label: '행정동코드', render: t => `<span class="font-mono text-xs">${t.admin_dong_code||'-'}</span>` },
          { key: 'org_name', label: '배정 총판', render: t => `<span class="font-medium ${t.org_name ? 'text-purple-700' : 'text-red-500'}">${escapeHtml(t.org_name || '') || '<span class="text-red-500"><i class="fas fa-exclamation-triangle mr-1"></i>미매핑</span>'}</span>` },
          { key: '_actions', label: '관리', align: 'center', show: canEditPolicy, render: t => `<button onclick="showTerritoryMappingModal(${t.territory_id}, '${(t.org_name||'').replace(/'/g,"\\'")}')" class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"><i class="fas fa-edit mr-1"></i>변경</button>` }
        ], rows: filtered, compact: true, noBorder: true, emptyText: '지역권이 없습니다. 전국 검색으로 추가하세요.' })}
      </div>
    </div>`;
}

// 전국 지역권 검색 모달 (전국 territories 250건 + admin_regions 2706건 검색)
async function showTerritorySearchAddModal() {
  try {
  const content = `<div class="space-y-4">
    <div class="bg-blue-50 rounded-lg p-3 text-xs text-blue-700"><i class="fas fa-info-circle mr-1"></i>전국 17개 시도 250개 시군구의 지역권을 검색하여 총판에 매핑할 수 있습니다. 시도를 선택하거나 검색어를 입력하세요.</div>
    <div class="flex gap-2">
      <select id="ts-sido" class="border rounded-lg px-3 py-2 text-sm" onchange="_terrSearchFilter()">
        <option value="">— 시도 선택 —</option>
      </select>
      <input id="ts-query" type="text" placeholder="시군구/읍면동 검색..." class="flex-1 border rounded-lg px-3 py-2 text-sm" onkeydown="if(event.key==='Enter')_terrSearchFilter()">
      <button onclick="_terrSearchFilter()" class="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-search"></i></button>
    </div>
    <div id="ts-results" class="max-h-80 overflow-y-auto border rounded-lg">
      <div class="p-4 text-center text-gray-400 text-sm">시도를 선택하거나 검색어를 입력하세요</div>
    </div>
  </div>`;
  showModal('전국 지역권 검색', content, `<button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`, { width: 'max-w-3xl' });

  // 시도 목록 로드
  const sidoRes = await api('GET', '/hr/regions/sido');
  const sel = document.getElementById('ts-sido');
  if (sel && sidoRes?.sido_list) {
    sidoRes.sido_list.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.sido; opt.textContent = `${s.sido} (${s.district_count}개)`;
      sel.appendChild(opt);
    });
  }
  } catch(e) { console.error('[showTerritorySearchAddModal]', e); showToast('검색 모달 로드 실패', 'error'); }
}

async function _terrSearchFilter() {
  const sido = document.getElementById('ts-sido')?.value || '';
  const q = document.getElementById('ts-query')?.value || '';
  const resultsEl = document.getElementById('ts-results');
  if (!resultsEl) return;
  resultsEl.innerHTML = '<div class="p-4 text-center text-gray-400"><i class="fas fa-spinner fa-spin mr-1"></i>검색 중...</div>';
  try {
    const res = await api('GET', `/stats/territories/search?sido=${encodeURIComponent(sido)}&q=${encodeURIComponent(q)}`);
    const items = res?.territories || [];
    if (!items.length) {
      resultsEl.innerHTML = '<div class="p-4 text-center text-gray-400 text-sm">검색 결과가 없습니다.</div>';
      return;
    }
    resultsEl.innerHTML = `<table class="w-full text-sm"><thead class="bg-gray-50 sticky top-0"><tr>
      <th class="px-2 py-1.5 text-left text-xs">시도</th><th class="px-2 py-1.5 text-left text-xs">시군구</th><th class="px-2 py-1.5 text-left text-xs">읍면동</th><th class="px-2 py-1.5 text-left text-xs">코드</th><th class="px-2 py-1.5 text-left text-xs">현재매핑</th><th class="px-2 py-1.5 text-center text-xs">관리</th>
    </tr></thead><tbody>${items.map(t => `<tr class="border-b border-gray-50 hover:bg-gray-50">
      <td class="px-2 py-1.5 text-xs">${t.sido}</td><td class="px-2 py-1.5 text-xs">${t.sigungu}</td><td class="px-2 py-1.5 text-xs">${t.eupmyeondong||'-'}</td>
      <td class="px-2 py-1.5 font-mono text-[10px]">${t.admin_dong_code||'-'}</td>
      <td class="px-2 py-1.5 text-xs ${t.org_name?'text-purple-700':'text-red-500'}">${t.org_name||'미매핑'}</td>
      <td class="px-2 py-1.5 text-center"><button onclick="showTerritoryMappingModal(${t.territory_id},'${(t.org_name||'').replace(/'/g,"\\'")}')" class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] hover:bg-blue-100">${t.org_name?'변경':'매핑'}</button></td>
    </tr>`).join('')}</tbody></table>`;
  } catch(e) { resultsEl.innerHTML = `<div class="p-4 text-center text-red-500 text-sm">검색 실패: ${e.message||e}</div>`; }
}

// ═══════════════════════════════════════════
// 지표(Metrics) 정책 테이블 + 상세 모달
// ═══════════════════════════════════════════
function renderMetricsPolicyTable(policies) {
  const canEditPolicy = canEdit('policy');
  const _basisLabel = (val) => ({ SUBMITTED_AT:'제출일 기준', HQ_APPROVED_AT:'HQ승인일 기준', SETTLEMENT_CONFIRMED_AT:'정산확정일 기준', DISTRIBUTED_AT:'배분완료 기준', REGION_ACCEPT_AT:'지역접수 기준' }[val] || val || '-');
  const _metricsActions = p => `<div class="flex gap-1 justify-center">
    <button onclick='showMetricsDetailModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs hover:bg-indigo-100" title="상세보기"><i class="fas fa-eye"></i></button>
    <button onclick='showEditMetricsPolicyModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"><i class="fas fa-edit"></i></button>
    <button onclick="toggleMetricsActive(${p.metrics_policy_id},${p.is_active?0:1})" class="px-2 py-1 ${p.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} rounded text-xs hover:opacity-80">${p.is_active ? '비활성' : '활성'}</button>
    ${!p.is_active ? `<button onclick="deleteMetricsPolicy(${p.metrics_policy_id})" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"><i class="fas fa-trash"></i></button>` : ''}
  </div>`;
  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <div class="flex items-center justify-between mb-2">
        <div>
          <h3 class="font-semibold">지표(Metrics) 정책</h3>
          <p class="text-xs text-gray-500 mt-1">통계 대시보드에서 "완료"로 카운트하는 기준과 "지역접수"로 카운트하는 기준을 정의합니다. 활성 정책 1개만 적용됩니다.</p>
        </div>
        ${canEditPolicy ? `<button onclick="showNewMetricsPolicyModal()" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>추가</button>` : ''}
      </div>
      ${renderDataTable({ columns: [
        { key: 'metrics_policy_id', label: 'ID', render: p => `<span class="font-mono text-xs">${p.metrics_policy_id}</span>` },
        { key: 'completion_basis', label: '완료 기준', render: p => `<button onclick='showMetricsDetailModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="text-left text-blue-700 hover:underline">${_basisLabel(p.completion_basis)}</button>` },
        { key: 'region_intake_basis', label: '지역접수 기준', render: p => _basisLabel(p.region_intake_basis) },
        { key: 'effective_from', label: '적용일', render: p => `<span class="text-xs">${p.effective_from || '-'}</span>` },
        { key: 'is_active', label: '상태', align: 'center', render: p => p.is_active ? '<span class="text-green-600 font-bold">활성</span>' : '<span class="text-gray-400">비활성</span>' },
        { key: '_actions', label: '관리', align: 'center', show: canEditPolicy, render: _metricsActions }
      ], rows: policies, compact: true, noBorder: true, emptyText: '지표 정책이 없습니다.' })}
    </div>`;
}

// 지표 정책 상세 모달
function showMetricsDetailModal(p) {
  const _bl = v => ({ SUBMITTED_AT:'제출일(SUBMITTED_AT)', HQ_APPROVED_AT:'HQ승인일(HQ_APPROVED_AT)', SETTLEMENT_CONFIRMED_AT:'정산확정일(SETTLEMENT_CONFIRMED_AT)', DISTRIBUTED_AT:'배분완료(DISTRIBUTED_AT)', REGION_ACCEPT_AT:'지역접수(REGION_ACCEPT_AT)' }[v] || v || '-');
  const content = `<div class="space-y-4">
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">정책 ID</div><div class="font-mono font-bold">#${p.metrics_policy_id}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">상태</div><div class="${p.is_active?'text-green-600 font-bold':'text-gray-400'}">${p.is_active?'활성':'비활성'}</div></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-purple-50 rounded-lg p-4 border border-purple-200">
        <div class="text-xs text-purple-600 mb-2 font-semibold"><i class="fas fa-flag-checkered mr-1"></i>완료 기준</div>
        <div class="font-bold text-purple-800">${_bl(p.completion_basis)}</div>
        <div class="text-[10px] text-purple-500 mt-1">이 시점을 기준으로 주문이 "완료"로 카운트됩니다.</div>
      </div>
      <div class="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
        <div class="text-xs text-cyan-600 mb-2 font-semibold"><i class="fas fa-building mr-1"></i>지역접수 기준</div>
        <div class="font-bold text-cyan-800">${_bl(p.region_intake_basis)}</div>
        <div class="text-[10px] text-cyan-500 mt-1">이 시점을 기준으로 지역총판의 "접수"로 카운트됩니다.</div>
      </div>
    </div>
    <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">적용일</div><div>${p.effective_from||'-'}</div></div>
    <div class="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
      <i class="fas fa-info-circle mr-1"></i><strong>영향 범위:</strong> 이 정책이 활성화되면 통계 대시보드, 지역별 통계, 팀장별 통계의 완료/접수 카운팅 기준이 변경됩니다. 정산 확정 기준과 구분하여 사용하세요.
    </div>
  </div>`;
  showModal(`지표 정책 상세 — #${p.metrics_policy_id}`, content, `<button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`);
}

// ═══════════════════════════════════════════
// 정책 CRUD 모달/핸들러 (기존 + 개선)
// ═══════════════════════════════════════════

// ── 지표 정책 CRUD ──
function showNewMetricsPolicyModal() {
  const content = `<div class="space-y-4">
    <div class="bg-purple-50 rounded-lg p-3 text-xs text-purple-700"><i class="fas fa-info-circle mr-1"></i>새 지표 정책을 생성하면 기존 활성 정책은 자동으로 비활성화됩니다.</div>
    <div><label class="block text-xs text-gray-500 mb-1">완료 기준 *</label>
      <select id="mp-completion" class="w-full border rounded-lg px-3 py-2 text-sm">
        <option value="SUBMITTED_AT">제출일(SUBMITTED_AT) — 팀장이 보고서를 제출한 시점</option>
        <option value="HQ_APPROVED_AT">HQ승인일(HQ_APPROVED_AT) — 본사가 보고서를 승인한 시점</option>
        <option value="SETTLEMENT_CONFIRMED_AT">정산확정일(SETTLEMENT_CONFIRMED_AT) — 정산이 확정된 시점</option>
      </select></div>
    <div><label class="block text-xs text-gray-500 mb-1">지역접수 기준 *</label>
      <select id="mp-intake" class="w-full border rounded-lg px-3 py-2 text-sm">
        <option value="DISTRIBUTED_AT">배분완료(DISTRIBUTED_AT) — 자동배분이 완료된 시점</option>
        <option value="REGION_ACCEPT_AT">지역접수(REGION_ACCEPT_AT) — 지역총판이 접수한 시점</option>
      </select></div>
    <div><label class="block text-xs text-gray-500 mb-1">적용일</label>
      <input id="mp-from" type="date" class="w-full border rounded-lg px-3 py-2 text-sm" value="${new Date().toISOString().split('T')[0]}"></div>
  </div>`;
  showModal('새 지표 정책', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitNewMetricsPolicy()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">생성</button>`);
}
async function submitNewMetricsPolicy() {
  const data = { completion_basis: document.getElementById('mp-completion')?.value, region_intake_basis: document.getElementById('mp-intake')?.value, effective_from: document.getElementById('mp-from')?.value };
  await apiAction('POST', '/stats/policies/metrics', data, { successMsg: '지표 정책 생성 완료', closeModal: true, refresh: true });
}
function showEditMetricsPolicyModal(p) {
  const content = `<div class="space-y-4">
    <div class="bg-gray-50 rounded-lg p-3 text-sm">정책 ID: <strong>#${p.metrics_policy_id}</strong></div>
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
  showConfirmModal('지표 정책 삭제', `#${id} 정책을 삭제하시겠습니까?\n(비활성 정책만 삭제 가능)`, async () => {
    const res = await api('DELETE', `/stats/policies/metrics/${id}`);
    if (res?.ok) { showToast('삭제 완료', 'success'); renderContent(); }
    else showToast(res?.error || '삭제 실패', 'error');
  });
  } catch (e) { console.error('[deleteMetricsPolicy]', e); if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error'); }
}

// ── 배분 정책 CRUD ──
function showNewDistPolicyModal() {
  const content = `<div class="space-y-4">
    <div class="bg-blue-50 rounded-lg p-3 text-xs text-blue-700"><i class="fas fa-info-circle mr-1"></i>새 버전을 생성하면 기존 활성 버전은 자동으로 비활성화됩니다.</div>
    <div><label class="block text-xs text-gray-500 mb-1">정책명 *</label>
      <input id="dp-name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="예: 행정동 기반 자동배분 v2"></div>
    <div><label class="block text-xs text-gray-500 mb-1">규칙 (JSON)</label>
      <textarea id="dp-rule" rows="4" class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder='{"method":"admin_dong_code","fallback":"DISTRIBUTION_PENDING"}'>{"method":"admin_dong_code","fallback":"DISTRIBUTION_PENDING"}</textarea>
      <p class="text-[10px] text-gray-400 mt-1">method: 매칭 방식 (admin_dong_code, sido_sigungu) · fallback: 매칭실패 시 상태</p></div>
    <div><label class="block text-xs text-gray-500 mb-1">적용일</label>
      <input id="dp-from" type="date" class="w-full border rounded-lg px-3 py-2 text-sm" value="${new Date().toISOString().split('T')[0]}"></div>
  </div>`;
  showModal('새 배분 정책 버전', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitNewDistPolicy()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">생성</button>`);
}
async function submitNewDistPolicy() {
  const name = document.getElementById('dp-name')?.value;
  const rule_json = document.getElementById('dp-rule')?.value || '{}';
  const effective_from = document.getElementById('dp-from')?.value;
  if (!name) { showToast('정책명을 입력하세요.', 'warning'); return; }
  try { JSON.parse(rule_json); } catch { showToast('규칙 JSON 형식이 올바르지 않습니다.', 'warning'); return; }
  await apiAction('POST', '/stats/policies/distribution', { name, rule_json, effective_from }, { successMsg: d => `새 버전 v${d.version} 생성 완료`, closeModal: true, refresh: true });
}
function showEditDistPolicyModal(p) {
  const content = `<div class="space-y-4">
    <div class="bg-gray-50 rounded-lg p-3 text-sm">정책 ID: <strong>#${p.policy_id}</strong> · 버전: <strong>v${p.version}</strong></div>
    <div><label class="block text-xs text-gray-500 mb-1">정책명</label>
      <input id="dp-edit-name" class="w-full border rounded-lg px-3 py-2 text-sm" value="${escapeHtml(p.name)}"></div>
    <div><label class="block text-xs text-gray-500 mb-1">규칙 (JSON)</label>
      <textarea id="dp-edit-rule" rows="4" class="w-full border rounded-lg px-3 py-2 text-sm font-mono">${typeof p.rule_json === 'string' ? escapeHtml(p.rule_json) : escapeHtml(JSON.stringify(p.rule_json || {}))}</textarea></div>
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

// ── 공통: 활성/비활성 토글 (배분/보고서) ──
async function togglePolicyActive(type, id, newActive) {
  await apiAction('PUT', `/stats/policies/${type}/${id}`, { is_active: !!newActive }, { successMsg: newActive ? '활성화 완료' : '비활성화 완료', refresh: true });
}

// ── 보고서 정책 CRUD ──
function showNewReportPolicyModal() {
  const content = `<div class="space-y-4">
    <div class="bg-emerald-50 rounded-lg p-3 text-xs text-emerald-700"><i class="fas fa-info-circle mr-1"></i>새 버전을 생성하면 같은 서비스유형의 기존 활성 정책이 비활성화됩니다.</div>
    <div><label class="block text-xs text-gray-500 mb-1">정책명 *</label>
      <input id="rp-name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="예: 기본 보고서 정책 v2"></div>
    <div><label class="block text-xs text-gray-500 mb-1">서비스유형</label>
      <input id="rp-type" class="w-full border rounded-lg px-3 py-2 text-sm" value="DEFAULT" placeholder="DEFAULT, PREMIUM, BASIC 등">
      <p class="text-[10px] text-gray-400 mt-1">서비스유형별로 별도의 보고서 요건을 설정할 수 있습니다.</p></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="block text-xs text-gray-500 mb-1"><i class="fas fa-camera text-blue-500 mr-1"></i>BEFORE 사진 수</label><input id="rp-before" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" value="1" min="0"></div>
      <div><label class="block text-xs text-gray-500 mb-1"><i class="fas fa-camera text-green-500 mr-1"></i>AFTER 사진 수</label><input id="rp-after" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" value="1" min="0"></div>
      <div><label class="block text-xs text-gray-500 mb-1"><i class="fas fa-camera text-cyan-500 mr-1"></i>WASH 사진 수</label><input id="rp-wash" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" value="1" min="0"></div>
      <div><label class="block text-xs text-gray-500 mb-1"><i class="fas fa-camera text-amber-500 mr-1"></i>RECEIPT 사진 수</label><input id="rp-receipt" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" value="1" min="0"></div>
    </div>
    <div><label class="flex items-center gap-2 cursor-pointer"><input id="rp-require-receipt" type="checkbox" checked class="w-4 h-4 rounded text-blue-600"><span class="text-sm">영수증 필수</span></label></div>
    <div><label class="block text-xs text-gray-500 mb-1">체크리스트 항목 (줄바꿈 구분)</label>
      <textarea id="rp-checklist" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="작업완료확인&#10;고객서명확인&#10;현장정리확인">작업완료확인\n고객서명확인\n현장정리확인</textarea></div>
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
function showEditReportPolicyModal(p) {
  let photos = {};
  try { photos = typeof p.required_photos_json === 'string' ? JSON.parse(p.required_photos_json) : (p.required_photos_json || {}); } catch {}
  let checklist = [];
  try { checklist = typeof p.required_checklist_json === 'string' ? JSON.parse(p.required_checklist_json) : (p.required_checklist_json || []); } catch {}
  const content = `<div class="space-y-4">
    <div class="bg-gray-50 rounded-lg p-3 text-sm">정책 ID: <strong>#${p.policy_id}</strong> · 서비스유형: <strong>${p.service_type||'DEFAULT'}</strong></div>
    <div><label class="block text-xs text-gray-500 mb-1">정책명</label>
      <input id="rp-edit-name" class="w-full border rounded-lg px-3 py-2 text-sm" value="${escapeHtml(p.name)}"></div>
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
  showModal(`보고서 정책 수정 — ${escapeHtml(p.name)}`, content, `
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

// ── 수수료 정책 CRUD ──
async function showNewCommissionModal() {
  try {
  const orgsRes = await api('GET', '/auth/organizations');
  const orgs = orgsRes?.organizations || [];
  const content = `<div class="space-y-4">
    <div class="bg-amber-50 rounded-lg p-3 text-xs text-amber-700"><i class="fas fa-info-circle mr-1"></i>정률: 주문금액에서 %를 수수료로 차감 · 정액: 건당 고정 금액 차감. 총판 기본으로 설정하면 해당 총판의 모든 팀장에게 적용됩니다.</div>
    <div><label class="block text-xs text-gray-500 mb-1">대상 총판 *</label>
      <select id="cp-org" class="w-full border rounded-lg px-3 py-2 text-sm">${orgs.map(o => `<option value="${o.org_id}">${escapeHtml(o.name)} (${o.org_type})</option>`).join('')}</select></div>
    <div><label class="block text-xs text-gray-500 mb-1">대상 팀장 ID (비우면 총판 기본)</label>
      <input id="cp-leader" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="선택사항 — 특정 팀장에게만 적용 시 입력"></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="block text-xs text-gray-500 mb-1">유형 *</label>
        <select id="cp-mode" class="w-full border rounded-lg px-3 py-2 text-sm" onchange="_cpModePreview()"><option value="PERCENT">정률 (%)</option><option value="FIXED">정액 (원)</option></select></div>
      <div><label class="block text-xs text-gray-500 mb-1">값 *</label>
        <input id="cp-value" type="number" step="0.1" class="w-full border rounded-lg px-3 py-2 text-sm" value="7.5" onchange="_cpModePreview()"></div>
    </div>
    <div id="cp-preview" class="bg-gray-50 rounded-lg p-3 text-xs text-gray-600"><i class="fas fa-calculator mr-1"></i>10만원 주문 기준: 수수료 7,500원 / 지급액 92,500원</div>
  </div>`;
  showModal('수수료 정책 추가', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitNewCommission()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">추가</button>`);
  } catch (e) { console.error('[showNewCommissionModal]', e); if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error'); }
}

function _cpModePreview() {
  const mode = document.getElementById('cp-mode')?.value || document.getElementById('cp-edit-mode')?.value;
  const val = +(document.getElementById('cp-value')?.value || document.getElementById('cp-edit-value')?.value || 0);
  const el = document.getElementById('cp-preview') || document.getElementById('cp-edit-preview');
  if (!el) return;
  if (mode === 'PERCENT') {
    const fee = Math.round(100000 * val / 100);
    el.innerHTML = `<i class="fas fa-calculator mr-1"></i>10만원 주문 기준: 수수료 ${fee.toLocaleString()}원 / 지급액 ${(100000-fee).toLocaleString()}원`;
  } else {
    el.innerHTML = `<i class="fas fa-calculator mr-1"></i>건당 수수료: ${Number(val).toLocaleString()}원 차감`;
  }
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
function showEditCommissionModal(p) {
  const content = `<div class="space-y-4">
    <div class="bg-gray-50 rounded-lg p-3 text-sm"><strong>${escapeHtml(p.org_name||'-')}</strong> ${p.team_leader_name ? '· 팀장: ' + escapeHtml(p.team_leader_name) : '· 총판 기본 (전체 적용)'}</div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="block text-xs text-gray-500 mb-1">유형</label>
        <select id="cp-edit-mode" class="w-full border rounded-lg px-3 py-2 text-sm" onchange="_cpModePreview()"><option value="PERCENT" ${p.mode==='PERCENT'?'selected':''}>정률 (%)</option><option value="FIXED" ${p.mode==='FIXED'?'selected':''}>정액 (원)</option></select></div>
      <div><label class="block text-xs text-gray-500 mb-1">값</label>
        <input id="cp-edit-value" type="number" step="0.1" class="w-full border rounded-lg px-3 py-2 text-sm" value="${p.value}" onchange="_cpModePreview()"></div>
    </div>
    <div id="cp-edit-preview" class="bg-gray-50 rounded-lg p-3 text-xs text-gray-600"><i class="fas fa-calculator mr-1"></i>${p.mode==='PERCENT'?`10만원 주문 기준: 수수료 ${Math.round(100000*p.value/100).toLocaleString()}원`:`건당 ${Number(p.value).toLocaleString()}원 차감`}</div>
  </div>`;
  showModal(`수수료 수정 — ${escapeHtml(p.org_name||'')}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitEditCommission(${p.commission_policy_id})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">저장</button>`);
}
async function submitEditCommission(id) {
  await apiAction('PUT', `/stats/policies/commission/${id}`, {
    mode: document.getElementById('cp-edit-mode').value,
    value: +document.getElementById('cp-edit-value').value,
  }, { successMsg: '수정 완료', closeModal: true, refresh: true });
}
async function toggleCommissionActive(id, newActive) {
  await apiAction('PUT', `/stats/policies/commission/${id}`, { is_active: !!newActive }, { successMsg: newActive ? '활성화 완료' : '비활성화 완료', refresh: true });
}

// ── 삭제 ──
async function deletePolicy(type, id) {
  try {
  const typeLabel = type === 'distribution' ? '배분' : '보고서';
  showConfirmModal(`${typeLabel} 정책 삭제`, `#${id} ${typeLabel} 정책을 삭제하시겠습니까?\n(비활성 정책만 삭제 가능)`, async () => {
    const res = await api('DELETE', `/stats/policies/${type}/${id}`);
    if (res?.ok) { showToast('삭제 완료', 'success'); renderContent(); }
    else showToast(res?.error || '삭제 실패', 'error');
  });
  } catch (e) { console.error('[deletePolicy]', e); if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error'); }
}
async function deleteCommissionPolicy(id) {
  try {
  showConfirmModal('수수료 정책 삭제', `#${id} 수수료 정책을 삭제하시겠습니까?\n(비활성 정책만 삭제 가능)`, async () => {
    const res = await api('DELETE', `/stats/policies/commission/${id}`);
    if (res?.ok) { showToast('삭제 완료', 'success'); renderContent(); }
    else showToast(res?.error || '삭제 실패', 'error');
  });
  } catch (e) { console.error('[deleteCommissionPolicy]', e); if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error'); }
}

// ── 지역권 매핑 변경 ──
async function showTerritoryMappingModal(territoryId, currentOrgName) {
  try {
  const orgsRes = await api('GET', '/auth/organizations');
  const orgs = (orgsRes?.organizations || []).filter(o => o.org_type === 'REGION');
  const content = `<div class="space-y-4">
    <div class="bg-gray-50 rounded-lg p-3 text-sm">지역권 ID: <strong>#${territoryId}</strong></div>
    <div class="flex items-center gap-3 py-2">
      <span class="text-sm text-gray-500">현재 배정:</span>
      <span class="font-medium ${currentOrgName ? 'text-purple-700' : 'text-red-500'}">${currentOrgName || '미매핑'}</span>
      <i class="fas fa-arrow-right text-gray-400"></i>
      <span class="text-sm text-gray-500">새 배정:</span>
    </div>
    <div><label class="block text-xs text-gray-500 mb-1">배정할 지역총판 (REGION)</label>
      <select id="tm-org" class="w-full border rounded-lg px-3 py-2 text-sm">${orgs.map(o => `<option value="${o.org_id}">${escapeHtml(o.name)}</option>`).join('')}</select></div>
    <div class="bg-amber-50 rounded-lg p-3 text-xs text-amber-700"><i class="fas fa-exclamation-triangle mr-1"></i>매핑을 변경하면 이 지역에서 신규 인입되는 주문이 선택된 총판에 자동 배분됩니다. 기존 진행 중인 주문은 영향받지 않습니다.</div>
  </div>`;
  showModal(`지역권 매핑 변경 — #${territoryId}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitTerritoryMapping(${territoryId})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">변경</button>`);
  } catch (e) { console.error('[showTerritoryMappingModal]', e); if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error'); }
}
async function submitTerritoryMapping(territoryId) {
  const orgId = +document.getElementById('tm-org').value;
  await apiAction('PUT', `/stats/territories/${territoryId}/mapping`, { org_id: orgId }, { successMsg: '매핑 변경 완료', closeModal: true, refresh: true });
}
