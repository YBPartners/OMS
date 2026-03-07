// ================================================================
// Airflow OMS — Schedule / Calendar View v1.0
// 월간·주간·일간 뷰 + 드래그 일정변경 + 퀵 액션
// 의존: orders.js(showOrderDetailDrawer), my-orders.js(readyDone,startWork),
//       core/ui.js, core/interactions.js, core/api.js, shared/table.js
// ================================================================

let _scheduleState = {
  view: 'month', // month | week | day
  year: new Date().getFullYear(),
  month: new Date().getMonth(), // 0-based
  weekStart: null, // Date object for week view
  day: null, // Date object for day view
  events: [],
  loading: false,
};

const _SCH_STATUS_COLORS = {
  ASSIGNED: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  READY_DONE: { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  IN_PROGRESS: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  SUBMITTED: { bg: 'bg-cyan-100', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  DONE: { bg: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-500' },
};

// ─── 메인 렌더링 ───
async function renderSchedule(el) {
  el.innerHTML = showSkeletonLoading(6);
  await _schLoadEvents();
  _schRender(el);
}

async function _schLoadEvents() {
  _scheduleState.loading = true;
  const s = _scheduleState;
  let from, to;

  if (s.view === 'month') {
    // 해당 월 + 전후 주 여유
    const first = new Date(s.year, s.month, 1);
    const last = new Date(s.year, s.month + 1, 0);
    from = new Date(first); from.setDate(from.getDate() - first.getDay());
    to = new Date(last); to.setDate(to.getDate() + (6 - last.getDay()));
  } else if (s.view === 'week') {
    from = new Date(s.weekStart);
    to = new Date(from); to.setDate(to.getDate() + 6);
  } else {
    from = new Date(s.day);
    to = new Date(s.day);
  }

  const fromStr = _schFmtDate(from);
  const toStr = _schFmtDate(to);

  try {
    const res = await api('GET', `/orders/schedule?from=${fromStr}&to=${toStr}`);
    _scheduleState.events = res?.events || [];
  } catch (e) {
    console.error('[schedule]', e);
    _scheduleState.events = [];
  }
  _scheduleState.loading = false;
}

function _schFmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function _schRender(el) {
  const s = _scheduleState;
  const today = _schFmtDate(new Date());
  const title = s.view === 'month' ? `${s.year}년 ${s.month + 1}월`
    : s.view === 'week' ? _schWeekTitle()
    : _schDayTitle();

  el.innerHTML = `
    <div class="space-y-4">
      <!-- 헤더 -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-3">
          <button onclick="_schPrev()" class="p-2 hover:bg-gray-100 rounded-lg transition"><i class="fas fa-chevron-left"></i></button>
          <h2 class="text-lg font-bold text-gray-800 min-w-[150px] text-center">${title}</h2>
          <button onclick="_schNext()" class="p-2 hover:bg-gray-100 rounded-lg transition"><i class="fas fa-chevron-right"></i></button>
          <button onclick="_schToday()" class="px-3 py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 transition">오늘</button>
        </div>
        <div class="flex bg-gray-100 rounded-lg p-0.5">
          ${['month','week','day'].map(v => `
            <button onclick="_schSwitchView('${v}')" class="px-3 py-1.5 text-xs rounded-md transition ${s.view === v ? 'bg-white shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}">
              ${v === 'month' ? '월간' : v === 'week' ? '주간' : '일간'}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- 범례 -->
      <div class="flex flex-wrap gap-3 text-xs text-gray-500">
        <span><span class="inline-block w-2.5 h-2.5 rounded-full bg-purple-500 mr-1"></span>배정됨</span>
        <span><span class="inline-block w-2.5 h-2.5 rounded-full bg-violet-500 mr-1"></span>준비완료</span>
        <span><span class="inline-block w-2.5 h-2.5 rounded-full bg-orange-500 mr-1"></span>수행중</span>
        <span><span class="inline-block w-2.5 h-2.5 rounded-full bg-cyan-500 mr-1"></span>완료전송</span>
        <span><span class="inline-block w-2.5 h-2.5 rounded-full bg-sky-500 mr-1"></span>최종완료</span>
        <span class="ml-auto text-gray-400">${s.events.length}건</span>
      </div>

      <!-- 캘린더 본체 -->
      <div id="sch-body">${s.view === 'month' ? _schMonthView(today) : s.view === 'week' ? _schWeekView(today) : _schDayView(today)}</div>
    </div>`;
}

// ═══════════════ 월간 뷰 ═══════════════

function _schMonthView(today) {
  const s = _scheduleState;
  const first = new Date(s.year, s.month, 1);
  const last = new Date(s.year, s.month + 1, 0);
  const startDay = first.getDay(); // 0=일
  const daysInMonth = last.getDate();

  // 이벤트를 날짜별로 그룹핑
  const eventsByDate = {};
  s.events.forEach(e => {
    const d = e.scheduled_date || e.requested_date;
    if (!d) return;
    if (!eventsByDate[d]) eventsByDate[d] = [];
    eventsByDate[d].push(e);
  });

  const dayNames = ['일','월','화','수','목','금','토'];
  let html = `<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">`;
  // 요일 헤더
  html += `<div class="grid grid-cols-7 border-b border-gray-200">`;
  dayNames.forEach((n, i) => {
    const color = i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500';
    html += `<div class="py-2 text-center text-xs font-medium ${color}">${n}</div>`;
  });
  html += `</div>`;

  // 날짜 셀
  html += `<div class="grid grid-cols-7">`;
  // 이전 달 빈 셀
  for (let i = 0; i < startDay; i++) {
    html += `<div class="min-h-[90px] md:min-h-[110px] border-b border-r border-gray-100 p-1 bg-gray-50"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${s.year}-${String(s.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = (startDay + d - 1) % 7;
    const isToday = dateStr === today;
    const events = eventsByDate[dateStr] || [];
    const isSun = dayOfWeek === 0;
    const isSat = dayOfWeek === 6;

    html += `<div class="min-h-[90px] md:min-h-[110px] border-b border-r border-gray-100 p-1 cursor-pointer hover:bg-blue-50/30 transition ${isToday ? 'bg-blue-50/50' : ''}"
                 onclick="_schClickDate('${dateStr}')">
      <div class="flex items-center justify-between mb-0.5">
        <span class="text-xs font-medium ${isToday ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-600'}">${d}</span>
        ${events.length > 0 ? `<span class="text-[10px] text-gray-400">${events.length}</span>` : ''}
      </div>
      <div class="space-y-0.5 overflow-hidden" style="max-height:76px">
        ${events.slice(0, 3).map(e => _schEventDot(e)).join('')}
        ${events.length > 3 ? `<div class="text-[10px] text-gray-400 pl-1">+${events.length - 3}건</div>` : ''}
      </div>
    </div>`;
  }

  // 다음 달 빈 셀
  const totalCells = startDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < remaining; i++) {
    html += `<div class="min-h-[90px] md:min-h-[110px] border-b border-r border-gray-100 p-1 bg-gray-50"></div>`;
  }
  html += `</div></div>`;

  // 오늘의 일정 요약
  const todayEvents = eventsByDate[today] || [];
  if (todayEvents.length > 0) {
    html += _schDayEventList(today, todayEvents, '오늘의 일정');
  }

  return html;
}

function _schEventDot(e) {
  const c = _SCH_STATUS_COLORS[e.status] || { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
  const time = e.scheduled_time ? e.scheduled_time.slice(0, 5) : '';
  return `<div class="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] ${c.bg} ${c.text} truncate cursor-pointer"
               onclick="event.stopPropagation();showOrderDetailDrawer(${e.order_id})"
               title="${e.customer_name} ${time ? time + ' ' : ''}${e.address_text || ''}">
    <span class="w-1.5 h-1.5 rounded-full ${c.dot} flex-shrink-0"></span>
    ${time ? `<span class="font-mono">${time}</span>` : ''}
    <span class="truncate">${escapeHtml(e.customer_name || '')}</span>
  </div>`;
}

// ═══════════════ 주간 뷰 ═══════════════

function _schWeekView(today) {
  const s = _scheduleState;
  const start = new Date(s.weekStart);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const eventsByDate = {};
  s.events.forEach(e => {
    const d = e.scheduled_date || e.requested_date;
    if (!d) return;
    if (!eventsByDate[d]) eventsByDate[d] = [];
    eventsByDate[d].push(e);
  });

  const dayNames = ['일','월','화','수','목','금','토'];
  const hours = ['09','10','11','12','13','14','15','16','17'];

  let html = `<div class="bg-white rounded-xl border border-gray-200 overflow-x-auto">`;
  html += `<table class="w-full min-w-[700px]"><thead><tr>`;
  html += `<th class="w-16 py-2 text-xs text-gray-400 border-b border-r border-gray-200">시간</th>`;
  days.forEach((d, i) => {
    const ds = _schFmtDate(d);
    const isToday = ds === today;
    const color = i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : '';
    html += `<th class="py-2 text-xs border-b border-r border-gray-200 cursor-pointer hover:bg-blue-50 ${isToday ? 'bg-blue-50' : ''} ${color}"
                 onclick="_schClickDate('${ds}')">
      <div>${dayNames[i]}</div>
      <div class="text-sm font-bold ${isToday ? 'text-blue-600' : ''}">${d.getDate()}</div>
    </th>`;
  });
  html += `</tr></thead><tbody>`;

  hours.forEach(h => {
    html += `<tr>`;
    html += `<td class="py-2 px-1 text-xs text-gray-400 text-center border-r border-b border-gray-100 font-mono">${h}:00</td>`;
    days.forEach(d => {
      const ds = _schFmtDate(d);
      const isToday = ds === today;
      const dayEvents = (eventsByDate[ds] || []).filter(e => {
        if (!e.scheduled_time) return h === '09'; // 시간 미정은 09시에 표시
        return e.scheduled_time.startsWith(h);
      });
      html += `<td class="py-1 px-1 border-r border-b border-gray-100 align-top ${isToday ? 'bg-blue-50/30' : ''}" style="min-width:90px">
        ${dayEvents.map(e => _schWeekEvent(e)).join('')}
      </td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  return html;
}

function _schWeekEvent(e) {
  const c = _SCH_STATUS_COLORS[e.status] || { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
  const time = e.scheduled_time ? e.scheduled_time.slice(0, 5) : '미정';
  return `<div class="mb-1 px-1.5 py-1 rounded ${c.bg} ${c.text} text-[10px] cursor-pointer hover:ring-1 ring-current truncate"
               onclick="showOrderDetailDrawer(${e.order_id})"
               title="#${e.order_id} ${e.customer_name} ${e.address_text || ''}">
    <div class="font-medium truncate">${escapeHtml(e.customer_name || '')}</div>
    <div class="text-[9px] opacity-70">${time}${e.channel_name ? ' · ' + e.channel_name : ''}</div>
  </div>`;
}

// ═══════════════ 일간 뷰 ═══════════════

function _schDayView(today) {
  const s = _scheduleState;
  const ds = _schFmtDate(s.day);
  const isToday = ds === today;
  const dayEvents = s.events.filter(e => (e.scheduled_date || e.requested_date) === ds);

  // 시간순 정렬 (미정은 맨 뒤)
  dayEvents.sort((a, b) => {
    const ta = a.scheduled_time || 'ZZ';
    const tb = b.scheduled_time || 'ZZ';
    return ta.localeCompare(tb);
  });

  const dayOfWeek = ['일','월','화','수','목','금','토'][s.day.getDay()];
  let html = `<div class="text-center mb-4">
    <span class="text-2xl font-bold ${isToday ? 'text-blue-600' : 'text-gray-800'}">${s.day.getDate()}</span>
    <span class="text-sm text-gray-500 ml-2">${dayOfWeek}요일</span>
    ${isToday ? '<span class="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">오늘</span>' : ''}
    <span class="ml-2 text-sm text-gray-400">${dayEvents.length}건</span>
  </div>`;

  if (dayEvents.length === 0) {
    html += `<div class="text-center py-16 text-gray-400">
      <i class="fas fa-calendar-xmark text-4xl mb-3 text-gray-300"></i>
      <p>이 날은 예정된 일정이 없습니다.</p>
    </div>`;
  } else {
    html += _schDayEventList(ds, dayEvents);
  }

  return html;
}

function _schDayEventList(dateStr, events, title) {
  let html = '';
  if (title) {
    html += `<div class="mt-6 mb-3 flex items-center gap-2">
      <span class="font-semibold text-sm text-gray-700"><i class="fas fa-calendar-day mr-1"></i>${title}</span>
      <span class="text-xs text-gray-400">${events.length}건</span>
    </div>`;
  }
  html += `<div class="space-y-2">`;
  events.forEach(e => {
    const c = _SCH_STATUS_COLORS[e.status] || { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
    const time = e.scheduled_time ? e.scheduled_time.slice(0, 5) : '미정';
    const statusLabel = OMS.STATUS[e.status]?.label || e.status;

    html += `
    <div class="flex items-stretch bg-white rounded-xl border border-gray-200 hover:shadow-md transition overflow-hidden cursor-pointer"
         onclick="showOrderDetailDrawer(${e.order_id})">
      <div class="w-1.5 ${c.dot.replace('bg-', 'bg-')} flex-shrink-0"></div>
      <div class="flex-1 p-3 min-w-0">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center gap-2 min-w-0">
            <span class="font-mono text-lg font-bold ${time === '미정' ? 'text-gray-300' : 'text-gray-800'}">${time}</span>
            <span class="font-semibold text-gray-800 truncate">${escapeHtml(e.customer_name || '-')}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text}">${statusLabel}</span>
          </div>
          <span class="text-sm font-medium text-blue-600 flex-shrink-0">${typeof formatAmount === 'function' ? formatAmount(e.base_amount) : (e.base_amount || 0).toLocaleString() + '원'}</span>
        </div>
        <div class="text-sm text-gray-500 truncate mb-1.5">${escapeHtml(e.address_text || '-')}</div>
        <div class="flex items-center gap-2 text-[10px] text-gray-400 flex-wrap">
          ${e.channel_name ? `<span class="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600"><i class="fas fa-satellite-dish mr-0.5"></i>${escapeHtml(e.channel_name)}</span>` : ''}
          ${''}
          ${e.team_leader_name ? `<span><i class="fas fa-user mr-0.5"></i>${escapeHtml(e.team_leader_name)}</span>` : ''}
          ${e.region_name ? `<span><i class="fas fa-map-marker-alt mr-0.5"></i>${escapeHtml(e.region_name)}</span>` : ''}
          <span class="ml-auto text-gray-300">#${e.order_id}</span>
        </div>
      </div>
      <div class="flex flex-col gap-1 p-2 border-l border-gray-100 justify-center flex-shrink-0" onclick="event.stopPropagation()">
        ${e.status === 'ASSIGNED' ? `<button onclick="readyDone(${e.order_id})" class="px-2 py-1 bg-violet-600 text-white rounded text-[10px] hover:bg-violet-700 whitespace-nowrap"><i class="fas fa-phone-volume mr-0.5"></i>준비완료</button>` : ''}
        ${e.status === 'READY_DONE' ? `<button onclick="startWork(${e.order_id})" class="px-2 py-1 bg-orange-600 text-white rounded text-[10px] hover:bg-orange-700 whitespace-nowrap"><i class="fas fa-play mr-0.5"></i>작업시작</button>` : ''}
        ${!e.scheduled_time && ['ASSIGNED','READY_DONE'].includes(e.status) ? `<button onclick="_schSetTime(${e.order_id})" class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] hover:bg-gray-200 whitespace-nowrap"><i class="fas fa-clock mr-0.5"></i>시간설정</button>` : ''}
      </div>
    </div>`;
  });
  html += `</div>`;
  return html;
}

// ─── 빠른 시간 설정 ───
function _schSetTime(orderId) {
  const content = `
    <div class="space-y-3">
      <p class="text-sm text-gray-600">방문 시간을 설정하세요.</p>
      <div>
        <label class="block text-xs text-gray-500 mb-1">시간</label>
        <input id="sch-set-time" type="time" step="1800" class="w-full border rounded-lg px-3 py-2 text-sm">
      </div>
      <div class="flex flex-wrap gap-1.5" id="sch-quick-btns">
        ${['09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00'].map(t =>
          `<button type="button" onclick="document.getElementById('sch-set-time').value='${t}';document.querySelectorAll('#sch-quick-btns button').forEach(b=>b.classList.remove('bg-violet-600','text-white'));this.classList.add('bg-violet-600','text-white')" class="px-2.5 py-1 border rounded-md text-xs hover:bg-violet-50 transition">${t}</button>`
        ).join('')}
      </div>
    </div>`;
  showModal(`시간 설정 — 주문 #${orderId}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="_schSaveTime(${orderId})" class="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm">저장</button>`);
}

async function _schSaveTime(orderId) {
  const time = document.getElementById('sch-set-time')?.value;
  if (!time) { showToast('시간을 선택해주세요.', 'warning'); return; }

  try {
    // 현재 이벤트에서 날짜 찾기
    const ev = _scheduleState.events.find(e => e.order_id === orderId);
    const date = ev?.scheduled_date || ev?.requested_date || _schFmtDate(new Date());
    const res = await api('PATCH', `/orders/schedule/${orderId}`, { scheduled_date: date, scheduled_time: time });
    if (res?.ok) {
      showToast(`시간 설정: ${time}`, 'success');
      closeModal();
      const el = document.getElementById('content');
      if (el) await renderSchedule(el);
    } else showToast(res?.error || '실패', 'error');
  } catch (e) { showToast('오류: ' + (e.message || e), 'error'); }
}

// ─── 네비게이션 ───
function _schPrev() {
  const s = _scheduleState;
  if (s.view === 'month') {
    s.month--;
    if (s.month < 0) { s.month = 11; s.year--; }
  } else if (s.view === 'week') {
    s.weekStart.setDate(s.weekStart.getDate() - 7);
  } else {
    s.day.setDate(s.day.getDate() - 1);
  }
  _schRefresh();
}

function _schNext() {
  const s = _scheduleState;
  if (s.view === 'month') {
    s.month++;
    if (s.month > 11) { s.month = 0; s.year++; }
  } else if (s.view === 'week') {
    s.weekStart.setDate(s.weekStart.getDate() + 7);
  } else {
    s.day.setDate(s.day.getDate() + 1);
  }
  _schRefresh();
}

function _schToday() {
  const now = new Date();
  _scheduleState.year = now.getFullYear();
  _scheduleState.month = now.getMonth();
  _scheduleState.weekStart = _schGetWeekStart(now);
  _scheduleState.day = new Date(now);
  _schRefresh();
}

function _schSwitchView(view) {
  const s = _scheduleState;
  s.view = view;
  if (view === 'week' && !s.weekStart) s.weekStart = _schGetWeekStart(new Date());
  if (view === 'day' && !s.day) s.day = new Date();
  _schRefresh();
}

function _schClickDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  _scheduleState.day = d;
  _scheduleState.view = 'day';
  _schRefresh();
}

function _schGetWeekStart(d) {
  const start = new Date(d);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function _schWeekTitle() {
  const s = _scheduleState;
  const start = new Date(s.weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.getMonth() + 1}/${start.getDate()} ~ ${end.getMonth() + 1}/${end.getDate()}`;
}

function _schDayTitle() {
  const s = _scheduleState;
  const dayOfWeek = ['일','월','화','수','목','금','토'][s.day.getDay()];
  return `${s.day.getFullYear()}년 ${s.day.getMonth() + 1}월 ${s.day.getDate()}일 (${dayOfWeek})`;
}

async function _schRefresh() {
  const el = document.getElementById('content');
  if (el) await renderSchedule(el);
}
