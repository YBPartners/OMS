// ============================================================
// Airflow OMS — Service Worker v14.0
// 웹 푸시 알림 수신 + 오프라인 캐시
// ============================================================

const CACHE_NAME = 'airflow-oms-v18';
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

// ─── 설치: 정적 자산 프리캐시 ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // 개별 파일 실패 시 무시
        console.log('[SW] Some assets failed to cache');
      });
    })
  );
  self.skipWaiting();
});

// ─── 활성화: 오래된 캐시 정리 ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ─── Fetch: Network-first, 오프라인시 캐시 ───
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // API 요청은 네트워크만
  if (request.url.includes('/api/')) return;
  
  // 정적 자산: network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        // 성공하면 캐시 업데이트
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // 네트워크 실패시 캐시에서
        return caches.match(request).then((cached) => {
          return cached || new Response('오프라인 상태입니다.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        });
      })
  );
});

// ─── 푸시 알림 수신 ───
self.addEventListener('push', (event) => {
  let data = { title: 'Airflow OMS', body: '새로운 알림이 있습니다.', icon: '', tag: 'default' };
  
  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: data.icon || '/static/icon-192.png',
    badge: '/static/icon-72.png',
    tag: data.tag || 'airflow-oms',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open', title: '열기' },
      { action: 'dismiss', title: '닫기' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ─── 알림 클릭 ───
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // 이미 열린 탭 포커스
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', url });
          return;
        }
      }
      // 새 탭 열기
      return self.clients.openWindow(url);
    })
  );
});

// ─── 메시지 수신 (클라이언트→SW 통신) ───
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, url } = event.data;
    self.registration.showNotification(title || 'Airflow OMS', {
      body: body || '새로운 알림이 있습니다.',
      icon: '/static/icon-192.png',
      badge: '/static/icon-72.png',
      tag: tag || 'yb-local',
      vibrate: [200, 100, 200],
      data: { url: url || '/' },
    });
  }
});
