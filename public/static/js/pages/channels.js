// ============================================================
// 다하다 OMS - 주문 채널(Channel) 관리 페이지 v7.0
// N개의 주문원장(채널) 등록/수정/관리
// ============================================================

async function renderChannels(el) {
  showSkeletonLoading(el, 'table');
  const res = await api('GET', '/hr/channels');
  const channels = res?.channels || [];

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">
          <i class="fas fa-satellite-dish mr-2 text-indigo-600"></i>주문 채널 관리
        </h2>
        <button onclick="showCreateChannelModal()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition">
          <i class="fas fa-plus mr-1"></i>채널 등록
        </button>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div class="flex items-center gap-4 text-sm text-gray-600">
          <span><i class="fas fa-satellite-dish mr-1 text-indigo-500"></i>총 채널: <strong>${channels.length}</strong>개</span>
          <span class="text-gray-300">|</span>
          <span><i class="fas fa-check-circle mr-1 text-green-500"></i>활성: <strong>${channels.filter(c => c.is_active).length}</strong>개</span>
          <span class="text-gray-300">|</span>
          <span>다채널 주문원장을 등록/관리합니다. 주문 수신 시 채널별로 분류됩니다.</span>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${channels.map(ch => `
          <div class="bg-white rounded-xl p-5 border ${ch.is_active ? 'border-gray-100' : 'border-red-200 bg-red-50'} hover:shadow-md transition">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 ${ch.is_active ? 'bg-indigo-100' : 'bg-gray-100'} rounded-lg flex items-center justify-center">
                  <i class="fas fa-satellite-dish ${ch.is_active ? 'text-indigo-600' : 'text-gray-400'}"></i>
                </div>
                <div>
                  <div class="font-bold text-gray-800">${ch.name}</div>
                  <div class="text-xs text-gray-500 font-mono">${ch.code}</div>
                </div>
              </div>
              <span class="status-badge ${ch.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                ${ch.is_active ? '활성' : '비활성'}
              </span>
            </div>
            ${ch.description ? `<p class="text-sm text-gray-500 mb-3">${ch.description}</p>` : ''}
            <div class="flex items-center gap-4 text-sm text-gray-600 mb-3">
              <span><i class="fas fa-boxes-stacked mr-1"></i>${ch.order_count || 0}건</span>
              <span><i class="fas fa-won-sign mr-1"></i>${formatAmount(ch.total_amount)}</span>
              ${ch.priority ? `<span class="text-xs text-gray-400">우선순위: ${ch.priority}</span>` : ''}
            </div>
            ${ch.contact_info ? `<div class="text-xs text-gray-400 mb-3"><i class="fas fa-phone mr-1"></i>${ch.contact_info}</div>` : ''}
            <div class="flex gap-2 border-t pt-3">
              <button onclick="showEditChannelModal(${ch.channel_id}, ${JSON.stringify(ch).replace(/"/g, '&quot;')})"
                class="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200 transition">
                <i class="fas fa-edit mr-1"></i>수정
              </button>
              <button onclick="toggleChannelStatus(${ch.channel_id}, ${ch.is_active ? 'true' : 'false'}, '${ch.name}')"
                class="flex-1 px-3 py-1.5 ${ch.is_active ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'} rounded-lg text-xs transition">
                <i class="fas ${ch.is_active ? 'fa-ban' : 'fa-check'} mr-1"></i>${ch.is_active ? '비활성화' : '활성화'}
              </button>
            </div>
          </div>
        `).join('')}
        ${channels.length === 0 ? `
        <div class="col-span-3 bg-white rounded-xl p-12 text-center text-gray-400 border">
          <i class="fas fa-satellite-dish text-5xl mb-4"></i>
          <p class="text-lg">등록된 채널이 없습니다</p>
          <p class="text-sm mt-2">주문원장 채널을 등록하세요.</p>
        </div>` : ''}
      </div>
    </div>`;
}

function showCreateChannelModal() {
  const content = `
    <form id="create-channel-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-xs text-gray-500 mb-1">채널명 *</label>
          <input name="name" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="예: KT 주문원장"></div>
        <div><label class="block text-xs text-gray-500 mb-1">코드 * (영문대문자/숫자/밑줄)</label>
          <input name="code" required class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="KT_ORDERS" pattern="[A-Z0-9_]{2,30}"></div>
        <div class="col-span-2"><label class="block text-xs text-gray-500 mb-1">설명</label>
          <input name="description" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="채널 설명"></div>
        <div><label class="block text-xs text-gray-500 mb-1">연락처</label>
          <input name="contact_info" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="담당자/전화번호"></div>
        <div><label class="block text-xs text-gray-500 mb-1">우선순위 (높을수록 우선)</label>
          <input name="priority" type="number" value="0" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
      </div>
    </form>`;
  showModal('주문 채널 등록', content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitCreateChannel()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">등록</button>`);
}

async function submitCreateChannel() {
  const data = Object.fromEntries(new FormData(document.getElementById('create-channel-form')));
  data.priority = Number(data.priority) || 0;
  const res = await api('POST', '/hr/channels', data);
  if (res?.channel_id) { showToast('채널 등록 완료', 'success'); closeModal(); renderContent(); }
  else showToast(res?.error || '등록 실패', 'error');
}

function showEditChannelModal(channelId, channelData) {
  const ch = typeof channelData === 'string' ? JSON.parse(channelData) : channelData;
  const content = `
    <form id="edit-channel-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-xs text-gray-500 mb-1">채널명</label>
          <input name="name" value="${ch.name}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">코드 (변경 불가)</label>
          <input disabled value="${ch.code}" class="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 font-mono"></div>
        <div class="col-span-2"><label class="block text-xs text-gray-500 mb-1">설명</label>
          <input name="description" value="${ch.description || ''}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">연락처</label>
          <input name="contact_info" value="${ch.contact_info || ''}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-xs text-gray-500 mb-1">우선순위</label>
          <input name="priority" type="number" value="${ch.priority || 0}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
      </div>
    </form>`;
  showModal(`채널 수정 — ${ch.name}`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
    <button onclick="submitEditChannel(${channelId})" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">저장</button>`);
}

async function submitEditChannel(channelId) {
  const data = Object.fromEntries(new FormData(document.getElementById('edit-channel-form')));
  data.priority = Number(data.priority) || 0;
  const res = await api('PUT', `/hr/channels/${channelId}`, data);
  if (res?.ok) { showToast('채널 수정 완료', 'success'); closeModal(); renderContent(); }
  else showToast(res?.error || '수정 실패', 'error');
}

function toggleChannelStatus(channelId, isCurrentlyActive, name) {
  const action = isCurrentlyActive ? '비활성화' : '활성화';
  showConfirmModal(`채널 ${action}`, `<strong>${name}</strong> 채널을 ${action}하시겠습니까?`,
    async () => {
      const res = await api('PUT', `/hr/channels/${channelId}`, { is_active: !isCurrentlyActive });
      if (res?.ok) { showToast(`${action} 완료`, 'success'); renderContent(); }
      else showToast(res?.error || '실패', 'error');
    }, action, isCurrentlyActive ? 'bg-red-600' : 'bg-green-600');
}
