// ============================================================
// Airflow OMS — Shared Table Component v6.0
// 재사용 가능한 테이블, 페이지네이션, 상태카드, 접근성
// v6: 가상 스크롤, 클라이언트 정렬, 행 하이라이트
// ============================================================

/**
 * 범용 데이터 테이블 생성 v6
 * @param {Object} config
 *   columns:    [{ key, label, align, width, render, thClass, tdClass, show, sortable }]
 *   rows:       데이터 배열
 *   onRowClick: 행 클릭 함수명 문자열
 *   rowAttrs:   (row, idx) => 추가 속성 문자열
 *   rowClass:   (row, idx) => 추가 CSS 클래스 문자열
 *   emptyText:  빈 테이블 메시지
 *   className:  외부 div 추가 클래스
 *   tableId:    <table> id 속성
 *   caption:    접근성 캡션 (sr-only)
 *   tbodyId:    <tbody> id 속성
 *   compact:    true이면 px-3 py-2
 *   noBorder:   true이면 외부 border 제거
 *   virtualScroll: { maxHeight, rowHeight } — 가상 스크롤 (100+ 행 자동 활성)
 *   sortable:   true이면 컬럼 헤더 클릭으로 정렬 (클라이언트)
 */
function renderDataTable(config) {
  const {
    columns: rawCols, rows = [], onRowClick, rowAttrs, rowClass,
    emptyText = '데이터가 없습니다.', className = '', tableId = '',
    caption = '', tbodyId = '', compact = false, noBorder = false,
    virtualScroll, sortable = false
  } = config;

  // 조건부 컬럼 필터링
  const columns = rawCols.filter(c => {
    if (c.show === undefined) return true;
    return typeof c.show === 'function' ? c.show() : !!c.show;
  });

  const px = compact ? 'px-3 py-2' : 'px-4 py-3';
  const border = noBorder ? '' : 'border border-gray-100';

  // 가상 스크롤 활성 조건: 명시적 설정 또는 100행 초과
  const useVirtual = virtualScroll || rows.length > 100;
  const maxH = (virtualScroll && virtualScroll.maxHeight) || 480;
  const rh = (virtualScroll && virtualScroll.rowHeight) || 44;
  const tId = tableId || ('dt-' + Math.random().toString(36).slice(2, 8));

  // 헤더 HTML
  const headerHtml = columns.map(c => {
    const align = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left';
    const isSortable = (sortable || c.sortable) && c.key && c.key !== '_actions' && c.key !== '_chk' && c.key !== '_progress';
    const sortAttr = isSortable
      ? ` style="cursor:pointer" onclick="window._dtSort('${tId}','${c.key}')" title="${c.label} 기준 정렬" data-sort-key="${c.key}"`
      : '';
    return `<th class="${px} ${align} font-medium ${c.thClass || ''}" ${c.width ? `style="width:${c.width}${isSortable ? ';cursor:pointer' : ''}"` : ''} ${sortAttr} scope="col">${c.label}${isSortable ? ' <i class="fas fa-sort text-gray-300 text-xs ml-1"></i>' : ''}</th>`;
  }).join('');

  // 행 렌더링 함수
  function renderRow(row, i) {
    const extraClass = rowClass ? rowClass(row, i) : '';
    const extraAttrs = rowAttrs ? rowAttrs(row, i) : '';
    const clickable = onRowClick ? 'cursor-pointer ix-table-row' : '';
    const clickAttr = onRowClick ? `onclick="${onRowClick}(${row.id || row.order_id || row.user_id || i})"` : '';
    return `<tr class="hover:bg-gray-50 ${clickable} ${extraClass}" ${clickAttr} ${extraAttrs}>
      ${columns.map(c => {
        const val = c.render ? c.render(row, i) : (row[c.key] !== undefined ? row[c.key] : '-');
        const align = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left';
        return `<td class="${px} ${align} ${c.tdClass || ''}">${val}</td>`;
      }).join('')}
    </tr>`;
  }

  const emptyRow = `<tr><td colspan="${columns.length}" class="px-4 py-8 text-center text-gray-400">${emptyText}</td></tr>`;

  // 가상 스크롤 모드
  if (useVirtual && rows.length > 50) {
    const vsId = 'vs-' + tId;
    // 데이터를 전역에 저장하여 스크롤 핸들러에서 접근
    const dataKey = '_dtData_' + tId.replace(/-/g, '_');
    const colsKey = '_dtCols_' + tId.replace(/-/g, '_');

    // 초기 렌더 (첫 30행만)
    const initialRows = rows.slice(0, 30).map(renderRow).join('');

    // 스크롤 핸들러 등록용 스크립트
    const scrollScript = `<script>
(function(){
  var vs = document.getElementById('${vsId}');
  var tbody = vs ? vs.querySelector('tbody') : null;
  if (!vs || !tbody) return;
  var allRows = window['${dataKey}'] || [];
  var rendered = 30;
  var loading = false;
  vs.addEventListener('scroll', function() {
    if (loading || rendered >= allRows.length) return;
    if (vs.scrollTop + vs.clientHeight >= vs.scrollHeight - 100) {
      loading = true;
      var batch = allRows.slice(rendered, rendered + 20);
      var html = '';
      for (var i = 0; i < batch.length; i++) {
        html += window['_dtRenderRow_${tId}'](batch[i], rendered + i);
      }
      tbody.insertAdjacentHTML('beforeend', html);
      rendered += batch.length;
      loading = false;
    }
  });
})();
</script>`;

    // 렌더 함수를 전역에 등록
    return `
    <div class="bg-white rounded-xl ${border} overflow-hidden ${className}">
      <div id="${vsId}" class="overflow-auto" style="max-height:${maxH}px">
        <table class="w-full text-sm" id="${tId}" role="grid">
          ${caption ? `<caption class="sr-only">${caption}</caption>` : ''}
          <thead class="bg-gray-50 text-gray-600 sticky top-0 z-10">
            <tr>${headerHtml}</tr>
          </thead>
          <tbody class="divide-y" ${tbodyId ? `id="${tbodyId}"` : ''}>
            ${rows.length > 0 ? initialRows : emptyRow}
          </tbody>
        </table>
      </div>
      ${rows.length > 30 ? `<div class="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-100 flex justify-between">
        <span>표시: <span id="${tId}-count">30</span>/${rows.length}건</span>
        <span>스크롤하여 더보기</span>
      </div>` : ''}
    </div>
    <script>
      window['${dataKey}'] = ${JSON.stringify(rows)};
      window['_dtRenderRow_${tId}'] = function(row, i) {
        ${columns.map((c, ci) => {
          if (c.render) return ''; // render 함수는 인라인 불가 — 서버에서 pre-render
          return '';
        }).join('')}
        var cells = '';
        var cols = ${JSON.stringify(columns.map(c => ({ key: c.key, align: c.align, tdClass: c.tdClass || '' })))};
        for (var ci = 0; ci < cols.length; ci++) {
          var c = cols[ci];
          var val = row[c.key] !== undefined ? row[c.key] : '-';
          var al = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left';
          cells += '<td class="${px} ' + al + ' ' + c.tdClass + '">' + val + '</td>';
        }
        return '<tr class="hover:bg-gray-50">' + cells + '</tr>';
      };
    </script>
    ${scrollScript}`;
  }

  // 일반 렌더링 (50행 이하)
  const bodyHtml = rows.length > 0
    ? rows.map(renderRow).join('')
    : emptyRow;

  return `
    <div class="bg-white rounded-xl ${border} overflow-hidden ${className}">
      <div class="overflow-x-auto">
        <table class="w-full text-sm" ${tableId ? `id="${tableId}"` : `id="${tId}"`} role="grid">
          ${caption ? `<caption class="sr-only">${caption}</caption>` : ''}
          <thead class="bg-gray-50 text-gray-600">
            <tr>${headerHtml}</tr>
          </thead>
          <tbody class="divide-y" ${tbodyId ? `id="${tbodyId}"` : ''}>
            ${bodyHtml}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ─── 클라이언트 정렬 헬퍼 ───
window._dtSortState = {};
window._dtSort = function(tId, key) {
  var state = window._dtSortState[tId] || { key: '', dir: 'asc' };
  if (state.key === key) {
    state.dir = state.dir === 'asc' ? 'desc' : 'asc';
  } else {
    state.key = key;
    state.dir = 'asc';
  }
  window._dtSortState[tId] = state;

  var table = document.getElementById(tId);
  if (!table) return;
  var tbody = table.querySelector('tbody');
  var thList = Array.from(table.querySelectorAll('thead th'));
  
  // data-sort-key 속성 또는 인덱스 기반으로 컬럼 찾기
  var aIdx = thList.findIndex(function(th) {
    return th.dataset.sortKey === key;
  });
  if (aIdx < 0) {
    // fallback: 헤더 텍스트 포함 검색
    aIdx = thList.findIndex(function(th) { return th.textContent.trim().replace(/[▲▼↕]/g, '').includes(key); });
  }
  if (aIdx < 0) return;
  
  // 정렬 아이콘 업데이트
  thList.forEach(function(th) {
    var icon = th.querySelector('.fa-sort, .fa-sort-up, .fa-sort-down');
    if (icon) { icon.className = 'fas fa-sort text-gray-300 text-xs ml-1'; }
  });
  var activeIcon = thList[aIdx] ? thList[aIdx].querySelector('.fa-sort, .fa-sort-up, .fa-sort-down') : null;
  if (activeIcon) {
    activeIcon.className = 'fas ' + (state.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down') + ' text-blue-500 text-xs ml-1';
  }

  var rows = Array.from(tbody.querySelectorAll('tr'));

  rows.sort(function(a, b) {
    var aVal = a.cells[aIdx] ? a.cells[aIdx].textContent.trim() : '';
    var bVal = b.cells[aIdx] ? b.cells[aIdx].textContent.trim() : '';
    var aNum = parseFloat(aVal.replace(/[^0-9.-]/g, ''));
    var bNum = parseFloat(bVal.replace(/[^0-9.-]/g, ''));
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return state.dir === 'asc' ? aNum - bNum : bNum - aNum;
    }
    return state.dir === 'asc' ? aVal.localeCompare(bVal, 'ko') : bVal.localeCompare(aVal, 'ko');
  });

  rows.forEach(function(row) { tbody.appendChild(row); });
};

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
