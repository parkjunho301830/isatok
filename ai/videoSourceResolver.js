/**
 * 분석용 영상 소스 해석기
 * 유튜브 URL 스트림 자동 시도 → 실패 시 PC 로컬 파일(blob URL) 사용
 * 원본 영상은 서버에 저장하지 않습니다.
 */
import { extractYouTubeVideoId } from '../js/app/youtubeUtils.js?v=2026.07.07.02';

/** Piped API 인스턴스 (순차 시도) */
const PIPED_API_BASES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt'
];

/**
 * @typedef {object} VideoSource
 * @property {string} url 재생 가능한 URL (blob: 또는 스트림)
 * @property {'local'|'youtube-stream'} kind
 * @property {string} [videoId]
 */

/**
 * 로컬 파일을 blob URL로 변환합니다.
 * @param {File} file
 * @returns {VideoSource}
 */
export function resolveFromLocalFile(file) {
  if (!file || !file.type.startsWith('video/')) {
    throw new Error('영상 파일(mp4, webm 등)을 선택해 주세요');
  }
  return {
    url: URL.createObjectURL(file),
    kind: 'local'
  };
}

/**
 * Piped API로 유튜브 직접 스트림 URL을 조회합니다.
 * @param {string} videoId
 * @returns {Promise<string|null>}
 */
async function fetchYouTubeStreamUrl(videoId) {
  for (var i = 0; i < PIPED_API_BASES.length; i++) {
    var base = PIPED_API_BASES[i];
    try {
      var controller = new AbortController();
      var timer = setTimeout(function() { controller.abort(); }, 10000);
      var resp = await fetch(base + '/streams/' + encodeURIComponent(videoId), {
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!resp.ok) continue;

      var data = await resp.json();
      var streams = data.videoStreams || [];
      var picked = _pickStream(streams);
      if (picked && picked.url) return picked.url;
    } catch (e) {
      /* 다음 인스턴스 시도 */
    }
  }
  return null;
}

/**
 * @param {object[]} streams
 * @returns {object|null}
 */
function _pickStream(streams) {
  if (!streams.length) return null;
  var mp4 = streams.filter(function(s) {
    return s && s.url && (s.mimeType || '').indexOf('video/mp4') >= 0;
  });
  var pool = mp4.length ? mp4 : streams;
  pool.sort(function(a, b) {
    return (Number(b.height) || 0) - (Number(a.height) || 0);
  });
  return pool[0] || null;
}

/**
 * 유튜브 URL에서 분석용 스트림을 해석합니다.
 * @param {string} youtubeUrl
 * @returns {Promise<VideoSource>}
 */
export async function resolveFromYouTubeUrl(youtubeUrl) {
  var videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) throw new Error('유효한 유튜브 URL이 아닙니다');

  var streamUrl = await fetchYouTubeStreamUrl(videoId);
  if (!streamUrl) {
    throw new Error(
      '유튜브 직접 분석을 사용할 수 없습니다. 아래 「분석용 영상 파일」을 선택해 주세요.'
    );
  }

  return {
    url: streamUrl,
    kind: 'youtube-stream',
    videoId: videoId
  };
}

/**
 * 분석 소스를 결정합니다. 로컬 파일 우선, 없으면 유튜브 스트림 시도.
 * @param {{ youtubeUrl: string, localFile?: File|null }} opts
 * @returns {Promise<VideoSource>}
 */
export async function resolveVideoSource(opts) {
  if (opts.localFile) {
    return resolveFromLocalFile(opts.localFile);
  }
  return resolveFromYouTubeUrl(opts.youtubeUrl);
}

/**
 * blob URL 메모리 해제
 * @param {VideoSource} source
 */
export function revokeVideoSource(source) {
  if (source && source.kind === 'local' && source.url) {
    try { URL.revokeObjectURL(source.url); } catch (e) { /* ignore */ }
  }
}
