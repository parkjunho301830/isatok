/**
 * 기존 Code.gs 의 doGet 을 아래처럼 바꾸세요.
 * (맨 위 3줄만 추가 — 나머지 HTML 반환 코드는 그대로 유지)
 */
function doGet(e) {
  var api = handleOrgChartApiRequest_(e);
  if (api) return api;

  // ↓ 기존 코드 유지 (예시)
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('이사탁 조직도 관리시스템')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
