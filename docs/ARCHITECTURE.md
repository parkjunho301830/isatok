# 이사탁(Isatok) 시스템 아키텍처 문서

> **문서 버전:** 2026-06-26  
> **대상 프로젝트:** `isatok-ef06a` (Firebase)  
> **운영 URL:** https://isatok.web.app  
> **분석 기준:** 저장소 소스 코드 정적 분석 (코드 수정 없음)

### 관련 문서

| 유형 | 링크 |
|------|------|
| **문서 인덱스** | [docs/README.md](./README.md) |
| **심화 (Deep Dive)** | [프론트엔드](./deep-dive/01-frontend-architecture.md) · [데이터](./deep-dive/02-data-model-and-flows.md) · [AI](./deep-dive/03-ai-integration.md) · [보안](./deep-dive/04-security-and-auth.md) |
| **다이어그램 (Mermaid)** | [diagrams/](./diagrams/README.md) — `.mmd` 10종 |

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [프론트엔드](#2-프론트엔드)
3. [백엔드 및 서버리스](#3-백엔드-및-서버리스)
4. [데이터베이스](#4-데이터베이스)
5. [AI 연동](#5-ai-연동)
6. [외부 연동](#6-외부-연동)
7. [인증 및 보안](#7-인증-및-보안)
8. [Hosting 및 배포](#8-hosting-및-배포)
9. [성능](#9-성능)
10. [전체 시스템 구조도](#10-전체-시스템-구조도)
11. [개선사항](#11-개선사항)
12. [기술 스택 전체 목록](#12-기술-스택-전체-목록)

---

## 1. 프로젝트 개요

### 1.1 서비스 설명

**이사탁**은 탁구 동호회(클럽) 운영을 위한 **Progressive Web App(PWA)** 입니다. 회원 관리, 대결(챌린지) 신청·수락·결과 등록, 랭킹·시즌제, 명예의 전당, AI 코칭 리포트, 카카오톡 공유 등의 기능을 제공합니다.

### 1.2 프로젝트 구조

```
isatok/
├── app.html              # 메인 SPA 셸 (프로덕션 앱)
├── index.html            # 레거시 리다이렉트 (카카오 인앱 브라우저 처리)
├── members.html          # 레거시 스캐폴드 (미사용)
├── tournament.html       # 레거시 스캐폴드 (미사용)
├── 404.html              # Firebase Hosting 404
├── manifest.json         # PWA 매니페스트
├── service-worker.js     # PWA Service Worker
├── version.json          # 배포 버전 메타데이터
├── firebase.json         # Firebase Hosting / Firestore / Functions 설정
├── .firebaserc           # Firebase 프로젝트 ID
├── firestore.rules       # Firestore 보안 규칙
├── css/                  # 스타일시트 (style, components, design)
├── js/
│   ├── app/              # 메인 앱 ES 모듈 (28개)
│   ├── firebase.js       # 레거시 Firebase 래퍼 (미완성)
│   ├── members.js        # 레거시
│   └── tournament.js     # 레거시
├── functions/            # Firebase Cloud Functions (Gemini AI 프록시)
├── gas/org-chart/        # Google Apps Script (회원 사진 API)
├── scripts/              # 배포·유지보수 스크립트
├── assets/               # favicon, OG 이미지
├── icons/                # PWA 아이콘 (192, 512)
└── .github/workflows/    # GitHub Actions CI/CD
```

### 1.3 사용 언어 및 프레임워크

| 구분 | 기술 |
|------|------|
| **프론트엔드** | HTML5, CSS3, Vanilla JavaScript (ES Modules) |
| **프레임워크** | 없음 (React/Vue/Angular 미사용) |
| **백엔드** | Firebase Cloud Functions (Node.js 24) |
| **데이터베이스** | Cloud Firestore (NoSQL) |
| **호스팅** | Firebase Hosting (Classic) |
| **AI** | Google Gemini API (`gemini-2.5-flash-lite`) |
| **빌드 도구** | 없음 (번들러 미사용, 네이티브 ES Module 직접 로드) |
| **패키지 관리** | `functions/` 디렉터리만 npm 사용 (루트 package.json 없음) |

### 1.4 폴더 구조 설명

| 폴더 | 역할 |
|------|------|
| `js/app/` | 앱 핵심 로직. `init*(ctx)` 패턴으로 의존성 주입, `appBootstrap.js`가 오케스트레이션 |
| `css/` | 레이아웃(`style.css`), 컴포넌트(`components.css`), 디자인 토큰(`design.css`) |
| `functions/` | Gemini API 프록시 HTTP 엔드포인트 5개 |
| `gas/org-chart/` | 조직도 회원 사진을 제공하는 Google Apps Script |
| `scripts/` | 배포 버전 bump, 랭킹 동기화, AI 벤치마크 등 운영 스크립트 |
| `.agents/skills/` | Firebase 관련 AI 에이전트 스킬 (앱 런타임과 무관) |

---

## 2. 프론트엔드

> **심화:** [deep-dive/01-frontend-architecture.md](./deep-dive/01-frontend-architecture.md) · **다이어그램:** [02-boot-sequence](./diagrams/02-boot-sequence.mmd), [06-module-dependencies](./diagrams/06-module-dependencies.mmd)

### 2.1 사용 기술

- **HTML:** 단일 페이지 `app.html`에 모든 탭·모달 UI 포함
- **CSS:** 3개 스타일시트, CSS 변수 기반 디자인 시스템
- **JavaScript:** ES Module (`type="module"`), `import`/`export` 기반 모듈화
- **캐시 무효화:** 모든 정적 리소스에 `?v=2026.06.26.10` 쿼리 스트링 (배포 시 자동 갱신)

### 2.2 주요 라이브러리 (CDN)

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| Firebase App + Firestore (modular) | 10.12.0 | DB 실시간 동기화 |
| Kakao JavaScript SDK | 2.7.2 | 챌린지 카카오톡 공유 |
| Google Fonts (Noto Sans KR, Bebas Neue) | — | 타이포그래피 |

### 2.3 화면 구성 방식

**Single Page Application (SPA)** 구조. `app.html` 내 `.page` div들이 탭별 화면을 담당하며, `display`/`class` 토글로 전환합니다.

| 페이지 ID | 탭 이름 | 주요 모듈 |
|-----------|---------|-----------|
| `page-challenge` | 대결 | `challenges.js`, `wizard.js` |
| `page-ranking` | 랭킹 | `rankingTab.js`, `seasons.js`, `matchStats.js` |
| `page-my` | MY | `myPage.js`, `weeklyReport.js`, `aiCoach.js` |
| `page-hall` | 명예의 전당 | `hallTab.js`, `hallReportCore.js` |
| `page-members` | 선수 | `membersTab.js`, `memberPhotos.js`, `memberCore.js` |
| `page-admin` | 관리자 | `adminTab.js` (관리자 전용) |

**UI 패턴:**
- 하단 네비게이션 바 (`.nav-i`)
- 바텀시트(Bottom Sheet) 기반 대결 신청 위저드
- 모달 다이얼로그 (`modals.js`)
- FAB(플로팅 버튼) — 대결 탭에서만 표시

### 2.4 라우팅 구조

클라이언트 사이드 라우팅 (`js/app/appNav.js`):

```
window.nav(pageId)  →  .page 요소 class 토글 + 해당 탭 render 함수 호출
```

**진입 URL 패턴:**

| 패턴 | 예시 | 동작 |
|------|------|------|
| 쿼리 파라미터 | `?p=ranking` | 랭킹 탭 진입 |
| 쿼리 + 필터 | `?p=challenge&filter=open` | 오픈 챌린지 필터 |
| 해시 라우팅 | `#members?ch=홍길동` | 선수 프로필 딥링크 |
| 매치 딥링크 | `?match=<challengeId>` | 특정 챌린지 하이라이트 |

Firebase Hosting rewrite: `**` → `/app.html` (모든 경로 SPA 폴백)

### 2.5 모듈 아키텍처

```
main.js
  └── appBootstrap.js (오케스트레이터)
        ├── firebaseApp.js    — Firestore 연결·스냅샷
        ├── appNav.js         — 탭 네비게이션
        ├── backNav.js        — history.pushState 뒤로가기
        ├── challenges.js     — 대결 CRUD·카카오 공유
        ├── wizard.js         — 대결 신청 위저드
        ├── membersTab.js     — 선수 목록·프로필·VCF
        ├── rankingTab.js     — 랭킹·시즌 포인트
        ├── hallTab.js        — 명예의 전당·월간 스토리
        ├── myPage.js         — MY 대시보드·AI 카드
        ├── adminTab.js       — 관리자 PIN·허브
        ├── seasons.js        — 시즌 관리
        ├── matchStats.js     — 전적·배지·포인트 계산
        ├── aiCoach.js        — AI API 호출·캐시
        ├── weeklyReport.js   — 주간 리포트 UI
        ├── coaching.js       — 규칙 기반 운세 (LLM 없음)
        ├── memberPhotos.js   — GAS 사진 API
        ├── pwa.js            — PWA·버전·SW
        ├── modals.js         — 모달 관리
        ├── noticesBoards.js  — 공지·게시판 CRUD
        ├── scrollBridge.js   — 스크롤 중 렌더 지연
        ├── appCore.js        — 유틸·토스트·DOM 헬퍼
        └── constants.js      — 전역 상수
```

---

## 3. 백엔드 및 서버리스

### 3.1 Firebase 사용 서비스

| 서비스 | 사용 여부 | 역할 |
|--------|-----------|------|
| **Firebase Hosting** | ✅ | 정적 파일·SPA 호스팅 (`isatok.web.app`) |
| **Cloud Firestore** | ✅ | 메인 데이터베이스 (회원, 대결, 시즌 등) |
| **Cloud Functions** | ✅ | Gemini AI API 프록시 (5개 HTTP 엔드포인트) |
| **Firebase Authentication** | ❌ | 미사용 (클라이언트 PIN + localStorage) |
| **Firebase Storage** | ❌ | 미사용 |
| **Firebase Realtime Database** | ❌ | 미사용 |
| **Firebase Remote Config** | ❌ | 미사용 |
| **Firebase Crashlytics** | ❌ | 미사용 |
| **Firebase App Hosting** | ❌ | Classic Hosting 사용 |

### 3.2 Cloud Functions 상세

- **런타임:** Node.js 24
- **리전:** `asia-northeast3` (서울)
- **최대 인스턴스:** 10
- **시크릿:** `GEMINI_API_KEY` (`defineSecret`)

| 엔드포인트 | HTTP | 용도 |
|-----------|------|------|
| `weeklyCoachReport` | POST | 주간 AI 코칭 리포트 |
| `postMatchComment` | POST | 경기 후 한 줄 코멘트 |
| `dailyBriefing` | POST | 데일리 브리핑 |
| `opponentAnalysis` | POST | 대결 전 상대 분석 |
| `monthlyClubStory` | POST | 월간 동호회 매거진 스토리 |

### 3.3 데이터 흐름

```
[브라우저]
    │
    ├─(실시간)─→ Firestore onSnapshot ─→ 인메모리 배열 (MEMBERS, CHAL, SEASONS, TOURNAMENTS)
    │                                      │
    │                                      └─→ requestAnimationFrame 디바운스 ─→ UI 렌더
    │
    ├─(CRUD)───→ Firestore addDoc / updateDoc / deleteDoc
    │              (notices, boards — 스냅샷 없이 직접 CRUD)
    │
    └─(AI)─────→ fetch POST ─→ Cloud Functions ─→ Gemini API
                                    │
                                    └─→ JSON 응답 ─→ localStorage 캐시 ─→ UI
```

**대결 완료 시 포인트 흐름:**
1. `challenges.js`에서 `status: 'completed'` 업데이트
2. `_updateMatchPoints()`가 관련 `members` 문서의 `individualPoint`/`doublePoint` 갱신
3. `onSnapshot`이 변경을 감지 → 랭킹·MY·명예의 전당 등 전 탭 재계산

---

## 4. 데이터베이스

> **심화:** [deep-dive/02-data-model-and-flows.md](./deep-dive/02-data-model-and-flows.md) · **다이어그램:** [05-er-diagram](./diagrams/05-er-diagram.mmd), [03-challenge-lifecycle](./diagrams/03-challenge-lifecycle.mmd), [04-challenge-result-flow](./diagrams/04-challenge-result-flow.mmd)

### 4.1 DB 종류

**Cloud Firestore** (NoSQL 문서 데이터베이스)

### 4.2 주요 컬렉션

#### `members` — 회원

```javascript
{
  name: string,           // 선수 이름 (고유 식별에 사용)
  phone: string,          // 연락처
  gender: '남성' | '여성',
  individualPoint: number,  // 단식 포인트 (초기 1000)
  doublePoint: number,      // 복식 포인트 (초기 1000)
  status: string,           // 예: '활성'
  memo: string,
  joined: string,           // 'YYYY.MM'
  createdAt: string         // ISO 8601
}
```

**실시간 리스너:** `orderBy('name')`

#### `challenges` — 대결

```javascript
{
  type: string,             // ms, md, fs, fd, mx, singles, doubles
  myTeam: string[],         // 내 팀 선수 이름 배열
  oppTeam: string[],
  date: string, time: string, place: string,
  bet: string, betPicks: object,
  isOpen: boolean,          // 오픈 챌린지 여부
  expiresAt: string,        // 오픈 챌린지 만료 (3일)
  gameMode: string,         // bo1, bo3, bo5, bo7
  status: 'pending' | 'accepted' | 'rejected' | 'completed',
  winner: 'a' | 'b',
  score: string,
  message: string,
  createdByPlayerId: string,
  createdByPlayerName: string,
  createdAt: string,
  acceptedAt: string,
  instantCreate: boolean    // 즉시 결과 등록 여부
}
```

**실시간 리스너:** `orderBy('createdAt', 'desc')`

#### `seasons` — 시즌

```javascript
{
  name: string,
  startDate: 'YYYY-MM-DD',
  endDate: 'YYYY-MM-DD' | null,
  status: 'active' | 'ended',
  isCurrent: boolean,
  champion: { name: string, ... } | null,
  createdAt: string
}
```

**실시간 리스너:** `orderBy('startDate', 'desc')`  
**보안:** 삭제 불가, 스키마 검증 (`isValidSeasonWrite`)

#### `tournaments` — 토너먼트 (레거시)

```javascript
{
  title, date, location, description,
  participants: string[]
}
```

**실시간 리스너:** 전체 컬렉션 (정렬 없음)

#### `notices` — 공지 (미완성 기능)

```javascript
{ type, title, body, createdAt }
```

**리스너 없음** — CRUD만 구현, 목록 UI 미연결

#### `boards` — 게시판 (미완성 기능)

```javascript
{ author, title, body, createdAt }
```

**리스너 없음** — CRUD만 구현, 목록 UI 미연결

### 4.3 컬렉션 간 관계

```
members ──(이름 참조)──→ challenges.myTeam / oppTeam
members ──(createdByPlayerId)──→ challenges
challenges ──(date 범위)──→ seasons (클라이언트 계산)
seasons.champion.name ──→ members
tournaments.participants[] ──→ members (레거시)
```

### 4.4 포인트·등급 체계

| 항목 | 값 |
|------|-----|
| 초기 포인트 | 1000 PT |
| 단식 승 | +10 PT |
| 단식 패 | -5 PT |
| 복식 승 | +5 PT |
| 복식 패 | -2 PT |

**등급 (individualPoint/doublePoint 기준):**

| 포인트 | 등급 |
|--------|------|
| 1500+ | 👑 마스터 |
| 1400+ | 💎 고수 |
| 1300+ | 🥇 상급 |
| 1200+ | 🥈 중급 |
| 1100+ | 🥉 초급 |
| 0+ | 🌱 입문 |

---

## 5. AI 연동

> **심화:** [deep-dive/03-ai-integration.md](./deep-dive/03-ai-integration.md) · **다이어그램:** [07-ai-integration](./diagrams/07-ai-integration.mmd)

### 5.1 연동 AI 서비스

| 서비스 | 모델 | 용도 |
|--------|------|------|
| **Google Gemini** | `gemini-2.5-flash-lite` | 모든 AI 기능 (Cloud Functions 경유) |
| OpenAI | — | 미사용 |
| Firebase AI Logic | — | 미사용 |

**규칙 기반 코칭** (`coaching.js`): LLM 없이 해시 시드·템플릿 기반 운세·추천 (AI API 호출 없음)

### 5.2 AI 기능별 사용 목적

| 기능 | 엔드포인트 | UI 위치 | 출력 형식 |
|------|-----------|---------|-----------|
| 주간 코칭 리포트 | `weeklyCoachReport` | MY 탭 | badge, weekTag, headline, highlight, story, nextMission |
| 경기 후 코멘트 | `postMatchComment` | 대결 결과 피드백 | emoji, comment (40자 이내) |
| 데일리 브리핑 | `dailyBriefing` | MY 탭 | badge, tag, headline, tip, pick |
| 상대 분석 | `opponentAnalysis` | 선수 프로필, MY 탭 | badge, headline, strategy, warning, winTip |
| 월간 동호회 스토리 | `monthlyClubStory` | 명예의 전당 | badge, headline, story, mvp, quote |

### 5.3 호출 방식

```
브라우저 (aiCoach.js)
  → fetch POST (JSON body: memberName, statsSummary 등)
  → Cloud Functions (asia-northeast3)
  → Gemini REST API (generativelanguage.googleapis.com)
  → JSON 파싱 (parseJsonResponse)
  → { ok: true, report|comment|briefing|analysis|story }
```

**클라이언트 호출 특성:**
- 타임아웃: 45초 (`AbortController`)
- 재시도: 최대 2회 (408/429/5xx)
- 인플라이트 중복 제거 (`_inflightAi` Map)
- `yieldToPaint()`로 UI 먼저 렌더링

### 5.4 프롬프트 관리 방식

- **위치:** `functions/index.js`에 하드코딩 (서버 전용)
- **형식:** 한국어 시스템 프롬프트 + JSON-only 출력 규칙 + 클라이언트가 조립한 `statsSummary`/`matchSummary`/`clubSummary` 문자열
- **클라이언트:** 통계 요약 문자열을 `matchStats.js` 등에서 조립하여 POST body로 전송
- **폴백:** JSON 파싱 실패 시 `parseJsonResponse()`가 원문 텍스트를 fallback 필드에 삽입

### 5.5 API Key 관리 방식

| 키 | 저장 위치 | 노출 |
|----|-----------|------|
| `GEMINI_API_KEY` | Firebase Functions Secret (`defineSecret`) | 서버만 접근 ✅ |
| Firebase Web Config | `js/app/firebaseApp.js` 하드코딩 | 클라이언트 노출 (정상) |
| `KAKAO_JS_KEY` | `js/app/version.js` | 클라이언트 노출 (JS SDK 정상 패턴) |
| `ADMIN_PIN` | `js/app/constants.js` | 클라이언트 노출 ⚠️ |

### 5.6 AI 응답 캐시

| 기능 | localStorage 키 패턴 | TTL |
|------|---------------------|-----|
| 주간 리포트 | `isatok_weekly_report_v2\|{name}\|{weekStart}` | 주 단위 |
| 데일리 브리핑 | `isatok_daily_briefing_v1\|{name}\|{date}` | 일 단위 |
| 경기 후 코멘트 | `isatok_post_match_v1\|{matchKey}` | 경기 단위 |
| 상대 분석 | `isatok_opponent_ai_v1\|{me}\|{opponent}` | 상대 단위 |
| 월간 스토리 | `isatok_monthly_story_v1\|{monthKey}` | 월 단위 |

메모리 `Map` + `localStorage` 이중 캐시

---

## 6. 외부 연동

### 6.1 Firebase 외 외부 API

| API | URL/서비스 | 용도 |
|-----|-----------|------|
| Google Generative Language API | `generativelanguage.googleapis.com` | Gemini AI (Functions 경유) |
| Google Apps Script Web App | `script.google.com/macros/s/.../exec` | 조직도 회원 사진 (`ORG_CHART_API_URL`) |
| Kakao JavaScript SDK | `t1.kakaocdn.net` | 챌린지 카카오톡 공유 |
| Google Fonts | `fonts.googleapis.com` | 웹 폰트 |

### 6.2 브라우저 API 사용 현황

| API | 사용처 | 용도 |
|-----|--------|------|
| `localStorage` | 전역 | 내 선수 ID, 관리자 세션, AI 캐시, PWA 설정 |
| `sessionStorage` | 딥링크, SW | 매치 딥링크, 카카오 intent 세션 |
| `navigator.serviceWorker` | `pwa.js` | SW 등록·업데이트 |
| `navigator.share` | `challenges.js` | Web Share API (챌린지 공유) |
| `navigator.clipboard` | `challenges.js` | 공유 텍스트 복사 |
| `history.pushState` | `backNav.js` | 뒤로가기 스택 |
| `Intl.DateTimeFormat` | 다수 | KST 날짜 처리 |
| `requestAnimationFrame` | `firebaseApp.js`, `aiCoach.js` | 렌더 디바운스 |
| `AbortController` | `aiCoach.js` | AI 요청 타임아웃 |
| `Blob` + `<a download>` | `membersTab.js` | VCF 파일 다운로드 |
| `matchMedia` | `pwa.js` | standalone 모드 감지 |
| `tel:` 링크 | `membersTab.js` | 전화 걸기 |

### 6.3 PWA 관련 기능

| 항목 | 구현 |
|------|------|
| `manifest.json` | standalone, portrait, theme_color `#007AFF` |
| Service Worker | 등록·버전 갱신·`skipWaiting` (오프라인 캐시 **없음**) |
| 설치 프롬프트 | iOS Safari / Android Chrome 안내 배너 |
| Apple 메타 태그 | `apple-mobile-web-app-capable`, touch icon |
| 버전 체크 | `version.json` fetch → 불일치 시 자동 reload |

### 6.4 알림 (Notification)

**미구현.** Push Notification API, `Notification` API 사용 없음.

### 6.5 연락처 (.vcf)

- **함수:** `exportMembersVcf()` (`membersTab.js`)
- **접근:** 관리자 허브 → "연락처보내기"
- **형식:** vCard 3.0 (`FN`, `TEL`, `NOTE`)
- **다운로드:** `Blob` → `이사탁_선수연락처_YYYYMMDD.vcf`

### 6.6 Excel 다운로드

**미구현.** XLSX/SheetJS 등 Excel 관련 라이브러리 없음.

### 6.7 카카오톡 연동

- **SDK 초기화:** `Kakao.init(KAKAO_JS_KEY)` (`challenges.js`)
- **공유:** Kakao.Share 피드 템플릿 + 클립보드/Web Share 폴백
- **인앱 브라우저 처리:**
  - Android: `intent://` 스킴으로 외부 브라우저 유도
  - iOS: 가이드 오버레이 ("기본 브라우저로 열기" 안내)
  - `index.html`, `app.html` head 인라인 스크립트에서 선처리

### 6.8 기타 외부 라이브러리

프로덕션 앱은 **npm 번들 없이** CDN + ES Module만 사용. `functions/`만 npm 의존성 보유.

---

## 7. 인증 및 보안

> **심화:** [deep-dive/04-security-and-auth.md](./deep-dive/04-security-and-auth.md) · **다이어그램:** [10-security-model](./diagrams/10-security-model.mmd)

### 7.1 로그인 방식

| 메커니즘 | 구현 | 저장 |
|----------|------|------|
| Firebase Authentication | **미사용** | — |
| "내 선수" 선택 | `wizard.js` — 회원 목록에서 본인 선택 | `localStorage`: `isatok_myPlayerId`, `isatok_myPlayerName` |
| 관리자 PIN | 4자리 PIN 입력 (`2580`) | `localStorage`: `isatok_admin` = `'1'` |

### 7.2 권한 관리

**클라이언트 사이드만** 권한 제어:

| 기능 | 일반 사용자 | 관리자 |
|------|------------|--------|
| 대결 신청·수락 | ✅ | ✅ |
| 결과 등록 | ✅ (본인 관련) | ✅ |
| 회원 추가·수정·삭제 | ❌ (UI 숨김) | ✅ |
| 시즌 생성·종료 | ❌ | ✅ |
| 결과 수정·삭제 | ❌ | ✅ |
| VCF 연락처보내기 | ❌ | ✅ |
| 관리자 허브 | ❌ | ✅ |

`document.documentElement.classList.toggle('is-admin')`로 CSS 기반 UI 제어

### 7.3 관리자 기능

`adminTab.js` — 관리자 허브 메뉴:
- 회원 관리 (추가·수정)
- 시즌 관리
- 결과 수정·삭제
- 연락처 VCF보내기
- 통계 새로고침

### 7.4 보안 처리 방식

**Firestore Rules (`firestore.rules`):**

```
members, challenges, tournaments, notices, boards → read, write: if true (완전 개방)
seasons → read: true / write: 스키마 검증 / delete: false
```

**보안 특성:**
- ✅ Gemini API Key는 서버 시크릿으로 보호
- ⚠️ Firestore 전 컬렉션 무인증 read/write — 누구나 데이터 변경 가능
- ⚠️ 관리자 PIN이 클라이언트 소스에 노출
- ⚠️ Firebase Storage 미사용, Storage Rules 없음
- ℹ️ 클럽 내부 신뢰 모델로 설계됨 (rules 주석: "클럽 내부 운영용")

---

## 8. Hosting 및 배포

> **다이어그램:** [08-deployment-pipeline](./diagrams/08-deployment-pipeline.mmd), [09-pwa-version-update](./diagrams/09-pwa-version-update.mmd)

### 8.1 Hosting 환경

| 항목 | 값 |
|------|-----|
| 플랫폼 | Firebase Hosting (Classic) |
| 사이트 ID | `isatok` |
| 프로젝트 ID | `isatok-ef06a` |
| 운영 URL | https://isatok.web.app |
| Auth 도메인 | `isatok-ef06a.firebaseapp.com` |
| Public 디렉터리 | `.` (저장소 루트) |
| SPA Fallback | `**` → `/app.html` |

### 8.2 배포 방식

**자동 (GitHub Actions):**

```
push to main
  → node scripts/prepare-deploy.mjs  (버전 bump, 캐시 bust)
  → FirebaseExtended/action-hosting-deploy@v0
  → git commit "chore: bump deploy version [skip ci]" + push
```

**수동:**
- Hosting: `firebase deploy --only hosting`
- Firestore Rules: `firebase deploy --only firestore:rules`
- Functions: `firebase deploy --only functions` (**CI 미포함**)

### 8.3 GitHub 연동

| 항목 | 상태 |
|------|------|
| CI/CD | `.github/workflows/firebase-hosting.yml` |
| 트리거 | `main` 브랜치 push, `workflow_dispatch` |
| 시크릿 | `FIREBASE_SERVICE_ACCOUNT` |
| Functions 자동 배포 | ❌ 수동 배포 필요 |

### 8.4 Firebase Hosting 설정

- **캐시 정책:** HTML/JS/CSS/SW/manifest → `no-cache, no-store, must-revalidate`
- **배포 제외:** `index.html`, `404.html`, `firestore.rules`, `.git/**`, `node_modules/**`
- **Service-Worker-Allowed:** `/` (루트 스코프)

### 8.5 도메인 구성

| 도메인 | 역할 |
|--------|------|
| `isatok.web.app` | 프로덕션 (PWA, 카카오 OG) |
| `isatok-ef06a.firebaseapp.com` | Firebase 기본 도메인 |
| `index.html` (비배포) | 레거시 URL → `isatok.web.app` 리다이렉트 |

### 8.6 버전 관리

`scripts/prepare-deploy.mjs`가 배포 전 자동 갱신:
- `js/app/version.js` — `APP_VERSION`, `BUILD_TIME`
- `version.json` — `appVersion`, `swVersion`
- `service-worker.js` — `SW_VERSION`
- `manifest.json`, `app.html`, `main.js` — `?v=` 쿼리 스트링

---

## 9. 성능

### 9.1 캐싱 방식

| 계층 | 방식 | 대상 |
|------|------|------|
| HTTP 헤더 | `no-cache` | 모든 정적 리소스 (항상 최신) |
| Service Worker | pass-through (`cache: 'no-store'`) | 오프라인 캐시 없음 |
| localStorage | 키-값 JSON | AI 응답, 회원 사진, 랭킹 스냅샷 |
| 인메모리 Map | `_memCache`, `_inflightAi` | AI 중복 요청 방지 |
| 회원 사진 | 6시간 TTL | GAS API 응답 |
| 랭킹 스냅샷 | 1일 1회 | `isatok_rank_snapshot` |

### 9.2 실시간 데이터 처리

**4개 Firestore `onSnapshot` 리스너** (`firebaseApp.js`):

1. `members` — `orderBy('name')`
2. `challenges` — `orderBy('createdAt', 'desc')`
3. `seasons` — `orderBy('startDate', 'desc')`
4. `tournaments` — 전체

**렌더 최적화:**
- `requestAnimationFrame` 디바운스 (스냅샷 → UI)
- `scrollBridge.js` — 스크롤 중 120ms 렌더 지연
- `challenges.js` — 챌린지 목록 해시 diff로 불필요한 DOM 갱신 방지

### 9.3 AI 응답 최적화

- 인플라이트 요청 dedup (동일 URL+body 동시 호출 1회로 합침)
- localStorage 영구 캐시 (일/주/월 단위)
- `yieldToPaint()` — 로딩 UI 선 렌더링
- 재시도 with exponential backoff (800ms, 2000ms)
- Gemini `maxOutputTokens: 512`, `temperature: 0.7`

### 9.4 병목이 발생하는 부분

| 병목 | 원인 | 영향 |
|------|------|------|
| 전체 컬렉션 로드 | 페이지네이션 없음 | 회원·대결 증가 시 초기 로드·스냅샷 비용 증가 |
| `challenges` 리스너 | 가장 빈번한 변경 | 전 탭 연쇄 재렌더 |
| 대결 완료 시 포인트 갱신 | 선수별 `updateDoc` 다수 | Firestore 쓰기 비용·경합 |
| AI 호출 | 45초 타임아웃, Gemini 지연 | MY·명예의 전당 UI 대기 |
| GAS 사진 API | 외부 의존, 콜드 캐시 | 선수 탭 아바타 로딩 지연 |
| 앱 부트스트랩 | `ensureLatestVersion()` 8초 fallback | 첫 진입 지연 가능 |
| SW no-cache 정책 | 매 요청 네트워크 | 오프라인 불가, 대역폭 사용 |

---

## 10. 전체 시스템 구조도

Mermaid 소스는 [`docs/diagrams/`](./diagrams/README.md)에 `.mmd` 파일로 분리되어 있습니다. GitHub·VS Code(Mermaid 확장)·[Mermaid Live Editor](https://mermaid.live)에서 렌더링할 수 있습니다.

| 다이어그램 | 파일 | 설명 |
|-----------|------|------|
| 시스템 전체 | [01-system-overview.mmd](./diagrams/01-system-overview.mmd) | 클라이언트·Firebase·외부 서비스 |
| 앱 부트 | [02-boot-sequence.mmd](./diagrams/02-boot-sequence.mmd) | startApp → Firebase init |
| 대결 상태 | [03-challenge-lifecycle.mmd](./diagrams/03-challenge-lifecycle.mmd) | pending → completed |
| 결과·포인트 | [04-challenge-result-flow.mmd](./diagrams/04-challenge-result-flow.mmd) | submitResult + AI |
| ER | [05-er-diagram.mmd](./diagrams/05-er-diagram.mmd) | Firestore 컬렉션 관계 |
| 모듈 의존성 | [06-module-dependencies.mmd](./diagrams/06-module-dependencies.mmd) | ES Module 그래프 |
| AI | [07-ai-integration.mmd](./diagrams/07-ai-integration.mmd) | Functions 프록시·캐시 |
| 배포 | [08-deployment-pipeline.mmd](./diagrams/08-deployment-pipeline.mmd) | GitHub Actions |
| PWA 버전 | [09-pwa-version-update.mmd](./diagrams/09-pwa-version-update.mmd) | SW·version.json |
| 보안 | [10-security-model.mmd](./diagrams/10-security-model.mmd) | Auth·Rules |

### 10.1 계층 구조 (텍스트)

```
사용자 (모바일/PC 브라우저, PWA)
        ↓
웹 앱 (PWA — app.html + ES Modules)
        ↓
Firebase Hosting (isatok.web.app, SPA rewrite)
        ↓
JavaScript 클라이언트
   ├── Firestore SDK (실시간 동기화)
   ├── localStorage/sessionStorage (상태·캐시)
   ├── Kakao SDK (공유)
   └── fetch API (AI, 사진, 버전)
        ↓
┌───────────────────────────────────────────────┐
│              Firebase 백엔드                    │
│  ┌─────────────┐    ┌──────────────────────┐  │
│  │  Firestore  │    │  Cloud Functions      │  │
│  │  (DB)       │    │  (asia-northeast3)    │  │
│  │             │    │  GEMINI_API_KEY       │  │
│  └─────────────┘    └──────────┬───────────┘  │
└────────────────────────────────│──────────────┘
                                 ↓
                          Gemini API
                          (generativelanguage.googleapis.com)
                                 ↓
┌────────────────────────────────────────────────┐
│              외부 서비스                          │
│  • Google Apps Script (회원 사진)                │
│  • Kakao Platform (공유)                        │
│  • Google Fonts                                 │
└────────────────────────────────────────────────┘
```

### 10.2 시스템 전체 (Mermaid)

→ [`diagrams/01-system-overview.mmd`](./diagrams/01-system-overview.mmd)

### 10.3 대결 결과·AI 흐름 (Mermaid)

→ [`diagrams/04-challenge-result-flow.mmd`](./diagrams/04-challenge-result-flow.mmd)

---

## 11. 개선사항

### 11.1 장점

| 항목 | 설명 |
|------|------|
| **단순한 스택** | 프레임워크 없이 Vanilla JS — 학습·디버깅 용이, 번들러 불필요 |
| **실시간 동기화** | Firestore `onSnapshot`으로 다수 사용자 간 즉시 데이터 반영 |
| **모듈화** | 28개 ES Module, `init*(ctx)` DI 패턴으로 관심사 분리 |
| **AI 보안** | Gemini API Key를 Cloud Functions Secret으로 보호 |
| **AI 캐시** | localStorage + inflight dedup으로 비용·지연 절감 |
| **PWA** | 홈 화면 설치, standalone 모드, 버전 자동 갱신 |
| **카카오 대응** | 인앱 브라우저 intent/가이드로 실사용 UX 개선 |
| **CI/CD** | GitHub Actions 자동 Hosting 배포 + 버전 bump |
| **캐시 무효화** | 배포 시 자동 `?v=` 갱신으로 캐시 문제 방지 |

### 11.2 단점

| 항목 | 설명 |
|------|------|
| **보안 취약** | Firestore 무인증 read/write, 관리자 PIN 클라이언트 노출 |
| **인증 부재** | Firebase Auth 미사용 — 실제 사용자 식별 불가 |
| **페이지네이션 없음** | 전체 컬렉션 로드 — 데이터 증가 시 성능 저하 |
| **Functions CI 미포함** | AI Functions 수동 배포 — Hosting과 버전 불일치 가능 |
| **미완성 기능** | notices/boards CRUD만 있고 UI·리스너 없음 |
| **레거시 코드** | `members.html`, `tournament.html`, `js/firebase.js` 잔존 |
| **오프라인 미지원** | SW가 pass-through만 — 네트워크 필수 |
| **Excel 미지원** | 데이터보내기 VCF만 가능 |
| **단일 리전 의존** | Functions `asia-northeast3`만 — 글로벌 장애 시 AI 전면 중단 |

### 11.3 향후 개선 가능한 부분

1. **Firebase Authentication 도입** — 이메일/전화번호 또는 커스텀 토큰으로 실제 사용자 인증
2. **Firestore Rules 강화** — 인증 기반 read/write, 관리자 커스텀 클레임
3. **관리자 PIN 서버 검증** — Cloud Functions에서 PIN 확인 후 커스텀 토큰 발급
4. **페이지네이션** — challenges 컬렉션 `limit` + 커서 기반 로드
5. **notices/boards UI 완성** — 스냅샷 리스너 + 목록 DOM 연결
6. **Functions CI/CD** — GitHub Actions에 Functions 배포 단계 추가
7. **Excel보내기** — SheetJS 등으로 랭킹·전적 리포트
8. **레거시 파일 정리** — `members.html`, `js/firebase.js` 제거 또는 통합
9. **오프라인 기본 UI** — SW에 shell 캐시 추가 (데이터는 여전히 온라인)
10. **Push Notification** — FCM으로 대결 수락·결과 알림

### 11.4 확장성을 위한 제안

| 방향 | 제안 |
|------|------|
| **멀티 클럽** | `clubs/{clubId}/members` 서브컬렉션 + Auth 기반 클럽 선택 |
| **모바일 앱** | Capacitor/React Native로 PWA 래핑 또는 Flutter 전환 |
| **실시간 채팅** | Firestore `messages` 서브컬렉션 + onSnapshot |
| **통계 대시보드** | BigQuery Export + Looker Studio |
| **AI 고도화** | Firebase AI Logic SDK, 스트리밍 응답, 대화형 코치 |
| **이벤트 아키텍처** | Cloud Functions Firestore Triggers로 포인트 갱신 서버화 |
| **모니터링** | Firebase Performance Monitoring, Crashlytics 도입 |
| **테스트** | Playwright E2E, Functions 단위 테스트 |

---

## 12. 기술 스택 전체 목록

### 12.1 언어·런타임

| 항목 | 버전/상세 |
|------|-----------|
| JavaScript (ES Modules) | ES2020+ (브라우저 네이티브) |
| HTML5 | SPA |
| CSS3 | Custom Properties |
| Node.js | 24 (Cloud Functions) |

### 12.2 프론트엔드 SDK·라이브러리

| 이름 | 버전 | 로드 방식 | 용도 |
|------|------|-----------|------|
| Firebase App (modular) | 10.12.0 | CDN import | 앱 초기화 |
| Firebase Firestore (modular) | 10.12.0 | CDN import | DB |
| Kakao JavaScript SDK | 2.7.2 | `<script>` CDN | 공유 |
| Google Fonts: Noto Sans KR | — | CDN link | 본문 폰트 |
| Google Fonts: Bebas Neue | — | CDN link | 디스플레이 폰트 |

### 12.3 백엔드 (Cloud Functions) npm 의존성

| 패키지 | 버전 |
|--------|------|
| `firebase-functions` | ^7.0.0 |
| `firebase-admin` | ^13.6.0 |
| `eslint` | ^8.15.0 (dev) |
| `eslint-config-google` | ^0.14.0 (dev) |
| `firebase-functions-test` | ^3.4.1 (dev) |

### 12.4 Firebase 서비스

| 서비스 | 프로젝트/사이트 |
|--------|----------------|
| Hosting | site: `isatok`, project: `isatok-ef06a` |
| Firestore | default database |
| Cloud Functions | region: `asia-northeast3` |
| Functions Secrets | `GEMINI_API_KEY` |

### 12.5 외부 API·서비스

| 서비스 | 엔드포인트/식별자 |
|--------|------------------|
| Google Gemini API | `generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent` |
| Google Apps Script | `ORG_CHART_API_URL` (constants.js) |
| Kakao Platform | App JS Key: `KAKAO_JS_KEY` (version.js) |
| GitHub Actions | `FirebaseExtended/action-hosting-deploy@v0` |

### 12.6 브라우저 API

`localStorage`, `sessionStorage`, `navigator.serviceWorker`, `navigator.share`, `navigator.clipboard`, `history.pushState`, `Intl.DateTimeFormat`, `requestAnimationFrame`, `AbortController`, `Blob`, `URL`, `matchMedia`, `fetch`

### 12.7 운영·개발 도구 (scripts/)

| 스크립트 | 용도 |
|----------|------|
| `prepare-deploy.mjs` | 배포 버전 자동 bump |
| `sync-ranking-points.mjs` | 랭킹 포인트 동기화 |
| `reset-ranking.mjs` | 랭킹 초기화 |
| `import-member-phones.mjs` | 회원 전화번호 일괄 import |
| `bench-ai-perf.mjs` | AI 응답 지연 벤치마크 |
| `generate-pwa-icons.mjs` | PWA 아이콘 생성 |
| `extract-challenges.js` | 챌린지 데이터 추출 |
| `fix-challenges.js` | 챌린지 데이터 수정 |
| `check-exports.mjs` | export 검증 |
| `check-dup-decls.mjs` | 중복 선언 검사 |
| `probe-app.mjs` | 앱 프로브 |

### 12.8 기술 스택 한눈에 보기

```
┌─────────────────────────────────────────────────────────┐
│                    이사탁 기술 스택                        │
├─────────────────────────────────────────────────────────┤
│ Frontend    │ HTML5 · CSS3 · Vanilla JS (ESM) · PWA     │
│ UI Pattern  │ SPA · Bottom Sheet · Modal · Tab Nav       │
│ Firebase    │ Hosting · Firestore · Cloud Functions      │
│ AI          │ Gemini 2.5 Flash Lite (via Functions)      │
│ Share       │ Kakao JS SDK · Web Share API               │
│ Photos      │ Google Apps Script                         │
│ Auth        │ localStorage (PIN + Player ID)             │
│ CI/CD       │ GitHub Actions → Firebase Hosting          │
│ Fonts       │ Google Fonts (Noto Sans KR, Bebas Neue)    │
│ Build       │ None (no bundler)                          │
│ Test        │ Manual + bench scripts                     │
└─────────────────────────────────────────────────────────┘
```

---

*본 문서는 2026-06-26 기준 저장소 소스 코드 정적 분석 결과입니다. 운영 환경(Firebase 콘솔 설정, 커스텀 도메인, Functions 시크릿 등)은 콘솔에서 별도 확인이 필요할 수 있습니다.*
