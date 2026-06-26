# 심화 문서 (Deep Dive)

메인 아키텍처 문서 [`ARCHITECTURE.md`](../ARCHITECTURE.md)의 특정 영역을 코드 수준까지 상세히 다룹니다.

| 문서 | 주제 | 다이어그램 |
|------|------|-----------|
| [01-frontend-architecture.md](./01-frontend-architecture.md) | SPA 부트스트랩, 모듈 DI, 라우팅, 렌더 최적화 | [02](../diagrams/02-boot-sequence.mmd), [06](../diagrams/06-module-dependencies.mmd), [09](../diagrams/09-pwa-version-update.mmd) |
| [02-data-model-and-flows.md](./02-data-model-and-flows.md) | Firestore 스키마, 대결 생명주기, 포인트·시즌 계산 | [03](../diagrams/03-challenge-lifecycle.mmd), [04](../diagrams/04-challenge-result-flow.mmd), [05](../diagrams/05-er-diagram.mmd) |
| [03-ai-integration.md](./03-ai-integration.md) | Gemini 프록시, 캐시, 프롬프트, UI 하이드레이션 | [07](../diagrams/07-ai-integration.mmd) |
| [04-security-and-auth.md](./04-security-and-auth.md) | 인증 모델, 관리자, Rules, 위협 분석 | [10](../diagrams/10-security-model.mmd) |

## 권장 읽기 순서

1. **신규 개발자:** 01 → 02 → 04  
2. **AI 기능 작업:** 03 → 02  
3. **보안 강화:** 04 → 02  
4. **배포/운영:** ARCHITECTURE §8 + [08-deployment-pipeline.mmd](../diagrams/08-deployment-pipeline.mmd)
