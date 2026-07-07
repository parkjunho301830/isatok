/**
 * AI 코멘트 생성 추상 프로바이더
 * Gemini / OpenAI 등 백엔드를 교체할 때 이 인터페이스를 구현합니다.
 *
 * @typedef {object} PoseAnalysisSummary
 * @property {number} totalScore
 * @property {number} forehand
 * @property {number} backhand
 * @property {number} footwork
 * @property {number} readyPosition
 * @property {number} balance
 * @property {string} [recommendedTraining]
 * @property {string} videoType
 * @property {number} [frameCount]
 * @property {number} [landmarkCount]
 */

/**
 * @typedef {object} CoachCommentResult
 * @property {string} coachComment
 * @property {string} [recommendedTraining]
 */

export class AIProvider {
  /**
   * @param {PoseAnalysisSummary} _summary
   * @returns {Promise<CoachCommentResult>}
   */
  async generateCoachComment(_summary) {
    throw new Error('AIProvider.generateCoachComment() must be implemented');
  }
}
