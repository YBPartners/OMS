// ============================================================
// 다하다 OMS - 칸반보드 (파트장 → 팀장 배정) v7.0
// Interaction Design: 컨텍스트메뉴, 호버프리뷰, 상태플로우,
// 드래그앤드롭, 다중선택·배치배정, 키보드 지원
// ============================================================

// ─── 칸반 상태 ───
const kanbanState = {
  selected: new Set(),          // 선택된 주문 ID
  filterText: '',               // 검색 필터
  filterLeader: '',             // 팀장 필터
  draggedOrderId: null,         // 드래그 중인 주문 ID
  viewMode: 'board',           // 'board' | 'compact'
  sortBy: 'amount_desc',       // amount_desc | amount_asc | date_asc | date_desc
};

async function renderKanban(el) {
  const user = currentUser;
  const orgId = user.org_id;

  const [distRes, assignedRes, leadersRes, inProgressRes] = await Promise.all([
    api('GET', '/orders?status=DISTRIBUTED&limit=200'),
    api('GET', '/orders?status=ASSIGNED&limit=200'),
    api('GET', `/auth/team-leaders?org_id=${orgId}`),
    api('GET', '/orders?status=IN_PROGRESS&limit=200'),
  ]);

  const distributed = distRes?.orders || [];
  const assigned = assignedRes?.orders || [];
  const inProgress = inProgressRes?.orders || [];
  const leaders = leadersRes?.team_leaders || [];
  const allAssigned = [...assigned, ...inProgress];

  // 팀장별 배정 그룹화
  const leaderMap = {};
  leaders.forEach(l => { leaderMap[l.user_id] = { ...l, orders: [] }; });
  allAssigned.forEach(o => {
    if (o.team_leader_id && leaderMap[o.team_leader_id]) {
      leaderMap[o.team_leader_id].orders.push(o);
    }
  });

  // 통계
  const totalUnassigned = distributed.length;
  const totalAssigned = allAssigned.length;
  const totalAmount = distributed.reduce((s, o) => s + (o.base_amount || 0), 0);
  const assignedAmount = allAssigned.reduce((s, o) => s + (o.base_amount || 0), 0);

  // 정렬
  const sortOrders = (orders) => {
    const sorted = [...orders];
    switch (kanbanState.sortBy) {
      case 'amount_desc': return sorted.sort((a, b) => (b.base_amount || 0) - (a.base_amount || 0));
      case 'amount_asc': return sorted.sort((a, b) => (a.base_amount || 0) - (b.base_amount || 0));
      case 'date_asc': return sorted.sort((a, b) => (a.requested_date || '').localeCompare(b.requested_date || ''));
      case 'date_desc': return sorted.sort((a, b) => (b.requested_date || '').localeCompare(a.requested_date || ''));
      default: return sorted;
    }
  };

  // 필터
  const filterOrders = (orders) => {
    if (!kanbanState.filterText) return orders;
    const q = kanbanState.filterText.toLowerCase();
    return orders.filter(o =>
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.address_text || '').toLowerCase().includes(q) ||
      String(o.order_id).includes(q)
    );
  };

  const filteredDistributed = sortOrders(filterOrders(distributed));

  // 선택 상태 유지 — 없어진 주문은 제거
  const allIds = new Set([...distributed.map(o => o.order_id), ...allAssigned.map(o => o.order_id)]);
  for (const id of kanbanState.selected) {
    if (!allIds.has(id)) kanbanState.selected.delete(id);
  }

  el.innerHTML = `
    <div class="fade-in">
      <!-- 헤더 -->
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold text-gray-800">
          <i class="fas fa-columns mr-2 text-purple-600"></i>칸반보드 — 팀장 배정
        </h2>
        <div class="flex gap-2 items-center">
          <button onclick="renderContent()" class="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
            <i class="fas fa-refresh mr-1"></i>새로고침
          </button>
        </div>
      </div>

      <!-- 통계 요약 카드 -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div class="bg-white rounded-xl p-3 border border-blue-200 bg-blue-50 text-center">
          <div class="text-2xl font-bold text-blue-600">${totalUnassigned}</div>
          <div class="text-xs text-blue-600"><i class="fas fa-inbox mr-1"></i>미배정</div>
        </div>
        <div class="bg-white rounded-xl p-3 border border-purple-200 bg-purple-50 text-center">
          <div class="text-2xl font-bold text-purple-600">${totalAssigned}</div>
          <div class="text-xs text-purple-600"><i class="fas fa-user-check mr-1"></i>배정완료</div>
        </div>
        <div class="bg-white rounded-xl p-3 border border-amber-200 bg-amber-50 text-center">
          <div class="text-2xl font-bold text-amber-600">${formatAmount(totalAmount)}</div>
          <div class="text-xs text-amber-600"><i class="fas fa-won-sign mr-1"></i>미배정 금액</div>
        </div>
        <div class="bg-white rounded-xl p-3 border border-green-200 bg-green-50 text-center">
          <div class="text-2xl font-bold text-green-600">${formatAmount(assignedAmount)}</div>
          <div class="text-xs text-green-600"><i class="fas fa-won-sign mr-1"></i>배정 금액</div>
        </div>
        <div class="bg-white rounded-xl p-3 border border-gray-200 text-center">
          <div class="text-2xl font-bold text-gray-600">${leaders.length}</div>
          <div class="text-xs text-gray-600"><i class="fas fa-users mr-1"></i>팀장 수</div>
        </div>
      </div>

      <!-- 도구 모음 -->
      <div class="bg-white rounded-xl p-3 mb-4 border border-gray-100 flex flex-wrap gap-3 items-center">
        <!-- 검색 -->
        <div class="flex items-center gap-2">
          <i class="fas fa-search text-gray-400"></i>
          <input id="kanban-search" type="text" placeholder="고객명/주소/주문번호..." 
            class="border rounded-lg px-3 py-1.5 text-sm w-44"
            value="${kanbanState.filterText}"
            oninput="kanbanState.filterText=this.value;renderContent()">
        </div>
        
        <!-- 정렬 -->
        <select id="kanban-sort" class="border rounded-lg px-3 py-1.5 text-sm"
          onchange="kanbanState.sortBy=this.value;renderContent()">
          <option value="amount_desc" ${kanbanState.sortBy === 'amount_desc' ? 'selected' : ''}>금액 높은순</option>
          <option value="amount_asc" ${kanbanState.sortBy === 'amount_asc' ? 'selected' : ''}>금액 낮은순</option>
          <option value="date_desc" ${kanbanState.sortBy === 'date_desc' ? 'selected' : ''}>최근 요청순</option>
          <option value="date_asc" ${kanbanState.sortBy === 'date_asc' ? 'selected' : ''}>오래된 요청순</option>
        </select>

        <div class="border-l border-gray-200 h-6"></div>
        
        <!-- 다중 선택 컨트롤 -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500">
            <i class="fas fa-check-square mr-1"></i>선택: 
            <strong id="kanban-sel-count" class="text-purple-600">${kanbanState.selected.size}</strong>건
          </span>
          ${kanbanState.selected.size > 0 ? `
            <button onclick="kanbanClearSelection()" class="px-2 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200">
              <i class="fas fa-times mr-1"></i>선택 해제
            </button>
            <button onclick="showBatchAssignModal()" class="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs hover:bg-purple-700 font-medium">
              <i class="fas fa-users mr-1"></i>배치 배정 (${kanbanState.selected.size}건)
            </button>
          ` : `
            <span class="text-xs text-gray-400">카드를 클릭하여 다중 선택</span>
          `}
        </div>

        <div class="border-l border-gray-200 h-6"></div>

        <!-- 전체 선택/해제 -->
        <button onclick="kanbanSelectAll()" class="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100" title="미배정 전체 선택">
          <i class="fas fa-check-double mr-1"></i>전체선택
        </button>
      </div>

      <!-- 칸반 보드 -->
      <div class="flex gap-4 overflow-x-auto pb-4" style="min-height: 520px;">
        <!-- 미배정 컬럼 -->
        <div class="flex-shrink-0 w-80 bg-white rounded-xl border-2 border-dashed border-blue-200 flex flex-col kanban-column">
          <div class="px-4 py-3 bg-blue-50 rounded-t-xl border-b flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="fas fa-inbox text-blue-600"></i>
              <span class="font-bold text-blue-800">미배정</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-blue-500">${formatAmount(totalAmount)}</span>
              <span class="bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">${filteredDistributed.length}</span>
            </div>
          </div>
          <div id="kanban-unassigned" class="flex-1 p-2 space-y-2 overflow-y-auto max-h-[58vh] kanban-drop-zone"
               data-zone="unassigned"
               ondragover="kanbanDragOver(event)"
               ondragleave="kanbanDragLeave(event)"
               ondrop="handleKanbanDropUnassign(event)">
            ${filteredDistributed.map(o => kanbanCardV2(o, null, kanbanState.selected.has(o.order_id))).join('')}
            ${filteredDistributed.length === 0 ? '<p class="text-center text-gray-400 text-sm py-8"><i class="fas fa-inbox text-3xl mb-2 block text-gray-300"></i>배분된 주문이 없습니다</p>' : ''}
          </div>
        </div>

        <!-- 팀장별 컬럼 -->
        ${leaders.map(l => {
          const lOrders = sortOrders(leaderMap[l.user_id]?.orders || []);
          const leaderAmount = lOrders.reduce((s, o) => s + (o.base_amount || 0), 0);
          const assignedCnt = lOrders.filter(o => o.status === 'ASSIGNED').length;
          const inProgCnt = lOrders.filter(o => o.status === 'IN_PROGRESS').length;
          return `
          <div class="flex-shrink-0 w-80 bg-white rounded-xl border border-gray-200 flex flex-col kanban-column">
            <div class="px-4 py-3 bg-purple-50 rounded-t-xl border-b">
              <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center">
                    <i class="fas fa-user text-purple-600 text-sm"></i>
                  </div>
                  <div>
                    <span class="font-bold text-purple-800">${l.name}</span>
                    <div class="text-[10px] text-purple-500">${l.org_name || ''}</div>
                  </div>
                </div>
                <span class="bg-purple-200 text-purple-800 text-xs px-2 py-0.5 rounded-full font-bold">${lOrders.length}</span>
              </div>
              <div class="flex items-center gap-3 text-[10px] mt-1">
                <span class="text-purple-500"><i class="fas fa-user-check mr-0.5"></i>배정 ${assignedCnt}</span>
                <span class="text-orange-500"><i class="fas fa-wrench mr-0.5"></i>작업중 ${inProgCnt}</span>
                <span class="text-green-600 font-bold ml-auto">${formatAmount(leaderAmount)}</span>
              </div>
            </div>
            <div id="kanban-leader-${l.user_id}" class="flex-1 p-2 space-y-2 overflow-y-auto max-h-[58vh] kanban-drop-zone"
                 data-zone="leader"
                 data-leader-id="${l.user_id}"
                 ondragover="kanbanDragOver(event)"
                 ondragleave="kanbanDragLeave(event)"
                 ondrop="handleKanbanDrop(event, ${l.user_id})">
              ${lOrders.map(o => kanbanCardV2(o, l, kanbanState.selected.has(o.order_id))).join('')}
              ${lOrders.length === 0 ? `<p class="kanban-empty text-center text-gray-300 text-sm py-8"><i class="fas fa-arrow-down text-2xl mb-2 block"></i>드래그하여 배정</p>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- 하단 안내 -->
      <div class="mt-2 bg-gray-50 rounded-lg p-3 text-xs text-gray-500 flex items-center gap-4">
        <span><i class="fas fa-hand-pointer mr-1 text-purple-400"></i>클릭: 선택/해제</span>
        <span><i class="fas fa-arrows-alt mr-1 text-blue-400"></i>드래그: 개별 배정</span>
        <span><i class="fas fa-check-double mr-1 text-green-400"></i>다중선택 후 배치 배정 가능</span>
        <span><i class="fas fa-arrow-left mr-1 text-amber-400"></i>배정된 카드를 미배정으로 드래그: 배정 해제</span>
      </div>
    </div>

    <style>
      .kanban-drop-zone.drag-over {
        background: rgba(139, 92, 246, 0.05);
        border: 2px dashed #a78bfa;
        border-radius: 0.75rem;
      }
      .kanban-card {
        transition: all 0.2s ease;
      }
      .kanban-card:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      .kanban-card.selected {
        border-color: #7c3aed !important;
        box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3);
        background: #faf5ff !important;
      }
      .kanban-card.dragging {
        opacity: 0.5;
        transform: rotate(2deg);
      }
      .kanban-card .unassign-btn {
        opacity: 0;
        transition: opacity 0.2s;
      }
      .kanban-card:hover .unassign-btn {
        opacity: 1;
      }
      @keyframes kanbanDropSuccess {
        0% { transform: scale(1.05); box-shadow: 0 0 0 3px rgba(34,197,94,0.4); }
        100% { transform: scale(1); box-shadow: none; }
      }
      .kanban-drop-success {
        animation: kanbanDropSuccess 0.4s ease-out;
      }
    </style>`;

  // 검색 필드 포커스 유지
  if (kanbanState.filterText) {
    const inp = document.getElementById('kanban-search');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }
}

// ─── 칸반 카드 V2 ───
function kanbanCardV2(order, leader, isSelected) {
  const isAssigned = !!order.team_leader_id;
  const isInProgress = order.status === 'IN_PROGRESS';
  const canUnassign = isAssigned && !isInProgress;
  const canSelect = !isInProgress; // IN_PROGRESS는 선택 불가

  return `
    <div class="kanban-card bg-white border ${isSelected ? 'border-purple-400 selected' : 'border-gray-200'} rounded-lg p-3 shadow-sm cursor-pointer relative"
         draggable="${!isInProgress}"
         data-order-id="${order.order_id}"
         data-status="${order.status}"
         onclick="kanbanToggleSelect(${order.order_id}, event)"
         oncontextmenu="showKanbanCardContextMenu(event, ${JSON.stringify(order).replace(/"/g, '&quot;')})"
         ondragstart="kanbanDragStart(event, ${order.order_id})"
         ondragend="kanbanDragEnd(event)"
         data-preview="order" data-preview-id="${order.order_id}" data-preview-title="주문 #${order.order_id}">
      ${isSelected ? '<div class="absolute top-2 right-2 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center"><i class="fas fa-check text-white text-[10px]"></i></div>' : ''}
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-1.5">
          <span class="text-xs font-mono text-gray-400">#${order.order_id}</span>
          ${statusBadge(order.status)}
        </div>
        <div class="flex items-center gap-1">
          ${canUnassign ? `
            <button onclick="event.stopPropagation();kanbanUnassign(${order.order_id})" 
              class="unassign-btn w-6 h-6 flex items-center justify-center rounded-full bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 text-[10px]" title="배정 해제">
              <i class="fas fa-times"></i>
            </button>
          ` : ''}
          <button onclick="event.stopPropagation();showKanbanCardContextMenu(event, ${JSON.stringify(order).replace(/"/g, '&quot;')})" 
            class="unassign-btn w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 text-[10px]" data-tooltip="더보기">
            <i class="fas fa-ellipsis-vertical"></i>
          </button>
        </div>
      </div>
      <div class="font-medium text-sm mb-0.5">${order.customer_name || '이름없음'}</div>
      <div class="text-xs text-gray-500 truncate mb-1.5" title="${order.address_text || ''}">${order.address_text?.substring(0, 35) || '-'}</div>
      <div class="flex items-center justify-between">
        <span class="text-sm font-bold text-blue-600">${formatAmount(order.base_amount)}</span>
        <span class="text-[10px] text-gray-400">${order.requested_date || '-'}</span>
      </div>
      ${_renderStatusProgress(order.status)}
      ${!isAssigned ? `
        <div class="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
          <button onclick="event.stopPropagation();showAssignModal(${order.order_id})" class="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">
            <i class="fas fa-user-plus mr-1"></i>배정
          </button>
          <button onclick="event.stopPropagation();showOrderDetailDrawer(${order.order_id})" class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
            <i class="fas fa-eye mr-1"></i>상세
          </button>
        </div>
      ` : `
        <div class="mt-2 pt-2 border-t border-gray-100">
          <button onclick="event.stopPropagation();showOrderDetailDrawer(${order.order_id})" class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
            <i class="fas fa-eye mr-1"></i>상세
          </button>
        </div>
      `}
    </div>`;
}

// ─── 칸반 카드 컨텍스트 메뉴 ───
function showKanbanCardContextMenu(event, order) {
  event.preventDefault();
  event.stopPropagation();
  const o = typeof order === 'string' ? JSON.parse(order) : order;
  const isAssigned = !!o.team_leader_id;
  const isInProgress = o.status === 'IN_PROGRESS';

  const items = [
    { icon: 'fa-eye', label: '드로어에서 상세 보기', action: () => showOrderDetailDrawer(o.order_id) },
    { icon: 'fa-expand', label: '모달에서 상세 보기', action: () => showOrderDetail(o.order_id) },
    { divider: true },
  ];

  if (!isAssigned) {
    items.push({ icon: 'fa-user-plus', label: '팀장 배정', badge: '가능', badgeColor: 'bg-purple-100 text-purple-700', action: () => showAssignModal(o.order_id) });
  }
  if (isAssigned && !isInProgress) {
    items.push({ icon: 'fa-user-minus', label: '배정 해제', danger: true, action: () => kanbanUnassign(o.order_id) });
  }
  if (o.status === 'ASSIGNED') {
    items.push({ icon: 'fa-play', label: '작업 시작', action: () => startWork(o.order_id) });
  }
  if (['IN_PROGRESS', 'REGION_REJECTED', 'HQ_REJECTED'].includes(o.status)) {
    items.push({ icon: 'fa-file-pen', label: '보고서 제출', action: () => showReportModal(o.order_id) });
  }

  items.push(
    { divider: true },
    { icon: 'fa-clock-rotate-left', label: '상태 이력', action: () => showOrderHistoryDrawer(o.order_id) },
    { icon: 'fa-scroll', label: '감사 로그', action: () => showOrderAuditDrawer(o.order_id) }
  );

  // 선택 관련 메뉴
  const isSelected = kanbanState.selected.has(o.order_id);
  items.push(
    { divider: true },
    { icon: isSelected ? 'fa-square-minus' : 'fa-square-check', label: isSelected ? '선택 해제' : '선택', action: () => { if (isSelected) kanbanState.selected.delete(o.order_id); else kanbanState.selected.add(o.order_id); renderContent(); } }
  );

  showContextMenu(event.clientX, event.clientY, items, { title: `#${o.order_id} ${o.customer_name || ''}` });
}

// ─── 선택 토글 ───
function kanbanToggleSelect(orderId, event) {
  // 버튼 클릭은 무시
  if (event.target.closest('button')) return;
  
  if (kanbanState.selected.has(orderId)) {
    kanbanState.selected.delete(orderId);
  } else {
    kanbanState.selected.add(orderId);
  }
  renderContent();
}

function kanbanSelectAll() {
  // 미배정 주문 전체 선택
  const cards = document.querySelectorAll('#kanban-unassigned .kanban-card');
  cards.forEach(card => {
    const id = Number(card.dataset.orderId);
    if (id) kanbanState.selected.add(id);
  });
  renderContent();
}

function kanbanClearSelection() {
  kanbanState.selected.clear();
  renderContent();
}

// ─── 드래그 앤 드롭 ───
function kanbanDragStart(event, orderId) {
  kanbanState.draggedOrderId = orderId;
  event.dataTransfer.setData('text/plain', String(orderId));
  event.dataTransfer.effectAllowed = 'move';
  event.currentTarget.classList.add('dragging');
  
  // 선택된 것이 있으면 선택된 목록 전달, 아니면 단일 드래그
  if (kanbanState.selected.size > 0 && kanbanState.selected.has(orderId)) {
    event.dataTransfer.setData('application/json', JSON.stringify([...kanbanState.selected]));
  }
}

function kanbanDragEnd(event) {
  event.currentTarget.classList.remove('dragging');
  kanbanState.draggedOrderId = null;
}

function kanbanDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('drag-over');
}

function kanbanDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}

// 팀장 컬럼에 드롭 → 배정
async function handleKanbanDrop(event, leaderId) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  
  const jsonData = event.dataTransfer.getData('application/json');
  let orderIds = [];

  if (jsonData) {
    try { orderIds = JSON.parse(jsonData); } catch (e) {}
  }
  
  if (orderIds.length === 0) {
    const singleId = event.dataTransfer.getData('text/plain');
    if (singleId) orderIds = [Number(singleId)];
  }

  if (orderIds.length === 0) return;

  // 드래그된 카드가 이미 배정된 상태인지 확인
  const card = document.querySelector(`.kanban-card[data-order-id="${orderIds[0]}"]`);
  const isFromAssigned = card?.dataset.status === 'ASSIGNED';
  
  if (orderIds.length === 1 && !isFromAssigned) {
    // 단일 배정
    const res = await api('POST', `/orders/${orderIds[0]}/assign`, { team_leader_id: leaderId });
    if (res?.ok) {
      showToast('팀장 배정 완료', 'success');
      kanbanState.selected.delete(orderIds[0]);
      renderContent();
    } else {
      showToast(res?.error || '배정 실패', 'error');
    }
  } else {
    // 배치 배정 (미배정 주문만 필터링)
    const unassignedIds = orderIds.filter(id => {
      const c = document.querySelector(`.kanban-card[data-order-id="${id}"]`);
      return c && c.dataset.status === 'DISTRIBUTED';
    });
    
    if (unassignedIds.length === 0) {
      showToast('배정 가능한 주문이 없습니다', 'warning');
      return;
    }

    const res = await api('POST', '/orders/batch-assign', { order_ids: unassignedIds, team_leader_id: leaderId });
    if (res?.ok) {
      showToast(`배치 배정 완료: 성공 ${res.success}건${res.failed > 0 ? `, 실패 ${res.failed}건` : ''}`, res.failed > 0 ? 'warning' : 'success');
      unassignedIds.forEach(id => kanbanState.selected.delete(id));
      renderContent();
    } else {
      showToast(res?.error || '배치 배정 실패', 'error');
    }
  }
}

// 미배정 컬럼에 드롭 → 배정 해제
async function handleKanbanDropUnassign(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  
  const orderId = event.dataTransfer.getData('text/plain');
  if (!orderId) return;

  const card = document.querySelector(`.kanban-card[data-order-id="${orderId}"]`);
  if (!card || card.dataset.status !== 'ASSIGNED') {
    // 이미 미배정이거나 IN_PROGRESS는 해제 불가
    return;
  }

  await kanbanUnassign(Number(orderId));
}

// ─── 배정 해제 ───
async function kanbanUnassign(orderId) {
  showConfirmModal(
    '배정 해제',
    `주문 #${orderId}의 팀장 배정을 해제하시겠습니까?<br><span class="text-xs text-gray-400">미배정 풀로 되돌아갑니다.</span>`,
    async () => {
      const res = await api('POST', `/orders/${orderId}/unassign`);
      if (res?.ok) {
        showToast('배정 해제 완료', 'success');
        kanbanState.selected.delete(orderId);
        renderContent();
      } else {
        showToast(res?.error || '배정 해제 실패', 'error');
      }
    },
    '해제', 'bg-red-500'
  );
}

// ─── 배치 배정 모달 ───
async function showBatchAssignModal() {
  if (kanbanState.selected.size === 0) return;

  const orgId = currentUser.org_id;
  const leadersRes = await api('GET', `/auth/team-leaders?org_id=${orgId}`);
  const leaders = leadersRes?.team_leaders || [];

  // 선택된 주문 중 미배정 건만
  const selectedIds = [...kanbanState.selected];
  const unassignedIds = selectedIds.filter(id => {
    const card = document.querySelector(`.kanban-card[data-order-id="${id}"]`);
    return card && card.dataset.status === 'DISTRIBUTED';
  });

  if (unassignedIds.length === 0) {
    showToast('배정 가능한(미배정) 주문이 선택되지 않았습니다.', 'warning');
    return;
  }

  const content = `
    <div class="space-y-4">
      <div class="bg-purple-50 rounded-lg p-3 border border-purple-200">
        <div class="flex items-center gap-2 text-purple-800 text-sm font-medium">
          <i class="fas fa-check-square"></i>
          <span>선택된 미배정 주문 <strong>${unassignedIds.length}</strong>건을 배정합니다</span>
        </div>
        <div class="mt-2 flex flex-wrap gap-1">
          ${unassignedIds.slice(0, 10).map(id => `<span class="bg-purple-200 text-purple-800 text-xs px-2 py-0.5 rounded">#${id}</span>`).join('')}
          ${unassignedIds.length > 10 ? `<span class="text-xs text-purple-500">... 외 ${unassignedIds.length - 10}건</span>` : ''}
        </div>
      </div>
      <p class="text-sm text-gray-600">배정할 팀장을 선택하세요:</p>
      <div class="space-y-2 max-h-60 overflow-y-auto">
        ${leaders.map(l => `
          <button onclick="executeBatchAssign([${unassignedIds.join(',')}], ${l.user_id})" 
            class="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg hover:bg-purple-50 hover:border-purple-300 border border-gray-200 transition">
            <div class="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <i class="fas fa-user text-purple-600"></i>
            </div>
            <div class="text-left flex-1">
              <div class="font-medium">${l.name}</div>
              <div class="text-xs text-gray-500">${l.org_name || ''} · ${formatPhone(l.phone)}</div>
            </div>
            <i class="fas fa-arrow-right text-gray-400"></i>
          </button>
        `).join('')}
      </div>
    </div>`;
  showModal(`배치 배정 — ${unassignedIds.length}건`, content);
}

async function executeBatchAssign(orderIds, leaderId) {
  closeModal();
  showToast('배치 배정 처리 중...', 'info');
  
  const res = await api('POST', '/orders/batch-assign', { order_ids: orderIds, team_leader_id: leaderId });
  if (res?.ok) {
    showToast(`배치 배정 완료: 성공 ${res.success}건${res.failed > 0 ? `, 실패 ${res.failed}건` : ''}`, res.failed > 0 ? 'warning' : 'success');
    kanbanState.selected.clear();
    renderContent();
  } else {
    showToast(res?.error || '배치 배정 실패', 'error');
  }
}

// ─── 개별 배정 모달 (기존 호환) ───
async function showAssignModal(orderId) {
  const orgId = currentUser.org_id;
  const leadersRes = await api('GET', `/auth/team-leaders?org_id=${orgId}`);
  const leaders = leadersRes?.team_leaders || [];

  const content = `
    <div class="space-y-4">
      <p class="text-sm text-gray-600">주문 <strong>#${orderId}</strong>을 배정할 팀장을 선택하세요.</p>
      <div class="space-y-2">
        ${leaders.map(l => `
          <button onclick="assignToLeader(${orderId}, ${l.user_id})" 
            class="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg hover:bg-purple-50 hover:border-purple-300 border border-gray-200 transition">
            <div class="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <i class="fas fa-user text-purple-600"></i>
            </div>
            <div class="text-left flex-1">
              <div class="font-medium">${l.name}</div>
              <div class="text-xs text-gray-500">${l.org_name || ''} · ${formatPhone(l.phone)}</div>
            </div>
            <i class="fas fa-arrow-right text-gray-400"></i>
          </button>
        `).join('')}
      </div>
    </div>`;
  showModal(`팀장 배정 — 주문 #${orderId}`, content);
}

async function assignToLeader(orderId, leaderId) {
  const res = await api('POST', `/orders/${orderId}/assign`, { team_leader_id: leaderId });
  if (res?.ok) {
    showToast('팀장 배정 완료', 'success');
    closeModal();
    kanbanState.selected.delete(orderId);
    renderContent();
  } else {
    showToast(res?.error || '배정 실패', 'error');
  }
}
