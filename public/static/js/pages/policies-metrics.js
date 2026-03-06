// ============================================================
// 와이비 OMS — 지표 정책 탭 v10.0 (R13 고도화)
// 지표 정책 CRUD, 상세 모달, 복제, 활성/비활성
// ============================================================

function renderMetricsPolicyTab(policies) {
  const canEditPolicy = canEdit('policy');
  return `
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h3 class="font-semibold text-lg"><i class="fas fa-chart-bar mr-2 text-purple-500"></i>지표 정책</h3>
          <p class="text-xs text-gray-500 mt-1">팀장/조직의 성과를 측정하는 KPI 지표를 정의합니다. <strong class="text-purple-600">활성 정책 1개만 적용</strong>됩니다.</p>
        </div>
        ${canEditPolicy ? `<button onclick="showNewMetricsPolicyModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"><i class="fas fa-plus mr-1"></i>새 버전</button>` : ''}
      </div>
      ${renderDataTable({ columns: [
        { key: 'metrics_policy_id', label: 'ID', render: p => `<span class="font-mono text-xs text-gray-500">#${p.metrics_policy_id}</span>` },
        { key: 'name', label: '정책명', render: p => `<button onclick="showMetricsDetailModal(${p.metrics_policy_id})" class="text-left text-blue-700 hover:underline font-medium">${escapeHtml(p.name)}</button>` },
        { key: 'version', label: '버전', align: 'center', render: p => `<span class="status-badge bg-purple-100 text-purple-700">v${p.version}</span>` },
        { key: '_metrics', label: '지표 항목', render: p => _renderMetricsSummary(p) },
        { key: 'is_active', label: '상태', align: 'center', render: p => p.is_active ? '<span class="inline-flex items-center gap-1 text-green-600 font-bold"><i class="fas fa-circle text-[6px]"></i>활성</span>' : '<span class="text-gray-400">비활성</span>' },
        { key: '_actions', label: '관리', align: 'center', show: canEditPolicy, render: p => `<div class="flex gap-1 justify-center flex-wrap">
          <button onclick="showMetricsDetailModal(${p.metrics_policy_id})" class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs hover:bg-indigo-100"><i class="fas fa-eye"></i></button>
          <button onclick='showEditMetricsPolicyModal(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"><i class="fas fa-edit"></i></button>
          <button onclick="clonePolicy('metrics',${p.metrics_policy_id})" class="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs hover:bg-purple-100"><i class="fas fa-copy"></i></button>
          <button onclick="togglePolicyActive('metrics',${p.metrics_policy_id},${p.is_active?0:1})" class="px-2 py-1 ${p.is_active?'bg-red-50 text-red-600':'bg-green-50 text-green-600'} rounded text-xs">${p.is_active?'비활성':'활성'}</button>
          ${!p.is_active ? `<button onclick="deleteMetricsPolicy(${p.metrics_policy_id})" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs"><i class="fas fa-trash"></i></button>` : ''}
        </div>` }
      ], rows: policies, compact: true, noBorder: true, emptyText: '지표 정책이 없습니다.' })}
    </div>`;
}

function _renderMetricsSummary(p) {
  let metrics = {};
  try { metrics = typeof p.metrics_json === 'string' ? JSON.parse(p.metrics_json) : (p.metrics_json || {}); } catch {}
  const entries = Object.entries(metrics);
  if (!entries.length) return '<span class="text-gray-400 text-xs">미설정</span>';
  return entries.slice(0, 4).map(([k, v]) => {
    const val = typeof v === 'object' ? (v.weight || v.target || JSON.stringify(v)) : v;
    return `<span class="inline-block px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] mr-0.5 mb-0.5">${k}: ${val}</span>`;
  }).join('') + (entries.length > 4 ? `<span class="text-[10px] text-gray-400 ml-1">+${entries.length - 4}</span>` : '');
}

// ── 지표 정책 상세 모달 ──
function showMetricsDetailModal(policyId) {
  const p = (window._cachedMetricsPolicies||[]).find(x => x.metrics_policy_id === policyId);
  if (!p) { showToast('정책을 찾을 수 없습니다.', 'error'); return; }

  let metrics = {};
  try { metrics = typeof p.metrics_json === 'string' ? JSON.parse(p.metrics_json) : (p.metrics_json || {}); } catch {}
  const metricsDisplay = JSON.stringify(metrics, null, 2);

  const metricIcons = {
    completion_rate: { icon: 'fa-check-circle', color: 'green', label: '완료율' },
    response_time: { icon: 'fa-clock', color: 'blue', label: '응답 시간' },
    customer_satisfaction: { icon: 'fa-star', color: 'amber', label: '고객 만족도' },
    revenue: { icon: 'fa-won-sign', color: 'emerald', label: '매출' },
    order_count: { icon: 'fa-boxes-stacked', color: 'indigo', label: '주문 건수' },
  };

  const content = `<div class="space-y-4">
    <div class="grid grid-cols-3 gap-3">
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">정책 ID</div><div class="font-mono font-bold text-lg">#${p.metrics_policy_id}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">버전</div><div class="font-bold text-purple-700 text-lg">v${p.version}</div></div>
      <div class="bg-gray-50 rounded-lg p-3"><div class="text-[10px] text-gray-400 mb-1">상태</div><div class="${p.is_active?'text-green-600 font-bold':'text-gray-400'}">${p.is_active?'<i class="fas fa-circle text-[8px] mr-1"></i>활성':'비활성'}</div></div>
    </div>

    <div>
      <div class="text-xs font-semibold text-gray-600 mb-2"><i class="fas fa-chart-bar mr-1"></i>KPI 지표 항목</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        ${Object.entries(metrics).map(([key, val]) => {
          const info = metricIcons[key] || { icon: 'fa-chart-simple', color: 'gray', label: key };
          const v = typeof val === 'object' ? val : { value: val };
          return `<div class="bg-${info.color}-50 rounded-lg p-3 border border-${info.color}-200">
            <div class="flex items-center gap-2 mb-1">
              <i class="fas ${info.icon} text-${info.color}-600"></i>
              <span class="text-xs font-semibold text-${info.color}-800">${info.label}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              ${v.weight != null ? `<div><span class="text-gray-400">가중치:</span> <strong>${v.weight}%</strong></div>` : ''}
              ${v.target != null ? `<div><span class="text-gray-400">목표:</span> <strong>${v.target}</strong></div>` : ''}
              ${v.min != null ? `<div><span class="text-gray-400">최소:</span> ${v.min}</div>` : ''}
              ${v.max != null ? `<div><span class="text-gray-400">최대:</span> ${v.max}</div>` : ''}
              ${typeof val !== 'object' ? `<div><span class="text-gray-400">값:</span> <strong>${val}</strong></div>` : ''}
            </div>
            ${v.description ? `<div class="text-[10px] text-gray-500 mt-1">${escapeHtml(v.description)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
      ${!Object.keys(metrics).length ? '<div class="text-center text-gray-400 py-3 text-sm">지표 항목이 설정되지 않았습니다.</div>' : ''}
    </div>

    <details class="bg-gray-50 rounded-lg border">
      <summary class="px-4 py-2 text-xs text-gray-500 cursor-pointer hover:bg-gray-100"><i class="fas fa-code mr-1"></i>JSON 원문</summary>
      <pre class="px-4 pb-3 bg-gray-900 text-green-300 rounded-b-lg p-3 text-xs overflow-x-auto max-h-32 font-mono">${escapeHtml(metricsDisplay)}</pre>
    </details>

    <div class="bg-purple-50 rounded-lg p-3 text-xs text-purple-700 leading-relaxed">
      <i class="fas fa-info-circle mr-1"></i><strong>적용 범위:</strong> 활성화된 지표 정책의 KPI 항목이 대시보드와 성과 리포트에 반영됩니다. 각 항목의 가중치 합이 100%가 되도록 설정하세요.
    </div>
    ${p.created_at ? `<div class="text-[11px] text-gray-400 text-right">생성: ${new Date(p.created_at).toLocaleString('ko-KR')}</div>` : ''}
  </div>`;

  showModal(`<i class="fas fa-chart-bar mr-2 text-purple-600"></i>지표 정책 상세 — ${escapeHtml(p.name)}`, content,
    `<button onclick="clonePolicy('metrics',${p.metrics_policy_id});closeModal()" class="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm"><i class="fas fa-copy mr-1"></i>복제</button>
     <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`, { large: true });
}

// ── 새 지표 정책 ──
function showNewMetricsPolicyModal() {
  const defaultMetrics = [
    { key: 'completion_rate', label: '완료율 (%)', defaultWeight: 30, defaultTarget: 95 },
    { key: 'response_time', label: '응답 시간 (시간)', defaultWeight: 20, defaultTarget: 24 },
    { key: 'customer_satisfaction', label: '고객 만족도 (점)', defaultWeight: 25, defaultTarget: 4.5 },
    { key: 'revenue', label: '매출 (원)', defaultWeight: 15, defaultTarget: 10000000 },
    { key: 'order_count', label: '주문 건수', defaultWeight: 10, defaultTarget: 50 },
  ];

  const content = `<div class="space-y-4">
    <div class="bg-purple-50 rounded-lg p-3 text-xs text-purple-700"><i class="fas fa-info-circle mr-1"></i>새 버전을 생성하면 기존 활성 지표 정책은 자동 비활성화됩니다.</div>
    <div><label class="block text-xs text-gray-600 mb-1 font-semibold">정책명 *</label>
      <input id="mp-name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="예: 2024 H2 지표 정책"></div>

    <div class="bg-gray-50 rounded-lg p-4 border">
      <div class="flex items-center justify-between mb-3">
        <div class="text-xs font-semibold text-gray-600"><i class="fas fa-chart-bar mr-1"></i>KPI 지표 설정</div>
        <div class="text-xs text-gray-400">가중치 합계: <strong id="mp-weight-total" class="text-purple-700">100</strong>%</div>
      </div>
      <div class="space-y-2" id="mp-metrics-list">
        ${defaultMetrics.map((m, i) => `
          <div class="flex items-center gap-2 bg-white rounded-lg p-2 border" id="mp-row-${i}">
            <input type="checkbox" class="mp-chk w-4 h-4 rounded text-purple-600" data-idx="${i}" checked onchange="_mpUpdateWeight()">
            <span class="text-xs font-medium w-32 shrink-0">${m.label}</span>
            <div class="flex-1 grid grid-cols-3 gap-2">
              <div><label class="text-[9px] text-gray-400">가중치(%)</label><input type="number" id="mp-w-${i}" class="w-full border rounded px-2 py-1 text-xs text-center" value="${m.defaultWeight}" min="0" max="100" oninput="_mpUpdateWeight()"></div>
              <div><label class="text-[9px] text-gray-400">목표</label><input type="number" id="mp-t-${i}" class="w-full border rounded px-2 py-1 text-xs text-center" value="${m.defaultTarget}" step="any"></div>
              <div><label class="text-[9px] text-gray-400">설명</label><input type="text" id="mp-d-${i}" class="w-full border rounded px-2 py-1 text-xs" placeholder="선택사항"></div>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <details class="bg-gray-50 rounded-lg border">
      <summary class="px-4 py-2 text-xs text-gray-500 cursor-pointer hover:bg-gray-100"><i class="fas fa-code mr-1"></i>고급: JSON 직접 편집</summary>
      <textarea id="mp-raw-json" rows="4" class="w-full border-0 rounded-b-lg px-4 py-2 text-xs font-mono" placeholder='{"completion_rate":{"weight":30,"target":95}}'></textarea>
    </details>
  </div>`;

  showModal('<i class="fas fa-plus mr-2 text-purple-600"></i>새 지표 정책 버전', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitNewMetricsPolicy()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">생성</button>`, { large: true });
}

window._mpMetricKeys = ['completion_rate', 'response_time', 'customer_satisfaction', 'revenue', 'order_count'];

function _mpUpdateWeight() {
  let total = 0;
  for (let i = 0; i < 5; i++) {
    const chk = document.querySelector(`.mp-chk[data-idx="${i}"]`);
    if (chk?.checked) total += +(document.getElementById(`mp-w-${i}`)?.value || 0);
  }
  const el = document.getElementById('mp-weight-total');
  if (el) { el.textContent = total; el.className = total === 100 ? 'text-green-700 font-bold' : 'text-red-600 font-bold'; }
}

async function submitNewMetricsPolicy() {
  const name = document.getElementById('mp-name')?.value;
  if (!name) { showToast('정책명을 입력하세요.', 'warning'); return; }

  let metrics_json;
  const raw = document.getElementById('mp-raw-json')?.value?.trim();
  if (raw) {
    try { JSON.parse(raw); metrics_json = raw; } catch { showToast('JSON 형식이 올바르지 않습니다.', 'warning'); return; }
  } else {
    const obj = {};
    for (let i = 0; i < 5; i++) {
      const chk = document.querySelector(`.mp-chk[data-idx="${i}"]`);
      if (!chk?.checked) continue;
      const key = window._mpMetricKeys[i];
      obj[key] = {
        weight: +(document.getElementById(`mp-w-${i}`)?.value || 0),
        target: +(document.getElementById(`mp-t-${i}`)?.value || 0),
      };
      const desc = document.getElementById(`mp-d-${i}`)?.value?.trim();
      if (desc) obj[key].description = desc;
    }
    metrics_json = JSON.stringify(obj);
  }

  await _policyApiAction('POST', '/stats/policies/metrics', { name, metrics_json }, { successMsg: d => `새 버전 v${d.version} 생성 완료` });
}

// ── 수정 모달 ──
function showEditMetricsPolicyModal(p) {
  let metrics = {};
  try { metrics = typeof p.metrics_json === 'string' ? JSON.parse(p.metrics_json) : (p.metrics_json || {}); } catch {}

  const content = `<div class="space-y-4">
    <div class="bg-gray-50 rounded-lg p-3 text-sm flex items-center gap-3">
      <span>정책 ID: <strong>#${p.metrics_policy_id}</strong></span>
      <span class="status-badge bg-purple-100 text-purple-700">v${p.version}</span>
    </div>
    <div><label class="block text-xs text-gray-600 mb-1 font-semibold">정책명</label>
      <input id="mp-edit-name" class="w-full border rounded-lg px-3 py-2 text-sm" value="${escapeHtml(p.name)}"></div>
    <div><label class="block text-xs text-gray-600 mb-1 font-semibold">지표 JSON</label>
      <textarea id="mp-edit-json" rows="8" class="w-full border rounded-lg px-3 py-2 text-xs font-mono">${escapeHtml(JSON.stringify(metrics, null, 2))}</textarea>
      <p class="text-[10px] text-gray-400 mt-1">JSON 형식으로 직접 편집하세요. 각 지표에 weight, target, description을 설정할 수 있습니다.</p>
    </div>
  </div>`;

  showModal(`지표 정책 수정 — v${p.version}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitEditMetricsPolicy(${p.metrics_policy_id})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">저장</button>`, { large: true });
}

async function submitEditMetricsPolicy(id) {
  const raw = document.getElementById('mp-edit-json')?.value?.trim();
  if (raw) { try { JSON.parse(raw); } catch { showToast('JSON 형식이 올바르지 않습니다.', 'warning'); return; } }
  await _policyApiAction('PUT', `/stats/policies/metrics/${id}`, {
    name: document.getElementById('mp-edit-name')?.value,
    metrics_json: raw,
  }, { successMsg: '수정 완료' });
}

async function deleteMetricsPolicy(id) {
  showConfirmModal('지표 정책 삭제', `#${id} 지표 정책을 삭제하시겠습니까?\n(비활성 정책만 삭제 가능)`, async () => {
    const res = await api('DELETE', `/stats/policies/metrics/${id}`);
    if (res?.ok) { showToast('삭제 완료', 'success'); renderContent(); }
    else showToast(res?.error || '삭제 실패', 'error');
  }, '삭제', 'bg-red-600');
}
