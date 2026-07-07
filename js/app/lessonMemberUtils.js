/**
 * 레슨·훈련 영상 — 선수(복수) 필드 정규화
 */

export function lessonMemberIds(v) {
  if (!v) return [];
  if (Array.isArray(v.memberIds) && v.memberIds.length) {
    return v.memberIds.filter(function(id) { return !!id; });
  }
  if (v.memberId) return [v.memberId];
  return [];
}

export function lessonMemberNames(v, memberList) {
  if (!v) return [];
  memberList = memberList || [];
  if (Array.isArray(v.memberNames) && v.memberNames.length) {
    return v.memberNames.map(function(n) { return String(n || '').trim(); }).filter(Boolean);
  }
  if (v.memberName && typeof v.memberName === 'string') {
    return v.memberName.split('·').map(function(n) { return n.trim(); }).filter(Boolean);
  }
  return lessonMemberIds(v).map(function(id) {
    var m = memberList.find(function(x) { return x.id === id; });
    return m ? m.name : '';
  }).filter(Boolean);
}

export function lessonMemberLabel(v, memberList) {
  var names = lessonMemberNames(v, memberList);
  if (!names.length) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join(' · ');
  return names[0] + ' 외 ' + (names.length - 1) + '명';
}

export function lessonHasMember(v, memberId) {
  if (!memberId) return true;
  return lessonMemberIds(v).indexOf(memberId) >= 0;
}
