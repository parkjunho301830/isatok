/**
 * 스크롤 중 렌더 디바운스·스냅샷 후 보정 렌더
 */
let C = null;
let _isScrolling = false;
let _scrollTimer = null;
let _scrollRaf = null;
let _pendingRender = { c: false, m: false, grids: false, sn: false, h: false };
let _pendingDeepLink = false;

export function initScrollBridge(ctx) {
  C = ctx;
  if (window._scrollPerfBound) return;
  window._scrollPerfBound = true;
  var handler = onMainScroll;
  window.addEventListener('scroll', handler, { passive: true, capture: true });
  document.addEventListener('scroll', handler, { passive: true, capture: true });
  var mainEl = document.querySelector('.main');
  if (mainEl) mainEl.addEventListener('scroll', handler, { passive: true });
}

export function isScrolling() {
  return _isScrolling;
}

export function markPendingChallengeRender() {
  _pendingRender.c = true;
}

export function markPendingDeepLink() {
  _pendingDeepLink = true;
}

export function markPendingSeasonRender() {
  _pendingRender.sn = true;
}

function flushPendingRenders() {
  var page = C.getCurrentPage();
  if (_pendingRender.m && page === 'members') C.renderM();
  if (_pendingRender.m && page === 'ranking') C.renderR();
  if (_pendingRender.grids && C.isBSOpen() && !C.isBsPlayerSearchActive() && !C.isBsFormInputFocused()) {
    C.renderGridsBS({ force: true });
  }
  if (_pendingRender.c && page === 'challenge' && !C.isBSFocused()) C.renderC();
  if (_pendingRender.sn) C.applySeasonsSnapshotRender();
  if (_pendingRender.h && page === 'hall') C.renderHall();
  _pendingRender.c = false;
  _pendingRender.m = false;
  _pendingRender.grids = false;
  _pendingRender.sn = false;
  _pendingRender.h = false;
  if (_pendingDeepLink && !C.isDeepLinkHandled()) {
    _pendingDeepLink = false;
    C.handleDeepLink();
  }
}

function onMainScroll() {
  if (!_scrollRaf) {
    _scrollRaf = requestAnimationFrame(function() {
      _scrollRaf = null;
      _isScrolling = true;
      document.documentElement.classList.add('is-scrolling');
    });
  }
  if (_scrollTimer) clearTimeout(_scrollTimer);
  _scrollTimer = setTimeout(function() {
    _isScrolling = false;
    _scrollTimer = null;
    document.documentElement.classList.remove('is-scrolling');
    requestAnimationFrame(flushPendingRenders);
  }, 120);
}

export function applyMembersSnapshotRender() {
  if (C.getMembers().length) C.checkMyPlayerSetup();
  if (_isScrolling) {
    _pendingRender.m = true;
    if (C.isBSOpen()) {
      if (C.isBsPlayerSearchActive() || C.isBsFormInputFocused()) C.deferBsGridRefresh();
      else _pendingRender.grids = true;
    }
    return;
  }
  var page = C.getCurrentPage();
  if (page === 'members') C.renderM();
  if (page === 'ranking') C.renderR();
  if (page === 'hall') C.renderHall();
  if (C.isBSOpen()) {
    if (C.isBsPlayerSearchActive() || C.isBsFormInputFocused()) C.deferBsGridRefresh();
    else C.renderGridsBS();
  }
}
