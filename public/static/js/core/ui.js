// ============================================================
// 다하다 OMS — Core UI Module v3.0
// 토스트, 모달, 포맷터, 뱃지, 로딩
// ============================================================

// ─── 포맷터 ───
function formatAmount(v) { return v != null ? Number(v).toLocaleString('ko-KR') + '원' : '-'; }
function formatDate(d) { return d ? d.replace('T', ' ').substring(0, 16) : '-'; }
function formatPhone(phone) {
  if (!phone) return '-';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  return phone;
}
function formatNumber(v) { return v != null ? Number(v).toLocaleString('ko-KR') : '-'; }

// ─── 상태 뱃지 ───
function statusBadge(status) {
  const s = OMS.STATUS[status] || { label: status || 'NEW', color: 'bg-gray-100 text-gray-600', icon: 'fa-question' };
  return `<span class="status-badge ${s.color}"><i class="fas ${s.icon} mr-1"></i>${s.label}</span>`;
}

// ─── 토스트 ───
function showToast(msg, type = 'info') {
  const colors = { info: 'bg-blue-500', success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500 text-gray-900' };
  const icons = { info: 'fa-info-circle', success: 'fa-check-circle', error: 'fa-exclamation-triangle', warning: 'fa-exclamation-circle' };
  // 중복 제거
  document.querySelectorAll('.oms-toast').forEach(el => el.remove());
  const el = document.createElement('div');
  el.className = `oms-toast fixed top-4 right-4 z-[60] px-6 py-3 rounded-lg text-white shadow-xl ${colors[type]} fade-in flex items-center gap-2`;
  el.innerHTML = `<i class="fas ${icons[type]}"></i><span>${msg}</span>`;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ─── 모달 시스템 (강화) ───
function showModal(title, content, actions = '', options = {}) {
  closeModal();
  const sizeClass = options.xlarge ? 'max-w-6xl' : options.large ? 'max-w-4xl' : options.small ? 'max-w-md' : 'max-w-2xl';
  const html = `
    <div id="modal-overlay" class="fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()">
      <div class="bg-white rounded-2xl shadow-2xl ${sizeClass} w-full max-h-[85vh] flex flex-col fade-in">
        <div class="flex items-center justify-between px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
          <h3 class="text-lg font-bold text-gray-800">${title}</h3>
          <button onclick="closeModal()" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition"><i class="fas fa-times"></i></button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-5">${content}</div>
        ${actions ? `<div class="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">${actions}</div>` : ''}
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}
function closeModal() { document.getElementById('modal-overlay')?.remove(); }

function showConfirmModal(title, message, onConfirm, confirmText = '확인', confirmColor = 'bg-blue-600') {
  const content = `<div class="text-center py-4"><p class="text-gray-600">${message}</p></div>`;
  const confirmId = '_confirm_' + Date.now();
  const actions = `
    <button onclick="closeModal()" class="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">취소</button>
    <button id="${confirmId}" class="px-5 py-2.5 ${confirmColor} text-white rounded-lg text-sm hover:opacity-90">${confirmText}</button>
  `;
  showModal(title, content, actions);
  document.getElementById(confirmId).addEventListener('click', () => { closeModal(); onConfirm(); });
}

// ─── 숫자 입력 모달 (정산, 수수료 등) ───
function showNumberInputModal(title, label, currentValue, unit, onSave, options = {}) {
  const min = options.min !== undefined ? options.min : 0;
  const max = options.max !== undefined ? options.max : 999999999;
  const step = options.step || 1;
  const description = options.description || '';
  
  const content = `
    <div class="space-y-4">
      ${description ? `<p class="text-sm text-gray-600">${description}</p>` : ''}
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">${label}</label>
        <div class="flex items-center gap-3">
          <button onclick="adjustNumInput(-${step * 10})" class="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-lg font-bold">--</button>
          <button onclick="adjustNumInput(-${step})" class="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-lg font-bold">-</button>
          <input id="num-input-value" type="number" value="${currentValue}" min="${min}" max="${max}" step="${step}" 
            class="flex-1 text-center text-2xl font-bold border-2 border-blue-300 rounded-xl px-4 py-3 num-input focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <button onclick="adjustNumInput(${step})" class="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-lg font-bold">+</button>
          <button onclick="adjustNumInput(${step * 10})" class="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-lg font-bold">++</button>
        </div>
        <div class="flex justify-between mt-2">
          <span class="text-xs text-gray-400">최소: ${min}${unit}</span>
          <span id="num-input-display" class="text-sm font-medium text-blue-600">${formatNumber(currentValue)}${unit}</span>
          <span class="text-xs text-gray-400">최대: ${formatNumber(max)}${unit}</span>
        </div>
      </div>
      ${options.presets ? `
        <div>
          <label class="block text-xs text-gray-500 mb-2">빠른 선택</label>
          <div class="flex flex-wrap gap-2">
            ${options.presets.map(p => `<button onclick="document.getElementById('num-input-value').value=${p};updateNumDisplay('${unit}')" 
              class="px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-blue-100 hover:text-blue-700">${formatNumber(p)}${unit}</button>`).join('')}
          </div>
        </div>` : ''}
    </div>`;
  
  const saveId = '_numsave_' + Date.now();
  const actions = `
    <button onclick="closeModal()" class="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm">취소</button>
    <button id="${saveId}" class="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm">저장</button>`;
  showModal(title, content, actions);
  document.getElementById(saveId).addEventListener('click', () => {
    const val = Number(document.getElementById('num-input-value').value);
    if (val < min || val > max) { showToast(`${min}~${max} 범위에서 입력하세요.`, 'warning'); return; }
    closeModal();
    onSave(val);
  });
}

function adjustNumInput(delta) {
  const el = document.getElementById('num-input-value');
  if (!el) return;
  const newVal = Math.max(Number(el.min) || 0, Math.min(Number(el.max) || 999999999, Number(el.value) + delta));
  el.value = newVal;
  const display = document.getElementById('num-input-display');
  if (display) display.textContent = formatNumber(newVal) + (display.textContent.match(/[^0-9,.-]+$/)?.[0] || '');
}

function updateNumDisplay(unit) {
  const el = document.getElementById('num-input-value');
  const display = document.getElementById('num-input-display');
  if (el && display) display.textContent = formatNumber(Number(el.value)) + unit;
}

// ─── 항목 선택 모달 ───
function showItemSelectModal(title, items, onSelect, options = {}) {
  const multi = options.multi || false;
  const selectedIds = options.selected || [];
  const searchable = options.searchable !== false && items.length > 8;
  
  const content = `
    <div class="space-y-4">
      ${searchable ? `
        <input id="item-search" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="검색..." oninput="filterItemList(this.value)">
      ` : ''}
      <div id="item-list" class="space-y-1 max-h-80 overflow-y-auto">
        ${items.map((item, idx) => {
          const checked = selectedIds.includes(item.id) ? 'checked' : '';
          return `
          <label class="item-option flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-blue-50 cursor-pointer border border-transparent hover:border-blue-200 transition" data-name="${(item.label || item.name || '').toLowerCase()}" data-id="${item.id}">
            <input type="${multi ? 'checkbox' : 'radio'}" name="item-select" value="${item.id}" ${checked} class="w-4 h-4 text-blue-600">
            ${item.icon ? `<i class="fas ${item.icon} text-gray-400 w-5 text-center"></i>` : ''}
            <div class="flex-1">
              <div class="font-medium text-sm">${item.label || item.name}</div>
              ${item.description ? `<div class="text-xs text-gray-500">${item.description}</div>` : ''}
            </div>
            ${item.badge ? `<span class="text-xs px-2 py-0.5 rounded-full ${item.badgeColor || 'bg-gray-100 text-gray-600'}">${item.badge}</span>` : ''}
          </label>`;
        }).join('')}
      </div>
    </div>`;
  
  const selectId = '_itemselect_' + Date.now();
  const actions = `
    <button onclick="closeModal()" class="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm">취소</button>
    <button id="${selectId}" class="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm">선택</button>`;
  showModal(title, content, actions);
  document.getElementById(selectId).addEventListener('click', () => {
    const checked = Array.from(document.querySelectorAll('input[name="item-select"]:checked'));
    const values = checked.map(el => multi ? el.value : el.value);
    closeModal();
    onSelect(multi ? values : values[0]);
  });
}

function filterItemList(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('.item-option').forEach(el => {
    el.style.display = el.dataset.name.includes(q) ? '' : 'none';
  });
}

// ─── 로딩 표시 ───
function showLoading(el) {
  el.innerHTML = '<div class="flex items-center justify-center h-64"><div class="pulse text-gray-400"><i class="fas fa-spinner fa-spin text-3xl"></i><p class="mt-3">로딩 중...</p></div></div>';
}
