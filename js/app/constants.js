/**
 * @file constants.js
 * @description 이사탁 앱 전역 상수 정의
 * 하드코딩 방지 및 유지보수를 위해 한 곳에서 관리
 * 수정일: 2026-06-23
 */

// ── Firestore 컬렉션명 ────────────────────────────────
export const COL_CHALLENGES  = 'challenges';
export const COL_MEMBERS     = 'members';
export const COL_SEASONS     = 'seasons';
export const COL_NOTICES     = 'notices';
export const COL_BOARDS      = 'boards';
export const COL_TOURNAMENTS = 'tournaments';
export const COL_ATTENDANCE   = 'attendance';
export const COL_PLAYER_PRESENCE = 'playerPresence';

// ── 포인트 기준 ───────────────────────────────────────
export const PT_INDIVIDUAL_WIN  = 10;
export const PT_INDIVIDUAL_LOSS = -5;
export const PT_DOUBLE_WIN      = 5;
export const PT_DOUBLE_LOSS     = -2;
export const PT_INIT            = 1000;

// ── 등급 기준 ─────────────────────────────────────────
export const GRADE_TIERS = [
  {min:1500,icon:'👑',label:'마스터',badge:'bp'},
  {min:1400,icon:'💎',label:'고수',badge:'bg'},
  {min:1300,icon:'🥇',label:'상급',badge:'bb'},
  {min:1200,icon:'🥈',label:'중급',badge:'ba'},
  {min:1100,icon:'🥉',label:'초급',badge:'bz'},
  {min:0,icon:'🌱',label:'입문',badge:'bz'}
];

// ── 대결(challenges) 페이지네이션 ─────────────────────
/** Firestore 커서 페이지 크기 (실시간 스냅샷·추가 로드) */
export const CHALLENGES_PAGE_SIZE = 50;
/** 목록 UI 한 번에 표시할 카드 수 (더 보기로 확장) */
export const CHALLENGES_LIST_DISPLAY_STEP = 30;

// ── 오픈 챌린지 ───────────────────────────────────────
export const OPEN_CHALLENGE_EXPIRE_DAYS = 3;
export const OPEN_CHALLENGE_EXPIRE_MS   =
  OPEN_CHALLENGE_EXPIRE_DAYS * 24 * 60 * 60 * 1000;

// ── 딥링크 ────────────────────────────────────────────
export const DEEPLINK_PARAM             = 'match';
export const DEEPLINK_VIDEO_PARAM       = 'video';
export const DEEPLINK_TAB_DELAY_PC      = 500;
export const DEEPLINK_TAB_DELAY_MOBILE  = 1000;
export const DEEPLINK_MAX_WAIT_PC       = 6000;
export const DEEPLINK_MAX_WAIT_MOBILE   = 10000;
export const DEEPLINK_POLL_INTERVAL     = 200;

// ── 랭킹 스냅샷 ──────────────────────────────────────
export const RANK_SNAPSHOT_KEY_PREFIX = 'isatok_rank_snapshot';

// ── UI 타이밍 ─────────────────────────────────────────
export const FEEDBACK_AUTO_CLOSE_MS = 3000;
export const HIGHLIGHT_REMOVE_MS    = 2500;
export const FIREBASE_TIMEOUT_MS    = 6000;
export const TOAST_DURATION_MS      = 5000;
export const BS_ANIM_MS             = 320;

// ── UI 레이아웃 ───────────────────────────────────────
export const NAV_HEIGHT_MOBILE = 80;
export const NAV_HEIGHT_PC     = 60;
export const DRUM_ITEM_H       = 44;

// ── 조직도 회원 사진 API (Google Apps Script) ─────────
export const ORG_CHART_API_URL =
  'https://script.google.com/macros/s/AKfycbwSAudQcsWFxq5MPVuqQLzjmbyxgL0DRdGUBfXWLtscgYXh4-NDfiDx0VOwX_y8YLuseA/exec?action=getMembers';
/** 사진 캐시 TTL (6시간) */
export const MEMBER_PHOTO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// ── AI 코칭 (Firebase Functions) ─────────────────────
const AI_FN_BASE =
  'https://asia-northeast3-isatok-ef06a.cloudfunctions.net';
export const WEEKLY_COACH_REPORT_URL = AI_FN_BASE + '/weeklyCoachReport';
export const POST_MATCH_COMMENT_URL = AI_FN_BASE + '/postMatchComment';
export const DAILY_BRIEFING_URL = AI_FN_BASE + '/dailyBriefing';
export const OPPONENT_ANALYSIS_URL = AI_FN_BASE + '/opponentAnalysis';
export const MONTHLY_CLUB_STORY_URL = AI_FN_BASE + '/monthlyClubStory';
export const WEEKLY_REPORT_CACHE_KEY_PREFIX = 'isatok_weekly_report_v2';
export const DAILY_BRIEFING_CACHE_PREFIX = 'isatok_daily_briefing_v1';
export const POST_MATCH_CACHE_PREFIX = 'isatok_post_match_v1';
export const OPPONENT_AI_CACHE_PREFIX = 'isatok_opponent_ai_v1';
export const MONTHLY_STORY_CACHE_PREFIX = 'isatok_monthly_story_v1';

// ── 관리자 ────────────────────────────────────────────
export const ADMIN_PIN = '2580';

// ── 색상 (JS에서 직접 사용하는 경우) ──────────────────
export const COLOR_PRIMARY = '#007AFF';
export const COLOR_SUCCESS = '#34C759';
export const COLOR_DANGER  = '#FF3B30';
export const COLOR_WARNING = '#FF9500';
export const COLOR_GRAY    = '#8E8E93';
export const COLOR_GOLD    = '#FFD700';
