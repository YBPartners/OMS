// ============================================================
// 와이비 OMS — Shared Table Component v5.0
// 재사용 가능한 테이블, 페이지네이션, 상태카드, 접근성
// 체크박스 컬럼, 커스텀 행 속성, 조건부 컬럼, 행 CSS 지원
// ============================================================

/**
 * 범용 데이터 테이블 생성 v5
 * @param {Object} config
 *   columns:    [{ key, label, align, width, render, thClass, tdClass, show }]
 *               - show: (optional) boolean 또는 () => boolean — false면 컬럼 숨김
 *               - render: (row, idx) => HTML string
 *               - thClass / tdClass: 추가 CSS 클래스
 *   rows:       데이터 배열
 *   onRowClick: 행 클릭 함수명 문자열
 *   rowAttrs:   (row, idx) => 추가 속성 문자열 (onclick, oncontextmenu, data-* 등)
 *   rowClass:   (row, idx) => 추가 CSS 클래스 문자열
 *   emptyText:  빈 테이블 메시지
 *   className:  외부 div 추가 클래스
 *   tableId:    <table> id 속성
 *   caption:    접근성 캡션 (sr-only)
 *   tbodyId:    <tbody> id 속성
 *   compact:    true이면 px-3 py-2 (작은 패딩)
 *   noBorder:   true이면 외부 border 제거
 */
function renderDataTable(config) {
  const {
    columns: rawCols, rows = [], onRowClick, rowAttrs, rowClass,
    emptyText = '데이터가 없습니다.', className = '', tableId = '',
    caption = '', tbodyId = '', compact = false, noBorder = false
  } = config;

  // 조건부 컬럼 필터링
  const columns = rawCols.filter(c => {
    if (c.show === undefined) return true;
    return typeof c.show === 'function' ? c.show() : !!c.show;
  });

  const px = compact ? 'px-3 py-2' : 'px-4 py-3';
  const border = noBorder ? '' : 'border border-gray-100';

  return `
    <div class="bg-white rounded-xl ${border} overflow-hidden ${className}">
      <div class="overflow-x-auto">
        <table class="w-full text-sm" ${tableId ? `id="${tableId}"` : ''} role="grid">
          ${caption ? `<caption class="sr-only">${caption}</caption>` : ''}
          <thead class="bg-gray-50 text-gray-600">
            <tr>${columns.map(c => {
              const align = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left';
              return `<th class="${px} ${align} font-medium ${c.thClass || ''}" ${c.width ? `style="width:${c.width}"` : ''} scope="col">${c.label}</th>`;
            }).join('')}</tr>
          </thead>
          <tbody class="divide-y" ${tbodyId ? `id="${tbodyId}"` : ''}>
            ${rows.length > 0 ? rows.map((row, i) => {
              const extraClass = rowClass ? rowClass(row, i) : '';
              const extraAttrs = rowAttrs ? rowAttrs(row, i) : '';
              const clickable = onRowClick ? 'cursor-pointer ix-table-row' : '';
              const clickAttr = onRowClick ? `onclick="${onRowClick}(${row.id || row.order_id || row.user_id || i})"` : '';
              return `
              <tr class="hover:bg-gray-50 ${clickable} ${extraClass}" ${clickAttr} ${extraAttrs}>
                ${columns.map(c => {
                  const val = c.render ? c.render(row, i) : (row[c.key] !== undefined ? row[c.key] : '-');
                  const align = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left';
                  return `<td class="${px} ${align} ${c.tdClass || ''}">${val}</td>`;
                }).join('')}
              </tr>`;
            }).join('') : `<tr><td colspan="${columns.length}" class="px-4 py-8 text-center text-gray-400">${emptyText}</td></tr>`}
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
    <div class="flex items-center justify-between px-4 py-3 text-sm text-gray-500" role="navigation" aria-label="페이지 네비게이션">
      <span>총 ${formatNumber(total)}건</span>
      <div class="flex gap-2 items-center">
        ${page > 1 ? `<button onclick="${onPageChange}(${page - 1})" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200" aria-label="이전 페이지"><i class="fas fa-chevron-left text-xs"></i> 이전</button>` : ''}
        <span class="px-3 py-1 font-medium" aria-current="page">${page} / ${totalPages}</span>
        ${page < totalPages ? `<button onclick="${onPageChange}(${page + 1})" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200" aria-label="다음 페이지">다음 <i class="fas fa-chevron-right text-xs"></i></button>` : ''}
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
