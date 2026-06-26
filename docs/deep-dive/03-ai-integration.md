# 심화: AI 연동

> 관련: [ARCHITECTURE.md §5](../ARCHITECTURE.md#5-ai-연동) · [07-ai-integration.mmd](../diagrams/07-ai-integration.mmd)

---

## 1. 아키텍처 개요

이사탁의 AI는 **2계층**으로 구성됩니다.

| 계층 | 모듈 | LLM 사용 |
|------|------|----------|
| **규칙 기반** | `coaching.js` | ❌ 템플릿 + 해시 시드 |
| **Gemini LLM** | `aiCoach.js` + Cloud Functions | ✅ |

**원칙:** API Key는 **절대 클라이언트에 두지 않음**. 브라우저 → Cloud Functions → Gemini.

---

## 2. Cloud Functions (`functions/index.js`)

### 2.1 공통 인프라

```javascript
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.5-flash-lite";
setGlobalOptions({ maxInstances: 10, region: "asia-northeast3" });
```

| 설정 | 값 |
|------|-----|
| API | `generativelanguage.googleapis.com/v1beta/models/...:generateContent` |
| maxOutputTokens | 512 |
| temperature | 0.7 |
| CORS | `cors: true` (onRequest v2) |
| Method | POST only |

### 2.2 aiHandler 래퍼

모든 export가 `aiHandler(handler)`로 감싸짐:

1. POST 검증
2. `geminiApiKey.value()` 주입
3. try/catch → `{ error: 'ai_failed' }` 500

### 2.3 엔드포인트 상세

#### weeklyCoachReport

| Input | `memberName`, `statsSummary` |
| Output | `{ ok, report: { badge, weekTag, headline, highlight, story, nextMission } }` |
| UI | MY 탭, `weeklyReport.js` |

#### postMatchComment

| Input | `memberName`, `matchSummary` |
| Output | `{ ok, comment: { emoji, comment } }` |
| UI | 대결 결과 피드백, `myPage._buildPostMatchCoachComment` |

#### dailyBriefing

| Input | `memberName`, `statsSummary` |
| Output | `{ ok, briefing: { badge, tag, headline, tip, pick } }` |
| UI | MY 탭 데일리 카드 |

#### opponentAnalysis

| Input | `memberName`, `opponentName`, `statsSummary` |
| Output | `{ ok, analysis: { badge, headline, strategy, warning, winTip } }` |
| UI | 선수 프로필, MY 상대 분석 |

#### monthlyClubStory

| Input | `monthLabel`, `clubSummary` |
| Output | `{ ok, story: { badge, headline, story, mvp, quote } }` |
| UI | 명예의 전당, `hallTab.js` |

### 2.4 JSON 파싱 (`parseJsonResponse`)

```javascript
JSON.parse(raw.replace(/```json|```/g, "").trim())
// 실패 시 fallback 객체 (raw 텍스트를 story/comment 등에 삽입)
```

Gemini가 마크다운 코드블록을 붙여도 동작하도록 방어합니다.

---

## 3. 클라이언트 AI 레이어 (`aiCoach.js`)

### 3.1 postAi() — 핵심 fetch

```
1. _aiRequestKey(url, body) → inflight Map 조회
2. AbortController 45초 타임아웃
3. 실패 시 최대 2회 재시도 (408, 429, 5xx)
4. 재시도 간격: 800ms, 2000ms
5. { ok: true, ... } 검증
```

### 3.2 캐시 아키텍처

```
요청 → cacheGet(prefix, key)
         ↓ miss
       postAi() → cacheSet(prefix, key, result)
```

| 계층 | 구조 |
|------|------|
| `_memCache` | Map, 세션 내 빠른 조회 |
| `localStorage` | JSON.stringify, quota 초과 시 무시 |

### 3.3 캐시 키 설계

| 기능 | Prefix | Key 구성 | TTL 논리 |
|------|--------|----------|----------|
| 주간 리포트 | `isatok_weekly_report_v2` | `{name}\|{weekStart}` | KST 월요일 기준 주 |
| 데일리 | `isatok_daily_briefing_v1` | `{name}\|{dateKey}` | KST 일 |
| 경기 후 | `isatok_post_match_v1` | `{matchKey}` | 경기 ID 기반 |
| 상대 분석 | `isatok_opponent_ai_v1` | `{me}\|{opponent}` | 상대 변경 전까지 |
| 월간 스토리 | `isatok_monthly_story_v1` | `{YYYY-MM}` | 월 |

**수동 새로고침:** `showAiCardRefreshOverlay()` — 기존 콘텐츠 유지 + 오버레이 로딩

---

## 4. statsSummary 조립 (클라이언트)

Functions에는 **요약 문자열만** 전달합니다. 조립은 각 UI 모듈에서 수행.

### 4.1 typical statsSummary 내용

- 선수 이름, 등급, 포인트
- 최근 N경기 전적 (승/패)
- 연승/연패
- 상대 전적 (opponentAnalysis)
- 동호회 전체 경기 수, MVP 후보 (monthlyClubStory)

### 4.2 주간 리포트 (`weeklyReport.js`)

```javascript
getKstWeekStartKey()  // KST 월요일 YYYY-MM-DD
formatWeekLabel()     // "MM/DD ~ MM/DD"
cacheKey(name, weekKey)
requestAiJson(WEEKLY_COACH_REPORT_URL, { memberName, statsSummary })
normalizeWeeklyReport(raw)
```

---

## 5. 규칙 기반 코칭 (`coaching.js`)

LLM 없이 **결정론적** 운세·추천:

| 함수 | 로직 |
|------|------|
| `coachHashSeed(str)` | 문자열 → 정수 시드 |
| `buildTodayFortune(ctx)` | 시드 + 요일 + streak → FORTUNE_TEMPLATES 선택 |
| `buildRecommendReason(ctx)` | PT 차이, 전적 기반 추천 문구 |
| `kstDateKey()` | KST `YYYY-MM-DD` |

**용도:** AI 호출 전/실패 시 fallback, MY 탭 "오늘의 운세" 카드

---

## 6. UI 하이드레이션 흐름

### 6.1 MY 탭 (`myPage.js`)

```
renderMyPage()
  → _hydrateMyDailyBriefing(force?)
  → _hydrateMyWeeklyReport(force?)
  → _hydrateMyAiCards()
  → _hydrateOpponentAnalysis(...)
```

각 `_hydrate*` 함수:

1. DOM placeholder 표시 (`data-state="loading"`)
2. `yieldToPaint()` — 로딩 UI 먼저 그리기
3. cache hit → 즉시 render
4. cache miss → `fetch*` → render → cacheSet

### 6.2 경기 후 코멘트

```
submitResult 성공
  → _buildPostMatchCoachComment(challenge, myName)
  → loadPostMatchCache(matchKey) || fetchPostMatchComment
  → showResultFeedback(emoji, comment, pointDelta)
```

비동기 — 결과 토스트는 AI 완료를 기다리지 않고 먼저 표시할 수 있음 (구현 확인: showResultFeedback 내부)

---

## 7. 비용·성능 고려

| 항목 | 현재 대응 |
|------|-----------|
| 중복 호출 | inflight dedup |
| Gemini 비용 | localStorage 캐시, 512 token limit |
| cold start | Functions maxInstances 10, asia-northeast3 |
| UX 지연 | 45s timeout, retry, overlay loading |
| 벤치마크 | `scripts/bench-ai-perf.mjs` |

---

## 8. Functions 배포 (수동)

```bash
cd functions
firebase deploy --only functions
# GEMINI_API_KEY 시크릿 사전 설정 필요:
# firebase functions:secrets:set GEMINI_API_KEY
```

**CI 미포함** — Hosting과 Functions 버전이 diverge할 수 있음.

---

## 9. 확장 시 고려사항

| 방향 | 제안 |
|------|------|
| 프롬프트 버전 관리 | Firestore `prompts/` 컬렉션 또는 Remote Config |
| 스트리밍 | Gemini stream API + SSE Functions |
| Firebase AI Logic | 클라이언트 SDK + App Check (키 노출 구조 변경) |
| Rate limiting | Functions에서 uid/IP 기반 throttle |
| 구조화 출력 | Gemini `responseSchema` / JSON mode |

---

*다음: [04-security-and-auth.md](./04-security-and-auth.md)*
