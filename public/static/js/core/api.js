// ============================================================
// 와이비 OMS — Core API Module v4.0
// API 통신, 세션 관리, 에러 처리, 재시도, 오프라인 감지
// ============================================================

window.OMS = window.OMS || {};

const API_BASE = '/api';
let _sessionId = localStorage.getItem('session_id') || '';

// ─── 네트워크 상태 관리 ───
let _isOnline = navigator.onLine;
let _offlineBanner = null;

window.addEventListener('online', () => {
  _isOnline = true;
  if (_offlineBanner) { _offlineBanner.remove(); _offlineBanner = null; }
  showToast('네트워크 연결이 복구되었습니다.', 'success');
});

window.addEventListener('offline', () => {
  _isOnline = false;
  showOfflineBanner();
  showToast('네트워크 연결이 끊어졌습니다.', 'error');
});

function showOfflineBanner() {
  if (_offlineBanner) return;
  _offlineBanner = document.createElement('div');
  _offlineBanner.id = 'offline-banner';
  _offlineBanner.className = 'fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white text-center py-2 text-sm font-medium shadow-lg';
  _offlineBanner.innerHTML = '<i class="fas fa-wifi-slash mr-2"></i>오프라인 상태입니다. 네트워크 연결을 확인해 주세요.';
  document.body.prepend(_offlineBanner);
}

// ─── 글로벌 에러 핸들러 ───
window.addEventListener('error', (e) => {
  console.error('[Global Error]', e.message, e.filename, e.lineno);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Unhandled Promise]', e.reason);
  // API 에러는 이미 처리되므로 무시
  if (e.reason && e.reason._handled) return;
});

// ─── API 호출 헬퍼 (재시도 로직 포함) ───
async function api(method, path, body = null, options = {}) {
  const maxRetries = options.retries ?? (method === 'GET' ? 2 : 0);
  const retryDelay = options.retryDelay ?? 1000;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (!_isOnline) {
        showToast('오프라인 상태입니다. 네트워크 연결을 확인하세요.', 'error');
        return null;
      }

      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (_sessionId) opts.headers['X-Session-Id'] = _sessionId;
      if (body) opts.body = JSON.stringify(body);

      const controller = new AbortController();
      opts.signal = controller.signal;
      const timeout = setTimeout(() => controller.abort(), options.timeout ?? 30000);

      const res = await fetch(`${API_BASE}${path}`, opts);
      clearTimeout(timeout);

      if (res.headers.get('Content-Type')?.includes('text/csv')) return res;
      const data = await res.json();

      if (res.status === 401 && !path.includes('/login')) { logout(); return null; }

      // 서버 에러 (5xx) 재시도
      if (res.status >= 500 && attempt < maxRetries) {
        lastError = data;
        await sleep(retryDelay * (attempt + 1));
        continue;
      }

      return { ...data, _status: res.status };
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') {
        console.warn('[API Timeout]', method, path);
        showToast('요청 시간이 초과되었습니다. 다시 시도해 주세요.', 'error');
        return null;
      }
      if (attempt < maxRetries) {
        console.warn(`[API Retry ${attempt + 1}/${maxRetries}]`, method, path, err.message);
        await sleep(retryDelay * (attempt + 1));
        continue;
      }
      console.error('[API Error]', method, path, err);
      showToast('서버 통신 오류가 발생했습니다.', 'error');
      return null;
    }
  }
  console.error('[API Max Retries]', method, path, lastError);
  showToast('서버 응답이 없습니다. 잠시 후 다시 시도해 주세요.', 'error');
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getSessionId() { return _sessionId; }
function setSessionId(id) { _sessionId = id; if (id) localStorage.setItem('session_id', id); else localStorage.removeItem('session_id'); }

// ─── API 액션 래퍼 (POST/PUT/PATCH/DELETE + 자동 토스트/로딩) ───
/**
 * API 호출을 수행하고, 성공/실패를 자동으로 토스트로 표시
 * @param {string} method - HTTP 메서드 (POST, PUT, PATCH, DELETE)
 * @param {string} path - API 경로
 * @param {Object|null} body - 요청 본문
 * @param {Object} opts - 옵션
 *   successMsg: 성공 시 토스트 메시지 (string 또는 (data)=>string)
 *   errorMsg: 실패 시 기본 에러 메시지
 *   confirm: {title, message, buttonText?, buttonColor?} 확인 모달 표시 후 실행
 *   onSuccess: (data) => void  성공 시 추가 콜백
 *   onError: (data) => void  실패 시 추가 콜백
 *   silent: true 시 토스트 표시 안 함
 *   refresh: true 시 성공 후 renderContent() 호출
 *   closeModal: true 시 성공 후 closeModal() 호출
 *   successCheck: (data) => boolean  성공 여부 판단 (기본: data?.ok 또는 data?._status < 400)
 * @returns {Promise<Object|null>}
 */
async function apiAction(method, path, body = null, opts = {}) {
  const exec = async () => {
    const res = await api(method, path, body);
    if (!res) return null;

    const isSuccess = opts.successCheck
      ? opts.successCheck(res)
      : (res.ok || res._status < 400);

    if (isSuccess) {
      if (!opts.silent) {
        const msg = typeof opts.successMsg === 'function' ? opts.successMsg(res) : (opts.successMsg || res.message || '완료');
        showToast(msg, 'success');
      }
      if (opts.closeModal) closeModal();
      if (opts.refresh) renderContent();
      if (opts.onSuccess) opts.onSuccess(res);
    } else {
      if (!opts.silent) {
        showToast(res.error || opts.errorMsg || '처리에 실패했습니다.', 'error');
      }
      if (opts.onError) opts.onError(res);
    }
    return res;
  };

  if (opts.confirm) {
    return new Promise(resolve => {
      showConfirmModal(
        opts.confirm.title || '확인',
        opts.confirm.message || '계속하시겠습니까?',
        async () => resolve(await exec()),
        opts.confirm.buttonText || '확인',
        opts.confirm.buttonColor || 'bg-blue-600'
      );
    });
  }
  return exec();
}

// ─── Batch API (여러 요청 동시 실행 + 결과 집계) ───
async function apiBatch(requests) {
  const results = await Promise.allSettled(
    requests.map(r => api(r.method, r.path, r.body))
  );
  const success = results.filter(r => r.status === 'fulfilled' && r.value?.ok).length;
  const fail = results.length - success;
  return { success, fail, total: results.length, results };
}
