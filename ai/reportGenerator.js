/**
 * AI 분석 결과 카드 HTML 생성기
 * 기존 이사탁 .ai-card 디자인 시스템을 따릅니다.
 */

/**
 * @typedef {object} ReportData
 * @property {number} totalScore
 * @property {number} forehand
 * @property {number} backhand
 * @property {number} footwork
 * @property {number} readyPosition
 * @property {number} balance
 * @property {string} recommendedTraining
 * @property {string} coachComment
 * @property {string} [analysisStatus]
 * @property {number} [frameCount]
 * @property {number} [landmarkCount]
 * @property {string} [sourceKind]
 * @property {boolean} [geminiComment]
 */

/**
 * 점수 막대 HTML을 생성합니다.
 * @param {string} label
 * @param {number} score
 * @returns {string}
 */
function scoreBarHtml(label, score) {
  var pct = Math.max(0, Math.min(100, score));
  return '<div class="ai-report__score-row">'
    + '<div class="ai-report__score-label">' + label + '</div>'
    + '<div class="ai-report__score-bar-wrap">'
    + '<div class="ai-report__score-bar" style="width:' + pct + '%"></div>'
    + '</div>'
    + '<div class="ai-report__score-val">' + pct + '</div>'
    + '</div>';
}

/**
 * 분석 결과 카드 HTML을 생성합니다.
 * @param {ReportData} data
 * @returns {string}
 */
export function renderAnalysisReportCard(data) {
  var status = data.analysisStatus || 'COMPLETED';
  return '<div class="card card-p ai-report ai-card" data-status="' + status + '">'
    + '<div class="ai-card__glow"></div>'
    + '<div class="ai-report__head">'
    + '<span class="ai-report__badge">🤖 AI 분석 Beta</span>'
    + (data.frameCount ? '<span class="ai-report__meta">' + data.frameCount + '프레임 · '
      + (data.landmarkCount || 33) + '관절 · '
      + (data.sourceKind === 'local' ? '로컬 파일' : '유튜브 스트림') + '</span>' : '')
    + '<div class="ai-report__total">'
    + '<span class="ai-report__total-label">총점</span>'
    + '<span class="ai-report__total-value">' + (data.totalScore || 0) + '</span>'
    + '</div>'
    + '</div>'
    + '<div class="ai-report__scores">'
    + scoreBarHtml('포핸드', data.forehand)
    + scoreBarHtml('백핸드', data.backhand)
    + scoreBarHtml('풋워크', data.footwork)
    + scoreBarHtml('준비자세', data.readyPosition)
    + scoreBarHtml('밸런스', data.balance)
    + '</div>'
    + '<div class="ai-report__section">'
    + '<div class="ai-report__section-title">🏋 추천훈련</div>'
    + '<p class="ai-report__section-text">' + escapeHtml(data.recommendedTraining || '-') + '</p>'
    + '</div>'
    + '<div class="ai-report__section ai-report__section--comment">'
    + '<div class="ai-report__section-title">💬 AI 코멘트'
    + (data.geminiComment ? '<span class="ai-report__gemini-badge">Gemini</span>' : '')
    + '</div>'
    + '<p class="ai-report__section-text">' + escapeHtml(data.coachComment || '분석 후 코멘트가 표시됩니다.') + '</p>'
    + '</div>'
    + '</div>';
}

/**
 * 로딩 상태 카드 HTML
 * @param {string} [message]
 * @returns {string}
 */
export function renderLoadingCard(message) {
  return '<div class="card card-p ai-report ai-report--loading">'
    + '<div class="ai-report__loading">'
    + '<div class="ai-report__spinner"></div>'
    + '<p id="ai-loading-msg">' + escapeHtml(message || 'AI 분석 중…') + '</p>'
    + '</div>'
    + '</div>';
}

/**
 * 플레이스홀더 카드 (분석 전)
 * @returns {string}
 */
export function renderPlaceholderCard() {
  return '<div class="card card-p ai-report ai-report--placeholder">'
    + '<p class="ai-report__placeholder-text">유튜브 URL을 입력하고 「AI 분석 시작」을 눌러주세요.</p>'
    + '</div>';
}

/**
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
