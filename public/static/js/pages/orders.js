// ============================================================
// 다하다 OMS - 주문관리 + 자동배분 페이지
// ============================================================

// ════════ 주문 관리 ════════
async function renderOrders(el) {
  const params = new URLSearchParams(window._orderFilters || {});
  if (!params.has('limit')) params.set('limit', '15');
  const res = await api('GET', `/orders?${params.toString()}`);
  if (!res) return;

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-list-check mr-2 text-blue-600"></i>주문관리</h2>
        <div class="flex gap-2">
          <button onclick="showImportModal()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"><i class="fas fa-file-import mr-1"></i>일괄 수신</button>
          <button onclick="showNewOrderModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>수동 등록</button>
        </div>
      </div>
      
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
        <button onclick="applyOrderFilter()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"><i class="fas fa-search mr-1"></i>조회</button>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-600"><tr>
              <th class="px-4 py-3 text-left">ID</th><th class="px-4 py-3 text-left">주문번호</th><th class="px-4 py-3 text-left">고객명</th>
              <th class="px-4 py-3 text-left">주소</th><th class="px-4 py-3 text-right">금액</th><th class="px-4 py-3 text-left">지역법인</th>
              <th class="px-4 py-3 text-left">팀장</th><th class="px-4 py-3 text-center">상태</th><th class="px-4 py-3 text-left">요청일</th>
              <th class="px-4 py-3 text-center">상세</th>
            </tr></thead>
            <tbody class="divide-y">
              ${(res.orders || []).map(o => `
                <tr class="hover:bg-gray-50 cursor-pointer" onclick="showOrderDetail(${o.order_id})">
                  <td class="px-4 py-3 text-gray-500">${o.order_id}</td>
                  <td class="px-4 py-3 font-mono text-xs">${o.external_order_no || '<span class="text-gray-400">미확정</span>'}</td>
                  <td class="px-4 py-3 font-medium">${o.customer_name || '-'}</td>
                  <td class="px-4 py-3 text-gray-600 max-w-[200px] truncate">${o.address_text || '-'}</td>
                  <td class="px-4 py-3 text-right font-medium">${formatAmount(o.base_amount)}</td>
                  <td class="px-4 py-3">${o.region_name || '<span class="text-gray-400">-</span>'}</td>
                  <td class="px-4 py-3">${o.team_leader_name || '<span class="text-gray-400">-</span>'}</td>
                  <td class="px-4 py-3 text-center">${statusBadge(o.status)}</td>
                  <td class="px-4 py-3 text-gray-500 text-xs">${o.requested_date || '-'}</td>
                  <td class="px-4 py-3 text-center"><i class="fas fa-chevron-right text-gray-400"></i></td>
                </tr>
              `).join('')}
              ${(res.orders || []).length === 0 ? '<tr><td colspan="10" class="px-4 py-8 text-center text-gray-400">데이터가 없습니다.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
          <span>총 ${res.total}건</span>
          <div class="flex gap-2">
            ${Number(res.page) > 1 ? `<button onclick="window._orderFilters={...window._orderFilters||{},page:${Number(res.page)-1}};renderContent()" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">이전</button>` : ''}
            <span class="px-3 py-1">${res.page} / ${Math.ceil(res.total / Number(res.limit)) || 1}</span>
            ${Number(res.page) < Math.ceil(res.total / Number(res.limit)) ? `<button onclick="window._orderFilters={...window._orderFilters||{},page:${Number(res.page)+1}};renderContent()" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">다음</button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
}

function applyOrderFilter() {
  window._orderFilters = { status: document.getElementById('f-status')?.value, search: document.getElementById('f-search')?.value, from: document.getElementById('f-from')?.value, to: document.getElementById('f-to')?.value, page: 1 };
  Object.keys(window._orderFilters).forEach(k => { if (!window._orderFilters[k]) delete window._orderFilters[k]; });
  renderContent();
}

// ─── 주문 상세 모달 ───
async function showOrderDetail(orderId) {
  const res = await api('GET', `/orders/${orderId}`);
  if (!res?.order) return;
  const o = res.order;
  const content = `
    <div class="space-y-4">
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
  showModal(`주문 상세 #${o.order_id}`, content);
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

// ════════ 자동배분 관리 ════════
async function renderDistribute(el) {
  const [receivedRes, pendingRes, dpRes, distributedRes] = await Promise.all([
    api('GET', '/orders?status=RECEIVED&limit=100'),
    api('GET', '/orders?status=VALIDATED&limit=100'),
    api('GET', '/orders?status=DISTRIBUTION_PENDING&limit=100'),
    api('GET', '/orders?status=DISTRIBUTED&limit=100'),
  ]);
  
  const receivedCount = (receivedRes?.orders || []).length;
  const validatedCount = (pendingRes?.orders || []).length;
  const dpCount = (dpRes?.orders || []).length;
  const distributedCount = (distributedRes?.orders || []).length;
  const totalPending = receivedCount + validatedCount;

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-share-nodes mr-2 text-indigo-600"></i>자동배분 관리</h2>
        <button onclick="executeDistributeWithModal()" class="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all ${totalPending === 0 ? 'opacity-50 cursor-not-allowed' : ''}">
          <i class="fas fa-play mr-2"></i>자동 배분 실행 (${totalPending}건)
        </button>
      </div>

      <!-- 현황 카드 -->
      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-3xl font-bold text-gray-600">${receivedCount}</div>
          <div class="text-xs text-gray-500 mt-1"><i class="fas fa-inbox mr-1"></i>수신(RECEIVED)</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-blue-200 text-center bg-blue-50">
          <div class="text-3xl font-bold text-blue-600">${validatedCount}</div>
          <div class="text-xs text-blue-600 mt-1"><i class="fas fa-check-circle mr-1"></i>유효성통과</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-yellow-200 text-center bg-yellow-50">
          <div class="text-3xl font-bold text-yellow-600">${dpCount}</div>
          <div class="text-xs text-yellow-600 mt-1"><i class="fas fa-exclamation-triangle mr-1"></i>배분보류</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-indigo-200 text-center bg-indigo-50">
          <div class="text-3xl font-bold text-indigo-600">${distributedCount}</div>
          <div class="text-xs text-indigo-600 mt-1"><i class="fas fa-share-nodes mr-1"></i>배분완료(미배정)</div>
        </div>
      </div>

      <!-- 배분 프로세스 시각화 -->
      <div class="bg-white rounded-xl p-6 border border-gray-100 mb-6">
        <h3 class="font-semibold mb-4"><i class="fas fa-sitemap mr-2 text-indigo-500"></i>배분 프로세스 흐름</h3>
        <div class="flex items-center justify-center gap-3 py-4">
          <div class="text-center px-4 py-3 bg-gray-100 rounded-xl">
            <div class="text-lg font-bold">${receivedCount + validatedCount}</div>
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
        <!-- 배분 대상 -->
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <h3 class="font-semibold mb-4"><i class="fas fa-hourglass-half mr-2 text-blue-500"></i>배분 대상 (RECEIVED + VALIDATED) — ${totalPending}건</h3>
          <div class="space-y-2 max-h-80 overflow-y-auto">
            ${[...(receivedRes?.orders || []), ...(pendingRes?.orders || [])].map(o => `
              <div class="flex items-center justify-between p-3 bg-blue-50 rounded-lg text-sm">
                <div>
                  <span class="text-xs text-gray-500">#${o.order_id}</span>
                  <span class="ml-2 font-medium">${o.customer_name || '-'}</span> ${statusBadge(o.status)}
                  <div class="text-xs text-gray-500 mt-0.5">${o.address_text?.substring(0, 35) || '-'}</div>
                </div>
                <span class="text-sm font-medium whitespace-nowrap">${formatAmount(o.base_amount)}</span>
              </div>
            `).join('')}
            ${totalPending === 0 ? '<p class="text-gray-400 text-sm text-center py-8">배분 대상 없음</p>' : ''}
          </div>
        </div>
        
        <!-- 배분 보류 -->
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <h3 class="font-semibold mb-4"><i class="fas fa-exclamation-triangle mr-2 text-amber-500"></i>배분 보류 (수동 필요) — ${dpCount}건</h3>
          <div class="space-y-2 max-h-80 overflow-y-auto">
            ${(dpRes?.orders || []).map(o => `
              <div class="flex items-center justify-between p-3 bg-yellow-50 rounded-lg text-sm">
                <div>
                  <span class="text-xs text-gray-500">#${o.order_id}</span>
                  <span class="ml-2 font-medium">${o.customer_name || '-'}</span>
                  <div class="text-xs text-red-500 mt-0.5">행정동 매칭 실패 · ${o.address_text?.substring(0, 30) || ''}</div>
                </div>
                <button onclick="showManualDistributeModal(${o.order_id})" class="px-3 py-1 bg-amber-100 text-amber-700 rounded text-xs hover:bg-amber-200 whitespace-nowrap">수동배분</button>
              </div>
            `).join('')}
            ${dpCount === 0 ? '<p class="text-gray-400 text-sm text-center py-8">보류 건 없음</p>' : ''}
          </div>
        </div>
      </div>
    </div>`;
}

// ─── 자동배분 실행 + 결과 모달 ───
async function executeDistributeWithModal() {
  // 로딩 모달
  showModal('자동 배분 실행 중...', `
    <div class="text-center py-8">
      <div class="animate-spin w-16 h-16 mx-auto mb-4">
        <i class="fas fa-cogs text-4xl text-blue-500"></i>
      </div>
      <p class="text-gray-600">행정동 기준으로 4개 지역법인에 주문을 배분하고 있습니다...</p>
      <p class="text-sm text-gray-400 mt-2">RECEIVED → VALIDATED → DISTRIBUTED</p>
    </div>`, '', { large: true });

  const res = await api('POST', '/orders/distribute');
  closeModal();
  
  if (!res) return;

  // 결과 모달 (시각적)
  const regionColors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500'];
  const regionSummary = res.region_summary || [];
  
  const content = `
    <div class="space-y-6">
      <!-- 요약 -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-blue-50 rounded-xl p-4 text-center border border-blue-200">
          <div class="text-3xl font-bold text-blue-600">${res.total || 0}</div>
          <div class="text-xs text-blue-600 font-medium mt-1">처리 대상</div>
        </div>
        <div class="bg-green-50 rounded-xl p-4 text-center border border-green-200">
          <div class="text-3xl font-bold text-green-600">${res.distributed || 0}</div>
          <div class="text-xs text-green-600 font-medium mt-1">배분 성공</div>
        </div>
        <div class="bg-yellow-50 rounded-xl p-4 text-center border border-yellow-200">
          <div class="text-3xl font-bold text-yellow-600">${res.pending || 0}</div>
          <div class="text-xs text-yellow-600 font-medium mt-1">보류 (수동필요)</div>
        </div>
      </div>

      <!-- 지역법인별 배분 결과 -->
      ${regionSummary.length > 0 ? `
      <div>
        <h4 class="font-semibold mb-3"><i class="fas fa-building mr-1 text-indigo-500"></i>지역법인별 배분 결과</h4>
        <div class="grid grid-cols-2 gap-3">
          ${regionSummary.map((r, i) => `
            <div class="rounded-xl p-4 border-2 ${i % 4 === 0 ? 'border-blue-300 bg-blue-50' : i % 4 === 1 ? 'border-purple-300 bg-purple-50' : i % 4 === 2 ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}">
              <div class="flex items-center justify-between mb-2">
                <span class="font-bold">${r.name}</span>
                <span class="text-lg font-bold">${r.count}건</span>
              </div>
              <div class="text-sm text-gray-600">${formatAmount(r.amount)}</div>
              <div class="mt-2 text-xs text-gray-500">
                ${(r.orders || []).map(o => `#${o.order_id} ${o.customer_name || ''}`).join(', ')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <!-- 상세 목록 -->
      ${(res.results || []).length > 0 ? `
      <div>
        <h4 class="font-semibold mb-3"><i class="fas fa-list mr-1"></i>배분 상세</h4>
        <div class="max-h-48 overflow-y-auto space-y-1">
          ${(res.results || []).map(r => `
            <div class="flex items-center gap-3 px-3 py-2 rounded-lg ${r.result === 'DISTRIBUTED' ? 'bg-green-50' : 'bg-yellow-50'} text-sm">
              <span class="font-mono text-xs text-gray-500">#${r.order_id}</span>
              <span class="font-medium">${r.customer_name || '-'}</span>
              ${r.result === 'DISTRIBUTED' 
                ? `<span class="ml-auto text-green-600"><i class="fas fa-check mr-1"></i>${r.region_name}</span>` 
                : `<span class="ml-auto text-yellow-600"><i class="fas fa-exclamation-triangle mr-1"></i>${r.reason}</span>`}
            </div>
          `).join('')}
        </div>
      </div>` : ''}
    </div>`;

  showModal(
    `<i class="fas fa-check-circle text-green-500 mr-2"></i>자동 배분 완료`,
    content,
    `<button onclick="closeModal();renderContent()" class="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium">확인</button>`,
    { large: true }
  );
}

// ─── 수동 배분 모달 ───
async function showManualDistributeModal(orderId) {
  const orgsRes = await api('GET', '/auth/organizations');
  const regions = (orgsRes?.organizations || []).filter(o => o.org_type === 'REGION');
  const content = `
    <div class="space-y-4">
      <p class="text-sm text-gray-600">행정동 자동매칭이 실패한 주문을 수동으로 지역법인에 배분합니다.</p>
      <select id="manual-region" class="w-full border rounded-lg px-3 py-3 text-sm">
        ${regions.map(r => `<option value="${r.org_id}">${r.name} (${r.code})</option>`).join('')}
      </select>
    </div>`;
  showModal(`수동 배분 — 주문 #${orderId}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitManualDistribute(${orderId})" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">배분 확정</button>`);
}
async function submitManualDistribute(orderId) {
  const regionOrgId = Number(document.getElementById('manual-region').value);
  const res = await api('PATCH', `/orders/${orderId}/distribution`, { region_org_id: regionOrgId });
  if (res?.ok) { showToast('수동 배분 완료', 'success'); closeModal(); renderContent(); }
  else showToast(res?.error || '배분 실패', 'error');
}
