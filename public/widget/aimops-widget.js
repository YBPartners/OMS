/**
 * AIMOps Control Tower — Embeddable Inquiry Widget
 * 
 * Usage (place before </body>):
 *   <script src="/widget/aimops-widget.js"
 *     data-system-id="sys-006"
 *     data-system-name="정치랭크"
 *     data-tower-url="https://aimops-tower.example.com"
 *     data-position="bottom-right">
 *   </script>
 *
 * The widget auto-collects page URL, browser info, console errors,
 * and lets the user submit an inquiry to AIMOps Control Tower.
 */
(function () {
  'use strict';

  // ─── Config from script tag ──────────────────────────
  const scriptTag = document.currentScript || document.querySelector('script[data-system-id]');
  const CONFIG = {
    systemId: scriptTag?.getAttribute('data-system-id') || 'unknown',
    systemName: scriptTag?.getAttribute('data-system-name') || 'System',
    towerUrl: scriptTag?.getAttribute('data-tower-url') || '',
    position: scriptTag?.getAttribute('data-position') || 'bottom-right',
    cssUrl: scriptTag?.getAttribute('data-css-url') || '',
  };

  // ─── Auto-detect CSS path ────────────────────────────
  const cssUrl = CONFIG.cssUrl || (function () {
    if (scriptTag && scriptTag.src) {
      return scriptTag.src.replace(/aimops-widget\.js(\?.*)?$/, 'aimops-widget.css');
    }
    return '/widget/aimops-widget.css';
  })();

  // ─── Inject CSS ──────────────────────────────────────
  if (!document.querySelector('link[data-aimops-widget-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    link.setAttribute('data-aimops-widget-css', 'true');
    document.head.appendChild(link);
  }

  // ─── Console error capture ───────────────────────────
  const capturedErrors = [];
  const MAX_ERRORS = 10;
  const origError = console.error;
  console.error = function () {
    if (capturedErrors.length < MAX_ERRORS) {
      capturedErrors.push({
        message: Array.from(arguments).map(String).join(' ').slice(0, 500),
        timestamp: new Date().toISOString(),
      });
    }
    origError.apply(console, arguments);
  };
  window.addEventListener('error', function (e) {
    if (capturedErrors.length < MAX_ERRORS) {
      capturedErrors.push({
        message: (e.message || 'Unknown error') + (e.filename ? ' at ' + e.filename + ':' + e.lineno : ''),
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── Inquiry types ──────────────────────────────────
  const INQUIRY_TYPES = [
    { value: '사용법 문의', label: '사용법 문의', icon: '📖' },
    { value: '기능 오류', label: '기능 오류/버그', icon: '🐛' },
    { value: 'UI/UX 불편', label: 'UI/UX 불편', icon: '🎨' },
    { value: '성능 이슈', label: '느림/성능 이슈', icon: '🐢' },
    { value: '개선 요청', label: '기능 개선 요청', icon: '💡' },
    { value: '정책 문의', label: '정책/데이터 문의', icon: '📋' },
    { value: '시스템 장애', label: '시스템 장애', icon: '🚨' },
    { value: '기타', label: '기타', icon: '💬' },
  ];

  // ─── Gather context ──────────────────────────────────
  function getContext() {
    return {
      url: window.location.href,
      path: window.location.pathname,
      userAgent: navigator.userAgent,
      screenSize: window.innerWidth + 'x' + window.innerHeight,
      deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      timestamp: new Date().toISOString(),
      recentErrors: capturedErrors.slice(-5),
    };
  }

  // ─── Build DOM ───────────────────────────────────────
  function build() {
    // Container
    const widget = document.createElement('div');
    widget.className = 'aimops-widget';
    widget.id = 'aimops-widget';

    // Trigger button
    const trigger = document.createElement('button');
    trigger.className = 'aimops-widget-trigger';
    trigger.setAttribute('aria-label', 'AIMOps 문의하기');
    trigger.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z"/>
      </svg>
    `;

    // Panel
    const panel = document.createElement('div');
    panel.className = 'aimops-widget-panel';
    panel.innerHTML = buildPanelHTML();

    widget.appendChild(trigger);
    widget.appendChild(panel);
    document.body.appendChild(widget);

    // ─── Event bindings ──────────────────────────────
    let isOpen = false;

    trigger.addEventListener('click', function () {
      isOpen = !isOpen;
      panel.classList.toggle('open', isOpen);
      trigger.classList.toggle('open', isOpen);
      if (isOpen) updateContextDisplay();
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (isOpen && !widget.contains(e.target)) {
        isOpen = false;
        panel.classList.remove('open');
        trigger.classList.remove('open');
      }
    });

    // Submit
    const form = panel.querySelector('#aimops-inquiry-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        handleSubmit(panel);
      });
    }
  }

  function buildPanelHTML() {
    const typeOptions = INQUIRY_TYPES.map(
      t => `<option value="${t.value}">${t.icon} ${t.label}</option>`
    ).join('');

    return `
      <div class="aimops-widget-header">
        <div class="aimops-widget-header-icon">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        </div>
        <div class="aimops-widget-header-text">
          <h3>AIMOps 문의</h3>
          <p>${CONFIG.systemName}</p>
        </div>
        <div class="aimops-widget-status">
          <div class="aimops-widget-status-dot"></div>
          운영중
        </div>
      </div>

      <form id="aimops-inquiry-form">
        <div class="aimops-widget-body">
          <label class="aimops-widget-label">문의 유형</label>
          <select class="aimops-widget-select" id="aimops-type" required>
            <option value="" disabled selected>유형을 선택하세요</option>
            ${typeOptions}
          </select>

          <label class="aimops-widget-label">문의 내용</label>
          <textarea class="aimops-widget-textarea" id="aimops-content"
            placeholder="어떤 문제가 있나요? 자세히 설명해주세요..."
            required minlength="5"></textarea>

          <div class="aimops-widget-context" id="aimops-context-box">
            <div class="aimops-widget-context-title">자동 수집 정보</div>
            <div class="aimops-widget-context-row">
              <span class="aimops-widget-context-key">현재 페이지</span>
              <span class="aimops-widget-context-val" id="aimops-ctx-url">-</span>
            </div>
            <div class="aimops-widget-context-row">
              <span class="aimops-widget-context-key">디바이스</span>
              <span class="aimops-widget-context-val" id="aimops-ctx-device">-</span>
            </div>
            <div class="aimops-widget-context-row">
              <span class="aimops-widget-context-key">화면 크기</span>
              <span class="aimops-widget-context-val" id="aimops-ctx-screen">-</span>
            </div>
            <div class="aimops-widget-context-row">
              <span class="aimops-widget-context-key">콘솔 에러</span>
              <span class="aimops-widget-context-val" id="aimops-ctx-errors">없음</span>
            </div>
          </div>

          <button type="submit" class="aimops-widget-submit" id="aimops-submit-btn">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            문의 접수하기
          </button>
        </div>
      </form>

      <div class="aimops-widget-footer">
        <span>Powered by</span>
        <a href="#" onclick="return false;">AIMOps Control Tower</a>
      </div>
    `;
  }

  function updateContextDisplay() {
    const ctx = getContext();
    const urlEl = document.getElementById('aimops-ctx-url');
    const deviceEl = document.getElementById('aimops-ctx-device');
    const screenEl = document.getElementById('aimops-ctx-screen');
    const errorsEl = document.getElementById('aimops-ctx-errors');
    if (urlEl) urlEl.textContent = ctx.path || ctx.url;
    if (deviceEl) deviceEl.textContent = ctx.deviceType === 'mobile' ? '모바일' : '데스크톱';
    if (screenEl) screenEl.textContent = ctx.screenSize;
    if (errorsEl) errorsEl.textContent = ctx.recentErrors.length > 0 ? ctx.recentErrors.length + '건' : '없음';
    if (errorsEl && ctx.recentErrors.length > 0) errorsEl.style.color = '#f87171';
  }

  // ─── Submit handler ──────────────────────────────────
  function handleSubmit(panel) {
    const typeEl = document.getElementById('aimops-type');
    const contentEl = document.getElementById('aimops-content');
    const submitBtn = document.getElementById('aimops-submit-btn');

    if (!typeEl || !contentEl || !submitBtn) return;

    const inquiryType = typeEl.value;
    const inquiryContent = contentEl.value.trim();
    if (!inquiryType || inquiryContent.length < 5) return;

    // Show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="aimops-widget-spinner"></div> 접수 중...';

    const ctx = getContext();
    const payload = {
      system_id: CONFIG.systemId,
      system_name: CONFIG.systemName,
      inquiry_type: inquiryType,
      inquiry_text: inquiryContent,
      context: {
        current_url: ctx.url,
        current_path: ctx.path,
        browser_info: ctx.userAgent,
        screen_size: ctx.screenSize,
        device_type: ctx.deviceType,
        recent_errors: ctx.recentErrors,
      },
      timestamp: ctx.timestamp,
    };

    // Simulate API call (in production, POST to CONFIG.towerUrl + '/api/widget/inquiry')
    const inquiryId = 'INQ-' + Date.now().toString(36).toUpperCase();

    // Store locally for Control Tower to read
    try {
      const existing = JSON.parse(localStorage.getItem('aimops_widget_inquiries') || '[]');
      existing.push({ ...payload, inquiry_id: inquiryId });
      localStorage.setItem('aimops_widget_inquiries', JSON.stringify(existing));
    } catch (e) { /* ignore */ }

    // If tower URL is configured, also POST
    if (CONFIG.towerUrl) {
      fetch(CONFIG.towerUrl + '/api/widget/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, inquiry_id: inquiryId }),
      }).catch(function () { /* offline fallback — already stored locally */ });
    }

    // Show success after brief delay
    setTimeout(function () {
      showSuccess(panel, inquiryId);
    }, 800);
  }

  function showSuccess(panel, inquiryId) {
    const body = panel.querySelector('.aimops-widget-body');
    const formEl = panel.querySelector('#aimops-inquiry-form');
    if (!body || !formEl) return;

    body.innerHTML = `
      <div class="aimops-widget-success">
        <div class="aimops-widget-success-icon">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h4>문의가 접수되었습니다</h4>
        <p>AIMOps Control Tower에서 자동 분석 후<br>결과를 안내해 드리겠습니다.</p>
        <div class="aimops-widget-success-id">${inquiryId}</div>
      </div>
    `;

    // Reset after 3 seconds
    setTimeout(function () {
      body.innerHTML = '';
      formEl.querySelector('.aimops-widget-body')?.remove();
      // Rebuild form
      panel.innerHTML = buildPanelHTML();
      // Re-bind submit
      var newForm = panel.querySelector('#aimops-inquiry-form');
      if (newForm) {
        newForm.addEventListener('submit', function (e) {
          e.preventDefault();
          handleSubmit(panel);
        });
      }
    }, 4000);
  }

  // ─── Init ────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
