// ============================================================
// 다하다 OMS - 통계 + 정책관리 페이지
// ============================================================

// ════════ 통계 ════════
async function renderStatistics(el) {
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
          <button onclick="exportCSV('region')" class="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200"><i class="fas fa-download mr-1"></i>지역별 CSV</button>
          <button onclick="exportCSV('team_leader')" class="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200"><i class="fas fa-download mr-1"></i>팀장별 CSV</button>
        </div>
      </div>

      <!-- 날짜 필터 -->
      <div class="bg-white rounded-xl p-4 mb-6 border border-gray-100 flex flex-wrap gap-3 items-end">
        <div><label class="block text-xs text-gray-500 mb-1">시작일</label>
          <input id="stat-from" type="date" class="border rounded-lg px-3 py-2 text-sm" value="${weekAgo}"></div>
        <div><label class="block text-xs text-gray-500 mb-1">종료일</label>
          <input id="stat-to" type="date" class="border rounded-lg px-3 py-2 text-sm" value="${today}"></div>
        <button onclick="refreshStats()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"><i class="fas fa-search mr-1"></i>조회</button>
      </div>

      <!-- 지역법인별 통계 -->
      <div class="bg-white rounded-xl p-5 border border-gray-100 mb-6">
        <h3 class="font-semibold mb-4"><i class="fas fa-building mr-2 text-blue-500"></i>지역법인별 통계</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50"><tr>
              <th class="px-3 py-2 text-left">날짜</th><th class="px-3 py-2 text-left">지역법인</th>
              <th class="px-3 py-2 text-right">인입</th><th class="px-3 py-2 text-right">팀장배정</th>
              <th class="px-3 py-2 text-right">완료</th><th class="px-3 py-2 text-right">지역승인</th>
              <th class="px-3 py-2 text-right">HQ승인</th><th class="px-3 py-2 text-right">정산확정</th>
            </tr></thead>
            <tbody class="divide-y" id="region-stats-body">
              ${(regionRes?.stats || []).map(s => `
                <tr class="hover:bg-gray-50">
                  <td class="px-3 py-2 text-xs">${s.date}</td>
                  <td class="px-3 py-2 font-medium">${s.region_name}</td>
                  <td class="px-3 py-2 text-right">${s.intake_count || 0}</td>
                  <td class="px-3 py-2 text-right">${s.assigned_to_team_count || 0}</td>
                  <td class="px-3 py-2 text-right">${s.completed_count || 0}</td>
                  <td class="px-3 py-2 text-right">${s.region_approved_count || 0}</td>
                  <td class="px-3 py-2 text-right">${s.hq_approved_count || 0}</td>
                  <td class="px-3 py-2 text-right font-bold text-green-600">${s.settlement_confirmed_count || 0}</td>
                </tr>`).join('')}
              ${(regionRes?.stats || []).length === 0 ? '<tr><td colspan="8" class="px-3 py-4 text-center text-gray-400">데이터 없음</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 팀장별 통계 -->
      <div class="bg-white rounded-xl p-5 border border-gray-100">
        <h3 class="font-semibold mb-4"><i class="fas fa-users mr-2 text-purple-500"></i>팀장별 통계</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50"><tr>
              <th class="px-3 py-2 text-left">날짜</th><th class="px-3 py-2 text-left">팀장명</th>
              <th class="px-3 py-2 text-left">법인</th><th class="px-3 py-2 text-right">수임</th>
              <th class="px-3 py-2 text-right">제출</th><th class="px-3 py-2 text-right">HQ승인</th>
              <th class="px-3 py-2 text-right">정산확정</th><th class="px-3 py-2 text-right">지급액합</th>
            </tr></thead>
            <tbody class="divide-y" id="tl-stats-body">
              ${(tlRes?.stats || []).map(s => `
                <tr class="hover:bg-gray-50">
                  <td class="px-3 py-2 text-xs">${s.date}</td>
                  <td class="px-3 py-2 font-medium">${s.team_leader_name}</td>
                  <td class="px-3 py-2 text-gray-500">${s.org_name || '-'}</td>
                  <td class="px-3 py-2 text-right">${s.intake_count || 0}</td>
                  <td class="px-3 py-2 text-right">${s.submitted_count || 0}</td>
                  <td class="px-3 py-2 text-right">${s.hq_approved_count || 0}</td>
                  <td class="px-3 py-2 text-right">${s.settlement_confirmed_count || 0}</td>
                  <td class="px-3 py-2 text-right font-bold text-green-600">${formatAmount(s.payable_amount_sum)}</td>
                </tr>`).join('')}
              ${(tlRes?.stats || []).length === 0 ? '<tr><td colspan="8" class="px-3 py-4 text-center text-gray-400">데이터 없음</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

async function refreshStats() {
  renderContent(); // 간단히 전체 렌더
}

async function exportCSV(groupBy) {
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
}

// ════════ 정책관리 ════════
async function renderPolicies(el) {
  const [distRes, reportRes, commRes, terRes] = await Promise.all([
    api('GET', '/stats/policies/distribution'),
    api('GET', '/stats/policies/report'),
    api('GET', '/stats/policies/commission'),
    api('GET', '/stats/territories'),
  ]);

  const activeTab = window._policyTab || 'distribution';

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-gears mr-2 text-gray-600"></i>정책관리</h2>

      <!-- 탭 -->
      <div class="flex gap-1 mb-6 border-b">
        ${['distribution', 'report', 'commission', 'territory'].map(tab => {
          const labels = { distribution: '배분 정책', report: '보고서 정책', commission: '수수료 정책', territory: '지역권 매핑' };
          const icons = { distribution: 'fa-share-nodes', report: 'fa-file-lines', commission: 'fa-percent', territory: 'fa-map-location-dot' };
          return `<button onclick="window._policyTab='${tab}';renderContent()" class="px-4 py-2 text-sm ${activeTab === tab ? 'tab-active' : 'text-gray-500 hover:text-gray-700'}"><i class="fas ${icons[tab]} mr-1"></i>${labels[tab]}</button>`;
        }).join('')}
      </div>

      <div id="policy-content">
        ${activeTab === 'distribution' ? renderDistPolicyTable(distRes?.policies || []) : ''}
        ${activeTab === 'report' ? renderReportPolicyTable(reportRes?.policies || []) : ''}
        ${activeTab === 'commission' ? renderCommissionPolicyTable(commRes?.policies || []) : ''}
        ${activeTab === 'territory' ? renderTerritoryTable(terRes?.territories || []) : ''}
      </div>
    </div>`;
}

function renderDistPolicyTable(policies) {
  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <h3 class="font-semibold mb-4">배분 정책 (행정동 기반 자동배분)</h3>
      <table class="w-full text-sm"><thead class="bg-gray-50"><tr>
        <th class="px-3 py-2 text-left">ID</th><th class="px-3 py-2 text-left">이름</th>
        <th class="px-3 py-2 text-center">버전</th><th class="px-3 py-2 text-center">활성</th>
        <th class="px-3 py-2 text-left">적용일</th>
      </tr></thead><tbody class="divide-y">${policies.map(p => `
        <tr class="hover:bg-gray-50">
          <td class="px-3 py-2">${p.policy_id}</td><td class="px-3 py-2">${p.name}</td>
          <td class="px-3 py-2 text-center">v${p.version}</td>
          <td class="px-3 py-2 text-center">${p.is_active ? '<span class="text-green-600 font-bold">활성</span>' : '비활성'}</td>
          <td class="px-3 py-2 text-xs">${p.effective_from || '-'}</td>
        </tr>`).join('')}
      </tbody></table>
    </div>`;
}

function renderReportPolicyTable(policies) {
  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <h3 class="font-semibold mb-4">보고서 필수요건 정책</h3>
      <table class="w-full text-sm"><thead class="bg-gray-50"><tr>
        <th class="px-3 py-2 text-left">ID</th><th class="px-3 py-2 text-left">이름</th>
        <th class="px-3 py-2 text-left">서비스유형</th><th class="px-3 py-2 text-left">필수사진</th>
        <th class="px-3 py-2 text-center">영수증</th><th class="px-3 py-2 text-center">활성</th>
      </tr></thead><tbody class="divide-y">${policies.map(p => `
        <tr class="hover:bg-gray-50">
          <td class="px-3 py-2">${p.policy_id}</td><td class="px-3 py-2">${p.name}</td>
          <td class="px-3 py-2">${p.service_type}</td>
          <td class="px-3 py-2 text-xs font-mono">${p.required_photos_json || '{}'}</td>
          <td class="px-3 py-2 text-center">${p.require_receipt ? 'Y' : 'N'}</td>
          <td class="px-3 py-2 text-center">${p.is_active ? '<span class="text-green-600 font-bold">활성</span>' : '비활성'}</td>
        </tr>`).join('')}
      </tbody></table>
    </div>`;
}

function renderCommissionPolicyTable(policies) {
  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <h3 class="font-semibold mb-4">수수료(정률/정액) 정책</h3>
      <p class="text-xs text-gray-500 mb-3">정률(PERCENT): 주문금액의 %를 수수료로 차감 · 정액(FIXED): 건당 고정금액 차감</p>
      <table class="w-full text-sm"><thead class="bg-gray-50"><tr>
        <th class="px-3 py-2 text-left">ID</th><th class="px-3 py-2 text-left">지역법인</th>
        <th class="px-3 py-2 text-left">대상 팀장</th><th class="px-3 py-2 text-center">유형</th>
        <th class="px-3 py-2 text-right">값</th><th class="px-3 py-2 text-left">적용일</th>
        <th class="px-3 py-2 text-center">활성</th>
      </tr></thead><tbody class="divide-y">${policies.map(p => `
        <tr class="hover:bg-gray-50">
          <td class="px-3 py-2">${p.commission_policy_id}</td>
          <td class="px-3 py-2">${p.org_name}</td>
          <td class="px-3 py-2">${p.team_leader_name || '<span class="text-gray-400">법인 기본</span>'}</td>
          <td class="px-3 py-2 text-center"><span class="status-badge ${p.mode === 'PERCENT' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}">${p.mode === 'PERCENT' ? '정률' : '정액'}</span></td>
          <td class="px-3 py-2 text-right font-bold">${p.mode === 'PERCENT' ? p.value + '%' : formatAmount(p.value)}</td>
          <td class="px-3 py-2 text-xs">${p.effective_from || '-'}</td>
          <td class="px-3 py-2 text-center">${p.is_active ? '<span class="text-green-600 font-bold">활성</span>' : '비활성'}</td>
        </tr>`).join('')}
      </tbody></table>
    </div>`;
}

function renderTerritoryTable(territories) {
  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <h3 class="font-semibold mb-4">지역권 ↔ 지역법인 매핑</h3>
      <table class="w-full text-sm"><thead class="bg-gray-50"><tr>
        <th class="px-3 py-2 text-left">시도</th><th class="px-3 py-2 text-left">시군구</th>
        <th class="px-3 py-2 text-left">읍면동</th><th class="px-3 py-2 text-left">행정동코드</th>
        <th class="px-3 py-2 text-left">배정 법인</th>
      </tr></thead><tbody class="divide-y">${territories.map(t => `
        <tr class="hover:bg-gray-50">
          <td class="px-3 py-2">${t.sido}</td><td class="px-3 py-2">${t.sigungu}</td>
          <td class="px-3 py-2">${t.eupmyeondong || '-'}</td>
          <td class="px-3 py-2 font-mono text-xs">${t.admin_dong_code}</td>
          <td class="px-3 py-2 font-medium ${t.org_name ? 'text-purple-700' : 'text-red-500'}">${t.org_name || '미매핑'}</td>
        </tr>`).join('')}
      </tbody></table>
    </div>`;
}
