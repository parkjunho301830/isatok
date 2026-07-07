/**
 * MediaPipe Pose 분석 래퍼
 * 33개 관절 랜드마크를 영상에서 추출합니다.
 */
import { getPoseLandmarker } from './mediapipeLoader.js?v=2026.07.07.02';
import { resolveVideoSource, revokeVideoSource } from './videoSourceResolver.js?v=2026.07.07.02';
import { loadAnalysisVideo, samplePoseFrames } from './videoFrameSampler.js?v=2026.07.07.02';

/** MediaPipe Pose 랜드마크 수 */
export const POSE_LANDMARK_COUNT = 33;

/**
 * @typedef {object} PoseLandmark
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} visibility
 */

/**
 * @typedef {object} PoseFrame
 * @property {number} timestamp
 * @property {PoseLandmark[]} landmarks
 */

/**
 * @typedef {object} PoseAnalysisResult
 * @property {PoseFrame[]} frames
 * @property {number} frameCount
 * @property {number} landmarkCount
 * @property {'local'|'youtube-stream'} sourceKind
 */

/**
 * @typedef {object} AnalyzeVideoOptions
 * @property {string} youtubeUrl
 * @property {File|null} [localFile]
 * @property {(info: { phase: string, message?: string, current?: number, total?: number }) => void} [onProgress]
 */

export class PoseAnalyzer {
  constructor() {
    /** @type {boolean} */
    this._ready = false;
    /** @type {HTMLVideoElement|null} */
    this._videoEl = null;
  }

  /**
   * MediaPipe PoseLandmarker 모델을 초기화합니다.
   * @param {(msg: string) => void} [onStatus]
   * @returns {Promise<void>}
   */
  async initialize(onStatus) {
    if (this._ready) return;
    if (onStatus) onStatus('MediaPipe 모델 로딩 중…');
    await getPoseLandmarker();
    if (!this._videoEl) {
      this._videoEl = document.createElement('video');
      this._videoEl.id = 'ai-pose-video';
      this._videoEl.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(this._videoEl);
    }
    this._ready = true;
  }

  /**
   * 유튜브 URL 또는 로컬 파일에서 포즈 프레임을 추출합니다.
   * @param {AnalyzeVideoOptions} options
   * @returns {Promise<PoseAnalysisResult>}
   */
  async analyzeVideo(options) {
    var onProgress = options.onProgress;
    await this.initialize(function(msg) {
      if (onProgress) onProgress({ phase: 'init', message: msg });
    });

    if (onProgress) onProgress({ phase: 'source', message: '영상 소스 준비 중…' });

    var source = await resolveVideoSource({
      youtubeUrl: options.youtubeUrl,
      localFile: options.localFile || null
    });

    var landmarker = await getPoseLandmarker();

    try {
      if (onProgress) onProgress({ phase: 'load', message: '영상 로딩 중…' });
      await loadAnalysisVideo(source.url, this._videoEl);

      if (onProgress) onProgress({ phase: 'pose', message: '관절 추출 중…', current: 0, total: 0 });

      var frames = await samplePoseFrames(landmarker, this._videoEl, {
        intervalSec: 0.5,
        maxFrames: 24,
        onProgress: function(info) {
          if (onProgress) {
            onProgress({
              phase: 'pose',
              message: '관절 추출 중… (' + info.current + '/' + info.total + ')',
              current: info.current,
              total: info.total
            });
          }
        }
      });

      return {
        frames: frames,
        frameCount: frames.length,
        landmarkCount: POSE_LANDMARK_COUNT,
        sourceKind: source.kind
      };
    } finally {
      revokeVideoSource(source);
      if (this._videoEl) {
        this._videoEl.removeAttribute('src');
        this._videoEl.load();
      }
    }
  }

  /** @returns {boolean} */
  isReady() {
    return this._ready;
  }
}
