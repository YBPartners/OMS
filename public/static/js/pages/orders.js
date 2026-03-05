// ============================================================
// 다하다 OMS - 주문관리 + 자동배분 페이지 v7.1
// Interaction Design: 행 우클릭 컨텍스트메뉴, 호버 프리뷰,
// 상태 플로우 시각화, 드로어 상세, 배치 액션바
// 배분: 자동배분, 개별 수동배분, 선택 일괄배분, 드로어 배분
// ============================================================

// ─── 주문 목록 선택 상태 ───
const orderListState = {
  selected: new Set(),
};

// ════════ 주문 관리 ════════
async function renderOrders(el) {
  showSkeletonLoading(el, 'table');
  const params = new URLSearchParams(window._orderFilters || {});
  if (!params.has('limit')) params.set('limit', '15');
  const res = await api('GET', `/orders?${params.toString()}`);
  if (!res) return;

  // 선택 상태 정리
  const currentIds = new Set((res.orders || []).map(o => o.order_id));
  for (const id of orderListState.selected) {
    if (!currentIds.has(id)) orderListState.selected.delete(id);
  }

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-list-check mr-2 text-blue-600"></i>주문관리</h2>
        <div class="flex gap-2">
          <button onclick="showImportModal()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition"><i class="fas fa-file-import mr-1"></i>일괄 수신</button>
          <button onclick="showNewOrderModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"><i class="fas fa-plus mr-1"></i>수동 등록</button>
        </div>
      </div>
      
      <!-- 필터 -->
      <div class="bg-white rounded-xl p-4 mb-4 border border-gray-100 flex flex-wrap gap-3 items-end">
        <div><label class="block text-xs text-gray-500 mb-1">상태</label>
          <select id="f-status" class="border rounded-lg px-3 py-2 text-sm" onchange="applyOrderFilter()">
            <option value="">전체</option>
            ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${params.get('status') === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select></div>
        <div><label class="block text-xs text-gray-500 mb-1">검색</label>
          <input id="f-search" class="border rounded-lg px-3 py-2 text-sm w-48" placeholder="고객명/주소/주문번호" value="${params.get('search') || ''}" onkeypress="if(event.key==='Enter')applyOrderFilter()"></div>
        <div><label class="block text-xs text-gray-500 mb-1">시작일</label>
          <input id="f-from" type="date" class="border rounded-lg px-3 py-2 text-sm" value="${params.get('from') || ''}"></div>
        <div><label class="block text-xs text-gray-500 mb-1">종료일</label>
          <input id="f-to" type="date" class="border rounded-lg px-3 py-2 text-sm" value="${params.get('to') || ''}"></div>
        <button onclick="applyOrderFilter()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition"><i class="fas fa-search mr-1"></i>조회</button>
        ${orderListState.selected.size > 0 ? `
          <div class="ml-auto flex items-center gap-2 text-sm">
            <span class="text-purple-600 font-medium"><i class="fas fa-check-square mr-1"></i>${orderListState.selected.size}건 선택</span>
            <button onclick="orderListState.selected.clear();renderContent()" class="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs hover:bg-gray-200">해제</button>
          </div>
        ` : ''}
      </div>

      <!-- 테이블 -->
      <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-600"><tr>
              <th class="px-2 py-3 text-center w-8">
                <input type="checkbox" class="w-3.5 h-3.5 rounded" 
                  ${orderListState.selected.size === (res.orders || []).length && res.orders?.length > 0 ? 'checked' : ''}
                  onchange="toggleAllOrderSelection(this.checked)" data-tooltip="전체 선택/해제">
              </th>
              <th class="px-3 py-3 text-left">ID</th><th class="px-3 py-3 text-left">주문번호</th><th class="px-3 py-3 text-left">고객명</th>
              <th class="px-3 py-3 text-left">주소</th><th class="px-3 py-3 text-right">금액</th><th class="px-3 py-3 text-left">지역법인</th>
              <th class="px-3 py-3 text-left">팀장</th><th class="px-3 py-3 text-center">상태</th><th class="px-3 py-3 text-left">요청일</th>
              <th class="px-3 py-3 text-center">진행</th><th class="px-3 py-3 text-center w-10"></th>
            </tr></thead>
            <tbody class="divide-y" id="order-table-body">
              ${(res.orders || []).map(o => {
                const sel = orderListState.selected.has(o.order_id);
                return `
                <tr class="ix-table-row ${sel ? 'bg-blue-50' : ''}" 
                    onclick="handleOrderRowClick(event, ${o.order_id})"
                    oncontextmenu="showOrderContextMenu(event, ${JSON.stringify(o).replace(/"/g, '&quot;')})">
                  <td class="px-2 py-3 text-center" onclick="event.stopPropagation()">
                    <input type="checkbox" class="w-3.5 h-3.5 rounded" ${sel ? 'checked' : ''}
                      onchange="toggleOrderSelection(${o.order_id}, this.checked)">
                  </td>
                  <td class="px-3 py-3 text-gray-400 font-mono text-xs"
                      data-preview="order" data-preview-id="${o.order_id}" data-preview-title="주문 #${o.order_id}">${o.order_id}</td>
                  <td class="px-3 py-3 font-mono text-xs">${o.external_order_no || '<span class="text-gray-400">미확정</span>'}</td>
                  <td class="px-3 py-3 font-medium">${o.customer_name || '-'}</td>
                  <td class="px-3 py-3 text-gray-600 max-w-[180px] truncate" title="${o.address_text || ''}">${o.address_text || '-'}</td>
                  <td class="px-3 py-3 text-right font-medium">${formatAmount(o.base_amount)}</td>
                  <td class="px-3 py-3 text-xs">${o.region_name || '<span class="text-gray-400">-</span>'}</td>
                  <td class="px-3 py-3 text-xs">${o.team_leader_name || '<span class="text-gray-400">-</span>'}</td>
                  <td class="px-3 py-3 text-center">${statusBadge(o.status)}</td>
                  <td class="px-3 py-3 text-gray-500 text-xs">${o.requested_date || '-'}</td>
                  <td class="px-3 py-3">${_renderStatusProgress(o.status)}</td>
                  <td class="px-3 py-3 text-center">
                    <button onclick="event.stopPropagation();showOrderActionMenu(event, ${JSON.stringify(o).replace(/"/g, '&quot;')})" 
                      class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition" data-tooltip="액션 메뉴">
                      <i class="fas fa-ellipsis-vertical"></i>
                    </button>
                  </td>
                </tr>`;
              }).join('')}
              ${(res.orders || []).length === 0 ? '<tr><td colspan="12" class="px-4 py-8 text-center text-gray-400">데이터가 없습니다.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
          <span>총 ${res.total}건</span>
          <div class="flex gap-2">
            ${Number(res.page) > 1 ? `<button onclick="window._orderFilters={...window._orderFilters||{},page:${Number(res.page)-1}};renderContent()" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 transition">이전</button>` : ''}
            <span class="px-3 py-1">${res.page} / ${Math.ceil(res.total / Number(res.limit)) || 1}</span>
            ${Number(res.page) < Math.ceil(res.total / Number(res.limit)) ? `<button onclick="window._orderFilters={...window._orderFilters||{},page:${Number(res.page)+1}};renderContent()" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 transition">다음</button>` : ''}
          </div>
        </div>
      </div>
    </div>`;

  // 배치 액션 바
  updateOrderBatchBar();
}

// ─── 행 클릭 → 드로어 상세 ───
function handleOrderRowClick(event, orderId) {
  if (event.target.closest('button') || event.target.closest('input[type="checkbox"]')) return;
  showOrderDetailDrawer(orderId);
}

// ─── 주문 상세 드로어 (사이드패널) ───
async function showOrderDetailDrawer(orderId) {
  const res = await api('GET', `/orders/${orderId}`);
  if (!res?.order) return;
  const o = res.order;

  const content = `
    <div class="space-y-5">
      <!-- 헤더 -->
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xl font-bold">${o.customer_name || '-'}</div>
          <div class="text-xs text-gray-500 font-mono mt-1">#${o.order_id} · ${o.external_order_no || '미확정'}</div>
        </div>
        <div class="text-right">
          <div class="text-lg font-bold text-blue-600">${formatAmount(o.base_amount)}</div>
          ${statusBadge(o.status)}
        </div>
      </div>

      <!-- 상태 진행 바 -->
      ${renderStatusFlowLarge(o.status, res.history)}

      <!-- 기본 정보 -->
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-gray-50 rounded-lg p-3">
          <div class="text-[10px] text-gray-400 uppercase">주소</div>
          <div class="text-sm mt-1">${o.address_text || '-'}</div>
        </div>
        <div class="bg-gray-50 rounded-lg p-3">
          <div class="text-[10px] text-gray-400 uppercase">연락처</div>
          <div class="text-sm mt-1">${o.customer_phone || '-'}</div>
        </div>
        <div class="bg-gray-50 rounded-lg p-3">
          <div class="text-[10px] text-gray-400 uppercase">지역법인</div>
          <div class="text-sm mt-1">${o.region_name || '-'}</div>
        </div>
        <div class="bg-gray-50 rounded-lg p-3">
          <div class="text-[10px] text-gray-400 uppercase">배정팀장</div>
          <div class="text-sm mt-1">${o.team_leader_name || '-'}</div>
        </div>
        <div class="bg-gray-50 rounded-lg p-3">
          <div class="text-[10px] text-gray-400 uppercase">행정동코드</div>
          <div class="text-sm font-mono mt-1">${o.admin_dong_code || '-'}</div>
        </div>
        <div class="bg-gray-50 rounded-lg p-3">
          <div class="text-[10px] text-gray-400 uppercase">요청일</div>
          <div class="text-sm mt-1">${o.requested_date || '-'}</div>
        </div>
      </div>

      <!-- 보고서 -->
      ${res.reports?.length > 0 ? `
      <div>
        <h4 class="font-semibold text-sm mb-2"><i class="fas fa-file-lines mr-1 text-cyan-500"></i>보고서 (v${res.reports[0].version})</h4>
        <div class="bg-cyan-50 rounded-lg p-3 text-sm border border-cyan-200">
          <div><span class="text-gray-500">제출일:</span> ${formatDate(res.reports[0].submitted_at)}</div>
          <div class="mt-1"><span class="text-gray-500">메모:</span> ${res.reports[0].note || '-'}</div>
        </div>
      </div>` : ''}

      <!-- 검수 이력 -->
      ${res.reviews?.length > 0 ? `
      <div>
        <h4 class="font-semibold text-sm mb-2"><i class="fas fa-clipboard-check mr-1 text-green-500"></i>검수 이력</h4>
        <div class="space-y-2">${res.reviews.map(r => `
          <div class="bg-gray-50 rounded-lg p-3 text-sm flex items-center justify-between">
            <div><span class="font-medium">${r.stage === 'REGION' ? '지역 1차' : 'HQ 2차'}</span>
              <span class="ml-2 ${r.result === 'APPROVE' ? 'text-green-600' : 'text-red-600'}">${r.result === 'APPROVE' ? '승인' : '반려'}</span></div>
            <div class="text-gray-500 text-xs">${r.reviewer_name} · ${formatDate(r.reviewed_at)}</div>
          </div>`).join('')}</div>
      </div>` : ''}

      <!-- 빠른 액션 -->
      <div class="border-t pt-4">
        <h4 class="font-semibold text-sm mb-3"><i class="fas fa-bolt mr-1 text-amber-500"></i>빠른 액션</h4>
        <div class="flex flex-wrap gap-2">
          ${_getQuickActions(o)}
        </div>
      </div>

      <!-- 상태 이력 -->
      ${res.history?.length > 0 ? `
      <div>
        <h4 class="font-semibold text-sm mb-2"><i class="fas fa-clock-rotate-left mr-1 text-blue-500"></i>상태 이력</h4>
        <div class="space-y-1.5 max-h-48 overflow-y-auto">${res.history.map(h => `
          <div class="flex items-center gap-2 text-xs text-gray-600 p-1.5 rounded hover:bg-gray-50">
            <span class="text-gray-400 w-28 flex-shrink-0">${formatDate(h.created_at)}</span>
            ${statusBadge(h.from_status || 'NEW')} <i class="fas fa-arrow-right text-gray-300"></i> ${statusBadge(h.to_status)}
            <span class="text-gray-400 ml-auto">${h.actor_name || ''}</span>
          </div>`).join('')}</div>
      </div>` : ''}
    </div>`;

  const footer = `
    <button onclick="closeDrawer();showOrderDetail(${o.order_id})" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition">
      <i class="fas fa-expand mr-1"></i>모달로 보기
    </button>
    <button onclick="closeDrawer()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">닫기</button>`;

  showDrawer(content, {
    title: `주문 #${o.order_id}`,
    subtitle: `${o.customer_name || ''} · ${formatAmount(o.base_amount)}`,
    width: '500px',
    footer
  });
}

// ─── 빠른 액션 버튼 생성 ───
function _getQuickActions(order) {
  const actions = [];
  const s = order.status;

  actions.push(`<button onclick="closeDrawer();showOrderHistoryDrawer(${order.order_id})" class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200 transition"><i class="fas fa-clock-rotate-left mr-1"></i>이력 타임라인</button>`);
  actions.push(`<button onclick="closeDrawer();showOrderAuditDrawer(${order.order_id})" class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200 transition"><i class="fas fa-scroll mr-1"></i>감사 로그</button>`);

  // 미배분 상태 → 수동 배분 버튼
  if (['RECEIVED', 'VALIDATED', 'DISTRIBUTION_PENDING'].includes(s)) {
    actions.push(`<button onclick="closeDrawer();showManualDistributeModal(${order.order_id}, '${(order.customer_name||'').replace(/'/g, "\\'")}', '${(order.address_text||'').replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700 transition"><i class="fas fa-share-nodes mr-1"></i>수동 배분</button>`);
  }
  if (s === 'DISTRIBUTED') {
    actions.push(`<button onclick="closeDrawer();showAssignModal(${order.order_id})" class="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs hover:bg-purple-700 transition"><i class="fas fa-user-plus mr-1"></i>팀장 배정</button>`);
  }
  if (s === 'ASSIGNED') {
    actions.push(`<button onclick="closeDrawer();startWork(${order.order_id})" class="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs hover:bg-orange-700 transition"><i class="fas fa-play mr-1"></i>작업 시작</button>`);
  }
  if (s === 'SUBMITTED') {
    actions.push(`<button onclick="closeDrawer();showReviewModal(${order.order_id},'region','APPROVE')" class="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition"><i class="fas fa-check mr-1"></i>승인</button>`);
    actions.push(`<button onclick="closeDrawer();showReviewModal(${order.order_id},'region','REJECT')" class="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 transition"><i class="fas fa-times mr-1"></i>반려</button>`);
  }
  if (s === 'REGION_APPROVED') {
    actions.push(`<button onclick="closeDrawer();showReviewModal(${order.order_id},'hq','APPROVE')" class="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition"><i class="fas fa-check-double mr-1"></i>HQ 승인</button>`);
    actions.push(`<button onclick="closeDrawer();showReviewModal(${order.order_id},'hq','REJECT')" class="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 transition"><i class="fas fa-times mr-1"></i>HQ 반려</button>`);
  }
  if (['IN_PROGRESS', 'REGION_REJECTED', 'HQ_REJECTED'].includes(s)) {
    actions.push(`<button onclick="closeDrawer();showReportModal(${order.order_id})" class="px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs hover:bg-cyan-700 transition"><i class="fas fa-file-pen mr-1"></i>보고서 제출</button>`);
  }

  return actions.join('');
}

// ─── 행 ⋮ 액션 메뉴 (3점 아이콘 클릭) ───
function showOrderActionMenu(event, order) {
  const o = typeof order === 'string' ? JSON.parse(order) : order;
  showOrderContextMenu(event, o);
}

// ─── 선택 관리 ───
function toggleOrderSelection(orderId, checked) {
  if (checked) orderListState.selected.add(orderId);
  else orderListState.selected.delete(orderId);
  updateOrderBatchBar();
  // 체크박스 행 배경 업데이트
  const row = document.querySelector(`tr[onclick*="handleOrderRowClick(event, ${orderId})"]`);
  if (row) row.classList.toggle('bg-blue-50', checked);
}

function toggleAllOrderSelection(checked) {
  const rows = document.querySelectorAll('#order-table-body tr');
  rows.forEach(row => {
    const cb = row.querySelector('input[type="checkbox"]');
    if (cb) {
      cb.checked = checked;
      const onclick = row.getAttribute('onclick') || '';
      const match = onclick.match(/handleOrderRowClick\(event,\s*(\d+)\)/);
      if (match) {
        const id = Number(match[1]);
        if (checked) orderListState.selected.add(id);
        else orderListState.selected.delete(id);
        row.classList.toggle('bg-blue-50', checked);
      }
    }
  });
  updateOrderBatchBar();
}

function updateOrderBatchBar() {
  if (orderListState.selected.size > 0) {
    showBatchActionBar(
      { length: orderListState.selected.size, clearFn: 'orderListState.selected.clear();renderContent()' },
      [
        { icon: 'fa-eye', label: '일괄 상세보기', className: 'bg-blue-100 text-blue-700', onclick: `showBatchOrderSummary()` },
        { icon: 'fa-share-nodes', label: '일괄 배분', className: 'bg-indigo-100 text-indigo-700', onclick: `showOrderBatchDistributeModal()` },
      ]
    );
  } else {
    closeBatchActionBar();
  }
}

function showBatchOrderSummary() {
  const ids = [...orderListState.selected];
  showToast(`선택된 주문: ${ids.map(id => '#' + id).join(', ')}`, 'info');
}

function applyOrderFilter() {
  window._orderFilters = { status: document.getElementById('f-status')?.value, search: document.getElementById('f-search')?.value, from: document.getElementById('f-from')?.value, to: document.getElementById('f-to')?.value, page: 1 };
  Object.keys(window._orderFilters).forEach(k => { if (!window._orderFilters[k]) delete window._orderFilters[k]; });
  orderListState.selected.clear();
  renderContent();
}

// ─── 주문 상세 모달 (기존 호환 — 드로어 외 사용시) ───
async function showOrderDetail(orderId) {
  const res = await api('GET', `/orders/${orderId}`);
  if (!res?.order) return;
  const o = res.order;
  const content = `
    <div class="space-y-4">
      ${renderStatusFlowLarge(o.status, res.history)}
      <div class="grid grid-cols-2 gap-4">
        <div><label class="text-xs text-gray-500">주문ID</label><div class="font-mono">${o.order_id}</div></div>
        <div><label class="text-xs text-gray-500">외부주문번호</label><div class="font-mono">${o.external_order_no || '미확정'}</div></div>
        <div><label class="text-xs text-gray-500">고객명</label><div class="font-medium">${o.customer_name || '-'}</div></div>
        <div><label class="text-xs text-gray-500">연락처</label><div>${o.customer_phone || '-'}</div></div>
        <div class="col-span-2"><label class="text-xs text-gray-500">주소</label><div>${o.address_text}</div></div>
        <div><label class="text-xs text-gray-500">행정동코드</label><div class="font-mono text-xs">${o.admin_dong_code || '-'}</div></div>
        <div><label class="text-xs text-gray-500">금액</label><div class="font-bold text-blue-600">${formatAmount(o.base_amount)}</div></div>
        <div><label class="text-xs text-gray-500">상태</label><div>${statusBadge(o.status)}</div></div>
        <div><label class="text-xs text-gray-500">지역법인</label><div>${o.region_name || '-'}</div></div>
        <div><label class="text-xs text-gray-500">배정팀장</label><div>${o.team_leader_name || '-'}</div></div>
        <div><label class="text-xs text-gray-500">요청일</label><div>${o.requested_date || '-'}</div></div>
      </div>
      ${res.reports?.length > 0 ? `
      <div class="border-t pt-4">
        <h4 class="font-semibold mb-2"><i class="fas fa-file-lines mr-1"></i>보고서 (v${res.reports[0].version})</h4>
        <div class="bg-gray-50 rounded-lg p-3 text-sm">
          <div><span class="text-gray-500">제출일:</span> ${formatDate(res.reports[0].submitted_at)}</div>
          <div><span class="text-gray-500">메모:</span> ${res.reports[0].note || '-'}</div>
        </div>
      </div>` : ''}
      ${res.reviews?.length > 0 ? `
      <div class="border-t pt-4">
        <h4 class="font-semibold mb-2"><i class="fas fa-clipboard-check mr-1"></i>검수 이력</h4>
        <div class="space-y-2">${res.reviews.map(r => `
          <div class="bg-gray-50 rounded-lg p-3 text-sm flex items-center justify-between">
            <div><span class="font-medium">${r.stage === 'REGION' ? '지역 1차' : 'HQ 2차'}</span>
              <span class="ml-2 ${r.result === 'APPROVE' ? 'text-green-600' : 'text-red-600'}">${r.result === 'APPROVE' ? '승인' : '반려'}</span></div>
            <div class="text-gray-500 text-xs">${r.reviewer_name} · ${formatDate(r.reviewed_at)}</div>
          </div>`).join('')}</div>
      </div>` : ''}
      ${res.history?.length > 0 ? `
      <div class="border-t pt-4">
        <h4 class="font-semibold mb-2"><i class="fas fa-clock-rotate-left mr-1"></i>상태 이력</h4>
        <div class="space-y-1 max-h-40 overflow-y-auto">${res.history.map(h => `
          <div class="flex items-center gap-2 text-xs text-gray-600">
            <span class="text-gray-400 w-32 flex-shrink-0">${formatDate(h.created_at)}</span>
            ${statusBadge(h.from_status || 'NEW')} <i class="fas fa-arrow-right text-gray-300"></i> ${statusBadge(h.to_status)}
            <span class="text-gray-400">${h.actor_name || ''}</span>
          </div>`).join('')}</div>
      </div>` : ''}
    </div>`;
  showModal(`주문 상세 #${o.order_id}`, content, `
    <button onclick="closeModal();showOrderHistoryDrawer(${o.order_id})" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"><i class="fas fa-clock-rotate-left mr-1"></i>이력 타임라인</button>
    <button onclick="closeModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">닫기</button>`, { large: true });
}

// ─── 수동 등록 모달 ───
function showNewOrderModal() {
  const content = `
    <form id="new-order-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-xs text-gray-500 mb-1">외부주문번호</label><input name="external_order_no" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="AJD-2026-XXXX"></div>
        <div><label class="block text-xs text-gray-500 mb-1">서비스유형</label><input name="service_type" value="DEFAULT" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">고객명 *</label><input name="customer_name" required class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">연락처</label><input name="customer_phone" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div class="col-span-2"><label class="block text-xs text-gray-500 mb-1">주소 *</label><input name="address_text" required class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">행정동코드</label><input name="admin_dong_code" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="1168010100"></div>
        <div><label class="block text-xs text-gray-500 mb-1">금액 *</label><input name="base_amount" type="number" required class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">요청일</label><input name="requested_date" type="date" value="${new Date().toISOString().split('T')[0]}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
      </div>
    </form>`;
  showModal('주문 수동 등록', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitNewOrder()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">등록</button>`);
}
async function submitNewOrder() {
  const data = Object.fromEntries(new FormData(document.getElementById('new-order-form')));
  data.base_amount = Number(data.base_amount);
  const res = await api('POST', '/orders', data);
  if (res?._status === 201) { showToast('주문이 등록되었습니다.', 'success'); closeModal(); renderContent(); }
  else showToast(res?.error || res?.warning || '등록 실패', 'error');
}

// ─── 일괄 수신 모달 ───
function showImportModal() {
  const content = `
    <div class="space-y-4">
      <p class="text-sm text-gray-600">JSON 형태로 주문 데이터를 입력하세요.</p>
      <textarea id="import-data" rows="8" class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder='{"orders":[{"customer_name":"테스트","address_text":"서울특별시 강남구 역삼동 100","admin_dong_code":"1168010100","base_amount":100000,"requested_date":"2026-03-03"}]}'></textarea>
    </div>`;
  showModal('주문 일괄 수신', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitImport()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">수신 실행</button>`);
}
async function submitImport() {
  try {
    const data = JSON.parse(document.getElementById('import-data').value);
    const res = await api('POST', '/orders/import', data);
    if (res?.batch_id) { showToast(`배치 #${res.batch_id}: 성공 ${res.success}건, 실패 ${res.fail}건`, res.fail > 0 ? 'warning' : 'success'); closeModal(); renderContent(); }
    else showToast(res?.error || '수신 실패', 'error');
  } catch (e) { showToast('JSON 파싱 오류', 'error'); }
}

// ─── 배분 페이지 선택 상태 ───
const distributeState = {
  selected: new Set(),
};

// ════════ 자동배분 관리 ════════
async function renderDistribute(el) {
  showSkeletonLoading(el, 'cards');
  const [receivedRes, pendingRes, dpRes, distributedRes] = await Promise.all([
    api('GET', '/orders?status=RECEIVED&limit=100'),
    api('GET', '/orders?status=VALIDATED&limit=100'),
    api('GET', '/orders?status=DISTRIBUTION_PENDING&limit=100'),
    api('GET', '/orders?status=DISTRIBUTED&limit=100'),
  ]);
  
  const receivedOrders = receivedRes?.orders || [];
  const validatedOrders = pendingRes?.orders || [];
  const dpOrders = dpRes?.orders || [];
  const allUndistributed = [...receivedOrders, ...validatedOrders, ...dpOrders];
  const receivedCount = receivedOrders.length;
  const validatedCount = validatedOrders.length;
  const dpCount = dpOrders.length;
  const distributedCount = (distributedRes?.orders || []).length;
  const totalPending = receivedCount + validatedCount;
  const totalAll = allUndistributed.length;

  // 현재 선택상태 정리 (목록에 없는 것 제거)
  const currentIds = new Set(allUndistributed.map(o => o.order_id));
  for (const id of distributeState.selected) {
    if (!currentIds.has(id)) distributeState.selected.delete(id);
  }
  const selCount = distributeState.selected.size;

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-share-nodes mr-2 text-indigo-600"></i>배분 관리</h2>
        <div class="flex gap-2">
          ${selCount > 0 ? `
            <button onclick="showBatchDistributeModal()" class="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 shadow-lg transition-all">
              <i class="fas fa-hand-pointer mr-2"></i>선택 배분 (${selCount}건)
            </button>
          ` : ''}
          <button onclick="executeDistributeWithModal()" class="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all ${totalPending === 0 ? 'opacity-50 cursor-not-allowed' : ''}">
            <i class="fas fa-play mr-2"></i>자동 배분 (${totalPending}건)
          </button>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="ix-card bg-white rounded-xl p-4 border border-gray-100 text-center" onclick="window._orderFilters={status:'RECEIVED'};navigateTo('orders')" data-tooltip="수신 주문 보기">
          <div class="text-3xl font-bold text-gray-600">${receivedCount}</div>
          <div class="text-xs text-gray-500 mt-1"><i class="fas fa-inbox mr-1"></i>수신(RECEIVED)</div>
        </div>
        <div class="ix-card bg-white rounded-xl p-4 border border-blue-200 text-center bg-blue-50" onclick="window._orderFilters={status:'VALIDATED'};navigateTo('orders')" data-tooltip="유효성 통과 주문 보기">
          <div class="text-3xl font-bold text-blue-600">${validatedCount}</div>
          <div class="text-xs text-blue-600 mt-1"><i class="fas fa-check-circle mr-1"></i>유효성통과</div>
        </div>
        <div class="ix-card bg-white rounded-xl p-4 border border-yellow-200 text-center bg-yellow-50" onclick="window._orderFilters={status:'DISTRIBUTION_PENDING'};navigateTo('orders')" data-tooltip="배분 보류 주문 보기">
          <div class="text-3xl font-bold text-yellow-600">${dpCount}</div>
          <div class="text-xs text-yellow-600 mt-1"><i class="fas fa-exclamation-triangle mr-1"></i>배분보류</div>
        </div>
        <div class="ix-card bg-white rounded-xl p-4 border border-indigo-200 text-center bg-indigo-50" onclick="window._orderFilters={status:'DISTRIBUTED'};navigateTo('orders')" data-tooltip="배분완료 주문 보기">
          <div class="text-3xl font-bold text-indigo-600">${distributedCount}</div>
          <div class="text-xs text-indigo-600 mt-1"><i class="fas fa-share-nodes mr-1"></i>배분완료(미배정)</div>
        </div>
      </div>

      <div class="bg-white rounded-xl p-6 border border-gray-100 mb-6">
        <h3 class="font-semibold mb-4"><i class="fas fa-sitemap mr-2 text-indigo-500"></i>배분 프로세스 흐름</h3>
        <div class="flex items-center justify-center gap-3 py-4">
          <div class="text-center px-4 py-3 bg-gray-100 rounded-xl">
            <div class="text-lg font-bold">${totalAll}</div>
            <div class="text-xs text-gray-500">미배분 주문</div>
          </div>
          <i class="fas fa-arrow-right text-2xl text-blue-400 animate-pulse"></i>
          <div class="text-center px-6 py-3 bg-blue-100 rounded-xl border-2 border-blue-300">
            <i class="fas fa-cogs text-blue-600 text-xl mb-1"></i>
            <div class="text-xs text-blue-700 font-semibold">행정동 기반<br>자동매칭</div>
          </div>
          <i class="fas fa-arrow-right text-2xl text-blue-400 animate-pulse"></i>
          <div class="grid grid-cols-2 gap-2">
            <div class="text-center px-3 py-2 bg-purple-50 rounded-lg border border-purple-200"><div class="text-xs font-bold text-purple-700">서울법인</div></div>
            <div class="text-center px-3 py-2 bg-purple-50 rounded-lg border border-purple-200"><div class="text-xs font-bold text-purple-700">경기법인</div></div>
            <div class="text-center px-3 py-2 bg-purple-50 rounded-lg border border-purple-200"><div class="text-xs font-bold text-purple-700">인천법인</div></div>
            <div class="text-center px-3 py-2 bg-purple-50 rounded-lg border border-purple-200"><div class="text-xs font-bold text-purple-700">부산법인</div></div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- 배분 대상 (RECEIVED + VALIDATED) -->
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold"><i class="fas fa-hourglass-half mr-2 text-blue-500"></i>배분 대상 — ${totalPending}건</h3>
            ${totalPending > 0 ? `
              <label class="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                <input type="checkbox" class="w-3.5 h-3.5 rounded" 
                  ${selCount > 0 && receivedOrders.concat(validatedOrders).every(o => distributeState.selected.has(o.order_id)) ? 'checked' : ''}
                  onchange="toggleDistSelectGroup(this.checked, 'pending')"> 전체 선택
              </label>
            ` : ''}
          </div>
          <div class="space-y-2 max-h-[400px] overflow-y-auto">
            ${[...receivedOrders, ...validatedOrders].map(o => {
              const sel = distributeState.selected.has(o.order_id);
              return `
              <div class="flex items-center gap-2 p-3 ${sel ? 'bg-blue-100 border-blue-300' : 'bg-blue-50'} rounded-lg text-sm border border-transparent hover:border-blue-200 transition-all">
                <input type="checkbox" class="w-3.5 h-3.5 rounded flex-shrink-0" ${sel ? 'checked' : ''}
                  onchange="toggleDistSelect(${o.order_id}, this.checked)">
                <div class="ix-clickable flex-1 min-w-0" onclick="showOrderDetailDrawer(${o.order_id})">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500 font-mono">#${o.order_id}</span>
                    <span class="font-medium truncate">${o.customer_name || '-'}</span>
                    ${statusBadge(o.status)}
                  </div>
                  <div class="text-xs text-gray-500 mt-0.5 truncate">${o.address_text || '-'}</div>
                </div>
                <span class="text-sm font-medium whitespace-nowrap text-gray-600">${formatAmount(o.base_amount)}</span>
                <button onclick="event.stopPropagation();showManualDistributeModal(${o.order_id}, '${(o.customer_name||'').replace(/'/g, "\\'")}', '${(o.address_text||'').replace(/'/g, "\\'")}')" 
                  class="px-2.5 py-1 bg-blue-200 text-blue-800 rounded text-xs hover:bg-blue-300 whitespace-nowrap flex-shrink-0 transition" data-tooltip="수동 배분">
                  <i class="fas fa-share-nodes"></i>
                </button>
              </div>`;
            }).join('')}
            ${totalPending === 0 ? '<p class="text-gray-400 text-sm text-center py-8">배분 대상 없음</p>' : ''}
          </div>
        </div>
        
        <!-- 배분 보류 (DISTRIBUTION_PENDING) -->
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold"><i class="fas fa-exclamation-triangle mr-2 text-amber-500"></i>배분 보류 (수동 필요) — ${dpCount}건</h3>
            ${dpCount > 0 ? `
              <label class="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                <input type="checkbox" class="w-3.5 h-3.5 rounded"
                  ${selCount > 0 && dpOrders.every(o => distributeState.selected.has(o.order_id)) ? 'checked' : ''}
                  onchange="toggleDistSelectGroup(this.checked, 'dp')"> 전체 선택
              </label>
            ` : ''}
          </div>
          <div class="space-y-2 max-h-[400px] overflow-y-auto">
            ${dpOrders.map(o => {
              const sel = distributeState.selected.has(o.order_id);
              return `
              <div class="flex items-center gap-2 p-3 ${sel ? 'bg-yellow-100 border-yellow-300' : 'bg-yellow-50'} rounded-lg text-sm border border-transparent hover:border-yellow-200 transition-all">
                <input type="checkbox" class="w-3.5 h-3.5 rounded flex-shrink-0" ${sel ? 'checked' : ''}
                  onchange="toggleDistSelect(${o.order_id}, this.checked)">
                <div class="ix-clickable flex-1 min-w-0" onclick="showOrderDetailDrawer(${o.order_id})">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500 font-mono">#${o.order_id}</span>
                    <span class="font-medium truncate">${o.customer_name || '-'}</span>
                  </div>
                  <div class="text-xs text-red-500 mt-0.5 truncate"><i class="fas fa-location-dot mr-1"></i>행정동 매칭 실패 · ${o.address_text || ''}</div>
                </div>
                <span class="text-sm font-medium whitespace-nowrap text-gray-600">${formatAmount(o.base_amount)}</span>
                <button onclick="event.stopPropagation();showManualDistributeModal(${o.order_id}, '${(o.customer_name||'').replace(/'/g, "\\'")}', '${(o.address_text||'').replace(/'/g, "\\'")}')" 
                  class="px-2.5 py-1 bg-amber-200 text-amber-800 rounded text-xs hover:bg-amber-300 whitespace-nowrap flex-shrink-0 transition" data-tooltip="수동 배분">
                  <i class="fas fa-share-nodes"></i>
                </button>
              </div>`;
            }).join('')}
            ${dpCount === 0 ? '<p class="text-gray-400 text-sm text-center py-8">보류 건 없음</p>' : ''}
          </div>
        </div>
      </div>
    </div>`;

  // 저장된 주문 데이터를 window에 캐시 (선택배분용)
  window._distOrders = { received: receivedOrders, validated: validatedOrders, dp: dpOrders };
}

// ─── 배분 체크박스 관리 ───
function toggleDistSelect(orderId, checked) {
  if (checked) distributeState.selected.add(orderId);
  else distributeState.selected.delete(orderId);
  renderContent();
}
function toggleDistSelectGroup(checked, group) {
  const orders = group === 'pending'
    ? [...(window._distOrders?.received || []), ...(window._distOrders?.validated || [])]
    : (window._distOrders?.dp || []);
  orders.forEach(o => {
    if (checked) distributeState.selected.add(o.order_id);
    else distributeState.selected.delete(o.order_id);
  });
  renderContent();
}

// ─── 자동배분 실행 + 결과 모달 ───
async function executeDistributeWithModal() {
  showModal('자동 배분 실행 중...', `
    <div class="text-center py-8">
      <div class="animate-spin w-16 h-16 mx-auto mb-4"><i class="fas fa-cogs text-4xl text-blue-500"></i></div>
      <p class="text-gray-600">행정동 기준으로 지역법인에 주문을 배분하고 있습니다...</p>
    </div>`, '', { large: true });
  const res = await api('POST', '/orders/distribute');
  closeModal();
  if (!res) return;

  const regionSummary = res.region_summary || [];
  const content = `
    <div class="space-y-6">
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-blue-50 rounded-xl p-4 text-center border border-blue-200"><div class="text-3xl font-bold text-blue-600">${res.total || 0}</div><div class="text-xs text-blue-600 font-medium mt-1">처리 대상</div></div>
        <div class="bg-green-50 rounded-xl p-4 text-center border border-green-200"><div class="text-3xl font-bold text-green-600">${res.distributed || 0}</div><div class="text-xs text-green-600 font-medium mt-1">배분 성공</div></div>
        <div class="bg-yellow-50 rounded-xl p-4 text-center border border-yellow-200"><div class="text-3xl font-bold text-yellow-600">${res.pending || 0}</div><div class="text-xs text-yellow-600 font-medium mt-1">보류</div></div>
      </div>
      ${regionSummary.length > 0 ? `
      <div>
        <h4 class="font-semibold mb-3"><i class="fas fa-building mr-1 text-indigo-500"></i>지역법인별 배분 결과</h4>
        <div class="grid grid-cols-2 gap-3">${regionSummary.map((r, i) => `
          <div class="ix-clickable rounded-xl p-4 border-2 ${i % 4 === 0 ? 'border-blue-300 bg-blue-50' : i % 4 === 1 ? 'border-purple-300 bg-purple-50' : i % 4 === 2 ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}">
            <div class="flex items-center justify-between mb-2"><span class="font-bold">${r.name}</span><span class="text-lg font-bold">${r.count}건</span></div>
            <div class="text-sm text-gray-600">${formatAmount(r.amount)}</div>
          </div>`).join('')}</div>
      </div>` : ''}
    </div>`;
  showModal(`<i class="fas fa-check-circle text-green-500 mr-2"></i>자동 배분 완료`, content,
    `<button onclick="closeModal();renderContent()" class="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium">확인</button>`, { large: true });
}

// ─── 수동 배분 모달 (개별) ───
async function showManualDistributeModal(orderId, customerName, addressText) {
  const orgsRes = await api('GET', '/auth/organizations');
  const regions = (orgsRes?.organizations || []).filter(o => o.org_type === 'REGION');
  const content = `
    <div class="space-y-4">
      ${customerName || addressText ? `
      <div class="bg-gray-50 rounded-lg p-3 text-sm border border-gray-200">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-mono text-xs text-gray-400">#${orderId}</span>
          <span class="font-semibold">${customerName || '-'}</span>
        </div>
        ${addressText ? `<div class="text-xs text-gray-500"><i class="fas fa-location-dot mr-1"></i>${addressText}</div>` : ''}
      </div>` : ''}
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2"><i class="fas fa-building mr-1 text-indigo-500"></i>배분할 지역법인 선택</label>
        <select id="manual-region" class="w-full border-2 border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-blue-500 focus:ring focus:ring-blue-200 transition">
          ${regions.map(r => `<option value="${r.org_id}">${r.name} (${r.code})</option>`).join('')}
        </select>
      </div>
      <p class="text-xs text-gray-400"><i class="fas fa-info-circle mr-1"></i>행정동 자동매칭이 불가한 경우 수동으로 지역법인을 지정합니다.</p>
    </div>`;
  showModal(`<i class="fas fa-share-nodes mr-2 text-indigo-500"></i>수동 배분 — 주문 #${orderId}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition">취소</button>
    <button onclick="submitManualDistribute(${orderId})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"><i class="fas fa-check mr-1"></i>배분 확정</button>`);
}
async function submitManualDistribute(orderId) {
  const regionOrgId = Number(document.getElementById('manual-region').value);
  const res = await api('PATCH', `/orders/${orderId}/distribution`, { region_org_id: regionOrgId });
  if (res?.ok) { showToast('수동 배분 완료', 'success'); closeModal(); renderContent(); }
  else showToast(res?.error || '배분 실패', 'error');
}

// ─── 선택 일괄 배분 모달 (배분관리 페이지 — 여러 주문 → 지역법인) ───
async function showBatchDistributeModal() {
  const ids = [...distributeState.selected];
  if (ids.length === 0) { showToast('배분할 주문을 선택하세요.', 'warning'); return; }
  
  const orgsRes = await api('GET', '/auth/organizations');
  const regions = (orgsRes?.organizations || []).filter(o => o.org_type === 'REGION');
  
  // 선택된 주문 정보 수집
  const allOrders = [...(window._distOrders?.received || []), ...(window._distOrders?.validated || []), ...(window._distOrders?.dp || [])];
  const selectedOrders = allOrders.filter(o => ids.includes(o.order_id));
  const totalAmount = selectedOrders.reduce((sum, o) => sum + Number(o.base_amount || 0), 0);

  const content = `
    <div class="space-y-4">
      <div class="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
        <div class="flex items-center gap-4">
          <div class="text-center"><div class="text-2xl font-bold text-indigo-700">${ids.length}</div><div class="text-xs text-indigo-500">선택 주문</div></div>
          <div class="border-l border-indigo-200 h-10"></div>
          <div class="text-center"><div class="text-2xl font-bold text-indigo-700">${formatAmount(totalAmount)}</div><div class="text-xs text-indigo-500">총 금액</div></div>
        </div>
      </div>
      <div class="max-h-40 overflow-y-auto space-y-1">
        ${selectedOrders.map(o => `
          <div class="flex items-center justify-between text-xs bg-gray-50 rounded px-3 py-2">
            <span><span class="font-mono text-gray-400">#${o.order_id}</span> <span class="font-medium ml-1">${o.customer_name || '-'}</span></span>
            <span class="text-gray-500">${o.address_text ? o.address_text.substring(0, 20) + '...' : '-'}</span>
          </div>`).join('')}
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2"><i class="fas fa-building mr-1 text-indigo-500"></i>배분할 지역법인 선택</label>
        <select id="batch-dist-region" class="w-full border-2 border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition">
          ${regions.map(r => `<option value="${r.org_id}">${r.name} (${r.code})</option>`).join('')}
        </select>
      </div>
    </div>`;
  showModal(`<i class="fas fa-hand-pointer mr-2 text-amber-500"></i>선택 일괄 배분 (${ids.length}건)`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition">취소</button>
    <button onclick="submitBatchDistribute()" class="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm hover:from-amber-600 hover:to-orange-600 transition"><i class="fas fa-check mr-1"></i>일괄 배분 실행</button>`, { large: true });
}
async function submitBatchDistribute() {
  const ids = [...distributeState.selected];
  const regionOrgId = Number(document.getElementById('batch-dist-region').value);
  closeModal();
  showModal('일괄 배분 처리 중...', `
    <div class="text-center py-6">
      <div class="animate-spin w-12 h-12 mx-auto mb-3"><i class="fas fa-cogs text-3xl text-amber-500"></i></div>
      <p class="text-gray-600">${ids.length}건의 주문을 배분하고 있습니다...</p>
    </div>`, '');
  const res = await api('POST', '/orders/batch-distribute', { order_ids: ids, region_org_id: regionOrgId });
  closeModal();
  if (!res) return;
  distributeState.selected.clear();
  showModal(`<i class="fas fa-check-circle text-green-500 mr-2"></i>일괄 배분 완료`, `
    <div class="space-y-4">
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-blue-50 rounded-xl p-3 text-center border border-blue-200"><div class="text-2xl font-bold text-blue-600">${res.total || 0}</div><div class="text-xs text-blue-500">처리 대상</div></div>
        <div class="bg-green-50 rounded-xl p-3 text-center border border-green-200"><div class="text-2xl font-bold text-green-600">${res.success || 0}</div><div class="text-xs text-green-500">배분 성공</div></div>
        <div class="bg-red-50 rounded-xl p-3 text-center border border-red-200"><div class="text-2xl font-bold text-red-600">${res.fail || 0}</div><div class="text-xs text-red-500">실패</div></div>
      </div>
      <div class="text-sm text-gray-600"><i class="fas fa-building mr-1 text-indigo-500"></i>배분 법인: <span class="font-semibold">${res.region_name || ''}</span></div>
    </div>`,
    `<button onclick="closeModal();renderContent()" class="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">확인</button>`, { large: true });
}

// ─── 주문관리 페이지에서 일괄 배분 (체크박스 선택 → 배분) ───
async function showOrderBatchDistributeModal() {
  const ids = [...orderListState.selected];
  if (ids.length === 0) { showToast('배분할 주문을 선택하세요.', 'warning'); return; }

  const orgsRes = await api('GET', '/auth/organizations');
  const regions = (orgsRes?.organizations || []).filter(o => o.org_type === 'REGION');

  const content = `
    <div class="space-y-4">
      <div class="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
        <div class="text-center">
          <div class="text-3xl font-bold text-indigo-700">${ids.length}</div>
          <div class="text-xs text-indigo-500 mt-1">선택된 주문</div>
        </div>
      </div>
      <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
        <i class="fas fa-info-circle mr-1"></i>
        RECEIVED/VALIDATED/DISTRIBUTION_PENDING 상태의 주문만 배분됩니다. 이미 배분된 주문은 재배분됩니다.
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2"><i class="fas fa-building mr-1 text-indigo-500"></i>배분할 지역법인 선택</label>
        <select id="order-batch-dist-region" class="w-full border-2 border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition">
          ${regions.map(r => `<option value="${r.org_id}">${r.name} (${r.code})</option>`).join('')}
        </select>
      </div>
    </div>`;
  showModal(`<i class="fas fa-share-nodes mr-2 text-indigo-500"></i>일괄 배분 (${ids.length}건)`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition">취소</button>
    <button onclick="submitOrderBatchDistribute()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition"><i class="fas fa-check mr-1"></i>배분 실행</button>`, { large: true });
}
async function submitOrderBatchDistribute() {
  const ids = [...orderListState.selected];
  const regionOrgId = Number(document.getElementById('order-batch-dist-region').value);
  closeModal();
  showModal('일괄 배분 처리 중...', `
    <div class="text-center py-6">
      <div class="animate-spin w-12 h-12 mx-auto mb-3"><i class="fas fa-cogs text-3xl text-indigo-500"></i></div>
      <p class="text-gray-600">${ids.length}건의 주문을 배분하고 있습니다...</p>
    </div>`, '');
  const res = await api('POST', '/orders/batch-distribute', { order_ids: ids, region_org_id: regionOrgId });
  closeModal();
  if (!res) return;
  orderListState.selected.clear();
  showModal(`<i class="fas fa-check-circle text-green-500 mr-2"></i>일괄 배분 완료`, `
    <div class="space-y-4">
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-blue-50 rounded-xl p-3 text-center border border-blue-200"><div class="text-2xl font-bold text-blue-600">${res.total || 0}</div><div class="text-xs text-blue-500">처리 대상</div></div>
        <div class="bg-green-50 rounded-xl p-3 text-center border border-green-200"><div class="text-2xl font-bold text-green-600">${res.success || 0}</div><div class="text-xs text-green-500">배분 성공</div></div>
        <div class="bg-red-50 rounded-xl p-3 text-center border border-red-200"><div class="text-2xl font-bold text-red-600">${res.fail || 0}</div><div class="text-xs text-red-500">실패</div></div>
      </div>
      <div class="text-sm text-gray-600"><i class="fas fa-building mr-1 text-indigo-500"></i>배분 법인: <span class="font-semibold">${res.region_name || ''}</span></div>
    </div>`,
    `<button onclick="closeModal();renderContent()" class="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">확인</button>`, { large: true });
}
