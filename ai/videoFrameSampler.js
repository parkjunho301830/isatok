/**
 * HTMLVideoElement에서 일정 간격으로 프레임을 샘플링합니다.
 */

/**
 * @param {HTMLVideoElement} video
 * @returns {Promise<void>}
 */
export function waitForVideoSeek(video) {
  return new Promise(function(resolve, reject) {
    var timer = setTimeout(function() {
      reject(new Error('영상 시크 타임아웃'));
    }, 15000);

    function done() {
      clearTimeout(timer);
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', onErr);
      resolve();
    }

    function onErr() {
      clearTimeout(timer);
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', onErr);
      reject(new Error('영상 프레임 추출 실패'));
    }

    video.addEventListener('seeked', done, { once: true });
    video.addEventListener('error', onErr, { once: true });
  });
}

/**
 * 분석용 video 엘리먼트를 생성·로드합니다.
 * @param {string} src
 * @param {HTMLVideoElement} [reuse]
 * @returns {Promise<HTMLVideoElement>}
 */
export async function loadAnalysisVideo(src, reuse) {
  var video = reuse || document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('playsinline', '');
  video.src = src;

  await new Promise(function(resolve, reject) {
    function onMeta() {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('error', onErr);
      resolve();
    }
    function onErr() {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('error', onErr);
      reject(new Error('영상을 불러올 수 없습니다 (CORS 또는 형식 오류)'));
    }
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('error', onErr);
  });

  if (!video.duration || !isFinite(video.duration) || video.duration <= 0) {
    throw new Error('영상 길이를 확인할 수 없습니다');
  }

  return video;
}

/**
 * @typedef {import('./poseAnalyzer.js').PoseFrame} PoseFrame
 */

/**
 * @typedef {object} SampleOptions
 * @property {number} [intervalSec] 샘플링 간격(초)
 * @property {number} [maxFrames] 최대 프레임 수
 * @property {(info: { current: number, total: number, phase: string }) => void} [onProgress]
 */

/**
 * PoseLandmarker로 비디오 프레임을 샘플링합니다.
 * @param {import('@mediapipe/tasks-vision').PoseLandmarker} landmarker
 * @param {HTMLVideoElement} video
 * @param {SampleOptions} [options]
 * @returns {Promise<PoseFrame[]>}
 */
export async function samplePoseFrames(landmarker, video, options) {
  var intervalSec = (options && options.intervalSec) || 0.5;
  var maxFrames = (options && options.maxFrames) || 24;
  var onProgress = options && options.onProgress;

  var duration = video.duration;
  var estimatedTotal = Math.min(maxFrames, Math.ceil(duration / intervalSec) + 1);
  var frames = [];
  var t = 0;
  var timestampMs = 0;

  while (t < duration && frames.length < maxFrames) {
    video.currentTime = Math.min(t, Math.max(0, duration - 0.05));
    await waitForVideoSeek(video);

    var result = landmarker.detectForVideo(video, timestampMs);
    timestampMs += Math.round(intervalSec * 1000);

    if (result.landmarks && result.landmarks.length > 0 && result.landmarks[0]) {
      frames.push({
        timestamp: t,
        landmarks: result.landmarks[0].map(function(lm) {
          return {
            x: lm.x,
            y: lm.y,
            z: lm.z,
            visibility: lm.visibility != null ? lm.visibility : 1
          };
        })
      });
    }

    if (onProgress) {
      onProgress({
        current: frames.length,
        total: estimatedTotal,
        phase: 'pose'
      });
    }

    t += intervalSec;
  }

  if (!frames.length) {
    throw new Error('포즈를 감지하지 못했습니다. 사람이 나오는 영상인지 확인해 주세요.');
  }

  return frames;
}
