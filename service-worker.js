/**
 * 이사탁 PWA Service Worker
 * - 오프라인 캐싱 없음 (실시간 데이터 pass-through)
 * - 배포 시 SW_VERSION 갱신 → 즉시 activate
 */
var SW_VERSION = '2026.06.22.04';

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(function (names) {
        return Promise.all(names.map(function (name) {
          return caches.delete(name);
        }));
      })
    ])
  );
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url;
  try {
    url = new URL(event.request.url);
  } catch (e) {
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).catch(function () {
      return fetch(event.request);
    })
  );
});
