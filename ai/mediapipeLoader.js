/**
 * MediaPipe Tasks Vision CDN 로더
 * PoseLandmarker WASM·모델을 동적으로 불러옵니다.
 */

const MP_VERSION = '0.10.14';
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MP_VERSION + '/wasm';
const ESM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MP_VERSION + '/+esm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

/** @type {Promise<import('@mediapipe/tasks-vision').PoseLandmarker>|null} */
let _landmarkerPromise = null;

/**
 * PoseLandmarker 인스턴스를 생성합니다 (싱글톤 캐시).
 * @returns {Promise<import('@mediapipe/tasks-vision').PoseLandmarker>}
 */
export async function getPoseLandmarker() {
  if (!_landmarkerPromise) {
    _landmarkerPromise = _createPoseLandmarker();
  }
  return _landmarkerPromise;
}

/**
 * @returns {Promise<import('@mediapipe/tasks-vision').PoseLandmarker>}
 */
async function _createPoseLandmarker() {
  var mod = await import(ESM_URL);
  var FilesetResolver = mod.FilesetResolver;
  var PoseLandmarker = mod.PoseLandmarker;

  var vision = await FilesetResolver.forVisionTasks(WASM_BASE);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
}

/**
 * 캐시를 초기화합니다 (디버그·재시도용).
 */
export function resetPoseLandmarker() {
  _landmarkerPromise = null;
}
