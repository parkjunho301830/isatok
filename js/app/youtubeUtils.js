/**
 * 유튜브 URL 파싱·임베드 URL 생성
 */

/**
 * 유튜브 URL에서 영상 ID 추출
 * @param {string} url
 * @returns {string|null} 11자리 영상 ID 또는 null
 */
export function extractYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  var s = url.trim();
  if (!s) return null;

  var id = null;

  // youtu.be/ID
  var short = s.match(/(?:^https?:\/\/)?(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{11})(?:[?&#/]|$)/i);
  if (short) id = short[1];

  // youtube.com/watch — v 파라미터
  if (!id) {
    var watchRe = new RegExp(
      '(?:^https?:\\/\\/)?(?:www\\.)?youtube\\.com\\/watch\\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})',
      'i'
    );
    var watch = s.match(watchRe);
    if (watch) id = watch[1];
  }

  // youtube.com/shorts/ID
  if (!id) {
    var shorts = s.match(/(?:^https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]{11})(?:[?&#/]|$)/i);
    if (shorts) id = shorts[1];
  }

  // youtube.com/embed/ID
  if (!id) {
    var embed = s.match(/(?:^https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([A-Za-z0-9_-]{11})(?:[?&#/]|$)/i);
    if (embed) id = embed[1];
  }

  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  return id;
}

/**
 * @param {string} videoId
 * @returns {string|null}
 */
export function buildYouTubeEmbedUrl(videoId) {
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  return 'https://www.youtube.com/embed/' + videoId;
}

/**
 * @param {string} videoId
 * @returns {string|null}
 */
export function buildYouTubeThumbUrl(videoId) {
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  return 'https://img.youtube.com/vi/' + videoId + '/0.jpg';
}

/** 조회수 표시용 — 유튜브 스타일 (1만 미만은 1,234 / 이상은 1.2만) */
export function formatViewCount(n) {
  n = Number(n) || 0;
  if (n < 1) return '0';
  if (n >= 100000000) {
    var eok = n / 100000000;
    return (eok >= 10 ? Math.round(eok) : eok.toFixed(1).replace(/\.0$/, '')) + '억';
  }
  if (n >= 10000) {
    var man = n / 10000;
    return (man >= 10 ? Math.round(man) : man.toFixed(1).replace(/\.0$/, '')) + '만';
  }
  return n.toLocaleString('ko-KR');
}
