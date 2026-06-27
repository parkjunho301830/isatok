/**
 * 출석 체크 — Firestore attendance 컬렉션
 */
import {
  collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { COL_ATTENDANCE } from './constants.js?v=2026.06.26.10';
import { getMyPlayerId } from './wizard.js?v=2026.06.26.10';
import { refreshCustomSelect } from './customSelect.js?v=2026.06.26.10';

let C = null;
let _unsubToday = null;
let _subscribedDate = null;
let _submitting = false;
let _todayRows = [];

export function getTodayString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function formatTodayLabel() {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  }).format(new Date());
}

export function initAttendance(ctx) {
  C = ctx;
  window.submitAttendanceForm = submitAttendanceForm;
}

function g(id) { return C ? C.g(id) : null; }
function toast(msg) { return C && C.toast(msg); }
function db() { return C ? C.getDb() : null; }
function members() { return C ? C.getMembers() : []; }

function _membersSortedForSelect() {
  return members()
    .filter(function(m) { return m && m.name; })
    .slice()
    .sort(function(a, b) { return a.name.localeCompare(b.name, 'ko'); });
}

function _applyMyPlayerToSelect(sel, list) {
  var myId = getMyPlayerId();
  if (!myId || !sel) return;
  if (list.some(function(m) { return m.id === myId; })) sel.value = myId;
}

export function renderAttendanceMembers() {
  var sel = g('attendance-member');
  if (!sel) return;
  var prev = sel.value;
  var list = _membersSortedForSelect();
  var html = '<option value="">선택해주세요</option>'
    + list.map(function(m) {
      return '<option value="' + m.id + '" data-name="' + escapeAttr(m.name) + '">' + escapeHtml(m.name) + '</option>';
    }).join('');
  sel.innerHTML = html;
  if (prev && list.some(function(m) { return m.id === prev; })) {
    sel.value = prev;
  } else {
    _applyMyPlayerToSelect(sel, list);
  }
  refreshCustomSelect(sel);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/'/g, '&#39;');
}

function _updateDateLabel() {
  var el = g('attendance-date-label');
  if (el) el.textContent = formatTodayLabel();
}

function _uniqueRowsByMember(rows) {
  var seen = {};
  return rows.filter(function(row) {
    if (!row.memberId || seen[row.memberId]) return false;
    seen[row.memberId] = true;
    return true;
  });
}

function hasCheckedInToday(memberId) {
  if (!memberId) return false;
  return _todayRows.some(function(row) { return row.memberId === memberId; });
}

async function _confirmNotDuplicateToday(memberId) {
  if (hasCheckedInToday(memberId)) return true;
  if (!db()) return false;

  var today = getTodayString();
  var snap = await getDocs(
    query(collection(db(), COL_ATTENDANCE), where('date', '==', today))
  );
  return snap.docs.some(function(d) {
    return (d.data().memberId || '') === memberId;
  });
}

function _renderTodayList(rows) {
  _todayRows = rows || [];
  var unique = _uniqueRowsByMember(_todayRows);
  var countEl = g('attendance-today-count');
  var listEl = g('attendance-today-list');
  if (!countEl || !listEl) return;

  countEl.textContent = '오늘 출석 인원: ' + unique.length + '명';

  if (!unique.length) {
    listEl.innerHTML = '<p class="attendance-empty">아직 출석한 회원이 없습니다.</p>';
    return;
  }

  listEl.innerHTML = unique.map(function(row) {
    var note = row.note ? ' title="' + escapeAttr(row.note) + '"' : '';
    return '<span class="attendance-chip"' + note + '>' + escapeHtml(row.memberName) + '</span>';
  }).join('');
}

export function subscribeToday(callback) {
  var today = getTodayString();
  if (_unsubToday && _subscribedDate === today) return _unsubToday;

  if (_unsubToday) {
    _unsubToday();
    _unsubToday = null;
  }
  _subscribedDate = today;

  if (!db()) {
    callback([]);
    return function() {};
  }

  var q = query(
    collection(db(), COL_ATTENDANCE),
    where('date', '==', today),
    orderBy('createdAt', 'asc')
  );

  _unsubToday = onSnapshot(q, function(snap) {
    var rows = snap.docs.map(function(d) {
      var data = d.data();
      return {
        id: d.id,
        memberId: data.memberId || '',
        memberName: data.memberName || '',
        note: data.note || '',
        date: data.date || '',
        createdAt: data.createdAt
      };
    });
    callback(rows);
  }, function(err) {
    console.warn('[이사탁] attendance 구독 실패', err);
    toast('⚠️ 출석 현황을 불러오지 못했습니다');
  });

  return _unsubToday;
}

export function initAttendancePage() {
  if (!C) return;
  _updateDateLabel();
  renderAttendanceMembers();

  subscribeToday(function(rows) {
    _renderTodayList(rows);
  });
}

export async function submitAttendance(memberId, memberName, note) {
  if (!memberId || !memberName) throw new Error('회원을 선택해주세요');
  if (!db()) throw new Error('Firebase에 연결되지 않았습니다');

  if (await _confirmNotDuplicateToday(memberId)) {
    throw new Error(memberName + '님은 이미 오늘 출석하셨습니다');
  }

  await addDoc(collection(db(), COL_ATTENDANCE), {
    memberId: memberId,
    memberName: memberName,
    note: note || '',
    date: getTodayString(),
    createdAt: serverTimestamp()
  });
}

async function submitAttendanceForm(ev) {
  if (ev) ev.preventDefault();
  if (_submitting) return false;

  var sel = g('attendance-member');
  var noteEl = g('attendance-note');
  var successEl = g('attendance-success');
  var btn = g('attendance-submit-btn');

  if (!sel || !sel.value) {
    toast('⚠️ 이름을 선택해주세요');
    return false;
  }

  var opt = sel.options[sel.selectedIndex];
  var memberId = sel.value;
  var memberName = (opt && opt.dataset.name) || opt.textContent.trim();
  var note = noteEl ? noteEl.value.trim() : '';

  _submitting = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '제출 중…';
  }

  try {
    if (await _confirmNotDuplicateToday(memberId)) {
      toast('⚠️ ' + memberName + '님은 이미 오늘 출석하셨습니다');
      if (successEl) successEl.hidden = true;
      return false;
    }

    await submitAttendance(memberId, memberName, note);
    if (successEl) {
      successEl.hidden = false;
      successEl.textContent = '✅ ' + memberName + '님 출석 완료!';
    }
    if (noteEl) noteEl.value = '';
    _applyMyPlayerToSelect(sel, _membersSortedForSelect());
    toast('✅ ' + memberName + '님 출석 완료!');
  } catch (e) {
    toast('❌ ' + (e.message || '출석 등록 실패'));
    if (successEl) successEl.hidden = true;
  } finally {
    _submitting = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = '출석 체크하기';
    }
  }

  return false;
}
