// ============================================================
// 와이비 OMS — Interaction Design System v6.0
// 팝오버, 컨텍스트메뉴, 드로어, 툴팁, 상태플로우,
// 호버프리뷰, 배치액션바, 키보드네비게이션
// ============================================================

// ─── 전역 인터랙션 상태 ───
const IX = {
  activePopover: null,
  activeContextMenu: null,
  activeDrawer: null,
  activeTooltip: null,
  batchBar: null,
};

// ────────────────────────────────────────
//  1. POPOVER — 요소 근처 떠오르는 풍선
// ────────────────────────────────────────
function showPopover(anchorEl, content, options = {}) {
  closePopover();
  const pop = document.createElement('div');
  pop.id = 'ix-popover';
  pop.className = `ix-popover fixed z-[70] bg-white rounded-xl shadow-2xl border border-gray-200 
    transition-all duration-200 opacity-0 scale-95 ${options.className || ''}`;
  pop.style.maxWidth = options.maxWidth || '380px';
  pop.style.minWidth = options.minWidth || '260px';

  // 헤더 + 본문
  const header = options.title ? `
    <div class="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50 rounded-t-xl">
      <span class="text-sm font-semibold text-gray-700">${options.title}</span>
      <button onclick="closePopover()" class="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition">
        <i class="fas fa-times text-xs"></i>
      </button>
    </div>` : '';
  pop.innerHTML = `${header}<div class="ix-popover-body p-4">${content}</div>`;

  document.body.appendChild(pop);

  // 위치 계산
  requestAnimationFrame(() => {
    positionPopover(pop, anchorEl, options.placement || 'bottom');
    pop.classList.remove('opacity-0', 'scale-95');
    pop.classList.add('opacity-100', 'scale-100');
  });

  IX.activePopover = pop;

  // 외부 클릭 닫기
  setTimeout(() => {
    document.addEventListener('click', _popoverOutsideClick);
  }, 10);
}

function positionPopover(pop, anchor, placement) {
  const rect = anchor.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  const gap = 8;
  let top, left;

  switch (placement) {
    case 'top':
      top = rect.top - popRect.height - gap;
      left = rect.left + (rect.width - popRect.width) / 2;
      break;
    case 'right':
      top = rect.top + (rect.height - popRect.height) / 2;
      left = rect.right + gap;
      break;
    case 'left':
      top = rect.top + (rect.height - popRect.height) / 2;
      left = rect.left - popRect.width - gap;
      break;
    default: // bottom
      top = rect.bottom + gap;
      left = rect.left + (rect.width - popRect.width) / 2;
  }

  // 화면 경계 보정
  top = Math.max(8, Math.min(top, window.innerHeight - popRect.height - 8));
  left = Math.max(8, Math.min(left, window.innerWidth - popRect.width - 8));

  pop.style.top = top + 'px';
  pop.style.left = left + 'px';
}

function closePopover() {
  document.removeEventListener('click', _popoverOutsideClick);
  const pop = IX.activePopover;
  IX.activePopover = null;
  if (pop) {
    pop.classList.add('opacity-0', 'scale-95');
    setTimeout(() => pop.remove(), 150);
  }
  // 잔여 팝오버 DOM도 정리
  document.querySelectorAll('#ix-popover').forEach(el => {
    if (el !== pop) el.remove();
  });
}

function _popoverOutsideClick(e) {
  if (IX.activePopover && !IX.activePopover.contains(e.target)) {
    closePopover();
  }
}

// ────────────────────────────────────────
//  2. CONTEXT MENU — 우클릭/롱프레스 메뉴
// ────────────────────────────────────────
function showContextMenu(x, y, items, options = {}) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.id = 'ix-context-menu';
  menu.className = 'ix-context-menu fixed z-[80] bg-white rounded-xl shadow-2xl border border-gray-200 py-1 min-w-[180px] opacity-0 scale-95 transition-all duration-150';

  if (options.title) {
    menu.innerHTML += `<div class="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b">${options.title}</div>`;
  }

  items.forEach(item => {
    if (item.divider) {
      menu.innerHTML += '<div class="border-t my-1"></div>';
      return;
    }
    const disabled = item.disabled ? 'opacity-40 pointer-events-none' : 'hover:bg-blue-50';
    const danger = item.danger ? 'text-red-600 hover:bg-red-50' : '';
    const el = document.createElement('button');
    el.className = `w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 ${disabled} ${danger} transition`;
    el.innerHTML = `
      ${item.icon ? `<i class="fas ${item.icon} w-4 text-center ${item.danger ? 'text-red-500' : 'text-gray-400'}"></i>` : '<span class="w-4"></span>'}
      <span class="flex-1 text-left">${item.label}</span>
      ${item.shortcut ? `<kbd class="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">${item.shortcut}</kbd>` : ''}
      ${item.badge ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full ${item.badgeColor || 'bg-gray-100 text-gray-600'}">${item.badge}</span>` : ''}
    `;
    if (!item.disabled) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        closeContextMenu();
        item.action?.();
      });
    }
    menu.appendChild(el);
  });

  document.body.appendChild(menu);

  // 위치 보정
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
    menu.style.top = Math.max(8, y) + 'px';
    menu.style.left = Math.max(8, x) + 'px';
    menu.classList.remove('opacity-0', 'scale-95');
    menu.classList.add('opacity-100', 'scale-100');
  });

  IX.activeContextMenu = menu;
  setTimeout(() => document.addEventListener('click', closeContextMenu), 10);
  document.addEventListener('contextmenu', closeContextMenu, { once: true });
}

function closeContextMenu() {
  document.removeEventListener('click', closeContextMenu);
  const menu = IX.activeContextMenu;
  IX.activeContextMenu = null;
  if (menu) menu.remove();
  // 잔여 컨텍스트 메뉴 DOM도 정리
  document.querySelectorAll('#ix-context-menu').forEach(el => el.remove());
}

// ────────────────────────────────────────
//  3. DRAWER — 옆에서 슬라이드되는 패널
// ────────────────────────────────────────
function showDrawer(content, options = {}) {
  // 기존 드로어 즉시 제거 (애니메이션 없이)
  _forceCloseDrawer();
  const side = options.side || 'right';
  const width = options.width || '420px';
  const drawer = document.createElement('div');
  drawer.id = 'ix-drawer';

  drawer.innerHTML = `
    <div class="ix-drawer-overlay fixed inset-0 z-[55] bg-black/30 transition-opacity duration-300 opacity-0" onclick="closeDrawer()"></div>
    <div class="ix-drawer-panel fixed z-[56] top-0 ${side === 'right' ? 'right-0' : 'left-0'} h-full bg-white shadow-2xl flex flex-col transition-transform duration-300 ${side === 'right' ? 'translate-x-full' : '-translate-x-full'}" style="width: ${width}; max-width: 90vw;">
      <div class="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
        <div>
          <h3 class="text-lg font-bold text-gray-800">${options.title || ''}</h3>
          ${options.subtitle ? `<p class="text-xs text-gray-500 mt-0.5">${options.subtitle}</p>` : ''}
        </div>
        <button onclick="closeDrawer()" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ix-drawer-body flex-1 overflow-y-auto p-5">${content}</div>
      ${options.footer ? `<div class="px-5 py-4 border-t bg-gray-50 flex justify-end gap-3">${options.footer}</div>` : ''}
    </div>`;

  document.body.appendChild(drawer);
  IX.activeDrawer = drawer;

  requestAnimationFrame(() => {
    drawer.querySelector('.ix-drawer-overlay').classList.remove('opacity-0');
    drawer.querySelector('.ix-drawer-panel').classList.remove('translate-x-full', '-translate-x-full');
  });

  // ESC 키로 닫기
  document.addEventListener('keydown', _drawerEscHandler);
}

function closeDrawer() {
  document.removeEventListener('keydown', _drawerEscHandler);
  const drawer = IX.activeDrawer;
  IX.activeDrawer = null;
  if (!drawer) {
    // activeDrawer가 없어도 잔여 DOM 정리
    document.querySelectorAll('#ix-drawer').forEach(el => el.remove());
    return;
  }
  const panel = drawer.querySelector('.ix-drawer-panel');
  const overlay = drawer.querySelector('.ix-drawer-overlay');
  const isRight = panel?.classList.contains('right-0') || !panel?.classList.contains('left-0');

  overlay?.classList.add('opacity-0');
  panel?.classList.add(isRight ? 'translate-x-full' : '-translate-x-full');

  // 애니메이션 후 제거, 참조를 로컬로 고정
  const drawerRef = drawer;
  setTimeout(() => drawerRef.remove(), 300);
  // 다른 잔여 드로어도 정리
  document.querySelectorAll('#ix-drawer').forEach(el => {
    if (el !== drawerRef) el.remove();
  });
}

// 강제 즉시 닫기 (새 드로어 열기 전 사용)
function _forceCloseDrawer() {
  document.removeEventListener('keydown', _drawerEscHandler);
  IX.activeDrawer = null;
  document.querySelectorAll('#ix-drawer').forEach(el => el.remove());
}

function _drawerEscHandler(e) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    closeDrawer();
  }
}

// ────────────────────────────────────────
//  4. TOOLTIP — 경량 호버 힌트
// ────────────────────────────────────────
function showTooltip(anchorEl, text, placement = 'top') {
  closeTooltip();
  const tip = document.createElement('div');
  tip.id = 'ix-tooltip';
  tip.className = 'ix-tooltip fixed z-[90] bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg pointer-events-none opacity-0 transition-opacity duration-150 max-w-[280px]';
  tip.textContent = text;
  document.body.appendChild(tip);

  requestAnimationFrame(() => {
    positionPopover(tip, anchorEl, placement);
    tip.classList.remove('opacity-0');
  });

  IX.activeTooltip = tip;
}

function closeTooltip() {
  IX.activeTooltip?.remove();
  IX.activeTooltip = null;
}

// ─── 자동 툴팁 바인딩 (data-tooltip) ───
function initTooltips() {
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tooltip]');
    if (el) showTooltip(el, el.dataset.tooltip, el.dataset.tooltipPlacement || 'top');
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('[data-tooltip]')) closeTooltip();
  });
}

// ────────────────────────────────────────
//  5. HOVER PREVIEW — 마우스 올리면 프리뷰 팝업
// ────────────────────────────────────────
let _hoverTimer = null;
let _hoverPopover = null;

function initHoverPreview() {
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-preview]');
    if (!el) return;
    clearTimeout(_hoverTimer);
    _hoverTimer = setTimeout(async () => {
      const type = el.dataset.preview;
      const id = el.dataset.previewId;
      if (!type || !id) return;

      const content = await getPreviewContent(type, id);
      if (content) {
        _hoverPopover = true;
        showPopover(el, content, {
          title: el.dataset.previewTitle || `${type} 미리보기`,
          placement: el.dataset.previewPlacement || 'right',
          maxWidth: '400px'
        });
      }
    }, 350); // 350ms 딜레이
  });

  document.addEventListener('mouseout', (e) => {
    const el = e.target.closest('[data-preview]');
    if (el) {
      clearTimeout(_hoverTimer);
      // 팝오버 위에 마우스가 있으면 닫지 않음
      setTimeout(() => {
        if (IX.activePopover && !IX.activePopover.matches(':hover')) {
          closePopover();
          _hoverPopover = null;
        }
      }, 200);
    }
  });
}

async function getPreviewContent(type, id) {
  try {
    switch (type) {
      case 'order': {
        const res = await api('GET', `/orders/${id}`);
        if (!res?.order) return null;
        const o = res.order;
        return `
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="font-bold text-base">${o.customer_name || '-'}</span>
              ${statusBadge(o.status)}
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div><span class="text-gray-400">주문번호</span><div class="font-mono">#${o.order_id}</div></div>
              <div><span class="text-gray-400">금액</span><div class="font-bold text-blue-600">${formatAmount(o.base_amount)}</div></div>
              <div><span class="text-gray-400">지역총판</span><div>${o.region_name || '-'}</div></div>
              <div><span class="text-gray-400">팀장</span><div>${o.team_leader_name || '-'}</div></div>
            </div>
            <div class="text-xs text-gray-500"><i class="fas fa-map-marker-alt mr-1"></i>${o.address_text || '-'}</div>
            ${_renderStatusProgress(o.status)}
            <div class="pt-2 border-t flex gap-2">
              <button onclick="closePopover();showOrderDetail(${o.order_id})" class="flex-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition">
                <i class="fas fa-expand mr-1"></i>상세 열기
              </button>
            </div>
          </div>`;
      }
      case 'user': {
        const res = await api('GET', `/hr/users/${id}`);
        if (!res?.user) return null;
        const u = res.user;
        return `
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                <i class="fas fa-user text-white"></i>
              </div>
              <div>
                <div class="font-bold">${u.name}</div>
                <div class="text-xs text-gray-500">${u.org_name || '-'} · ${(u.roles || []).join(', ')}</div>
              </div>
              <span class="ml-auto status-badge ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${u.status}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div><span class="text-gray-400">연락처</span><div>${formatPhone(u.phone)}</div></div>
              <div><span class="text-gray-400">로그인ID</span><div class="font-mono">${u.login_id}</div></div>
            </div>
            ${res.activity ? `
            <div class="bg-gray-50 rounded-lg p-2">
              <div class="flex gap-3 text-xs">
                <span>배정 <strong class="text-blue-600">${res.activity.total_assigned || 0}</strong></span>
                <span>승인 <strong class="text-green-600">${res.activity.total_approved || 0}</strong></span>
                <span>반려 <strong class="text-red-600">${res.activity.total_rejected || 0}</strong></span>
              </div>
            </div>` : ''}
          </div>`;
      }
      case 'region': {
        const res = await api('GET', `/stats/regions/daily?region_org_id=${id}`);
        const stats = res?.stats?.slice(0, 5) || [];
        return `
          <div class="space-y-2">
            <div class="text-xs space-y-1">
              ${stats.map(s => `
                <div class="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                  <span class="text-gray-500">${s.date}</span>
                  <div class="flex gap-2">
                    <span>인입 <strong>${s.intake_count || 0}</strong></span>
                    <span>승인 <strong class="text-green-600">${s.hq_approved_count || 0}</strong></span>
                    <span>정산 <strong class="text-emerald-600">${s.settlement_confirmed_count || 0}</strong></span>
                  </div>
                </div>
              `).join('')}
              ${stats.length === 0 ? '<div class="text-gray-400 text-center py-2">데이터 없음</div>' : ''}
            </div>
          </div>`;
      }
      default:
        return null;
    }
  } catch (e) {
    return null;
  }
}

// ────────────────────────────────────────
//  6. STATUS FLOW — 상태 진행 바 시각화
// ────────────────────────────────────────
function _renderStatusProgress(currentStatus) {
  const flow = [
    { key: 'RECEIVED', short: '수신' },
    { key: 'DISTRIBUTED', short: '배분' },
    { key: 'ASSIGNED', short: '준비' },
    { key: 'READY_DONE', short: '확정' },
    { key: 'IN_PROGRESS', short: '수행' },
    { key: 'SUBMITTED', short: '전송' },
    { key: 'DONE', short: '완료' },
    { key: 'REGION_APPROVED', short: '지역승인' },
    { key: 'HQ_APPROVED', short: 'HQ승인' },
    { key: 'SETTLEMENT_CONFIRMED', short: '정산' },
  ];

  const currentStep = OMS.STATUS[currentStatus]?.step || 0;
  const isRejected = currentStatus.includes('REJECTED');

  return `
    <div class="ix-status-flow flex items-center gap-0.5 mt-2">
      ${flow.map((s, i) => {
        const step = OMS.STATUS[s.key]?.step || 0;
        const done = currentStep >= step;
        const active = currentStatus === s.key;
        const rejected = isRejected && i >= flow.length - 2;
        return `
          <div class="flex items-center ${i > 0 ? 'flex-1' : ''}">
            ${i > 0 ? `<div class="flex-1 h-0.5 ${done ? 'bg-blue-400' : 'bg-gray-200'} ${rejected ? 'bg-red-300' : ''}"></div>` : ''}
            <div class="w-2.5 h-2.5 rounded-full flex-shrink-0 ${active ? 'bg-blue-500 ring-2 ring-blue-200' : done ? 'bg-blue-400' : 'bg-gray-200'} ${rejected ? 'bg-red-400 ring-red-200' : ''}" 
                 data-tooltip="${s.short}" data-tooltip-placement="top"></div>
          </div>`;
      }).join('')}
    </div>
    <div class="flex justify-between mt-1 text-[9px] text-gray-400">
      <span>${flow[0].short}</span>
      <span>${flow[flow.length - 1].short}</span>
    </div>`;
}

// 큰 버전 — 모달 등에서 사용
function renderStatusFlowLarge(currentStatus, history = []) {
  const flow = [
    { key: 'RECEIVED', label: '수신', icon: 'fa-inbox' },
    { key: 'VALIDATED', label: '유효성통과', icon: 'fa-check-circle' },
    { key: 'DISTRIBUTED', label: '배분완료', icon: 'fa-share-nodes' },
    { key: 'ASSIGNED', label: '준비(배정)', icon: 'fa-user-check' },
    { key: 'READY_DONE', label: '준비완료', icon: 'fa-phone-volume' },
    { key: 'IN_PROGRESS', label: '수행중', icon: 'fa-wrench' },
    { key: 'SUBMITTED', label: '완료전송', icon: 'fa-file-lines' },
    { key: 'DONE', label: '최종완료', icon: 'fa-check-double' },
    { key: 'REGION_APPROVED', label: '지역승인', icon: 'fa-thumbs-up' },
    { key: 'HQ_APPROVED', label: 'HQ승인', icon: 'fa-circle-check' },
    { key: 'SETTLEMENT_CONFIRMED', label: '정산확정', icon: 'fa-coins' },
  ];

  const currentStep = OMS.STATUS[currentStatus]?.step || 0;
  const isRejected = currentStatus.includes('REJECTED');
  const rejectedLabel = currentStatus === 'REGION_REJECTED' ? '지역반려' : currentStatus === 'HQ_REJECTED' ? 'HQ반려' : '';

  // 이력에서 타임스탬프 추출
  const historyMap = {};
  (history || []).forEach(h => {
    historyMap[h.to_status] = h.created_at;
  });

  return `
    <div class="ix-status-flow-large bg-gray-50 rounded-xl p-4">
      <div class="flex items-start justify-between relative">
        ${flow.map((s, i) => {
          const step = OMS.STATUS[s.key]?.step || 0;
          const done = currentStep >= step;
          const active = currentStatus === s.key;
          const ts = historyMap[s.key];
          return `
            <div class="flex flex-col items-center ${i > 0 ? 'flex-1' : ''} relative">
              ${i > 0 ? `<div class="absolute top-3.5 right-1/2 left-0 h-0.5 ${done ? 'bg-blue-400' : 'bg-gray-200'}"></div>` : ''}
              <div class="relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all
                ${active ? 'bg-blue-600 text-white ring-3 ring-blue-200 shadow-lg' : done ? 'bg-blue-400 text-white' : 'bg-gray-200 text-gray-500'}">
                <i class="fas ${s.icon}"></i>
              </div>
              <div class="mt-1.5 text-[9px] text-center ${active ? 'text-blue-700 font-bold' : done ? 'text-blue-500' : 'text-gray-400'}">${s.label}</div>
              ${ts ? `<div class="text-[8px] text-gray-400 mt-0.5">${formatDate(ts).split(' ')[0]}</div>` : ''}
            </div>`;
        }).join('')}
      </div>
      ${isRejected ? `
        <div class="mt-3 pt-3 border-t border-red-200 flex items-center gap-2 text-sm text-red-600">
          <i class="fas fa-exclamation-triangle"></i>
          <span class="font-semibold">${rejectedLabel}</span>
          <span class="text-xs text-red-400">${historyMap[currentStatus] ? formatDate(historyMap[currentStatus]) : ''}</span>
        </div>` : ''}
    </div>`;
}

// ────────────────────────────────────────
//  7. BATCH ACTION BAR — 하단 배치 액션 바
// ────────────────────────────────────────
function showBatchActionBar(items, actions) {
  closeBatchActionBar();
  const bar = document.createElement('div');
  bar.id = 'ix-batch-bar';
  bar.className = 'fixed bottom-0 left-0 right-0 z-[45] bg-white border-t-2 border-blue-500 shadow-2xl px-6 py-3 flex items-center gap-4 translate-y-full transition-transform duration-300';

  bar.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
        <i class="fas fa-check-double text-blue-600"></i>
      </div>
      <div>
        <div class="text-sm font-bold text-gray-800">${items.length}건 선택됨</div>
        <div class="text-[10px] text-gray-400">일괄 작업을 선택하세요</div>
      </div>
    </div>
    <div class="flex-1"></div>
    <div class="flex items-center gap-2">
      ${actions.map(a => `
        <button onclick="${a.onclick}" class="px-4 py-2 ${a.className || 'bg-gray-100 text-gray-700'} rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center gap-1.5">
          ${a.icon ? `<i class="fas ${a.icon}"></i>` : ''}
          <span>${a.label}</span>
        </button>
      `).join('')}
      <button onclick="closeBatchActionBar();${items.clearFn || ''}" class="px-3 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm hover:bg-gray-200 transition">
        <i class="fas fa-times mr-1"></i>선택 해제
      </button>
    </div>`;

  document.body.appendChild(bar);
  IX.batchBar = bar;
  requestAnimationFrame(() => bar.classList.remove('translate-y-full'));
}

function closeBatchActionBar() {
  if (IX.batchBar) {
    IX.batchBar.classList.add('translate-y-full');
    setTimeout(() => IX.batchBar?.remove(), 300);
    IX.batchBar = null;
  }
}

// ────────────────────────────────────────
//  8. 주문행 컨텍스트 메뉴 (우클릭/롱프레스)
// ────────────────────────────────────────
function showOrderContextMenu(e, order) {
  e.preventDefault();
  const statusActions = getStatusActions(order);

  // 수정/삭제 가능 여부 판단
  const editableStatuses = ['RECEIVED', 'VALIDATED', 'DISTRIBUTION_PENDING', 'DISTRIBUTED'];
  const canEdit = editableStatuses.includes(order.status);
  const canDelete = order.status === 'RECEIVED';

  const items = [
    { icon: 'fa-eye', label: '상세 보기', shortcut: 'Enter', action: () => showOrderDetail(order.order_id) },
    { divider: true },
    ...statusActions,
    { divider: true },
    ...(canEdit ? [{ icon: 'fa-pen-to-square', label: '주문 수정', badge: '수정', badgeColor: 'bg-blue-100 text-blue-700', action: () => showEditOrderModal(order.order_id) }] : []),
    ...(canDelete ? [{ icon: 'fa-trash-can', label: '주문 삭제', danger: true, action: () => deleteOrder(order.order_id, order.customer_name) }] : []),
    ...((canEdit || canDelete) ? [{ divider: true }] : []),
    { icon: 'fa-clock-rotate-left', label: '상태 이력 보기', action: () => showOrderHistoryDrawer(order.order_id) },
    { icon: 'fa-scroll', label: '감사 로그 보기', action: () => showOrderAuditDrawer(order.order_id) },
  ];

  showContextMenu(e.clientX, e.clientY, items, { title: `주문 #${order.order_id}` });
}

function getStatusActions(order) {
  const actions = [];
  const s = order.status;

  if (s === 'DISTRIBUTED') {
    actions.push({
      icon: 'fa-user-plus', label: '팀장 배정', badge: '가능',
      badgeColor: 'bg-purple-100 text-purple-700',
      action: () => showAssignModal(order.order_id)
    });
  }
  if (s === 'ASSIGNED') {
    actions.push({
      icon: 'fa-play', label: '작업 시작',
      action: () => startWork(order.order_id)
    });
    actions.push({
      icon: 'fa-user-minus', label: '배정 해제', danger: true,
      action: () => kanbanUnassign(order.order_id)
    });
  }
  if (s === 'SUBMITTED') {
    actions.push(
      { icon: 'fa-check', label: '승인', action: () => showReviewModal(order.order_id, 'region', 'APPROVE') },
      { icon: 'fa-times', label: '반려', danger: true, action: () => showReviewModal(order.order_id, 'region', 'REJECT') }
    );
  }
  if (s === 'REGION_APPROVED') {
    actions.push(
      { icon: 'fa-check-double', label: 'HQ 최종 승인', action: () => showReviewModal(order.order_id, 'hq', 'APPROVE') },
      { icon: 'fa-times', label: 'HQ 반려', danger: true, action: () => showReviewModal(order.order_id, 'hq', 'REJECT') }
    );
  }
  if (['IN_PROGRESS', 'REGION_REJECTED', 'HQ_REJECTED'].includes(s)) {
    actions.push({
      icon: 'fa-file-pen', label: '보고서 제출',
      action: () => showReportModal(order.order_id)
    });
  }

  return actions;
}

// ────────────────────────────────────────
//  9. DRAWER: 주문 상태 이력 / 감사 로그
// ────────────────────────────────────────
async function showOrderHistoryDrawer(orderId) {
  const res = await api('GET', `/orders/${orderId}`);
  if (!res?.order) return;
  const o = res.order;
  const history = res.history || [];

  const content = `
    <div class="space-y-4">
      ${renderStatusFlowLarge(o.status, history)}
      <h4 class="font-semibold text-sm mt-4"><i class="fas fa-clock-rotate-left mr-1 text-blue-500"></i>전체 이력 (${history.length}건)</h4>
      <div class="relative pl-6">
        <div class="absolute left-2.5 top-0 bottom-0 w-px bg-gray-200"></div>
        ${history.map((h, i) => `
          <div class="relative pb-4 ${i === 0 ? '' : ''}">
            <div class="absolute left-[-14px] w-5 h-5 rounded-full flex items-center justify-center ${i === 0 ? 'bg-blue-500' : 'bg-gray-300'} text-white text-[8px]">
              <i class="fas ${OMS.STATUS[h.to_status]?.icon || 'fa-circle'}"></i>
            </div>
            <div class="bg-white rounded-lg border p-3 ml-2">
              <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-2">
                  ${statusBadge(h.from_status || 'NEW')}
                  <i class="fas fa-arrow-right text-gray-300 text-xs"></i>
                  ${statusBadge(h.to_status)}
                </div>
              </div>
              <div class="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                ${h.actor_name ? `<span><i class="fas fa-user mr-0.5"></i>${h.actor_name}</span>` : ''}
                <span><i class="fas fa-clock mr-0.5"></i>${formatDate(h.created_at)}</span>
              </div>
              ${h.note ? `<div class="mt-1.5 text-xs text-gray-600 bg-gray-50 rounded p-1.5">${h.note}</div>` : ''}
            </div>
          </div>
        `).join('')}
        ${history.length === 0 ? '<p class="text-gray-400 text-sm text-center py-4">이력이 없습니다</p>' : ''}
      </div>
    </div>`;

  showDrawer(content, {
    title: `주문 #${orderId} 이력`,
    subtitle: `${o.customer_name || ''} · ${statusBadge(o.status)}`,
    width: '480px',
    footer: `<button onclick="closeDrawer();showOrderTimelineModal(${orderId})" class="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-timeline mr-1"></i>전체 타임라인</button>
             <button onclick="closeDrawer()" class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">닫기</button>`
  });
}

async function showOrderAuditDrawer(orderId) {
  const res = await api('GET', `/audit-logs?entity_type=ORDER&entity_id=${orderId}&limit=50`);
  const logs = res?.logs || [];

  const content = `
    <div class="space-y-3">
      ${logs.map(l => `
        <div class="bg-white rounded-lg border p-3 text-sm">
          <div class="flex items-center justify-between mb-1.5">
            <span class="status-badge bg-blue-100 text-blue-700 text-[10px]">${l.action}</span>
            <span class="text-[10px] text-gray-400">${formatDate(l.created_at)}</span>
          </div>
          <div class="text-xs text-gray-600">${l.actor_name || '-'} (${l.actor_login_id || ''})</div>
          ${l.detail_json ? `<div class="mt-1 text-[10px] text-gray-400 font-mono bg-gray-50 rounded p-1.5 max-h-20 overflow-hidden">${l.detail_json.substring(0, 200)}</div>` : ''}
        </div>
      `).join('')}
      ${logs.length === 0 ? '<p class="text-gray-400 text-center py-8">감사 로그가 없습니다</p>' : ''}
    </div>`;

  showDrawer(content, {
    title: `주문 #${orderId} 감사 로그`,
    subtitle: `${logs.length}건의 기록`,
    width: '460px'
  });
}

// ────────────────────────────────────────
//  10. 글로벌 CSS (인터랙션용)
// ────────────────────────────────────────
function injectInteractionStyles() {
  if (document.getElementById('ix-styles')) return;
  const style = document.createElement('style');
  style.id = 'ix-styles';
  style.textContent = `
    /* Popover */
    .ix-popover { transition: opacity 0.2s, transform 0.2s; }
    
    /* Context Menu */
    .ix-context-menu { transition: opacity 0.15s, transform 0.15s; }
    .ix-context-menu button:hover { background: #eff6ff; }
    
    /* Drawer */
    .ix-drawer-panel { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .ix-drawer-overlay { transition: opacity 0.3s; }
    
    /* Tooltip */
    .ix-tooltip::after {
      content: '';
      position: absolute;
      width: 6px; height: 6px;
      background: #1f2937;
      transform: rotate(45deg);
      bottom: -3px;
      left: calc(50% - 3px);
    }
    
    /* 호버 프리뷰 트리거 */
    [data-preview] { position: relative; }
    [data-preview]:hover { color: #2563eb; }
    [data-preview]::after {
      content: '';
      position: absolute;
      bottom: -1px; left: 0; right: 0;
      height: 1px;
      background: #3b82f6;
      transform: scaleX(0);
      transition: transform 0.2s;
    }
    [data-preview]:hover::after { transform: scaleX(1); }

    /* 컨텍스트 메뉴 트리거 */
    .ix-ctx-trigger { cursor: context-menu; }

    /* 클릭 가능 표시 (어포던스) */
    .ix-clickable { 
      cursor: pointer; 
      transition: all 0.15s;
    }
    .ix-clickable:hover {
      background-color: rgba(59, 130, 246, 0.04);
      transform: translateY(-1px);
    }
    .ix-clickable:active {
      transform: translateY(0);
    }

    /* 인터랙티브 테이블 행 */
    .ix-table-row {
      cursor: pointer;
      transition: all 0.15s;
      position: relative;
    }
    .ix-table-row:hover {
      background-color: #f0f7ff !important;
      box-shadow: inset 3px 0 0 #3b82f6;
    }
    .ix-table-row:active {
      background-color: #dbeafe !important;
    }

    /* 인터랙티브 카드 */
    .ix-card {
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .ix-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0,0,0,0.08);
      border-color: #93c5fd;
    }
    .ix-card:active {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }

    /* 배치 액션 바 */
    #ix-batch-bar {
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* 스테이터스 플로우 */
    .ix-status-flow { user-select: none; }

    /* 숫자 카운트 애니메이션 */
    @keyframes countUp { 0% { transform: translateY(8px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
    .ix-count-animate { animation: countUp 0.3s ease-out; }

    /* 로딩 스켈레톤 */
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    .ix-skeleton {
      background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 0.5rem;
    }

    /* 배지 pulse 효과 */
    @keyframes badgePulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
    .ix-badge-pulse { animation: badgePulse 2s ease-in-out infinite; }
  `;
  document.head.appendChild(style);
}

// ────────────────────────────────────────
//  11. 스켈레톤 로딩
// ────────────────────────────────────────
function showSkeletonLoading(el, type = 'table') {
  const templates = {
    table: `
      <div class="space-y-3 p-4">
        <div class="ix-skeleton h-10 w-full"></div>
        ${Array(5).fill('').map(() => `<div class="ix-skeleton h-12 w-full"></div>`).join('')}
      </div>`,
    cards: `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
        ${Array(8).fill('').map(() => `<div class="ix-skeleton h-24 w-full"></div>`).join('')}
      </div>`,
    detail: `
      <div class="space-y-4 p-6">
        <div class="ix-skeleton h-6 w-48"></div>
        <div class="grid grid-cols-2 gap-4">
          ${Array(6).fill('').map(() => `<div class="ix-skeleton h-16 w-full"></div>`).join('')}
        </div>
      </div>`,
  };
  el.innerHTML = templates[type] || templates.table;
}

// ────────────────────────────────────────
//  12. 초기화
// ────────────────────────────────────────
function initInteractionSystem() {
  injectInteractionStyles();
  initTooltips();
  initHoverPreview();

  // ESC 키로 팝오버/컨텍스트메뉴 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePopover();
      closeContextMenu();
      closeBatchActionBar();
    }
  });
}

// 페이지 로드 시 자동 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInteractionSystem);
} else {
  initInteractionSystem();
}

// ============================================================
// Mobile Swipe Actions v9.0
// 카드/행에 좌우 스와이프 → 빠른 액션 (승인/반려/배정)
// ============================================================

function initSwipeAction(element, options = {}) {
  if (!element || !isMobile()) return;
  
  const threshold = options.threshold || 60;
  const actions = options.actions || []; // [{direction:'right', label, icon, color, handler}]
  let startX = 0, startY = 0, currentX = 0, swiping = false;

  element.style.position = 'relative';
  element.style.overflow = 'hidden';

  const content = element.querySelector('.swipe-content') || element;

  element.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    swiping = true;
    content.style.transition = 'none';
  }, { passive: true });

  element.addEventListener('touchmove', (e) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    
    // 세로 스크롤 우선
    if (Math.abs(dy) > Math.abs(dx)) { swiping = false; return; }
    
    currentX = dx;
    const leftActions = actions.filter(a => a.direction === 'left');
    const rightActions = actions.filter(a => a.direction === 'right');
    
    if (dx < 0 && leftActions.length > 0) {
      content.style.transform = `translateX(${Math.max(dx, -150)}px)`;
    } else if (dx > 0 && rightActions.length > 0) {
      content.style.transform = `translateX(${Math.min(dx, 150)}px)`;
    }
  }, { passive: true });

  element.addEventListener('touchend', () => {
    if (!swiping) return;
    swiping = false;
    content.style.transition = 'transform 0.2s ease-out';

    if (Math.abs(currentX) > threshold) {
      const direction = currentX > 0 ? 'right' : 'left';
      const action = actions.find(a => a.direction === direction);
      if (action && action.handler) {
        // 퀵 피드백
        content.style.transform = `translateX(${currentX > 0 ? '100%' : '-100%'})`;
        setTimeout(() => {
          content.style.transform = 'translateX(0)';
          action.handler();
        }, 200);
        return;
      }
    }
    content.style.transform = 'translateX(0)';
    currentX = 0;
  }, { passive: true });
}

// 검수 페이지용 스와이프: 우측 → 승인, 좌측 → 반려
function enableReviewSwipe(cardEl, orderId) {
  if (!isMobile()) return;
  initSwipeAction(cardEl, {
    threshold: 70,
    actions: [
      { 
        direction: 'right', label: '승인', icon: 'fa-check', color: '#22c55e',
        handler: () => { if (typeof quickApprove === 'function') quickApprove(orderId); }
      },
      { 
        direction: 'left', label: '반려', icon: 'fa-times', color: '#ef4444',
        handler: () => { if (typeof showRejectModal === 'function') showRejectModal(orderId); }
      }
    ]
  });
}
