// ============================================================
// 와이비 OMS - 검수(Review) 페이지 v7.0
// Interaction Design: 컨텍스트메뉴, 호버프리뷰, 배치검수,
// 키보드단축키, 빠른승인/반려, 스와이프 제스처 힌트
// ============================================================

// ─── 검수 선택 상태 ───
const reviewState = {
  selectedRegion: new Set(),
  selectedHQ: new Set(),
};

// ════════ 지역 1차 검수 ════════
async function renderReviewRegion(el) {
  showSkeletonLoading(el, 'cards');
  const res = await api('GET', '/orders?status=DONE&limit=100');
  const orders = res?.orders || [];

  // 없어진 주문 제거
  const currentIds = new Set(orders.map(o => o.order_id));
  for (const id of reviewState.selectedRegion) {
    if (!currentIds.has(id)) reviewState.selectedRegion.delete(id);
  }

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-clipboard-check mr-2 text-lime-600"></i>1차 검수 (지역총판)</h2>
        <div class="flex gap-2 items-center">
          ${reviewState.selectedRegion.size > 0 ? `
            <span class="text-sm text-purple-600 font-medium"><i class="fas fa-check-square mr-1"></i>${reviewState.selectedRegion.size}건 선택</span>
            <button onclick="batchReview('region','APPROVE')" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"><i class="fas fa-check-double mr-1"></i>일괄 승인</button>
            <button onclick="batchReview('region','REJECT')" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"><i class="fas fa-times mr-1"></i>일괄 반려</button>
            <button onclick="reviewState.selectedRegion.clear();renderContent()" class="px-3 py-2 bg-gray-100 text-gray-500 rounded-lg text-xs hover:bg-gray-200">해제</button>
          ` : ''}
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div class="flex items-center gap-4 text-sm text-gray-600">
          <span><i class="fas fa-check-double mr-1 text-sky-500"></i>최종완료 (검수대기): <strong class="text-sky-700">${orders.length}건</strong></span>
          <span class="text-gray-300">|</span>
          <span>검수 결과를 승인 또는 반려하세요.</span>
          <span class="ml-auto text-xs text-gray-400"><i class="fas fa-hand-pointer mr-1"></i>카드 클릭: 선택 · 우클릭: 액션 메뉴</span>
        </div>
      </div>

      <div class="grid gap-4">
        ${orders.map(o => {
          const sel = reviewState.selectedRegion.has(o.order_id);
          return `
          <div class="ix-card bg-white rounded-xl border ${sel ? 'border-purple-400 ring-2 ring-purple-200' : 'border-gray-100'} p-5 hover:shadow-md transition relative"
               onclick="toggleReviewSelect('region', ${o.order_id}, event)"
               oncontextmenu="showReviewCardContextMenu(event, ${JSON.stringify(o).replace(/"/g, '&quot;')}, 'region')"
               data-preview="order" data-preview-id="${o.order_id}" data-preview-title="주문 #${o.order_id}">
            ${sel ? '<div class="absolute top-3 right-3 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center"><i class="fas fa-check text-white text-xs"></i></div>' : ''}
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <span class="font-mono text-gray-400 text-sm">#${o.order_id}</span>
                <span class="font-bold">${o.customer_name || '-'}</span>
                ${statusBadge(o.status)}
              </div>
              <span class="font-medium text-blue-600">${formatAmount(o.base_amount)}</span>
            </div>
            <div class="text-sm text-gray-500 mb-3">${o.address_text || '-'}</div>
            <div class="flex items-center gap-2 text-xs text-gray-400 mb-4">
              <span><i class="fas fa-user mr-1"></i>팀장: ${o.team_leader_name || '-'}</span>
              <span>·</span>
              <span><i class="fas fa-calendar mr-1"></i>${o.requested_date || '-'}</span>
            </div>
            ${_renderStatusProgress(o.status)}
            <div class="flex gap-2 mt-4" onclick="event.stopPropagation()">
              <button onclick="showOrderDetailDrawer(${o.order_id})" class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition" data-tooltip="주문 상세 보기">
                <i class="fas fa-eye mr-1"></i>상세보기
              </button>
              <button onclick="quickApprove(${o.order_id},'region')" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition ix-review-approve" data-tooltip="빠른 승인 (코멘트 없이)">
                <i class="fas fa-check mr-1"></i>승인
              </button>
              <button onclick="showReviewModal(${o.order_id}, 'region', 'REJECT')" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition" data-tooltip="반려 사유와 함께 반려">
                <i class="fas fa-times mr-1"></i>반려
              </button>
              <button onclick="event.stopPropagation();showReviewCardContextMenu(event, ${JSON.stringify(o).replace(/"/g, '&quot;')}, 'region')" 
                class="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition" data-tooltip="더보기">
                <i class="fas fa-ellipsis-vertical"></i>
              </button>
            </div>
          </div>`;
        }).join('')}
        ${orders.length === 0 ? '<div class="bg-white rounded-xl p-8 text-center text-gray-400 border"><i class="fas fa-clipboard-check text-4xl mb-3"></i><p>검수 대기 건이 없습니다.</p></div>' : ''}
      </div>
    </div>`;
}

// ════════ HQ 2차 검수 ════════
async function renderReviewHQ(el) {
  showSkeletonLoading(el, 'cards');
  const res = await api('GET', '/orders?status=REGION_APPROVED&limit=100');
  const orders = res?.orders || [];

  const currentIds = new Set(orders.map(o => o.order_id));
  for (const id of reviewState.selectedHQ) {
    if (!currentIds.has(id)) reviewState.selectedHQ.delete(id);
  }

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-shield-halved mr-2 text-blue-600"></i>HQ 2차 검수</h2>
        <div class="flex gap-2 items-center">
          ${reviewState.selectedHQ.size > 0 ? `
            <span class="text-sm text-purple-600 font-medium"><i class="fas fa-check-square mr-1"></i>${reviewState.selectedHQ.size}건 선택</span>
            <button onclick="batchReview('hq','APPROVE')" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"><i class="fas fa-check-double mr-1"></i>일괄 최종승인</button>
            <button onclick="batchReview('hq','REJECT')" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"><i class="fas fa-times mr-1"></i>일괄 반려</button>
            <button onclick="reviewState.selectedHQ.clear();renderContent()" class="px-3 py-2 bg-gray-100 text-gray-500 rounded-lg text-xs hover:bg-gray-200">해제</button>
          ` : ''}
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div class="flex items-center gap-4 text-sm text-gray-600">
          <span><i class="fas fa-thumbs-up mr-1 text-lime-500"></i>지역 승인 완료: <strong class="text-lime-700">${orders.length}건</strong></span>
          <span class="text-gray-300">|</span>
          <span>최종 검수를 진행하세요.</span>
          <span class="ml-auto text-xs text-gray-400"><i class="fas fa-hand-pointer mr-1"></i>카드 클릭: 선택 · 우클릭: 액션 메뉴</span>
        </div>
      </div>

      <div class="grid gap-4">
        ${orders.map(o => {
          const sel = reviewState.selectedHQ.has(o.order_id);
          return `
          <div class="ix-card bg-white rounded-xl border ${sel ? 'border-purple-400 ring-2 ring-purple-200' : 'border-gray-100'} p-5 hover:shadow-md transition relative"
               onclick="toggleReviewSelect('hq', ${o.order_id}, event)"
               oncontextmenu="showReviewCardContextMenu(event, ${JSON.stringify(o).replace(/"/g, '&quot;')}, 'hq')"
               data-preview="order" data-preview-id="${o.order_id}" data-preview-title="주문 #${o.order_id}">
            ${sel ? '<div class="absolute top-3 right-3 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center"><i class="fas fa-check text-white text-xs"></i></div>' : ''}
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <span class="font-mono text-gray-400 text-sm">#${o.order_id}</span>
                <span class="font-bold">${o.customer_name || '-'}</span>
                ${statusBadge(o.status)}
              </div>
              <span class="font-medium text-blue-600">${formatAmount(o.base_amount)}</span>
            </div>
            <div class="text-sm text-gray-500 mb-3">${o.address_text || '-'}</div>
            <div class="flex items-center gap-2 text-xs text-gray-400 mb-4">
              <span><i class="fas fa-building mr-1"></i>${o.region_name || '-'}</span>
              <span>·</span>
              <span><i class="fas fa-user mr-1"></i>팀장: ${o.team_leader_name || '-'}</span>
              <span>·</span>
              <span><i class="fas fa-calendar mr-1"></i>${o.requested_date || '-'}</span>
            </div>
            ${_renderStatusProgress(o.status)}
            <div class="flex gap-2 mt-4" onclick="event.stopPropagation()">
              <button onclick="showOrderDetailDrawer(${o.order_id})" class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition">
                <i class="fas fa-eye mr-1"></i>상세보기
              </button>
              <button onclick="quickApprove(${o.order_id},'hq')" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition">
                <i class="fas fa-check mr-1"></i>최종 승인
              </button>
              <button onclick="showReviewModal(${o.order_id}, 'hq', 'REJECT')" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition">
                <i class="fas fa-times mr-1"></i>반려
              </button>
              <button onclick="event.stopPropagation();showReviewCardContextMenu(event, ${JSON.stringify(o).replace(/"/g, '&quot;')}, 'hq')" 
                class="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition" data-tooltip="더보기">
                <i class="fas fa-ellipsis-vertical"></i>
              </button>
            </div>
          </div>`;
        }).join('')}
        ${orders.length === 0 ? '<div class="bg-white rounded-xl p-8 text-center text-gray-400 border"><i class="fas fa-shield-halved text-4xl mb-3"></i><p>HQ 검수 대기 건이 없습니다.</p></div>' : ''}
      </div>
    </div>`;
}

// ─── 검수 카드 선택 토글 ───
function toggleReviewSelect(stage, orderId, event) {
  if (event.target.closest('button')) return;
  const set = stage === 'hq' ? reviewState.selectedHQ : reviewState.selectedRegion;
  if (set.has(orderId)) set.delete(orderId);
  else set.add(orderId);
  renderContent();
}

// ─── 검수 카드 컨텍스트 메뉴 ───
function showReviewCardContextMenu(event, order, stage) {
  event.preventDefault();
  event.stopPropagation();
  const o = typeof order === 'string' ? JSON.parse(order) : order;
  const stageLabel = stage === 'hq' ? 'HQ 최종' : '지역';
  
  showContextMenu(event.clientX, event.clientY, [
    { icon: 'fa-eye', label: '상세 보기 (드로어)', action: () => showOrderDetailDrawer(o.order_id) },
    { icon: 'fa-expand', label: '상세 보기 (모달)', action: () => showOrderDetail(o.order_id) },
    { divider: true },
    { icon: 'fa-check', label: `${stageLabel} 빠른 승인`, action: () => quickApprove(o.order_id, stage) },
    { icon: 'fa-check-circle', label: `${stageLabel} 승인 (코멘트 포함)`, action: () => showReviewModal(o.order_id, stage, 'APPROVE') },
    { icon: 'fa-times', label: `${stageLabel} 반려`, danger: true, action: () => showReviewModal(o.order_id, stage, 'REJECT') },
    { divider: true },
    { icon: 'fa-clock-rotate-left', label: '상태 이력 보기', action: () => showOrderHistoryDrawer(o.order_id) },
    { icon: 'fa-scroll', label: '감사 로그 보기', action: () => showOrderAuditDrawer(o.order_id) },
    { divider: true },
    { icon: 'fa-chart-bar', label: '통계에서 확인', action: () => navigateTo('statistics') },
  ], { title: `주문 #${o.order_id} — ${o.customer_name || ''}` });
}

// ─── 빠른 승인 (코멘트 없이 바로 승인) ───
async function quickApprove(orderId, stage) {
  showConfirmModal(
    `${stage === 'hq' ? 'HQ 최종' : '지역'} 빠른 승인`,
    `주문 #${orderId}을 코멘트 없이 바로 승인하시겠습니까?`,
    async () => {
      const res = await api('POST', `/orders/${orderId}/review/${stage}`, { result: 'APPROVE', comment: '', reason_codes: [] });
      if (res?.ok) {
        showToast('승인 완료', 'success');
        renderContent();
      } else {
        showToast(res?.error || '승인 실패', 'error');
      }
    },
    '승인', 'bg-green-600'
  );
}

// ─── 일괄 검수 (배치) ───
async function batchReview(stage, result) {
  const set = stage === 'hq' ? reviewState.selectedHQ : reviewState.selectedRegion;
  const ids = [...set];
  if (ids.length === 0) return;
  
  const isApprove = result === 'APPROVE';
  const stageLabel = stage === 'hq' ? 'HQ' : '지역';
  const actionLabel = isApprove ? '승인' : '반려';

  if (!isApprove) {
    // 반려 시 사유 입력 모달
    const content = `
      <div class="space-y-4">
        <div class="bg-red-50 rounded-lg p-3 border border-red-200">
          <span class="font-medium text-red-700"><i class="fas fa-check-square mr-1"></i>${ids.length}건을 일괄 반려합니다.</span>
          <div class="mt-2 flex flex-wrap gap-1">
            ${ids.slice(0, 8).map(id => `<span class="bg-red-200 text-red-800 text-xs px-2 py-0.5 rounded">#${id}</span>`).join('')}
            ${ids.length > 8 ? `<span class="text-xs text-red-500">... 외 ${ids.length - 8}건</span>` : ''}
          </div>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">반려 사유 코드</label>
          <div class="flex flex-wrap gap-2" id="batch-reject-reasons">
            ${OMS.REJECT_REASONS.map(r => 
              `<label class="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm cursor-pointer hover:bg-red-50">
                <input type="checkbox" value="${r.code}" class="batch-reject-check"> <i class="fas ${r.icon} text-xs text-gray-400 mr-0.5"></i>${r.label}
              </label>`
            ).join('')}
          </div>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">코멘트</label>
          <textarea id="batch-review-comment" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="반려 사유를 입력하세요"></textarea>
        </div>
      </div>`;
    const batchBtnId = '_batch_reject_' + Date.now();
    showModal(`일괄 ${stageLabel} 반려 — ${ids.length}건`, content, `
      <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
      <button id="${batchBtnId}" class="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">반려 확정</button>`);
    document.getElementById(batchBtnId)?.addEventListener('click', () => executeBatchReview(stage, result));
    return;
  }

  // 승인은 확인만
  showConfirmModal(
    `일괄 ${stageLabel} ${actionLabel}`,
    `선택된 <strong>${ids.length}</strong>건을 모두 ${actionLabel}하시겠습니까?`,
    () => executeBatchReview(stage, result),
    `일괄 ${actionLabel}`, isApprove ? 'bg-green-600' : 'bg-red-600'
  );
}

async function executeBatchReview(stage, result) {
  const set = stage === 'hq' ? reviewState.selectedHQ : reviewState.selectedRegion;
  const ids = [...set];
  const comment = document.getElementById('batch-review-comment')?.value || '';
  const reasonChecks = document.querySelectorAll('.batch-reject-check:checked');
  const reason_codes = Array.from(reasonChecks).map(el => el.value);

  closeModal();
  showToast(`${ids.length}건 일괄 처리 중...`, 'info');

  let success = 0, fail = 0;
  for (const id of ids) {
    const res = await api('POST', `/orders/${id}/review/${stage}`, { result, comment, reason_codes });
    if (res?.ok) success++;
    else fail++;
  }

  set.clear();
  showToast(`일괄 처리 완료: 성공 ${success}건${fail > 0 ? `, 실패 ${fail}건` : ''}`, fail > 0 ? 'warning' : 'success');
  renderContent();
}

// ─── 검수 모달 (승인/반려) ───
function showReviewModal(orderId, stage, result) {
  console.log('[DEBUG] showReviewModal called:', { orderId, stage, result });
  const isApprove = result === 'APPROVE';
  const title = `${stage === 'hq' ? 'HQ' : '지역'} 검수 — ${isApprove ? '승인' : '반려'}`;
  const submitBtnId = '_review_submit_' + Date.now();
  const content = `
    <div class="space-y-4">
      <div class="p-4 rounded-lg ${isApprove ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}">
        <div class="flex items-center gap-2 mb-2">
          <i class="fas ${isApprove ? 'fa-check-circle text-green-600' : 'fa-times-circle text-red-600'}"></i>
          <span class="font-semibold ${isApprove ? 'text-green-800' : 'text-red-800'}">주문 #${orderId}을 ${isApprove ? '승인' : '반려'}합니다</span>
        </div>
      </div>
      ${!isApprove ? `
        <div>
          <label class="block text-xs text-gray-500 mb-1">반려 사유 코드</label>
          <div class="flex flex-wrap gap-2" id="reject-reasons">
            ${OMS.REJECT_REASONS.map(r => 
              `<label class="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm cursor-pointer hover:bg-red-50">
                <input type="checkbox" value="${r.code}" class="reject-reason-check"> <i class="fas ${r.icon} text-xs text-gray-400 mr-0.5"></i>${r.label}
              </label>`
            ).join('')}
          </div>
        </div>
      ` : ''}
      <div>
        <label class="block text-xs text-gray-500 mb-1">코멘트</label>
        <textarea id="review-comment" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="${isApprove ? '승인 메모 (선택)' : '반려 사유를 입력하세요'}"></textarea>
      </div>
    </div>`;
  const actions = `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button id="${submitBtnId}" class="px-5 py-2 ${isApprove ? 'bg-green-600' : 'bg-red-600'} text-white rounded-lg text-sm font-medium">${isApprove ? '승인 확정' : '반려 확정'}</button>`;
  showModal(title, content, actions);

  // addEventListener 방식으로 바인딩 (inline onclick 대신 더 안정적)
  const submitBtn = document.getElementById(submitBtnId);
  if (submitBtn) {
    submitBtn.addEventListener('click', () => submitReview(orderId, stage, result));
  } else {
    console.error('[DEBUG] submitBtn not found:', submitBtnId);
  }
}

async function submitReview(orderId, stage, result) {
  console.log('[DEBUG] submitReview called:', { orderId, stage, result });
  try {
    const comment = document.getElementById('review-comment')?.value || '';
    const reasonChecks = document.querySelectorAll('.reject-reason-check:checked');
    const reason_codes = Array.from(reasonChecks).map(el => el.value);

    console.log('[DEBUG] submitReview API call:', { path: `/orders/${orderId}/review/${stage}`, body: { result, comment, reason_codes } });
    const res = await api('POST', `/orders/${orderId}/review/${stage}`, { result, comment, reason_codes });
    console.log('[DEBUG] submitReview API response:', res);
    if (res?.ok) {
      showToast(`${result === 'APPROVE' ? '승인' : '반려'} 완료`, result === 'APPROVE' ? 'success' : 'warning');
      closeModal();
      renderContent();
    } else {
      console.error('[DEBUG] submitReview failed:', res);
      showToast(res?.error || '검수 실패', 'error');
    }
  } catch (err) {
    console.error('[DEBUG] submitReview exception:', err);
    showToast('검수 처리 중 오류 발생: ' + (err.message || err), 'error');
  }
}
