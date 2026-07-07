/**
 * AI 분석 Firestore 저장소
 * video_analyses 컬렉션 전용 — 기존 videos/challenges 문서 스키마는 변경하지 않습니다.
 */
import {
  collection, addDoc, query, orderBy, limit, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { COL_VIDEO_ANALYSES, ANALYSIS_VERSION } from '../js/app/constants.js?v=2026.07.07.04';

/**
 * @typedef {object} AnalysisDocument
 * @property {string} youtubeUrl
 * @property {string} videoType
 * @property {string|null} [sourceVideoId]
 * @property {string|null} [sourceChallengeId]
 * @property {string} analysisVersion
 * @property {string} analysisStatus
 * @property {number} totalScore
 * @property {number} forehand
 * @property {number} backhand
 * @property {number} footwork
 * @property {number} readyPosition
 * @property {number} balance
 * @property {string} recommendedTraining
 * @property {string} coachComment
 * @property {string} createdAt
 */

/** 분석 상태 상수 */
export const ANALYSIS_STATUS = {
  NONE: 'NONE',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR'
};

/**
 * @typedef {Omit<AnalysisDocument, 'analysisVersion'|'createdAt'>} AnalysisSaveInput
 */

/**
 * 분석 결과를 Firestore video_analyses에 저장합니다.
 * @param {import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').Firestore} db
 * @param {AnalysisSaveInput} data
 * @returns {Promise<string>} 문서 ID
 */
export async function saveAnalysis(db, data) {
  if (!db) throw new Error('Firestore가 초기화되지 않았습니다');

  var docData = {
    youtubeUrl: data.youtubeUrl,
    videoType: data.videoType,
    sourceVideoId: data.sourceVideoId || null,
    sourceChallengeId: data.sourceChallengeId || null,
    analysisVersion: ANALYSIS_VERSION,
    analysisStatus: data.analysisStatus || ANALYSIS_STATUS.COMPLETED,
    totalScore: data.totalScore,
    forehand: data.forehand,
    backhand: data.backhand,
    footwork: data.footwork,
    readyPosition: data.readyPosition,
    balance: data.balance,
    recommendedTraining: data.recommendedTraining || '',
    coachComment: data.coachComment || '',
    createdAt: new Date().toISOString()
  };

  var ref = await addDoc(collection(db, COL_VIDEO_ANALYSES), docData);
  return ref.id;
}

/**
 * 최근 분석 이력을 조회합니다.
 * @param {import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').Firestore} db
 * @param {number} [maxCount]
 * @returns {Promise<(AnalysisDocument & { id: string })[]>}
 */
export async function listRecentAnalyses(db, maxCount) {
  if (!db) return [];

  var q = query(
    collection(db, COL_VIDEO_ANALYSES),
    orderBy('createdAt', 'desc'),
    limit(maxCount || 20)
  );
  var snap = await getDocs(q);
  return snap.docs.map(function(d) {
    return { id: d.id, ...d.data() };
  });
}
