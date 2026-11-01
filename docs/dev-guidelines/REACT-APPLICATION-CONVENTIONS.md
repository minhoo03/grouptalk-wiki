# React 애플리케이션 컨벤션

이 문서는 React와 Next.js App Router 애플리케이션에서 반복해서 판단하는 책임과 데이터 흐름을 정한다. 각 규칙은 기본값이며, 실제 요구사항과 Supabase 계약이 다르면 더 정확한 선택을 하고 근거와 검증 결과를 남긴다.

## 1. 컴포넌트, custom hook과 순수 함수

### 규칙

- 컴포넌트는 JSX 구조와 그 화면에서만 쓰는 단순한 상호작용을 소유한다.
- 이름 붙일 수 있는 행동, 비동기 흐름, 구독, cleanup 또는 여러 상태 전이를 캡슐화할 때 custom hook으로 분리한다.
- React hook이 필요 없는 계산, 검증과 변환은 순수 함수로 분리한다.
- 파일 길이와 사용 횟수만으로 분리하거나 공통화하지 않는다.

### 이유

큰 컴포넌트는 화면과 동작을 한꺼번에 이해하게 만들지만, 단순한 코드까지 여러 hook과 파일로 흩으면 읽는 사람이 더 많은 맥락을 기억해야 한다. 분리의 목적은 줄 수를 줄이는 것이 아니라 책임과 검증 경계를 분명하게 만드는 것이다.

### 적용 조건과 예시

| 사례                                       | 기본 위치                   |
| ------------------------------------------ | --------------------------- |
| 모달 `isOpen`과 닫기 handler               | 해당 컴포넌트               |
| 자동 저장의 debounce, 취소, 최신 응답 판별 | 목적이 드러나는 custom hook |
| 금액 합계, 입력 검증, 응답 변환            | 순수 함수                   |

```ts
type ContractTotalInput = {
  monthlyRent: number;
  managementFee: number;
  discount: number;
};

export function calculateContractTotal(input: ContractTotalInput) {
  return Math.max(0, input.monthlyRent + input.managementFee - input.discount);
}
```

이 함수가 한 화면에서만 쓰여도 업무 규칙과 경계값을 독립적으로 검증할 가치가 있으므로 분리할 수 있다. 최초에는 해당 screen 가까이에 두고, 여러 screen이 같은 정책으로 사용할 때 공통 `utils`로 승격한다.

### 예외

- 여러 상태와 요청을 조합하는 screen hook이 읽기 흐름을 실제로 단순하게 만들면 사용할 수 있다. 다만 URL, API, 변환, toast가 이유 없이 하나의 거대한 hook에 숨지 않게 한다.
- `useMount`, `useEffectOnce`처럼 실제 의존성을 숨기는 lifecycle wrapper는 만들지 않는다.

근거: [Thinking in React](https://react.dev/learn/thinking-in-react), [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)

### Server Component와 Client Component 경계

- `page.tsx`, `layout.tsx`와 별도 표시가 없는 컴포넌트는 Server Component를 기본값으로 둔다.
- event handler, state, Effect, browser API 또는 client-only hook이 필요한 가장 작은 진입점에만 `"use client"`를 붙인다.
- `"use client"`는 파일과 그 하위 import graph의 client 경계를 만든다. 모든 하위 컴포넌트에 반복하지 않는다.
- 비즈니스 로직과 순수 함수는 Next.js 경계와 분리해 server와 client 어느 쪽에서도 검증 가능하게 둔다.
- server-only secret이나 server client를 Client Component가 import하지 않게 한다.

근거: [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components), [React `use client`](https://react.dev/reference/rsc/use-client)

## 2. 상태 소유권

### 규칙

상태의 소비 범위보다 원본과 수명을 먼저 본다.

| 상태                                             | 기본 소유자                              |
| ------------------------------------------------ | ---------------------------------------- |
| Server Component 렌더에 필요한 서버 데이터       | Supabase server client 또는 server fetch |
| client 상호작용에서 cache·재조회하는 서버 데이터 | TanStack Query                           |
| 컴포넌트 가까이 있는 일시적 UI 상태              | `useState` 또는 `useReducer`             |
| 떨어진 UI 트리가 공유하는 순수 클라이언트 상태   | Zustand 검토                             |
| 새로고침·뒤로가기·공유로 복원할 조회 조건        | URL search params                        |
| 폼 입력과 검증                                   | React Hook Form 또는 가까운 local state  |

- 같은 서버 응답을 Server Component props, Query cache와 Zustand에 이유 없이 중복 보관하지 않는다.
- Query key에는 응답을 결정하는 모든 입력을 포함한다.
- 취소가 필요한 요청은 Query가 제공한 `AbortSignal`을 실제 전송 계층까지 전달한다.
- `staleTime`, retry와 polling 값은 데이터의 최신성·복구 요구로 정하고 임의의 전역 숫자를 컨벤션으로 고정하지 않는다.
- mutation 응답만으로 최신 데이터를 확정할 수 있으면 해당 query key를 `setQueryData`로 갱신한다. 그렇지 않으면 영향을 받는 key만 invalidate한다.
- optimistic update는 즉시 반응의 이익이 크고 실패 시 rollback과 동시 수정 충돌을 안전하게 처리할 수 있을 때만 사용한다.

### 이유

Server Component는 client JavaScript를 늘리지 않고 서버에서 데이터를 준비하기 좋다. TanStack Query는 client에서 cache, stale 여부, 재조회, 요청 중복과 실패 복구가 필요할 때 적합하다. 이를 일반 전역 store에 복제하면 여러 원본의 동기화 문제가 생긴다. 반대로 모달 열림처럼 서버와 무관한 상태를 Query에 넣으면 소유권이 흐려진다.

```tsx
const contractQuery = useQuery({
  queryKey: ["contracts", contractId],
  queryFn: ({ signal }) => fetchContract({ contractId, signal }),
});
```

`contractId`가 응답을 결정하므로 query key에 포함하고, `signal`은 `fetch` 또는 Axios 요청까지 전달한다.

### 상태관리 도구 선택

현재 저장소에는 Zustand가 설치되어 있지만 local state보다 먼저 사용하지 않는다. 요구사항이 달라지면 다음 기준으로 하나를 선택할 수 있다.

- Zustand: 단순한 외부 store와 selector 기반 구독이 필요한 경우
- Jotai: 작은 atom들의 의존 그래프와 세밀한 조합이 핵심인 경우
- Redux Toolkit: 명시적인 event·state transition, middleware와 조직 표준이 중요한 경우

지원 중인 다른 도구를 금지하지 않지만 한 프로젝트에서 여러 도구를 동시에 설치하거나 미래 교체만 위한 state adapter를 만들지 않는다.

### 예외

- 서버 데이터에서 만든 편집 초안처럼 사용자가 원본과 독립적으로 수정하는 값은 local/form state가 될 수 있다.
- offline queue처럼 클라이언트가 서버 반영 전 작업을 소유하는 경우 별도 store가 필요할 수 있다. 이때 동기화·충돌 정책을 명시한다.

근거: [TanStack Query Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Query Cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation), [Updates from Mutation Responses](https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses), [Invalidations from Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations), [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates), [Zustand Introduction](https://zustand.docs.pmnd.rs/learn/getting-started/introduction)

## 3. URL 상태와 내부 상태

### 규칙

새로고침, 뒤로가기 또는 링크 공유 후 같은 화면을 재현해야 하는 상태는 URL에 둔다. 순간적인 조작 흔적과 민감정보는 내부 상태에 둔다.

| URL 후보                            | 내부 상태 후보                |
| ----------------------------------- | ----------------------------- |
| 검색어, 필터, 정렬, 페이지, 공개 탭 | tooltip, dropdown, 일반 modal |
| 공유해야 하는 선택 ID               | 제출 전 입력, 비밀번호, token |

URL 값은 외부 입력이다. 누락, 빈 문자열, 알 수 없는 enum, `NaN`, 음수 페이지를 정상적인 입력 경계로 처리하고 안전한 기본값으로 좁힌다.

```ts
const rawPage = searchParams.get("page");
const parsedPage = Number(rawPage);
const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
```

### 이유

URL은 브라우저 history와 공유 가능한 화면 상태의 원본이다. 같은 정보를 URL과 local state에 동시에 저장하면 뒤로가기와 화면이 어긋날 수 있다.

### 예외

- 공유 링크로 특정 modal을 열어야 하는 제품 요구가 있다면 URL 상태가 될 수 있다.
- URL에 노출하면 안 되는 개인정보와 보안 정보는 재현 가치가 있어도 넣지 않는다.

근거: [Next.js `searchParams` page prop](https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional), [Next.js `useSearchParams`](https://nextjs.org/docs/app/api-reference/functions/use-search-params)

## 4. 렌더링 순수성과 Effect

### 규칙

현재 props와 state로 결정되는 값은 별도 state에 저장하지 않고 렌더링 중 계산한다. Effect는 React 외부 시스템과 동기화할 때 사용한다. listener, 구독, timer와 연결을 시작했다면 대응하는 cleanup을 반환한다.

### 이유

React의 화면 갱신은 개념적으로 다음 순서로 진행된다.

```text
상태 업데이트 발생
→ Render: 컴포넌트 함수를 호출해 다음 UI 계산
→ Commit: 계산 결과를 DOM에 반영
→ Effect 실행
```

다음 코드는 `items`와 `total`이라는 같은 사실을 두 곳에 저장한다.

```tsx
// 피해야 함
const [total, setTotal] = useState(0);

useEffect(() => {
  setTotal(items.reduce((sum, item) => sum + item.price, 0));
}, [items]);
```

Effect의 `setTotal`은 끝난 렌더를 수정하지 않고 다음 렌더를 예약한다. 따라서 새 `items`와 이전 `total`로 한 번 렌더한 뒤 다시 렌더하며, 다음처럼 서로 맞지 않는 상태도 표현할 수 있게 된다.

```text
items = [10, 20]
total = 10
```

원본을 하나만 두면 같은 render snapshot에서 일관된 값을 얻는다.

```tsx
// 권장
const total = items.reduce((sum, item) => sum + item.price, 0);
```

순수한 렌더는 React가 작업을 중단하거나 다시 시작해도 외부 부수 효과를 남기지 않는다.

### Effect를 사용하는 경우

- 브라우저 이벤트와 외부 store 구독
- WebSocket 연결
- timer 시작과 해제
- 지도, 차트와 editor 같은 명령형 외부 라이브러리 제어
- 컴포넌트 노출과 외부 분석 시스템 동기화

```tsx
useEffect(() => {
  window.addEventListener("online", handleOnline);

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}, []);
```

이 앱은 개발 환경에서 `StrictMode`를 사용한다. React는 cleanup 누락을 드러내기 위해 Effect의 setup → cleanup → setup을 한 번 더 실행할 수 있다. 이를 `ref`나 `useEffectOnce`로 억지로 막지 말고, 사용자가 setup 한 번과 setup → cleanup → setup 사이의 차이를 느끼지 않도록 대칭적으로 정리한다. 이 추가 검사는 production 동작이 아니다.

클릭 때문에 실행되는 저장, 알림과 이동은 가능하면 Effect가 아니라 해당 event handler 또는 mutation callback에서 실행한다.

### 예외

- 사용자가 원본과 독립적으로 수정하는 편집 초안은 별도 state가 될 수 있다.
- 외부 시스템이 아닌데 Effect가 필요해 보이면 먼저 파생 계산, event handler 또는 `key`로 해결할 수 있는지 확인한다.

근거: [Render and Commit](https://react.dev/learn/render-and-commit), [State as a Snapshot](https://react.dev/learn/state-as-a-snapshot), [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect), [Components and Hooks Must Be Pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure), [`useEffect`](https://react.dev/reference/react/useEffect), [Strict Mode: fixing bugs found by re-running Effects](https://react.dev/reference/react/StrictMode#fixing-bugs-found-by-re-running-effects-in-development)

## 5. 메모이제이션과 성능

### 규칙

`memo`, `useMemo`, `useCallback`은 기본값이 아니다. 기능 정확성을 캐시에 의존시키지 않는다. 실제 문제를 재현하거나 측정했거나, 외부 API가 안정된 참조를 계약으로 요구할 때만 사용한다.

### 이유

메모이제이션도 의존성 배열과 참조 안정성이라는 비용을 만든다. 잘못된 의존성은 오래된 값을 캡처하고, 매번 새로 만들어지는 값 하나가 전체 최적화를 무효화할 수 있다. React도 이를 의미 보장이 아니라 성능 최적화로 설명한다.

### 적용 조건

- Profiler에서 비싼 재렌더가 확인됐다.
- 큰 배열 변환이나 계산이 사용자 상호작용을 실제로 지연시킨다.
- memo된 하위 컴포넌트에 안정된 값이나 callback을 전달해야 한다.
- 외부 subscription API가 동일한 함수 참조를 요구한다.

단순 property 접근, 작은 배열 계산과 짧은 handler는 그대로 둔다. 최적화 전후는 같은 production build와 같은 사용자 동작으로 비교한다.

### 예외

메모이제이션을 제거했을 때 기능이 깨진다면 캐시를 다시 넣기 전에 상태 흐름과 Effect 의존성을 고친다.

근거: [`useMemo`](https://react.dev/reference/react/useMemo), [`memo`](https://react.dev/reference/react/memo), [Profiler](https://react.dev/reference/react/Profiler)

## 6. 로딩, 실패, 성공과 Error Boundary

### 규칙

예상 가능한 Query와 Mutation 상태는 해당 동작을 소유한 screen, form 또는 action이 처리한다. 예상하지 못한 render 오류만 의미 있는 상위 Error Boundary가 처리한다. 서버와 합의한 오류 code와 메시지 계약이 있으면 그것을 우선한다.

| 상태                | 기본 책임      | 기본 UX                           |
| ------------------- | -------------- | --------------------------------- |
| 최초 query 대기     | screen         | skeleton 또는 문맥 있는 loading   |
| 빈 결과             | screen         | 빈 이유와 가능한 다음 행동        |
| background refetch  | 기존 화면 유지 | 필요한 경우 작은 갱신 표시        |
| query 실패          | screen         | 설명과 재시도                     |
| mutation 진행       | form/action    | 중복 제출 방지와 진행 표시        |
| mutation 실패       | form/action    | 입력 또는 action 근처의 복구 안내 |
| 예상 밖 render 오류 | Error Boundary | 안전한 fallback과 재시도·이동     |

반복되는 오류 정규화, retry 정책, 성공 알림은 작은 hook이나 유틸로 묶을 수 있다. 다만 실제 요청 상태의 원본은 TanStack Query에 남기고 모든 요청을 거대한 `RequestManager`로 감싸지 않는다.

```ts
function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.userMessage;
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
```

- 명시적인 최종 제출 성공은 toast를 사용할 수 있다.
- 자동 저장 성공은 입력 근처에 조용히 표시한다.
- background query 성공에는 일반적으로 toast를 띄우지 않는다.

### 이유

네트워크 실패, 권한 없음과 빈 결과는 정상적으로 예상할 수 있는 제품 상태이므로 사용자가 복구할 수 있어야 한다. 반면 null 접근과 잘못된 hook 사용 같은 코드 결함을 일반 서버 오류처럼 처리하면 결함을 숨기게 된다.

### 예외

- Error Boundary는 event handler와 모든 비동기 rejection을 자동으로 잡지 않는다. 호출한 handler, query 또는 mutation이 처리한다.
- 사용자가 할 수 있는 복구가 없는 치명적 상태는 상위 route 경계로 올릴 수 있다.

근거: [React Error Boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary), [TanStack Query Background Fetching Indicators](https://tanstack.com/query/latest/docs/framework/react/guides/background-fetching-indicators)

## 7. 타입 추론과 외부 데이터 검증

### 규칙

- 함수 내부의 명백한 지역 값은 TypeScript 추론을 우선한다.
- 함수 매개변수, 컴포넌트 props, custom hook의 공개 반환값과 API·storage 경계는 타입을 명시한다.
- 네트워크, URL과 storage에서 들어오는 값은 `unknown`으로 보고 경계에서 검증한다.
- type-only 의존성은 `import type`으로 표현한다.

### 이유

모든 지역 변수에 타입을 반복하면 실제 계약보다 문법이 많아진다. 반대로 외부 경계를 추론과 단언에 맡기면 실패 지점이 숨겨진다. TypeScript 타입은 빌드 후 지워지므로 서버 응답의 실제 구조를 검사하지 않는다.

```ts
// 내부 값은 추론
const total = items.reduce((sum, item) => sum + item.price, 0);

// 검증이 아님
const contract = (await response.json()) as Contract;
```

현재 저장소에는 Zod가 있으므로 API 계층에서 schema를 검증하고 그 결과만 애플리케이션으로 넘길 수 있다.

```ts
const ContractSchema = z.object({
  id: z.string(),
  monthlyRent: z.number().nonnegative(),
});

type Contract = z.infer<typeof ContractSchema>;

async function fetchContract({ signal }: { signal?: AbortSignal }) {
  const response = await fetch("/api/contracts/current", { signal });

  if (!response.ok) {
    throw new HttpError(response.status);
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    throw new InvalidResponseError("응답이 JSON 형식이 아닙니다.", {
      cause: error,
    });
  }

  const parsed = ContractSchema.safeParse(payload);

  if (!parsed.success) {
    throw new InvalidResponseError("응답이 계약과 일치하지 않습니다.", {
      cause: parsed.error,
    });
  }

  return parsed.data;
}
```

`HttpError`와 `InvalidResponseError`는 예시의 경계 오류 타입이다. 실제 구현에서는 서버가 합의한 오류 payload가 있다면 먼저 검증해 사용자 오류와 계약 위반을 구분한다.

### 예외

- 서버 계약에서 생성한 schema나 API client가 있으면 수동 schema보다 그것을 우선한다.
- 신뢰 경계가 아닌 내부 객체를 매번 runtime 검증하지 않는다.
- schema 검증 실패를 사용자 입력 오류와 서버 계약 오류 중 무엇으로 볼지 API 계층에서 구분한다.

근거: [TypeScript Type Inference](https://www.typescriptlang.org/docs/handbook/type-inference), [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html), [Erased Types](https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html#erased-types), [Zod Basics](https://zod.dev/basics)

## 8. 테스트, 접근성, 보안과 검증

### 테스트 도구를 도입할 때의 기준

현재 저장소에는 테스트 도구가 없다. 도구를 추가하기 전에는 테스트가 실행된다고 기록하지 않는다. 추가한다면 위험에 맞는 가장 작은 계층을 선택한다.

- 순수 계산, schema와 API adapter는 단위 테스트를 우선한다.
- 컴포넌트는 내부 함수 호출보다 사용자의 행동과 관찰 결과를 검증한다.
- 늦은 응답, 순서 역전과 중복 제출은 제어 가능한 Promise로 재현한다.
- URL history, 실제 focus와 storage처럼 브라우저 동작이 결과에 중요한 흐름은 Playwright를 검토한다. Playwright의 `webServer`로 Next.js 개발 서버나 빌드 서버를 실행할 수 있다.
- 같은 사례를 단위, 컴포넌트와 E2E 계층에 반복하지 않는다.
- 발견한 버그는 먼저 실패하는 회귀 사례로 고정한다.

테스트 코드를 작성하기 전에 사람과 AI가 계층·사례·제외 범위를 합의할 때는 [테스트 설계 대화](./TEST_DESIGN_DIALOGUE.md)를 사용한다. 브라우저·비동기 순서에 의존하는 실패의 증거와 재검증 순서는 [웹 테스트 실패 증거](./WEB_TEST_FAILURE_EVIDENCE.md)를 따른다.

근거: [Vitest Testing in Practice](https://main.vitest.dev/guide/learn/testing-in-practice), [Testing Library Query Priority](https://testing-library.com/docs/queries/about/#priority), [Playwright Best Practices](https://playwright.dev/docs/best-practices)

### 접근성 기본선

- 클릭에는 `button`, 이동에는 `a`, 입력에는 연결된 `label`을 우선한다.
- 주요 흐름을 키보드로 수행할 수 있어야 하며 focus 표시를 제거하지 않는다.
- 입력 오류는 색상만으로 표현하지 않고 입력과 설명을 연결한다.
- loading, 저장 성공과 오류처럼 중요한 동적 상태는 문맥에 맞는 status 또는 live region으로 전달한다.

```tsx
<label htmlFor="monthly-rent">월세</label>
<input
  id="monthly-rent"
  aria-invalid={Boolean(error)}
  aria-describedby={error ? "monthly-rent-error" : undefined}
/>
{error ? <p id="monthly-rent-error">{error}</p> : null}
```

근거: [W3C Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/), [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

### 보안 기본선

- 민감정보를 URL, console log와 `localStorage`에 저장하지 않는다.
- `NEXT_PUBLIC_` 환경변수는 client bundle에 포함되므로 secret을 넣지 않는다.
- Supabase publishable key는 RLS와 함께 사용하는 공개 가능한 식별자지만 service role key와 secret key는 server 전용으로 관리한다.
- 검증하지 않은 외부 HTML을 `dangerouslySetInnerHTML`로 렌더링하지 않는다.
- 클라이언트 검증을 서버의 인증·인가·입력 검증 대체재로 보지 않는다.

근거: [Next.js Environment Variables](https://nextjs.org/docs/app/guides/environment-variables), [Supabase API Keys](https://supabase.com/docs/guides/api/api-keys), [OWASP HTML5 Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html), [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

### 실행 검증

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm check
```

실제로 실행한 결과만 보고한다. test는 해당 도구와 script를 프로젝트에 추가하고 직접 통과시킨 뒤에만 검증 항목으로 기록한다.
