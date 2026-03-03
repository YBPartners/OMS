// ============================================================
// 다하다 OMS — Core API Module v3.0
// API 통신, 세션 관리
// ============================================================

window.OMS = window.OMS || {};

const API_BASE = '/api';
let _sessionId = localStorage.getItem('session_id') || '';

// ─── API 호출 헬퍼 ───
async function api(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (_sessionId) opts.headers['X-Session-Id'] = _sessionId;
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (res.headers.get('Content-Type')?.includes('text/csv')) return res;
    const data = await res.json();
    if (res.status === 401 && !path.includes('/login')) { logout(); return null; }
    return { ...data, _status: res.status };
  } catch (err) {
    console.error('[API Error]', method, path, err);
    showToast('서버 통신 오류가 발생했습니다.', 'error');
    return null;
  }
}

function getSessionId() { return _sessionId; }
function setSessionId(id) { _sessionId = id; if (id) localStorage.setItem('session_id', id); else localStorage.removeItem('session_id'); }
