/**
 * 하단 네비·딥링크 진입 네비게이션
 */
import { requireMyPlayer } from './wizard.js?v=2026.06.26.10';
import { isAdmin, renderAdminHub } from './adminTab.js?v=2026.06.26.10';
import { onPageNav } from './backNav.js?v=2026.06.26.10';

let C = null;
let _navPages = null;
let _navItems = null;
let _navBni = null;
let _navFab = null;
let _navMain = null;

export function initAppNav(ctx) {
  C = ctx;
  window.nav = nav;
}

function g(id) { return C.g(id); }

function initNavCache() {
  _navPages = Array.from(document.querySelectorAll('.page'));
  _navItems = Array.from(document.querySelectorAll('.nav-i'));
  _navBni = Array.from(document.querySelectorAll('.bni'));
  _navFab = Array.from(g('app').querySelectorAll('.fab'));
  _navMain = document.querySelector('.main');
}

export function getCurrentPage() {
  return C.getCurrentPage();
}

function nav(id, fromBack) {
  if (id === 'my' && !requireMyPlayer()) return;
  if (!_navPages) initNavCache();
  if (!fromBack) onPageNav(id);
  C.setCurrentPage(id);
  _navPages.forEach(function(p) { p.classList.toggle('on', p.id === 'page-' + id); });
  _navItems.forEach(function(n) { n.classList.toggle('on', n.dataset.page === id); });
  _navBni.forEach(function(n) { n.classList.toggle('on', n.dataset.p === id); });
  if (_navMain) _navMain.scrollTo(0, 0);
  var fabDisplay = id === 'challenge' ? 'flex' : 'none';
  _navFab.forEach(function(f) { f.style.display = fabDisplay; });
  document.body.classList.toggle('has-fab', id === 'challenge');
  if (id === 'members') C.renderM();
  else if (id === 'ranking') C.renderR();
  else if (id === 'hall') C.renderHall();
  else if (id === 'my') C.renderMyPage();
  else if (id === 'attendance') C.initAttendancePage();
  else if (id === 'admin') {
    if (isAdmin()) renderAdminHub();
    else nav('challenge');
  } else if (id === 'challenge') C.renderC();
}

function parseEntryFromLocation() {
  var pageId = null, params = {};
  try {
    var sp = new URLSearchParams(window.location.search);
    if (sp.get('p')) {
      pageId = sp.get('p');
      if (sp.get('ch')) params.ch = decodeURIComponent(sp.get('ch'));
      if (sp.get('filter')) params.filter = sp.get('filter');
      return { pageId: pageId, params: params };
    }
  } catch (e) {}
  var hash = window.location.hash;
  if (hash && hash.length > 1) {
    var hashBody = hash.slice(1);
    var qIdx = hashBody.indexOf('?');
    pageId = qIdx > -1 ? hashBody.slice(0, qIdx) : hashBody;
    if (qIdx > -1) {
      hashBody.slice(qIdx + 1).split('&').forEach(function(pair) {
        var kv = pair.split('=');
        if (kv.length === 2) params[kv[0]] = decodeURIComponent(kv[1]);
      });
    }
  }
  return { pageId: pageId, params: params };
}

export function applyEntryNavigation() {
  var entry = parseEntryFromLocation();
  var validPages = ['challenge', 'ranking', 'members', 'hall', 'admin', 'my', 'attendance'];
  if (!entry.pageId || validPages.indexOf(entry.pageId) < 0) return;
  nav(entry.pageId);
  if (entry.pageId === 'challenge') {
    if (entry.params.ch) C.setDeepLinkCh(entry.params.ch);
    if (entry.params.filter) {
      window.setF(entry.params.filter);
    } else if (entry.params.ch) {
      C.setPendingDeepLinkFilter(entry.params.ch);
    }
  }
}
