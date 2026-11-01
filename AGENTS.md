# Agent instructions

이 저장소에서 작업하는 AI 에이전트는 먼저 `CLAUDE.md`와 `docs/CONVENTIONS.md`를 읽는다.

- 사용자의 현재 지시와 실제 코드·설정이 문서보다 우선한다.
- 작업 범위와 관련된 상세 문서만 추가로 읽는다.
- 원인이나 해결책이 분명하지 않은 복잡한 변경은 `docs/dev-guidelines/ENGINEERING_PROBLEM_SOLVING.md`로 문제와 검증 계획을 먼저 정리한다.
- 판단할 내용이 있는 테스트는 `docs/dev-guidelines/TEST_DESIGN_DIALOGUE.md`로 사람과 AI가 계층·사례·제외 범위를 먼저 합의한다.
- 현재 요구사항으로 설명할 수 없는 계층, 의존성, 공통화를 미리 만들지 않는다.
- 변경 후 실제로 실행한 검증만 보고한다.
- AI의 제안은 초안이며 최종 설계와 승인 책임은 개발자에게 있다.
