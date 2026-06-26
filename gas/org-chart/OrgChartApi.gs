/**
 * 이사탁 조직도 — 외부 연동용 JSON API
 *
 * [설치 방법]
 * 1. https://script.google.com 에서 기존 "이사탁 조직도 관리시스템" 프로젝트 열기
 * 2. 이 파일 내용을 Code.gs 맨 아래에 붙여넣기 (또는 새 .gs 파일로 추가)
 * 3. 기존 doGet 함수를 아래 "doGet 수정 예시"대로 변경
 * 4. 배포 → 새 배포 → 유형: 웹 앱
 *    - 실행: 나
 *    - 액세스: 모든 사용자
 * 5. 배포 URL이 기존 /exec 와 동일한지 확인
 *
 * [테스트]
 *   .../exec?action=health
 *   .../exec?action=getMembers
 */

/** @returns {GoogleAppsScript.Content.TextOutput|null} */
function handleOrgChartApiRequest_(e) {
  e = e || {};
  var p = e.parameter || {};
  var action = String(p.action || '').trim();

  if (!action) return null;

  if (action === 'health') {
    return orgChartJsonResponse_({
      ok: true,
      service: 'isatok-org-chart',
      version: 1
    });
  }

  if (action === 'getMembers') {
    var raw = getMembers();
    if (!raw || !raw.length) {
      return orgChartJsonResponse_({ ok: true, members: [], count: 0 });
    }
    var members = raw.map(function (m) {
      return {
        name: String(m.name || '').trim(),
        role: String(m.role || '').trim(),
        dept: String(m.dept || '').trim(),
        photoUrl: orgChartNormalizePhotoUrl_(m.photoUrl)
      };
    }).filter(function (m) { return m.name; });

    return orgChartJsonResponse_({
      ok: true,
      count: members.length,
      updatedAt: new Date().toISOString(),
      members: members
    });
  }

  return orgChartJsonResponse_({ ok: false, error: 'unknown action: ' + action });
}

/**
 * Google Drive 공유 URL → 외부 앱에서 표시 가능한 형태로 변환
 * @param {string} url
 * @returns {string}
 */
function orgChartNormalizePhotoUrl_(url) {
  if (!url) return '';
  var s = String(url).trim();
  if (!s) return '';

  // uc/export → 외부 embed용 썸네일
  if (s.indexOf('drive.google.com/uc?') >= 0) {
    var ucMatch = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (ucMatch) return 'https://drive.google.com/thumbnail?id=' + ucMatch[1] + '&sz=w400';
  }

  // lh3.googleusercontent.com 등 직접 URL
  if (/^https?:\/\/lh3\.googleusercontent\.com/i.test(s)) return s;

  var fileId = '';
  var fileMatch = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) fileId = fileMatch[1];
  if (!fileId) {
    var idMatch = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) fileId = idMatch[1];
  }
  if (fileId) {
    return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w400';
  }

  if (/^https?:\/\//i.test(s)) return s;

  return s;
}

/** @param {Object} obj */
function orgChartJsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/*
 * ── doGet 수정 예시 ─────────────────────────────────────
 * 기존 doGet 맨 위에 API 분기를 추가하세요.
 *
 * function doGet(e) {
 *   var api = handleOrgChartApiRequest_(e);
 *   if (api) return api;
 *
 *   // ↓ 기존 HTML 화면 반환 코드 유지
 *   return HtmlService.createHtmlOutputFromFile('Index')
 *     .setTitle('이사탁 조직도 관리시스템')
 *     .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
 * }
 */
