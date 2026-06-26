/**
 * 이사탁 PWA Service Worker
 * - 앱 셸(shell) 오프라인 캐시 — UI 기본 표시 (Firestore 데이터는 온라인 필요)
 * - version.json / service-worker.js 는 항상 네트워크 우선
 * - 배포 시 SW_VERSION 갱신 → 셸 캐시 교체
 */
var SW_VERSION = '2026.06.26.10';
var SHELL_CACHE = 'isatok-shell-' + SW_VERSION;

var SHELL_ASSETS = [
  './app.html',
  './css/style.css',
  './css/components.css',
  './css/design.css',
  './js/app/main.js',
  './manifest.json',
  './icons/icon-192.png',
  './assets/favicon.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(SHELL_ASSETS.map(function (url) {
        return new Request(url, { cache: 'reload' });
      })).catch(function () { /* 일부 실패해도 설치 진행 */ });
    }).then(function () {
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(function (names) {
        return Promise.all(names.map(function (name) {
          if (name === SHELL_CACHE) return undefined;
          if (name.indexOf('isatok-shell-') === 0) return caches.delete(name);
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

function _isAlwaysNetwork(pathname) {
  return pathname === '/version.json' || pathname === '/service-worker.js';
}

function _isShellAsset(url) {
  if (url.origin !== self.location.origin) return false;
  var p = url.pathname;
  if (p === '/' || p === '/app.html' || p.endsWith('.html')) return true;
  if (p.indexOf('/css/') === 0) return true;
  if (p.indexOf('/js/app/') === 0 && p.endsWith('.js')) return true;
  if (p === '/manifest.json') return true;
  if (p.indexOf('/icons/') === 0) return true;
  if (p.indexOf('/assets/') === 0) return true;
  return false;
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url;
  try {
    url = new URL(event.request.url);
  } catch (e) {
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (_isAlwaysNetwork(url.pathname)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(function () {
        return caches.match(event.request);
      })
    );
    return;
  }

  if (!_isShellAsset(url)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(function () {
        return fetch(event.request);
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then(function (response) {
      if (response && response.ok) {
        var clone = response.clone();
        caches.open(SHELL_CACHE).then(function (cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function () {
      return caches.match(event.request).then(function (cached) {
        if (cached) return cached;
        return caches.match('./app.html');
      });
    })
  );
});
