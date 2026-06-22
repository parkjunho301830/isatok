/**
 * PWA 설치 + 카카오톡 인앱 브라우저 안내 + 버전/Service Worker 갱신
 */
var LS_PWA_DISMISS = 'isatok_pwa_install_dismissed';
var LS_KAKAO_POPUP_DATE = 'isatok_kakao_inapp_popup_date';
var LS_APP_VERSION = 'isatok_app_version';
var SS_VERSION_RELOAD = 'isatok_version_reload';
var SS_SW_RELOAD = 'isatok_sw_reload';
var SS_KAKAO_INTENT = 'isatok_kakao_intent_session';
var _ANDROID_PWA_INTENT =
  'intent://isatok.web.app#Intent;scheme=https;S.browser_fallback_url=' +
  encodeURIComponent('https://isatok.web.app') + ';end';

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

function _kstDateKey() {
  var parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  var get = function (t) {
    return (parts.find(function (p) { return p.type === t; }) || {}).value || '';
  };
  return get('year') + '-' + get('month') + '-' + get('day');
}

function _shouldShowKakaoPopup() {
  if (!_isMobileDevice() || !_isKakaoInApp()) return false;
  return localStorage.getItem(LS_KAKAO_POPUP_DATE) !== _kstDateKey();
}

function _markKakaoPopupShown() {
  localStorage.setItem(LS_KAKAO_POPUP_DATE, _kstDateKey());
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

function _setKakaoBannerCopy() {
  var line1 = document.getElementById('kakao-inapp-line1');
  var line2 = document.getElementById('kakao-inapp-line2');
  if (!line1 || !line2) return;

  if (_isIos()) {
    line1.textContent = '🏓 Safari에서 열면 더욱 안정적으로 이용할 수 있습니다.';
    line2.innerHTML = '카카오톡 우측 상단 메뉴 → <strong>Safari로 열기</strong>를 선택해주세요.';
  } else {
    line1.textContent = '🏓 설치된 이사탁 앱에서 열면 더욱 안정적으로 이용할 수 있습니다.';
    line2.innerHTML = '우측 상단 ⋮ 메뉴 → <strong>기본 브라우저로 열기</strong>를 선택해주세요.';
  }
}

function _tryOpenInChromeAndroid() {
  if (!_isAndroid()) return;
  if (sessionStorage.getItem(SS_KAKAO_INTENT)) return;
  sessionStorage.setItem(SS_KAKAO_INTENT, '1');

  try {
    window.location.href = _ANDROID_PWA_INTENT;
  } catch (e) { /* ignore */ }
}

function _showKakaoInAppBanner() {
  if (!_shouldShowKakaoPopup()) return;

  var banner = document.getElementById('kakao-inapp-banner');
  if (!banner) return;

  _markKakaoPopupShown();
  _setKakaoBannerCopy();
  banner.hidden = false;
  document.body.classList.add('has-kakao-banner');

  var chromeBtn = document.getElementById('kakao-open-browser-btn');
  if (chromeBtn) chromeBtn.hidden = !_isAndroid();
}

window.dismissKakaoInAppBanner = function () {
  _markKakaoPopupShown();
  var banner = document.getElementById('kakao-inapp-banner');
  if (banner) banner.hidden = true;
  document.body.classList.remove('has-kakao-banner');
};

window.openInExternalBrowser = function () {
  if (!_isAndroid()) return;
  sessionStorage.setItem(SS_KAKAO_INTENT, '1');
  window.location.href = _ANDROID_PWA_INTENT;
};

function initKakaoInAppBanner() {
  if (!_shouldShowKakaoPopup()) return;

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

function _getHeaderInstallBtn() {
  return document.getElementById('pwa-header-install-btn');
}

function _hideHeaderInstallBtn() {
  var btn = _getHeaderInstallBtn();
  if (btn) btn.hidden = true;
}

function _syncHeaderInstallBtn() {
  if (_isStandalone() || !_isMobileViewport()) {
    _hideHeaderInstallBtn();
    return;
  }
  var btn = _getHeaderInstallBtn();
  if (!btn) return;
  if (window._deferredPwaPrompt || _isIosSafari() || _isKakaoInApp()) {
    btn.hidden = false;
    return;
  }
  btn.hidden = true;
}

window.onHeaderInstallClick = function () {
  if (_isStandalone()) return;

  if (_isKakaoInApp()) {
    if (_isIos()) {
      _toastInstall(
        'Safari에서 열어야 앱을 설치할 수 있습니다.\n카카오톡 메뉴 → Safari로 열기를 선택해주세요.',
        { multiline: true, duration: 4200 }
      );
    } else {
      _toastInstall(
        '외부 브라우저에서 열어야 앱을 설치할 수 있습니다.\n카카오톡 ⋮ 메뉴 → 기본 브라우저로 열기를 선택해주세요.',
        { multiline: true, duration: 4200 }
      );
    }
    return;
  }

  if (_isIosSafari()) {
    _toastInstall('Safari 공유 버튼 → 홈 화면에 추가', { multiline: true, duration: 4200 });
    return;
  }

  if (window._deferredPwaPrompt) {
    window.installPwa();
    return;
  }

  _toastInstall('현재 브라우저에서는 앱 설치를 지원하지 않습니다.', { duration: 2800 });
};

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
  _hideHeaderInstallBtn();
  window.dismissPwaInstall();
};

window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window._deferredPwaPrompt = e;
  _syncHeaderInstallBtn();
  if (document.body && document.getElementById('pwa-install-banner')) {
    _showPwaBanner('android');
  }
});

window.addEventListener('appinstalled', function () {
  window._deferredPwaPrompt = null;
  localStorage.setItem(LS_PWA_DISMISS, '1');
  _hidePwaBanner();
  _hideHeaderInstallBtn();
  _toastInstall('이사탁 앱이 설치되었습니다.');
});

function _bootKakaoBanner() {
  var boot = function () {
    initKakaoInAppBanner();
    _syncHeaderInstallBtn();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

_bootKakaoBanner();

export function initPwa() {
  if (_isStandalone()) {
    _hideHeaderInstallBtn();
    return;
  }

  _syncHeaderInstallBtn();

  if (_isKakaoInApp()) return;

  if (window._deferredPwaPrompt) {
    _showPwaBanner('android');
  } else if (_isIosSafari() && !localStorage.getItem(LS_PWA_DISMISS)) {
    _showPwaBanner('ios');
  }
}
