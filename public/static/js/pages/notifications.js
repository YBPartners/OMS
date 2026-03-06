// ============================================================
// Airflow — 알림 시스템 v6.0 (UX 혁신)
// ★ 슬라이드-인 알림센터 패널 + 헤더 통합 + 실시간 뱃지
// ★ 타입별 아이콘/색상 + 시간 그룹화 + 일괄 관리
// ============================================================

let _notifUnreadCount = 0;
let _notifPollTimer = null;
let _notifCenterOpen = false;
let _notifCenterData = null;

// ─── 알림 타입 매핑 (확장) ───
const NOTIF_TYPE_MAP = {
  SIGNUP_APPROVED:      { icon: 'fa-user-check',      color: 'text-emerald-500', bg: 'bg-emerald-50',   ring: 'ring-emerald-200', label: '가입승인' },
  SIGNUP_REJECTED:      { icon: 'fa-user-xmark',      color: 'text-red-500',     bg: 'bg-red-50',       ring: 'ring-red-200',     label: '가입반려' },
  SIGNUP_REQUEST:       { icon: 'fa-user-plus',        color: 'text-blue-500',    bg: 'bg-blue-50',      ring: 'ring-blue-200',    label: '가입요청' },
  REGION_ADD_APPROVED:  { icon: 'fa-map-pin',          color: 'text-indigo-500',  bg: 'bg-indigo-50',    ring: 'ring-indigo-200',  label: '지역추가' },
  ORDER_ASSIGNED:       { icon: 'fa-clipboard-list',   color: 'text-purple-500',  bg: 'bg-purple-50',    ring: 'ring-purple-200',  label: '주문배정' },
  ORDER_STATUS:         { icon: 'fa-rotate',           color: 'text-sky-500',     bg: 'bg-sky-50',       ring: 'ring-sky-200',     label: '상태변경' },
  DISTRIBUTION:         { icon: 'fa-share-nodes',      color: 'text-cyan-500',    bg: 'bg-cyan-50',      ring: 'ring-cyan-200',    label: '배분' },
  REVIEW_APPROVED:      { icon: 'fa-thumbs-up',        color: 'text-green-500',   bg: 'bg-green-50',     ring: 'ring-green-200',   label: '검수승인' },
  SETTLEMENT:           { icon: 'fa-coins',            color: 'text-amber-500',   bg: 'bg-amber-50',     ring: 'ring-amber-200',   label: '정산' },
  SETTLEMENT_CONFIRMED: { icon: 'fa-circle-check',     color: 'text-amber-600',   bg: 'bg-amber-50',     ring: 'ring-amber-200',   label: '정산확정' },
  SYSTEM:               { icon: 'fa-gear',             color: 'text-gray-500',    bg: 'bg-gray-50',      ring: 'ring-gray-200',    label: '시스템' },
  AD_INQUIRY:           { icon: 'fa-rectangle-ad',     color: 'text-blue-500',    bg: 'bg-blue-50',      ring: 'ring-blue-200',    label: '광고문의' },
};
const DEFAULT_NOTIF_TYPE = { icon: 'fa-bell', color: 'text-gray-500', bg: 'bg-gray-50', ring: 'ring-gray-200', label: '알림' };

function getNotifType(type) { return NOTIF_TYPE_MAP[type] || DEFAULT_NOTIF_TYPE; }

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
      updateAllNotifBadges();
      
      if (_notifUnreadCount > prevCount && prevCount >= 0 && typeof showLocalNotification === 'function') {
        showLocalNotification('Airflow', `새로운 알림 ${_notifUnreadCount - prevCount}건이 있습니다.`, '#notifications');
      }
    }
  } catch (e) {
    console.error('[fetchUnreadCount]', e);
  }
}

// ─── 모든 뱃지 동기화 업데이트 ───
function updateAllNotifBadges() {
  // 데스크탑 헤더 뱃지
  _updateBadge('notif-header-badge', _notifUnreadCount);
  // 사이드바 메뉴 뱃지
  _updateBadge('notif-menu-badge', _notifUnreadCount);
  // 모바일 헤더 도트
  const mobileDot = document.getElementById('notif-mobile-dot');
  if (mobileDot) mobileDot.style.display = _notifUnreadCount > 0 ? '' : 'none';
  // 바텀네비 뱃지
  document.querySelectorAll('.nav-badge').forEach(b => {
    b.textContent = _notifUnreadCount > 99 ? '99+' : _notifUnreadCount;
    b.style.display = _notifUnreadCount > 0 ? '' : 'none';
  });
  // 알림센터 패널 내부 뱃지 (열려 있다면)
  _updateBadge('notif-center-badge', _notifUnreadCount);
  // 레거시 호환
  updateNotifBadge();
}

function _updateBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  if (count > 0) {
    el.textContent = count > 99 ? '99+' : count;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

// 레거시 호환: 기존 코드에서 호출하는 함수 유지
function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (_notifUnreadCount > 0) {
    badge.textContent = _notifUnreadCount > 99 ? '99+' : _notifUnreadCount;
    badge.classList.remove('hidden');
  } else { badge.classList.add('hidden'); }
}

// ═══════════════════════════════════════════
// ★ 혁신: 슬라이드-인 알림센터 패널
// ═══════════════════════════════════════════

function openNotifCenter() {
  if (_notifCenterOpen) { closeNotifCenter(); return; }
  _notifCenterOpen = true;

  const overlay = document.getElementById('notif-center-overlay');
  const panel = document.getElementById('notif-center-panel');
  const contentEl = document.getElementById('notif-center-content');
  if (!overlay || !panel || !contentEl) return;

  overlay.classList.remove('hidden');
  // 트리거 슬라이드 인
  requestAnimationFrame(() => {
    panel.classList.remove('translate-x-full');
    panel.classList.add('translate-x-0');
  });

  // 로딩 스켈레톤
  contentEl.innerHTML = _notifCenterSkeleton();
  // 데이터 로드
  _loadNotifCenterData();

  // ESC 닫기
  document.addEventListener('keydown', _notifCenterEsc);
}

function closeNotifCenter() {
  _notifCenterOpen = false;
  const overlay = document.getElementById('notif-center-overlay');
  const panel = document.getElementById('notif-center-panel');
  if (!panel) return;

  panel.classList.remove('translate-x-0');
  panel.classList.add('translate-x-full');

  setTimeout(() => {
    if (overlay) overlay.classList.add('hidden');
  }, 300);

  document.removeEventListener('keydown', _notifCenterEsc);
}

function _notifCenterEsc(e) {
  if (e.key === 'Escape') { e.stopPropagation(); closeNotifCenter(); }
}

// ─── 알림센터 데이터 로드 ───
async function _loadNotifCenterData() {
  try {
    const res = await api('GET', '/notifications?limit=50');
    const notifs = res?.notifications || [];
    const unread = res?.unread_count || 0;
    const total = res?.total || 0;
    _notifCenterData = { notifs, unread, total };
    _renderNotifCenterContent(notifs, unread, total);
  } catch (e) {
    console.error('[NotifCenter]', e);
    const el = document.getElementById('notif-center-content');
    if (el) el.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-gray-400 p-8">
        <i class="fas fa-exclamation-triangle text-4xl mb-3"></i>
        <p class="text-sm">알림을 불러올 수 없습니다.</p>
        <button onclick="_loadNotifCenterData()" class="mt-3 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100">
          <i class="fas fa-redo mr-1"></i>다시 시도
        </button>
      </div>`;
  }
}

// ─── 알림센터 스켈레톤 ───
function _notifCenterSkeleton() {
  return `
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between px-5 py-4 border-b">
        <div class="h-5 w-24 bg-gray-200 rounded animate-pulse"></div>
        <div class="h-8 w-8 bg-gray-200 rounded-lg animate-pulse"></div>
      </div>
      <div class="flex-1 p-4 space-y-3">
        ${Array(6).fill('').map(() => `
          <div class="flex items-start gap-3 animate-pulse">
            <div class="w-10 h-10 bg-gray-200 rounded-xl flex-shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="h-3.5 bg-gray-200 rounded w-3/4"></div>
              <div class="h-3 bg-gray-100 rounded w-full"></div>
              <div class="h-2.5 bg-gray-100 rounded w-1/3"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

// ─── 알림센터 메인 렌더링 ───
function _renderNotifCenterContent(notifs, unread, total) {
  const el = document.getElementById('notif-center-content');
  if (!el) return;

  // 시간 기반 그룹화
  const groups = _groupNotifsByTime(notifs);

  el.innerHTML = `
    <div class="flex flex-col h-full">
      <!-- 헤더 -->
      <div class="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
            <i class="fas fa-bell text-white text-sm"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-gray-800">알림 센터</h3>
            <p class="text-[11px] text-gray-500">${total}건 중 <span id="notif-center-badge" class="font-bold text-red-600 ${unread > 0 ? '' : 'hidden'}">${unread}</span>${unread > 0 ? '건 안 읽음' : '모두 읽음'}</p>
          </div>
        </div>
        <button onclick="closeNotifCenter()" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/80 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- 액션 바 -->
      ${unread > 0 || notifs.length > 0 ? `
        <div class="flex items-center gap-2 px-5 py-2.5 border-b bg-white flex-shrink-0">
          ${unread > 0 ? `
            <button onclick="ncMarkAllRead()" class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition">
              <i class="fas fa-check-double"></i>모두 읽음
            </button>` : ''}
          <button onclick="ncDeleteRead()" class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100 transition">
            <i class="fas fa-trash-can"></i>읽은 알림 삭제
          </button>
          <div class="flex-1"></div>
          <button onclick="closeNotifCenter();navigateTo('notifications')" class="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition" title="전체 알림 페이지">
            <i class="fas fa-expand"></i>전체 보기
          </button>
        </div>` : ''}

      <!-- 알림 리스트 (스크롤) -->
      <div class="flex-1 overflow-y-auto overscroll-contain" id="notif-center-list">
        ${notifs.length === 0 ? `
          <div class="flex flex-col items-center justify-center py-16 text-gray-400">
            <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <i class="fas fa-bell-slash text-3xl text-gray-300"></i>
            </div>
            <p class="text-sm font-medium">알림이 없습니다</p>
            <p class="text-xs mt-1">새로운 알림이 오면 여기에 표시됩니다.</p>
          </div>
        ` : groups.map(g => `
          <div class="notif-group">
            <div class="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm px-5 py-2 border-b">
              <span class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">${g.label}</span>
              <span class="text-[10px] text-gray-400 ml-2">${g.items.length}건</span>
            </div>
            ${g.items.map(n => _renderNotifCenterItem(n)).join('')}
          </div>
        `).join('')}
      </div>
    </div>`;
}

// ─── 시간 기반 그룹화 ───
function _groupNotifsByTime(notifs) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups = { today: [], yesterday: [], thisWeek: [], older: [] };

  notifs.forEach(n => {
    const d = new Date(n.created_at);
    if (d >= today) groups.today.push(n);
    else if (d >= yesterday) groups.yesterday.push(n);
    else if (d >= weekAgo) groups.thisWeek.push(n);
    else groups.older.push(n);
  });

  const result = [];
  if (groups.today.length) result.push({ label: '오늘', items: groups.today });
  if (groups.yesterday.length) result.push({ label: '어제', items: groups.yesterday });
  if (groups.thisWeek.length) result.push({ label: '이번 주', items: groups.thisWeek });
  if (groups.older.length) result.push({ label: '이전', items: groups.older });

  return result;
}

// ─── 개별 알림 항목 (알림센터 패널) ───
function _renderNotifCenterItem(n) {
  const t = getNotifType(n.type);
  const timeAgo = getTimeAgo(n.created_at);
  const isUnread = !n.is_read;

  return `
    <div class="notif-center-item flex items-start gap-3 px-5 py-3.5 border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer transition-all relative group ${isUnread ? 'bg-blue-50/20' : ''}"
         onclick="ncHandleClick(${n.id}, '${n.link_url || ''}', ${isUnread})">
      <!-- 타입 아이콘 -->
      <div class="relative flex-shrink-0">
        <div class="w-10 h-10 ${t.bg} rounded-xl flex items-center justify-center ${isUnread ? 'ring-2 ' + t.ring : ''}">
          <i class="fas ${t.icon} ${t.color}"></i>
        </div>
        ${isUnread ? '<div class="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>' : ''}
      </div>
      <!-- 내용 -->
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm ${isUnread ? 'font-semibold text-gray-900' : 'font-normal text-gray-600'} leading-snug">${escapeHtml(n.title)}</p>
          <span class="text-[10px] text-gray-400 flex-shrink-0 whitespace-nowrap mt-0.5">${timeAgo}</span>
        </div>
        ${n.message ? `<p class="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">${escapeHtml(n.message)}</p>` : ''}
        <div class="flex items-center gap-2 mt-1.5">
          <span class="text-[10px] px-1.5 py-0.5 rounded-full ${t.bg} ${t.color} font-medium">${t.label}</span>
          ${n.link_url ? `<span class="text-[10px] text-blue-500"><i class="fas fa-arrow-up-right-from-square"></i></span>` : ''}
        </div>
      </div>
      <!-- 호버 액션 -->
      <div class="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        ${isUnread ? `<button onclick="event.stopPropagation();ncMarkOneRead(${n.id})" class="w-7 h-7 bg-white rounded-lg shadow-sm border flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300 transition" title="읽음 처리">
          <i class="fas fa-check text-[10px]"></i>
        </button>` : ''}
        <button onclick="event.stopPropagation();ncDeleteOne(${n.id})" class="w-7 h-7 bg-white rounded-lg shadow-sm border flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-300 transition" title="삭제">
          <i class="fas fa-trash text-[10px]"></i>
        </button>
      </div>
    </div>`;
}

// ─── 알림센터 액션 핸들러 ───
async function ncHandleClick(id, linkUrl, markRead) {
  if (markRead) {
    try {
      await api('PATCH', `/notifications/${id}/read`);
      _notifUnreadCount = Math.max(0, _notifUnreadCount - 1);
      updateAllNotifBadges();
      // 항목 UI 즉시 갱신
      _refreshNotifCenterItem(id);
    } catch {}
  }
  if (linkUrl && linkUrl.startsWith('#')) {
    const page = linkUrl.replace('#', '');
    closeNotifCenter();
    if (hasPermission(page)) navigateTo(page);
  }
}

async function ncMarkOneRead(id) {
  try {
    await api('PATCH', `/notifications/${id}/read`);
    _notifUnreadCount = Math.max(0, _notifUnreadCount - 1);
    updateAllNotifBadges();
    _refreshNotifCenterItem(id);
    showToast('읽음 처리 완료', 'success');
  } catch (e) {
    showToast('처리 실패', 'error');
  }
}

async function ncMarkAllRead() {
  try {
    await api('POST', '/notifications/read-all');
    _notifUnreadCount = 0;
    updateAllNotifBadges();
    showToast('모든 알림을 읽음 처리했습니다.', 'success');
    _loadNotifCenterData(); // 전체 새로고침
  } catch (e) {
    showToast('처리 실패', 'error');
  }
}

async function ncDeleteOne(id) {
  try {
    await api('DELETE', `/notifications/${id}`);
    showToast('삭제 완료', 'success');
    // 센터 새로고침
    _loadNotifCenterData();
    fetchUnreadCount();
  } catch (e) {
    showToast('삭제 실패', 'error');
  }
}

async function ncDeleteRead() {
  if (!confirm('읽은 알림을 모두 삭제하시겠습니까?')) return;
  try {
    await api('DELETE', '/notifications');
    showToast('읽은 알림 삭제 완료', 'success');
    _loadNotifCenterData();
    fetchUnreadCount();
  } catch (e) {
    showToast('삭제 실패', 'error');
  }
}

function _refreshNotifCenterItem(id) {
  // 데이터 캐시 업데이트
  if (_notifCenterData?.notifs) {
    const n = _notifCenterData.notifs.find(x => x.id === id);
    if (n) n.is_read = 1;
    _notifCenterData.unread = _notifUnreadCount;
    _renderNotifCenterContent(_notifCenterData.notifs, _notifCenterData.unread, _notifCenterData.total);
  }
}

// ═══════════════════════════════════════════
// 레거시 호환: 기존 getNotifBellHtml / toggleNotifDropdown
// (사이드바에서 호출하지 않도록 변경되었지만 안전하게 유지)
// ═══════════════════════════════════════════

function getNotifBellHtml() {
  // 이제 사이드바에서 사용하지 않으므로 빈 문자열 반환
  return '';
}

async function toggleNotifDropdown() {
  // 레거시 호환 → 알림센터로 리다이렉트
  openNotifCenter();
}

// ─── 시간 표시 ───
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

// ═══════════════════════════════════════════
// 전체 알림 페이지 (기존 notifications 라우트)
// ═══════════════════════════════════════════

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
      <div class="fade-in max-w-4xl mx-auto">
        <!-- 페이지 헤더 -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow">
              <i class="fas fa-bell text-white"></i>
            </div>
            <div>
              <h2 class="text-xl font-bold text-gray-800">알림</h2>
              <p class="text-xs text-gray-500">${total}건 · 읽지않음 ${unread}건</p>
            </div>
          </div>
          <div class="flex gap-2">
            ${unread > 0 ? `<button onclick="notifMarkAllRead()" class="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 shadow-sm"><i class="fas fa-check-double mr-1"></i>모두 읽음</button>` : ''}
            <button onclick="notifDeleteRead()" class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"><i class="fas fa-trash mr-1"></i>읽은 알림 삭제</button>
          </div>
        </div>

        <!-- 요약 카드 -->
        <div class="grid grid-cols-3 gap-3 mb-6">
          <div class="bg-white rounded-xl border p-4 text-center">
            <div class="text-2xl font-bold text-gray-800">${total}</div>
            <div class="text-xs text-gray-500 mt-1"><i class="fas fa-bell mr-1 text-blue-500"></i>전체</div>
          </div>
          <div class="bg-white rounded-xl border p-4 text-center ${unread > 0 ? 'border-red-200 bg-red-50/30' : ''}">
            <div class="text-2xl font-bold ${unread > 0 ? 'text-red-600' : 'text-gray-800'}">${unread}</div>
            <div class="text-xs text-gray-500 mt-1"><i class="fas fa-circle-dot mr-1 text-red-500"></i>읽지 않음</div>
          </div>
          <div class="bg-white rounded-xl border p-4 text-center">
            <div class="text-2xl font-bold text-gray-800">${total - unread}</div>
            <div class="text-xs text-gray-500 mt-1"><i class="fas fa-check mr-1 text-green-500"></i>읽음</div>
          </div>
        </div>
        
        <!-- 알림 리스트 -->
        <div class="space-y-2">
          ${notifs.length > 0 ? notifs.map(n => _renderNotifPageItem(n)).join('') : `
            <div class="text-center py-16 text-gray-400 bg-white rounded-xl border">
              <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <i class="fas fa-bell-slash text-3xl text-gray-300"></i>
              </div>
              <p class="font-medium">알림이 없습니다.</p>
            </div>
          `}
        </div>
        
        ${total > pg.limit ? `<div class="mt-4">${typeof renderPagination === 'function' ? renderPagination(total, pg.page, pg.limit, 'goNotifPage') : ''}</div>` : ''}
      </div>`;
  } catch (e) {
    console.error('[renderNotifications]', e);
    el.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1 text-gray-400">' + (e.message||e) + '</p></div>';
  }
}

function _renderNotifPageItem(n) {
  const t = getNotifType(n.type);
  const isUnread = !n.is_read;
  
  return `
    <div class="bg-white rounded-xl border ${isUnread ? 'border-blue-200 bg-blue-50/20 shadow-sm' : 'border-gray-100'} p-4 flex items-start gap-4 hover:shadow-md transition group">
      <div class="relative flex-shrink-0">
        <div class="w-11 h-11 ${t.bg} rounded-xl flex items-center justify-center ${isUnread ? 'ring-2 ' + t.ring : ''}">
          <i class="fas ${t.icon} ${t.color} text-lg"></i>
        </div>
        ${isUnread ? '<div class="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>' : ''}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm ${isUnread ? 'font-bold text-gray-900' : 'font-normal text-gray-600'}">${escapeHtml(n.title)}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded-full ${t.bg} ${t.color} font-medium">${t.label}</span>
          ${isUnread ? '<span class="w-2 h-2 bg-blue-500 rounded-full"></span>' : ''}
        </div>
        ${n.message ? `<p class="text-sm text-gray-500 mt-1">${escapeHtml(n.message)}</p>` : ''}
        <div class="flex items-center gap-3 mt-2">
          <span class="text-xs text-gray-400"><i class="far fa-clock mr-1"></i>${getTimeAgo(n.created_at)}</span>
          ${n.link_url ? `<button onclick="handleNotifClick(${n.id}, '${n.link_url}', ${isUnread})" class="text-xs text-blue-600 hover:underline"><i class="fas fa-arrow-up-right-from-square mr-1"></i>이동</button>` : ''}
          ${isUnread ? `<button onclick="markSingleNotifRead(${n.id})" class="text-xs text-gray-500 hover:underline">읽음 처리</button>` : ''}
          <button onclick="deleteSingleNotif(${n.id})" class="text-xs text-red-400 hover:underline opacity-0 group-hover:opacity-100 transition">삭제</button>
        </div>
      </div>
    </div>`;
}

// ─── 레거시 전체 페이지 액션 핸들러 ───
async function handleNotifClick(id, linkUrl, markRead) {
  if (markRead) {
    try {
      await api('PATCH', `/notifications/${id}/read`);
      _notifUnreadCount = Math.max(0, _notifUnreadCount - 1);
      updateAllNotifBadges();
    } catch {}
  }
  if (linkUrl && linkUrl.startsWith('#')) {
    const page = linkUrl.replace('#', '');
    if (hasPermission(page)) navigateTo(page);
  }
}

async function markSingleNotifRead(id) {
  await apiAction('PATCH', `/notifications/${id}/read`, null, {
    silent: true,
    onSuccess: () => {
      _notifUnreadCount = Math.max(0, _notifUnreadCount - 1);
      updateAllNotifBadges();
      renderContent();
    }
  });
}

async function markAllNotifRead() {
  // 레거시 호환 (드롭다운에서 호출)
  await ncMarkAllRead();
  renderContent();
}

async function notifMarkAllRead() {
  await apiAction('POST', '/notifications/read-all', null, {
    successMsg: '모든 알림을 읽음 처리했습니다.',
    onSuccess: () => {
      _notifUnreadCount = 0;
      updateAllNotifBadges();
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

// 레거시 호환
function loadNotifDropdown() { /* no-op, replaced by NotifCenter */ }
function renderNotifItem() { return ''; }
function closeNotifOnOutsideClick() {}
