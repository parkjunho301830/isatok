/**
 * 내 선수 기준 앱 접속 기록 (Firestore) · 관리자 접속 목록
 */
import {
  collection, doc, onSnapshot, orderBy, query, setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { COL_PLAYER_PRESENCE } from './constants.js?v=2026.06.26.10';

const TOUCH_INTERVAL_MS = 3 * 60 * 1000;
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const SS_TOUCH = 'isatok_presence_last';

let C = null;
let _presenceUnsub = null;
let _visibilityBound = false;

export function initPlayerPresence(ctx) {
  C = ctx;
}

export function startPlayerPresenceTracking() {
  touchPlayerPresence();
  if (_visibilityBound || typeof document === 'undefined') return;
  _visibilityBound = true;
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') touchPlayerPresence();
  });
}

export async function touchPlayerPresence() {
  if (!C) return;
  var db = C.getDb();
  if (!db) return;
  var memberId = C.getMyPlayerId();
  var memberName = C.getMyPlayerName();
  if (!memberId || !memberName) return;
  if (!_shouldTouch()) return;

  try {
    await setDoc(doc(db, COL_PLAYER_PRESENCE, memberId), {
      memberId: memberId,
      memberName: memberName,
      lastSeenAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn('[이사탁] 접속 기록 저장 실패', e);
  }
}

function _shouldTouch() {
  try {
    var last = parseInt(sessionStorage.getItem(SS_TOUCH) || '0', 10);
    if (Date.now() - last < TOUCH_INTERVAL_MS) return false;
    sessionStorage.setItem(SS_TOUCH, String(Date.now()));
    return true;
  } catch (e) {
    return true;
  }
}

function _formatLastSeen(iso) {
  if (!iso) return '—';
  var t = new Date(iso).getTime();
  if (isNaN(t)) return '—';
  var diff = Date.now() - t;
  if (diff < 60 * 1000) return '방금';
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + '분 전';
  var d = new Date(t);
  var now = new Date();
  var sameDay = d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
  var time = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return '오늘 ' + time;
  var yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  var isYesterday = d.getFullYear() === yesterday.getFullYear()
    && d.getMonth() === yesterday.getMonth()
    && d.getDate() === yesterday.getDate();
  if (isYesterday) return '어제 ' + time;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) + ' ' + time;
}

function _isOnline(iso) {
  if (!iso) return false;
  var t = new Date(iso).getTime();
  return !isNaN(t) && (Date.now() - t) < ONLINE_WINDOW_MS;
}

function _escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _renderPresenceRows(rows) {
  var list = C.g('admin-presence-list');
  if (!list) return;
  if (!rows.length) {
    list.innerHTML = '<div class="admin-presence-empty">아직 접속 기록이 없습니다.</div>';
    return;
  }
  list.innerHTML = rows.map(function(row) {
    var online = _isOnline(row.lastSeenAt);
    return '<div class="admin-presence-row">'
      + '<span class="admin-presence-dot' + (online ? ' admin-presence-dot--on' : '') + '" aria-hidden="true"></span>'
      + '<div class="admin-presence-name">' + _escapeHtml(row.memberName) + '</div>'
      + '<div class="admin-presence-time">' + _formatLastSeen(row.lastSeenAt) + '</div>'
      + '</div>';
  }).join('');
}

export function bindAdminPresencePanel() {
  if (!C || !C.isAdmin() || C.getCurrentPage() !== 'admin') {
    unbindAdminPresencePanel();
    return;
  }
  var db = C.getDb();
  var list = C.g('admin-presence-list');
  if (!db || !list) return;

  if (_presenceUnsub) return;

  var q = query(collection(db, COL_PLAYER_PRESENCE), orderBy('lastSeenAt', 'desc'));
  _presenceUnsub = onSnapshot(q, function(snap) {
    var rows = snap.docs.map(function(d) { return d.data(); })
      .filter(function(row) { return row && row.memberName; });
    _renderPresenceRows(rows);
  }, function(err) {
    console.warn('[이사탁] 접속 목록 로드 실패', err);
    if (list) {
      list.innerHTML = '<div class="admin-presence-empty">접속 목록을 불러오지 못했습니다.</div>';
    }
  });
}

export function unbindAdminPresencePanel() {
  if (_presenceUnsub) {
    _presenceUnsub();
    _presenceUnsub = null;
  }
}
