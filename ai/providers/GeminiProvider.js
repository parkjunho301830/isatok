/**
 * Gemini 기반 코치 코멘트 프로바이더
 * API 키는 클라이언트에 노출하지 않고 Cloud Function을 경유합니다.
 */
import { AIProvider } from './AIProvider.js';

const FETCH_TIMEOUT_MS = 45000;
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [800, 2000];

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

/**
 * @param {number} status
 * @returns {boolean}
 */
function isRetryableStatus(status) {
  return !status || status === 408 || status === 429 || status >= 500;
}

export class GeminiProvider extends AIProvider {
  /**
   * @param {string} endpointUrl Cloud Function URL (AI_VIDEO_COACH_URL)
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
    if (!this.endpointUrl) {
      throw new Error('Gemini 엔드포인트가 설정되지 않았습니다');
    }

    var body = { poseSummary: summary };
    var lastError = null;

    for (var attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        var data = await this._postWithTimeout(this.endpointUrl, body);
        if (!data.ok) {
          throw new Error(data.error || 'Gemini 응답 오류');
        }
        var comment = String(data.coachComment || '').trim();
        if (!comment) {
          throw new Error('빈 코치 코멘트');
        }
        return {
          coachComment: comment,
          recommendedTraining: String(
            data.recommendedTraining || summary.recommendedTraining || ''
          ).trim()
        };
      } catch (err) {
        lastError = err;
        if (attempt < MAX_RETRIES && this._isRetryableError(err)) {
          await delay(RETRY_DELAYS_MS[attempt] || 1000);
          continue;
        }
        break;
      }
    }

    throw lastError || new Error('Gemini 코멘트 생성 실패');
  }

  /**
   * @param {string} url
   * @param {object} body
   * @returns {Promise<object>}
   */
  async _postWithTimeout(url, body) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function() { controller.abort(); }, FETCH_TIMEOUT_MS)
      : null;

    try {
      var response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller ? controller.signal : undefined
      });

      if (!response.ok) {
        var err = new Error('Gemini 코멘트 생성 실패 (' + response.status + ')');
        err.status = response.status;
        throw err;
      }

      return await response.json();
    } catch (err) {
      if (err && err.name === 'AbortError') {
        var timeoutErr = new Error('Gemini 요청 시간 초과');
        timeoutErr.status = 408;
        throw timeoutErr;
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * @param {Error & { status?: number }} err
   * @returns {boolean}
   */
  _isRetryableError(err) {
    if (err && err.name === 'AbortError') return true;
    if (err && typeof err.status === 'number') return isRetryableStatus(err.status);
    return true;
  }
}
