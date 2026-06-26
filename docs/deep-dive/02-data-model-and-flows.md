# 심화: 데이터 모델 및 데이터 흐름

> 관련: [ARCHITECTURE.md §4](../ARCHITECTURE.md#4-데이터베이스) · [05-er-diagram.mmd](../diagrams/05-er-diagram.mmd) · [03-challenge-lifecycle.mmd](../diagrams/03-challenge-lifecycle.mmd)

---

## 1. Firestore 설계 철학

- **관계형 JOIN 없음** — `challenges`의 `myTeam`/`oppTeam`은 **선수 이름 문자열 배열**로 `members`를 참조
- **통계 비정규화** — `members.individualPoint`/`doublePoint`는 Firestore에 저장; 전적·승률은 `challenges`에서 **클라이언트 실시간 계산**
- **시즌 포인트** — 별도 컬렉션 없음; `matchStats._computeSeasonPoints()`가 기간 필터로 계산

---

## 2. 컬렉션별 상세

### 2.1 members

| 필드 | 타입 | 비고 |
|------|------|------|
| `name` | string | UI·매칭의 사실상 키 (unique 가정) |
| `phone` | string | `tel:` 링크, VCF |
| `gender` | string | `'남성'` \| `'여성'` |
| `individualPoint` | number | 단식 PT, 초기 `1000` |
| `doublePoint` | number | 복식 PT, 초기 `1000` |
| `status` | string | 예: `'활성'` |
| `memo` | string | VCF NOTE |
| `joined` | string | `'YYYY.MM'` |
| `createdAt` | string | ISO |

**리스너:** `orderBy('name')` — 가나다순 목록

**등급:** DB 필드 없음 — `GRADE_TIERS` 상수로 포인트→등급 변환 (`memberUtils.js`)

### 2.2 challenges

#### type 코드

| 코드 | 의미 |
|------|------|
| `ms` | 남복 (남성 복식) |
| `md` | 혼복 |
| `fs` | 여복 |
| `fd` | — |
| `mx` | — |
| `singles` / `doubles` | 위저드 단순 타입 |

단식 판별: `_isSinglesType(t)` → `ms` 또는 `fs`  
복식 판별: `_isDoublesType(t)` → 그 외 복식 코드

#### status 상태 machine

```
pending → accepted → completed
        ↘ rejected
        ↘ expired (isOpen + expiresAt, UI 레벨)
```

| status | 의미 |
|--------|------|
| `pending` | 신청됨, 수락 대기 |
| `accepted` | 수락됨, 경기 예정 |
| `rejected` | 거절 |
| `completed` | 결과 등록 완료 |

**오픈 챌린지:** `isOpen: true`, `expiresAt` = 생성 + 3일 (`OPEN_CHALLENGE_EXPIRE_DAYS`)

**즉시 등록:** `instantCreate: true` — 생성과 동시에 `completed` + 포인트 반영

### 2.3 seasons

| 필드 | 검증 (Rules) |
|------|-------------|
| `name` | 1~80자 string |
| `startDate` | `YYYY-MM-DD` regex |
| `endDate` | optional, 동일 형식 |
| `status` | `'active'` \| `'ended'` |
| `isCurrent` | bool, optional |
| `champion` | `{ name: string }` optional |

**삭제 불가** — `allow delete: if false`

### 2.4 notices / boards (미완성)

- `noticesBoards.js`에서 `addDoc`/`updateDoc`/`deleteDoc` 구현
- **onSnapshot 없음** → 앱 재시작 시 메모리 비어 있음
- 목록 DOM (`#nl`, `#bl`) 미연결

---

## 3. 대결(챌린지) 생명주기

### 3.1 생성 (`challenges.js` — submit 흐름)

```
1. 위저드(wizard.js)에서 myTeam, oppTeam, date, type 등 수집
2. addDoc(COL_CHALLENGES, data)
3. instantCreate + pendingResult → updateDoc completed + _updateMatchPoints
4. unshiftChallengeLocal (낙관적 UI) + onSnapshot 최종 동기화
```

### 3.2 수락 / 거절

```javascript
updateDoc(challengeRef, { status: 'accepted' })
// 또는
updateDoc(challengeRef, { status: 'rejected' })
```

오픈 챌린지 수락 시 `acceptedAt` 등 추가 필드 갱신.

### 3.3 결과 등록 (`submitResult`)

```
1. (수정 모드) _updateMatchPoints(oldWinner, sign=-1)  // 포인트 롤백
2. updateDoc challenge { status:'completed', winner, score }
3. _updateMatchPoints(newWinner, sign=+1)               // 포인트 적용
4. _buildPostMatchCoachComment → AI 코멘트
5. showResultFeedback
```

**권한:** 일반 사용자는 `completed` 결과 수정 불가 — 관리자만 `_resEditMode`

---

## 4. 포인트 계산 (`_updateMatchPoints`)

```javascript
// challenges.js
var isDbl = _isDoublesType(challenge.type);
var pts = isDbl ? PT.double : PT.individual;  // { win, loss }
var field = isDbl ? 'doublePoint' : 'individualPoint';

// 승팀: +pts.win * sign
// 패팀: +pts.loss * sign  (loss는 음수 상수)
await updateDoc(memberRef, { [field]: current + delta });
```

| 모드 | 승 | 패 |
|------|-----|-----|
| 단식 | +10 | -5 |
| 복식 | +5 | -2 |

**sign:** `1` = 적용, `-1` = 취소 (결과 수정 시)

**주의:** 선수 이름이 `members`에 없으면 해당 delta 스킵 — orphaned name 가능

---

## 5. 통계 계산 (`matchStats.js`)

모든 통계는 **메모리상 CHAL 배열**에서 파생됩니다.

| 함수 | 출력 |
|------|------|
| `_computeSinglesRecord(name)` | wins, losses, winRate, streak |
| `_computeDoublesRecord(name)` | 동일 |
| `_computeCombinedRecord(name)` | 단+복 합산 |
| `_computeSeasonPoints(name, season)` | 시즌 기간 내 가상 포인트 |
| `_computeMemberBadges(name)` | 연승, 다승 등 배지 |
| `_getMemberRankPosition(name)` | 랭킹 순위 |

**시즌 필터:** `season.startDate` ~ `season.endDate`와 `challenge.date` 비교

**랭킹 스냅샷:** `rankingTab.js` — `RANK_SNAPSHOT_KEY_PREFIX` + 날짜로 하루 1회 localStorage 저장 (UI 애니메이션용)

---

## 6. 실시간 동기화 상세

### 6.1 리스너 매트릭스

| 컬렉션 | orderBy | onSnapshot 후 훅 | 스크롤 defer |
|--------|---------|------------------|-------------|
| members | name | `applyMembersSnapshotRender` | ✅ |
| challenges | createdAt desc | `applyChallengesSnapshotRender` | ✅ |
| seasons | startDate desc | `_applySeasonsSnapshotRender` | ✅ |
| tournaments | — | hall/profile refresh | ❌ |
| notices | — | **없음** | — |
| boards | — | **없음** | — |

### 6.2 로컬 배열 SSOT

`firebaseApp.js`의 `MEMBERS`, `CHAL` 등이 **단일 진실 공급원**. CRUD 시:

1. Firestore write
2. (선택) 로컬 배열 즉시 패치 — `updateChallengeLocal` 등
3. onSnapshot이 최종 일치 보장

---

## 7. 데이터 흐름 시나리오

### 7.1 신규 회원 등록 (관리자)

```
admin → requireAdmin → addDoc(members) → onSnapshot → renderM
```

### 7.2 대결 신청 → 카카오 공유

```
wizard → addDoc(challenges) → renderC
      → Kakao.Share.sendDefault (또는 clipboard / navigator.share)
      → 딥링크: ?match=id
```

### 7.3 딥링크 진입

```
URL ?match=id → sessionStorage
→ nav('challenge') → handleDeepLink
→ waitForElement + scrollToElement + highlight
```

---

## 8. Firestore Rules와 데이터 무결성

| 위협 | 현재 상태 |
|------|-----------|
| 임의 포인트 조작 | Rules `write: true` — 클라이언트에서 `members` 직접 수정 가능 |
| challenge 삭제 | 허용 — 관리자 UI에서만 deleteDoc |
| season 삭제 | Rules에서 차단 |
| 잘못된 season 스키마 | `isValidSeasonWrite()` 거부 |

**서버 측 트리거 없음** — 포인트 갱신은 100% 클라이언트 `challenges.js` 책임

---

## 9. 마이그레이션·운영 스크립트

| 스크립트 | 용도 |
|----------|------|
| `sync-ranking-points.mjs` | 포인트 불일치 수정 |
| `reset-ranking.mjs` | 랭킹 초기화 |
| `import-member-phones.mjs` | 전화번호 bulk import |
| `extract-challenges.js` / `fix-challenges.js` | 챌린지 데이터 정리 |

---

*다음: [03-ai-integration.md](./03-ai-integration.md)*
