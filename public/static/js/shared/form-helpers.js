// ============================================================
// Airflow OMS — Shared Form Helpers v4.0
// 폼 빌더, 필터, 입력 검증, 액션바, 접근성
// ============================================================

/**
 * 필터 바 생성
 * @param {Array} filters - [{ id, label, type, options, value, placeholder }]
 * @param {Function} onApplyName - 필터 적용 시 호출할 함수 이름
 */
function renderFilterBar(filters, onApplyName, extraButtons = '') {
  return `
    <div class="bg-white rounded-xl p-4 mb-4 border border-gray-100 flex flex-wrap gap-3 items-end" role="search" aria-label="필터">
      ${filters.map(f => {
        const labelId = f.id + '-label';
        if (f.type === 'select') {
          return `<div><label id="${labelId}" class="block text-xs text-gray-500 mb-1" for="${f.id}">${f.label}</label>
            <select id="${f.id}" aria-labelledby="${labelId}" class="border rounded-lg px-3 py-2 text-sm" ${f.onChange ? `onchange="${f.onChange}"` : ''}>
              <option value="">${f.placeholder || '전체'}</option>
              ${(f.options || []).map(o => `<option value="${o.value}" ${f.value === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select></div>`;
        }
        if (f.type === 'date') {
          return `<div><label id="${labelId}" class="block text-xs text-gray-500 mb-1" for="${f.id}">${f.label}</label>
            <input id="${f.id}" type="date" aria-labelledby="${labelId}" class="border rounded-lg px-3 py-2 text-sm" value="${f.value || ''}"></div>`;
        }
        return `<div><label id="${labelId}" class="block text-xs text-gray-500 mb-1" for="${f.id}">${f.label}</label>
          <input id="${f.id}" aria-labelledby="${labelId}" class="border rounded-lg px-3 py-2 text-sm ${f.className || ''}" 
            placeholder="${f.placeholder || ''}" value="${f.value || ''}" 
            ${f.type === 'number' ? 'type="number"' : ''} 
            onkeypress="if(event.key==='Enter')${onApplyName}()"></div>`;
      }).join('')}
      <button onclick="${onApplyName}()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"><i class="fas fa-search mr-1"></i>조회</button>
      ${extraButtons}
    </div>`;
}

/**
 * 폼 필드 생성 (모달 내부용)
 */
function formField(name, label, type = 'text', opts = {}) {
  const { value = '', required = false, placeholder = '', options = [], className = '', disabled = false, step = '', min = '', max = '', hint = '' } = opts;
  const req = required ? ' <span class="text-red-500">*</span>' : '';
  const hintHtml = hint ? `<p class="text-[10px] text-gray-400 mt-0.5">${hint}</p>` : '';
  const ariaReq = required ? 'aria-required="true"' : '';
  
  if (type === 'select') {
    return `<div class="${className}"><label class="block text-xs text-gray-500 mb-1" for="f-${name}">${label}${req}</label>
      <select id="f-${name}" name="${name}" ${required ? 'required' : ''} ${ariaReq} ${disabled ? 'disabled' : ''} class="w-full border rounded-lg px-3 py-2 text-sm ${disabled ? 'bg-gray-50' : ''}">
        ${options.map(o => `<option value="${o.value}" ${o.value == value ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>${hintHtml}</div>`;
  }
  if (type === 'textarea') {
    return `<div class="${className}"><label class="block text-xs text-gray-500 mb-1" for="f-${name}">${label}${req}</label>
      <textarea id="f-${name}" name="${name}" rows="${opts.rows || 3}" ${required ? 'required' : ''} ${ariaReq} class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="${placeholder}">${value}</textarea>${hintHtml}</div>`;
  }
  
  return `<div class="${className}"><label class="block text-xs text-gray-500 mb-1" for="f-${name}">${label}${req}</label>
    <input id="f-${name}" name="${name}" type="${type}" value="${value}" ${required ? 'required' : ''} ${ariaReq} ${disabled ? 'disabled' : ''} 
      ${step ? `step="${step}"` : ''} ${min !== '' ? `min="${min}"` : ''} ${max !== '' ? `max="${max}"` : ''}
      class="w-full border rounded-lg px-3 py-2 text-sm ${type === 'number' ? 'num-input' : ''} ${disabled ? 'bg-gray-50' : ''}" placeholder="${placeholder}">${hintHtml}</div>`;
}

/**
 * 폼 데이터 수집
 */
function collectFormData(formId) {
  const form = document.getElementById(formId);
  if (!form) return {};
  return Object.fromEntries(new FormData(form));
}

/**
 * 페이지 헤더 (제목 + 액션 버튼)
 */
function pageHeader(icon, title, color = 'blue', actions = '') {
  return `
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800"><i class="fas ${icon} mr-2 text-${color}-600"></i>${title}</h2>
      <div class="flex gap-2">${actions}</div>
    </div>`;
}

/**
 * 액션 버튼 생성 (RBAC 반영)
 */
function actionButton(label, icon, onclick, color = 'blue', permission = null) {
  if (permission && !canEdit(permission)) return '';
  return `<button onclick="${onclick}" class="px-4 py-2 bg-${color}-600 text-white rounded-lg text-sm hover:bg-${color}-700 transition"><i class="fas ${icon} mr-1"></i>${label}</button>`;
}

/**
 * 링크/정보 표시 (권한에 따라 편집 링크 또는 정보만 표시)
 */
function infoOrLink(value, editAction, permission) {
  if (permission && canEdit(permission)) {
    return `<span class="link-item" onclick="${editAction}">${value}</span>`;
  }
  return `<span>${value}</span>`;
}

/**
 * 모달 액션 버튼 세트 생성 (표준화)
 * @param {Array} buttons - [{ label, onclick, color?, icon?, disabled? }]
 */
function renderModalActions(buttons) {
  return buttons.map(b => {
    const color = b.color || 'bg-gray-100 text-gray-700';
    return `<button onclick="${b.onclick}" class="px-5 py-2.5 ${color} rounded-lg text-sm hover:opacity-90 transition ${b.disabled ? 'opacity-50 pointer-events-none' : ''}" ${b.disabled ? 'disabled' : ''}>${b.icon ? `<i class="fas ${b.icon} mr-1"></i>` : ''}${b.label}</button>`;
  }).join('');
}

/**
 * 폼 데이터 수집 + 간단 유효성 검증
 * @param {string} formId
 * @param {Object} rules - { fieldName: { required: true, minLength: 2, ... } }
 * @returns {Object|null} 유효성 실패 시 null
 */
function collectFormDataSafe(formId, rules = {}) {
  const form = document.getElementById(formId);
  if (!form) return null;
  const data = Object.fromEntries(new FormData(form));
  
  for (const [field, rule] of Object.entries(rules)) {
    const val = data[field];
    if (rule.required && (!val || !String(val).trim())) {
      showToast(`${rule.label || field}을(를) 입력해주세요.`, 'warning');
      const el = form.querySelector(`[name="${field}"]`);
      if (el) { el.focus(); el.classList.add('ring-2', 'ring-red-300'); setTimeout(() => el.classList.remove('ring-2', 'ring-red-300'), 3000); }
      return null;
    }
    if (rule.minLength && val && String(val).length < rule.minLength) {
      showToast(`${rule.label || field}은(는) 최소 ${rule.minLength}글자 이상이어야 합니다.`, 'warning');
      return null;
    }
    if (rule.pattern && val && !rule.pattern.test(String(val))) {
      showToast(rule.patternMsg || `${rule.label || field} 형식이 올바르지 않습니다.`, 'warning');
      return null;
    }
    if (rule.type === 'number') data[field] = Number(val) || 0;
  }
  return data;
}

/**
 * 페이지 액션 바 (헤더 우측 버튼 영역) — RBAC 적용
 */
function renderActionBar(actions) {
  return `<div class="flex gap-2">${actions.map(a => {
    if (a.permission && !canEdit(a.permission)) return '';
    const color = a.color || 'blue';
    return `<button onclick="${a.onclick}" class="px-4 py-2 bg-${color}-600 text-white rounded-lg text-sm hover:bg-${color}-700 transition" ${a.tooltip ? `data-tooltip="${a.tooltip}"` : ''}>${a.icon ? `<i class="fas ${a.icon} mr-1"></i>` : ''}${a.label}</button>`;
  }).join('')}</div>`;
}
