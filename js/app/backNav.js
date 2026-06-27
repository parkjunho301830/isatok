/**
 * Android / PWA 하드웨어·제스처 뒤로가기 처리
 */
let C = null;
let _navHistory = ['challenge'];
let _overlayStack = [];
let _overlayFns = new Map();
let _skipPop = 0;
let _leaving = false;
let _inited = false;

export function initBackNav(ctx) {
  C = ctx;
  if (_inited) return;
  _inited = true;

  window.addEventListener('popstate', onPopState);

  history.replaceState({ isatok: 'nav', id: _navHistory[0] }, '');
  history.pushState({ isatok: 'sentinel' }, '');

  window.confirmAppExit = confirmAppExit;
  window.cancelAppExit = cancelAppExit;
}

function g(id) { return C.g(id); }
function nav(id, fromBack) { return C.nav(id, fromBack); }
function openMo(id) { return C.openMo(id); }
function closeMo(id) { return C.closeMo(id); }

export function onPageNav(id) {
  if (!id || _leaving) return;
  var cur = _navHistory[_navHistory.length - 1];
  if (cur === id) return;
  _navHistory.push(id);
  history.pushState({ isatok: 'nav', id: id }, '');
}

export function registerOverlay(key, closeFn) {
  if (!key || !closeFn || _overlayStack.indexOf(key) >= 0) return;
  _overlayStack.push(key);
  _overlayFns.set(key, closeFn);
  history.pushState({ isatok: 'overlay', key: key }, '');
}

export function unregisterOverlay(key) {
  var idx = _overlayStack.lastIndexOf(key);
  if (idx < 0) return;
  _overlayStack.splice(idx, 1);
  _overlayFns.delete(key);
  _skipPop++;
  history.back();
}

function onPopState() {
  if (_skipPop > 0) {
    _skipPop--;
    return;
  }
  if (_leaving) return;

  if (popOverlayStack()) return;

  if (consumeDomOverlay()) {
    history.pushState({ isatok: 'sentinel' }, '');
    return;
  }

  var st = history.state;

  if (st && st.isatok === 'sentinel') {
    if (_navHistory.length > 1) {
      _navHistory.pop();
      nav(_navHistory[_navHistory.length - 1], true);
    }
    history.pushState({ isatok: 'sentinel' }, '');
    return;
  }

  if (st && st.isatok === 'nav' && _navHistory.length <= 1) {
    openMo('mo-exit-app');
    return;
  }

  if (_navHistory.length > 1) {
    _navHistory.pop();
    nav(_navHistory[_navHistory.length - 1], true);
    history.pushState({ isatok: 'sentinel' }, '');
    return;
  }

  openMo('mo-exit-app');
}

function popOverlayStack() {
  if (!_overlayStack.length) return false;
  var key = _overlayStack[_overlayStack.length - 1];

  if (key === 'bs' && C.handleBsBackPress) {
    var result = C.handleBsBackPress();
    if (result === 'step') {
      history.pushState({ isatok: 'overlay', key: 'bs' }, '');
      return true;
    }
    if (result === 'close') {
      _overlayStack.pop();
      _overlayFns.delete('bs');
      return true;
    }
  }

  _overlayStack.pop();
  var fn = _overlayFns.get(key);
  _overlayFns.delete(key);
  if (fn) fn(true);
  return true;
}

function consumeDomOverlay() {
  if (g('mo-exit-app') && g('mo-exit-app').classList.contains('on')) {
    closeMo('mo-exit-app');
    return true;
  }

  var feedback = document.querySelector('.app-back-overlay');
  if (feedback) {
    feedback.remove();
    return true;
  }

  if (C.isCustomSelectOpen && C.isCustomSelectOpen()) {
    C.closeCustomSelectPanel(true);
    return true;
  }

  if (C.isLightboxOpen && C.isLightboxOpen()) {
    C.closeLightbox();
    return true;
  }

  if (C.isBSOpen && C.isBSOpen() && C.handleBsBackPress) {
    var bsResult = C.handleBsBackPress();
    return bsResult === 'step' || bsResult === 'close';
  }

  var openModals = Array.from(document.querySelectorAll('.mo.on'));
  if (openModals.length) {
    var top = openModals[openModals.length - 1];
    if (top.id === 'mo-my-player' && C.isMyPlayerMandatory && C.isMyPlayerMandatory()) {
      return false;
    }
    closeMo(top.id);
    return true;
  }

  var bs = g('bs-ch');
  var bsOv = g('bs-overlay');
  if (bs && bsOv && bs.classList.contains('on')) {
    if (C.closeBottomSheet) C.closeBottomSheet();
    return true;
  }

  return false;
}

export function confirmAppExit() {
  _leaving = true;
  _overlayStack.length = 0;
  _overlayFns.clear();
  closeMo('mo-exit-app');
  try { window.close(); } catch (e) { /* ignore */ }
  var steps = history.length;
  if (steps > 1) history.go(1 - steps);
  setTimeout(function () {
    try { window.close(); } catch (e) { /* ignore */ }
  }, 150);
}

export function cancelAppExit() {
  closeMo('mo-exit-app');
}
