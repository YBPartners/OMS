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
import bannerRoutes from './routes/banners';

const app = new Hono<Env>();

// ─── 글로벌 에러 핸들러 v2.0 — 실제 에러 메시지 노출 방지 ───
app.onError((err, c) => {
  const method = c.req.method;
  const path = c.req.path;
  const msg = err.message || '';
  // 서버 로그에만 상세 에러 기록
  console.error(`[OMS ERROR] ${method} ${path}:`, msg, err.stack ? `\n${err.stack}` : '');

  // 에러 분류
  const isDbError = msg.includes('D1') || msg.includes('SQL') || msg.includes('SQLITE');
  const isValidation = msg.includes('validation') || msg.includes('required') || msg.includes('invalid');
  const isTimeout = msg.includes('timeout') || msg.includes('Timeout');
  const isNotFound = msg.includes('not found') || msg.includes('NOT_FOUND');
  const isJsonParse = msg.includes('JSON') || msg.includes('Unexpected token') || msg.includes('SyntaxError');

  let userMessage = '서버 오류가 발생했습니다.';
  let status = 500;
  let code = 'INTERNAL_ERROR';

  if (isJsonParse) {
    userMessage = '요청 데이터 형식이 올바르지 않습니다.';
    status = 400;
    code = 'PARSE_ERROR';
  } else if (isDbError) {
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
  }, status);
});

// ─── 보안 헤더 미들웨어 v1.0 (R15) ───
app.use('*', async (c, next) => {
  await next();
  // Clickjacking 방어
  c.res.headers.set('X-Frame-Options', 'DENY');
  // MIME sniffing 방어
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  // Referrer 정보 제한
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // 불필요한 브라우저 기능 차단
  c.res.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()');
  // CSP: CDN 자산 + 인라인 스타일/스크립트(Tailwind/Chart.js) 허용
  if (!c.req.path.startsWith('/api/')) {
    c.res.headers.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://t1.daumcdn.net https://pagead2.googlesyndication.com https://adservice.google.com https://www.googletagservices.com https://static.cloudflareinsights.com https://www.googletagmanager.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
      "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://pagead2.googlesyndication.com https://*.google.com https://*.googleusercontent.com",
      "connect-src 'self' https://pagead2.googlesyndication.com https://adservice.google.com https://cloudflareinsights.com https://static.cloudflareinsights.com https://www.google-analytics.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google",
      "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://t1.daumcdn.net https://postcode.map.daum.net",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; '));
  }
});

// ─── CORS 도메인 제한 v1.0 (R15) ───
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*'; // 서버-to-서버, curl 등 origin 없는 요청 허용
    const allowed = [
      'https://dahada-oms.pages.dev',
      /^https:\/\/[a-z0-9-]+\.dahada-oms\.pages\.dev$/,  // 프리뷰 배포 (branch.project.pages.dev)
      'https://www.airflow.co.kr',
      'https://airflow.co.kr',
      'http://localhost:3000',
      'http://localhost:8788',
    ];
    for (const a of allowed) {
      if (typeof a === 'string' && a === origin) return origin;
      if (a instanceof RegExp && a.test(origin)) return origin;
    }
    return 'https://dahada-oms.pages.dev'; // 허용되지 않은 origin → 기본값
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Session-Id'],
  maxAge: 86400,
}));

// ─── Request Body 크기 제한 v1.0 (R15) ───
app.use('/api/*', async (c, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
    const contentLength = parseInt(c.req.header('Content-Length') || '0', 10);
    const path = c.req.path;
    // 사진 업로드: 5MB
    const isUpload = path.includes('/upload') || path.includes('/reports');
    // 일괄 임포트/복원: 10MB
    const isBulk = path.includes('/import') || path.includes('/snapshot') || path.includes('/batch');
    const maxBytes = isBulk ? 10_485_760 : isUpload ? 5_242_880 : 1_048_576; // 10MB / 5MB / 1MB

    if (contentLength > maxBytes) {
      const maxMB = Math.round(maxBytes / 1_048_576);
      return c.json({ error: `요청 크기가 ${maxMB}MB 제한을 초과합니다.`, code: 'PAYLOAD_TOO_LARGE' }, 413);
    }
  }
  await next();
});

// ─── 정적 자산 캐시 헤더 (JS/CSS 파일 장기 캐싱) ───
app.use('/static/*', async (c, next) => {
  await next();
  if (c.res.status === 200) {
    const path = c.req.path;
    const isImmutable = /\.(js|css|woff2?|ttf|eot)$/i.test(path);
    if (isImmutable) {
      c.res.headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    }
  }
});

// ─── API 응답 캐싱 (읽기 전용 엔드포인트) ───
app.use('/api/*', async (c, next) => {
  await next();
  if (c.req.method === 'GET' && c.res.status === 200) {
    const path = c.req.path;
    // 자주 변경되지 않는 정적 데이터: 30초 캐시
    if (path.includes('/hr/roles') || path.includes('/hr/channels') || 
        path.includes('/auth/organizations') || path.includes('/hr/admin-regions')) {
      c.res.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    }
  }
});

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
app.route('/api/banners', bannerRoutes);

// ─── 헬스체크 ───
app.get('/api/health', (c) => c.json({ status: 'ok', version: '25.0.0', system: 'Airflow OMS' }));

// ─── API 404 표준화 — 존재하지 않는 API 경로에 대해 명확한 JSON 응답 ───
app.all('/api/*', (c) => {
  return c.json({ error: '요청한 API 경로를 찾을 수 없습니다.', code: 'NOT_FOUND', path: c.req.path }, 404);
});

// ─── Service Worker (인라인 서빙 — CDN 캐시 우회) ───
app.get('/sw.js', async (c) => {
  const swCode = `// Airflow OMS — Service Worker v16.0
const CACHE_NAME = 'airflow-oms-v16';
const STATIC_ASSETS = [
  '/',
  '/static/css/mobile.css',
  '/static/js/core/constants.js',
  '/static/js/core/api.js',
  '/static/js/core/ui.js',
  '/static/js/core/interactions.js',
  '/static/js/core/auth.js',
  '/static/js/core/app.js',
  '/static/js/shared/table.js',
  '/static/js/shared/form-helpers.js',
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {})));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.url.includes('/api/')) return;
  event.respondWith(
    fetch(request).then((response) => {
      if (response.status === 200) { const clone = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)); }
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || new Response('오프라인 상태입니다.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })))
  );
});
self.addEventListener('push', (event) => {
  let data = { title: 'Airflow OMS', body: '새로운 알림이 있습니다.', icon: '', tag: 'default' };
  try { if (event.data) { const payload = event.data.json(); data = { ...data, ...payload }; } } catch (e) { if (event.data) data.body = event.data.text(); }
  const options = { body: data.body, icon: data.icon || '/static/icon-192.png', badge: '/static/icon-72.png', tag: data.tag || 'airflow-oms', vibrate: [200, 100, 200], data: { url: data.url || '/', timestamp: Date.now() }, actions: [{ action: 'open', title: '열기' }, { action: 'dismiss', title: '닫기' }] };
  event.waitUntil(self.registration.showNotification(data.title, options));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => { for (const client of clients) { if (client.url.includes(self.location.origin) && 'focus' in client) { client.focus(); client.postMessage({ type: 'NOTIFICATION_CLICK', url }); return; } } return self.clients.openWindow(url); }));
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, url } = event.data;
    self.registration.showNotification(title || 'Airflow OMS', { body: body || '새로운 알림이 있습니다.', icon: '/static/icon-192.png', badge: '/static/icon-72.png', tag: tag || 'airflow-local', vibrate: [200, 100, 200], data: { url: url || '/' } });
  }
});`;
  return new Response(swCode, {
    headers: { 'Content-Type': 'application/javascript', 'Service-Worker-Allowed': '/', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
  });
});

// ─── Google AdSense 소유권 확인용 ads.txt ───
app.get('/ads.txt', async (c) => {
  // DB에서 ads.txt 내용을 가져오거나, 시스템 설정에서 관리
  try {
    const result = await c.env.DB.prepare(
      "SELECT value FROM ad_settings WHERE key = 'ads_txt_content'"
    ).first<{ value: string }>();
    if (result?.value) {
      return new Response(result.value, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  } catch (e) { /* DB 없으면 기본값 */ }
  // 기본 ads.txt
  return new Response('google.com, pub-6838924334474689, DIRECT, f08c47fec0942fa0\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
});

// ─── robots.txt ───
app.get('/robots.txt', (c) => {
  return new Response(`User-agent: *\nAllow: /\nSitemap: https://www.airflow.co.kr/sitemap.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
});

// ─── SPA 라우팅: 모든 페이지 요청에 index.html 반환 ───
app.get('*', async (c) => {
  const path = c.req.path;
  if (path.startsWith('/api/') || path.startsWith('/static/') || path === '/sw.js') {
    return c.notFound();
  }
  
  // DB에서 AdSense 계정 ID 조회 (폴백: 하드코딩)
  let adsenseAccount = 'ca-pub-6838924334474689';
  try {
    const result = await c.env.DB.prepare(
      "SELECT value FROM ad_settings WHERE key = 'adsense_client_id'"
    ).first<{ value: string }>();
    if (result?.value) adsenseAccount = result.value;
  } catch (e) { /* DB 없으면 빈값 */ }
  
  return c.html(getIndexHtml(adsenseAccount));
});

function getIndexHtml(adsenseAccount: string = ''): string {
  const V = '34';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#0d9488">
  <meta name="description" content="Airflow - 스마트 주문관리시스템">
  <meta name="google-adsense-account" content="${adsenseAccount}">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseAccount}" crossorigin="anonymous"></script>
  <link rel="icon" type="image/png" href="/static/img/airflow-logo.png">
  <link rel="apple-touch-icon" href="/static/img/icon-192x192.png">
  <link rel="manifest" href="/manifest.json">
  <title>Airflow - 주문관리시스템</title>
  <link href="/static/css/tailwind.css?v=${V}" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" rel="stylesheet">
  <link href="/static/css/mobile.css?v=${V}" rel="stylesheet">
  <link href="/static/css/print.css" rel="stylesheet" media="print">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
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
  
  <!-- SW 강제 갱신: 모든 이전 캐시 정리 + SW 재등록 -->
  <script>
  (async()=>{
    try{
      // 1) 모든 이전 서비스워커 해제 + 강제 업데이트
      if('serviceWorker' in navigator){
        const regs=await navigator.serviceWorker.getRegistrations();
        for(const r of regs){
          await r.unregister();
        }
      }
      // 2) 모든 캐시 삭제 (yb-oms, airflow-oms 구버전 모두)
      if('caches' in window){
        const keys=await caches.keys();
        for(const k of keys){await caches.delete(k);}
      }
      // 3) 새 서비스워커 등록
      if('serviceWorker' in navigator){
        navigator.serviceWorker.register('/sw.js',{scope:'/'});
      }
    }catch(e){console.warn('SW cleanup error:',e);}
  })();
  </script>
  
  <!-- Core modules (load order matters) -->
  <script src="/static/js/core/constants.js?v=${V}"></script>
  <script src="/static/js/core/api.js?v=${V}"></script>
  <script src="/static/js/core/ui.js?v=${V}"></script>
  <script src="/static/js/core/interactions.js?v=${V}"></script>
  <script src="/static/js/core/auth.js?v=${V}"></script>
  
  <!-- Shared components -->
  <script src="/static/js/shared/table.js?v=${V}"></script>
  <script src="/static/js/shared/form-helpers.js?v=${V}"></script>
  <script src="/static/js/shared/banner-slider.js?v=${V}"></script>
  
  <!-- Page modules: 지연 로딩 — 필요한 페이지만 동적으로 로드 -->
  <script>
    // ─── Page Lazy Loader v1.0 ───
    const _pageScripts = {
      // orders.js._getQuickActions → my-orders.js(startWork,readyDone,completeOrder,showReportModal)
      //                                + kanban.js(showAssignModal) + review.js(showReviewModal)
      // 따라서 orders.js를 로드하는 모든 페이지는 이 3개도 함께 필요
      'dashboard': ['/static/js/pages/dashboard.js'],
      'orders': ['/static/js/pages/orders.js', '/static/js/pages/my-orders.js', '/static/js/pages/kanban.js', '/static/js/pages/review.js'],
      'distribute': ['/static/js/pages/orders.js', '/static/js/pages/my-orders.js', '/static/js/pages/kanban.js', '/static/js/pages/review.js'],
      'kanban': ['/static/js/pages/orders.js', '/static/js/pages/my-orders.js', '/static/js/pages/kanban.js', '/static/js/pages/review.js'],
      'review-hq': ['/static/js/pages/orders.js', '/static/js/pages/my-orders.js', '/static/js/pages/kanban.js', '/static/js/pages/review.js'],
      'review-region': ['/static/js/pages/orders.js', '/static/js/pages/my-orders.js', '/static/js/pages/kanban.js', '/static/js/pages/review.js'],
      'settlement': ['/static/js/pages/orders.js', '/static/js/pages/my-orders.js', '/static/js/pages/kanban.js', '/static/js/pages/review.js', '/static/js/pages/settlement.js'],
      'reconciliation': ['/static/js/pages/orders.js', '/static/js/pages/my-orders.js', '/static/js/pages/kanban.js', '/static/js/pages/review.js', '/static/js/pages/settlement.js'],
      'statistics': ['/static/js/pages/statistics.js', '/static/js/pages/dashboard.js'],
      // schedule.js → orders.js(showOrderDetailDrawer) + my-orders.js(readyDone,startWork)
      //             + orders.js chain → kanban.js(showAssignModal) + review.js(showReviewModal)
      'schedule': ['/static/js/pages/orders.js', '/static/js/pages/my-orders.js', '/static/js/pages/kanban.js', '/static/js/pages/review.js', '/static/js/pages/schedule.js'],
      'policies': ['/static/js/pages/policies.js', '/static/js/pages/policies-dist.js', '/static/js/pages/policies-report.js', '/static/js/pages/policies-comm.js', '/static/js/pages/policies-territory.js', '/static/js/pages/policies-metrics.js'],
      // hr.js → signup-admin.js(renderHROrgTree,renderHRSignupRequests,renderHRRegionAddRequests)
      //       → agency.js(showAgencyOnboardingModal) → agency.js 내부에서 orders/review/my-orders 함수 참조하나
      //         HR에서 호출되는 showAgencyOnboardingModal 경로에서는 미사용 (approveOnboarding 등만 사용)
      //         그러나 안전을 위해 orders.js 체인 전체를 포함
      'hr-management': ['/static/js/pages/orders.js', '/static/js/pages/my-orders.js', '/static/js/pages/kanban.js', '/static/js/pages/review.js', '/static/js/pages/hr.js', '/static/js/pages/signup-admin.js', '/static/js/pages/agency.js'],
      'audit-log': ['/static/js/pages/audit.js'],
      'notifications': ['/static/js/pages/notifications.js'],
      'my-orders': ['/static/js/pages/orders.js', '/static/js/pages/my-orders.js', '/static/js/pages/kanban.js', '/static/js/pages/review.js'],
      'my-stats': ['/static/js/pages/orders.js', '/static/js/pages/my-orders.js', '/static/js/pages/kanban.js', '/static/js/pages/review.js'],
      'my-profile': ['/static/js/pages/orders.js', '/static/js/pages/my-orders.js', '/static/js/pages/kanban.js', '/static/js/pages/review.js'],
      // agency.js → orders.js(showOrderDetailDrawer) + review.js(quickApprove,showReviewModal)
      //           + my-orders.js(startWork,showReportModal)
      'agency-dashboard': ['/static/js/pages/orders.js', '/static/js/pages/my-orders.js', '/static/js/pages/review.js', '/static/js/pages/kanban.js', '/static/js/pages/agency.js'],
      'agency-orders': ['/static/js/pages/orders.js', '/static/js/pages/my-orders.js', '/static/js/pages/review.js', '/static/js/pages/kanban.js', '/static/js/pages/agency.js'],
      'agency-team': ['/static/js/pages/orders.js', '/static/js/pages/my-orders.js', '/static/js/pages/review.js', '/static/js/pages/kanban.js', '/static/js/pages/agency.js'],
      'agency-statement': ['/static/js/pages/orders.js', '/static/js/pages/my-orders.js', '/static/js/pages/review.js', '/static/js/pages/kanban.js', '/static/js/pages/agency.js'],
      'channels': ['/static/js/pages/channels.js'],
      'system-admin': ['/static/js/pages/system.js'],
      'banner-manage': ['/static/js/pages/banner-manage.js'],
      'signup': ['/static/js/pages/signup-wizard.js', '/static/js/pages/signup-admin.js'],
    };
    const _loadedScripts = new Set();
    async function loadPageScripts(page) {
      const scripts = _pageScripts[page] || [];
      const pending = scripts.filter(s => !_loadedScripts.has(s));
      if (!pending.length) return;
      await Promise.all(pending.map(src => new Promise((resolve, reject) => {
        if (_loadedScripts.has(src)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src + '?v=${V}';
        s.onload = () => { _loadedScripts.add(src); resolve(); };
        s.onerror = () => reject(new Error('Script load failed: ' + src));
        document.body.appendChild(s);
      })));
    }
    // 로그인 후 사전 로드할 필수 페이지
    function preloadCriticalPages() {
      const critical = ['dashboard', 'orders', 'notifications'];
      critical.forEach(p => {
        const scripts = _pageScripts[p] || [];
        scripts.forEach(src => {
          if (!_loadedScripts.has(src)) {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = src;
            link.as = 'script';
            document.head.appendChild(link);
          }
        });
      });
    }
  </script>
  
  <!-- Onboarding guide (before app bootstrap) -->
  <script src="/static/js/shared/guide.js?v=${V}"></script>
  
  <!-- App bootstrap (must be last) -->
  <script src="/static/js/core/app.js?v=${V}"></script>
</body>
</html>`;
}

export default app;
