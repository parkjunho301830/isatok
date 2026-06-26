# 심화: 인증 및 보안

> 관련: [ARCHITECTURE.md §7](../ARCHITECTURE.md#7-인증-및-보안) · [10-security-model.mmd](../diagrams/10-security-model.mmd)

---

## 1. 보안 모델 요약

이사탁은 **클럽 내부 신뢰 모델**로 설계되었습니다.

```
실제 보안 경계: 없음 (Firestore open)
체감 보안: 클라이언트 UI + localStorage PIN
AI 보안: Cloud Functions Secret ✅
```

`firestore.rules` 주석: *"Firebase Auth 미사용, 클럽 내부 운영용"*

---

## 2. 사용자 식별

### 2.1 "내 선수" (`wizard.js`)

| 항목 | 값 |
|------|-----|
| Storage | `localStorage` |
| Keys | `isatok_myPlayerId`, `isatok_myPlayerName` |
| 설정 UX | 최초 MY 탭 진입 시 위저드 강제 (`requireMyPlayer`) |
| 검증 | Firestore Auth 없음 — 누구나 아무 회원 선택 가능 |

**의미:** "내가 누구인지"는 **기기 로컬 설정**일 뿐, 서버가 검증하지 않습니다.

### 2.2 관리자 (`adminTab.js`)

| 항목 | 값 |
|------|-----|
| PIN | `2580` (`constants.js` — **소스 노출**) |
| Storage | `localStorage.isatok_admin = '1'` |
| UX | `requireAdmin(fn)` → PIN 모달 → 성공 시 `html.is-admin` |

**관리자 전용 기능:**

- 회원 CRUD UI
- 시즌 생성·종료
- 대결 결과 수정·삭제
- VCF 연락처보내기
- 관리자 허브 (`page-admin`)

---

## 3. 권한 enforcement 지점

### 3.1 클라이언트 only

| 검사 | 위치 | bypass 방법 |
|------|------|-------------|
| `isAdmin()` | adminTab, challenges, membersTab | localStorage 직접 설정 |
| `requireMyPlayer()` | appNav, wizard | localStorage 직접 설정 |
| completed 결과 수정 | challenges `submitResult` | Firestore SDK 직접 write |
| 회원 삭제 | membersTab | Firestore SDK 직접 delete |

### 3.2 CSS 기반 UI 숨김

```html
<!-- admin-only 클래스: 비관리자에게 숨김 -->
<div class="page admin-only" id="page-admin">
```

`document.documentElement.classList.toggle('is-admin')` — **표시만** 제어

### 3.3 Firestore Rules

```
members, challenges, tournaments, notices, boards:
  allow read, write: if true;

seasons:
  allow read: if true;
  allow create, update: if isValidSeasonWrite();
  allow delete: if false;
```

**유일한 서버 검증:** seasons 스키마 + 삭제 금지

---

## 4. 노출되는 클라이언트 시크릿

| 항목 | 파일 | 위험도 |
|------|------|--------|
| Firebase Web API Key | `firebaseApp.js` | 낮음 (Rules로 보호해야 하나 open) |
| Kakao JS Key | `version.js` | 낮음 (도메인 제한 가능) |
| Admin PIN | `constants.js` | **높음** |
| GAS Web App URL | `constants.js` | 중간 (공개 exec URL) |
| Functions URL | `constants.js` | 낮음 (POST body 필요) |

---

## 5. AI 보안 (양호)

| 항목 | 상태 |
|------|------|
| GEMINI_API_KEY | Functions Secret, 클라이언트 미노출 ✅ |
| Functions CORS | `cors: true` — 임의 origin POST 가능 ⚠️ |
| Rate limit | 없음 ⚠️ |
| Auth on Functions | 없음 — URL 알면 호출 가능 ⚠️ |

**악용 시나리오:** Functions URL을 알면 인증 없이 Gemini quota 소진 가능

---

## 6. 위협 모델

### 6.1 STRIDE 간략 분석

| 위협 | 해당 | 현재 완화 |
|------|------|-----------|
| **S** Spoofing | 내 선수·관리자 위장 | 없음 |
| **T** Tampering | Firestore 데이터 변조 | 없음 (open write) |
| **R** Repudiation | 행위 부인 | 감사 로그 없음 |
| **I** Information Disclosure | 전체 DB 읽기 | open read |
| **D** Denial of Service | 대량 write / AI 호출 | 없음 |
| **E** Elevation | localStorage → admin | PIN 노출 |

### 6.2 현실적 위험 (클럽 내부)

| 시나리오 | 영향 |
|----------|------|
| 악의적 포인트 조작 | 랭킹 왜곡 |
| challenge 대량 삭제 | 기록 손실 |
| AI Functions 남용 | Gemini 비용 |
| PIN 유출 | 관리 UI 접근 (그러나 Firestore는 이미 open) |

---

## 7. hardening 로드맵 (제안)

### Phase 1 — Quick wins

1. **Firestore Rules:** `write`에 `request.auth != null` (익명 Auth라도)
2. **Admin PIN → Functions 검증:** `verifyAdminPin` callable → custom claim `admin: true`
3. **Functions App Check** 또는 API key header

### Phase 2 — Proper auth

1. Firebase Auth (전화번호 / 이메일)
2. `members` 문서에 `linkedUid` 필드
3. Rules: 본인 member만 `myPlayer` claim으로 수정

### Phase 3 — Server-side logic

1. Cloud Functions Firestore Trigger: `challenges` onUpdate → 포인트 서버 계산
2. Admin SDK only write on `members` points fields
3. Audit log 컬렉션

---

## 8. PWA·외부 브라우저 보안

| 항목 | 처리 |
|------|------|
| 카카오 인앱 | 제한적 PWA — 외부 브라우저 유도 |
| HTTPS | Firebase Hosting 기본 |
| CSP | 미설정 |
| SRI | Kakao SDK integrity hash ✅ |

---

## 9. 데이터 프라이버시

| 데이터 | 저장 | 전송 |
|--------|------|------|
| 전화번호 | Firestore `members.phone` | VCF export (관리자) |
| AI statsSummary | 전송만 (미저장) | Functions → Gemini |
| 회원 사진 | GAS (외부) | fetch GET |

GDPR/개인정보보호법 대응 문서는 코드베이스에 없음.

---

*심화 문서 목록: [README.md](./README.md)*
