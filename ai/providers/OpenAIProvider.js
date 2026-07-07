/**
 * OpenAI 기반 코치 코멘트 프로바이더 (v2+ 교체용 스텁)
 * 향후 Cloud Function 프록시를 통해 구현합니다.
 */
import { AIProvider } from './AIProvider.js';

export class OpenAIProvider extends AIProvider {
  /**
   * @param {string} [endpointUrl] OpenAI 프록시 URL (미구현)
   */
  constructor(endpointUrl) {
    super();
    this.endpointUrl = endpointUrl || '';
  }

  /**
   * @override
   * @param {import('./AIProvider.js').PoseAnalysisSummary} summary
   * @returns {Promise<import('./AIProvider.js').CoachCommentResult>}
   */
  async generateCoachComment(summary) {
    if (this.endpointUrl) {
      throw new Error('OpenAI 프로바이더는 아직 배포되지 않았습니다');
    }
    return {
      coachComment: 'OpenAI 프로바이더는 준비 중입니다. Gemini를 사용해 주세요.',
      recommendedTraining: summary.recommendedTraining || '풋워크 사이드스텝 연습'
    };
  }
}
