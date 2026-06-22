/**
 * PWA 설치 + 카카오톡 인앱 브라우저 안내 + 버전/Service Worker 갱신
 */
var LS_PWA_DISMISS = 'isatok_pwa_install_dismissed';
var LS_KAKAO_BANNER = 'isatok_kakao_inapp_banner_seen';
var LS_KAKAO_INTENT = 'isatok_kakao_intent_attempted';
var LS_APP_VERSION = 'isatok_app_version';
var SS_VERSION_RELOAD = 'isatok_version_reload';
var SS_SW_RELOAD = 'isatok_sw_reload';

function _ua() {
  return window.navigator.userAgent || '';
}

function _isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function _isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(_ua());
}

function _isMobileViewport() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function _isAndroid() {
  return /Android/i.test(_ua());
}

function _isIos() {
  return /iPhone|iPad|iPod/i.test(_ua());
}

function _isKakaoInApp() {
  return /KAKAOTALK|KakaoTalk/i.test(_ua());
}

function _isIosSafari() {
  if (!_isIos()) return false;
  if (_isKakaoInApp()) return false;
  var ua = _ua();
  if (/crios|fxios|edgios|opr\//i.test(ua)) return false;
  return /safari/i.test(ua);
}

function _fetchRemoteVersion() {
  return fetch('version.json?_=' + Date.now(), {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' }
  }).then(function (res) {
    if (!res.ok) return null;
    return res.json();
  }).catch(function () {
    return null;
  });
}

function _reloadForNewVersion(remoteVersion) {
  localStorage.setItem(LS_APP_VERSION, remoteVersion);
  if (sessionStorage.getItem(SS_VERSION_RELOAD) === remoteVersion) return false;
  sessionStorage.setItem(SS_VERSION_RELOAD, remoteVersion);
  location.reload();
  return true;
}

function _registerServiceWorker(appVersion) {
  if (!('serviceWorker' in navigator)) return Promise.resolve();

  var swUrl = 'service-worker.js?v=' + encodeURIComponent(appVersion || Date.now());

  if (!window._isatokSwReloadBound) {
    window._isatokSwReloadBound = true;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (sessionStorage.getItem(SS_SW_RELOAD)) return;
      sessionStorage.setItem(SS_SW_RELOAD, '1');
      location.reload();
    });
  }

  return navigator.serviceWorker.register(swUrl).then(function (reg) {
    reg.addEventListener('updatefound', function () {
      var worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', function () {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          worker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
    if (reg.waiting && navigator.serviceWorker.controller) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    return reg.update().catch(function () {});
  }).catch(function () {});
}

export function ensureLatestVersion() {
  return _fetchRemoteVersion().then(function (remote) {
    if (!remote || !remote.appVersion) return null;

    var stored = localStorage.getItem(LS_APP_VERSION);
    if (stored && stored !== remote.appVersion) {
      if (_reloadForNewVersion(remote.appVersion)) {
        return new Promise(function () {});
      }
    }

    localStorage.setItem(LS_APP_VERSION, remote.appVersion);
    sessionStorage.removeItem(SS_VERSION_RELOAD);
    sessionStorage.removeItem(SS_SW_RELOAD);
    return _registerServiceWorker(remote.appVersion).then(function () {
      return remote;
    });
  });
}

function _watchVersionOnVisible() {
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    _fetchRemoteVersion().then(function (remote) {
      if (!remote || !remote.appVersion) return;
      var stored = localStorage.getItem(LS_APP_VERSION);
      if (stored && stored !== remote.appVersion) {
        _reloadForNewVersion(remote.appVersion);
      }
    });
  });
}

_watchVersionOnVisible();

function _tryOpenInChromeAndroid() {
  if (!_isAndroid()) return;
  if (localStorage.getItem(LS_KAKAO_INTENT)) return;
  localStorage.setItem(LS_KAKAO_INTENT, '1');

  var url = window.location.href;
  var path = url.replace(/^https?:\/\//, '');
  var intent =
    'intent://' + path +
    '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' +
    encodeURIComponent(url) + ';end';

  try {
    window.location.href = intent;
  } catch (e) { /* ignore */ }
}

function _showKakaoInAppBanner() {
  if (!_isMobileDevice() || !_isKakaoInApp()) return;
  if (localStorage.getItem(LS_KAKAO_BANNER)) return;

  var banner = document.getElementById('kakao-inapp-banner');
  if (!banner) return;

  localStorage.setItem(LS_KAKAO_BANNER, '1');
  banner.hidden = false;
  document.body.classList.add('has-kakao-banner');

  var chromeBtn = document.getElementById('kakao-open-browser-btn');
  if (chromeBtn) chromeBtn.hidden = !_isAndroid();
}

window.dismissKakaoInAppBanner = function () {
  localStorage.setItem(LS_KAKAO_BANNER, '1');
  var banner = document.getElementById('kakao-inapp-banner');
  if (banner) banner.hidden = true;
  document.body.classList.remove('has-kakao-banner');
};

window.openInExternalBrowser = function () {
  if (_isAndroid()) {
    localStorage.setItem(LS_KAKAO_INTENT, '1');
    var url = window.location.href;
    var path = url.replace(/^https?:\/\//, '');
    window.location.href =
      'intent://' + path +
      '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' +
      encodeURIComponent(url) + ';end';
  }
};

function initKakaoInAppBanner() {
  if (!_isMobileDevice() || !_isKakaoInApp()) return;
  if (localStorage.getItem(LS_KAKAO_BANNER)) return;

  if (_isAndroid()) {
    _tryOpenInChromeAndroid();
    window.setTimeout(_showKakaoInAppBanner, 700);
  } else {
    _showKakaoInAppBanner();
  }
}

function _toastInstall(msg, opts) {
  if (typeof window.toast === 'function') {
    window.toast(msg, opts);
    return;
  }
  window.setTimeout(function () {
    _toastInstall(msg, opts);
  }, 120);
}

function _showPwaBanner(mode) {
  if (_isStandalone()) return;
  if (_isKakaoInApp()) return;
  if (localStorage.getItem(LS_PWA_DISMISS)) return;
  if (!_isMobileViewport()) return;

  var banner = document.getElementById('pwa-install-banner');
  if (!banner) return;

  var textEl = banner.querySelector('.pwa-install-text');
  var installBtn = document.getElementById('pwa-install-btn');

  if (mode === 'android') {
    if (textEl) textEl.textContent = '🏓 이사탁을 홈 화면에 추가하면 더 빠르게 이용할 수 있어요.';
    if (installBtn) {
      installBtn.hidden = false;
      installBtn.textContent = '📲 앱 설치';
    }
  } else if (mode === 'ios') {
    if (textEl) textEl.textContent = 'Safari 공유 버튼 → 홈 화면에 추가';
    if (installBtn) installBtn.hidden = true;
  } else {
    return;
  }

  banner.hidden = false;
  document.body.classList.add('has-pwa-banner');
}

function _hidePwaBanner() {
  var banner = document.getElementById('pwa-install-banner');
  if (banner) banner.hidden = true;
  document.body.classList.remove('has-pwa-banner');
}

window.dismissPwaInstall = function () {
  localStorage.setItem(LS_PWA_DISMISS, '1');
  _hidePwaBanner();
};

window.installPwa = async function () {
  var prompt = window._deferredPwaPrompt;
  if (!prompt) return;
  prompt.prompt();
  try {
    var choice = await prompt.userChoice;
    if (choice && choice.outcome === 'accepted') {
      _toastInstall('이사탁 앱이 설치되었습니다.');
    }
  } catch (e) { /* ignore */ }
  window._deferredPwaPrompt = null;
  window.dismissPwaInstall();
};

window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window._deferredPwaPrompt = e;
  if (document.body && document.getElementById('pwa-install-banner')) {
    _showPwaBanner('android');
  }
});

window.addEventListener('appinstalled', function () {
  window._deferredPwaPrompt = null;
  localStorage.setItem(LS_PWA_DISMISS, '1');
  _hidePwaBanner();
  _toastInstall('이사탁 앱이 설치되었습니다.');
});

function _bootKakaoBanner() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKakaoInAppBanner);
  } else {
    initKakaoInAppBanner();
  }
}

_bootKakaoBanner();

export function initPwa() {
  if (_isStandalone()) return;
  if (_isKakaoInApp()) return;

  if (window._deferredPwaPrompt) {
    _showPwaBanner('android');
  } else if (_isIosSafari() && !localStorage.getItem(LS_PWA_DISMISS)) {
    _showPwaBanner('ios');
  }
}
