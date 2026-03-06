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

