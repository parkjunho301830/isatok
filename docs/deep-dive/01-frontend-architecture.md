# 심화: 프론트엔드 아키텍처

> 관련: [ARCHITECTURE.md §2](../ARCHITECTURE.md#2-프론트엔드) · [02-boot-sequence.mmd](../diagrams/02-boot-sequence.mmd) · [06-module-dependencies.mmd](../diagrams/06-module-dependencies.mmd)

---

## 1. 앱 진입점과 부트스트랩

### 1.1 로드 순서

```
app.html
  ├── (head) pwa.js (module) — SW 등록 선행
  ├── (head) Kakao SDK, CSS, Fonts
  └── (body) main.js (module)
        └── appBootstrap.startApp()
```

`main.js`는 9줄짜리 엔트리로, 모든 로직은 `appBootstrap.js`에 위임합니다.

### 1.2 startApp() — 이중 트리거

```javascript
// appBootstrap.js
export function startApp() {
  setTimeout(bootOnce, 8000);           // 최대 8초 후 강제 부트
  ensureLatestVersion()
    .catch(() => null)
    .then(bootOnce);                    // 버전 확인 완료 후 부트
}
```

| 트리거 | 목적 |
|--------|------|
| `ensureLatestVersion()` | `version.json`과 localStorage 비교 → 불일치 시 SW 교체 + reload |
| 8초 타임아웃 | 버전 fetch 실패·지연 시에도 앱 사용 가능 |

**설계 의도:** 배포 직후 구버전 JS가 남아 있지 않도록 버전 확인을 **Firebase 연결보다 먼저** 수행합니다.

### 1.3 bootApp() → finish()

`bootApp()`은 다음 순서로 실행됩니다.

1. `initAppCore()` — DOM 헬퍼(`g`, `toast`), 버전 UI
2. `wireScrollBridge()` — 스크롤 디바운스 리스너 등록
3. `initFirebase(hooks)` — Firestore 4개 `onSnapshot` 등록
4. 첫 스냅샷 수신 후 `hooks.onReady()` → **`finish()`**

`finish()`에서 **모든 탭 모듈의 `init*()`** 을 한 번에 호출하고, `#ls`(로딩)를 숨기고 `#app`을 표시합니다.

---

## 2. 의존성 주입 (ctx) 패턴

프레임워스 없이 **수동 DI**를 사용합니다.

```javascript
// appBootstrap.js — ctx 객체 조립 예
initChallenges({
  g, toast, getDb, getMembers, getChal,
  isAdmin, requireAdmin, openMo, closeMo,
  buildPostMatchCoachComment: _buildPostMatchCoachComment,
  // ... 30+ 속성
});
```

| 특징 | 설명 |
|------|------|
| **init*(ctx)** | 각 모듈이 `let C = null`에 ctx 저장 |
| **window 노출** | HTML `onclick`용 — `window.nav`, `window.submitResult` 등 |
| **순환 참조 회피** | `appBootstrap`만 import 그래프의 허브 |

### 2.1 모듈 레이어

```
[L0] constants.js, version.js, memberUtils.js, coaching.js
[L1] appCore.js, firebaseApp.js, aiCoach.js, modals.js
[L2] matchStats.js, scrollBridge.js, appNav.js, backNav.js
[L3] challenges.js, membersTab.js, rankingTab.js, myPage.js, ...
[L4] appBootstrap.js
[L5] main.js
```

`challenges.js`는 약 2,900줄로 가장 큰 모듈 — 대결 CRUD, 바텀시트, 카카오 공유, 포인트 갱신을 모두 포함합니다.

---

## 3. 라우팅과 네비게이션

### 3.1 탭 네비게이션 (`appNav.js`)

```javascript
function nav(id, fromBack) {
  if (id === 'my' && !requireMyPlayer()) return;
  if (id === 'admin' && !isAdmin()) { nav('challenge'); return; }
  // .page.on class 토글
  // 현재 탭 renderC/renderM/renderR/...
}
```

**페이지 ID:** `challenge`, `ranking`, `members`, `hall`, `my`, `admin`

### 3.2 URL 진입 (`applyEntryNavigation`)

| 소스 | 파싱 |
|------|------|
| `?p=ranking&ch=홍길동&filter=open` | 쿼리 우선 |
| `#members?ch=홍길동` | hash fallback |
| `?match=<id>` | sessionStorage → 대결 하이라이트 |

### 3.3 뒤로가기 (`backNav.js`)

`history.pushState`로 탭·모달·바텀시트 스택을 관리합니다. Android 뒤로가기 시:

1. 사진 라이트박스 닫기
2. 바텀시트 닫기
3. 모달 닫기
4. 이전 탭으로 복귀

---

## 4. UI 렌더링 전략

### 4.1 Firestore → UI 파이프라인

```
onSnapshot
  → MEMBERS/CHAL 배열 갱신
  → requestAnimationFrame (firebaseApp.js)
  → hooks.onMembers / onChallenges
  → scrollBridge.apply*SnapshotRender
  → (스크롤 중이면 pending 플래그)
  → renderC / renderM / ...
```

### 4.2 scrollBridge — 스크롤 중 렌더 지연

- 스크롤 시작: `html.is-scrolling` 클래스, `_isScrolling = true`
- **120ms** 정지 후: `flushPendingRenders()` — 보류된 render 일괄 실행
- 바텀시트 선수 검색 중: `deferBsGridRefresh()` — 입력 중 그리드 갱신 연기

### 4.3 challenges.js — 목록 diff

챌린지 목록은 스냅샷마다 전체 HTML을 재생성하지 않고, 해시 비교로 변경분만 DOM 갱신합니다 (약 1181행 부근). 이는 가장 자주 바뀌는 컬렉션의 렌더 비용을 줄입니다.

---

## 5. 화면별 주요 DOM·모듈 매핑

| 탭 | 컨테이너 ID | Render 함수 | 핵심 UX |
|----|-------------|-------------|---------|
| 대결 | `#page-challenge`, `#cl` | `renderC()` | FAB, 필터, 카드 목록 |
| 랭킹 | `#page-ranking`, `#rl` | `renderR()` | 시즌/전체, 단식/복식 |
| MY | `#page-my`, `#my-page-dashboard` | `renderMyPage()` | AI 카드, 전적 대시보드 |
| 명예의 전당 | `#page-hall` | `renderHall()` | 월간 AI 스토리, 배지 |
| 선수 | `#page-members`, `#ml` | `renderM()` | 프로필, VCF, 상대 AI |
| 관리자 | `#page-admin` | `renderAdminHub()` | PIN 후 허브 메뉴 |

**모달:** `modals.js`의 `openMo('mo-*')` — 대결 신청(`mo-bs`), 결과 입력(`mo-result`), 관리자 PIN(`mo-admin-pin`) 등

**바텀시트:** `challenges.js`의 `openBS()` — 위저드 단계형 대결 신청

---

## 6. PWA·버전 갱신 (`pwa.js`)

### 6.1 Service Worker 정책

- **오프라인 캐시 없음** — `fetch` pass-through, `cache: 'no-store'`
- **역할:** 새 SW 즉시 activate, 구 캐시 삭제, controllerchange → reload

### 6.2 버전 갱신 흐름

1. `version.json` fetch
2. `appVersion !== localStorage.isatok_app_version` → SW `SKIP_WAITING` → reload
3. `prepare-deploy.mjs`가 배포마다 버전·`?v=` 일괄 bump

### 6.3 설치 UX

| 플랫폼 | 동작 |
|--------|------|
| Android Chrome | `beforeinstallprompt` 배너 |
| iOS Safari | "홈 화면에 추가" 안내 |
| 카카오 인앱 | intent(Android) / 가이드 오버레이(iOS) |

---

## 7. HTML onclick ↔ JS 연결

Vanilla SPA 특성상 많은 핸들러가 `window`에 노출됩니다.

| window 함수 | 모듈 | 용도 |
|-------------|------|------|
| `nav(pageId)` | appNav | 탭 전환 |
| `openBS()`, `closeBS()` | challenges | 바텀시트 |
| `submitResult()` | challenges | 결과 등록 |
| `toggleAdmin()`, `submitAdminPin()` | adminTab | 관리자 |
| `exportMembersVcf()` | membersTab | VCF 다운로드 |
| `setF(filter)` | challenges | 대결 필터 |

---

## 8. 개발 시 주의점

1. **새 모듈 추가:** `appBootstrap.finish()`에 `init*` 호출 추가, ctx에 필요한 getter 전달
2. **캐시 bust:** import 경로 `?v=`는 `prepare-deploy.mjs`가 자동 갱신 — 수동 bump 시 `version.js`와 동기화
3. **스냅샷 핸들러:** 무거운 render는 `scrollBridge` pending 패턴 준수
4. **Firestore write 후:** 로컬 배열(`unshiftChallengeLocal` 등)과 Firestore 이중 갱신 패턴 혼재 — 스냅샷이 최종 SSOT

---

*다음: [02-data-model-and-flows.md](./02-data-model-and-flows.md)*
