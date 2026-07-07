/**
 * AI 분석 후 영상 등록 패널 UI
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
 * @param {object} c challenge
 * @returns {string}
 */
function challengeLabel(c) {
  var my = (c.myTeam || []).join('·') || '?';
  var opp = (c.oppTeam || []).join('·') || '?';
  var score = c.score || '';
  var date = c.date || '';
  var hasVideo = c.videoUrl ? ' [영상있음]' : '';
  return (date ? date + ' · ' : '') + my + ' vs ' + opp
    + (score ? ' (' + score + ')' : '') + hasVideo;
}

/**
 * 등록 폼 HTML을 생성합니다.
 * @param {object} opts
 * @param {string} opts.videoType
 * @param {{ id: string, name: string }[]} opts.members
 * @param {object[]} opts.challenges
 * @returns {string}
 */
export function renderRegisterFormHtml(opts) {
  var videoType = opts.videoType;
  var isMatch = videoType === '대결';

  var html = '<div class="ai-register-form">';

  if (isMatch) {
    html += '<div class="fg">'
      + '<label for="ai-register-challenge">완료된 대결 선택</label>'
      + '<select id="ai-register-challenge" class="fi">'
      + '<option value="">대결을 선택하세요</option>';
    (opts.challenges || []).forEach(function(c) {
      html += '<option value="' + esc(c.id) + '">' + esc(challengeLabel(c)) + '</option>';
    });
    html += '</select>'
      + '<div class="fg-hint">선택한 경기에 유튜브 URL이 등록됩니다</div>'
      + '</div>';
  } else {
    html += '<div class="fg">'
      + '<label id="ai-register-members-label">선수 <span class="fg-hint">(복수 선택)</span></label>'
      + '<div id="ai-register-members" class="ai-type-pick lesson-member-pick" role="group" aria-labelledby="ai-register-members-label">';
    (opts.members || []).forEach(function(m) {
      html += '<button type="button" class="ai-type-chip ai-member-chip" data-id="' + esc(m.id) + '">'
        + esc(m.name) + '</button>';
    });
    html += '</div></div>';

    html += '<div class="fg">'
      + '<label for="ai-register-desc">설명 <span class="fg-hint">(선택, 200자)</span></label>'
      + '<textarea id="ai-register-desc" class="fi" rows="2" maxlength="200" placeholder="영상 설명"></textarea>'
      + '</div>';
  }

  html += '<div class="ai-register-actions">'
    + '<button type="button" class="btn btn-p" id="btn-ai-save-register">✅ 분석 저장 + 영상 등록</button>'
    + '</div>'
    + '</div>';

  return html;
}

/**
 * 선수 칩 토글 이벤트를 바인딩합니다.
 * @param {string[]} selectedIds
 * @param {(ids: string[]) => void} onChange
 */
export function bindMemberChipToggle(selectedIds, onChange) {
  var box = document.getElementById('ai-register-members');
  if (!box) return;

  box.querySelectorAll('.ai-member-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      var id = chip.getAttribute('data-id');
      if (!id) return;
      var idx = selectedIds.indexOf(id);
      if (idx >= 0) selectedIds.splice(idx, 1);
      else selectedIds.push(id);
      box.querySelectorAll('.ai-member-chip').forEach(function(c) {
        var cid = c.getAttribute('data-id');
        c.classList.toggle('on', selectedIds.indexOf(cid) >= 0);
      });
      onChange(selectedIds.slice());
    });
  });
}
