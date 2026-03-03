// ============================================================
// 다하다 OMS - 검수(Review) 페이지 (지역 1차 + HQ 2차)
// ============================================================

// ════════ 지역 1차 검수 ════════
async function renderReviewRegion(el) {
  const res = await api('GET', '/orders?status=SUBMITTED&limit=100');
  const orders = res?.orders || [];

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-clipboard-check mr-2 text-lime-600"></i>1차 검수 (지역법인)</h2>
      <div class="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div class="flex items-center gap-4 text-sm text-gray-600">
          <span><i class="fas fa-file-lines mr-1 text-cyan-500"></i>보고서 제출 완료: <strong class="text-cyan-700">${orders.length}건</strong></span>
          <span class="text-gray-300">|</span>
          <span>검수 결과를 승인 또는 반려하세요.</span>
        </div>
      </div>

      <div class="grid gap-4">
        ${orders.map(o => `
          <div class="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition">
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
            <div class="flex gap-2">
              <button onclick="showOrderDetail(${o.order_id})" class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"><i class="fas fa-eye mr-1"></i>상세보기</button>
              <button onclick="showReviewModal(${o.order_id}, 'region', 'APPROVE')" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"><i class="fas fa-check mr-1"></i>승인</button>
              <button onclick="showReviewModal(${o.order_id}, 'region', 'REJECT')" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"><i class="fas fa-times mr-1"></i>반려</button>
            </div>
          </div>
        `).join('')}
        ${orders.length === 0 ? '<div class="bg-white rounded-xl p-8 text-center text-gray-400 border"><i class="fas fa-clipboard-check text-4xl mb-3"></i><p>검수 대기 건이 없습니다.</p></div>' : ''}
      </div>
    </div>`;
}

// ════════ HQ 2차 검수 ════════
async function renderReviewHQ(el) {
  const res = await api('GET', '/orders?status=REGION_APPROVED&limit=100');
  const orders = res?.orders || [];

  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-shield-halved mr-2 text-blue-600"></i>HQ 2차 검수</h2>
      <div class="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div class="flex items-center gap-4 text-sm text-gray-600">
          <span><i class="fas fa-thumbs-up mr-1 text-lime-500"></i>지역 승인 완료: <strong class="text-lime-700">${orders.length}건</strong></span>
          <span class="text-gray-300">|</span>
          <span>최종 검수를 진행하세요.</span>
        </div>
      </div>

      <div class="grid gap-4">
        ${orders.map(o => `
          <div class="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition">
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
            <div class="flex gap-2">
              <button onclick="showOrderDetail(${o.order_id})" class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"><i class="fas fa-eye mr-1"></i>상세보기</button>
              <button onclick="showReviewModal(${o.order_id}, 'hq', 'APPROVE')" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"><i class="fas fa-check mr-1"></i>최종 승인</button>
              <button onclick="showReviewModal(${o.order_id}, 'hq', 'REJECT')" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"><i class="fas fa-times mr-1"></i>반려</button>
            </div>
          </div>
        `).join('')}
        ${orders.length === 0 ? '<div class="bg-white rounded-xl p-8 text-center text-gray-400 border"><i class="fas fa-shield-halved text-4xl mb-3"></i><p>HQ 검수 대기 건이 없습니다.</p></div>' : ''}
      </div>
    </div>`;
}

// ─── 검수 모달 (승인/반려) ───
function showReviewModal(orderId, stage, result) {
  const isApprove = result === 'APPROVE';
  const title = `${stage === 'hq' ? 'HQ' : '지역'} 검수 — ${isApprove ? '승인' : '반려'}`;
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
            ${['사진부족', '주소불일치', '금액오류', '작업미완', '체크리스트미달', '기타'].map(r => 
              `<label class="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm cursor-pointer hover:bg-red-50">
                <input type="checkbox" value="${r}" class="reject-reason-check"> ${r}
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
    <button onclick="submitReview(${orderId}, '${stage}', '${result}')" class="px-5 py-2 ${isApprove ? 'bg-green-600' : 'bg-red-600'} text-white rounded-lg text-sm font-medium">${isApprove ? '승인 확정' : '반려 확정'}</button>`;
  showModal(title, content, actions);
}

async function submitReview(orderId, stage, result) {
  const comment = document.getElementById('review-comment')?.value || '';
  const reasonChecks = document.querySelectorAll('.reject-reason-check:checked');
  const reason_codes = Array.from(reasonChecks).map(el => el.value);

  const res = await api('POST', `/orders/${orderId}/review/${stage}`, { result, comment, reason_codes });
  if (res?.ok) {
    showToast(`${result === 'APPROVE' ? '승인' : '반려'} 완료`, result === 'APPROVE' ? 'success' : 'warning');
    closeModal();
    renderContent();
  } else {
    showToast(res?.error || '검수 실패', 'error');
  }
}
