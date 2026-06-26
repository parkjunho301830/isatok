/**
 * Gemini 주간 코칭 리포트 — Functions 프록시 + 주간 localStorage 캐시
 */
import {
  WEEKLY_COACH_REPORT_URL,
  WEEKLY_REPORT_CACHE_KEY_PREFIX
} from './constants.js?v=2026.06.26.10';
import { kstDateKey } from './coaching.js?v=2026.06.26.10';
import { showAiCardRefreshOverlay, clearAiCardLoadingOverlay, requestAiJson } from './aiCoach.js?v=2026.06.26.10';

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {Date} [d]
 * @returns {Date}
 */
function toKstDate(d) {
  d = d || new Date();
  var utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 9 * 3600000);
}

/**
 * @param {Date} kst
 * @returns {string} YYYY-MM-DD (월요일)
 */
export function getKstWeekStartKey(kst) {
  kst = kst || toKstDate();
  var dow = kst.getDay();
  var monOffset = dow === 0 ? -6 : 1 - dow;
  var mon = new Date(kst);
  mon.setDate(kst.getDate() + monOffset);
  return kstDateKey(mon);
}

/**
 * @param {string} startKey YYYY-MM-DD
 * @param {number} days
 * @returns {string}
 */
function addDaysToKey(startKey, days) {
  var p = startKey.split('-').map(Number);
  var dt = new Date(p[0], p[1] - 1, p[2] + days);
  return kstDateKey(dt);
}

/**
 * @param {string} startKey
 * @returns {string}
 */
export function formatWeekLabel(startKey) {
  var endKey = addDaysToKey(startKey, 6);
  var s = startKey.slice(5).replace('-', '/');
  var e = endKey.slice(5).replace('-', '/');
  return s + ' ~ ' + e;
}

/**
 * @param {string} memberName
 * @param {string} weekKey
 * @returns {string}
 */
function cacheKey(memberName, weekKey) {
  return WEEKLY_REPORT_CACHE_KEY_PREFIX + '|' + memberName + '|' + weekKey;
}

/**
 * @param {string|object} raw
 * @returns {object}
 */
export function normalizeWeeklyReport(raw) {
  if (raw && typeof raw === 'object' && raw.headline) {
    return {
      badge: raw.badge || '✨',
      weekTag: raw.weekTag || '이번 주',
      headline: raw.headline || '',
      highlight: raw.highlight || '',
      story: raw.story || '',
      nextMission: raw.nextMission || ''
    };
  }
  var text = typeof raw === 'string' ? raw : '';
  return {
    badge: '✨',
    weekTag: '이번 주',
    headline: '주간 코칭 리포트',
    highlight: '',
    story: text,
    nextMission: ''
  };
}

/**
 * @param {object} report
 * @returns {string}
 */
export function renderWeeklyReportContentHtml(report) {
  var r = normalizeWeeklyReport(report);
  var html = '<div class="my-weekly-report__hero">'
    + '<span class="my-weekly-report__badge-lg">' + escHtml(r.badge) + '</span>'
    + '<div class="my-weekly-report__hero-text">'
    + '<span class="my-weekly-report__tag">' + escHtml(r.weekTag) + '</span>'
    + '<div class="my-weekly-report__headline">' + escHtml(r.headline) + '</div>'
    + '</div></div>';
  if (r.highlight) {
    html += '<div class="my-weekly-report__highlight">' + escHtml(r.highlight) + '</div>';
  }
  if (r.story) {
    html += '<p class="my-weekly-report__story">' + escHtml(r.story) + '</p>';
  }
  if (r.nextMission) {
    html += '<div class="my-weekly-report__mission">'
      + '<span class="my-weekly-report__mission-lbl">🎯 다음 주 미션</span>'
      + '<span class="my-weekly-report__mission-txt">' + escHtml(r.nextMission) + '</span>'
      + '</div>';
  }
  return html;
}

/**
 * @param {string} memberName
 * @param {string} weekKey
 * @returns {{report: object|string, generatedAt: string}|null}
 */
export function loadWeeklyReportCache(memberName, weekKey) {
  try {
    var raw = localStorage.getItem(cacheKey(memberName, weekKey));
    if (!raw) return null;
    var data = JSON.parse(raw);
    if (!data || !data.report) return null;
    return data;
  } catch (e) {
    return null;
  }
}

/**
 * @param {string} memberName
 * @param {string} weekKey
 * @param {object|string} report
 */
export function saveWeeklyReportCache(memberName, weekKey, report) {
  try {
    localStorage.setItem(cacheKey(memberName, weekKey), JSON.stringify({
      weekKey: weekKey,
      memberName: memberName,
      report: report,
      generatedAt: new Date().toISOString()
    }));
  } catch (e) { /* quota */ }
}

/**
 * @param {string} memberName
 * @param {string} statsSummary
 * @returns {Promise<object|string>}
 */
export async function fetchWeeklyCoachReport(memberName, statsSummary) {
  var data = await requestAiJson(WEEKLY_COACH_REPORT_URL, {
    memberName: memberName,
    statsSummary: statsSummary
  });
  if (!data.report) throw new Error('report_failed');
  return data.report;
}

/**
 * @returns {string}
 */
export function renderWeeklyReportShellHtml() {
  return '<div class="my-weekly-report hall-card" id="my-weekly-report-card" data-state="loading">'
    + '<div class="my-weekly-report__glow" aria-hidden="true"></div>'
    + '<div class="hall-card__head my-weekly-report__head">'
    + '<span class="hall-card__title">✨ AI 주간 리포트</span>'
    + '<span class="hall-card__sub" id="my-weekly-report-week">이번 주</span>'
    + '</div>'
    + '<div class="my-weekly-report__body" id="my-weekly-report-body">'
    + '<div class="my-weekly-report__loading"><span class="my-weekly-report__spinner"></span>'
    + 'Gemini가 이번 주 기록을 분석 중…</div>'
    + '</div></div>';
}

/**
 * @param {'loading'|'empty'|'ready'|'error'} state
 * @param {object} [opts]
 */
export function updateWeeklyReportCard(state, opts) {
  opts = opts || {};
  var card = document.getElementById('my-weekly-report-card');
  var body = document.getElementById('my-weekly-report-body');
  var weekEl = document.getElementById('my-weekly-report-week');
  if (!card || !body) return;
  if (weekEl && opts.weekLabel) weekEl.textContent = opts.weekLabel;

  if (state === 'loading') {
    var msg = opts.message || 'Gemini가 이번 주 기록을 분석 중…';
    if (showAiCardRefreshOverlay(card, body, {
      preserveContent: opts.preserveContent,
      message: msg,
      contentSelector: '.my-weekly-report__hero',
      loadingClass: 'my-weekly-report__loading',
      spinnerClass: 'my-weekly-report__spinner'
    })) return;
    card.setAttribute('data-state', 'loading');
    body.innerHTML = '<div class="my-weekly-report__loading"><span class="my-weekly-report__spinner"></span>' + msg + '</div>';
    return;
  }

  clearAiCardLoadingOverlay(body);
  card.setAttribute('data-state', state);
  if (state === 'empty') {
    body.innerHTML = '<div class="my-weekly-report__empty">'
      + '<span class="my-weekly-report__empty-icon">📅</span>'
      + '<p>이번 주 아직 완료된 경기가 없어요.<br>경기 후 AI 주간 코칭이 생성됩니다.</p></div>';
    return;
  }
  if (state === 'error') {
    body.innerHTML = '<div class="ai-card__error my-weekly-report__error">'
      + '<p class="ai-card__error-msg">리포트를 불러오지 못했어요.</p>'
      + '<p class="ai-card__error-hint">네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p>'
      + '<button type="button" class="btn btn-g btn-sm ai-card__retry-btn" onclick="refreshWeeklyReport(true)">다시 시도</button>'
      + '</div>';
    return;
  }
  var staleNote = opts.stale
    ? '<span class="ai-card__stale-note">최신 리포트를 불러오지 못해 이전 내용을 표시합니다</span>'
    : '';
  body.innerHTML = renderWeeklyReportContentHtml(opts.report)
    + '<div class="my-weekly-report__foot">' + staleNote
    + '<span class="my-weekly-report__ai-badge">✦ Powered by Gemini</span>'
    + '<button type="button" class="my-weekly-report__refresh" onclick="refreshWeeklyReport(true)">새로고침</button>'
    + '</div>';
}
