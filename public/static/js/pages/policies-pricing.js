// ============================================================
// Airflow OMS — 정책관리: 가격 정책 탭 v1.0
// 서비스 항목별 판매가 / 기사 단가 관리
// ============================================================

function renderPricingTab(data) {
  const prices = data?.prices || [];
  const categories = data?.categories || [];
  const channels = data?.channels || [];
  const options = data?.options || [];

  // 그룹별 분류
  const groups = {};
  categories.forEach(cat => {
    if (!groups[cat.group_name]) groups[cat.group_name] = [];
    groups[cat.group_name].push(cat);
  });

  const channelHeaders = channels.map(ch =>
    `<th class="px-2 py-2 text-center text-[11px] font-semibold text-gray-600 border-b" colspan="2">${escapeHtml(ch.name)}</th>`
  ).join('');
  const channelSubHeaders = channels.map(() =>
    `<th class="px-2 py-1.5 text-center text-[10px] text-gray-400 border-b bg-gray-50">판매가</th><th class="px-2 py-1.5 text-center text-[10px] text-gray-400 border-b bg-gray-50">기사단가</th>`
  ).join('');

  // 가격 매트릭스 만들기 — (category_id, channel_id) -> price row
  const priceMap = {};
  prices.forEach(p => {
    priceMap[`${p.category_id || ''}_${p.channel_id || ''}`] = p;
    // category_id가 없으면 category_code 기반으로 찾기
    if (!p.category_id) {
      const cat = categories.find(c => c.code === p.category_code);
      if (cat) priceMap[`${cat.category_id}_${p.channel_id}`] = p;
    }
  });

  // 가격 표 행 생성
  let tableRows = '';
  let prevGroup = '';
  categories.forEach(cat => {
    if (cat.group_name !== prevGroup) {
      const groupCount = groups[cat.group_name]?.length || 1;
      tableRows += `<tr><td colspan="${2 + channels.length * 2}" class="px-3 py-2 bg-blue-50 text-xs font-bold text-blue-800 border-b">
        <i class="fas fa-layer-group mr-1"></i>${escapeHtml(cat.group_name)} <span class="text-blue-400 font-normal">(${groupCount}개 항목)</span></td></tr>`;
      prevGroup = cat.group_name;
    }
    const cells = channels.map(ch => {
      const key = `${cat.category_id}_${ch.channel_id}`;
      const p = priceMap[key];
      if (p) {
        return `<td class="px-2 py-2 text-center text-sm border-b border-l font-mono text-gray-800 hover:bg-yellow-50 cursor-pointer" onclick="_editPrice(${p.price_id},'sell',${p.sell_price},'${escapeHtml(cat.name)}','${escapeHtml(ch.name)}')">${(p.sell_price||0).toLocaleString()}</td>
                <td class="px-2 py-2 text-center text-sm border-b font-mono text-green-700 hover:bg-yellow-50 cursor-pointer" onclick="_editPrice(${p.price_id},'work',${p.work_price},'${escapeHtml(cat.name)}','${escapeHtml(ch.name)}')">${(p.work_price||0).toLocaleString()}</td>`;
      }
      return `<td class="px-2 py-2 text-center text-xs text-gray-300 border-b border-l" colspan="2">—</td>`;
    }).join('');

    tableRows += `<tr class="hover:bg-gray-50 transition">
      <td class="px-3 py-2 text-sm font-medium text-gray-800 border-b whitespace-nowrap">${escapeHtml(cat.name)}</td>
      <td class="px-2 py-2 text-[10px] text-gray-400 border-b font-mono">${cat.code}</td>
      ${cells}
    </tr>`;
  });

  // 옵션 테이블
  const optionRows = options.map(opt => {
    let applicable = '전체';
    try {
      const cats = JSON.parse(opt.applicable_categories || 'null');
      if (cats && Array.isArray(cats) && cats.length > 0) {
        applicable = cats.map(code => {
          const c = categories.find(x => x.code === code);
          return c ? c.name : code;
        }).join(', ');
      }
    } catch {}
    return `<tr class="hover:bg-gray-50 transition">
      <td class="px-3 py-2 text-sm font-medium text-gray-800 border-b">${escapeHtml(opt.name)}</td>
      <td class="px-2 py-2 text-[10px] text-gray-400 border-b font-mono">${opt.code}</td>
      <td class="px-3 py-2 text-sm text-center font-mono text-gray-800 border-b hover:bg-yellow-50 cursor-pointer" onclick="_editOption(${opt.option_id},'sell',${opt.additional_sell_price},'${escapeHtml(opt.name)}')">${(opt.additional_sell_price||0).toLocaleString()}</td>
      <td class="px-3 py-2 text-sm text-center font-mono text-green-700 border-b hover:bg-yellow-50 cursor-pointer" onclick="_editOption(${opt.option_id},'work',${opt.additional_work_price},'${escapeHtml(opt.name)}')">${(opt.additional_work_price||0).toLocaleString()}</td>
      <td class="px-3 py-2 text-xs text-gray-500 border-b max-w-[200px] truncate" title="${escapeHtml(applicable)}">${escapeHtml(applicable)}</td>
    </tr>`;
  }).join('');

  return `<div class="space-y-6 fade-in">
    <!-- 헤더 -->
    <div class="bg-white rounded-xl p-5 border border-gray-100">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-bold text-gray-800"><i class="fas fa-won-sign mr-2 text-amber-500"></i>서비스 가격 정책</h3>
          <p class="text-xs text-gray-400 mt-1">항목별 판매가와 기사 단가를 관리합니다. 금액을 클릭하면 수정할 수 있습니다.</p>
        </div>
        <div class="flex gap-2">
          <button onclick="_exportPricingCSV()" class="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 transition"><i class="fas fa-download mr-1"></i>CSV 내보내기</button>
          <button onclick="_showBulkPricingModal()" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition"><i class="fas fa-edit mr-1"></i>일괄 수정</button>
        </div>
      </div>

      <!-- 요약 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div class="bg-blue-50 rounded-lg p-3"><div class="text-[10px] text-blue-500 mb-1">서비스 항목</div><div class="text-xl font-bold text-blue-800">${categories.length}개</div></div>
        <div class="bg-green-50 rounded-lg p-3"><div class="text-[10px] text-green-500 mb-1">가격 설정</div><div class="text-xl font-bold text-green-800">${prices.length}건</div></div>
        <div class="bg-amber-50 rounded-lg p-3"><div class="text-[10px] text-amber-500 mb-1">채널</div><div class="text-xl font-bold text-amber-800">${channels.length}개</div></div>
        <div class="bg-purple-50 rounded-lg p-3"><div class="text-[10px] text-purple-500 mb-1">옵션</div><div class="text-xl font-bold text-purple-800">${options.length}개</div></div>
      </div>

      <!-- 채널별 필터 -->
      <div class="flex gap-1 mb-3 flex-wrap">
        <button onclick="_filterPricingChannel('all')" class="px-2.5 py-1 rounded-full text-xs ${!window._pricingChannelFilter || window._pricingChannelFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} transition">전체 채널</button>
        ${channels.map(ch => `<button onclick="_filterPricingChannel(${ch.channel_id})" class="px-2.5 py-1 rounded-full text-xs ${window._pricingChannelFilter == ch.channel_id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} transition">${escapeHtml(ch.name)}</button>`).join('')}
      </div>
    </div>

    <!-- 가격표 -->
    <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left" id="pricing-table">
          <thead>
            <tr class="bg-gray-50">
              <th class="px-3 py-2 text-xs font-semibold text-gray-600 border-b" rowspan="2">서비스 항목</th>
              <th class="px-2 py-2 text-xs font-semibold text-gray-400 border-b" rowspan="2">코드</th>
              ${channelHeaders}
            </tr>
            <tr class="bg-gray-50">${channelSubHeaders}</tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>

    <!-- 옵션 가격표 -->
    ${options.length ? `
    <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div class="p-4 border-b bg-gray-50">
        <h4 class="font-semibold text-sm text-gray-700"><i class="fas fa-puzzle-piece mr-2 text-purple-500"></i>추가 옵션 가격</h4>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="bg-gray-50">
              <th class="px-3 py-2 text-xs font-semibold text-gray-600 border-b">옵션명</th>
              <th class="px-2 py-2 text-xs font-semibold text-gray-400 border-b">코드</th>
              <th class="px-3 py-2 text-xs font-semibold text-gray-600 border-b text-center">추가 판매가</th>
              <th class="px-3 py-2 text-xs font-semibold text-gray-600 border-b text-center">추가 기사단가</th>
              <th class="px-3 py-2 text-xs font-semibold text-gray-600 border-b">적용 항목</th>
            </tr>
          </thead>
          <tbody>${optionRows}</tbody>
        </table>
      </div>
    </div>` : ''}
  </div>`;
}

// ─── 가격 수정 모달 ───
function _editPrice(priceId, field, currentValue, catName, chName) {
  const fieldLabel = field === 'sell' ? '판매가' : '기사 단가';
  showModal(`가격 수정 — ${catName} (${chName})`, `
    <div class="space-y-4">
      <div class="bg-gray-50 rounded-lg p-3">
        <div class="text-xs text-gray-500 mb-1">${escapeHtml(catName)} · ${escapeHtml(chName)}</div>
        <div class="text-sm font-medium">${fieldLabel} 수정</div>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">현재 ${fieldLabel}</label>
        <div class="text-lg font-bold text-gray-800">₩${(currentValue||0).toLocaleString()}</div>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">새 ${fieldLabel}</label>
        <input type="number" id="edit-price-val" value="${currentValue||0}" step="1000" min="0" class="w-full px-3 py-2 border rounded-lg text-sm" onkeyup="document.getElementById('price-preview').textContent='₩'+Number(this.value||0).toLocaleString()">
        <div id="price-preview" class="text-xs text-gray-400 mt-1">₩${(currentValue||0).toLocaleString()}</div>
      </div>
    </div>
  `, `<div class="flex gap-2 justify-end">
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">취소</button>
    <button onclick="_submitPriceEdit(${priceId},'${field}')" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-check mr-1"></i>저장</button>
  </div>`);
}

async function _submitPriceEdit(priceId, field) {
  const val = Number(document.getElementById('edit-price-val')?.value);
  if (isNaN(val) || val < 0) { showToast('올바른 금액을 입력하세요', 'error'); return; }
  const body = field === 'sell' ? { sell_price: val } : { work_price: val };
  try {
    const res = await api('PUT', `/stats/policies/pricing/${priceId}`, body);
    if (res?.ok) { showToast('가격이 수정되었습니다', 'success'); closeModal(); renderContent(); }
    else showToast(res?.error || '수정 실패', 'error');
  } catch (e) { showToast('오류: ' + (e.message||e), 'error'); }
}

// ─── 옵션 가격 수정 ───
function _editOption(optionId, field, currentValue, optName) {
  const fieldLabel = field === 'sell' ? '추가 판매가' : '추가 기사단가';
  showModal(`옵션 가격 수정 — ${optName}`, `
    <div class="space-y-4">
      <div class="bg-purple-50 rounded-lg p-3">
        <div class="text-xs text-purple-500 mb-1">${escapeHtml(optName)}</div>
        <div class="text-sm font-medium">${fieldLabel} 수정</div>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">현재 ${fieldLabel}</label>
        <div class="text-lg font-bold text-gray-800">₩${(currentValue||0).toLocaleString()}</div>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">새 ${fieldLabel}</label>
        <input type="number" id="edit-option-val" value="${currentValue||0}" step="1000" min="0" class="w-full px-3 py-2 border rounded-lg text-sm" onkeyup="document.getElementById('opt-price-preview').textContent='₩'+Number(this.value||0).toLocaleString()">
        <div id="opt-price-preview" class="text-xs text-gray-400 mt-1">₩${(currentValue||0).toLocaleString()}</div>
      </div>
    </div>
  `, `<div class="flex gap-2 justify-end">
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">취소</button>
    <button onclick="_submitOptionEdit(${optionId},'${field}')" class="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"><i class="fas fa-check mr-1"></i>저장</button>
  </div>`);
}

async function _submitOptionEdit(optionId, field) {
  const val = Number(document.getElementById('edit-option-val')?.value);
  if (isNaN(val) || val < 0) { showToast('올바른 금액을 입력하세요', 'error'); return; }
  const body = field === 'sell' ? { additional_sell_price: val } : { additional_work_price: val };
  try {
    const res = await api('PUT', `/stats/policies/pricing/option/${optionId}`, body);
    if (res?.ok) { showToast('옵션 가격이 수정되었습니다', 'success'); closeModal(); renderContent(); }
    else showToast(res?.error || '수정 실패', 'error');
  } catch (e) { showToast('오류: ' + (e.message||e), 'error'); }
}

// ─── 일괄 수정 모달 ───
function _showBulkPricingModal() {
  const categories = window._cachedPricingData?.categories || [];
  const channels = window._cachedPricingData?.channels || [];
  const prices = window._cachedPricingData?.prices || [];

  showModal('일괄 가격 수정', `
    <div class="space-y-4" style="max-height:70vh; overflow-y:auto;">
      <div class="bg-amber-50 rounded-lg p-3 text-xs text-amber-700"><i class="fas fa-exclamation-triangle mr-1"></i>주의: 일괄 수정 시 변경된 모든 가격이 즉시 적용됩니다.</div>
      <div class="flex gap-2 items-center mb-2">
        <label class="text-xs text-gray-500">채널 선택:</label>
        <select id="bulk-channel" class="text-sm border rounded-lg px-2 py-1" onchange="_renderBulkRows()">
          ${channels.map(ch => `<option value="${ch.channel_id}">${escapeHtml(ch.name)}</option>`).join('')}
        </select>
      </div>
      <div id="bulk-rows-container"></div>
    </div>
  `, `<div class="flex gap-2 justify-end">
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">취소</button>
    <button onclick="_submitBulkPricing()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-save mr-1"></i>일괄 저장</button>
  </div>`);

  setTimeout(() => _renderBulkRows(), 50);
}

function _renderBulkRows() {
  const container = document.getElementById('bulk-rows-container');
  if (!container) return;
  const channelId = Number(document.getElementById('bulk-channel')?.value);
  const categories = window._cachedPricingData?.categories || [];
  const prices = window._cachedPricingData?.prices || [];

  const rows = categories.map(cat => {
    const p = prices.find(x => (x.category_id === cat.category_id || x.category_code === cat.code) && x.channel_id === channelId);
    return `<tr class="hover:bg-gray-50">
      <td class="px-2 py-1.5 text-xs font-medium text-gray-800 border-b">${escapeHtml(cat.name)}</td>
      <td class="px-2 py-1.5 border-b"><input type="number" data-price-id="${p?.price_id||''}" data-cat="${cat.category_id}" data-field="sell" value="${p?.sell_price||0}" step="1000" min="0" class="w-full px-2 py-1 border rounded text-xs text-right bulk-price-input"></td>
      <td class="px-2 py-1.5 border-b"><input type="number" data-price-id="${p?.price_id||''}" data-cat="${cat.category_id}" data-field="work" value="${p?.work_price||0}" step="1000" min="0" class="w-full px-2 py-1 border rounded text-xs text-right bulk-price-input"></td>
    </tr>`;
  }).join('');

  container.innerHTML = `<table class="w-full"><thead><tr class="bg-gray-50">
    <th class="px-2 py-1.5 text-xs text-gray-600 border-b text-left">항목</th>
    <th class="px-2 py-1.5 text-xs text-gray-600 border-b text-center">판매가</th>
    <th class="px-2 py-1.5 text-xs text-gray-600 border-b text-center">기사단가</th>
  </tr></thead><tbody>${rows}</tbody></table>`;
}

async function _submitBulkPricing() {
  const inputs = document.querySelectorAll('.bulk-price-input');
  const changes = [];
  const origPrices = window._cachedPricingData?.prices || [];

  inputs.forEach(inp => {
    const priceId = Number(inp.dataset.priceId);
    if (!priceId) return;
    const field = inp.dataset.field;
    const newVal = Number(inp.value);
    const orig = origPrices.find(p => p.price_id === priceId);
    if (!orig) return;
    const origVal = field === 'sell' ? orig.sell_price : orig.work_price;
    if (newVal !== origVal) {
      changes.push({ priceId, field, value: newVal });
    }
  });

  if (changes.length === 0) { showToast('변경된 가격이 없습니다', 'info'); return; }

  try {
    let ok = 0, fail = 0;
    for (const ch of changes) {
      const body = ch.field === 'sell' ? { sell_price: ch.value } : { work_price: ch.value };
      const res = await api('PUT', `/stats/policies/pricing/${ch.priceId}`, body);
      if (res?.ok) ok++;
      else fail++;
    }
    showToast(`${ok}건 수정 완료${fail ? `, ${fail}건 실패` : ''}`, ok ? 'success' : 'error');
    closeModal();
    renderContent();
  } catch (e) { showToast('오류: ' + (e.message||e), 'error'); }
}

// ─── 채널 필터 ───
function _filterPricingChannel(channelId) {
  window._pricingChannelFilter = channelId;
  renderContent();
}

// ─── CSV 내보내기 ───
function _exportPricingCSV() {
  const prices = window._cachedPricingData?.prices || [];
  const categories = window._cachedPricingData?.categories || [];
  const channels = window._cachedPricingData?.channels || [];

  let csv = '\uFEFF항목코드,항목명,그룹,채널,판매가,기사단가\n';
  prices.forEach(p => {
    csv += `${p.category_code||''},${p.category_name||''},${p.group_name||''},${p.channel_name||''},${p.sell_price||0},${p.work_price||0}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `가격정책_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('CSV 내보내기 완료', 'success');
}
