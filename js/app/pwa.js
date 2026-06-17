/**
 * PWA: Service Worker 등록 + 홈 화면 설치 안내
 */
var LS_PWA_DISMISS = 'isatok_pwa_install_dismissed';

function _isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function _isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function _isIosSafari() {
  var ua = window.navigator.userAgent || '';
  var isIos = /iphone|ipad|ipod/i.test(ua);
  var isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  return isIos && isSafari;
}

function _registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/service-worker.js').catch(function () {});
  });
}

function _showPwaBanner(mode) {
  if (_isStandalone() || localStorage.getItem(LS_PWA_DISMISS)) return;
  if (!_isMobile()) return;
  var banner = document.getElementById('pwa-install-banner');
  if (!banner) return;

  var textEl = banner.querySelector('.pwa-install-text');
  var installBtn = document.getElementById('pwa-install-btn');
  if (mode === 'ios') {
    if (textEl) textEl.textContent = '🏓 이사탁을 홈 화면에 추가해 보세요. (공유 → 홈 화면에 추가)';
    if (installBtn) installBtn.style.display = 'none';
  } else {
    if (textEl) textEl.textContent = '🏓 이사탁을 홈 화면에 추가해 보세요.';
    if (installBtn) installBtn.style.display = '';
  }
  banner.hidden = false;
  document.body.classList.add('has-pwa-banner');
}

window.dismissPwaInstall = function () {
  localStorage.setItem(LS_PWA_DISMISS, '1');
  var banner = document.getElementById('pwa-install-banner');
  if (banner) banner.hidden = true;
  document.body.classList.remove('has-pwa-banner');
};

window.installPwa = async function () {
  var prompt = window._deferredPwaPrompt;
  if (!prompt) return;
  prompt.prompt();
  try {
    await prompt.userChoice;
  } catch (e) { /* ignore */ }
  window._deferredPwaPrompt = null;
  window.dismissPwaInstall();
};

export function initPwa() {
  if (_isStandalone()) return;

  _registerServiceWorker();

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window._deferredPwaPrompt = e;
    _showPwaBanner('android');
  });

  if (_isIosSafari() && !localStorage.getItem(LS_PWA_DISMISS)) {
    _showPwaBanner('ios');
  }
}
