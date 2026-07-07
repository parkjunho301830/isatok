/**
 * AI 분석 페이지 — 영상 등록 서비스
 * 기존 videosTab.js / challenges.js 로직을 복제하지 않고 동일 스키마로 저장합니다.
 */
import {
  collection, doc, addDoc, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  COL_VIDEOS, COL_CHALLENGES
} from '../js/app/constants.js?v=2026.07.07.04';
import { extractYouTubeVideoId } from '../js/app/youtubeUtils.js?v=2026.07.07.04';

/**
 * @typedef {object} ClubVideoRegisterInput
 * @property {string} youtubeUrl
 * @property {string} category 레슨 | 훈련
 * @property {string[]} memberIds
 * @property {string[]} memberNames
 * @property {string} [description]
 * @property {string} [date]
 */

/**
 * @typedef {object} MatchVideoRegisterInput
 * @property {string} challengeId
 * @property {string} youtubeUrl
 */

/**
 * 클럽 영상(레슨·훈련)을 videos 컬렉션에 등록합니다.
 * @param {import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').Firestore} db
 * @param {ClubVideoRegisterInput} input
 * @returns {Promise<string>} video 문서 ID
 */
export async function registerClubVideo(db, input) {
  if (!extractYouTubeVideoId(input.youtubeUrl)) {
    throw new Error('유효한 유튜브 URL이 아닙니다');
  }
  if (!input.memberIds || !input.memberIds.length) {
    throw new Error('선수를 한 명 이상 선택해 주세요');
  }

  var data = {
    title: input.category,
    youtubeUrl: input.youtubeUrl.trim(),
    description: (input.description || '').trim().slice(0, 200),
    category: input.category,
    memberId: input.memberIds[0],
    memberName: input.memberNames.join(' · '),
    memberIds: input.memberIds,
    memberNames: input.memberNames,
    date: input.date || '',
    viewCount: 0,
    createdAt: new Date().toISOString()
  };

  var ref = await addDoc(collection(db, COL_VIDEOS), data);
  return ref.id;
}

/**
 * 대결 영상 URL을 challenges 문서에 등록합니다.
 * @param {import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').Firestore} db
 * @param {MatchVideoRegisterInput} input
 * @returns {Promise<string>} challenge 문서 ID
 */
export async function registerMatchVideo(db, input) {
  if (!input.challengeId) {
    throw new Error('대결을 선택해 주세요');
  }
  if (!extractYouTubeVideoId(input.youtubeUrl)) {
    throw new Error('유효한 유튜브 URL이 아닙니다');
  }

  await updateDoc(doc(db, COL_CHALLENGES, input.challengeId), {
    videoUrl: input.youtubeUrl.trim()
  });
  return input.challengeId;
}
