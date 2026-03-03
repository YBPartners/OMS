// ============================================================
// 다하다 OMS — Shared Form Helpers v3.0
// 폼 빌더, 필터, 입력 검증
// ============================================================

/**
 * 필터 바 생성
 * @param {Array} filters - [{ id, label, type, options, value, placeholder }]
 * @param {Function} onApplyName - 필터 적용 시 호출할 함수 이름
 */
function renderFilterBar(filters, onApplyName, extraButtons = '') {
  return `
    <div class="bg-white rounded-xl p-4 mb-4 border border-gray-100 flex flex-wrap gap-3 items-end">
      ${filters.map(f => {
        if (f.type === 'select') {
          return `<div><label class="block text-xs text-gray-500 mb-1">${f.label}</label>
            <select id="${f.id}" class="border rounded-lg px-3 py-2 text-sm" ${f.onChange ? `onchange="${f.onChange}"` : ''}>
              <option value="">${f.placeholder || '전체'}</option>
              ${(f.options || []).map(o => `<option value="${o.value}" ${f.value === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select></div>`;
        }
        if (f.type === 'date') {
          return `<div><label class="block text-xs text-gray-500 mb-1">${f.label}</label>
            <input id="${f.id}" type="date" class="border rounded-lg px-3 py-2 text-sm" value="${f.value || ''}"></div>`;
        }
        return `<div><label class="block text-xs text-gray-500 mb-1">${f.label}</label>
          <input id="${f.id}" class="border rounded-lg px-3 py-2 text-sm ${f.className || ''}" 
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
  const { value = '', required = false, placeholder = '', options = [], className = '', disabled = false, step = '', min = '', max = '' } = opts;
  const req = required ? ' *' : '';
  
  if (type === 'select') {
    return `<div class="${className}"><label class="block text-xs text-gray-500 mb-1">${label}${req}</label>
      <select name="${name}" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''} class="w-full border rounded-lg px-3 py-2 text-sm ${disabled ? 'bg-gray-50' : ''}">
        ${options.map(o => `<option value="${o.value}" ${o.value == value ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select></div>`;
  }
  if (type === 'textarea') {
    return `<div class="${className}"><label class="block text-xs text-gray-500 mb-1">${label}${req}</label>
      <textarea name="${name}" rows="${opts.rows || 3}" ${required ? 'required' : ''} class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="${placeholder}">${value}</textarea></div>`;
  }
  
  return `<div class="${className}"><label class="block text-xs text-gray-500 mb-1">${label}${req}</label>
    <input name="${name}" type="${type}" value="${value}" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''} 
      ${step ? `step="${step}"` : ''} ${min !== '' ? `min="${min}"` : ''} ${max !== '' ? `max="${max}"` : ''}
      class="w-full border rounded-lg px-3 py-2 text-sm ${type === 'number' ? 'num-input' : ''} ${disabled ? 'bg-gray-50' : ''}" placeholder="${placeholder}"></div>`;
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
