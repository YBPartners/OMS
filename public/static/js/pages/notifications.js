// ============================================================
// 와이비 OMS — 알림 시스템 UI v5.0
// 헤더 벨 아이콘 + 드롭다운 + 알림 페이지
// ============================================================

let _notifUnreadCount = 0;
let _notifPollTimer = null;

// ─── 알림 카운트 폴링 (30초 간격) ───
function startNotificationPolling() {
  stopNotificationPolling();
  fetchUnreadCount();
  _notifPollTimer = setInterval(fetchUnreadCount, 30000);
}

function stopNotificationPolling() {
  if (_notifPollTimer) { clearInterval(_notifPollTimer); _notifPollTimer = null; }
}

async function fetchUnreadCount() {
  try {
  if (!currentUser) return;
  const res = await api('GET', '/notifications/unread-count');
  if (res?.unread_count !== undefined) {
    const prevCount = _notifUnreadCount;
    _notifUnreadCount = res.unread_count;
    updateNotifBadge();
    
    // v14.0: 새 알림이 늘어났으면 로컬 푸시 알림 발송
    if (_notifUnreadCount > prevCount && prevCount >= 0 && typeof showLocalNotification === 'function') {
      showLocalNotification(
        '와이비 OMS',
        `새로운 알림 ${_notifUnreadCount - prevCount}건이 있습니다.`,
        '#notifications'
      );
    }
  }

  } catch (e) {
  console.error('[fetchUnreadCount]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (_notifUnreadCount > 0) {
    badge.textContent = _notifUnreadCount > 99 ? '99+' : _notifUnreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// ─── 알림 벨 컴포넌트 (사이드바 하단 또는 헤더에 삽입) ───
function getNotifBellHtml() {
  return `
    <button onclick="toggleNotifDropdown()" class="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition" title="알림">
      <i class="fas fa-bell text-lg"></i>
      <span id="notif-badge" class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ${_notifUnreadCount > 0 ? '' : 'hidden'}">${_notifUnreadCount}</span>
    </button>
    <div id="notif-dropdown" class="hidden absolute right-0 top-full mt-1 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden" style="max-height:480px">
      <div id="notif-dropdown-content"></div>
    </div>`;
}

async function toggleNotifDropdown() {
  try {
  const dd = document.getElementById('notif-dropdown');
  if (!dd) return;
  
  if (dd.classList.contains('hidden')) {
    dd.classList.remove('hidden');
    await loadNotifDropdown();
    // 클릭 외부 닫기
    setTimeout(() => {
      document.addEventListener('click', closeNotifOnOutsideClick);
    }, 10);
  } else {
    dd.classList.add('hidden');
    document.removeEventListener('click', closeNotifOnOutsideClick);
  }

  } catch (e) {
  console.error('[toggleNotifDropdown]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

function closeNotifOnOutsideClick(e) {
  const dd = document.getElementById('notif-dropdown');
  if (dd && !dd.contains(e.target) && !e.target.closest('[onclick*="toggleNotifDropdown"]')) {
    dd.classList.add('hidden');
    document.removeEventListener('click', closeNotifOnOutsideClick);
  }
}

async function loadNotifDropdown() {
  try {
  const el = document.getElementById('notif-dropdown-content');
  if (!el) return;
  
  el.innerHTML = '<div class="p-4 text-center text-gray-400 text-sm"><i class="fas fa-spinner fa-spin"></i></div>';
  
  const res = await api('GET', '/notifications?limit=10');
  const notifs = res?.notifications || [];
  const unread = res?.unread_count || 0;
  
  if (notifs.length === 0) {
    el.innerHTML = `
      <div class="p-3 border-b flex items-center justify-between">
        <span class="font-semibold text-sm">알림</span>
      </div>
      <div class="p-8 text-center text-gray-400">
        <i class="fas fa-bell-slash text-3xl mb-2"></i>
        <p class="text-sm">알림이 없습니다.</p>
      </div>`;
    return;
  }
  
  el.innerHTML = `
    <div class="p-3 border-b flex items-center justify-between">
      <span class="font-semibold text-sm">알림 ${unread > 0 ? `<span class="text-red-500">(${unread})</span>` : ''}</span>
      <div class="flex gap-2">
        ${unread > 0 ? `<button onclick="markAllNotifRead()" class="text-xs text-blue-600 hover:underline">모두 읽음</button>` : ''}
        <button onclick="navigateTo('notifications');toggleNotifDropdown()" class="text-xs text-gray-500 hover:underline">전체 보기</button>
      </div>
    </div>
    <div class="overflow-y-auto" style="max-height:380px">
      ${notifs.map(n => renderNotifItem(n)).join('')}
    </div>`;

  } catch (e) {
  console.error('[loadNotifDropdown]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

function renderNotifItem(n) {
  const typeIcons = {
    SIGNUP_APPROVED: { icon: 'fa-user-check', color: 'text-green-500', bg: 'bg-green-50' },
    SIGNUP_REJECTED: { icon: 'fa-user-xmark', color: 'text-red-500', bg: 'bg-red-50' },
    REGION_ADD_APPROVED: { icon: 'fa-map-pin', color: 'text-blue-500', bg: 'bg-blue-50' },
    ORDER_ASSIGNED: { icon: 'fa-clipboard-list', color: 'text-purple-500', bg: 'bg-purple-50' },
    SETTLEMENT_CONFIRMED: { icon: 'fa-coins', color: 'text-amber-500', bg: 'bg-amber-50' },
  };
  const t = typeIcons[n.type] || { icon: 'fa-bell', color: 'text-gray-500', bg: 'bg-gray-50' };
  const timeAgo = getTimeAgo(n.created_at);
  
  return `
    <div class="flex items-start gap-3 p-3 border-b hover:bg-gray-50 cursor-pointer ${n.is_read ? 'opacity-60' : ''}"
      onclick="handleNotifClick(${n.id}, '${n.link_url || ''}', ${!n.is_read})">
      <div class="w-8 h-8 ${t.bg} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
        <i class="fas ${t.icon} ${t.color} text-sm"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-800 ${n.is_read ? 'font-normal' : ''}">${n.title}</p>
        ${n.message ? `<p class="text-xs text-gray-500 mt-0.5 truncate">${n.message}</p>` : ''}
        <span class="text-[10px] text-gray-400 mt-1 inline-block">${timeAgo}</span>
      </div>
      ${!n.is_read ? '<div class="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>' : ''}
    </div>`;
}

async function handleNotifClick(id, linkUrl, markRead) {
  if (markRead) {
    await apiAction('PATCH', `/notifications/${id}/read`, null, {
      silent: true,
      onSuccess: () => {
        _notifUnreadCount = Math.max(0, _notifUnreadCount - 1);
        updateNotifBadge();
      }
    });
  }
  if (linkUrl && linkUrl.startsWith('#')) {
    const page = linkUrl.replace('#', '');
    if (hasPermission(page)) navigateTo(page);
  }
  const dd = document.getElementById('notif-dropdown');
  if (dd) dd.classList.add('hidden');
}

async function markAllNotifRead() {
  await apiAction('POST', '/notifications/read-all', null, {
    successMsg: '모든 알림을 읽음 처리했습니다.',
    onSuccess: () => {
      _notifUnreadCount = 0;
      updateNotifBadge();
      loadNotifDropdown();
    }
  });
}

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return dateStr.split('T')[0];
}

// ─── 알림 전체 페이지 ───
async function renderNotifications(el) {
  try {
  const params = new URLSearchParams(window._notifFilters || {});
  if (!params.has('limit')) params.set('limit', '30');
  const res = await api('GET', `/notifications?${params.toString()}`);
  const notifs = res?.notifications || [];
  const total = res?.total || 0;
  const unread = res?.unread_count || 0;
  const pg = { page: res?.page || 1, limit: res?.limit || 30 };

  el.innerHTML = `
    <div class="fade-in">
      ${pageHeader('fa-bell', '알림', 'blue', `
        ${unread > 0 ? `<button onclick="notifMarkAllRead()" class="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-check-double mr-1"></i>모두 읽음</button>` : ''}
        <button onclick="notifDeleteRead()" class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"><i class="fas fa-trash mr-1"></i>읽은 알림 삭제</button>
      `)}
      
      ${renderStatusCards([
        { label: '전체', value: total, icon: 'fa-bell', color: 'blue' },
        { label: '읽지 않음', value: unread, icon: 'fa-circle-dot', color: 'red' },
        { label: '읽음', value: total - unread, icon: 'fa-check', color: 'green' },
      ])}
      
      <div class="space-y-2">
        ${notifs.length > 0 ? notifs.map(n => renderNotifPageItem(n)).join('') : `
          <div class="text-center py-12 text-gray-400">
            <i class="fas fa-bell-slash text-4xl mb-3"></i>
            <p>알림이 없습니다.</p>
          </div>
        `}
      </div>
      
      ${total > pg.limit ? `<div class="mt-4">${renderPagination(total, pg.page, pg.limit, 'goNotifPage')}</div>` : ''}
    </div>`;

  } catch (e) {
  console.error('[renderNotifications]', e);
  el.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1 text-gray-400">' + (e.message||e) + '</p></div>';
  }
}

function renderNotifPageItem(n) {
  const typeIcons = {
    SIGNUP_APPROVED: { icon: 'fa-user-check', color: 'text-green-500', bg: 'bg-green-100' },
    SIGNUP_REJECTED: { icon: 'fa-user-xmark', color: 'text-red-500', bg: 'bg-red-100' },
    REGION_ADD_APPROVED: { icon: 'fa-map-pin', color: 'text-blue-500', bg: 'bg-blue-100' },
    ORDER_ASSIGNED: { icon: 'fa-clipboard-list', color: 'text-purple-500', bg: 'bg-purple-100' },
    SETTLEMENT_CONFIRMED: { icon: 'fa-coins', color: 'text-amber-500', bg: 'bg-amber-100' },
  };
  const t = typeIcons[n.type] || { icon: 'fa-bell', color: 'text-gray-500', bg: 'bg-gray-100' };
  
  return `
    <div class="bg-white rounded-xl border ${n.is_read ? 'border-gray-100' : 'border-blue-200 bg-blue-50/30'} p-4 flex items-start gap-4 hover:shadow-sm transition">
      <div class="w-10 h-10 ${t.bg} rounded-xl flex items-center justify-center flex-shrink-0">
        <i class="fas ${t.icon} ${t.color}"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-gray-800 ${n.is_read ? 'font-normal text-gray-600' : ''}">${n.title}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">${n.type}</span>
          ${!n.is_read ? '<span class="w-2 h-2 bg-blue-500 rounded-full"></span>' : ''}
        </div>
        ${n.message ? `<p class="text-sm text-gray-500 mt-1">${n.message}</p>` : ''}
        <div class="flex items-center gap-3 mt-2">
          <span class="text-xs text-gray-400"><i class="far fa-clock mr-1"></i>${getTimeAgo(n.created_at)}</span>
          ${n.link_url ? `<button onclick="handleNotifClick(${n.id}, '${n.link_url}', ${!n.is_read})" class="text-xs text-blue-600 hover:underline"><i class="fas fa-external-link mr-1"></i>이동</button>` : ''}
          ${!n.is_read ? `<button onclick="markSingleNotifRead(${n.id})" class="text-xs text-gray-500 hover:underline">읽음 처리</button>` : ''}
          <button onclick="deleteSingleNotif(${n.id})" class="text-xs text-red-400 hover:underline">삭제</button>
        </div>
      </div>
    </div>`;
}

async function markSingleNotifRead(id) {
  await apiAction('PATCH', `/notifications/${id}/read`, null, {
    silent: true,
    onSuccess: () => {
      _notifUnreadCount = Math.max(0, _notifUnreadCount - 1);
      updateNotifBadge();
      renderContent();
    }
  });
}

async function notifMarkAllRead() {
  await apiAction('POST', '/notifications/read-all', null, {
    successMsg: '모든 알림을 읽음 처리했습니다.',
    onSuccess: () => {
      _notifUnreadCount = 0;
      updateNotifBadge();
    },
    refresh: true
  });
}

async function deleteSingleNotif(id) {
  await apiAction('DELETE', `/notifications/${id}`, null, {
    successMsg: '삭제 완료',
    refresh: true
  });
}

async function notifDeleteRead() {
  await apiAction('DELETE', '/notifications', null, {
    confirm: '읽은 알림을 모두 삭제하시겠습니까?',
    confirmTitle: '읽은 알림 삭제',
    confirmBtn: '삭제',
    confirmBtnClass: 'bg-red-600',
    successMsg: '읽은 알림 삭제 완료',
    refresh: true
  });
}

function goNotifPage(page) {
  window._notifFilters = { ...(window._notifFilters || {}), page };
  renderContent();
}
