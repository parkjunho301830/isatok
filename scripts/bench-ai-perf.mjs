/**
 * AI 클라이언트·API 성능 벤치마크
 * 사용: node scripts/bench-ai-perf.mjs [--api]
 */
const AI_FN_BASE = 'https://asia-northeast3-isatok-ef06a.cloudfunctions.net';

function ms(start) {
  return Math.round(performance.now() - start);
}

function benchMemCache(iterations) {
  const mem = new Map();
  const payload = JSON.stringify({ briefing: { headline: 'test', tip: 'tip', pick: 'pick' } });
  const key = 'isatok_daily_briefing_v1|player|2026-06-26';

  let t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    if (!mem.has(key)) mem.set(key, JSON.parse(payload));
    mem.get(key);
  }
  const memMs = ms(t0);

  t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    JSON.parse(payload);
  }
  const parseMs = ms(t0);

  return { memMs, parseMs, iterations };
}

async function benchApi(endpoint, body) {
  const url = AI_FN_BASE + endpoint;
  const t0 = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const elapsed = ms(t0);
  const data = await res.json().catch(() => ({}));
  return { elapsed, ok: res.ok && data.ok, status: res.status };
}

const iterations = 5000;
const cache = benchMemCache(iterations);
console.log('=== AI 클라이언트 캐시 벤치 (Node) ===');
console.log(`반복 ${iterations}회`);
console.log(`메모리 캐시 hit: ${cache.memMs}ms (평균 ${(cache.memMs / iterations).toFixed(3)}ms/회)`);
console.log(`JSON.parse 매회: ${cache.parseMs}ms (평균 ${(cache.parseMs / iterations).toFixed(3)}ms/회)`);
console.log(`예상 개선: 캐시 재조회 ~${Math.round((1 - cache.memMs / cache.parseMs) * 100)}% 빠름`);

if (process.argv.includes('--api')) {
  console.log('\n=== AI API 응답 시간 (실네트워크) ===');
  const sample = {
    memberName: '벤치',
    statsSummary: '단식: 3승 2패, 승률 60%, 랭킹: 5위'
  };
  const endpoints = [
    ['/dailyBriefing', sample],
    ['/weeklyCoachReport', sample],
    ['/postMatchComment', { memberName: '벤치', matchSummary: '복식 승리, 스코어 3-1' }],
    ['/opponentAnalysis', { memberName: '벤치', opponentName: '상대', statsSummary: sample.statsSummary }],
    ['/monthlyClubStory', { monthLabel: '2026년 6월', clubSummary: '완료 경기 12건' }]
  ];
  for (const [path, body] of endpoints) {
    try {
      const r = await benchApi(path, body);
      console.log(`${path}: ${r.elapsed}ms (${r.ok ? 'ok' : 'fail ' + r.status})`);
    } catch (e) {
      console.log(`${path}: error ${e.message}`);
    }
  }
}
