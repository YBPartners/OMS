import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { authMiddleware } from './middleware/auth';
import { cleanupRateLimit } from './middleware/security';
import authRoutes from './routes/auth';
import orderRoutes from './routes/orders';
import settlementRoutes from './routes/settlements';
import reconciliationRoutes from './routes/reconciliation';
import statsRoutes from './routes/stats';
import hrRoutes from './routes/hr';

const app = new Hono<Env>();

// ─── 글로벌 에러 핸들러 ───
app.onError((err, c) => {
  console.error(`[OMS ERROR] ${c.req.method} ${c.req.path}:`, err.message);
  // SQL/DB 에러는 사용자에게 상세 내용을 노출하지 않음
  const isDbError = err.message?.includes('D1') || err.message?.includes('SQL');
  return c.json({
    error: isDbError ? '데이터 처리 중 오류가 발생했습니다.' : (err.message || '서버 오류가 발생했습니다.'),
    _debug: (c.env as any).DEV_MODE === 'true' ? err.message : undefined,
  }, 500);
});

// ─── 미들웨어 ───
app.use('*', cors());
app.use('/api/*', authMiddleware);

// Rate limit 메모리 정리 (매 요청 시 확률적 실행)
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

// ─── 헬스체크 ───
app.get('/api/health', (c) => c.json({ status: 'ok', version: '2.0.0', system: '다하다 OMS' }));

// ─── SPA 라우팅: 모든 페이지 요청에 index.html 반환 ───
app.get('*', async (c) => {
  // API나 정적 파일이 아닌 경우 SPA index.html 반환
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>다하다 OMS - 주문관리시스템</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
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
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div id="app"></div>
  <script src="/static/js/app.js"></script>
  <script src="/static/js/pages/dashboard.js"></script>
  <script src="/static/js/pages/orders.js"></script>
  <script src="/static/js/pages/kanban.js"></script>
  <script src="/static/js/pages/review.js"></script>
  <script src="/static/js/pages/settlement.js"></script>
  <script src="/static/js/pages/statistics.js"></script>
  <script src="/static/js/pages/hr.js"></script>
  <script src="/static/js/pages/my-orders.js"></script>
</body>
</html>`;
}

export default app;
