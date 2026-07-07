/**
 * 탁구 동작 분석기
 * MediaPipe 33관절 데이터를 기반으로 항목별 점수를 계산합니다.
 * v1.0은 포즈 휴리스틱 기반 더미에 가깝고, v2에서 개별 함수를 정밀화합니다.
 */
import { POSE_LM } from './poseLandmarkIndices.js?v=2026.07.07.02';

/**
 * @typedef {import('./poseAnalyzer.js').PoseFrame} PoseFrame
 */

/**
 * @typedef {object} TechniqueScores
 * @property {number} forehand
 * @property {number} backhand
 * @property {number} footwork
 * @property {number} readyPosition
 * @property {number} balance
 */

/**
 * @param {number} value
 * @returns {number}
 */
function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * @param {import('./poseAnalyzer.js').PoseLandmark} a
 * @param {import('./poseAnalyzer.js').PoseLandmark} b
 * @returns {number}
 */
function dist(a, b) {
  if (!a || !b) return 0;
  var dx = a.x - b.x;
  var dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * @param {import('./poseAnalyzer.js').PoseLandmark[]} lm
 * @param {number} i
 * @returns {import('./poseAnalyzer.js').PoseLandmark|null}
 */
function pt(lm, i) {
  return lm && lm[i] ? lm[i] : null;
}

/**
 * 프레임 배열에서 수치 배열의 평균을 구합니다.
 * @param {number[]} values
 * @returns {number}
 */
function avg(values) {
  if (!values.length) return 0;
  var sum = values.reduce(function(a, b) { return a + b; }, 0);
  return sum / values.length;
}

/**
 * 프레임 간 위치 변화량(표준편차 근사)을 계산합니다.
 * @param {PoseFrame[]} frames
 * @param {number} index
 * @returns {number}
 */
function jointMotion(frames, index) {
  var xs = [];
  var ys = [];
  frames.forEach(function(frame) {
    var p = pt(frame.landmarks, index);
    if (p && p.visibility > 0.3) {
      xs.push(p.x);
      ys.push(p.y);
    }
  });
  if (xs.length < 2) return 0;
  var mx = avg(xs);
  var my = avg(ys);
  var variance = 0;
  for (var i = 0; i < xs.length; i++) {
    variance += Math.pow(xs[i] - mx, 2) + Math.pow(ys[i] - my, 2);
  }
  return Math.sqrt(variance / xs.length);
}

/**
 * 포핸드: 오른팔(어깨→손목) 가동 범위·가시성 기반
 * @param {PoseFrame[]} frames
 * @returns {number}
 */
export function calculateForehand(frames) {
  var scores = frames.map(function(frame) {
    var lm = frame.landmarks;
    var wrist = pt(lm, POSE_LM.RIGHT_WRIST);
    var shoulder = pt(lm, POSE_LM.RIGHT_SHOULDER);
    var elbow = pt(lm, POSE_LM.RIGHT_ELBOW);
    if (!wrist || !shoulder || !elbow) return 0;
    var reach = dist(wrist, shoulder);
    var elbowDist = dist(elbow, shoulder);
    var vis = (wrist.visibility + elbow.visibility) / 2;
    return (reach * 55 + elbowDist * 35 + vis * 25);
  });
  return clamp(avg(scores));
}

/**
 * 백핸드: 왼팔 가동 범위·가시성 기반
 * @param {PoseFrame[]} frames
 * @returns {number}
 */
export function calculateBackhand(frames) {
  var scores = frames.map(function(frame) {
    var lm = frame.landmarks;
    var wrist = pt(lm, POSE_LM.LEFT_WRIST);
    var shoulder = pt(lm, POSE_LM.LEFT_SHOULDER);
    var elbow = pt(lm, POSE_LM.LEFT_ELBOW);
    if (!wrist || !shoulder || !elbow) return 0;
    var reach = dist(wrist, shoulder);
    var elbowDist = dist(elbow, shoulder);
    var vis = (wrist.visibility + elbow.visibility) / 2;
    return (reach * 55 + elbowDist * 35 + vis * 25);
  });
  return clamp(avg(scores));
}

/**
 * 풋워크: 발목·무릎 관절 이동량 기반
 * @param {PoseFrame[]} frames
 * @returns {number}
 */
export function calculateFootwork(frames) {
  var ankleMotion = jointMotion(frames, POSE_LM.LEFT_ANKLE) + jointMotion(frames, POSE_LM.RIGHT_ANKLE);
  var kneeMotion = jointMotion(frames, POSE_LM.LEFT_KNEE) + jointMotion(frames, POSE_LM.RIGHT_KNEE);
  return clamp((ankleMotion + kneeMotion) * 180);
}

/**
 * 준비자세: 어깨·엉덩이 폭(스탠스)과 팔꿈치 위치 기반
 * @param {PoseFrame[]} frames
 * @returns {number}
 */
export function calculateReadyPosition(frames) {
  var scores = frames.map(function(frame) {
    var lm = frame.landmarks;
    var la = pt(lm, POSE_LM.LEFT_ANKLE);
    var ra = pt(lm, POSE_LM.RIGHT_ANKLE);
    var ls = pt(lm, POSE_LM.LEFT_SHOULDER);
    var rs = pt(lm, POSE_LM.RIGHT_SHOULDER);
    var le = pt(lm, POSE_LM.LEFT_ELBOW);
    var re = pt(lm, POSE_LM.RIGHT_ELBOW);
    if (!la || !ra || !ls || !rs || !le || !re) return 0;
    var stance = dist(la, ra);
    var shoulder = dist(ls, rs);
    var elbowH = (le.y + re.y) / 2 - (ls.y + rs.y) / 2;
    return (stance * 40 + shoulder * 30 + (0.15 - Math.abs(elbowH)) * 120);
  });
  return clamp(avg(scores));
}

/**
 * 밸런스: 어깨·엉덩이 중심선 정렬 및 좌우 대칭
 * @param {PoseFrame[]} frames
 * @returns {number}
 */
export function calculateBalance(frames) {
  var scores = frames.map(function(frame) {
    var lm = frame.landmarks;
    var ls = pt(lm, POSE_LM.LEFT_SHOULDER);
    var rs = pt(lm, POSE_LM.RIGHT_SHOULDER);
    var lh = pt(lm, POSE_LM.LEFT_HIP);
    var rh = pt(lm, POSE_LM.RIGHT_HIP);
    var lw = pt(lm, POSE_LM.LEFT_WRIST);
    var rw = pt(lm, POSE_LM.RIGHT_WRIST);
    if (!ls || !rs || !lh || !rh || !lw || !rw) return 0;
    var shoulderMidX = (ls.x + rs.x) / 2;
    var hipMidX = (lh.x + rh.x) / 2;
    var align = 1 - Math.min(1, Math.abs(shoulderMidX - hipMidX) * 4);
    var sym = 1 - Math.min(1, Math.abs(
      dist(lw, ls) - dist(rw, rs)
    ) * 2);
    return (align * 55 + sym * 45);
  });
  return clamp(avg(scores));
}

/**
 * 전체 포즈 프레임에서 항목별 점수를 계산합니다.
 * @param {PoseFrame[]} frames
 * @returns {TechniqueScores}
 */
export function analyzeTableTennisPose(frames) {
  if (!frames || !frames.length) {
    return { forehand: 0, backhand: 0, footwork: 0, readyPosition: 0, balance: 0 };
  }
  return {
    forehand: calculateForehand(frames),
    backhand: calculateBackhand(frames),
    footwork: calculateFootwork(frames),
    readyPosition: calculateReadyPosition(frames),
    balance: calculateBalance(frames)
  };
}
