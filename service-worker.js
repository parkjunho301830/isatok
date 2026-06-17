/**
 * 이사탁 PWA — 설치 조건 충족용 최소 Service Worker
 * 실시간 데이터 중심 서비스이므로 오프라인 캐싱 없음 (네트워크 pass-through)
 */
self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
