/**
 * 영상(videos) 조회 이력 — Firestore 저장 · 관리자 열람
 */
import {
  collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { COL_VIDEO_VIEW_LOGS } from './constants.js?v=2026.07.07.01';
import { getVideoDisplayTitle } from './videoCategoryUtils.js?v=2026.07.07.01';
import { requireAdmin } from './adminTab.js?v=2026.07.07.01';

let C = null;
let _allLogs = [];

export function initVideoViewLogs(ctx) {
  C = ctx;
  window.openVideoViewLogs = openVideoViewLogs;
  window.applyVideoViewLogFilters = applyVideoViewLogFilters;
}

function g(id) { return C.g(id); }

function _esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 영상 재생 직전 호출 — 실패해도 재생에 영향 없음 */
export function logVideoView(videoId) {
  if (!videoId || !C) return;
  var db = C.getDb && C.getDb();
  if (!db) return;

  var videos = C.getVideos ? C.getVideos() : [];
  var v = videos.find(function(x) { return x.id === videoId; });
  var videoTitle = v ? getVideoDisplayTitle(v) : '영상';
  var viewerName = (C.getMyPlayerName && C.getMyPlayerName()) || '익명';
  var ua = '';
  try { ua = String(navigator.userAgent || '').slice(0, 100); } catch (e) {}

  addDoc(collection(db, COL_VIDEO_VIEW_LOGS), {
    videoId: videoId,
    videoTitle: videoTitle,
    viewerName: viewerName,
    viewedAt: serverTimestamp(),
    userAgent: ua
  }).catch(function(e) {
    console.warn('[이사탁] 영상 조회 이력 저장 실패', e);
  });
}

export function openVideoViewLogs() {
  requireAdmin(function() {
    _loadAndShowLogs();
  });
}

async function _loadAndShowLogs() {
  var db = C.getDb && C.getDb();
  var listEl = g('video-view-logs-list');
  var summaryEl = g('video-view-logs-summary');
  if (!db) {
    if (C.toast) C.toast('⚠️ 데이터베이스에 연결할 수 없습니다');
    return;
  }

  if (listEl) listEl.innerHTML = '<div class="video-view-logs-loading">불러오는 중…</div>';
  if (summaryEl) summaryEl.textContent = '';
  _populateVideoFilterSelect();
  _resetLogFilters();
  C.openMo('mo-video-view-logs');

  try {
    var snap = await getDocs(
      query(collection(db, COL_VIDEO_VIEW_LOGS), orderBy('viewedAt', 'desc'), limit(100))
    );
    _allLogs = snap.docs.map(function(d) {
      var data = d.data();
      return {
        id: d.id,
        videoId: data.videoId || '',
        videoTitle: data.videoTitle || '',
        viewerName: data.viewerName || '익명',
        viewedAt: data.viewedAt,
        userAgent: data.userAgent || ''
      };
    });
    applyVideoViewLogFilters();
  } catch (e) {
    console.warn('[이사탁] 조회 이력 로드 실패', e);
    if (listEl) {
      listEl.innerHTML = '<div class="video-view-logs-empty">이력을 불러오지 못했습니다</div>';
    }
  }
}

function _resetLogFilters() {
  var videoSel = g('video-view-logs-video-filter');
  var fromEl = g('video-view-logs-date-from');
  var toEl = g('video-view-logs-date-to');
  if (videoSel) videoSel.value = '';
  if (fromEl) fromEl.value = '';
  if (toEl) toEl.value = '';
}

function _populateVideoFilterSelect() {
  var sel = g('video-view-logs-video-filter');
  if (!sel) return;
  var videos = C.getVideos ? C.getVideos() : [];
  var html = '<option value="">전체 영상</option>';
  videos.forEach(function(v) {
    html += '<option value="' + _esc(v.id) + '">' + _esc(getVideoDisplayTitle(v)) + '</option>';
  });
  sel.innerHTML = html;
}

export function applyVideoViewLogFilters() {
  var videoId = (g('video-view-logs-video-filter') || {}).value || '';
  var dateFrom = (g('video-view-logs-date-from') || {}).value || '';
  var dateTo = (g('video-view-logs-date-to') || {}).value || '';

  var filtered = _allLogs.filter(function(row) {
    if (videoId && row.videoId !== videoId) return false;
    var day = _viewedAtDay(row.viewedAt);
    if (!day) return !dateFrom && !dateTo;
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    return true;
  });

  var summaryEl = g('video-view-logs-summary');
  if (summaryEl) summaryEl.textContent = '총 ' + filtered.length + '건';

  var listEl = g('video-view-logs-list');
  if (!listEl) return;
  if (!filtered.length) {
    listEl.innerHTML = '<div class="video-view-logs-empty">조회 이력이 없습니다</div>';
    return;
  }
  listEl.innerHTML = filtered.map(_renderLogRow).join('');
}

function _viewedAtDay(viewedAt) {
  var d = _toDate(viewedAt);
  if (!d) return '';
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function _toDate(viewedAt) {
  if (!viewedAt) return null;
  if (viewedAt.toDate) return viewedAt.toDate();
  var d = new Date(viewedAt);
  return isNaN(d.getTime()) ? null : d;
}

function _formatViewedAt(viewedAt) {
  var d = _toDate(viewedAt);
  if (!d) return '—';
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  var h = String(d.getHours()).padStart(2, '0');
  var min = String(d.getMinutes()).padStart(2, '0');
  return y + '-' + m + '-' + day + ' ' + h + ':' + min;
}

function _shortUa(ua) {
  ua = String(ua || '').trim();
  if (!ua) return '—';
  if (ua.length <= 60) return ua;
  return ua.slice(0, 57) + '…';
}

function _renderLogRow(row) {
  return '<div class="video-view-log-row">'
    + '<div class="video-view-log-row__title">' + _esc(row.videoTitle || '영상') + '</div>'
    + '<div class="video-view-log-row__meta">'
    + '<span class="video-view-log-row__viewer">👤 ' + _esc(row.viewerName || '익명') + '</span>'
    + '<span class="video-view-log-row__time">' + _esc(_formatViewedAt(row.viewedAt)) + '</span>'
    + '</div>'
    + '<div class="video-view-log-row__ua" title="' + _esc(row.userAgent) + '">'
    + _esc(_shortUa(row.userAgent))
    + '</div>'
    + '</div>';
}
