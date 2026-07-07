/**
 * 분석 점수 계산기
 * 항목별 점수를 총점으로 집계하고 추천 훈련을 결정합니다.
 */

/**
 * @typedef {import('./tableTennisAnalyzer.js').TechniqueScores} TechniqueScores
 */

/**
 * @typedef {TechniqueScores & { totalScore: number; recommendedTraining: string }} AnalysisResult
 */

/** 항목별 가중치 (합계 1.0) */
const WEIGHTS = {
  forehand: 0.25,
  backhand: 0.20,
  footwork: 0.20,
  readyPosition: 0.20,
  balance: 0.15
};

/** 가장 낮은 항목에 따른 추천 훈련 맵 */
const TRAINING_MAP = {
  forehand: '포핸드 드라이브 · 탑스핀 연습',
  backhand: '백핸드 블록 · 플릭 연습',
  footwork: '사이드스텝 · 발놀림 훈련',
  readyPosition: '레디 포지션 · 라켓 준비 자세',
  balance: '체중 이동 · 코어 밸런스 훈련'
};

/**
 * 0~100 점수를 정수로 클램프합니다.
 * @param {number} value
 * @returns {number}
 */
export function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * 항목별 점수로 총점을 계산합니다.
 * @param {TechniqueScores} scores
 * @returns {number}
 */
export function calculateTotalScore(scores) {
  var total = 0;
  Object.keys(WEIGHTS).forEach(function(key) {
    total += (scores[key] || 0) * WEIGHTS[key];
  });
  return clampScore(total);
}

/**
 * 가장 개선이 필요한 항목에 맞는 추천 훈련을 반환합니다.
 * @param {TechniqueScores} scores
 * @returns {string}
 */
export function recommendTraining(scores) {
  var lowest = 'forehand';
  var minVal = 101;
  Object.keys(TRAINING_MAP).forEach(function(key) {
    if ((scores[key] || 0) < minVal) {
      minVal = scores[key] || 0;
      lowest = key;
    }
  });
  return TRAINING_MAP[lowest] || TRAINING_MAP.forehand;
}

/**
 * 항목별 점수를 최종 분석 결과로 집계합니다.
 * @param {TechniqueScores} scores
 * @returns {AnalysisResult}
 */
export function buildAnalysisResult(scores) {
  var clamped = {
    forehand: clampScore(scores.forehand),
    backhand: clampScore(scores.backhand),
    footwork: clampScore(scores.footwork),
    readyPosition: clampScore(scores.readyPosition),
    balance: clampScore(scores.balance)
  };
  return {
    ...clamped,
    totalScore: calculateTotalScore(clamped),
    recommendedTraining: recommendTraining(clamped)
  };
}
