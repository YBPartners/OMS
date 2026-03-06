// ============================================================
// 와이비 OMS — 배너/광고 관리 페이지 v1.0
// SUPER_ADMIN 전용 — 배너 CRUD, 순서 관리, 광고 설정, 통계
// ============================================================

const _bannerAdmin = {
  page: 1,
  position: '',
  status: '',
  tab: 'banners', // banners, settings, stats
};

async function renderBannerManage(el) {
  try {
    el.innerHTML = `
      <div class="fade-in">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-gray-800">
            <i class="fas fa-rectangle-ad mr-2 text-blue-600"></i>광고 관리
          </h2>
          <button onclick="openBannerCreateModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
            <i class="fas fa-plus mr-1"></i>배너 추가
          </button>
        </div>

        <!-- 탭 -->
        <div class="flex border-b border-gray-200 mb-6 gap-1">
          <button onclick="_bannerAdmin.tab='banners';renderBannerManage(document.getElementById('content'))" 
                  class="px-5 py-2.5 text-sm font-medium transition ${_bannerAdmin.tab === 'banners' ? 'tab-active text-blue-600' : 'text-gray-500 hover:text-gray-700'}">
            <i class="fas fa-images mr-1"></i>배너 관리
          </button>
          <button onclick="_bannerAdmin.tab='settings';renderBannerManage(document.getElementById('content'))" 
                  class="px-5 py-2.5 text-sm font-medium transition ${_bannerAdmin.tab === 'settings' ? 'tab-active text-blue-600' : 'text-gray-500 hover:text-gray-700'}">
            <i class="fas fa-cog mr-1"></i>광고 설정
          </button>
          <button onclick="_bannerAdmin.tab='stats';renderBannerManage(document.getElementById('content'))" 
                  class="px-5 py-2.5 text-sm font-medium transition ${_bannerAdmin.tab === 'stats' ? 'tab-active text-blue-600' : 'text-gray-500 hover:text-gray-700'}">
            <i class="fas fa-chart-bar mr-1"></i>통계
          </button>
        </div>

        <div id="banner-manage-content"></div>
      </div>`;

    const contentEl = document.getElementById('banner-manage-content');
    if (!contentEl) return;

    switch (_bannerAdmin.tab) {
      case 'banners': await renderBannerList(contentEl); break;
      case 'settings': await renderAdSettingsPanel(contentEl); break;
      case 'stats': await renderBannerStats(contentEl); break;
    }
  } catch (err) {
    console.error('[BannerManage] Error:', err);
    el.innerHTML = `<div class="text-center py-16 text-red-400"><i class="fas fa-exclamation-triangle text-4xl mb-4"></i><p>광고 관리 페이지 로드 중 오류</p></div>`;
  }
}

// ─── 배너 목록 ───
async function renderBannerList(el) {
  showSkeletonLoading(el, 'table');

  const params = new URLSearchParams();
  params.set('page', String(_bannerAdmin.page));
  params.set('limit', '20');
  if (_bannerAdmin.position) params.set('position', _bannerAdmin.position);
  if (_bannerAdmin.status) params.set('status', _bannerAdmin.status);

  const res = await api('GET', `/banners/admin/list?${params}`);
  if (!res) return;

  const posLabels = {
    dashboard_top: '대시보드 상단',
    sidebar_bottom: '사이드바 하단',
    content_between: '컨텐츠 사이',
    login_page: '로그인 페이지',
  };

  el.innerHTML = `
    <!-- 필터 -->
    <div class="flex flex-wrap gap-3 mb-4">
      <select onchange="_bannerAdmin.position=this.value;_bannerAdmin.page=1;renderBannerList(document.getElementById('banner-manage-content'))" 
              class="px-3 py-2 border rounded-lg text-sm">
        <option value="" ${!_bannerAdmin.position ? 'selected' : ''}>전체 위치</option>
        <option value="dashboard_top" ${_bannerAdmin.position === 'dashboard_top' ? 'selected' : ''}>대시보드 상단</option>
        <option value="sidebar_bottom" ${_bannerAdmin.position === 'sidebar_bottom' ? 'selected' : ''}>사이드바 하단</option>
        <option value="content_between" ${_bannerAdmin.position === 'content_between' ? 'selected' : ''}>컨텐츠 사이</option>
        <option value="login_page" ${_bannerAdmin.position === 'login_page' ? 'selected' : ''}>로그인 페이지</option>
      </select>
      <select onchange="_bannerAdmin.status=this.value;_bannerAdmin.page=1;renderBannerList(document.getElementById('banner-manage-content'))" 
              class="px-3 py-2 border rounded-lg text-sm">
        <option value="" ${!_bannerAdmin.status ? 'selected' : ''}>전체 상태</option>
        <option value="active" ${_bannerAdmin.status === 'active' ? 'selected' : ''}>활성</option>
        <option value="inactive" ${_bannerAdmin.status === 'inactive' ? 'selected' : ''}>비활성</option>
      </select>
      <span class="text-sm text-gray-500 py-2">총 ${res.total}개</span>
    </div>

    <!-- 배너 카드 그리드 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${(res.banners || []).map(b => `
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition ${!b.is_active ? 'opacity-60' : ''}">
          <!-- 미리보기 영역 -->
          <div class="h-32 relative overflow-hidden bg-gray-100">
            ${b.image_url ? `<img src="${b.image_url}" class="w-full h-full object-cover" alt="${b.title}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 160%22><rect fill=%22%23f1f5f9%22 width=%22400%22 height=%22160%22/><text fill=%22%2394a3b8%22 x=%22200%22 y=%2290%22 text-anchor=%22middle%22 font-size=%2216%22>이미지 로드 실패</text></svg>'">` 
              : b.image_base64 ? `<img src="${b.image_base64}" class="w-full h-full object-cover" alt="${b.title}">` 
              : `<div class="w-full h-full flex items-center justify-center p-4" style="background:${b.bg_color || '#f0f9ff'};color:${b.text_color || '#000'}">
                  <div class="text-center text-sm">${b.text_content || b.title}</div>
                </div>`}
            <div class="absolute top-2 left-2 flex gap-1">
              <span class="px-2 py-0.5 bg-black/50 text-white text-[10px] rounded-full">${posLabels[b.position] || b.position}</span>
              ${b.is_active ? '<span class="px-2 py-0.5 bg-green-500 text-white text-[10px] rounded-full">활성</span>' : '<span class="px-2 py-0.5 bg-red-500 text-white text-[10px] rounded-full">비활성</span>'}
            </div>
            <div class="absolute top-2 right-2">
              <span class="px-2 py-0.5 bg-black/40 text-white text-[10px] rounded-full">순서: ${b.sort_order}</span>
            </div>
          </div>
          <!-- 정보 -->
          <div class="p-4">
            <div class="font-semibold text-gray-800 text-sm mb-1 truncate">${b.title}</div>
            <div class="text-xs text-gray-500 mb-2">
              ${b.link_url ? `<i class="fas fa-link mr-1"></i>${b.link_url.substring(0, 35)}${b.link_url.length > 35 ? '...' : ''}` : '<i class="fas fa-ban mr-1"></i>링크 없음'}
            </div>
            <div class="flex items-center gap-3 text-xs text-gray-400 mb-3">
              <span><i class="fas fa-eye mr-1"></i>${(b.view_count || 0).toLocaleString()}</span>
              <span><i class="fas fa-mouse-pointer mr-1"></i>${(b.click_count || 0).toLocaleString()}</span>
              ${b.start_date ? `<span><i class="fas fa-calendar mr-1"></i>${b.start_date.substring(0, 10)}</span>` : ''}
            </div>
            <!-- 액션 버튼 -->
            <div class="flex gap-2">
              <button onclick="toggleBannerActiveStatus(${b.banner_id})" 
                      class="flex-1 px-3 py-1.5 text-xs rounded-lg transition ${b.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}">
                <i class="fas ${b.is_active ? 'fa-eye-slash' : 'fa-eye'} mr-1"></i>${b.is_active ? '비활성화' : '활성화'}
              </button>
              <button onclick="openBannerEditModal(${b.banner_id})" 
                      class="flex-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">
                <i class="fas fa-edit mr-1"></i>편집
              </button>
              <button onclick="deleteBanner(${b.banner_id},'${b.title.replace(/'/g, "\\'")}')" 
                      class="px-3 py-1.5 text-xs bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 transition">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    ${res.banners.length === 0 ? `
      <div class="text-center py-16">
        <i class="fas fa-rectangle-ad text-5xl text-gray-300 mb-4"></i>
        <p class="text-gray-500">등록된 배너가 없습니다.</p>
        <button onclick="openBannerCreateModal()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
          <i class="fas fa-plus mr-1"></i>첫 배너 등록하기
        </button>
      </div>` : ''}

    ${res.total_pages > 1 ? `
      <div class="flex justify-center gap-2 mt-6">
        ${Array.from({ length: Math.min(res.total_pages, 10) }, (_, i) => i + 1).map(p => `
          <button onclick="_bannerAdmin.page=${p};renderBannerList(document.getElementById('banner-manage-content'))" 
                  class="px-3 py-1.5 rounded-lg text-sm ${p === res.page ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">${p}</button>
        `).join('')}
      </div>` : ''}`;
}

// ─── 배너 생성/편집 모달 ───
async function openBannerCreateModal(banner = null) {
  const isEdit = banner !== null;
  const b = banner || {};

  showModal(
    isEdit ? '배너 수정' : '새 배너 등록',
    `<div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">배너 제목 *</label>
        <input id="bn-title" type="text" value="${b.title || ''}" maxlength="100"
               class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="관리용 배너 제목">
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">위치 *</label>
          <select id="bn-position" class="w-full px-3 py-2 border rounded-lg text-sm">
            <option value="dashboard_top" ${b.position === 'dashboard_top' ? 'selected' : ''}>대시보드 상단 (최고 노출)</option>
            <option value="sidebar_bottom" ${b.position === 'sidebar_bottom' ? 'selected' : ''}>사이드바 하단</option>
            <option value="content_between" ${b.position === 'content_between' ? 'selected' : ''}>컨텐츠 사이</option>
            <option value="login_page" ${b.position === 'login_page' ? 'selected' : ''}>로그인 페이지</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">정렬 순서</label>
          <input id="bn-sort" type="number" value="${b.sort_order ?? 0}" min="0"
                 class="w-full px-3 py-2 border rounded-lg text-sm num-input" placeholder="0 (낮을수록 먼저)">
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">이미지 URL</label>
        <input id="bn-image-url" type="url" value="${b.image_url || ''}"
               class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://example.com/banner.jpg">
        <p class="text-xs text-gray-400 mt-1">이미지 URL 또는 아래 텍스트 내용 중 하나 입력</p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">또는 이미지 파일 업로드 (Base64)</label>
        <input id="bn-image-file" type="file" accept="image/*" onchange="handleBannerImageUpload(event)"
               class="w-full px-3 py-2 border rounded-lg text-sm">
        <input id="bn-image-base64" type="hidden" value="">
        ${b.image_base64 ? '<p class="text-xs text-green-600 mt-1"><i class="fas fa-check mr-1"></i>기존 Base64 이미지 있음</p>' : ''}
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">텍스트 내용 (HTML 지원)</label>
        <textarea id="bn-text" rows="3" class="w-full px-3 py-2 border rounded-lg text-sm" 
                  placeholder="<h3>프로모션 안내</h3><p>자세히 보기 →</p>">${b.text_content || ''}</textarea>
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">배경색</label>
          <div class="flex gap-2">
            <input id="bn-bg" type="color" value="${b.bg_color || '#ffffff'}" class="w-10 h-10 rounded cursor-pointer border">
            <input type="text" value="${b.bg_color || '#ffffff'}" class="flex-1 px-2 py-1 border rounded text-xs" 
                   oninput="document.getElementById('bn-bg').value=this.value" readonly>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">텍스트 색상</label>
          <div class="flex gap-2">
            <input id="bn-tc" type="color" value="${b.text_color || '#000000'}" class="w-10 h-10 rounded cursor-pointer border">
            <input type="text" value="${b.text_color || '#000000'}" class="flex-1 px-2 py-1 border rounded text-xs" readonly>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">링크 타겟</label>
          <select id="bn-target" class="w-full px-3 py-2 border rounded-lg text-sm">
            <option value="_blank" ${b.link_target === '_blank' ? 'selected' : ''}>새 탭</option>
            <option value="_self" ${b.link_target === '_self' ? 'selected' : ''}>현재 탭</option>
          </select>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">클릭 시 이동 URL</label>
        <input id="bn-link" type="url" value="${b.link_url || ''}"
               class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://example.com/promo">
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">노출 시작일</label>
          <input id="bn-start" type="datetime-local" value="${b.start_date ? b.start_date.replace(' ', 'T').substring(0, 16) : ''}"
                 class="w-full px-3 py-2 border rounded-lg text-sm">
          <p class="text-xs text-gray-400 mt-1">비어있으면 즉시 노출</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">노출 종료일</label>
          <input id="bn-end" type="datetime-local" value="${b.end_date ? b.end_date.replace(' ', 'T').substring(0, 16) : ''}"
                 class="w-full px-3 py-2 border rounded-lg text-sm">
          <p class="text-xs text-gray-400 mt-1">비어있으면 무기한</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <input id="bn-active" type="checkbox" ${b.is_active !== 0 ? 'checked' : ''} class="rounded">
        <label for="bn-active" class="text-sm text-gray-700">활성 상태</label>
      </div>
    </div>`,
    `<div class="flex gap-2">
      <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">취소</button>
      <button onclick="saveBanner(${isEdit ? b.banner_id : 'null'})" class="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
        <i class="fas fa-save mr-1"></i>${isEdit ? '수정' : '등록'}
      </button>
    </div>`,
    { large: true }
  );
}

async function openBannerEditModal(bannerId) {
  const res = await api('GET', `/banners/admin/${bannerId}`);
  if (!res || !res.banner) { showToast('배너 정보를 불러올 수 없습니다.', 'error'); return; }
  openBannerCreateModal(res.banner);
}

// ─── 이미지 업로드 핸들러 (Base64 변환) ───
function handleBannerImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // 최대 2MB
  if (file.size > 2 * 1024 * 1024) {
    showToast('이미지 크기는 2MB 이하만 지원합니다.', 'error');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('bn-image-base64').value = e.target.result;
    showToast('이미지가 업로드되었습니다.', 'success');
  };
  reader.readAsDataURL(file);
}

// ─── 배너 저장 ───
async function saveBanner(bannerId) {
  const title = document.getElementById('bn-title')?.value?.trim();
  if (!title) { showToast('배너 제목을 입력하세요.', 'error'); return; }

  const imageUrl = document.getElementById('bn-image-url')?.value?.trim();
  const imageBase64 = document.getElementById('bn-image-base64')?.value || '';
  const textContent = document.getElementById('bn-text')?.value?.trim();

  if (!imageUrl && !imageBase64 && !textContent) {
    showToast('이미지 URL, 이미지 파일, 텍스트 내용 중 하나는 필수입니다.', 'error');
    return;
  }

  const payload = {
    title,
    image_url: imageUrl || null,
    image_base64: imageBase64 || null,
    link_url: document.getElementById('bn-link')?.value?.trim() || null,
    link_target: document.getElementById('bn-target')?.value || '_blank',
    position: document.getElementById('bn-position')?.value || 'dashboard_top',
    bg_color: document.getElementById('bn-bg')?.value || '#ffffff',
    text_content: textContent || null,
    text_color: document.getElementById('bn-tc')?.value || '#000000',
    sort_order: parseInt(document.getElementById('bn-sort')?.value || '0') || 0,
    is_active: document.getElementById('bn-active')?.checked ? 1 : 0,
    start_date: document.getElementById('bn-start')?.value ? document.getElementById('bn-start').value.replace('T', ' ') + ':00' : null,
    end_date: document.getElementById('bn-end')?.value ? document.getElementById('bn-end').value.replace('T', ' ') + ':00' : null,
  };

  let res;
  if (bannerId) {
    res = await api('PUT', `/banners/admin/${bannerId}`, payload);
  } else {
    res = await api('POST', '/banners/admin', payload);
  }

  if (res?.ok) {
    showToast(bannerId ? '배너가 수정되었습니다.' : '배너가 등록되었습니다.', 'success');
    closeModal();
    renderBannerList(document.getElementById('banner-manage-content'));
  }
}

// ─── 배너 활성/비활성 토글 ───
async function toggleBannerActiveStatus(bannerId) {
  const res = await api('PATCH', `/banners/admin/${bannerId}/toggle`);
  if (res?.ok) {
    showToast(res.message, 'success');
    renderBannerList(document.getElementById('banner-manage-content'));
  }
}

// ─── 배너 삭제 ───
async function deleteBanner(bannerId, title) {
  if (!confirm(`"${title}" 배너를 삭제하시겠습니까?`)) return;

  const res = await api('DELETE', `/banners/admin/${bannerId}`);
  if (res?.ok) {
    showToast('배너가 삭제되었습니다.', 'success');
    renderBannerList(document.getElementById('banner-manage-content'));
  }
}

// ─── 광고 설정 패널 ───
async function renderAdSettingsPanel(el) {
  showSkeletonLoading(el, 'cards');

  const res = await api('GET', '/banners/admin/settings/all');
  if (!res) return;

  const settings = {};
  for (const s of (res.settings || [])) {
    settings[s.setting_key] = s;
  }

  el.innerHTML = `
    <div class="max-w-2xl space-y-6">
      <!-- 내부 배너 설정 -->
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h3 class="font-semibold text-gray-800 mb-4"><i class="fas fa-images mr-2 text-blue-600"></i>내부 배너 설정</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-700">내부 배너 시스템</p>
              <p class="text-xs text-gray-400">슬라이딩 배너 활성화/비활성화</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="set-banner-enabled" class="sr-only peer" ${settings.banner_enabled?.setting_value === '1' ? 'checked' : ''}>
              <div class="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">자동 전환 간격 (ms)</label>
            <input id="set-autoplay" type="number" min="2000" max="30000" step="500"
                   value="${settings.banner_autoplay_interval?.setting_value || '5000'}"
                   class="w-full px-3 py-2 border rounded-lg text-sm num-input">
            <p class="text-xs text-gray-400 mt-1">최소 2000ms (2초), 최대 30000ms (30초)</p>
          </div>
        </div>
      </div>

      <!-- 구글 애드센스 설정 -->
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h3 class="font-semibold text-gray-800 mb-4"><i class="fab fa-google mr-2 text-red-500"></i>Google AdSense 설정</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-700">Google AdSense 활성화</p>
              <p class="text-xs text-gray-400">사이트에 구글 광고 표시</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="set-adsense-enabled" class="sr-only peer" ${settings.adsense_enabled?.setting_value === '1' ? 'checked' : ''}>
              <div class="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">AdSense 클라이언트 ID</label>
            <input id="set-adsense-client" type="text" value="${settings.adsense_client_id?.setting_value || ''}"
                   class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="ca-pub-XXXXXXXXXXXXXXXXXX">
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">대시보드 슬롯 ID</label>
              <input id="set-slot-dashboard" type="text" value="${settings.adsense_slot_dashboard?.setting_value || ''}"
                     class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="1234567890">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">사이드바 슬롯 ID</label>
              <input id="set-slot-sidebar" type="text" value="${settings.adsense_slot_sidebar?.setting_value || ''}"
                     class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="1234567890">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">컨텐츠 슬롯 ID</label>
              <input id="set-slot-content" type="text" value="${settings.adsense_slot_content?.setting_value || ''}"
                     class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="1234567890">
            </div>
          </div>
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p class="text-xs text-amber-700"><i class="fas fa-info-circle mr-1"></i>
              Google AdSense 계정이 필요합니다. <a href="https://www.google.com/adsense" target="_blank" class="underline">Google AdSense</a>에서 가입 후 클라이언트 ID와 슬롯 ID를 입력하세요.
            </p>
          </div>
        </div>
      </div>

      <!-- 도메인 설정 -->
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h3 class="font-semibold text-gray-800 mb-4"><i class="fas fa-globe mr-2 text-green-600"></i>도메인 설정</h3>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">서비스 도메인</label>
          <input id="set-domain" type="text" value="${settings.domain_name?.setting_value || ''}"
                 class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="www.airflow.co.kr">
        </div>
      </div>

      <!-- 저장 버튼 -->
      <div class="flex justify-end">
        <button onclick="saveAdSettings()" class="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
          <i class="fas fa-save mr-1"></i>설정 저장
        </button>
      </div>
    </div>`;
}

async function saveAdSettings() {
  const settings = {
    banner_enabled: document.getElementById('set-banner-enabled')?.checked ? '1' : '0',
    banner_autoplay_interval: document.getElementById('set-autoplay')?.value || '5000',
    adsense_enabled: document.getElementById('set-adsense-enabled')?.checked ? '1' : '0',
    adsense_client_id: document.getElementById('set-adsense-client')?.value?.trim() || '',
    adsense_slot_dashboard: document.getElementById('set-slot-dashboard')?.value?.trim() || '',
    adsense_slot_sidebar: document.getElementById('set-slot-sidebar')?.value?.trim() || '',
    adsense_slot_content: document.getElementById('set-slot-content')?.value?.trim() || '',
    domain_name: document.getElementById('set-domain')?.value?.trim() || '',
  };

  const interval = parseInt(settings.banner_autoplay_interval);
  if (isNaN(interval) || interval < 2000 || interval > 30000) {
    showToast('자동 전환 간격은 2000~30000ms 사이로 설정하세요.', 'error');
    return;
  }

  const res = await api('PUT', '/banners/admin/settings', { settings });
  if (res?.ok) {
    showToast('광고 설정이 저장되었습니다.', 'success');
    // 캐시 갱신
    _bannerState.settings = null;
  }
}

// ─── 배너 통계 ───
async function renderBannerStats(el) {
  showSkeletonLoading(el, 'cards');

  const res = await api('GET', '/banners/admin/stats');
  if (!res || !res.stats) return;

  const s = res.stats;
  const posLabels = {
    dashboard_top: '대시보드 상단',
    sidebar_bottom: '사이드바 하단',
    content_between: '컨텐츠 사이',
    login_page: '로그인 페이지',
  };

  el.innerHTML = `
    <div class="space-y-6">
      <!-- 요약 카드 -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <div class="text-xs font-medium text-gray-500 mb-2">전체 배너</div>
          <div class="text-2xl font-bold text-gray-800">${s.total}</div>
        </div>
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <div class="text-xs font-medium text-gray-500 mb-2">활성 배너</div>
          <div class="text-2xl font-bold text-green-600">${s.active}</div>
        </div>
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <div class="text-xs font-medium text-gray-500 mb-2">총 노출 수</div>
          <div class="text-2xl font-bold text-blue-600">${s.total_views.toLocaleString()}</div>
        </div>
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <div class="text-xs font-medium text-gray-500 mb-2">총 클릭 수</div>
          <div class="text-2xl font-bold text-purple-600">${s.total_clicks.toLocaleString()}</div>
        </div>
        <div class="bg-white rounded-xl p-5 border border-gray-100">
          <div class="text-xs font-medium text-gray-500 mb-2">CTR</div>
          <div class="text-2xl font-bold text-amber-600">${s.ctr}</div>
        </div>
      </div>

      <!-- 위치별 현황 -->
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h3 class="font-semibold text-gray-800 mb-4"><i class="fas fa-map-pin mr-2 text-blue-600"></i>위치별 배너 현황</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b text-left text-gray-500">
                <th class="pb-2 font-medium">위치</th>
                <th class="pb-2 font-medium text-center">전체</th>
                <th class="pb-2 font-medium text-center">활성</th>
                <th class="pb-2 font-medium text-center">비활성</th>
              </tr>
            </thead>
            <tbody>
              ${(s.by_position || []).map(p => `
                <tr class="border-b border-gray-50">
                  <td class="py-3 font-medium text-gray-700">${posLabels[p.position] || p.position}</td>
                  <td class="py-3 text-center text-gray-600">${p.count}</td>
                  <td class="py-3 text-center"><span class="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">${p.active_count}</span></td>
                  <td class="py-3 text-center"><span class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">${p.count - p.active_count}</span></td>
                </tr>
              `).join('')}
              ${(s.by_position || []).length === 0 ? '<tr><td colspan="4" class="py-8 text-center text-gray-400">데이터 없음</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>

      <!-- AdSense 안내 -->
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 class="font-semibold text-blue-800 mb-2"><i class="fab fa-google mr-2"></i>Google AdSense 수익 확인</h3>
        <p class="text-sm text-blue-700 mb-3">구글 광고 수익은 Google AdSense 대시보드에서 직접 확인할 수 있습니다.</p>
        <a href="https://www.google.com/adsense" target="_blank" 
           class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">
          <i class="fas fa-external-link-alt"></i>AdSense 대시보드 열기
        </a>
      </div>
    </div>`;
}
