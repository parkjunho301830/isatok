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
