// ============================================================
// 와이비 OMS - 팀장 뷰 (내 주문 + 내 현황) v7.0
// Interaction Design: 카드 드릴다운, 컨텍스트메뉴, 호버프리뷰,
// 드로어 상세, 보고서 위자드 스텝
// ============================================================

// ════════ 내 주문 ════════
async function renderMyOrders(el) {
  try {
  showSkeletonLoading(el, 'cards');
  const params = new URLSearchParams(window._myOrderFilters || {});
  if (!params.has('limit')) params.set('limit', '20');
  const res = await api('GET', `/orders?${params.toString()}`);
  const orders = res?.orders || [];

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-list mr-2 text-green-600"></i>내 주문</h2>

      <!-- 상태별 카드 (드릴다운) -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        ${[
          { status: '', label: '전체', icon: 'fa-list', color: 'gray', count: res?.total || 0 },
          { status: 'ASSIGNED', label: '준비', icon: 'fa-user-check', color: 'purple' },
          { status: 'READY_DONE', label: '준비완료', icon: 'fa-phone-volume', color: 'violet' },
          { status: 'IN_PROGRESS', label: '수행중', icon: 'fa-wrench', color: 'orange' },
          { status: 'SUBMITTED,DONE', label: '완료', icon: 'fa-file-lines', color: 'cyan' },
          { status: 'REGION_REJECTED,HQ_REJECTED', label: '반려', icon: 'fa-times-circle', color: 'red' },
        ].map(c => {
          const count = c.count !== undefined ? c.count : orders.filter(o => c.status.split(',').includes(o.status)).length;
          const active = params.get('status') === c.status;
          return `
          <div class="ix-card card bg-white rounded-xl p-4 border ${active ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-100'} text-center"
               onclick="window._myOrderFilters={status:'${c.status}',page:1};renderContent()"
               data-tooltip="${c.label} 주문 목록 보기">
            <i class="fas ${c.icon} text-${c.color}-500 text-lg mb-1"></i>
            <div class="text-2xl font-bold ix-count-animate">${count}</div>
            <div class="text-xs text-gray-500">${c.label}</div>
          </div>`;
        }).join('')}
      </div>

      <!-- 주문 목록 -->
      <div class="space-y-3">
        ${orders.map(o => `
          <div class="ix-card bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition"
               onclick="showOrderDetailDrawer(${o.order_id})"
               oncontextmenu="showMyOrderContextMenu(event, ${JSON.stringify(o).replace(/"/g, '&quot;')})"
               data-preview="order" data-preview-id="${o.order_id}" data-preview-title="주문 #${o.order_id}">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-3">
                <span class="font-mono text-gray-400 text-xs">#${o.order_id}</span>
                <span class="font-bold">${o.customer_name || '-'}</span>
                ${statusBadge(o.status)}
              </div>
              <span class="font-medium text-blue-600">${formatAmount(o.base_amount)}</span>
            </div>
            <div class="text-sm text-gray-500 mb-2">${o.address_text || '-'}</div>
            <div class="flex items-center gap-1.5 mb-2 flex-wrap">
              ${o.channel_name ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium"><i class="fas fa-satellite-dish mr-0.5"></i>${o.channel_name}</span>` : ''}
              ${o.service_type && o.service_type !== 'DEFAULT' ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600"><i class="fas ${OMS.SERVICE_TYPES[o.service_type]?.icon || 'fa-question'} mr-0.5"></i>${OMS.SERVICE_TYPES[o.service_type]?.label || o.service_type}</span>` : ''}
            </div>
            ${_renderStatusProgress(o.status)}
            <div class="flex flex-wrap gap-2 mt-3" onclick="event.stopPropagation()">
              <button onclick="showOrderDetailDrawer(${o.order_id})" class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200 transition" data-tooltip="드로어에서 상세 보기">
                <i class="fas fa-eye mr-1"></i>상세
              </button>
              ${o.status === 'ASSIGNED' ? `
                <button onclick="readyDone(${o.order_id})" class="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs hover:bg-violet-700 transition" data-tooltip="고객통화 후 일정 확정">
                  <i class="fas fa-phone-volume mr-1"></i>준비완료
                </button>` : ''}
              ${o.status === 'READY_DONE' ? `
                <button onclick="startWork(${o.order_id})" class="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs hover:bg-orange-700 transition" data-tooltip="작업을 시작합니다">
                  <i class="fas fa-play mr-1"></i>작업시작
                </button>` : ''}
              ${['IN_PROGRESS', 'REGION_REJECTED', 'HQ_REJECTED'].includes(o.status) ? `
                <button onclick="showReportModal(${o.order_id})" class="px-3 py-1.5 ${o.status.includes('REJECTED') ? 'bg-amber-600 hover:bg-amber-700' : 'bg-cyan-600 hover:bg-cyan-700'} text-white rounded-lg text-xs transition" data-tooltip="${o.status.includes('REJECTED') ? '반려된 보고서를 재제출합니다' : '보고서를 제출합니다'}">
                  <i class="fas ${o.status.includes('REJECTED') ? 'fa-rotate-right' : 'fa-file-pen'} mr-1"></i>${o.status.includes('REJECTED') ? '보고서 재제출' : '보고서 제출'}
                </button>` : ''}}
              ${o.status === 'SUBMITTED' ? `
                <button onclick="completeOrder(${o.order_id})" class="px-3 py-1.5 bg-sky-600 text-white rounded-lg text-xs hover:bg-sky-700 transition" data-tooltip="영수증 첨부 후 최종완료">
                  <i class="fas fa-receipt mr-1"></i>최종완료
                </button>` : ''}
              ${o.status === 'DONE' ? `
                <span class="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs border border-amber-200">
                  <i class="fas fa-clock mr-1"></i>검수 대기중
                </span>` : ''}
              <button onclick="event.stopPropagation();showMyOrderContextMenu(event, ${JSON.stringify(o).replace(/"/g, '&quot;')})" 
                class="ml-auto w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition" data-tooltip="더보기">
                <i class="fas fa-ellipsis-vertical"></i>
              </button>
            </div>
          </div>
        `).join('')}
        ${orders.length === 0 ? '<div class="bg-white rounded-xl p-8 text-center text-gray-400 border"><i class="fas fa-inbox text-4xl mb-3"></i><p>주문이 없습니다.</p></div>' : ''}
      </div>
    </div>`;

  } catch (e) {
  console.error('[renderMyOrders]', e);
  el.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1 text-gray-400">' + (e.message||e) + '</p></div>';
  }
}

// ─── 내 주문 컨텍스트 메뉴 ───
function showMyOrderContextMenu(event, order) {
  event.preventDefault();
  event.stopPropagation();
  const o = typeof order === 'string' ? JSON.parse(order) : order;

  const items = [
    { icon: 'fa-eye', label: '드로어에서 상세 보기', action: () => showOrderDetailDrawer(o.order_id) },
    { icon: 'fa-expand', label: '모달에서 상세 보기', action: () => showOrderDetail(o.order_id) },
    { divider: true },
  ];

  if (o.status === 'ASSIGNED') {
    items.push({ icon: 'fa-phone-volume', label: '준비완료 (일정확정)', action: () => readyDone(o.order_id) });
  }
  if (o.status === 'READY_DONE') {
    items.push({ icon: 'fa-play', label: '작업 시작', action: () => startWork(o.order_id) });
  }
  if (['IN_PROGRESS', 'REGION_REJECTED', 'HQ_REJECTED'].includes(o.status)) {
    items.push({ icon: o.status.includes('REJECTED') ? 'fa-rotate-right' : 'fa-file-pen', label: o.status.includes('REJECTED') ? '보고서 재제출' : '보고서 제출', action: () => showReportModal(o.order_id) });
  }
  if (o.status === 'SUBMITTED') {
    items.push({ icon: 'fa-receipt', label: '최종완료 (영수증)', action: () => completeOrder(o.order_id) });
  }

  items.push(
    { divider: true },
    { icon: 'fa-clock-rotate-left', label: '상태 이력', action: () => showOrderHistoryDrawer(o.order_id) },
    { icon: 'fa-scroll', label: '감사 로그', action: () => showOrderAuditDrawer(o.order_id) }
  );

  showContextMenu(event.clientX, event.clientY, items, { title: `주문 #${o.order_id} — ${o.customer_name || ''}` });
}

async function startWork(orderId) {
  try {
  showConfirmModal('작업 시작', `주문 #${orderId}의 작업을 시작하시겠습니까?`,
    async () => {
      const res = await api('POST', `/orders/${orderId}/start`);
      if (res?.ok) { showToast('작업 시작!', 'success'); renderContent(); }
      else showToast(res?.error || '실패', 'error');
    }, '시작', 'bg-orange-600');

  } catch (e) {
  console.error('[startWork]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ─── 준비완료 (ASSIGNED → READY_DONE) ───
function readyDone(orderId) {
  const content = `
    <div class="space-y-4">
      <p class="text-sm text-gray-600">고객 통화 후 방문 일정을 확정하세요.</p>
      <div>
        <label class="block text-xs text-gray-500 mb-1">방문 예정일</label>
        <input id="ready-done-date" type="date" class="w-full border rounded-lg px-3 py-2 text-sm" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">메모 (선택)</label>
        <textarea id="ready-done-note" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="고객 요청사항 등..."></textarea>
      </div>
    </div>`;
  showModal(`준비완료 — 주문 #${orderId}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitReadyDone(${orderId})" class="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm">확정</button>`);
}

async function submitReadyDone(orderId) {
  try {
  const scheduledDate = document.getElementById('ready-done-date')?.value || '';
  const note = document.getElementById('ready-done-note')?.value || '';
  if (!scheduledDate) {
    showToast('방문 예정일을 선택해주세요.', 'warning');
    return;
  }
  const res = await api('POST', `/orders/${orderId}/ready-done`, {
    scheduled_date: scheduledDate, note: note || '고객 통화 후 일정 확정'
  });
  if (res?.ok) {
    showToast('준비완료! 일정: ' + (scheduledDate || '-'), 'success');
    closeModal();
    renderContent();
  } else showToast(res?.error || '실패', 'error');

  } catch (e) {
  console.error('[submitReadyDone]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ─── 최종완료 (SUBMITTED → DONE: 영수증 첨부) ───
function completeOrder(orderId) {
  const content = `
    <div class="space-y-4">
      <p class="text-sm text-gray-600">영수증을 촬영하거나 갤러리에서 선택하면 최종완료 처리됩니다.</p>
      
      <!-- 영수증 사진 첨부 -->
      <div>
        <label class="block text-xs text-gray-500 mb-2">영수증 사진 (선택)</label>
        <div id="receipt-preview-area" class="mb-2"></div>
        <div class="flex gap-2">
          <label class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-sky-50 border-2 border-dashed border-sky-300 rounded-lg cursor-pointer hover:bg-sky-100 transition">
            <i class="fas fa-camera text-sky-600"></i>
            <span class="text-sm text-sky-700 font-medium">카메라 촬영</span>
            <input type="file" accept="image/*" capture="environment" class="hidden"
              onchange="handleFileAttach(this, 'receipt-preview-area', 'RECEIPT')">
          </label>
          <label class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition">
            <i class="fas fa-images text-gray-600"></i>
            <span class="text-sm text-gray-700 font-medium">갤러리</span>
            <input type="file" accept="image/*" class="hidden"
              onchange="handleFileAttach(this, 'receipt-preview-area', 'RECEIPT')">
          </label>
        </div>
      </div>

      <div>
        <label class="block text-xs text-gray-500 mb-1">메모 (선택)</label>
        <textarea id="complete-note" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="추가 메모..."></textarea>
      </div>
    </div>`;
  showModal(`최종완료 — 주문 #${orderId}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitComplete(${orderId})" class="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm">최종완료</button>`);
}

async function submitComplete(orderId) {
  try {
  const note = document.getElementById('complete-note')?.value || '';
  const receiptFile = window._attachedFiles?.['RECEIPT'];
  
  const payload = { note: note || '최종완료' };
  if (receiptFile) {
    payload.receipt_url = receiptFile.dataUrl;
    payload.file_name = receiptFile.fileName;
    payload.file_size = receiptFile.fileSize;
    payload.mime_type = receiptFile.mimeType;
  }
  
  const res = await api('POST', `/orders/${orderId}/complete`, payload);
  if (res?.ok) {
    showToast('최종완료! 검수 단계로 이동합니다.', 'success');
    window._attachedFiles = {};
    closeModal();
    renderContent();
  } else showToast(res?.error || '실패', 'error');

  } catch (e) {
  console.error('[submitComplete]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

function showReportModal(orderId) {
  // 첨부 파일 임시 저장소 초기화
  window._attachedFiles = {};

  const content = `
    <form id="report-form" class="space-y-4">
      <div>
        <h4 class="font-semibold mb-2"><i class="fas fa-clipboard-list mr-1 text-cyan-500"></i>체크리스트 + 사진 첨부</h4>
        <p class="text-xs text-gray-400 mb-3">각 항목의 사진을 촬영하거나 갤러리에서 선택하세요. 파일명은 자동 규칙화됩니다.</p>
        <div class="space-y-3">
          ${OMS.REPORT_CHECKLIST.map(item => `
            <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="checklist" value="${item.key}" 
                  class="w-4 h-4 rounded text-cyan-600" ${item.required ? '' : ''}>
                <i class="fas ${item.icon || 'fa-check'} text-gray-500 text-sm w-5 text-center"></i>
                <span class="text-sm font-medium">${item.label}</span>
                ${item.required ? '<span class="text-red-400 text-[10px] ml-auto">필수</span>' : '<span class="text-gray-300 text-[10px] ml-auto">선택</span>'}
              </label>
              <!-- 사진 첨부 영역 -->
              <div class="mt-2">
                <div id="preview-${item.key}" class="mb-2"></div>
                <div class="flex gap-2">
                  <label class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-cyan-50 hover:border-cyan-300 transition text-xs">
                    <i class="fas fa-camera text-cyan-600"></i>
                    <span class="text-gray-600">촬영</span>
                    <input type="file" accept="image/*" capture="environment" class="hidden"
                      onchange="handleFileAttach(this, 'preview-${item.key}', '${item.key.toUpperCase()}')">
                  </label>
                  <label class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition text-xs">
                    <i class="fas fa-images text-gray-500"></i>
                    <span class="text-gray-600">갤러리</span>
                    <input type="file" accept="image/*" class="hidden"
                      onchange="handleFileAttach(this, 'preview-${item.key}', '${item.key.toUpperCase()}')">
                  </label>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">작업 메모</label>
        <textarea id="report-note" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="작업 내용을 기록하세요..."></textarea>
      </div>
    </form>`;
  showModal(`보고서 제출 — 주문 #${orderId}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitReport(${orderId})" class="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm">제출</button>`, { large: true });
}

// ─── 파일 첨부 핸들러 (카메라/갤러리 공용) ───
function handleFileAttach(input, previewElId, category) {
  const file = input.files?.[0];
  if (!file) return;

  // 2MB 제한
  if (file.size > 2 * 1024 * 1024) {
    showToast('파일 크기는 2MB 이하여야 합니다. 사진을 다시 선택해주세요.', 'warning');
    input.value = '';
    return;
  }

  if (!file.type.startsWith('image/')) {
    showToast('이미지 파일만 첨부 가능합니다.', 'warning');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    const ext = file.name?.split('.').pop()?.toLowerCase() || 'jpg';
    
    // 파일명 자동 생성
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const userInfo = (typeof currentUser !== 'undefined' ? currentUser : null) || {};
    const teamCode = userInfo.org_code || userInfo.login_id || 'TEAM';
    const categoryLabels = {
      'EXTERIOR': '외부촬영', 'INTERIOR': '내부촬영',
      'BEFORE_WASH': '세척전', 'AFTER_WASH': '세척후',
      'RECEIPT': '영수증', 'CUSTOMER_CONFIRM': '고객확인',
      'EXTERIOR_PHOTO': '외부촬영', 'INTERIOR_PHOTO': '내부촬영',
      'ETC': '기타'
    };
    const catLabel = categoryLabels[category] || category;
    const fileName = `${today}_${teamCode}_${catLabel}.${ext}`;

    // 임시 저장
    if (!window._attachedFiles) window._attachedFiles = {};
    window._attachedFiles[category] = {
      dataUrl,
      fileName,
      fileSize: file.size,
      mimeType: file.type,
      category,
    };

    // 미리보기 표시
    const previewEl = document.getElementById(previewElId);
    if (previewEl) {
      previewEl.innerHTML = `
        <div class="relative inline-block">
          <img src="${dataUrl}" class="w-20 h-20 object-cover rounded-lg border-2 border-cyan-300 shadow-sm">
          <button type="button" onclick="removeAttachedFile('${category}', '${previewElId}')"
            class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center hover:bg-red-600 shadow">
            <i class="fas fa-times"></i>
          </button>
          <div class="text-[10px] text-gray-500 mt-1 max-w-[80px] truncate" title="${fileName}">${fileName}</div>
        </div>`;
    }

    // 체크리스트 자동 체크
    const checkbox = document.querySelector(`input[name="checklist"][value="${category.toLowerCase()}"]`)
      || document.querySelector(`input[name="checklist"][value="${category}"]`);
    if (checkbox) checkbox.checked = true;
  };
  reader.readAsDataURL(file);
}

function removeAttachedFile(category, previewElId) {
  if (window._attachedFiles) delete window._attachedFiles[category];
  const previewEl = document.getElementById(previewElId);
  if (previewEl) previewEl.innerHTML = '';
}

async function submitReport(orderId) {
  try {
  const checks = Array.from(document.querySelectorAll('input[name="checklist"]:checked')).map(el => el.value);
  const note = document.getElementById('report-note')?.value || '';

  // 필수 체크리스트 검증
  const requiredItems = OMS.REPORT_CHECKLIST.filter(i => i.required).map(i => i.key);
  const missingRequired = requiredItems.filter(k => !checks.includes(k));
  if (missingRequired.length > 0) {
    const labels = missingRequired.map(k => OMS.REPORT_CHECKLIST.find(i => i.key === k)?.label || k);
    showToast(`필수 항목을 완료해주세요: ${labels.join(', ')}`, 'warning');
    return;
  }

  // 첨부 파일 수집
  const photos = [];
  const files = window._attachedFiles || {};
  for (const [cat, fileInfo] of Object.entries(files)) {
    photos.push({
      category: cat,
      file_url: fileInfo.dataUrl,
      file_name: fileInfo.fileName,
      file_size: fileInfo.fileSize,
      mime_type: fileInfo.mimeType,
    });
  }

  const checklist = {};
  checks.forEach(c => { checklist[c] = true; });

  const res = await api('POST', `/orders/${orderId}/reports`, { checklist, note, photos });
  if (res?.ok) {
    showToast(`보고서 v${res.version} 제출 완료`, 'success');
    window._attachedFiles = {};
    closeModal();
    renderContent();
  } else showToast(res?.error || '제출 실패', 'error');

  } catch (e) {
  console.error('[submitReport]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ════════ 내 프로필 (계정정보 + 비밀번호 + 알림설정) ════════
async function renderMyProfile(el) {
  try {
  // 알림 설정 동시 로드
  const prefsRes = await api('GET', '/notifications/preferences');
  const prefs = prefsRes?.preferences || {};

  const notifTypes = [
    { key: 'notify_order_status', label: '주문 상태 변경', icon: 'fa-truck-fast', desc: '주문이 접수/배분/배정/완료될 때' },
    { key: 'notify_assignment',   label: '배정/배정해제',   icon: 'fa-user-check', desc: '내게 주문이 배정되거나 해제될 때' },
    { key: 'notify_review',       label: '검수 결과',       icon: 'fa-clipboard-check', desc: '보고서 승인/반려 시' },
    { key: 'notify_settlement',   label: '정산 관련',       icon: 'fa-coins', desc: '정산 확정, 지급 처리 시' },
    { key: 'notify_signup',       label: '가입 요청/승인',  icon: 'fa-user-plus', desc: '팀장 가입 요청 및 승인 결과' },
    { key: 'notify_system',       label: '시스템 공지',     icon: 'fa-bullhorn', desc: '시스템 점검, 업데이트 안내' },
  ];

  const methodTypes = [
    { key: 'push_enabled',  label: '인앱 알림', icon: 'fa-bell', desc: '앱 내 알림 표시' },
    { key: 'sound_enabled', label: '알림 소리', icon: 'fa-volume-high', desc: '알림 시 소리 재생' },
  ];

  el.innerHTML = `
    <div class="fade-in max-w-xl mx-auto">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-user-cog mr-2 text-gray-600"></i>내 프로필</h2>
      
      <!-- 탭 네비게이션 -->
      <div class="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        <button onclick="switchProfileTab('account')" id="tab-account" class="profile-tab flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition bg-white text-blue-600 shadow-sm">
          <i class="fas fa-id-card mr-1.5"></i>계정
        </button>
        <button onclick="switchProfileTab('password')" id="tab-password" class="profile-tab flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition text-gray-500 hover:text-gray-700">
          <i class="fas fa-key mr-1.5"></i>비밀번호
        </button>
        <button onclick="switchProfileTab('notifications')" id="tab-notifications" class="profile-tab flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition text-gray-500 hover:text-gray-700">
          <i class="fas fa-bell mr-1.5"></i>알림
        </button>
      </div>

      <!-- 계정 정보 탭 -->
      <div id="panel-account" class="profile-panel">
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <h3 class="font-semibold mb-4"><i class="fas fa-id-card mr-2 text-blue-500"></i>계정 정보</h3>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div><span class="text-gray-500">이름</span><div class="font-medium">${currentUser.name}</div></div>
            <div><span class="text-gray-500">로그인 ID</span><div class="font-mono">${currentUser.login_id}</div></div>
            <div><span class="text-gray-500">소속</span><div>${currentUser.org_name || currentUser.org_type}</div></div>
            <div><span class="text-gray-500">역할</span><div>${currentUser.roles.map(r => {
              const rl = typeof ROLE_LABELS !== 'undefined' ? ROLE_LABELS[r] : r;
              return '<span class="status-badge bg-gray-100 text-gray-700 text-xs">' + (rl || r) + '</span>';
            }).join(' ')}</div></div>
          </div>
        </div>
      </div>

      <!-- 비밀번호 변경 탭 -->
      <div id="panel-password" class="profile-panel hidden">
        <div class="bg-white rounded-xl p-6 border border-gray-100">
          <h3 class="font-semibold mb-4"><i class="fas fa-key mr-2 text-amber-500"></i>비밀번호 변경</h3>
          <form id="pw-change-form" class="space-y-4">
            <div><label class="block text-xs text-gray-500 mb-1">현재 비밀번호</label>
              <input id="pw-current" type="password" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="현재 비밀번호"></div>
            <div><label class="block text-xs text-gray-500 mb-1">새 비밀번호</label>
              <input id="pw-new" type="password" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="새 비밀번호 (6자 이상)" minlength="6"></div>
            <div><label class="block text-xs text-gray-500 mb-1">새 비밀번호 확인</label>
              <input id="pw-confirm" type="password" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="새 비밀번호 재입력"></div>
            <button type="button" onclick="submitPasswordChange()" class="w-full px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              <i class="fas fa-save mr-1"></i>비밀번호 변경
            </button>
          </form>
        </div>
      </div>

      <!-- 알림 설정 탭 -->
      <div id="panel-notifications" class="profile-panel hidden">
        <!-- 알림 유형별 설정 -->
        <div class="bg-white rounded-xl p-6 border border-gray-100 mb-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold"><i class="fas fa-sliders mr-2 text-indigo-500"></i>알림 유형</h3>
            <button onclick="toggleAllNotifPrefs(true)" class="text-xs text-blue-600 hover:underline">전체 켜기</button>
          </div>
          <div class="space-y-1" id="notif-type-list">
            ${notifTypes.map(t => `
              <label class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition group">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg bg-${prefs[t.key] ? 'blue' : 'gray'}-50 flex items-center justify-center transition notif-icon-${t.key}">
                    <i class="fas ${t.icon} text-${prefs[t.key] ? 'blue' : 'gray'}-400 text-sm"></i>
                  </div>
                  <div>
                    <div class="text-sm font-medium text-gray-800">${t.label}</div>
                    <div class="text-xs text-gray-400">${t.desc}</div>
                  </div>
                </div>
                <div class="relative">
                  <input type="checkbox" class="notif-pref-toggle sr-only" data-key="${t.key}" 
                         ${prefs[t.key] ? 'checked' : ''} onchange="updateNotifPref('${t.key}', this.checked)">
                  <div class="w-11 h-6 rounded-full transition ${prefs[t.key] ? 'bg-blue-500' : 'bg-gray-200'} notif-track-${t.key}"></div>
                  <div class="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs[t.key] ? 'translate-x-5' : ''} notif-knob-${t.key}"></div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- 알림 수단 설정 -->
        <div class="bg-white rounded-xl p-6 border border-gray-100 mb-4">
          <h3 class="font-semibold mb-4"><i class="fas fa-paper-plane mr-2 text-emerald-500"></i>알림 수단</h3>
          <div class="space-y-1">
            ${methodTypes.map(t => `
              <label class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition group">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg bg-${prefs[t.key] ? 'emerald' : 'gray'}-50 flex items-center justify-center transition notif-icon-${t.key}">
                    <i class="fas ${t.icon} text-${prefs[t.key] ? 'emerald' : 'gray'}-400 text-sm"></i>
                  </div>
                  <div>
                    <div class="text-sm font-medium text-gray-800">${t.label}</div>
                    <div class="text-xs text-gray-400">${t.desc}</div>
                  </div>
                </div>
                <div class="relative">
                  <input type="checkbox" class="notif-pref-toggle sr-only" data-key="${t.key}"
                         ${prefs[t.key] ? 'checked' : ''} onchange="updateNotifPref('${t.key}', this.checked)">
                  <div class="w-11 h-6 rounded-full transition ${prefs[t.key] ? 'bg-emerald-500' : 'bg-gray-200'} notif-track-${t.key}"></div>
                  <div class="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs[t.key] ? 'translate-x-5' : ''} notif-knob-${t.key}"></div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- 안내 -->
        <div class="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700">
          <i class="fas fa-info-circle mr-1"></i>
          알림 설정은 실시간으로 저장됩니다. 비활성화한 유형의 알림은 더 이상 수신되지 않습니다.
        </div>
      </div>
    </div>`;

  } catch (e) {
  console.error('[renderMyProfile]', e);
  el.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1 text-gray-400">' + (e.message||e) + '</p></div>';
  }
}

// ─── 프로필 탭 전환 ───
function switchProfileTab(tab) {
  document.querySelectorAll('.profile-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.profile-tab').forEach(t => {
    t.classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
    t.classList.add('text-gray-500');
  });
  const panel = document.getElementById('panel-' + tab);
  const tabBtn = document.getElementById('tab-' + tab);
  if (panel) panel.classList.remove('hidden');
  if (tabBtn) {
    tabBtn.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
    tabBtn.classList.remove('text-gray-500');
  }
}

// ─── 알림 설정 개별 업데이트 ───
async function updateNotifPref(key, enabled) {
  try {
  const body = {};
  body[key] = enabled;

  // 즉시 UI 반영 (토글 애니메이션)
  const track = document.querySelector('.notif-track-' + key);
  const knob = document.querySelector('.notif-knob-' + key);
  const iconWrap = document.querySelector('.notif-icon-' + key);
  if (track) {
    track.classList.toggle('bg-blue-500', enabled && key.startsWith('notify_'));
    track.classList.toggle('bg-emerald-500', enabled && !key.startsWith('notify_'));
    track.classList.toggle('bg-gray-200', !enabled);
  }
  if (knob) knob.classList.toggle('translate-x-5', enabled);
  if (iconWrap) {
    const isMethod = !key.startsWith('notify_');
    iconWrap.className = iconWrap.className.replace(/bg-\w+-50/g, enabled ? (isMethod ? 'bg-emerald-50' : 'bg-blue-50') : 'bg-gray-50');
    const icon = iconWrap.querySelector('i');
    if (icon) icon.className = icon.className.replace(/text-\w+-400/g, enabled ? (isMethod ? 'text-emerald-400' : 'text-blue-400') : 'text-gray-400');
  }

  const res = await api('PUT', '/notifications/preferences', body);
  if (!res?.ok) {
    showToast('알림 설정 저장 실패', 'error');
    // 롤백
    if (track) {
      track.classList.toggle('bg-blue-500', !enabled && key.startsWith('notify_'));
      track.classList.toggle('bg-emerald-500', !enabled && !key.startsWith('notify_'));
      track.classList.toggle('bg-gray-200', enabled);
    }
    if (knob) knob.classList.toggle('translate-x-5', !enabled);
  }

  } catch (e) {
  console.error('[updateNotifPref]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ─── 전체 알림 켜기/끄기 ───
async function toggleAllNotifPrefs(enabled) {
  try {
  const body = {
    notify_order_status: enabled, notify_assignment: enabled,
    notify_review: enabled, notify_settlement: enabled,
    notify_signup: enabled, notify_system: enabled,
  };
  const res = await api('PUT', '/notifications/preferences', body);
  if (res?.ok) {
    showToast(enabled ? '모든 알림이 활성화되었습니다.' : '모든 알림이 비활성화되었습니다.', 'success');
    renderContent(); // 리렌더
  } else showToast('설정 저장 실패', 'error');

  } catch (e) {
  console.error('[toggleAllNotifPrefs]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

async function submitPasswordChange() {
  try {
  const current = document.getElementById('pw-current').value;
  const newPw = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;
  if (!current || !newPw) return showToast('모든 필드를 입력하세요.', 'warning');
  if (newPw !== confirm) return showToast('새 비밀번호가 일치하지 않습니다.', 'error');
  if (newPw.length < 6) return showToast('비밀번호는 6자 이상이어야 합니다.', 'warning');

  const res = await api('POST', '/hr/users/change-password', { current_password: current, new_password: newPw });
  if (res?.ok) {
    showToast('비밀번호가 변경되었습니다.', 'success');
    document.getElementById('pw-current').value = '';
    document.getElementById('pw-new').value = '';
    document.getElementById('pw-confirm').value = '';
  } else showToast(res?.error || '변경 실패', 'error');

  } catch (e) {
  console.error('[submitPasswordChange]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ════════ 내 현황 ════════
async function renderMyStats(el) {
  try {
  showSkeletonLoading(el, 'cards');
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const [statsRes, ledgerRes, funnelRes] = await Promise.all([
    api('GET', `/stats/team-leaders/daily?from=${weekAgo}&to=${today}`),
    api('GET', `/settlements/ledger?from=${weekAgo}&to=${today}`),
    api('GET', '/orders/stats/funnel'),
  ]);

  const stats = statsRes?.stats || [];
  const ledger = ledgerRes?.ledger || [];
  const funnel = funnelRes?.funnel || [];

  // 합산
  const totals = stats.reduce((acc, s) => ({
    intake: acc.intake + (s.intake_count || 0),
    submitted: acc.submitted + (s.submitted_count || 0),
    approved: acc.approved + (s.hq_approved_count || 0),
    settled: acc.settled + (s.settlement_confirmed_count || 0),
    payable: acc.payable + (s.payable_amount_sum || 0),
  }), { intake: 0, submitted: 0, approved: 0, settled: 0, payable: 0 });

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-chart-line mr-2 text-green-600"></i>내 현황</h2>

      <!-- 요약 카드 — 클릭 시 필터링 -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        ${[
          { label: '수임 건수', value: totals.intake, icon: 'fa-inbox', color: 'blue', filter: '' },
          { label: '제출 건수', value: totals.submitted, icon: 'fa-file-lines', color: 'cyan', filter: 'SUBMITTED' },
          { label: 'HQ승인', value: totals.approved, icon: 'fa-check-double', color: 'green', filter: 'HQ_APPROVED' },
          { label: '정산확정', value: totals.settled, icon: 'fa-coins', color: 'emerald', filter: 'SETTLEMENT_CONFIRMED' },
          { label: '예상지급액', value: formatAmount(totals.payable), icon: 'fa-won-sign', color: 'purple', isText: true, filter: '' },
        ].map(c => `
          <div class="ix-card card bg-white rounded-xl p-4 border border-gray-100 text-center"
               onclick="${c.filter ? `window._myOrderFilters={status:'${c.filter}'};navigateTo('my-orders')` : ''}"
               data-tooltip="${c.filter ? c.label + ' 주문 보기' : ''}">
            <div class="text-${c.isText ? 'xl' : '2xl'} font-bold text-${c.color}-600 ix-count-animate">${c.value}</div>
            <div class="text-xs text-gray-500">${c.label}</div>
          </div>
        `).join('')}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- 내 주문 퍼널 — 클릭 시 주문목록으로 이동 -->
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <h3 class="font-semibold mb-4"><i class="fas fa-filter mr-2 text-blue-500"></i>내 주문 상태 분포</h3>
          <div class="space-y-2">
            ${funnel.map(f => {
              const max = Math.max(...funnel.map(x => x.count), 1);
              const pct = (f.count / max * 100);
              const s = STATUS[f.status] || { label: f.status, color: 'bg-gray-100 text-gray-600' };
              return `
                <div class="ix-clickable flex items-center gap-3 rounded-lg p-1 -mx-1" 
                     onclick="window._myOrderFilters={status:'${f.status}'};navigateTo('my-orders')"
                     data-tooltip="${s.label}: ${f.count}건">
                  <div class="w-20 text-xs text-right text-gray-500">${s.label}</div>
                  <div class="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div class="h-full bg-blue-400 rounded-full flex items-center justify-end pr-2 transition-all duration-500" style="width:${Math.max(pct, 10)}%">
                      <span class="text-[10px] font-bold text-white">${f.count}</span>
                    </div>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>

        <!-- 일별 통계 -->
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <h3 class="font-semibold mb-4"><i class="fas fa-calendar-days mr-2 text-green-500"></i>일별 현황 (최근 7일)</h3>
          ${renderDataTable({
            columns: [
              { key: 'date', label: '날짜', render: s => `<span class="text-xs">${s.date}</span>` },
              { key: 'intake_count', label: '수임', align: 'right', render: s => s.intake_count || 0 },
              { key: 'submitted_count', label: '제출', align: 'right', render: s => s.submitted_count || 0 },
              { key: 'hq_approved_count', label: '승인', align: 'right', render: s => s.hq_approved_count || 0 },
              { key: 'payable_amount_sum', label: '지급액', align: 'right', render: s => `<span class="font-bold text-green-600">${formatAmount(s.payable_amount_sum)}</span>` },
            ],
            rows: stats,
            emptyText: '데이터 없음',
            caption: '일별 현황 (최근 7일)',
          })}
        </div>
      </div>

      ${ledger.length > 0 ? `
      <!-- 원장 -->
      <div class="bg-white rounded-xl p-5 border border-gray-100 mt-6">
        <h3 class="font-semibold mb-4"><i class="fas fa-wallet mr-2 text-amber-500"></i>정산 원장</h3>
        ${renderDataTable({
          columns: [
            { key: 'date', label: '날짜', render: l => `<span class="text-xs">${l.date}</span>` },
            { key: 'confirmed_count', label: '확정건수', align: 'right' },
            { key: 'confirmed_payable_sum', label: '확정지급액', align: 'right', render: l => `<span class="font-bold text-green-600">${formatAmount(l.confirmed_payable_sum)}</span>` },
            { key: 'transferred_amount', label: '전금액', align: 'right', render: l => formatAmount(l.transferred_amount) },
          ],
          rows: ledger,
          caption: '정산 원장',
        })}
      </div>` : ''}
    </div>`;

  } catch (e) {
  console.error('[renderMyStats]', e);
  el.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1 text-gray-400">' + (e.message||e) + '</p></div>';
  }
}
