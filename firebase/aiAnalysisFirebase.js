/**
 * AI 분석 페이지 전용 Firebase 초기화·데이터 로더
 * 기존 firebaseApp.js와 독립 — 메인 앱에 영향 없음
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, getDocs, query, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  COL_MEMBERS, COL_CHALLENGES
} from '../js/app/constants.js?v=2026.07.07.04';

const FB_CONFIG = {
  apiKey: 'AIzaSyDttEMgDQx3iS2siRzVIizxBBDZ4KjcJEw',
  authDomain: 'isatok-ef06a.firebaseapp.com',
  projectId: 'isatok-ef06a',
  storageBucket: 'isatok-ef06a.firebasestorage.app',
  messagingSenderId: '480704214424',
  appId: '1:480704214424:web:1f02fea9630e395bbb27ed'
};

/** @type {import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').Firestore|null} */
let _db = null;

/**
 * Firestore를 초기화하고 반환합니다.
 * @returns {import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').Firestore}
 */
export function initAiAnalysisFirebase() {
  if (!_db) {
    var app = initializeApp(FB_CONFIG, 'ai-analysis');
    _db = getFirestore(app);
  }
  return _db;
}

/**
 * @returns {import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').Firestore|null}
 */
export function getAiDb() {
  return _db;
}

/**
 * 선수 목록을 이름순으로 조회합니다.
 * @returns {Promise<{ id: string, name: string }[]>}
 */
export async function fetchMembersForAi() {
  var db = initAiAnalysisFirebase();
  var snap = await getDocs(query(collection(db, COL_MEMBERS), orderBy('name')));
  return snap.docs.map(function(d) {
    var data = d.data();
    return { id: d.id, name: data.name || '' };
  }).filter(function(m) { return m.name; });
}

/**
 * 완료된 대결 목록을 최근순으로 조회합니다 (영상 등록용).
 * @param {number} [maxCount]
 * @returns {Promise<object[]>}
 */
export async function fetchCompletedChallengesForAi(maxCount) {
  var db = initAiAnalysisFirebase();
  var snap = await getDocs(query(
    collection(db, COL_CHALLENGES),
    orderBy('createdAt', 'desc'),
    limit(maxCount || 80)
  ));
  return snap.docs.map(function(d) {
    return { id: d.id, ...d.data() };
  }).filter(function(c) {
    return c.status === 'completed';
  });
}
