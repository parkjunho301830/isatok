/**
 * 유튜브·앱 조회수 조회·표시 (Cloud Function 프록시 경유)
 */
import { YOUTUBE_VIDEO_STATS_URL } from './constants.js?v=2026.07.07.01';
import { formatViewCount } from './youtubeUtils.js?v=2026.07.07.01';

const CACHE_KEY = 'isatok_yt_views_v3';
const CACHE_TTL_MS = 60 * 60 * 1000;
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function hasYouTubeViewStats() {
  return !!YOUTUBE_VIDEO_STATS_URL;
}

function _loadCache() {
  try {
    var raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function _saveCache(obj) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch (e) {}
}

function _normalizeIds(videoIds) {
  var unique = [];
  (videoIds || []).forEach(function(id) {
    var s = String(id || '').trim();
    if (!YT_ID_RE.test(s) || unique.indexOf(s) >= 0) return;
    unique.push(s);
  });
  return unique;
}

/**
 * @param {string[]} batch
 * @returns {Promise<Record<string, number>>}
 */
async function _fetchBatch(batch) {
  var res = await fetch(YOUTUBE_VIDEO_STATS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: batch })
  });
  var data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok || !data || !data.ok) {
    console.warn('[isatok] YouTube 조회수 프록시 실패', res.status, data);
    return {};
  }
  return data.views || {};
}

/**
 * @param {string[]} videoIds
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchYouTubeViewCounts(videoIds) {
  if (!YOUTUBE_VIDEO_STATS_URL) return {};
  var unique = _normalizeIds(videoIds);
  if (!unique.length) return {};

  var now = Date.now();
  var cache = _loadCache();
  var out = {};
  var need = [];

  unique.forEach(function(id) {
    var hit = cache[id];
    if (hit && now - hit.at < CACHE_TTL_MS) out[id] = hit.n;
    else need.push(id);
  });

  for (var i = 0; i < need.length; i += 50) {
    var batch = need.slice(i, i + 50);
    try {
      var views = await _fetchBatch(batch);
      Object.keys(views).forEach(function(id) {
        var n = views[id];
        if (!n) return;
        out[id] = n;
        cache[id] = { n: n, at: now };
      });
    } catch (e) {
      console.warn('[isatok] YouTube 조회수 요청 오류', e);
    }
  }

  _saveCache(cache);
  return out;
}

export function getAppViewCount(source) {
  if (!source) return 0;
  var n = source.videoViewCount != null ? source.videoViewCount : source.viewCount;
  return Number(n) > 0 ? Number(n) : 0;
}

/**
 * @param {number} appCount
 * @param {string|null} youtubeId
 * @param {Record<string, number>} youtubeViews
 * @param {{ loading?: boolean }} [opts]
 * @returns {string}
 */
export function resolveViewCountLabel(appCount, youtubeId, youtubeViews, opts) {
  opts = opts || {};
  if (youtubeViews && youtubeId && youtubeViews[youtubeId] != null) {
    return '👁 ' + formatViewCount(youtubeViews[youtubeId]);
  }
  if (hasYouTubeViewStats()) {
    return opts.loading ? '👁 ···' : '';
  }
  if (appCount > 0) {
    return '👁 ' + formatViewCount(appCount) + ' 재생';
  }
  return '';
}
