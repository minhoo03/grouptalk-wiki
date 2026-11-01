# GroupTalk Wiki

이 저장소는 Next.js App Router와 Supabase를 사용하는 GroupTalk Wiki 프로젝트다. 구현 전에 이 문서와 `docs/CONVENTIONS.md`를 읽고, 작업 범위에 해당하는 상세 문서만 추가로 확인한다.

## 판단 우선순위

1. 사용자의 현재 지시와 기능 요구사항
2. 실제 Supabase schema·RLS·API 계약과 설치된 package 설정
3. `docs/CONVENTIONS.md`와 관련 상세 문서
4. 주변 코드에서 반복되는 일관된 방식

충돌하면 가정을 숨기지 말고 가장 단순하게 검증 가능한 선택을 제시한다.

## 실제 스택과 범위

- Next.js 16 App Router, React 19, TypeScript strict mode
- Supabase JS와 `@supabase/ssr` 기반 cookie session
- TanStack Query 5, Zustand 5
- React Hook Form과 Zod 4
- Tailwind CSS 4와 shadcn/ui 설정
- ESLint 10과 pnpm
- 현재 테스트 도구는 설치되어 있지 않다. 설정되지 않은 검증이 통과했다고 기록하지 않는다.
- 테스트를 도입할 때는 함수·컴포넌트에 Vitest와 Testing Library, 실제 브라우저 흐름에 Playwright를 기본 후보로 검토한다.

## 핵심 원칙

1. 늘 이해하기 쉽게 작성한다.
2. 책임과 데이터 흐름을 명확히 한다.
3. 기술 선택에는 근거가 있어야 한다.
4. 정확성을 먼저 확보하고, 근거가 있을 때만 최적화한다.
5. 검증 가능한 코드를 작성한다.
6. AI는 구현과 판단을 보조하며 최종 결정은 개발자가 한다.

## 작업 규칙

- 원인이나 해법이 명확하지 않은 복잡한 변경은 `docs/dev-guidelines/ENGINEERING_PROBLEM_SOLVING.md`로 문제·불변 조건·검증 계획을 먼저 정리한다.
- `src/app/**/page.tsx`와 `layout.tsx`는 기본적으로 Server Component이며 route와 화면을 연결하는 얇은 경계로 둔다.
- event handler, state, Effect, browser API가 필요한 가장 작은 경계에만 `"use client"`를 둔다. 모든 하위 파일에 반복하지 않는다.
- 화면 구현은 `src/screens`에서 화면 단위로 관리하고 화면 전용 코드는 해당 screen 가까이에 둔다.
- Supabase browser client는 Client Component에서, server client는 Server Component·Server Action·Route Handler에서 사용한다.
- 인증과 권한 판단은 cookie의 raw session을 신뢰하지 않는다. 서버에서는 검증된 claims와 Supabase RLS를 사용한다.
- `NEXT_PUBLIC_` 환경변수에는 브라우저에 공개해도 되는 URL과 publishable key만 둔다. secret key는 넣지 않는다.
- 서버 상태는 TanStack Query가 소유한다. Server Component에서 충분한 조회를 이유 없이 client query로 옮기지 않는다.
- 가까운 UI 상태는 React state, 여러 화면이 공유하는 클라이언트 상태는 필요할 때 Zustand를 검토한다.
- 새로고침, 뒤로가기와 링크 공유로 복원해야 하는 조회 조건은 URL에 둔다.
- 외부 데이터는 TypeScript 타입 단언만 믿지 않고 Supabase schema, API, URL과 storage 경계에서 검증한다.
- 파생 값은 렌더 중 계산하고 Effect는 외부 시스템과 동기화할 때 사용한다.
- `memo`, `useMemo`, `useCallback`은 기본값이 아니다. 재현하거나 측정한 문제 또는 외부 API 계약이 있을 때 사용한다.
- 판단할 내용이 있는 테스트는 코드를 작성하기 전에 `docs/dev-guidelines/TEST_DESIGN_DIALOGUE.md`로 사람과 AI가 계층·최소 사례·제외 범위를 합의한다.
- 브라우저·비동기 순서에 의존하는 실패는 `docs/dev-guidelines/WEB_TEST_FAILURE_EVIDENCE.md`에 따라 최소 증거로 원인을 좁힌다.
- 현재 요구사항으로 설명할 수 없는 manager, factory, adapter와 상태관리 교체 계층을 미리 만들지 않는다.

## 문서 지도

- 전체 진입점: `docs/CONVENTIONS.md`
- 문제 정의·원인 조사·대안 비교·설계 검증: `docs/dev-guidelines/ENGINEERING_PROBLEM_SOLVING.md`
- 폴더와 코드 소유권: `docs/dev-guidelines/FRONTEND-PROJECT-STRUCTURE-GUIDE.md`
- 컴포넌트 작성, import와 선언 순서: `docs/dev-guidelines/FRONTEND-COMPONENT-CODING-GUIDE.md`
- 상태, React 런타임, 오류, 타입과 품질: `docs/dev-guidelines/REACT-APPLICATION-CONVENTIONS.md`
- AI와 함께하는 테스트 설계 대화: `docs/dev-guidelines/TEST_DESIGN_DIALOGUE.md`
- 웹 테스트 실패 증거와 AI 검증: `docs/dev-guidelines/WEB_TEST_FAILURE_EVIDENCE.md`
- 가독성, 예측 가능성, 응집도와 결합도: `docs/dev-guidelines/fundamentals/`
- 커밋, 브랜치와 PR: `docs/dev-guidelines/*CONVENTION.md`, `docs/dev-guidelines/PULL_REQUEST.md`

## 검증 명령

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm check
```

`pnpm check`는 타입 검사, ESLint와 프로덕션 빌드를 순서대로 실행한다. 테스트 도구와 script를 추가하기 전에는 test 통과를 주장하지 않는다.
