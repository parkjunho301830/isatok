/**
 * 회원 등급·포인트·복식 타입 판별 (순수 헬퍼)
 */
import {
  PT_INIT,
  GRADE_TIERS,
  COLOR_PRIMARY,
  COLOR_GOLD
} from './constants.js?v=2026.07.07.01';

const DOUBLES_TYPES = ['md', 'fd', 'mx', 'doubles'];

export function _isDoublesType(t) {
  return DOUBLES_TYPES.indexOf(t) >= 0;
}

/** 양 팀 1:1 → 단식 포인트·전적 */
export function _isSinglesFormat(myTeam, oppTeam) {
  return (myTeam || []).length === 1 && (oppTeam || []).length === 1;
}

/** 양 팀 2:2 이상 → 복식 포인트·전적 */
export function _isDoublesFormat(myTeam, oppTeam) {
  return (myTeam || []).length >= 2 && (oppTeam || []).length >= 2;
}

export function _isSinglesFormatChallenge(c) {
  if (!c) return false;
  return _isSinglesFormat(c.myTeam, c.oppTeam);
}

export function _isDoublesFormatChallenge(c) {
  if (!c) return false;
  return _isDoublesFormat(c.myTeam, c.oppTeam);
}

export function _memberPt(m, isDouble) {
  return isDouble ? (m.doublePoint ?? PT_INIT) : (m.individualPoint ?? PT_INIT);
}

export function _calcGrade(pt) {
  var p = pt ?? PT_INIT;
  for (var i = 0; i < GRADE_TIERS.length; i++) {
    if (p >= GRADE_TIERS[i].min) return GRADE_TIERS[i];
  }
  return GRADE_TIERS[GRADE_TIERS.length - 1];
}

/**
 * 단식 포인트 기준 현재 등급·다음 등급·진행률을 계산한다.
 * @param {number} [point] - 회원 단식 포인트
 * @returns {{currentGrade: string, nextGrade: string|null, progress: number, remain: number, isMaster: boolean}|null}
 */
export function getGradeProgress(point) {
  var p = point ?? PT_INIT;
  for (var i = 0; i < GRADE_TIERS.length; i++) {
    var tier = GRADE_TIERS[i];
    if (p >= tier.min) {
      var isMaster = i === 0;
      var nextTier = i > 0 ? GRADE_TIERS[i - 1] : null;
      if (isMaster) {
        return { currentGrade: tier.label, nextGrade: null, progress: 100, remain: 0, isMaster: true };
      }
      var range = nextTier.min - tier.min;
      var progress = Math.min(100, Math.round((p - tier.min) / range * 100));
      var remain = nextTier.min - p;
      return { currentGrade: tier.label, nextGrade: nextTier.label, progress: progress, remain: remain, isMaster: false };
    }
  }
  return null;
}

/**
 * 등급 진행바 HTML을 생성한다.
 * @param {number} point - 회원 단식 포인트
 * @returns {string}
 */
export function _renderGradeProgressHtml(point) {
  var info = getGradeProgress(point);
  if (!info) return '';
  var barColor = info.isMaster ? COLOR_GOLD : COLOR_PRIMARY;
  var subtitle = info.isMaster
    ? '🏆 최고 등급 달성!'
    : '다음 등급 <strong>' + info.nextGrade + '</strong>까지 <strong>' + info.remain + 'pt</strong>';
  return '<div class="my-grade-progress">'
    + '<div class="my-grade-progress-head"><span>' + info.currentGrade + '</span><span class="my-grade-progress-sub">' + subtitle + '</span></div>'
    + '<div class="my-grade-progress-track"><div class="my-grade-progress-bar" style="width:' + info.progress + '%;background:' + barColor + '"></div></div>'
    + '</div>';
}
