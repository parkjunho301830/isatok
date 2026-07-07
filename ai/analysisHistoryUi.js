/**
 * AI 분석 이력 목록 UI
 */

/**
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  if (!iso) return '';
  try {
    var d = new Date(iso);
    return d.toLocaleString('ko-KR', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return iso.slice(0, 16);
  }
}

/**
 * @param {string} status
 * @returns {string}
 */
function statusLabel(status) {
  if (status === 'COMPLETED') return '완료';
  if (status === 'PROCESSING') return '진행중';
  if (status === 'ERROR') return '오류';
  return '대기';
}

/**
 * @param {string} url
 * @returns {string}
 */
function shortUrl(url) {
  var s = String(url || '');
  if (s.length <= 42) return s;
  return s.slice(0, 40) + '…';
}

/**
 * 분석 이력 HTML을 생성합니다.
 * @param {Array<Record<string, unknown> & { id: string }>} items
 * @returns {string}
 */
export function renderAnalysisHistoryList(items) {
  if (!items || !items.length) return '';

  return items.map(function(item) {
    var statusClass = 'ai-history-item__status--' + String(item.analysisStatus || 'NONE').toLowerCase();
    return '<div class="ai-history-item" data-id="' + esc(item.id) + '">'
      + '<div class="ai-history-item__head">'
      + '<span class="ai-history-item__type">' + esc(item.videoType) + '</span>'
      + '<span class="ai-history-item__score">' + (item.totalScore || 0) + '점</span>'
      + '<span class="ai-history-item__status ' + statusClass + '">'
      + statusLabel(item.analysisStatus) + '</span>'
      + '</div>'
      + '<div class="ai-history-item__url">' + esc(shortUrl(item.youtubeUrl)) + '</div>'
      + '<div class="ai-history-item__meta">'
      + formatDate(item.createdAt)
      + (item.recommendedTraining ? ' · ' + esc(item.recommendedTraining) : '')
      + '</div>'
      + '</div>';
  }).join('');
}
