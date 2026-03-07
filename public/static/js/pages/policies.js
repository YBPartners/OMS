// ============================================================
// Airflow OMS — 정책관리 메인 v10.0 (R13 고도화)
// 진입점 + 탭 라우팅 + 요약 대시보드 + 전체현황 + 이력
// ============================================================

async function renderPolicies(el) {
  try {
    showSkeletonLoading(el, 'table');
    
    // ★ 통합 API: 7개 호출 → 1개로 병합 (속도 대폭 향상)
    const allRes = await api('GET', '/stats/policies/all');

    const activeTab = window._policyTab || 'overview';
    const summary = allRes?.summary || {};
    const distPolicies = allRes?.distribution?.policies || [];
    const reportPolicies = allRes?.report?.policies || [];
    const commPolicies = allRes?.commission?.policies || [];
    const territories = allRes?.territories || [];
    const metricsPolicies = allRes?.metrics?.policies || [];
    const pricingData = { prices: allRes?.pricing?.prices || [], categories: allRes?.pricing?.categories || [], channels: allRes?.pricing?.channels || [], options: allRes?.pricing?.options || [] };

    // 전역 캐시
    window._cachedDistPolicies = distPolicies;
    window._cachedReportPolicies = reportPolicies;
    window._cachedCommPolicies = commPolicies;
    window._cachedTerritories = territories;
    window._cachedMetricsPolicies = metricsPolicies;
    window._cachedPricingData = pricingData;
    window._cachedPolicySummary = summary;
    window._cachedAdminRegionMappings = allRes?.admin_region_mappings || [];

    const tabs = [
      { id: 'overview', icon: 'fa-gauge-high', label: '전체 현황' },
      { id: 'distribution', icon: 'fa-share-nodes', label: '배분 정책', count: distPolicies.length },
      { id: 'report', icon: 'fa-file-lines', label: '보고서 정책', count: reportPolicies.length },
      { id: 'commission', icon: 'fa-percent', label: '수수료 정책', count: commPolicies.length },
      { id: 'pricing', icon: 'fa-won-sign', label: '가격 정책', count: pricingData.prices.length },
      { id: 'territory', icon: 'fa-map-location-dot', label: '시군구 매핑', count: territories.length },
      { id: 'metrics', icon: 'fa-chart-bar', label: '지표 정책', count: metricsPolicies.length },
      { id: 'audit', icon: 'fa-clock-rotate-left', label: '변경 이력' },
    ];

    el.innerHTML = `
      <div class="fade-in">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-gears mr-2 text-gray-600"></i>정책관리</h2>
          <button onclick="renderContent()" class="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 transition"><i class="fas fa-sync mr-1"></i>새로고침</button>
        </div>

        <!-- 요약 카드 -->
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          ${_policySummaryCards(summary)}
        </div>

        <!-- 탭 -->
        <div class="flex gap-1 mb-6 border-b overflow-x-auto pb-px">
          ${tabs.map(t => {
            const badge = t.count ? `<span class="ml-1 px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full text-[10px]">${t.count}</span>` : '';
            return `<button onclick="window._policyTab='${t.id}';renderContent()" class="px-4 py-2.5 text-sm whitespace-nowrap border-b-2 ${activeTab === t.id ? 'border-blue-600 text-blue-700 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'} transition"><i class="fas ${t.icon} mr-1"></i>${t.label}${badge}</button>`;
          }).join('')}
        </div>

        <div id="policy-content">
          ${activeTab === 'overview' ? _policyOverviewTab(summary) : ''}
          ${activeTab === 'distribution' ? renderDistPolicyTab(distPolicies) : ''}
          ${activeTab === 'report' ? renderReportPolicyTab(reportPolicies) : ''}
          ${activeTab === 'commission' ? renderCommPolicyTab(commPolicies) : ''}
          ${activeTab === 'pricing' ? renderPricingTab(pricingData) : ''}
          ${activeTab === 'territory' ? renderTerritoryTab(territories) : ''}
          ${activeTab === 'metrics' ? renderMetricsPolicyTab(metricsPolicies) : ''}
          ${activeTab === 'audit' ? '<div id="audit-tab-loader"></div>' : ''}
        </div>
      </div>`;

    // 비동기 이력 탭 로드
    if (activeTab === 'audit') _loadAuditTab();

  } catch (e) {
    console.error('[renderPolicies]', e);
    el.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1 text-gray-400">' + (e.message||e) + '</p></div>';
  }
}

// ─── 요약 카드 ───
function _policySummaryCards(s) {
  const cards = [
    { icon:'fa-share-nodes', color:'blue', label:'배분', val:`${s.distribution?.active||0}/${s.distribution?.total||0}`, sub:'활성/전체', tab:'distribution' },
    { icon:'fa-file-lines', color:'emerald', label:'보고서', val:`${s.report?.active||0}/${s.report?.total||0}`, sub:'활성/전체', tab:'report' },
    { icon:'fa-percent', color:'amber', label:'수수료', val:`${s.commission?.active||0}/${s.commission?.total||0}`, sub:'활성/전체', tab:'commission' },
    { icon:'fa-won-sign', color:'yellow', label:'가격정책', val:`${window._cachedPricingData?.prices?.length||0}건`, sub:'항목별 단가', tab:'pricing' },
    { icon:'fa-chart-bar', color:'purple', label:'지표', val:`${s.metrics?.active||0}/${s.metrics?.total||0}`, sub:'활성/전체', tab:'metrics' },
    { icon:'fa-map-location-dot', color:'rose', label:'시군구', val:`${s.sigungu?.total||0}`, sub:`${s.sigungu?.sido_cnt||0}개 시도`, tab:'territory' },
    { icon:'fa-earth-asia', color:'cyan', label:'매핑', val:`${s.region_mappings?.total||0}`, sub:'총판 매핑', tab:'territory' },
    { icon:'fa-boxes-stacked', color:'orange', label:'활성주문', val:`${s.active_orders||0}`, sub:'배분 대기', tab:'overview' },
  ];
  return cards.map(c => `
    <div class="bg-white rounded-xl p-3 border border-gray-100 hover:shadow-md transition cursor-pointer" onclick="window._policyTab='${c.tab||'overview'}';renderContent()">
      <div class="flex items-center gap-2 mb-1"><div class="w-7 h-7 rounded-lg bg-${c.color}-100 flex items-center justify-center"><i class="fas ${c.icon} text-${c.color}-600 text-xs"></i></div><span class="text-[11px] text-gray-500">${c.label}</span></div>
      <div class="text-lg font-bold text-gray-800">${c.val}</div>
      <div class="text-[10px] text-gray-400">${c.sub}</div>
    </div>`).join('');
}

// ─── 전체 현황 탭 ───
function _policyOverviewTab(s) {
  const audit = s.recent_audit || [];
  const _icon = a => a === 'CREATE' ? '<i class="fas fa-plus text-green-500 text-xs"></i>' : a === 'UPDATE' ? '<i class="fas fa-pen text-blue-500 text-xs"></i>' : a === 'DELETE' ? '<i class="fas fa-trash text-red-500 text-xs"></i>' : a === 'CLONE' ? '<i class="fas fa-copy text-purple-500 text-xs"></i>' : '<i class="fas fa-circle text-gray-400 text-xs"></i>';
  const _lbl = t => ({ DISTRIBUTION_POLICY:'배분', REPORT_POLICY:'보고서', COMMISSION_POLICY:'수수료', METRICS_POLICY:'지표', TERRITORY:'시군구', ORG_REGION_MAPPING:'시군구매핑', REGION_MAPPING:'시군구매핑', SIGUNGU_MAPPING:'시군구매핑' }[t] || t);
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
          <div class="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-4 cursor-pointer hover:shadow-sm transition" onclick="window._policyTab='territory';renderContent()">
            <div class="text-xs text-gray-500 mb-1"><i class="fas fa-earth-asia mr-1"></i>전국 시군구</div>
            <div class="text-2xl font-bold text-indigo-700">${s.sigungu?.total||0}<span class="text-sm font-normal text-gray-500 ml-1">시군구</span></div>
            <div class="text-xs text-gray-500 mt-1">${s.sigungu?.sido_cnt||0}개 시도</div>
          </div>
          <div class="bg-gradient-to-r from-rose-50 to-pink-50 rounded-lg p-4 cursor-pointer hover:shadow-sm transition" onclick="window._policyTab='territory';renderContent()">
            <div class="text-xs text-gray-500 mb-1"><i class="fas fa-map-pin mr-1"></i>총판 매핑</div>
            <div class="text-2xl font-bold text-rose-700">${s.region_mappings?.total||0}<span class="text-sm font-normal text-gray-500 ml-1">매핑</span></div>
            <div class="text-xs text-gray-500 mt-1">총판 ↔ 시군구 매핑</div>
          </div>
        </div>
      </div>
    </div>
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold"><i class="fas fa-clock-rotate-left mr-2 text-gray-500"></i>최근 정책 변경 이력</h3>
        <button onclick="window._policyTab='audit';renderContent()" class="text-xs text-blue-600 hover:underline">전체 이력 보기 →</button>
      </div>
      ${audit.length ? `<div class="space-y-1">${audit.slice(0,8).map(a => {
        let detail = '-';
        try { const d = JSON.parse(a.detail_json||'{}'); detail = Object.entries(d).slice(0,3).map(([k,v])=>k+'='+v).join(', '); } catch { detail = (a.detail_json||'').substring(0,60); }
        return `<div class="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded px-2">
          <div class="w-6 text-center">${_icon(a.action)}</div>
          <div class="flex-1 min-w-0"><div class="text-sm"><span class="font-medium">${_lbl(a.entity_type)}</span> #${a.entity_id||'-'} <span class="text-gray-400">${a.action}</span></div><div class="text-[11px] text-gray-400 truncate">${detail}</div></div>
          <div class="text-right shrink-0"><div class="text-[11px] text-gray-500">${a.actor_name||'-'}</div><div class="text-[10px] text-gray-400">${a.created_at ? new Date(a.created_at).toLocaleString('ko-KR') : '-'}</div></div>
        </div>`;
      }).join('')}</div>` : '<div class="text-center text-gray-400 py-4 text-sm">이력 없음</div>'}
    </div>
  </div>`;
}

// ─── 변경 이력 탭 (비동기 로드) ───
async function _loadAuditTab() {
  const el = document.getElementById('audit-tab-loader');
  if (!el) return;
  el.innerHTML = '<div class="p-4 text-center text-gray-400"><i class="fas fa-spinner fa-spin mr-1"></i>이력 로딩 중...</div>';
  try {
    const typeFilter = window._auditTypeFilter || '';
    const res = await api('GET', `/stats/policies/audit?type=${typeFilter}&limit=100`);
    const logs = res?.audit_logs || [];
    const types = ['','DISTRIBUTION_POLICY','REPORT_POLICY','COMMISSION_POLICY','METRICS_POLICY','TERRITORY','ORG_REGION_MAPPING'];
    const typeLabels = { '':'전체', DISTRIBUTION_POLICY:'배분', REPORT_POLICY:'보고서', COMMISSION_POLICY:'수수료', METRICS_POLICY:'지표', TERRITORY:'시군구', ORG_REGION_MAPPING:'시군구매핑', REGION_MAPPING:'시군구매핑', SIGUNGU_MAPPING:'시군구매핑' };
    const _icon = a => ({ CREATE:'<i class="fas fa-plus text-green-500"></i>', UPDATE:'<i class="fas fa-pen text-blue-500"></i>', DELETE:'<i class="fas fa-trash text-red-500"></i>', CLONE:'<i class="fas fa-copy text-purple-500"></i>', 'BULK_MAPPING':'<i class="fas fa-layer-group text-teal-500"></i>', 'REGION.MAPPED':'<i class="fas fa-link text-indigo-500"></i>', 'REGION.UNMAPPED':'<i class="fas fa-unlink text-orange-500"></i>' }[a] || '<i class="fas fa-circle text-gray-400"></i>');
    const actionLabel = a => ({ CREATE:'생성', UPDATE:'수정', DELETE:'삭제', CLONE:'복제', BULK_CREATE:'일괄생성', BULK_MAPPING:'일괄매핑', 'REGION.MAPPED':'매핑', 'REGION.UNMAPPED':'매핑해제' }[a] || a);

    el.innerHTML = `<div class="space-y-4">
      <div class="bg-white rounded-xl p-4 border border-gray-100">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold"><i class="fas fa-clock-rotate-left mr-2 text-gray-500"></i>정책 변경 이력 (최근 100건)</h3>
        </div>
        <div class="flex gap-1 mb-4 flex-wrap">
          ${types.map(t => `<button onclick="window._auditTypeFilter='${t}';_loadAuditTab()" class="px-2.5 py-1 rounded-full text-xs ${typeFilter===t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} transition">${typeLabels[t]||t}</button>`).join('')}
        </div>
        ${logs.length ? `<div class="space-y-1 max-h-[60vh] overflow-y-auto">${logs.map(a => {
          let detail = '';
          try { const d = JSON.parse(a.detail_json||'{}'); detail = Object.entries(d).slice(0,4).map(([k,v])=>k+': '+JSON.stringify(v)).join(' · '); } catch { detail = (a.detail_json||'').substring(0,80); }
          return `<div class="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-blue-50/50 rounded px-2 transition">
            <div class="w-7 text-center">${_icon(a.action)}</div>
            <div class="flex-1 min-w-0">
              <div class="text-sm"><span class="font-semibold text-gray-800">${typeLabels[a.entity_type]||a.entity_type}</span> <span class="font-mono text-xs text-gray-500">#${a.entity_id||'-'}</span> <span class="status-badge bg-gray-100 text-gray-600 text-[10px]">${actionLabel(a.action)}</span></div>
              <div class="text-[11px] text-gray-400 truncate mt-0.5">${escapeHtml(detail)}</div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-[11px] font-medium text-gray-600">${a.actor_name||'시스템'}</div>
              <div class="text-[10px] text-gray-400">${a.created_at ? new Date(a.created_at).toLocaleString('ko-KR') : '-'}</div>
            </div>
          </div>`;
        }).join('')}</div>` : '<div class="text-center text-gray-400 py-8"><i class="fas fa-inbox text-3xl mb-2"></i><p class="text-sm">이력이 없습니다.</p></div>'}
      </div>
    </div>`;
  } catch (e) { el.innerHTML = `<div class="p-4 text-center text-red-500">${e.message||e}</div>`; }
}

// ─── 공통: 활성/비활성 토글 ───
async function togglePolicyActive(type, id, newActive) {
  await apiAction('PUT', `/stats/policies/${type}/${id}`, { is_active: !!newActive }, { successMsg: newActive ? '활성화 완료' : '비활성화 완료', refresh: true });
}

// ─── 공통: 삭제 ───
async function deletePolicy(type, id) {
  const typeLabel = { distribution:'배분', report:'보고서' }[type] || type;
  showConfirmModal(`${typeLabel} 정책 삭제`, `#${id} ${typeLabel} 정책을 삭제하시겠습니까?\n(비활성 정책만 삭제 가능)`, async () => {
    const res = await api('DELETE', `/stats/policies/${type}/${id}`);
    if (res?.ok) { showToast('삭제 완료', 'success'); renderContent(); }
    else showToast(res?.error || '삭제 실패', 'error');
  }, '삭제', 'bg-red-600');
}

// ─── 공통: 복제 ───
async function clonePolicy(type, id) {
  try {
    const res = await api('POST', `/stats/policies/${type}/${id}/clone`);
    if (res?.ok) { showToast(`복제 완료 (v${res.version||''})`, 'success'); renderContent(); }
    else showToast(res?.error || '복제 실패', 'error');
  } catch (e) { showToast('복제 실패: ' + (e.message||e), 'error'); }
}

// ─── 공통: apiAction 래퍼 ───
async function _policyApiAction(method, path, body, opts = {}) {
  await apiAction(method, path, body, { closeModal: true, refresh: true, ...opts });
}
