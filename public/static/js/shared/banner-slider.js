// ============================================================
// Airflow OMS — 슬라이딩 배너 컴포넌트 v1.0
// 대시보드 상단, 사이드바, 컨텐츠 사이, 로그인 페이지에 자동 삽입
// 부드러운 슬라이딩 애니메이션 + 자동재생 + 수동 조작
// ============================================================

const _bannerState = {
  banners: {},  // position별 배너 데이터
  intervals: {}, // autoplay 인터벌
  currentIndex: {}, // position별 현재 인덱스
  settings: null,
  loaded: false,
};

// ─── 배너 데이터 로드 ───
async function loadBanners(position) {
  try {
    const res = await api('GET', `/banners/public?position=${position}`);
    if (res && res.banners) {
      _bannerState.banners[position] = res.banners;
      _bannerState.currentIndex[position] = 0;
    }
  } catch { /* silent */ }
}

// ─── 광고 설정 로드 ───
async function loadAdSettings() {
  if (_bannerState.settings) return _bannerState.settings;
  try {
    const res = await api('GET', '/banners/public/settings');
    if (res && res.settings) {
      _bannerState.settings = res.settings;
      return res.settings;
    }
  } catch { /* silent */ }
  return {};
}

// ─── 슬라이딩 배너 HTML 생성 ───
function renderSlidingBanner(position, options = {}) {
  const banners = _bannerState.banners[position] || [];
  if (banners.length === 0) return '';

  const settings = _bannerState.settings || {};
  const interval = parseInt(settings.banner_autoplay_interval || '5000');
  const currentIdx = _bannerState.currentIndex[position] || 0;
  const id = `banner-slider-${position}`;
  const height = options.height || (position === 'dashboard_top' ? '180px' : position === 'sidebar_bottom' ? '120px' : '140px');
  const rounded = options.rounded !== false ? 'rounded-xl' : '';

  const slides = banners.map((b, i) => {
    const bgStyle = b.image_url ? `background-image:url('${b.image_url}');background-size:cover;background-position:center;`
      : b.image_base64 ? `background-image:url('${b.image_base64}');background-size:cover;background-position:center;`
      : `background-color:${b.bg_color || '#f0f9ff'};`;

    const textHtml = b.text_content ? `
      <div class="absolute inset-0 flex items-center justify-center p-6" style="color:${b.text_color || '#000'}">
        <div class="text-center max-w-md">${b.text_content}</div>
      </div>` : '';

    const linkWrap = b.link_url
      ? `onclick="trackBannerClick(${b.banner_id},'${b.link_url}','${b.link_target || '_blank'}')" style="cursor:pointer;"`
      : '';

    return `
      <div class="banner-slide absolute inset-0 transition-all duration-700 ease-in-out ${i === currentIdx ? 'opacity-100 translate-x-0' : i < currentIdx ? 'opacity-0 -translate-x-full' : 'opacity-0 translate-x-full'}" 
           data-index="${i}" ${linkWrap}>
        <div class="w-full h-full ${rounded}" style="${bgStyle}">
          ${textHtml}
        </div>
      </div>`;
  }).join('');

  // 인디케이터 dots
  const dots = banners.length > 1 ? `
    <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
      ${banners.map((_, i) => `
        <button onclick="goToBanner('${position}',${i})" 
                class="w-2.5 h-2.5 rounded-full transition-all duration-300 ${i === currentIdx ? 'bg-white shadow-lg scale-125' : 'bg-white/50 hover:bg-white/70'}"
                aria-label="배너 ${i + 1}"></button>
      `).join('')}
    </div>` : '';

  // 좌우 화살표 (배너 2개 이상일 때)
  const arrows = banners.length > 1 ? `
    <button onclick="prevBanner('${position}')" class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center transition z-10 opacity-0 group-hover:opacity-100">
      <i class="fas fa-chevron-left text-sm"></i>
    </button>
    <button onclick="nextBanner('${position}')" class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center transition z-10 opacity-0 group-hover:opacity-100">
      <i class="fas fa-chevron-right text-sm"></i>
    </button>` : '';

  return `
    <div id="${id}" class="relative overflow-hidden ${rounded} group shadow-sm border border-gray-100 mb-6" style="height:${height}">
      <div class="relative w-full h-full">
        ${slides}
      </div>
      ${dots}
      ${arrows}
      ${banners.length > 1 ? `
        <div class="absolute top-2 right-2 z-10 flex gap-1">
          <button onclick="toggleBannerAutoplay('${position}')" id="btn-autoplay-${position}" 
                  class="w-6 h-6 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition" 
                  title="자동재생 토글">
            <i class="fas fa-pause" id="icon-autoplay-${position}"></i>
          </button>
          <span class="bg-black/30 text-white text-[10px] px-2 py-0.5 rounded-full">${currentIdx + 1}/${banners.length}</span>
        </div>` : ''}
    </div>`;
}

// ─── 배너 네비게이션 ───
function goToBanner(position, index) {
  const banners = _bannerState.banners[position] || [];
  if (index < 0 || index >= banners.length) return;
  _bannerState.currentIndex[position] = index;
  updateBannerSlides(position);
}

function nextBanner(position) {
  const banners = _bannerState.banners[position] || [];
  if (banners.length < 2) return;
  const cur = _bannerState.currentIndex[position] || 0;
  _bannerState.currentIndex[position] = (cur + 1) % banners.length;
  updateBannerSlides(position);
}

function prevBanner(position) {
  const banners = _bannerState.banners[position] || [];
  if (banners.length < 2) return;
  const cur = _bannerState.currentIndex[position] || 0;
  _bannerState.currentIndex[position] = (cur - 1 + banners.length) % banners.length;
  updateBannerSlides(position);
}

function updateBannerSlides(position) {
  const id = `banner-slider-${position}`;
  const container = document.getElementById(id);
  if (!container) return;

  const currentIdx = _bannerState.currentIndex[position] || 0;
  const slides = container.querySelectorAll('.banner-slide');

  slides.forEach((slide, i) => {
    slide.className = slide.className.replace(/opacity-\d+|translate-x-\S+|-translate-x-\S+/g, '').trim();
    if (i === currentIdx) {
      slide.classList.add('opacity-100', 'translate-x-0');
    } else if (i < currentIdx) {
      slide.classList.add('opacity-0', '-translate-x-full');
    } else {
      slide.classList.add('opacity-0', 'translate-x-full');
    }
  });

  // 인디케이터 업데이트
  const dots = container.querySelectorAll('.absolute.bottom-3 button');
  dots.forEach((dot, i) => {
    if (i === currentIdx) {
      dot.className = dot.className.replace('bg-white/50 hover:bg-white/70', 'bg-white shadow-lg scale-125');
    } else {
      dot.className = dot.className.replace('bg-white shadow-lg scale-125', 'bg-white/50 hover:bg-white/70');
    }
  });

  // 카운터 업데이트
  const counter = container.querySelector('.bg-black\\/30');
  if (counter) {
    counter.textContent = `${currentIdx + 1}/${slides.length}`;
  }
}

// ─── 자동재생 관리 ───
function startBannerAutoplay(position) {
  stopBannerAutoplay(position);
  const banners = _bannerState.banners[position] || [];
  if (banners.length < 2) return;

  const settings = _bannerState.settings || {};
  const interval = parseInt(settings.banner_autoplay_interval || '5000');

  _bannerState.intervals[position] = setInterval(() => {
    nextBanner(position);
  }, interval);

  // 아이콘 업데이트
  const icon = document.getElementById(`icon-autoplay-${position}`);
  if (icon) { icon.className = 'fas fa-pause'; }
}

function stopBannerAutoplay(position) {
  if (_bannerState.intervals[position]) {
    clearInterval(_bannerState.intervals[position]);
    delete _bannerState.intervals[position];
  }
  const icon = document.getElementById(`icon-autoplay-${position}`);
  if (icon) { icon.className = 'fas fa-play'; }
}

function stopAllBannerAutoplay() {
  Object.keys(_bannerState.intervals).forEach(pos => stopBannerAutoplay(pos));
}

function toggleBannerAutoplay(position) {
  if (_bannerState.intervals[position]) {
    stopBannerAutoplay(position);
  } else {
    startBannerAutoplay(position);
  }
}

// ─── 배너 클릭 추적 ───
function trackBannerClick(bannerId, linkUrl, target) {
  // 비동기 클릭 추적 (결과 무시)
  try {
    api('POST', `/banners/public/${bannerId}/click`);
  } catch { /* ignore */ }
  // 링크 이동
  if (linkUrl) {
    if (target === '_self') {
      window.location.href = linkUrl;
    } else {
      window.open(linkUrl, '_blank', 'noopener,noreferrer');
    }
  }
}

// ─── Google AdSense 슬롯 렌더링 ───
function renderAdSenseSlot(slotId, format = 'auto') {
  if (!slotId) return '';
  const settings = _bannerState.settings || {};
  if (settings.adsense_enabled !== '1' || !settings.adsense_client_id) return '';

  return `
    <div class="adsense-slot mb-6">
      <ins class="adsbygoogle"
           style="display:block"
           data-ad-client="${settings.adsense_client_id}"
           data-ad-slot="${slotId}"
           data-ad-format="${format}"
           data-full-width-responsive="true"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>`;
}

// ─── 대시보드용 배너+광고 통합 삽입 ───
async function renderDashboardBanners() {
  const settings = await loadAdSettings();
  const enabled = settings.banner_enabled !== '0';

  let html = '';

  // 1) 내부 슬라이딩 배너 (대시보드 상단)
  if (enabled) {
    await loadBanners('dashboard_top');
    const bannerHtml = renderSlidingBanner('dashboard_top', { height: '180px' });
    if (bannerHtml) {
      html += bannerHtml;
    } else {
      // 배너 없을 때 → 광고문의 플레이스홀더
      html += renderAdPlaceholder('dashboard_top', { height: '140px' });
    }
  } else {
    html += renderAdPlaceholder('dashboard_top', { height: '140px' });
  }

  // 2) Google AdSense (대시보드)
  const adSlot = renderAdSenseSlot(settings.adsense_slot_dashboard);
  if (adSlot) html += adSlot;

  return html;
}

// ─── 사이드바용 배너 로드 & 삽입 ───
async function renderSidebarBanner() {
  const settings = await loadAdSettings();

  let html = '';
  if (settings.banner_enabled !== '0') {
    await loadBanners('sidebar_bottom');
    const bannerHtml = renderSlidingBanner('sidebar_bottom', { height: '120px' });
    if (bannerHtml) {
      html += bannerHtml;
    } else {
      html += renderAdPlaceholder('sidebar_bottom', { height: '100px' });
    }
  } else {
    html += renderAdPlaceholder('sidebar_bottom', { height: '100px' });
  }

  const adSlot = renderAdSenseSlot(settings.adsense_slot_sidebar);
  if (adSlot) html += adSlot;

  return html;
}

// ─── 로그인 페이지용 배너 ───
async function renderLoginBanner() {
  const settings = await loadAdSettings();
  if (settings.banner_enabled === '0') return '';

  await loadBanners('login_page');

  return renderSlidingBanner('login_page', { height: '120px', rounded: true });
}

// ─── 대시보드에 배너 자동 삽입 (dashboard.js 렌더 후 호출) ───
async function injectDashboardBanners() {
  try {
    const contentEl = document.getElementById('content');
    if (!contentEl) return;

    // 대시보드 상단에 배너 삽입
    const bannerHtml = await renderDashboardBanners();
    if (bannerHtml) {
      const bannerContainer = document.createElement('div');
      bannerContainer.id = 'dashboard-banner-area';
      bannerContainer.innerHTML = bannerHtml;

      // fade-in div 내부의 첫 번째 자식(h2) 뒤에 삽입
      const fadeIn = contentEl.querySelector('.fade-in');
      if (fadeIn) {
        const h2 = fadeIn.querySelector('h2');
        if (h2 && h2.nextSibling) {
          fadeIn.insertBefore(bannerContainer, h2.nextSibling);
        } else if (fadeIn.firstChild) {
          fadeIn.insertBefore(bannerContainer, fadeIn.firstChild);
        }
      }

      // 자동재생 시작
      startBannerAutoplay('dashboard_top');
    }

    // 사이드바 배너 (데스크탑만)
    if (window.innerWidth > 768) {
      const sidebarBannerHtml = await renderSidebarBanner();
      if (sidebarBannerHtml) {
        const sidebar = document.querySelector('.desktop-sidebar nav');
        if (sidebar) {
          const sidebarBannerDiv = document.createElement('div');
          sidebarBannerDiv.className = 'px-3 mt-2';
          sidebarBannerDiv.innerHTML = sidebarBannerHtml;
          sidebar.appendChild(sidebarBannerDiv);
          startBannerAutoplay('sidebar_bottom');
        }
      }
    }
  } catch (e) {
    console.error('[Banner Inject] Error:', e);
  }
}

// ─── Google AdSense 스크립트 로드 ───
async function loadAdSenseScript() {
  const settings = await loadAdSettings();
  if (settings.adsense_enabled !== '1' || !settings.adsense_client_id) return;

  if (document.querySelector('script[src*="pagead2.googlesyndication.com"]')) return;

  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${settings.adsense_client_id}`;
  document.head.appendChild(script);
}

// ─── 광고 문의 플레이스홀더 ───
function renderAdPlaceholder(position, options = {}) {
  const height = options.height || '140px';
  const posLabels = {
    dashboard_top: '대시보드 상단',
    sidebar_bottom: '사이드바',
    content_between: '컨텐츠',
    login_page: '로그인',
  };
  const label = posLabels[position] || '';
  
  return `
    <div class="relative overflow-hidden rounded-xl group mb-6 border-2 border-dashed border-gray-200 hover:border-blue-300 transition-all cursor-pointer" 
         style="height:${height};background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 50%,#f0f9ff 100%)"
         onclick="openAdInquiryModal('${position}')">
      <div class="absolute inset-0 flex flex-col items-center justify-center text-center p-4 transition-all group-hover:scale-105">
        <div class="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors shadow-sm">
          <i class="fas fa-rectangle-ad text-blue-500 text-xl"></i>
        </div>
        <p class="text-sm font-semibold text-gray-600 group-hover:text-blue-600 transition-colors">이 자리에 광고를 게재하세요</p>
        <p class="text-xs text-gray-400 mt-1">${label} 광고 영역</p>
        <button class="mt-3 px-4 py-1.5 bg-blue-600 text-white text-xs rounded-full font-medium opacity-0 group-hover:opacity-100 transition-all shadow-md hover:bg-blue-700 transform group-hover:translate-y-0 translate-y-2">
          <i class="fas fa-paper-plane mr-1"></i>광고 문의하기
        </button>
      </div>
      <!-- 장식 요소 -->
      <div class="absolute top-3 right-3 opacity-30 group-hover:opacity-50 transition">
        <i class="fas fa-bullhorn text-blue-300 text-2xl"></i>
      </div>
    </div>`;
}

// ─── 광고 문의 모달 ───
function openAdInquiryModal(position) {
  if (!currentUser) {
    showToast('로그인 후 문의하실 수 있습니다.', 'warning');
    return;
  }

  const posLabels = {
    dashboard_top: '대시보드 상단 (최고 노출)',
    sidebar_bottom: '사이드바 하단',
    content_between: '컨텐츠 사이',
    login_page: '로그인 페이지',
  };

  showModal(
    '📢 광고 문의',
    `<div class="space-y-4">
      <div class="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <i class="fas fa-rectangle-ad text-blue-600"></i>
          </div>
          <div>
            <p class="text-sm font-semibold text-blue-800">광고 게재 위치</p>
            <p class="text-xs text-blue-600">${posLabels[position] || position}</p>
          </div>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">문의 내용 *</label>
        <textarea id="ad-inq-msg" rows="4" maxlength="500"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="광고 내용, 예산, 기간 등을 자유롭게 작성해주세요.&#10;관리자가 확인 후 연락드리겠습니다."></textarea>
        <p class="text-xs text-gray-400 mt-1 text-right"><span id="ad-inq-charcount">0</span>/500</p>
      </div>
      <div class="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
        <p><i class="fas fa-user mr-1"></i>문의자: ${currentUser.name} (${currentUser.org_name || ''})</p>
        <p class="mt-1"><i class="fas fa-info-circle mr-1"></i>문의 내용은 시스템 관리자에게 알림으로 전달됩니다.</p>
      </div>
    </div>`,
    `<div class="flex gap-2">
      <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">취소</button>
      <button onclick="submitAdInquiry('${position}')" class="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
        <i class="fas fa-paper-plane mr-1"></i>문의 전송
      </button>
    </div>`,
    { large: false }
  );

  // 글자수 카운트
  setTimeout(() => {
    const ta = document.getElementById('ad-inq-msg');
    const cnt = document.getElementById('ad-inq-charcount');
    if (ta && cnt) {
      ta.addEventListener('input', () => { cnt.textContent = ta.value.length; });
    }
  }, 100);
}

async function submitAdInquiry(position) {
  const msg = document.getElementById('ad-inq-msg')?.value?.trim();
  if (!msg || msg.length < 5) {
    showToast('문의 내용을 5자 이상 입력해주세요.', 'error');
    return;
  }

  const res = await api('POST', '/banners/public/inquiry', { position, message: msg });
  if (res?.ok) {
    showToast('광고 문의가 전송되었습니다! 관리자가 확인 후 연락드리겠습니다.', 'success');
    closeModal();
  }
}
