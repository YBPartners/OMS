// ============================================================
// 와이비 OMS — Shared Table Component v3.0
// 재사용 가능한 테이블, 페이지네이션
// ============================================================

/**
 * 범용 데이터 테이블 생성
 * @param {Object} config - { columns, rows, onRowClick, emptyText, className }
 * columns: [{ key, label, align, width, render }]
 */
function renderDataTable(config) {
  const { columns, rows = [], onRowClick, emptyText = '데이터가 없습니다.', className = '' } = config;
  
  return `
    <div class="bg-white rounded-xl border border-gray-100 overflow-hidden ${className}">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-600">
            <tr>${columns.map(c => `<th class="px-4 py-3 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}" ${c.width ? `style="width:${c.width}"` : ''}>${c.label}</th>`).join('')}</tr>
          </thead>
          <tbody class="divide-y">
            ${rows.length > 0 ? rows.map((row, i) => `
              <tr class="hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}" ${onRowClick ? `onclick="${onRowClick}(${row.id || row.order_id || row.user_id || i})"` : ''}>
                ${columns.map(c => {
                  const val = c.render ? c.render(row) : (row[c.key] !== undefined ? row[c.key] : '-');
                  return `<td class="px-4 py-3 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}">${val}</td>`;
                }).join('')}
              </tr>
            `).join('') : `<tr><td colspan="${columns.length}" class="px-4 py-8 text-center text-gray-400">${emptyText}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

/**
 * 페이지네이션 컨트롤
 */
function renderPagination(total, page, limit, onPageChange) {
  const totalPages = Math.ceil(total / limit) || 1;
  return `
    <div class="flex items-center justify-between px-4 py-3 text-sm text-gray-500">
      <span>총 ${formatNumber(total)}건</span>
      <div class="flex gap-2 items-center">
        ${page > 1 ? `<button onclick="${onPageChange}(${page - 1})" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"><i class="fas fa-chevron-left text-xs"></i> 이전</button>` : ''}
        <span class="px-3 py-1 font-medium">${page} / ${totalPages}</span>
        ${page < totalPages ? `<button onclick="${onPageChange}(${page + 1})" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">다음 <i class="fas fa-chevron-right text-xs"></i></button>` : ''}
      </div>
    </div>`;
}

/**
 * 상태 카드 그리드
 */
function renderStatusCards(cards) {
  return `
    <div class="grid grid-cols-2 md:grid-cols-${Math.min(cards.length, 5)} gap-4 mb-6">
      ${cards.map(c => `
        <div class="card bg-white rounded-xl p-4 border ${c.active ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-100'} ${c.onClick ? 'cursor-pointer' : ''}" ${c.onClick ? `onclick="${c.onClick}"` : ''}>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-gray-500 uppercase">${c.label}</span>
            <div class="w-8 h-8 bg-${c.color || 'gray'}-100 rounded-lg flex items-center justify-center">
              <i class="fas ${c.icon} text-${c.color || 'gray'}-600 text-sm"></i>
            </div>
          </div>
          <div class="text-${c.isText ? 'lg' : '2xl'} font-bold text-gray-800">${c.value}</div>
        </div>
      `).join('')}
    </div>`;
}
