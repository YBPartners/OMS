// ============================================================
// Airflow OMS - 주문 채널(Channel) 관리 페이지 v8.0
// N개의 주문원장(채널) 등록/수정/관리 + API 연동 설정
// ============================================================

const AUTH_TYPES = {
  NONE: { label: '인증 없음', icon: 'fa-lock-open', color: 'text-gray-400' },
  API_KEY: { label: 'API Key', icon: 'fa-key', color: 'text-yellow-600' },
  BEARER: { label: 'Bearer Token', icon: 'fa-shield-halved', color: 'text-blue-600' },
  BASIC: { label: 'Basic Auth', icon: 'fa-user-lock', color: 'text-purple-600' },
  CUSTOM_HEADER: { label: 'Custom Header', icon: 'fa-code', color: 'text-green-600' },
};

const SYNC_STATUS_BADGE = {
  SUCCESS: 'bg-green-100 text-green-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  FAIL: 'bg-red-100 text-red-700',
};

// ─── 내부 필드 정의 (매핑 대상) ───
const INTERNAL_FIELDS = [
  { key: 'external_order_no', label: '주문번호', required: false },
  { key: 'customer_name', label: '고객명', required: false },
  { key: 'customer_phone', label: '연락처', required: false },
  { key: 'address_text', label: '주소', required: true },
  { key: 'address_detail', label: '상세주소', required: false },
  { key: 'requested_date', label: '요청일', required: false },
  { key: 'scheduled_date', label: '예정일', required: false },
  { key: 'base_amount', label: '금액', required: false },
  { key: 'service_type', label: '서비스유형', required: false },
  { key: 'memo', label: '메모', required: false },
  { key: 'admin_dong_code', label: '행정동코드', required: false },
  { key: 'legal_dong_code', label: '법정동코드', required: false },
];

async function renderChannels(el) {
  try {
  showSkeletonLoading(el, 'table');
  const res = await api('GET', '/hr/channels');
  const channels = res?.channels || [];
  const activeChannels = channels.filter(c => c.is_active);
  const apiChannels = channels.filter(c => c.api_enabled);

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

      <!-- 요약 카드 -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl border p-4">
          <div class="text-xs text-gray-500 mb-1">전체 채널</div>
          <div class="text-2xl font-bold text-gray-800">${channels.length}</div>
        </div>
        <div class="bg-white rounded-xl border p-4">
          <div class="text-xs text-gray-500 mb-1">활성 채널</div>
          <div class="text-2xl font-bold text-green-600">${activeChannels.length}</div>
        </div>
        <div class="bg-white rounded-xl border p-4">
          <div class="text-xs text-gray-500 mb-1">API 연동</div>
          <div class="text-2xl font-bold text-blue-600">${apiChannels.length}</div>
        </div>
        <div class="bg-white rounded-xl border p-4">
          <div class="text-xs text-gray-500 mb-1">총 주문건수</div>
          <div class="text-2xl font-bold text-indigo-600">${channels.reduce((s, c) => s + (c.order_count || 0), 0).toLocaleString()}</div>
        </div>
      </div>

      <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-700">
        <i class="fas fa-info-circle mr-1"></i>
        <strong>주문 채널</strong>이란 본사가 주문을 수신하는 외부 발송처입니다. 
        각 채널에 API 연동을 설정하면 외부 시스템에서 자동으로 주문을 가져올 수 있습니다.
      </div>

      <!-- 채널 카드 목록 -->
      <div class="space-y-4">
        ${channels.map(ch => renderChannelCard(ch)).join('')}
        ${channels.length === 0 ? `
        <div class="bg-white rounded-xl p-12 text-center text-gray-400 border">
          <i class="fas fa-satellite-dish text-5xl mb-4"></i>
          <p class="text-lg">등록된 채널이 없습니다</p>
          <p class="text-sm mt-2">"채널 등록" 버튼으로 주문 수신 채널을 등록하세요.</p>
        </div>` : ''}
      </div>
    </div>`;

  } catch (e) {
  console.error('[renderChannels]', e);
  el.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1 text-gray-400">' + (e.message||e) + '</p></div>';
  }
}

function renderChannelCard(ch) {
  const authInfo = AUTH_TYPES[ch.auth_type] || AUTH_TYPES.NONE;
  const syncBadge = ch.last_sync_status ? SYNC_STATUS_BADGE[ch.last_sync_status] || '' : '';

  return `
    <div class="bg-white rounded-xl border ${ch.is_active ? 'border-gray-100' : 'border-red-200 bg-red-50/30'} hover:shadow-md transition overflow-hidden">
      <!-- 헤더 -->
      <div class="p-5 border-b border-gray-50">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 ${ch.is_active ? 'bg-indigo-100' : 'bg-gray-100'} rounded-xl flex items-center justify-center">
              <i class="fas fa-satellite-dish text-lg ${ch.is_active ? 'text-indigo-600' : 'text-gray-400'}"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-lg text-gray-800">${ch.name}</span>
                <span class="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">${ch.code}</span>
                <span class="status-badge ${ch.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} text-xs">
                  ${ch.is_active ? '활성' : '비활성'}
                </span>
                ${ch.api_enabled ? '<span class="status-badge bg-blue-100 text-blue-700 text-xs"><i class="fas fa-plug mr-1"></i>API 연동</span>' : ''}
              </div>
              ${ch.description ? `<p class="text-sm text-gray-500 mt-1">${ch.description}</p>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="openChannelDetail(${ch.channel_id})" class="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm hover:bg-indigo-100 transition" title="API 설정">
              <i class="fas fa-cog mr-1"></i>설정
            </button>
            <button onclick="showEditChannelModal(${ch.channel_id})" class="px-3 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm hover:bg-gray-100 transition" title="기본 정보 수정">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="toggleChannelStatus(${ch.channel_id}, ${ch.is_active ? 'true' : 'false'}, '${ch.name}')"
              class="px-3 py-2 ${ch.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'} rounded-lg text-sm transition" title="${ch.is_active ? '비활성화' : '활성화'}">
              <i class="fas ${ch.is_active ? 'fa-ban' : 'fa-check'}"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- 통계 & API 상태 -->
      <div class="p-5 flex flex-wrap gap-6 text-sm">
        <div class="flex items-center gap-2">
          <i class="fas fa-boxes-stacked text-gray-400"></i>
          <span class="text-gray-600">주문 <strong>${(ch.order_count || 0).toLocaleString()}</strong>건</span>
        </div>
        <div class="flex items-center gap-2">
          <i class="fas fa-won-sign text-gray-400"></i>
          <span class="text-gray-600"><strong>${formatAmount(ch.total_amount)}</strong></span>
        </div>
        ${ch.contact_info && ch.contact_info !== 'null' ? `
        <div class="flex items-center gap-2">
          <i class="fas fa-phone text-gray-400"></i>
          <span class="text-gray-600">${ch.contact_info}</span>
        </div>` : ''}
        ${ch.api_endpoint && ch.api_endpoint !== 'null' ? `
        <div class="flex items-center gap-2">
          <i class="fas ${authInfo.icon} ${authInfo.color}"></i>
          <span class="text-gray-600">${authInfo.label}</span>
          <span class="text-gray-300">|</span>
          <span class="text-xs font-mono text-gray-400 truncate max-w-xs">${ch.api_endpoint}</span>
        </div>` : `
        <div class="flex items-center gap-2 text-gray-400">
          <i class="fas fa-unlink"></i>
          <span>API 미설정</span>
        </div>`}
        ${ch.last_sync_at && ch.last_sync_at !== 'null' ? `
        <div class="flex items-center gap-2">
          <i class="fas fa-sync text-gray-400"></i>
          <span class="status-badge ${syncBadge} text-xs">${ch.last_sync_status}</span>
          <span class="text-xs text-gray-400">${ch.last_sync_at?.substring(0, 16)} (${ch.last_sync_count || 0}건)</span>
        </div>` : ''}
        ${ch.total_synced_count > 0 ? `
        <div class="flex items-center gap-2">
          <i class="fas fa-database text-gray-400"></i>
          <span class="text-gray-600">누적 동기화 <strong>${ch.total_synced_count.toLocaleString()}</strong>건</span>
        </div>` : ''}
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════
// 채널 등록 모달
// ════════════════════════════════════════════════════════
function showCreateChannelModal() {
  const content = `
    <form id="create-channel-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-xs text-gray-500 mb-1">채널명 *</label>
          <input name="name" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="예: 아정당"></div>
        <div><label class="block text-xs text-gray-500 mb-1">코드 * (영문대문자/숫자/밑줄)</label>
          <input name="code" required class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="AJD" pattern="[A-Z0-9_]{2,30}"></div>
        <div class="col-span-2"><label class="block text-xs text-gray-500 mb-1">설명</label>
          <input name="description" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="주문 수신 채널 설명"></div>
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
  await apiAction('POST', '/hr/channels', data, {
    successCheck: d => !!d?.channel_id,
    successMsg: '채널 등록 완료', closeModal: true, refresh: true
  });
}

// ════════════════════════════════════════════════════════
// 채널 기본 정보 수정 모달
// ════════════════════════════════════════════════════════
function showEditChannelModal(channelId) {
  (async () => {
    const res = await api('GET', `/hr/channels/${channelId}`);
    const ch = res?.channel;
    if (!ch) return showToast('채널 정보를 불러올 수 없습니다.', 'error');

    const content = `
      <form id="edit-channel-form" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-xs text-gray-500 mb-1">채널명</label>
            <input name="name" value="${ch.name || ''}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
          <div><label class="block text-xs text-gray-500 mb-1">코드 (변경 불가)</label>
            <input disabled value="${ch.code}" class="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 font-mono"></div>
          <div class="col-span-2"><label class="block text-xs text-gray-500 mb-1">설명</label>
            <input name="description" value="${ch.description && ch.description !== 'null' ? ch.description : ''}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
          <div><label class="block text-xs text-gray-500 mb-1">연락처</label>
            <input name="contact_info" value="${ch.contact_info && ch.contact_info !== 'null' ? ch.contact_info : ''}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
          <div><label class="block text-xs text-gray-500 mb-1">우선순위</label>
            <input name="priority" type="number" value="${ch.priority || 0}" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
        </div>
      </form>`;
    showModal(`채널 수정 — ${ch.name}`, content, `
      <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
      <button onclick="submitEditChannel(${channelId})" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">저장</button>`);
  })();
}

async function submitEditChannel(channelId) {
  const data = Object.fromEntries(new FormData(document.getElementById('edit-channel-form')));
  data.priority = Number(data.priority) || 0;
  await apiAction('PUT', `/hr/channels/${channelId}`, data, {
    successMsg: '채널 수정 완료', closeModal: true, refresh: true
  });
}

function toggleChannelStatus(channelId, isCurrentlyActive, name) {
  const action = isCurrentlyActive ? '비활성화' : '활성화';
  apiAction('PUT', `/hr/channels/${channelId}`, { is_active: !isCurrentlyActive }, {
    confirm: { title: `채널 ${action}`, message: `<strong>${name}</strong> 채널을 ${action}하시겠습니까?`, buttonText: action, buttonColor: isCurrentlyActive ? 'bg-red-600' : 'bg-green-600' },
    successMsg: `${action} 완료`, refresh: true
  });
}

// ════════════════════════════════════════════════════════
// 채널 상세 & API 연동 설정 (전체 화면 모달)
// ════════════════════════════════════════════════════════
async function openChannelDetail(channelId) {
  try {
  const res = await api('GET', `/hr/channels/${channelId}`);
  const ch = res?.channel;
  if (!ch) return showToast('채널 정보를 불러올 수 없습니다.', 'error');

  // field_mapping, auth_credentials 파싱
  let fieldMapping = {};
  let authCreds = {};
  let requestHeaders = [];
  try { fieldMapping = ch.field_mapping ? (typeof ch.field_mapping === 'string' ? JSON.parse(ch.field_mapping) : ch.field_mapping) : {}; } catch {}
  try { authCreds = ch.auth_credentials ? (typeof ch.auth_credentials === 'string' ? JSON.parse(ch.auth_credentials) : ch.auth_credentials) : {}; } catch {}
  try { requestHeaders = ch.request_headers ? (typeof ch.request_headers === 'string' ? JSON.parse(ch.request_headers) : ch.request_headers) : []; } catch {}

  const authInfo = AUTH_TYPES[ch.auth_type] || AUTH_TYPES.NONE;

  const content = `
    <div class="space-y-6" id="channel-detail-root" data-channel-id="${channelId}">

      <!-- 탭 네비게이션 -->
      <div class="flex border-b">
        <button onclick="switchChannelTab('api-config')" id="tab-api-config" class="px-4 py-2 text-sm font-medium border-b-2 border-indigo-600 text-indigo-600">
          <i class="fas fa-plug mr-1"></i>API 연동 설정
        </button>
        <button onclick="switchChannelTab('field-mapping')" id="tab-field-mapping" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          <i class="fas fa-exchange-alt mr-1"></i>필드 매핑
        </button>
        <button onclick="switchChannelTab('sync-history')" id="tab-sync-history" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          <i class="fas fa-history mr-1"></i>동기화 현황
        </button>
      </div>

      <!-- 탭 1: API 연동 설정 -->
      <div id="panel-api-config" class="space-y-4">
        <div class="bg-gray-50 rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-bold text-gray-700"><i class="fas fa-toggle-on mr-1"></i>API 연동 활성화</h4>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="api-enabled-toggle" ${ch.api_enabled ? 'checked' : ''} 
                onchange="updateChannelField(${channelId}, 'api_enabled', this.checked)" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
          <p class="text-xs text-gray-500">활성화하면 "동기화 실행" 버튼으로 외부 API에서 주문을 가져올 수 있습니다.</p>
        </div>

        <!-- API 엔드포인트 -->
        <div class="grid grid-cols-4 gap-4">
          <div>
            <label class="block text-xs text-gray-500 mb-1">HTTP 메서드</label>
            <select id="ch-api-method" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="GET" ${ch.api_method === 'GET' ? 'selected' : ''}>GET</option>
              <option value="POST" ${ch.api_method === 'POST' ? 'selected' : ''}>POST</option>
            </select>
          </div>
          <div class="col-span-3">
            <label class="block text-xs text-gray-500 mb-1">API 엔드포인트 URL</label>
            <input id="ch-api-endpoint" value="${ch.api_endpoint && ch.api_endpoint !== 'null' ? ch.api_endpoint : ''}" 
              class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="https://api.example.com/orders">
          </div>
        </div>

        <!-- 인증 설정 -->
        <div class="border rounded-xl p-4 space-y-3">
          <h4 class="font-bold text-gray-700 text-sm"><i class="fas fa-lock mr-1"></i>인증 설정</h4>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-500 mb-1">인증 방식</label>
              <select id="ch-auth-type" onchange="toggleAuthFields()" class="w-full border rounded-lg px-3 py-2 text-sm">
                ${Object.entries(AUTH_TYPES).map(([k, v]) => `<option value="${k}" ${ch.auth_type === k ? 'selected' : ''}>${v.label}</option>`).join('')}
              </select>
            </div>
            <div></div>
          </div>
          
          <!-- API Key 필드 -->
          <div id="auth-fields-API_KEY" class="grid grid-cols-2 gap-4 ${ch.auth_type === 'API_KEY' ? '' : 'hidden'}">
            <div><label class="block text-xs text-gray-500 mb-1">헤더 이름</label>
              <input id="auth-header-name" value="${authCreds.header_name || 'X-API-Key'}" class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="X-API-Key"></div>
            <div><label class="block text-xs text-gray-500 mb-1">API Key</label>
              <input id="auth-api-key" type="password" value="${authCreds.api_key || ''}" class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="your-api-key"></div>
          </div>

          <!-- Bearer Token 필드 -->
          <div id="auth-fields-BEARER" class="grid grid-cols-1 gap-4 ${ch.auth_type === 'BEARER' ? '' : 'hidden'}">
            <div><label class="block text-xs text-gray-500 mb-1">Bearer Token</label>
              <input id="auth-bearer-token" type="password" value="${authCreds.token || ''}" class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="your-bearer-token"></div>
          </div>

          <!-- Basic Auth 필드 -->
          <div id="auth-fields-BASIC" class="grid grid-cols-2 gap-4 ${ch.auth_type === 'BASIC' ? '' : 'hidden'}">
            <div><label class="block text-xs text-gray-500 mb-1">사용자명</label>
              <input id="auth-basic-username" value="${authCreds.username || ''}" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="username"></div>
            <div><label class="block text-xs text-gray-500 mb-1">비밀번호</label>
              <input id="auth-basic-password" type="password" value="${authCreds.password || ''}" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="password"></div>
          </div>

          <!-- Custom Header 필드 -->
          <div id="auth-fields-CUSTOM_HEADER" class="grid grid-cols-2 gap-4 ${ch.auth_type === 'CUSTOM_HEADER' ? '' : 'hidden'}">
            <div><label class="block text-xs text-gray-500 mb-1">헤더 이름</label>
              <input id="auth-custom-header-name" value="${authCreds.header_name || ''}" class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="X-Custom-Auth"></div>
            <div><label class="block text-xs text-gray-500 mb-1">헤더 값</label>
              <input id="auth-custom-header-value" type="password" value="${authCreds.header_value || ''}" class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="auth-value"></div>
          </div>
        </div>

        <!-- 추가 헤더 -->
        <div class="border rounded-xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-gray-700 text-sm"><i class="fas fa-list mr-1"></i>추가 요청 헤더</h4>
            <button onclick="addRequestHeader()" class="text-xs text-indigo-600 hover:underline"><i class="fas fa-plus mr-1"></i>헤더 추가</button>
          </div>
          <div id="request-headers-list" class="space-y-2">
            ${(requestHeaders.length > 0 ? requestHeaders : []).map((h, i) => `
              <div class="flex gap-2 items-center" data-header-idx="${i}">
                <input value="${h.key || ''}" placeholder="Header-Name" class="flex-1 border rounded-lg px-3 py-1.5 text-sm font-mono header-key">
                <input value="${h.value || ''}" placeholder="Header-Value" class="flex-1 border rounded-lg px-3 py-1.5 text-sm font-mono header-value">
                <button onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600"><i class="fas fa-times"></i></button>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 응답 설정 -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs text-gray-500 mb-1">응답 형식</label>
            <select id="ch-response-type" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="JSON" ${ch.response_type === 'JSON' ? 'selected' : ''}>JSON</option>
              <option value="XML" ${ch.response_type === 'XML' ? 'selected' : ''}>XML</option>
              <option value="CSV" ${ch.response_type === 'CSV' ? 'selected' : ''}>CSV</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">데이터 경로 (주문 배열 위치)</label>
            <input id="ch-data-path" value="${ch.data_path && ch.data_path !== 'null' ? ch.data_path : ''}" 
              class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="data.orders 또는 result.list">
          </div>
        </div>

        <!-- POST 바디 템플릿 -->
        <div id="post-body-section" class="${ch.api_method === 'POST' ? '' : 'hidden'}">
          <label class="block text-xs text-gray-500 mb-1">POST 요청 바디 템플릿 (JSON)</label>
          <textarea id="ch-request-body" rows="4" class="w-full border rounded-lg px-3 py-2 text-sm font-mono"
            placeholder='{"page": 1, "limit": 100, "date": "2026-03-06"}'>${ch.request_body_template && ch.request_body_template !== 'null' ? ch.request_body_template : ''}</textarea>
        </div>

        <!-- 액션 버튼 -->
        <div class="flex gap-3 pt-2">
          <button onclick="saveChannelApiConfig(${channelId})" class="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition font-medium">
            <i class="fas fa-save mr-1"></i>API 설정 저장
          </button>
          <button onclick="testChannelApi(${channelId})" class="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition font-medium">
            <i class="fas fa-vial mr-1"></i>API 연결 테스트
          </button>
          <button onclick="syncChannel(${channelId})" class="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition font-medium">
            <i class="fas fa-sync mr-1"></i>동기화 실행
          </button>
        </div>

        <!-- 테스트 결과 표시 영역 -->
        <div id="api-test-result" class="hidden"></div>
      </div>

      <!-- 탭 2: 필드 매핑 -->
      <div id="panel-field-mapping" class="hidden space-y-4">
        <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700">
          <i class="fas fa-exclamation-triangle mr-1"></i>
          외부 API 응답의 필드명을 OMS 내부 필드에 매핑합니다. 
          <strong>외부필드명</strong>에 API 응답의 JSON 키를 입력하세요. 
          중첩 경로는 점(.)으로 구분합니다. (예: <code>customer.name</code>)
        </div>
        
        <div class="bg-white rounded-xl border overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50">
                <th class="text-left px-4 py-3 font-medium text-gray-600">OMS 필드</th>
                <th class="text-left px-4 py-3 font-medium text-gray-600">외부 API 필드명</th>
                <th class="text-center px-4 py-3 font-medium text-gray-600">필수</th>
              </tr>
            </thead>
            <tbody id="field-mapping-table">
              ${INTERNAL_FIELDS.map(f => `
                <tr class="border-t hover:bg-gray-50">
                  <td class="px-4 py-3">
                    <span class="font-medium text-gray-700">${f.label}</span>
                    <span class="text-xs text-gray-400 ml-1 font-mono">${f.key}</span>
                  </td>
                  <td class="px-4 py-3">
                    <input data-internal="${f.key}" value="${fieldMapping[Object.keys(fieldMapping).find(k => fieldMapping[k] === f.key) || ''] ? Object.keys(fieldMapping).find(k => fieldMapping[k] === f.key) : ''}"
                      class="w-full border rounded-lg px-3 py-1.5 text-sm font-mono field-mapping-input" 
                      placeholder="예: orderNo, customer.name">
                  </td>
                  <td class="px-4 py-3 text-center">
                    ${f.required ? '<i class="fas fa-check-circle text-red-500"></i>' : '<i class="fas fa-minus text-gray-300"></i>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="flex gap-3">
          <button onclick="saveFieldMapping(${channelId})" class="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition font-medium">
            <i class="fas fa-save mr-1"></i>매핑 저장
          </button>
          <button onclick="previewFieldMapping(${channelId})" class="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition font-medium">
            <i class="fas fa-eye mr-1"></i>매핑 미리보기
          </button>
        </div>

        <div id="mapping-preview-result" class="hidden"></div>
      </div>

      <!-- 탭 3: 동기화 현황 -->
      <div id="panel-sync-history" class="hidden space-y-4">
        <div class="grid grid-cols-4 gap-4">
          <div class="bg-white rounded-xl border p-4 text-center">
            <div class="text-xs text-gray-500 mb-1">마지막 동기화</div>
            <div class="text-sm font-bold">${ch.last_sync_at && ch.last_sync_at !== 'null' ? ch.last_sync_at.substring(0, 16) : '-'}</div>
          </div>
          <div class="bg-white rounded-xl border p-4 text-center">
            <div class="text-xs text-gray-500 mb-1">마지막 상태</div>
            <div class="${ch.last_sync_status ? `status-badge ${SYNC_STATUS_BADGE[ch.last_sync_status] || ''}` : 'text-gray-400'}">${ch.last_sync_status || '-'}</div>
          </div>
          <div class="bg-white rounded-xl border p-4 text-center">
            <div class="text-xs text-gray-500 mb-1">마지막 건수</div>
            <div class="text-sm font-bold">${ch.last_sync_count || 0}건</div>
          </div>
          <div class="bg-white rounded-xl border p-4 text-center">
            <div class="text-xs text-gray-500 mb-1">누적 동기화</div>
            <div class="text-sm font-bold text-indigo-600">${(ch.total_synced_count || 0).toLocaleString()}건</div>
          </div>
        </div>
        ${ch.last_sync_message && ch.last_sync_message !== 'null' ? `
        <div class="bg-gray-50 rounded-xl p-4">
          <div class="text-xs text-gray-500 mb-1">마지막 동기화 메시지</div>
          <div class="text-sm">${ch.last_sync_message}</div>
        </div>` : ''}
        <div class="text-center text-gray-400 py-8">
          <i class="fas fa-clock text-4xl mb-3"></i>
          <p>동기화를 실행하면 여기에 결과가 표시됩니다.</p>
        </div>
      </div>
    </div>`;

  showModal(`<i class="fas fa-cog mr-2"></i>${ch.name} — API 연동 설정`, content, `
    <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm">닫기</button>`, 'max-w-4xl');
  
  // POST 메서드 선택 시 바디 섹션 토글
  document.getElementById('ch-api-method')?.addEventListener('change', function() {
    document.getElementById('post-body-section').classList.toggle('hidden', this.value !== 'POST');
  });

  } catch (e) {
  console.error('[openChannelDetail]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

function switchChannelTab(tabId) {
  ['api-config', 'field-mapping', 'sync-history'].forEach(t => {
    document.getElementById(`tab-${t}`)?.classList.toggle('border-indigo-600', t === tabId);
    document.getElementById(`tab-${t}`)?.classList.toggle('text-indigo-600', t === tabId);
    document.getElementById(`tab-${t}`)?.classList.toggle('border-transparent', t !== tabId);
    document.getElementById(`tab-${t}`)?.classList.toggle('text-gray-500', t !== tabId);
    document.getElementById(`panel-${t}`)?.classList.toggle('hidden', t !== tabId);
  });
}

function toggleAuthFields() {
  const type = document.getElementById('ch-auth-type')?.value;
  ['API_KEY', 'BEARER', 'BASIC', 'CUSTOM_HEADER'].forEach(t => {
    document.getElementById(`auth-fields-${t}`)?.classList.toggle('hidden', t !== type);
  });
}

function addRequestHeader() {
  const container = document.getElementById('request-headers-list');
  if (!container) return;
  const idx = container.children.length;
  const div = document.createElement('div');
  div.className = 'flex gap-2 items-center';
  div.innerHTML = `
    <input placeholder="Header-Name" class="flex-1 border rounded-lg px-3 py-1.5 text-sm font-mono header-key">
    <input placeholder="Header-Value" class="flex-1 border rounded-lg px-3 py-1.5 text-sm font-mono header-value">
    <button onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600"><i class="fas fa-times"></i></button>`;
  container.appendChild(div);
}

// ─── API 설정 저장 ───
async function saveChannelApiConfig(channelId) {
  try {
  const authType = document.getElementById('ch-auth-type')?.value || 'NONE';
  let authCredentials = null;

  switch (authType) {
    case 'API_KEY':
      authCredentials = { header_name: document.getElementById('auth-header-name')?.value, api_key: document.getElementById('auth-api-key')?.value };
      break;
    case 'BEARER':
      authCredentials = { token: document.getElementById('auth-bearer-token')?.value };
      break;
    case 'BASIC':
      authCredentials = { username: document.getElementById('auth-basic-username')?.value, password: document.getElementById('auth-basic-password')?.value };
      break;
    case 'CUSTOM_HEADER':
      authCredentials = { header_name: document.getElementById('auth-custom-header-name')?.value, header_value: document.getElementById('auth-custom-header-value')?.value };
      break;
  }

  // 추가 헤더 수집
  const headerRows = document.querySelectorAll('#request-headers-list > div');
  const requestHeaders = [];
  headerRows.forEach(row => {
    const key = row.querySelector('.header-key')?.value?.trim();
    const value = row.querySelector('.header-value')?.value?.trim();
    if (key && value) requestHeaders.push({ key, value });
  });

  const data = {
    api_endpoint: document.getElementById('ch-api-endpoint')?.value?.trim() || null,
    api_method: document.getElementById('ch-api-method')?.value || 'GET',
    auth_type: authType,
    auth_credentials: authCredentials,
    request_headers: requestHeaders.length > 0 ? requestHeaders : null,
    request_body_template: document.getElementById('ch-request-body')?.value?.trim() || null,
    response_type: document.getElementById('ch-response-type')?.value || 'JSON',
    data_path: document.getElementById('ch-data-path')?.value?.trim() || null,
  };

  const res = await api('PUT', `/hr/channels/${channelId}`, data);
  if (res?.ok) showToast('API 설정이 저장되었습니다.', 'success');
  else showToast(res?.error || 'API 설정 저장 실패', 'error');

  } catch (e) {
  console.error('[saveChannelApiConfig]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ─── API 연결 테스트 ───
async function testChannelApi(channelId) {
  try {
  const resultEl = document.getElementById('api-test-result');
  if (!resultEl) return;
  
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `<div class="bg-gray-50 rounded-xl p-4 animate-pulse text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>API 테스트 중...</div>`;

  // 먼저 현재 설정을 저장
  await saveChannelApiConfig(channelId);

  const res = await api('POST', `/hr/channels/${channelId}/test-api`);

  if (res?.ok) {
    const r = res.test_result;
    resultEl.innerHTML = `
      <div class="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
        <div class="flex items-center gap-2 text-green-700 font-bold">
          <i class="fas fa-check-circle"></i>API 연결 성공
        </div>
        <div class="grid grid-cols-4 gap-3 text-sm">
          <div><span class="text-gray-500">상태 코드:</span> <strong>${r.status_code}</strong> ${r.status_text}</div>
          <div><span class="text-gray-500">응답 시간:</span> <strong>${r.response_time_ms}ms</strong></div>
          <div><span class="text-gray-500">응답 크기:</span> <strong>${(r.body_size / 1024).toFixed(1)}KB</strong></div>
          <div><span class="text-gray-500">데이터 건수:</span> <strong class="text-indigo-600">${r.record_count}건</strong></div>
        </div>
        <div>
          <div class="text-xs text-gray-500 mb-1">응답 미리보기:</div>
          <pre class="bg-white border rounded-lg p-3 text-xs font-mono overflow-auto max-h-48">${escapeHtml(r.body_preview || '')}</pre>
        </div>
      </div>`;
  } else {
    const r = res?.test_result || {};
    resultEl.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-xl p-4">
        <div class="flex items-center gap-2 text-red-700 font-bold mb-2">
          <i class="fas fa-times-circle"></i>API 연결 실패
        </div>
        <div class="text-sm text-red-600">${r.error || res?.error || '알 수 없는 오류'}</div>
        ${r.error_type ? `<div class="text-xs text-gray-400 mt-1">에러 유형: ${r.error_type}</div>` : ''}
      </div>`;
  }

  } catch (e) {
  console.error('[testChannelApi]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ─── 필드 매핑 저장 ───
async function saveFieldMapping(channelId) {
  try {
  const mapping = {};
  document.querySelectorAll('.field-mapping-input').forEach(input => {
    const externalKey = input.value?.trim();
    const internalKey = input.dataset.internal;
    if (externalKey && internalKey) {
      mapping[externalKey] = internalKey;
    }
  });

  const res = await api('PUT', `/hr/channels/${channelId}`, { field_mapping: mapping });
  if (res?.ok) showToast('필드 매핑이 저장되었습니다.', 'success');
  else showToast(res?.error || '매핑 저장 실패', 'error');

  } catch (e) {
  console.error('[saveFieldMapping]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ─── 매핑 미리보기 (API 테스트 → 매핑 적용) ───
async function previewFieldMapping(channelId) {
  try {
  const resultEl = document.getElementById('mapping-preview-result');
  if (!resultEl) return;

  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `<div class="bg-gray-50 rounded-xl p-4 animate-pulse text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>매핑 미리보기 로딩 중...</div>`;

  // 먼저 매핑 저장
  await saveFieldMapping(channelId);

  // API 테스트로 데이터 가져오기
  const res = await api('POST', `/hr/channels/${channelId}/test-api`);
  if (!res?.ok) {
    resultEl.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600"><i class="fas fa-times-circle mr-1"></i>API 연결에 실패하여 미리보기를 할 수 없습니다.</div>`;
    return;
  }

  try {
    const parsed = JSON.parse(res.test_result.body_preview);
    const channelRes = await api('GET', `/hr/channels/${channelId}`);
    const ch = channelRes?.channel;
    const fm = ch?.field_mapping ? (typeof ch.field_mapping === 'string' ? JSON.parse(ch.field_mapping) : ch.field_mapping) : {};
    const dataPath = ch?.data_path;

    let orders = dataPath ? getNestedPreview(parsed, dataPath) : (Array.isArray(parsed) ? parsed : [parsed]);
    if (!Array.isArray(orders)) orders = [orders];
    const sample = orders.slice(0, 3);

    resultEl.innerHTML = `
      <div class="bg-white border rounded-xl overflow-hidden">
        <div class="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600">매핑 미리보기 (처음 ${sample.length}건)</div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-gray-50 border-t">
                ${INTERNAL_FIELDS.slice(0, 6).map(f => `<th class="px-3 py-2 text-left">${f.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${sample.map(row => {
                const mapped = {};
                for (const [ext, int] of Object.entries(fm)) { mapped[int] = getNestedPreview(row, ext); }
                return `<tr class="border-t hover:bg-gray-50">
                  ${INTERNAL_FIELDS.slice(0, 6).map(f => `<td class="px-3 py-2 ${mapped[f.key] ? '' : 'text-gray-300'}">${mapped[f.key] ?? '-'}</td>`).join('')}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (e) {
    resultEl.innerHTML = `<div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-700"><i class="fas fa-exclamation-triangle mr-1"></i>응답 데이터 파싱 실패: ${e.message}</div>`;
  }

  } catch (e) {
  console.error('[previewFieldMapping]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

function getNestedPreview(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

// ─── 동기화 실행 ───
async function syncChannel(channelId) {
  try {
  showConfirmModal('주문 동기화', '외부 API에서 주문을 가져오시겠습니까?<br><small class="text-gray-500">중복 주문은 자동으로 건너뜁니다.</small>',
    async () => {
      showToast('동기화 실행 중...', 'info');

      // 먼저 설정 저장
      await saveChannelApiConfig(channelId);

      const res = await api('POST', `/hr/channels/${channelId}/sync`);
      if (res?.ok || res?.sync_result) {
        const r = res.sync_result;
        const statusIcon = r.status === 'SUCCESS' ? 'fa-check-circle text-green-600' : r.status === 'PARTIAL' ? 'fa-exclamation-circle text-yellow-600' : 'fa-times-circle text-red-600';
        
        showToast(`동기화 ${r.status}: ${r.message}`, r.status === 'SUCCESS' ? 'success' : r.status === 'PARTIAL' ? 'warning' : 'error');

        // 결과를 테스트 결과 영역에 표시
        const resultEl = document.getElementById('api-test-result');
        if (resultEl) {
          resultEl.classList.remove('hidden');
          resultEl.innerHTML = `
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <div class="flex items-center gap-2 font-bold">
                <i class="fas ${statusIcon}"></i>동기화 결과: ${r.status}
              </div>
              <div class="text-sm">${r.message}</div>
              ${r.errors?.length > 0 ? `
              <details class="text-xs text-gray-600">
                <summary class="cursor-pointer hover:text-gray-800">오류 상세 (${r.errors.length}건)</summary>
                <ul class="mt-2 space-y-1 pl-4">${r.errors.map(e => `<li>• ${e}</li>`).join('')}</ul>
              </details>` : ''}
            </div>`;
        }
      } else {
        showToast(res?.error || '동기화 실패', 'error');
      }
    }, '동기화 실행', 'bg-blue-600');

  } catch (e) {
  console.error('[syncChannel]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ─── 단일 필드 업데이트 ───
async function updateChannelField(channelId, field, value) {
  try {
  const data = {};
  data[field] = value;
  const res = await api('PUT', `/hr/channels/${channelId}`, data);
  if (res?.ok) showToast('설정이 변경되었습니다.', 'success');
  else showToast(res?.error || '변경 실패', 'error');

  } catch (e) {
  console.error('[updateChannelField]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ─── HTML 이스케이프 ───
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
