// ============================================================
// 다하다 OMS - 칸반보드 (파트장 → 팀장 배정) 페이지
// ============================================================

async function renderKanban(el) {
  const user = currentUser;
  const orgId = user.org_id;

  // 내 법인에 배분된 DISTRIBUTED 주문 + 이미 배정된 ASSIGNED/IN_PROGRESS 주문
  const [distRes, assignedRes, leadersRes] = await Promise.all([
    api('GET', `/orders?status=DISTRIBUTED&limit=100`),
    api('GET', `/orders?status=ASSIGNED&limit=100`),
    api('GET', `/auth/team-leaders?org_id=${orgId}`),
  ]);

  const distributed = distRes?.orders || [];
  const assigned = assignedRes?.orders || [];
  const leaders = leadersRes?.team_leaders || [];

  // 팀장별 배정 그룹화
  const leaderMap = {};
  leaders.forEach(l => { leaderMap[l.user_id] = { ...l, orders: [] }; });
  assigned.forEach(o => {
    if (o.team_leader_id && leaderMap[o.team_leader_id]) {
      leaderMap[o.team_leader_id].orders.push(o);
    }
  });

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-columns mr-2 text-purple-600"></i>칸반보드 — 팀장 배정</h2>
        <div class="flex gap-2 items-center">
          <span class="text-sm text-gray-500"><i class="fas fa-info-circle mr-1"></i>카드를 드래그하거나 버튼으로 배정</span>
          <button onclick="renderContent()" class="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"><i class="fas fa-refresh mr-1"></i>새로고침</button>
        </div>
      </div>

      <div class="flex gap-4 overflow-x-auto pb-4" style="min-height: 500px;">
        <!-- 미배정 컬럼 -->
        <div class="flex-shrink-0 w-72 bg-white rounded-xl border-2 border-dashed border-blue-200 flex flex-col">
          <div class="px-4 py-3 bg-blue-50 rounded-t-xl border-b flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="fas fa-inbox text-blue-600"></i>
              <span class="font-bold text-blue-800">미배정</span>
            </div>
            <span class="bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">${distributed.length}</span>
          </div>
          <div id="kanban-unassigned" class="flex-1 p-3 space-y-2 overflow-y-auto max-h-[60vh]"
               ondragover="event.preventDefault();this.classList.add('drag-over')"
               ondragleave="this.classList.remove('drag-over')"
               ondrop="event.preventDefault();this.classList.remove('drag-over')">
            ${distributed.map(o => kanbanCard(o, null)).join('')}
            ${distributed.length === 0 ? '<p class="text-center text-gray-400 text-sm py-8">배분된 주문이 없습니다</p>' : ''}
          </div>
        </div>

        <!-- 팀장별 컬럼 -->
        ${leaders.map(l => {
          const lOrders = leaderMap[l.user_id]?.orders || [];
          return `
          <div class="flex-shrink-0 w-72 bg-white rounded-xl border border-gray-200 flex flex-col">
            <div class="px-4 py-3 bg-purple-50 rounded-t-xl border-b flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center">
                  <i class="fas fa-user text-purple-600 text-sm"></i>
                </div>
                <div>
                  <span class="font-bold text-purple-800">${l.name}</span>
                  <div class="text-[10px] text-purple-500">${l.org_name || ''}</div>
                </div>
              </div>
              <span class="bg-purple-200 text-purple-800 text-xs px-2 py-1 rounded-full font-bold">${lOrders.length}</span>
            </div>
            <div id="kanban-leader-${l.user_id}" class="flex-1 p-3 space-y-2 overflow-y-auto max-h-[60vh]"
                 data-leader-id="${l.user_id}"
                 ondragover="event.preventDefault();this.classList.add('drag-over')"
                 ondragleave="this.classList.remove('drag-over')"
                 ondrop="handleKanbanDrop(event, ${l.user_id})">
              ${lOrders.map(o => kanbanCard(o, l)).join('')}
              ${lOrders.length === 0 ? `<p class="kanban-empty text-center text-gray-300 text-sm py-8">여기에 드롭하여 배정</p>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function kanbanCard(order, leader) {
  const isAssigned = !!order.team_leader_id;
  return `
    <div class="kanban-card bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md"
         draggable="true"
         data-order-id="${order.order_id}"
         ondragstart="event.dataTransfer.setData('text/plain', '${order.order_id}');this.style.opacity='0.5'"
         ondragend="this.style.opacity='1'">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-mono text-gray-400">#${order.order_id}</span>
        ${statusBadge(order.status)}
      </div>
      <div class="font-medium text-sm mb-1">${order.customer_name || '이름없음'}</div>
      <div class="text-xs text-gray-500 truncate mb-2" title="${order.address_text || ''}">${order.address_text?.substring(0, 30) || '-'}</div>
      <div class="flex items-center justify-between">
        <span class="text-sm font-bold text-blue-600">${formatAmount(order.base_amount)}</span>
        ${!isAssigned ? `
          <button onclick="showAssignModal(${order.order_id})" class="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">
            <i class="fas fa-user-plus mr-1"></i>배정
          </button>
        ` : ''}
      </div>
    </div>`;
}

async function handleKanbanDrop(event, leaderId) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  const orderId = event.dataTransfer.getData('text/plain');
  if (!orderId) return;
  
  const res = await api('POST', `/orders/${orderId}/assign`, { team_leader_id: leaderId });
  if (res?.ok) {
    showToast('팀장 배정 완료', 'success');
    renderContent();
  } else {
    showToast(res?.error || '배정 실패', 'error');
  }
}

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
    renderContent();
  } else {
    showToast(res?.error || '배정 실패', 'error');
  }
}
