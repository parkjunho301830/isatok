/**
 * Firebase 연결·Firestore 스냅샷·앱 데이터 배열
 * challenges: limit 스냅샷 + 커서 기반 추가 로드 (통계용 전체 병합)
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, onSnapshot, query, orderBy, limit,
  startAfter, getDocs, getDoc, doc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  COL_CHALLENGES, COL_MEMBERS, COL_SEASONS, COL_TOURNAMENTS,
  CHALLENGES_PAGE_SIZE,
  DEEPLINK_PARAM, DEEPLINK_VIDEO_PARAM,
  FIREBASE_TIMEOUT_MS
} from './constants.js?v=2026.06.26.10';
import { g, toast } from './appCore.js?v=2026.06.26.10';

const FB = {
  apiKey: 'AIzaSyDttEMgDQx3iS2siRzVIizxBBDZ4KjcJEw',
  authDomain: 'isatok-ef06a.firebaseapp.com',
  projectId: 'isatok-ef06a',
  storageBucket: 'isatok-ef06a.firebasestorage.app',
  messagingSenderId: '480704214424',
  appId: '1:480704214424:web:1f02fea9630e395bbb27ed'
};

const LS_DEEPLINK_MATCH = 'isatok_deeplink_match';
const LS_DEEPLINK_VIDEO = 'isatok_deeplink_video';

let db = null;
let MEMBERS = [];
let CHAL = [];
let NOTICES = [];
let BOARDS = [];
let SEASONS = [];
let TOURNAMENTS = [];

/** challenges 커서 페이지네이션 상태 */
let _chalCursor = null;
let _chalHasMore = true;
let _chalLoadingMore = false;
let _chalBgLoadStarted = false;
let _chalHooks = null;
let _chalRaf = null;

try {
  var _bootParams = new URLSearchParams(location.search);
  var _bootMatch = _bootParams.get(DEEPLINK_PARAM);
  if (_bootMatch) sessionStorage.setItem(LS_DEEPLINK_MATCH, _bootMatch);
  if (_bootParams.get(DEEPLINK_VIDEO_PARAM) === '1') {
    sessionStorage.setItem(LS_DEEPLINK_VIDEO, '1');
  }
} catch (e) {}

function _docToChallenge(d) {
  return { id: d.id, ...d.data() };
}

function _sortChallenges(arr) {
  return arr.slice().sort(function(a, b) {
    var ta = a.createdAt || '';
    var tb = b.createdAt || '';
    return tb.localeCompare(ta);
  });
}

/**
 * 스냅샷 페이지(최신 N건)와 기존 로드분을 id 기준 병합
 * @param {object[]} incoming
 * @param {Set<string>|null} liveIds 스냅샷에 포함된 id (이 집합에 있으면 incoming 우선)
 */
function _mergeChallenges(incoming, liveIds) {
  var map = new Map();
  CHAL.forEach(function(c) {
    if (!liveIds || !liveIds.has(c.id)) map.set(c.id, c);
  });
  incoming.forEach(function(c) { map.set(c.id, c); });
  CHAL = _sortChallenges(Array.from(map.values()));
}

function _scheduleChallengesHook() {
  if (!_chalHooks) return;
  if (_chalRaf) cancelAnimationFrame(_chalRaf);
  _chalRaf = requestAnimationFrame(function() {
    _chalHooks.onChallenges();
    _chalRaf = null;
  });
}

function _challengesQueryBase() {
  return query(
    collection(db, COL_CHALLENGES),
    orderBy('createdAt', 'desc'),
    limit(CHALLENGES_PAGE_SIZE)
  );
}

function _challengesQueryAfter(cursor) {
  return query(
    collection(db, COL_CHALLENGES),
    orderBy('createdAt', 'desc'),
    startAfter(cursor),
    limit(CHALLENGES_PAGE_SIZE)
  );
}

/**
 * 커서 다음 페이지를 Firestore에서 가져와 CHAL에 병합
 * @param {boolean} notify UI 훅 호출 여부
 * @return {Promise<boolean>} 더 불러올 데이터가 있으면 true
 */
async function _fetchNextChallengePage(notify) {
  if (!db || !_chalHasMore || _chalLoadingMore) return false;
  if (!_chalCursor) return false;

  _chalLoadingMore = true;
  try {
    var snap = await getDocs(_challengesQueryAfter(_chalCursor));
    var page = snap.docs.map(_docToChallenge);
    if (page.length) _mergeChallenges(page, null);

    if (snap.docs.length < CHALLENGES_PAGE_SIZE) {
      _chalHasMore = false;
    } else {
      _chalCursor = snap.docs[snap.docs.length - 1];
    }
    if (notify) _scheduleChallengesHook();
    return _chalHasMore;
  } catch (e) {
    console.warn('[이사탁] challenges 페이지 로드 실패', e);
    return _chalHasMore;
  } finally {
    _chalLoadingMore = false;
  }
}

/** 백그라운드에서 나머지 challenges 전부 로드 (통계·랭킹 정확도 유지) */
async function _backgroundLoadAllChallenges() {
  while (_chalHasMore && !_chalLoadingMore) {
    var hadMore = await _fetchNextChallengePage(false);
    if (!hadMore) break;
    await new Promise(function(r) { setTimeout(r, 80); });
  }
  _scheduleChallengesHook();
}

export function getDb() { return db; }
export function getMembers() { return MEMBERS; }
export function getChal() { return CHAL; }
export function getNotices() { return NOTICES; }
export function getBoards() { return BOARDS; }
export function getSeasons() { return SEASONS; }
export function getTournaments() { return TOURNAMENTS; }

export function hasMoreChallenges() { return _chalHasMore; }
export function isChallengesLoadingMore() { return _chalLoadingMore; }

/** 사용자 "더 보기" — Firestore 커서 다음 페이지 */
export function loadMoreChallenges() {
  return _fetchNextChallengePage(true);
}

/**
 * 딥링크 등 단건 challenge가 CHAL에 없을 때 로드
 * @param {string} id
 * @return {Promise<boolean>}
 */
export async function ensureChallengeById(id) {
  if (!id || !db) return false;
  if (CHAL.some(function(c) { return c.id === id; })) return true;
  try {
    var snap = await getDoc(doc(db, COL_CHALLENGES, id));
    if (!snap.exists()) return false;
    _mergeChallenges([_docToChallenge(snap)], null);
    _scheduleChallengesHook();
    return true;
  } catch (e) {
    return false;
  }
}

export function findMemberByName(name) {
  return MEMBERS.find(function(m) { return m.name === name; });
}

export function removeMemberLocal(id) {
  MEMBERS = MEMBERS.filter(function(m) { return m.id !== id; });
}

export function removeChallengeLocal(id) {
  CHAL = CHAL.filter(function(c) { return c.id !== id; });
}

export function unshiftChallengeLocal(c) {
  CHAL.unshift(c);
  CHAL = _sortChallenges(CHAL);
}

export function updateChallengeLocal(id, patch) {
  var t = CHAL.find(function(c) { return c.id === id; });
  if (t) Object.assign(t, patch);
}

export function unshiftNoticeLocal(n) { NOTICES.unshift(n); }
export function updateNoticeLocal(id, u) {
  var i = NOTICES.findIndex(function(n) { return n.id === id; });
  if (i > -1) NOTICES[i] = { ...NOTICES[i], ...u };
}
export function removeNoticeLocal(id) {
  NOTICES = NOTICES.filter(function(n) { return n.id !== id; });
}

export function unshiftBoardLocal(b) { BOARDS.unshift(b); }
export function updateBoardLocal(id, u) {
  var i = BOARDS.findIndex(function(b) { return b.id === id; });
  if (i > -1) BOARDS[i] = { ...BOARDS[i], ...u };
}
export function removeBoardLocal(id) {
  BOARDS = BOARDS.filter(function(b) { return b.id !== id; });
}

export function setDb(ok) {
  var h = ok
    ? '<span style="color:var(--a)">● Firebase 연결됨</span>'
    : '<span style="color:var(--amber)">● 연결 실패</span>';
  g('dbs').innerHTML = h;
  var dbm = g('dbm');
  if (dbm) dbm.textContent = ok ? '🟢' : '🟡';
}

/**
 * Firebase 초기화 후 finish 콜백을 호출한다.
 * @param {object} hooks - 스냅샷 후 렌더 훅
 */
export async function initFirebase(hooks) {
  _chalHooks = hooks;
  var safe = setTimeout(function() {
    hooks.onReady();
    toast('⚠️ 연결 지연');
  }, FIREBASE_TIMEOUT_MS);
  try {
    initializeApp(FB);
    db = getFirestore();
    setDb(true);

    var rafM = null, rafSn = null;

    onSnapshot(query(collection(db, COL_MEMBERS), orderBy('name')), function(s) {
      MEMBERS = s.docs.map(function(d) { return { id: d.id, ...d.data() }; });
      if (rafM) cancelAnimationFrame(rafM);
      rafM = requestAnimationFrame(function() {
        hooks.onMembers();
        rafM = null;
      });
    });

    onSnapshot(_challengesQueryBase(), function(s) {
      var page = s.docs.map(_docToChallenge);
      var liveIds = new Set(page.map(function(c) { return c.id; }));
      _mergeChallenges(page, liveIds);

      if (s.docs.length >= CHALLENGES_PAGE_SIZE) {
        _chalCursor = s.docs[s.docs.length - 1];
        _chalHasMore = true;
      } else {
        _chalCursor = null;
        _chalHasMore = false;
      }

      if (!_chalBgLoadStarted && _chalHasMore) {
        _chalBgLoadStarted = true;
        _backgroundLoadAllChallenges();
      }

      _scheduleChallengesHook();
    });

    onSnapshot(query(collection(db, COL_SEASONS), orderBy('startDate', 'desc')), function(s) {
      SEASONS = s.docs.map(function(d) { return { id: d.id, ...d.data() }; });
      if (rafSn) cancelAnimationFrame(rafSn);
      rafSn = requestAnimationFrame(function() {
        hooks.onSeasons();
        rafSn = null;
      });
    });

    try {
      onSnapshot(collection(db, COL_TOURNAMENTS), function(s) {
        TOURNAMENTS = s.docs.map(function(d) { return { id: d.id, ...d.data() }; });
        hooks.onTournaments();
      });
    } catch (e) {}

    clearTimeout(safe);
    hooks.onReady();
  } catch (e) {
    clearTimeout(safe);
    setDb(false);
    toast('❌ ' + e.message);
    hooks.onReady();
  }
}
