/**
 * AI 코칭 — 경기 후·데일리·상대 분석·월간 스토리
 */
import {
  POST_MATCH_COMMENT_URL,
  DAILY_BRIEFING_URL,
  OPPONENT_ANALYSIS_URL,
  MONTHLY_CLUB_STORY_URL,
  DAILY_BRIEFING_CACHE_PREFIX,
  POST_MATCH_CACHE_PREFIX,
  OPPONENT_AI_CACHE_PREFIX,
  MONTHLY_STORY_CACHE_PREFIX
} from './constants.js?v=2026.07.07.01';

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @type {Map<string, unknown>} */
var _memCache = new Map();
/** @type {Map<string, Promise<unknown>>} */
var _inflightAi = new Map();

function cacheGet(prefix, key) {
  var fullKey = prefix + '|' + key;
  if (_memCache.has(fullKey)) return _memCache.get(fullKey);
  try {
    var raw = localStorage.getItem(fullKey);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    _memCache.set(fullKey, parsed);
    return parsed;
  } catch (e) {
    return null;
  }
}

function cacheSet(prefix, key, data) {
  var fullKey = prefix + '|' + key;
  _memCache.set(fullKey, data);
  try {
    localStorage.setItem(fullKey, JSON.stringify(data));
  } catch (e) { /* quota */ }
}

function _aiRequestKey(url, body) {
  return url + '|' + JSON.stringify(body);
}

/** 브라우저가 로딩 UI를 먼저 그릴 수 있도록 한 프레임 양보 */
export function yieldToPaint() {
  return new Promise(function (resolve) {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () { resolve(); });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

var AI_FETCH_TIMEOUT_MS = 45000;
var AI_MAX_RETRIES = 2;
var AI_RETRY_DELAYS_MS = [800, 2000];

function _delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function _isRetryableAiStatus(status) {
  return !status || status === 408 || status === 429 || status >= 500;
}

async function _fetchAiPost(url, body, timeoutMs) {
  var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;
  try {
    var opts = {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    };
    if (ctrl) opts.signal = ctrl.signal;
    var res = await fetch(url, opts);
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.ok) {
      var err = new Error(data.error || 'ai_failed');
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (e) {
    if (e && e.name === 'AbortError') {
      var timeoutErr = new Error('ai_timeout');
      timeoutErr.status = 408;
      throw timeoutErr;
    }
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function postAi(url, body) {
  var key = _aiRequestKey(url, body);
  if (_inflightAi.has(key)) return _inflightAi.get(key);

  var task = (async function () {
    var lastErr;
    for (var attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
      try {
        return await _fetchAiPost(url, body, AI_FETCH_TIMEOUT_MS);
      } catch (e) {
        lastErr = e;
        if (attempt >= AI_MAX_RETRIES || !_isRetryableAiStatus(e.status)) throw e;
        await _delay(AI_RETRY_DELAYS_MS[attempt] || 2000);
      }
    }
    throw lastErr;
  })();

  _inflightAi.set(key, task);
  try {
    return await task;
  } finally {
    if (_inflightAi.get(key) === task) _inflightAi.delete(key);
  }
}

/** weeklyReport 등 외부 모듈용 */
export async function requestAiJson(url, body) {
  return postAi(url, body);
}

function _clearAiCardLoadingOverlay(body) {
  if (!body) return;
  var overlay = body.querySelector('.ai-card__loading-overlay');
  if (overlay) overlay.remove();
}

/**
 * 새로고침 시 기존 콘텐츠 위 오버레이 로딩 (카드 높이 유지)
 * @returns {boolean}
 */
export function showAiCardRefreshOverlay(card, body, opts) {
  opts = opts || {};
  if (!card || !body || !opts.preserveContent) return false;
  var sel = opts.contentSelector || '.ai-card__hero';
  if (!body.querySelector(sel)) return false;
  card.setAttribute('data-state', 'refreshing');
  _clearAiCardLoadingOverlay(body);
  var overlay = document.createElement('div');
  overlay.className = 'ai-card__loading-overlay';
  overlay.setAttribute('aria-live', 'polite');
  var loadCls = opts.loadingClass || 'ai-card__loading';
  var spinCls = opts.spinnerClass || 'ai-card__spinner';
  overlay.innerHTML = '<div class="' + loadCls + '"><span class="' + spinCls + '"></span>'
    + (opts.message || '새로고침 중…') + '</div>';
  body.appendChild(overlay);
  return true;
}

export function clearAiCardLoadingOverlay(body) {
  _clearAiCardLoadingOverlay(body);
}

export async function fetchPostMatchComment(memberName, matchSummary) {
  var data = await postAi(POST_MATCH_COMMENT_URL, {memberName, matchSummary});
  return data.comment;
}

export async function fetchDailyBriefing(memberName, statsSummary) {
  var data = await postAi(DAILY_BRIEFING_URL, {memberName, statsSummary});
  return data.briefing;
}

export async function fetchOpponentAnalysis(memberName, opponentName, statsSummary) {
  var data = await postAi(OPPONENT_ANALYSIS_URL, {
    memberName, opponentName, statsSummary
  });
  return data.analysis;
}

export async function fetchMonthlyClubStory(monthLabel, clubSummary) {
  var data = await postAi(MONTHLY_CLUB_STORY_URL, {monthLabel, clubSummary});
  return data.story;
}

export function loadPostMatchCache(matchKey) {
  var d = cacheGet(POST_MATCH_CACHE_PREFIX, matchKey);
  return d && d.comment ? d.comment : null;
}

export function savePostMatchCache(matchKey, comment) {
  cacheSet(POST_MATCH_CACHE_PREFIX, matchKey, {comment: comment});
}

export function loadDailyBriefingCache(memberName, dateKey) {
  var d = cacheGet(DAILY_BRIEFING_CACHE_PREFIX, memberName + '|' + dateKey);
  return d && d.briefing ? d.briefing : null;
}

export function saveDailyBriefingCache(memberName, dateKey, briefing) {
  cacheSet(DAILY_BRIEFING_CACHE_PREFIX, memberName + '|' + dateKey, {briefing: briefing});
}

export function loadOpponentAiCache(memberName, opponentName) {
  var d = cacheGet(OPPONENT_AI_CACHE_PREFIX, memberName + '|' + opponentName);
  return d && d.analysis ? d.analysis : null;
}

export function saveOpponentAiCache(memberName, opponentName, analysis) {
  cacheSet(OPPONENT_AI_CACHE_PREFIX, memberName + '|' + opponentName, {analysis: analysis});
}

export function loadMonthlyStoryCache(monthKey) {
  var d = cacheGet(MONTHLY_STORY_CACHE_PREFIX, monthKey);
  return d && d.story ? d.story : null;
}

export function saveMonthlyStoryCache(monthKey, story) {
  cacheSet(MONTHLY_STORY_CACHE_PREFIX, monthKey, {story: story});
}

export function getKstMonthKey() {
  var d = new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit'
  }).format(d).replace('-', '-');
}

export function formatMonthLabel(monthKey) {
  var p = monthKey.split('-');
  return p[0] + '년 ' + parseInt(p[1], 10) + '월';
}

function renderAiCardContent(r, fields) {
  var html = '<div class="ai-card__hero">'
    + '<span class="ai-card__badge-lg">' + escHtml(r.badge || '✨') + '</span>'
    + '<div class="ai-card__hero-text">'
    + '<span class="ai-card__tag">' + escHtml(r.tag || r.weekTag || '') + '</span>'
    + '<div class="ai-card__headline">' + escHtml(r.headline || '') + '</div>'
    + '</div></div>';
  fields.forEach(function (f) {
    if (r[f.key]) {
      html += '<div class="ai-card__block ai-card__block--' + f.cls + '">'
        + '<span class="ai-card__block-lbl">' + f.lbl + '</span>'
        + '<span class="ai-card__block-txt">' + escHtml(r[f.key]) + '</span></div>';
    }
  });
  return html;
}

export function renderDailyBriefingShellHtml() {
  return '<div class="ai-card ai-card--daily hall-card" id="my-daily-briefing-card" data-state="loading">'
    + '<div class="ai-card__glow"></div>'
    + '<div class="hall-card__head ai-card__head">'
    + '<span class="hall-card__title">☀️ AI 데일리 브리핑</span>'
    + '<span class="hall-card__sub" id="my-daily-briefing-date">오늘</span>'
    + '</div>'
    + '<div class="ai-card__body" id="my-daily-briefing-body">'
    + '<div class="ai-card__loading"><span class="ai-card__spinner"></span>오늘의 코칭 준비 중…</div>'
    + '</div></div>';
}

export function updateDailyBriefingCard(state, opts) {
  opts = opts || {};
  var card = document.getElementById('my-daily-briefing-card');
  var body = document.getElementById('my-daily-briefing-body');
  var dateEl = document.getElementById('my-daily-briefing-date');
  if (!card || !body) return;
  if (dateEl && opts.dateLabel) dateEl.textContent = opts.dateLabel;

  if (state === 'loading') {
    var msg = opts.message || '오늘의 코칭 준비 중…';
    if (showAiCardRefreshOverlay(card, body, {preserveContent: opts.preserveContent, message: msg})) return;
    card.setAttribute('data-state', 'loading');
    body.innerHTML = '<div class="ai-card__loading"><span class="ai-card__spinner"></span>' + msg + '</div>';
    return;
  }

  _clearAiCardLoadingOverlay(body);
  card.setAttribute('data-state', state);

  if (state === 'error') {
    body.innerHTML = '<div class="ai-card__error">'
      + '<p class="ai-card__error-msg">브리핑을 불러오지 못했어요.</p>'
      + '<p class="ai-card__error-hint">네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p>'
      + '<button type="button" class="btn btn-g btn-sm ai-card__retry-btn" onclick="refreshDailyBriefing(true)">다시 시도</button>'
      + '</div>';
    return;
  }

  var b = opts.briefing || {};
  var staleNote = opts.stale
    ? '<span class="ai-card__stale-note">최신 브리핑을 불러오지 못해 이전 내용을 표시합니다</span>'
    : '';
  body.innerHTML = renderAiCardContent(b, [
    {key: 'tip', lbl: '💡 오늘의 팁', cls: 'tip'},
    {key: 'pick', lbl: '🎯 추천 액션', cls: 'pick'}
  ]) + '<div class="ai-card__foot">' + staleNote
    + '<span class="ai-card__ai-badge">✦ Gemini</span>'
    + '<button type="button" class="ai-card__refresh" onclick="refreshDailyBriefing(true)">새로고침</button></div>';
}

export function renderOpponentAiShellHtml() {
  return '<div class="ai-card ai-card--opponent" id="md-ai-opponent-card" data-state="loading">'
    + '<div class="ai-card__glow ai-card__glow--rival" aria-hidden="true"></div>'
    + '<div class="hall-card__head ai-card__head md-ai-head">'
    + '<span class="hall-card__title">⚔️ AI 상대 분석</span>'
    + '</div>'
    + '<div class="ai-card__body" id="md-ai-opponent-body">'
    + '<div class="ai-card__loading"><span class="ai-card__spinner"></span>상대 전적 분석 중…</div>'
    + '</div></div>';
}

export function updateOpponentAiCard(state, opts) {
  opts = opts || {};
  var card = document.getElementById('md-ai-opponent-card');
  var body = document.getElementById('md-ai-opponent-body');
  if (!card || !body) return;
  if (state === 'loading') {
    var msg = opts.message || '상대 전적 분석 중…';
    if (showAiCardRefreshOverlay(card, body, {preserveContent: opts.preserveContent, message: msg})) return;
    card.setAttribute('data-state', 'loading');
    body.innerHTML = '<div class="ai-card__loading"><span class="ai-card__spinner"></span>' + msg + '</div>';
    return;
  }
  _clearAiCardLoadingOverlay(body);
  card.setAttribute('data-state', state);
  if (state === 'hidden') {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';
  if (state === 'error') {
    body.innerHTML = '<div class="ai-card__error">'
      + '<p class="ai-card__error-msg">분석을 불러오지 못했어요.</p>'
      + '<p class="ai-card__error-hint">네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p></div>';
    return;
  }
  var a = opts.analysis || {};
  var staleNote = opts.stale
    ? '<span class="ai-card__stale-note">최신 분석을 불러오지 못해 이전 내용을 표시합니다</span>'
    : '';
  body.innerHTML = renderAiCardContent(a, [
    {key: 'strategy', lbl: '📋 전략', cls: 'strategy'},
    {key: 'warning', lbl: '⚠️ 주의', cls: 'warn'},
    {key: 'winTip', lbl: '🏆 승리 팁', cls: 'win'}
  ]) + '<div class="ai-card__foot">' + staleNote
    + '<span class="ai-card__ai-badge">✦ Powered by Gemini</span></div>';
}

export function renderMonthlyStoryShellHtml() {
  return '<div class="ai-card ai-card--monthly hall-card" id="hall-monthly-story-card" data-state="loading">'
    + '<div class="ai-card__glow ai-card__glow--gold"></div>'
    + '<div class="hall-card__head ai-card__head">'
    + '<span class="hall-card__title">📰 AI 월간 동호회 스토리</span>'
    + '<span class="hall-card__sub" id="hall-monthly-story-label">이번 달</span>'
    + '</div>'
    + '<div class="ai-card__body" id="hall-monthly-story-body">'
    + '<div class="ai-card__loading"><span class="ai-card__spinner"></span>이달의 이야기 작성 중…</div>'
    + '</div></div>';
}

export function updateMonthlyStoryCard(state, opts) {
  opts = opts || {};
  var card = document.getElementById('hall-monthly-story-card');
  var body = document.getElementById('hall-monthly-story-body');
  var label = document.getElementById('hall-monthly-story-label');
  if (!card || !body) return;
  if (label && opts.monthLabel) label.textContent = opts.monthLabel;
  if (state === 'loading') {
    var msg = opts.message || '이달의 이야기 작성 중…';
    if (showAiCardRefreshOverlay(card, body, {preserveContent: opts.preserveContent, message: msg})) return;
    card.setAttribute('data-state', 'loading');
    body.innerHTML = '<div class="ai-card__loading"><span class="ai-card__spinner"></span>' + msg + '</div>';
    return;
  }
  _clearAiCardLoadingOverlay(body);
  card.setAttribute('data-state', state);
  if (state === 'empty') {
    body.innerHTML = '<div class="ai-card__empty">이번 달 완료 경기가 없어요.</div>';
    return;
  }
  if (state === 'error') {
    body.innerHTML = '<div class="ai-card__error">'
      + '<p class="ai-card__error-msg">스토리를 불러오지 못했어요.</p>'
      + '<p class="ai-card__error-hint">네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p>'
      + '<button type="button" class="btn btn-g btn-sm ai-card__retry-btn" onclick="refreshMonthlyStory(true)">다시 시도</button>'
      + '</div>';
    return;
  }
  var s = opts.story || {};
  var staleNote = opts.stale
    ? '<span class="ai-card__stale-note">최신 스토리를 불러오지 못해 이전 내용을 표시합니다</span>'
    : '';
  body.innerHTML = renderAiCardContent(s, [
    {key: 'story', lbl: '📖 하이라이트', cls: 'story'},
    {key: 'mvp', lbl: '⭐ 주목 선수', cls: 'mvp'},
    {key: 'quote', lbl: '💬 한마디', cls: 'quote'}
  ]) + '<div class="ai-card__foot">' + staleNote
    + '<span class="ai-card__ai-badge">✦ Gemini</span>'
    + '<button type="button" class="ai-card__refresh" onclick="refreshMonthlyStory(true)">새로고침</button></div>';
}

export function formatPostMatchComment(comment) {
  if (!comment) return '';
  if (typeof comment === 'string') return comment;
  var emoji = comment.emoji || '🎙️';
  return emoji + ' ' + (comment.comment || '');
}
