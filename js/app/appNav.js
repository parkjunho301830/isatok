/**
 * 하단 네비·딥링크 진입 네비게이션
 */
import { requireMyPlayer, getMyPlayerId } from './wizard.js?v=2026.07.07.01';
import { isAdmin, renderAdminHub } from './adminTab.js?v=2026.07.07.01';
import { unbindAdminPresencePanel } from './playerPresence.js?v=2026.07.07.01';
import { onPageNav } from './backNav.js?v=2026.07.07.01';
import { DEEPLINK_PARAM, DEEPLINK_LESSON_PARAM, DEEPLINK_MATCH_VIDEO_PARAM } from './constants.js?v=2026.07.07.01';
import { getStatsSection, setStatsSection } from './statsTab.js?v=2026.07.07.01';
import { getVideoSection, setVideoSection, clearVideosScrollAnchor } from './videosTab.js?v=2026.07.07.01';

let C = null;
let _navPages = null;
let _navItems = null;
let _navBni = null;
let _navFab = null;
let _navMain = null;

var LEGACY_STATS_MAP = {
  ranking: 'ranking',
  my: 'coaching',
  hall: 'club'
};

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

function resolveNavTarget(id, section) {
  if (LEGACY_STATS_MAP[id]) {
    return { page: 'stats', section: LEGACY_STATS_MAP[id] };
  }
  if (id === 'stats') {
    return { page: 'stats', section: section || getStatsSection() || 'ranking' };
  }
  if (id === 'videos') {
    return { page: 'videos', section: section || getVideoSection() || 'all' };
  }
  return { page: id, section: null };
}

function isNavActive(page, section, navPage) {
  if (page === 'stats') return navPage === 'stats';
  if (page === 'videos') return navPage === 'videos';
  return navPage === page;
}

function nav(id, fromBack, section) {
  if (typeof fromBack === 'string' && section === undefined) {
    section = fromBack;
    fromBack = false;
  }
  var prevPage = C.getCurrentPage();
  var target = resolveNavTarget(id, section);
  if (!_navPages) initNavCache();
  if (!fromBack) onPageNav(target.page);
  if (prevPage === 'videos' && target.page !== 'videos') clearVideosScrollAnchor();
  C.setCurrentPage(target.page);
  _navPages.forEach(function(p) {
    p.classList.toggle('on', p.id === 'page-' + target.page);
  });
  _navItems.forEach(function(n) {
    n.classList.toggle('on', isNavActive(target.page, target.section, n.dataset.page));
  });
  _navBni.forEach(function(n) {
    n.classList.toggle('on', isNavActive(target.page, target.section, n.dataset.p));
  });
  if (_navMain) _navMain.scrollTo(0, 0);
  var fabDisplay = target.page === 'challenge' ? 'flex' : 'none';
  _navFab.forEach(function(f) { f.style.display = fabDisplay; });
  document.body.classList.toggle('has-fab', target.page === 'challenge');
  if (target.page !== 'admin') unbindAdminPresencePanel();
  if (target.page === 'members') C.renderM();
  else if (target.page === 'stats') {
    setStatsSection(target.section);
  } else if (target.page === 'videos') {
    setVideoSection(target.section);
  } else if (target.page === 'attendance') C.initAttendancePage();
  else if (target.page === 'admin') {
    if (isAdmin()) renderAdminHub();
    else nav('challenge');
  } else if (target.page === 'challenge') C.renderC();
}

function parseEntryFromLocation() {
  var pageId = null, params = {}, section = null;
  try {
    var sp = new URLSearchParams(window.location.search);
    if (sp.get(DEEPLINK_PARAM) || sp.get(DEEPLINK_LESSON_PARAM) || sp.get(DEEPLINK_MATCH_VIDEO_PARAM)) {
      return { pageId: null, params: {}, section: null };
    }
    if (sp.get('tab')) {
      pageId = sp.get('tab');
      return { pageId: pageId, params: params, section: LEGACY_STATS_MAP[pageId] || null };
    }
    if (sp.get('p')) {
      pageId = sp.get('p');
      if (sp.get('ch')) params.ch = decodeURIComponent(sp.get('ch'));
      if (sp.get('filter')) params.filter = sp.get('filter');
      return { pageId: pageId, params: params, section: LEGACY_STATS_MAP[pageId] || null };
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
    section = LEGACY_STATS_MAP[pageId] || null;
  }
  return { pageId: pageId, params: params, section: section };
}

export function applyEntryNavigation() {
  var entry = parseEntryFromLocation();
  var validPages = ['challenge', 'ranking', 'members', 'hall', 'admin', 'my', 'attendance', 'stats', 'videos'];
  if (!entry.pageId || validPages.indexOf(entry.pageId) < 0) return;
  if (entry.pageId === 'ranking' || entry.pageId === 'my' || entry.pageId === 'hall') {
    nav('stats', false, entry.section || LEGACY_STATS_MAP[entry.pageId]);
  } else {
    nav(entry.pageId, false, entry.section);
  }
  try {
    var sp = new URLSearchParams(window.location.search);
    if (sp.get('tab') || sp.get('p')) history.replaceState(null, '', '/');
  } catch (e) {}
  if (entry.pageId === 'challenge') {
    if (entry.params.ch) C.setDeepLinkCh(entry.params.ch);
    if (entry.params.filter) {
      if (entry.params.filter === 'video') nav('videos', false, '대결');
      else window.setF(entry.params.filter);
    } else if (entry.params.ch) {
      C.setPendingDeepLinkFilter(entry.params.ch);
    }
  }
}
