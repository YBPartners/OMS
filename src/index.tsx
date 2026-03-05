import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { authMiddleware } from './middleware/auth';
import { cleanupRateLimit } from './middleware/security';
import authRoutes from './routes/auth';
import orderRoutes from './routes/orders/index';
import settlementRoutes from './routes/settlements/index';
import reconciliationRoutes from './routes/reconciliation/index';
import statsRoutes from './routes/stats/index';
import hrRoutes from './routes/hr/index';
import signupRoutes from './routes/signup/index';
import notificationRoutes from './routes/notifications';
import auditRoutes from './routes/audit';
import systemRoutes from './routes/system';

const app = new Hono<Env>();

// ─── 글로벌 에러 핸들러 ───
app.onError((err, c) => {
  const method = c.req.method;
  const path = c.req.path;
  const msg = err.message || '';
  console.error(`[OMS ERROR] ${method} ${path}:`, msg);

  // 에러 분류
  const isDbError = msg.includes('D1') || msg.includes('SQL') || msg.includes('SQLITE');
  const isValidation = msg.includes('validation') || msg.includes('required') || msg.includes('invalid');
  const isTimeout = msg.includes('timeout') || msg.includes('Timeout');
  const isNotFound = msg.includes('not found') || msg.includes('NOT_FOUND');

  let userMessage = '서버 오류가 발생했습니다.';
  let status = 500;
  let code = 'INTERNAL_ERROR';

  if (isDbError) {
    const isTypeError = msg.includes('TYPE_ERROR');
    userMessage = isTypeError ? '데이터 형식 오류입니다. 입력값을 확인해 주세요.' : '데이터 처리 중 오류가 발생했습니다.';
    code = 'DB_ERROR';
  } else if (isValidation) {
    userMessage = '입력값이 올바르지 않습니다.';
    status = 400;
    code = 'VALIDATION_ERROR';
  } else if (isTimeout) {
    userMessage = '요청 처리 시간이 초과되었습니다.';
    status = 504;
    code = 'TIMEOUT';
  } else if (isNotFound) {
    userMessage = '요청한 리소스를 찾을 수 없습니다.';
    status = 404;
    code = 'NOT_FOUND';
  }

  return c.json({
    error: userMessage,
    code,
    _debug: msg.substring(0, 200),
  }, status);
});

// ─── 미들웨어 ───
app.use('*', cors());
app.use('/api/*', authMiddleware);

app.use('*', async (c, next) => {
  if (Math.random() < 0.01) cleanupRateLimit();
  await next();
});

// ─── API 라우트 ───
app.route('/api/auth', authRoutes);
app.route('/api/orders', orderRoutes);
app.route('/api/settlements', settlementRoutes);
app.route('/api/reconciliation', reconciliationRoutes);
app.route('/api/stats', statsRoutes);
app.route('/api/hr', hrRoutes);
app.route('/api/signup', signupRoutes);
app.route('/api/notifications', notificationRoutes);
app.route('/api/audit', auditRoutes);
app.route('/api/system', systemRoutes);

// ─── 헬스체크 ───
app.get('/api/health', (c) => c.json({ status: 'ok', version: '16.0.0', system: '와이비 OMS' }));

// ─── SPA 라우팅: 모든 페이지 요청에 index.html 반환 ───
app.get('*', async (c) => {
  const path = c.req.path;
  if (path.startsWith('/api/') || path.startsWith('/static/')) {
    return c.notFound();
  }
  return c.html(getIndexHtml());
});

function getIndexHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#2563eb">
  <title>와이비 OMS - 주문관리시스템</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" rel="stylesheet">
  <link href="/static/css/mobile.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: { 50:'#eff6ff', 100:'#dbeafe', 200:'#bfdbfe', 300:'#93c5fd', 400:'#60a5fa', 500:'#3b82f6', 600:'#2563eb', 700:'#1d4ed8', 800:'#1e40af', 900:'#1e3a8a' },
            accent: { 50:'#f0fdf4', 100:'#dcfce7', 200:'#bbf7d0', 400:'#4ade80', 500:'#22c55e', 600:'#16a34a' },
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
    .glass { background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); }
    .sidebar-item { transition: all 0.2s ease; }
    .sidebar-item:hover, .sidebar-item.active { background: rgba(59,130,246,0.1); color: #2563eb; }
    .card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
    .status-badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .drag-over { border: 2px dashed #3b82f6 !important; background: #eff6ff !important; }
    .kanban-card { cursor: grab; transition: transform 0.15s, box-shadow 0.15s; }
    .kanban-card:active { cursor: grabbing; transform: scale(1.02); box-shadow: 0 8px 20px rgba(0,0,0,0.15); }
    .fade-in { animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .pulse { animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #f1f5f9; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    .tab-active { border-bottom: 3px solid #2563eb; color: #2563eb; font-weight: 600; }
    .modal-overlay { background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
    .num-input { -moz-appearance: textfield; }
    .num-input::-webkit-outer-spin-button, .num-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .breadcrumb-separator::before { content: '/'; margin: 0 0.5rem; color: #9ca3af; }
    .tooltip { position: relative; }
    .tooltip::after { content: attr(data-tip); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); padding: 4px 8px; background: #1f2937; color: white; font-size: 11px; border-radius: 4px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.2s; }
    .tooltip:hover::after { opacity: 1; }
    .link-item { cursor: pointer; color: #2563eb; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 2px; }
    .link-item:hover { color: #1d4ed8; text-decoration-style: solid; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div id="app"></div>
  
  <!-- Core modules (load order matters) -->
  <script src="/static/js/core/constants.js"></script>
  <script src="/static/js/core/api.js"></script>
  <script src="/static/js/core/ui.js"></script>
  <script src="/static/js/core/interactions.js"></script>
  <script src="/static/js/core/auth.js"></script>
  
  <!-- Shared components -->
  <script src="/static/js/shared/table.js"></script>
  <script src="/static/js/shared/form-helpers.js"></script>
  
  <!-- Page modules -->
  <script src="/static/js/pages/dashboard.js"></script>
  <script src="/static/js/pages/orders.js"></script>
  <script src="/static/js/pages/kanban.js"></script>
  <script src="/static/js/pages/review.js"></script>
  <script src="/static/js/pages/settlement.js"></script>
  <script src="/static/js/pages/statistics.js"></script>
  <script src="/static/js/pages/hr.js"></script>
  <script src="/static/js/pages/signup-wizard.js"></script>
  <script src="/static/js/pages/signup-admin.js"></script>
  <script src="/static/js/pages/notifications.js"></script>
  <script src="/static/js/pages/audit.js"></script>
  <script src="/static/js/pages/my-orders.js"></script>
  <script src="/static/js/pages/agency.js"></script>
  <script src="/static/js/pages/channels.js"></script>
  <script src="/static/js/pages/system.js"></script>
  
  <!-- App bootstrap (must be last) -->
  <script src="/static/js/core/app.js"></script>
</body>
</html>`;
}

export default app;
