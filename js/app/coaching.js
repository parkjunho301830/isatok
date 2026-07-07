/**
 * 규칙 기반 코칭 · 운세 · 추천 이유 (LLM 없음)
 */
import { GRADE_TIERS, PT_INIT } from './constants.js?v=2026.07.07.01';

const FORTUNE_TEMPLATES = [
  { icon: '🏓', text: '오늘은 짧은 랠리보다 길게 붙는 플레이가 운이 좋아요.' },
  { icon: '⚡', text: '첫 세트 선취에 도전해 보세요. 흐름이 따라옵니다.' },
  { icon: '🤝', text: '복식은 파트너와 호흡 맞추기가 승부의 열쇠예요.' },
  { icon: '🎯', text: '무리한 공격보다 안정적인 리시브가 오늘의 무기예요.' },
  { icon: '💪', text: '평소보다 한 단계 위 상대에게 도전하면 성장이 빨라져요.' },
  { icon: '🌤️', text: '가벼운 워밍업 후 본경기 들어가면 컨디션이 올라가요.' },
  { icon: '🔥', text: '연속 득점보다 실수 줄이기에 집중하면 승률이 올라가요.' },
  { icon: '✨', text: '오늘은 멘탈 탄탄하게 — 한 점 한 점 집중이 행운을 부릅니다.' }
];

const WEEKDAY_HINTS = [
  '월요일, 한 주를 여는 가벼운 한 판 어때요?',
  '화요일, 어제보다 한 점만 더 집중해 보세요.',
  '수요일, 한 주의 중반 — 컨디션 체크하고 경기해요.',
  '목요일, 주말 전 마지막 스퍼트 타이밍이에요.',
  '금요일, 금요일 탁구는 특별한 운이 따른대요.',
  '토요일, 동호회 분위기 살리기 좋은 날이에요.',
  '일요일, 여유 있게 한 판 더? 회복도 운동이에요.'
];

export function coachHashSeed(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function kstDateKey(d) {
  d = d || new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * @param {object} ctx
 * @returns {{icon: string, title: string, text: string}}
 */
export function buildTodayFortune(ctx) {
  var title = '오늘의 탁구 운세';
  var seed = coachHashSeed((ctx.name || '') + '|' + (ctx.dateKey || ''));
  var dayIdx = ctx.dayIdx != null ? ctx.dayIdx : new Date().getDay();

  if (!ctx.rec || ctx.rec.total === 0) {
    return { icon: '🌟', title: title, text: '첫 경기가 오늘 운세의 핵심! 가벼운 한 판부터 시작해 보세요.' };
  }

  if (ctx.streak && ctx.streak.type === 'win' && parseInt(ctx.streak.label, 10) >= 3) {
    return { icon: '🔥', title: title, text: ctx.streak.label + ' 흐름 중! 오늘도 자신감 있게 이어가 보세요.' };
  }

  if (ctx.streak && ctx.streak.type === 'lose') {
    var n = parseInt(ctx.streak.label, 10);
    if (n >= 3) {
      return { icon: '🧊', title: title, text: '무리한 대결보다 익숙한 상대와 가벼운 연습전이 운이 좋아요.' };
    }
    if (n >= 2) {
      return { icon: '🌱', title: title, text: '잠깐 숨 고르기 — 승률 비슷한 상대로 흐름을 바꿔보세요.' };
    }
  }

  if (ctx.rival && ctx.rival.mostLose && ctx.rival.mostLose.lose >= 2) {
    return { icon: '⚔️', title: title, text: ctx.rival.mostLose.name + '님과의 리벤지가 오늘의 키포인트예요.' };
  }

  if (ctx.partner && ctx.partner.winRate >= 60) {
    return { icon: '🤝', title: title, text: ctx.partner.name + '님과 복식이면 시너지가 좋은 날이에요.' };
  }

  if (ctx.rank != null && ctx.rank <= 3) {
    return { icon: '👑', title: title, text: '상위권 수비! 오늘은 실수 없는 플레이가 행운을 지켜줘요.' };
  }

  var tpl = FORTUNE_TEMPLATES[seed % FORTUNE_TEMPLATES.length];
  var weekday = WEEKDAY_HINTS[dayIdx] || '';
  return { icon: tpl.icon, title: title, text: tpl.text + (weekday ? ' ' + weekday : '') };
}

/**
 * @param {object} ctx
 * @returns {string}
 */
export function buildRecommendReason(ctx) {
  var parts = [];
  if (ctx.rankDiff != null && ctx.rankDiff <= 1) {
    parts.push('랭킹이 거의 같아요');
  } else if (ctx.rankDiff != null && ctx.rankDiff <= 3) {
    parts.push('랭킹이 비슷해요');
  }
  if (ctx.winRateDiff != null && ctx.winRateDiff <= 8) {
    parts.push('승률이 비슷해요');
  }
  if (!ctx.playedRecently) {
    parts.push('최근 맞붙은 적 없어요');
  } else if (ctx.playedRecently) {
    parts.push('최근 맞대결 경험이 있어요');
  }
  if (ctx.h2hWins != null && ctx.h2hWins > ctx.h2hLosses) {
    parts.push('상대 전적 우세');
  } else if (ctx.h2hLosses != null && ctx.h2hLosses > ctx.h2hWins + 1) {
    parts.push('리벤지 각');
  }
  if (!parts.length) return '균형 잡힌 대결이에요';
  return parts.slice(0, 2).join(' · ');
}

/**
 * @param {object} ctx
 * @returns {string}
 */
export function buildPostMatchComment(ctx) {
  var isWin = !!ctx.isWin;
  var pt = ctx.pointDelta != null ? ctx.pointDelta : 0;

  if (isWin) {
    if (pt >= 10) return '큰 승리! 포인트도 크게 올랐어요. 이 흐름을 이어가 보세요.';
    if (ctx.streakWins >= 3) return ctx.streakWins + '연승! 자신감이 최고조 — 다음 상대도 도전해요.';
    if (ctx.opponentName) return ctx.opponentName + '님과의 좋은 경기! 승리 기세를 살려 한 판 더?';
    return '좋은 승리예요. 오늘 컨디션 그대로 이어가 보세요.';
  }

  if (pt <= -5) return '아쉽지만 한 판의 패배일 뿐이에요. 복기하고 다시 도전해 보세요.';
  if (ctx.streakLosses >= 3) return '연패 중이지만 여기서 끊으면 됩니다. 가벼운 상대부터 다시 시작해요.';
  if (ctx.opponentName) return ctx.opponentName + '님과 접전! 리벤지 타이밍을 노려보세요.';
  return '접전이었어요. 다음 경기에서 반전 노려봐요.';
}

/**
 * @param {{total: number, winRate: number}} rec
 * @param {number} clubAvg
 * @returns {string}
 */
export function buildClubCompareLine(rec, clubAvg) {
  if (!rec || !rec.total) return '';
  var diff = rec.winRate - clubAvg;
  if (diff >= 10) return '📈 동호회 평균 ' + clubAvg + '%보다 ' + diff + '%p 높아요';
  if (diff >= 5) return '📈 동호회 평균 ' + clubAvg + '%보다 조금 위 — ' + rec.winRate + '% 유지 중';
  if (diff <= -10) return '📉 동호회 평균 ' + clubAvg + '%보다 ' + Math.abs(diff) + '%p 낮아요. 꾸준히 올려봐요';
  if (diff <= -5) return '📉 동호회 평균 ' + clubAvg + '% · 나 ' + rec.winRate + '% — 조금 더 올릴 여지가 있어요';
  return '📊 동호회 평균 ' + clubAvg + '% · 나 ' + rec.winRate + '% (비슷한 편)';
}

/**
 * @param {number} pt
 * @param {string} modeLbl
 * @returns {{text: string, remain: number, nextGrade: string}|null}
 */
export function getGradeNudge(pt, modeLbl) {
  pt = pt != null ? pt : PT_INIT;
  for (var i = 0; i < GRADE_TIERS.length; i++) {
    var tier = GRADE_TIERS[i];
    if (pt >= tier.min) {
      if (i === 0) return null;
      var nextTier = GRADE_TIERS[i - 1];
      var remain = nextTier.min - pt;
      if (remain <= 0 || remain > 60) return null;
      return {
        text: modeLbl + ' ' + nextTier.icon + ' ' + nextTier.label + '까지 ' + remain + 'pt',
        remain: remain,
        nextGrade: nextTier.label
      };
    }
  }
  return null;
}

/**
 * @param {object} ctx - rivalStats, partner, membersByName
 * @returns {{rival: object|null, partner: object|null}}
 */
export function buildTodayPicks(ctx) {
  var rival = null;
  var partner = null;

  if (ctx.rivalStats && ctx.rivalStats.mostLose && ctx.rivalStats.mostLose.lose >= 2) {
    var r = ctx.rivalStats.mostLose;
    var rm = ctx.membersByName && ctx.membersByName[r.name];
    if (rm) {
      rival = { m: rm, win: r.win, lose: r.lose };
    }
  }

  if (ctx.partner && ctx.partner.count >= 3 && ctx.partner.winRate >= 50) {
    var pm = ctx.membersByName && ctx.membersByName[ctx.partner.name];
    if (pm) {
      partner = { m: pm, count: ctx.partner.count, winRate: ctx.partner.winRate };
    }
  }

  return { rival: rival, partner: partner };
}

/**
 * @param {number} rec
 * @returns {'hot'|'warm'|'cool'|null}
 */
export function coachFormMood(rec) {
  if (!rec || rec.total < 3) return null;
  if (rec.currentStreak >= 3) return 'hot';
  if (rec.winRate >= 55) return 'warm';
  if (rec.winRate < 35 && rec.total >= 5) return 'cool';
  return null;
}
