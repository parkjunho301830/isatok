/**
 * 대결 종목(남복/여복/혼복 등) — 팀 성별 구성 기반 추론·표시
 */
import {
  _isSinglesFormat,
  _isDoublesFormat
} from './memberCore.js?v=2026.07.07.01';

const KIND_LABEL = {
  ms: '남단',
  fs: '여단',
  md: '남복',
  fd: '여복',
  mx: '혼복'
};

function _genderOfName(name, members) {
  if (!name) return '';
  var m = (members || []).find(function(x) { return x.name === name; });
  return (m && m.gender) || '';
}

export function countTeamGenders(team, members) {
  var m = 0;
  var f = 0;
  var u = 0;
  (team || []).forEach(function(name) {
    var g = _genderOfName(name, members);
    if (g === '남성') m++;
    else if (g === '여성') f++;
    else u++;
  });
  return { m: m, f: f, u: u, total: (team || []).length };
}

/** 단일 팀 구성 → 종목 코드 */
export function teamKindFromRoster(team, members) {
  var c = countTeamGenders(team, members);
  if (!c.total) return null;
  if (c.total === 1) {
    if (c.f === 1) return 'fs';
    return 'ms';
  }
  if (c.total >= 2) {
    if (c.m >= 1 && c.f >= 1) return 'mx';
    if (c.f >= 2 && c.m === 0) return 'fd';
    if (c.m >= 2 && c.f === 0) return 'md';
    if (c.m === 1 && c.f === 0) return 'md';
    if (c.f === 1 && c.m === 0) return 'fd';
  }
  return null;
}

export function normalizeChallengeType(type) {
  if (type === 'singles') return 'ms';
  if (type === 'doubles') return 'md';
  return type || 'ms';
}

/**
 * 양 팀 선수 성별로 대결 종목 추론
 */
export function inferChallengeType(myTeam, oppTeam, members) {
  var my = teamKindFromRoster(myTeam, members);
  var opp = teamKindFromRoster(oppTeam, members);

  if (!my && !opp) return null;

  var myN = (myTeam || []).length;
  var oppN = (oppTeam || []).length;
  if (myN <= 1 && oppN <= 1) {
    if (my === 'fs' || opp === 'fs') return 'fs';
    return 'ms';
  }

  if (my && opp && my === opp) return my;

  if (my === 'mx' || opp === 'mx') return 'mx';

  if ((my === 'md' && opp === 'fd') || (my === 'fd' && opp === 'md')) return 'mx';

  if (my && opp && my !== opp) return 'mx';

  return my || opp || 'md';
}

/** 팀 구성 짧은 라벨 (남남 / 여여 / 남여 / 남 / 여) */
export function teamCompositionShort(team, members) {
  var c = countTeamGenders(team, members);
  if (!c.total) return '';
  if (c.total === 1) return c.f ? '여' : '남';
  if (c.m >= 1 && c.f >= 1) return '남여';
  if (c.f >= 2) return '여여';
  if (c.m >= 2) return '남남';
  if (c.m === 1) return '남';
  if (c.f === 1) return '여';
  return '';
}

export function crossMatchLabel(myTeam, oppTeam, members) {
  var myKind = teamKindFromRoster(myTeam, members);
  var oppKind = teamKindFromRoster(oppTeam, members);
  if (!myKind || !oppKind || myKind === oppKind) return '';
  return (KIND_LABEL[myKind] || myKind) + ' vs ' + (KIND_LABEL[oppKind] || oppKind);
}

function _buildRosterHint(myTeam, oppTeam, members, myKind, oppKind, typeKey) {
  var singles = _isSinglesFormat(myTeam, oppTeam);
  var doubles = _isDoublesFormat(myTeam, oppTeam);
  var myShort = teamCompositionShort(myTeam, members);
  var oppShort = teamCompositionShort(oppTeam, members);
  var isCross = myKind && oppKind && myKind !== oppKind;

  if (!isCross) {
    if (typeKey === 'mx' && doubles && myShort && oppShort) {
      return myShort + ' vs ' + oppShort;
    }
    return '';
  }

  if (singles) {
    return (KIND_LABEL[myKind] || myShort) + ' vs ' + (KIND_LABEL[oppKind] || oppShort);
  }
  if (doubles && myShort && oppShort) {
    return myShort + ' vs ' + oppShort;
  }
  return crossMatchLabel(myTeam, oppTeam, members);
}

/**
 * 카드·목록 표시용 메타
 */
export function resolveChallengeTypeDisplay(c, members, TM) {
  var myTeam = c.myTeam || [];
  var oppTeam = c.oppTeam || [];
  var singles = _isSinglesFormat(myTeam, oppTeam);
  var doubles = _isDoublesFormat(myTeam, oppTeam);

  var inferred = inferChallengeType(myTeam, oppTeam, members);
  var stored = normalizeChallengeType(c.type);
  var typeKey = inferred || stored;

  var myKind = teamKindFromRoster(myTeam, members);
  var oppKind = teamKindFromRoster(oppTeam, members);
  var isCross = !!(myKind && oppKind && myKind !== oppKind);
  var rosterHint = _buildRosterHint(myTeam, oppTeam, members, myKind, oppKind, typeKey);

  var label;
  var badge;
  var cls;

  if (singles && isCross) {
    label = '🏓 단식';
    badge = 'bg';
    cls = 'ms';
  } else if (doubles && isCross) {
    label = '🤝 복식';
    badge = 'ba';
    cls = 'mx';
  } else {
    var tm = (TM && TM[typeKey]) || (TM && TM.ms) || { lb: typeKey, badge: 'bz', cls: typeKey };
    label = tm.lb;
    badge = tm.badge;
    cls = tm.cls;
  }

  return {
    typeKey: typeKey,
    storedType: stored,
    inferredType: inferred,
    typeMismatch: !!(inferred && stored && inferred !== stored),
    label: label,
    badge: badge,
    cls: cls,
    crossLabel: isCross ? rosterHint : '',
    rosterHint: rosterHint
  };
}
