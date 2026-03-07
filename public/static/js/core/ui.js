// ============================================================
// Airflow OMS — Core UI Module v4.0
// 토스트, 모달, 포맷터, 뱃지, 로딩, XSS 방어
// ============================================================

// ─── XSS 방어: HTML 엔티티 이스케이프 ───
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** 안전한 텍스트 삽입 — HTML 이스케이프 적용 */
function safeText(str) { return escapeHtml(str); }

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

// ─── 토스트 (스택 지원, 접근성, 중복 방지) ───
const _toastStack = [];
const MAX_TOASTS = 4;

function showToast(msg, type = 'info') {
  const colors = { info: 'bg-blue-500', success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500 text-gray-900' };
  const icons = { info: 'fa-info-circle', success: 'fa-check-circle', error: 'fa-exclamation-triangle', warning: 'fa-exclamation-circle' };

  // 동일 메시지 중복 방지 (1초 내)
  const now = Date.now();
  if (_toastStack.some(t => t.msg === msg && now - t.ts < 1000)) return;

  // 최대 스택 초과 시 가장 오래된 것 제거
  while (_toastStack.length >= MAX_TOASTS) {
    const oldest = _toastStack.shift();
    oldest.el.remove();
  }

  const el = document.createElement('div');
  el.className = `oms-toast fixed right-4 z-[60] px-6 py-3 rounded-lg text-white shadow-xl ${colors[type]} fade-in flex items-center gap-2`;
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  el.innerHTML = `<i class="fas ${icons[type]}"></i><span>${msg}</span>
    <button onclick="this.parentElement.remove()" class="ml-2 opacity-70 hover:opacity-100" aria-label="닫기"><i class="fas fa-times text-xs"></i></button>`;

  // 스택 위치 계산
  const topOffset = 16 + _toastStack.length * 56;
  el.style.top = topOffset + 'px';

  document.body.appendChild(el);
  const entry = { el, msg, ts: now };
  _toastStack.push(entry);

  const dismiss = () => {
    el.style.opacity = '0'; el.style.transition = 'opacity 0.3s';
    setTimeout(() => {
      el.remove();
      const idx = _toastStack.indexOf(entry);
      if (idx !== -1) _toastStack.splice(idx, 1);
      // 위치 재정렬
      _toastStack.forEach((t, i) => { t.el.style.top = (16 + i * 56) + 'px'; });
    }, 300);
  };
  setTimeout(dismiss, type === 'error' ? 5000 : 3500);
}

// ─── 모달 시스템 (강화: ESC닫기, 포커스트랩, aria) ───
let _modalPrevFocus = null;

function showModal(title, content, actions = '', options = {}) {
  closeModal();
  _modalPrevFocus = document.activeElement;
  const sizeClass = options.xlarge ? 'max-w-6xl' : options.large ? 'max-w-4xl' : options.small ? 'max-w-md' : 'max-w-2xl';
  const html = `
    <div id="modal-overlay" class="fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4" 
      role="dialog" aria-modal="true" aria-label="${title.replace(/<[^>]*>/g, '')}">
      <div class="bg-white rounded-2xl shadow-2xl ${sizeClass} w-full max-h-[85vh] flex flex-col fade-in">
        <div class="flex items-center justify-between px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
          <h3 class="text-lg font-bold text-gray-800">${title}</h3>
          <button onclick="closeModal()" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition" aria-label="모달 닫기"><i class="fas fa-times"></i></button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-5">${content}</div>
        ${actions ? `<div class="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">${actions}</div>` : ''}
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);

  // 바깥 클릭으로 닫기 (드래그 방지: mousedown + mouseup 모두 overlay에서 발생해야 닫힘)
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    let _mouseDownOnOverlay = false;
    overlay.addEventListener('mousedown', (e) => {
      _mouseDownOnOverlay = (e.target === overlay);
    });
    overlay.addEventListener('mouseup', (e) => {
      if (_mouseDownOnOverlay && e.target === overlay) closeModal();
      _mouseDownOnOverlay = false;
    });
  }

  // ESC 키로 닫기
  document.addEventListener('keydown', _modalEscHandler);

  // 첫 번째 포커스 가능 요소에 포커스
  requestAnimationFrame(() => {
    const ov = document.getElementById('modal-overlay');
    if (ov) {
      const focusable = ov.querySelector('button, [href], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable) focusable.focus();
    }
  });
}

function closeModal() {
  document.removeEventListener('keydown', _modalEscHandler);
  document.querySelectorAll('#modal-overlay').forEach(el => el.remove());
  // 이전 포커스 복원
  if (_modalPrevFocus && typeof _modalPrevFocus.focus === 'function') {
    try { _modalPrevFocus.focus(); } catch(e) {}
    _modalPrevFocus = null;
  }
}

function _modalEscHandler(e) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    closeModal();
  }
}

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
  // 페이지별 스켈레톤 UI — 실제 레이아웃과 유사하게 표시
  const skeletons = {
    dashboard: `
      <div class="fade-in space-y-4 animate-pulse">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          ${[1,2,3,4].map(() => '<div class="bg-white rounded-xl p-4 h-24"><div class="h-4 bg-gray-200 rounded w-1/2 mb-3"></div><div class="h-6 bg-gray-200 rounded w-3/4"></div></div>').join('')}
        </div>
        <div class="grid md:grid-cols-2 gap-4">
          <div class="bg-white rounded-xl p-4 h-64"><div class="h-4 bg-gray-200 rounded w-1/3 mb-4"></div><div class="h-48 bg-gray-100 rounded"></div></div>
          <div class="bg-white rounded-xl p-4 h-64"><div class="h-4 bg-gray-200 rounded w-1/3 mb-4"></div><div class="h-48 bg-gray-100 rounded"></div></div>
        </div>
      </div>`,
    table: `
      <div class="fade-in animate-pulse">
        <div class="flex justify-between items-center mb-4">
          <div class="h-6 bg-gray-200 rounded w-40"></div>
          <div class="flex gap-2"><div class="h-8 bg-gray-200 rounded w-24"></div><div class="h-8 bg-gray-200 rounded w-20"></div></div>
        </div>
        <div class="bg-white rounded-xl overflow-hidden">
          <div class="border-b p-3 flex gap-4">${[1,2,3,4,5].map(() => '<div class="h-4 bg-gray-200 rounded flex-1"></div>').join('')}</div>
          ${[1,2,3,4,5,6].map(() => '<div class="border-b p-3 flex gap-4">' + [1,2,3,4,5].map(() => '<div class="h-3 bg-gray-100 rounded flex-1"></div>').join('') + '</div>').join('')}
        </div>
      </div>`,
  };
  const page = typeof currentPage !== 'undefined' ? currentPage : '';
  const isDashboard = page === 'dashboard' || page === 'agency-dashboard';
  el.innerHTML = isDashboard ? skeletons.dashboard : skeletons.table;
}

// ─── CSV 내보내기 유틸리티 ───
function exportToCSV(data, columns, filename) {
  if (!data || data.length === 0) { showToast('내보낼 데이터가 없습니다.', 'warning'); return; }

  // BOM (한글 엑셀 호환)
  const BOM = '\uFEFF';
  const header = columns.map(c => `"${c.label}"`).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      let val = typeof c.value === 'function' ? c.value(row) : (row[c.key] ?? '');
      if (val === null || val === undefined) val = '';
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',')
  );
  const csv = BOM + header + '\n' + rows.join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${data.length}건 CSV 내보내기 완료`, 'success');
}

// ─── API 응답 캐시 (TTL 기반) ───
const _apiCache = new Map();
function cachedApi(method, url, ttlMs = 30000) {
  const key = method + ':' + url;
  const cached = _apiCache.get(key);
  if (cached && Date.now() - cached.ts < ttlMs) return Promise.resolve(cached.data);
  return api(method, url).then(data => {
    _apiCache.set(key, { data, ts: Date.now() });
    // 캐시 크기 제한 (최대 50)
    if (_apiCache.size > 50) {
      const oldest = [..._apiCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
      if (oldest) _apiCache.delete(oldest[0]);
    }
    return data;
  });
}
function invalidateCache(urlPattern) {
  if (!urlPattern) { _apiCache.clear(); return; }
  for (const key of _apiCache.keys()) {
    if (key.includes(urlPattern)) _apiCache.delete(key);
  }
}

// ─── Debounce 유틸 ───
function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ─── Throttle 유틸 ───
function throttle(fn, limit = 200) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= limit) { lastTime = now; fn.apply(this, args); }
  };
}

// ─── 엑셀(xlsx) 내보내기 유틸 ───
function exportToExcel(data, columns, filename, sheetName = 'Sheet1') {
  if (!data || data.length === 0) { showToast('내보낼 데이터가 없습니다.', 'warning'); return; }
  if (typeof XLSX === 'undefined') { showToast('엑셀 라이브러리 로딩 중...', 'warning'); return; }

  const headers = columns.map(c => c.label);
  const rows = data.map(row =>
    columns.map(c => typeof c.value === 'function' ? c.value(row) : (row[c.key] ?? ''))
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = columns.map((c, i) => {
    const maxLen = Math.max(c.label.length, ...rows.map(r => String(r[i] ?? '').length));
    return { wch: Math.min(Math.max(maxLen + 2, 8), 40) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast(`${data.length}건 엑셀 내보내기 완료`, 'success');
}
