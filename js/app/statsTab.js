/**
 * 기록 탭 — 순위 · 코칭 · 동호회 서브탭
 */
let C = null;
let _statsSection = 'ranking';

export function initStatsTab(ctx) {
  C = ctx;
  window.setStatsSection = setStatsSection;
}

function g(id) { return C.g(id); }

export function getStatsSection() {
  return _statsSection;
}

export function isStatsRankingView(page) {
  return page === 'stats' && _statsSection === 'ranking';
}

export function isStatsClubView(page) {
  return page === 'stats' && _statsSection === 'club';
}

export function isStatsCoachingView(page) {
  return page === 'stats' && _statsSection === 'coaching';
}

function _syncStatsSubtabUi() {
  ['ranking', 'coaching', 'club'].forEach(function(sec) {
    var btn = g('stats-sec-' + sec);
    if (btn) btn.classList.toggle('on', _statsSection === sec);
  });
}

function _showStatsPanel(section) {
  document.querySelectorAll('.stats-panel').forEach(function(p) {
    p.classList.toggle('on', p.id === 'stats-panel-' + section);
  });
}

function _renderStatsSection(section) {
  if (section === 'ranking') {
    C.renderR();
  } else if (section === 'coaching') {
    C.renderMyPage();
  } else if (section === 'club') {
    if (C.alignHallModeFromRanking) C.alignHallModeFromRanking();
    C.renderHall();
  }
}

function _restartPanelAnimations(section) {
  var panel = g('stats-panel-' + section);
  if (!panel) return;
  panel.querySelectorAll('.hall-anim, .hall-row--anim, .hall-insight--anim, .hall-form-pill--anim').forEach(function(el) {
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = '';
  });
}

function _renderStatsSectionDeferred(section) {
  var run = function() {
    _renderStatsSection(section);
    if (section === 'coaching' || section === 'club') {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function() { _restartPanelAnimations(section); });
      } else {
        _restartPanelAnimations(section);
      }
    }
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(run);
  } else {
    run();
  }
}

export function setStatsSection(section, opts) {
  opts = opts || {};
  if (section !== 'ranking' && section !== 'coaching' && section !== 'club') return;
  _statsSection = section;
  _syncStatsSubtabUi();
  _showStatsPanel(section);
  _renderStatsSectionDeferred(section);
}

export function renderStats() {
  _syncStatsSubtabUi();
  _showStatsPanel(_statsSection);
  _renderStatsSectionDeferred(_statsSection);
}
