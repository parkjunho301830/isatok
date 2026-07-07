/**
 * AI 코멘트 프로바이더 팩토리
 * Gemini ↔ OpenAI 교체 시 이 모듈만 수정하면 됩니다.
 */
import { GeminiProvider } from './providers/GeminiProvider.js?v=2026.07.07.03';
import { OpenAIProvider } from './providers/OpenAIProvider.js?v=2026.07.07.03';
import { AI_VIDEO_COACH_URL } from '../js/app/constants.js?v=2026.07.07.03';

/** @typedef {'gemini'|'openai'} AIProviderKind */

export const AI_PROVIDER_GEMINI = 'gemini';
export const AI_PROVIDER_OPENAI = 'openai';

/** 기본 프로바이더 (환경 변수·설정으로 교체 가능) */
export const DEFAULT_AI_PROVIDER = AI_PROVIDER_GEMINI;

/**
 * @param {AIProviderKind} [kind]
 * @returns {import('./providers/AIProvider.js').AIProvider}
 */
export function createAIProvider(kind) {
  var selected = kind || DEFAULT_AI_PROVIDER;
  if (selected === AI_PROVIDER_OPENAI) {
    return new OpenAIProvider();
  }
  return new GeminiProvider(AI_VIDEO_COACH_URL);
}

/**
 * 포즈 분석 결과로 Gemini/OpenAI 코치 코멘트를 생성합니다.
 * @param {import('./providers/AIProvider.js').PoseAnalysisSummary} summary
 * @param {AIProviderKind} [kind]
 * @returns {Promise<import('./providers/AIProvider.js').CoachCommentResult>}
 */
export async function generateCoachComment(summary, kind) {
  var provider = createAIProvider(kind);
  return provider.generateCoachComment(summary);
}
