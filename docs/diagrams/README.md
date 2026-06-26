# 이사탁 시스템 다이어그램

Mermaid(`.mmd`) 소스 파일 모음입니다. GitHub, VS Code(Mermaid 확장), [Mermaid Live Editor](https://mermaid.live)에서 렌더링할 수 있습니다.

## 다이어그램 목록

| 파일 | 설명 | 관련 섹션 |
|------|------|-----------|
| [01-system-overview.mmd](./01-system-overview.mmd) | 전체 시스템 구성 (클라이언트·Firebase·외부) | ARCHITECTURE §10 |
| [02-boot-sequence.mmd](./02-boot-sequence.mmd) | 앱 부트스트랩·Firebase 초기화 시퀀스 | deep-dive §01 |
| [03-challenge-lifecycle.mmd](./03-challenge-lifecycle.mmd) | 대결(챌린지) 상태 전이 | deep-dive §02 |
| [04-challenge-result-flow.mmd](./04-challenge-result-flow.mmd) | 결과 등록·포인트 갱신·AI 코멘트 | deep-dive §02 |
| [05-er-diagram.mmd](./05-er-diagram.mmd) | Firestore 컬렉션 관계 (ER) | ARCHITECTURE §4 |
| [06-module-dependencies.mmd](./06-module-dependencies.mmd) | ES Module 의존성 그래프 | deep-dive §01 |
| [07-ai-integration.mmd](./07-ai-integration.mmd) | AI 호출·캐시·Functions 프록시 | deep-dive §03 |
| [08-deployment-pipeline.mmd](./08-deployment-pipeline.mmd) | GitHub Actions → Hosting 배포 | ARCHITECTURE §8 |
| [09-pwa-version-update.mmd](./09-pwa-version-update.mmd) | PWA 버전 갱신·SW 교체 | deep-dive §01 |
| [10-security-model.mmd](./10-security-model.mmd) | 인증·권한·Firestore Rules | deep-dive §04 |

## 미리보기 (GitHub)

GitHub는 `.md` 파일 내 Mermaid 블록을 자동 렌더링합니다. `.mmd` 단독 파일은 Live Editor에 붙여넣어 확인하세요.

## ARCHITECTURE.md 연동

메인 문서 [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §10에서 이 디렉터리를 참조합니다.
