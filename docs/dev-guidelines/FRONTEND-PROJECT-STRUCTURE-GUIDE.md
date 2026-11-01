# 프론트엔드 프로젝트 구조 가이드

이 문서의 목적은 폴더 이름을 많이 만드는 것이 아니라, 변경 범위와 코드 소유권을 쉽게 예측하게 하는 것이다. 사람과 AI가 “이 코드는 어디에 있고 어디까지 수정해야 하는가”를 같은 방식으로 판단할 수 있어야 한다.

## 1. 핵심 원칙

1. 함께 수정되는 파일은 가깝게 둔다.
2. 특정 화면만 소유하는 코드는 해당 screen 안에 둔다.
3. 여러 screen이 같은 의미와 정책으로 사용할 때만 공통 영역으로 올린다.
4. 독립된 계산·검증·변환은 첫 사용부터 분리할 수 있지만, 실제 공유 전에는 소유 screen 가까이에 둔다.
5. 폴더는 파일이 실제로 생길 때 만든다.

구조를 결정할 때 다음 네 기준을 함께 본다.

| 기준        | 검토 질문                                                   |
| ----------- | ----------------------------------------------------------- |
| 가독성      | 한 번에 기억할 맥락과 파일 이동이 불필요하게 많지 않은가    |
| 예측 가능성 | 이름, 매개변수와 반환값만 보고 주요 동작을 예상할 수 있는가 |
| 응집도      | 반드시 함께 바뀌어야 하는 코드와 정책이 가까이 있는가       |
| 결합도      | 한 코드를 바꿀 때 관계없는 화면까지 영향을 받지 않는가      |

“중복이 없다”, “파일이 작다”, “추상화가 많다”는 그 자체로 좋은 구조의 조건이 아니다. 같은 정책이 여러 곳에 복제돼 수정 누락이 생기면 한 원본으로 모으고, 독립적으로 달라질 코드가 하나의 옵션 많은 추상화에 묶이면 짧은 중복을 허용한다.

근거: [Frontend Fundamentals: 좋은 코드를 위한 4가지 기준](https://frontend-fundamentals.com/code-quality/code/), [함께 수정되는 파일을 같은 디렉토리에 두기](https://frontend-fundamentals.com/code-quality/code/examples/code-directory.html), [중복 코드 허용하기](https://frontend-fundamentals.com/code-quality/code/examples/use-bottom-sheet.html)

## 2. 기본 구조

`app`은 Next.js의 route와 렌더링 경계를 소유한다. `screens`는 `page.tsx`에 화면 구현을 몰아넣지 않기 위한 중립적인 이름이며 이 저장소의 일관된 선택이다.

```text
src/
  app/
    layout.tsx                Root layout과 Provider 연결
    page.tsx                  route와 screen을 연결하는 얇은 진입점
  proxy.ts                    Next.js 16 Proxy 진입점
  components/                 여러 screen이 공유하는 UI
    ui/                       shadcn/ui 기본 컴포넌트
  hooks/                      여러 screen이 공유하는 hook
  lib/
    supabase/                 browser·server client와 session 갱신
  providers/                  앱 전역 Provider
  screens/
    document-detail/
      DocumentDetailScreen.tsx
      components/
      hooks/
      utils/
      document-detail.types.ts
  services/                   서버 통신과 외부 데이터 경계
  store/                      앱이 공유하는 클라이언트 상태
  styles/
  types/                      여러 screen이 공유하는 타입
  utils/                      여러 screen이 공유하는 순수 함수
```

모든 폴더를 미리 만들지 않는다. 실제 파일이 생기기 전까지 위 구조는 위치 판단을 위한 지도일 뿐이다.

## 3. 각 디렉토리의 책임

### `app/`

Next.js의 route, layout, metadata, loading, error와 route handler를 둔다. `page.tsx`는 route parameter와 server data를 준비해 screen에 전달하는 얇은 경계를 기본값으로 삼는다.

- `page.tsx`와 `layout.tsx`는 기본적으로 Server Component다.
- event handler, state, Effect, browser API가 필요한 가장 작은 경계에만 `"use client"`를 둔다.
- route와 무관한 화면 전용 컴포넌트·hook·업무 함수는 `screens/` 가까이에 둔다.
- 인증이 필요한 route의 loading·error·not-found UI는 해당 route segment 가까이에 둔다.

### `screens/`

실제 URL 화면과 그 화면만 소유하는 코드를 둔다.

```text
screens/
  contract-form/
    ContractFormScreen.tsx
    components/
      ContractSummary.tsx
    hooks/
      useContractAutosave.ts
    utils/
      calculateContractTotal.ts
    contract-form.schema.ts
```

작은 screen은 하위 폴더 없이 몇 개 파일을 나란히 둘 수 있다. `components`, `hooks`, `utils`를 형식적으로 모두 만들지 않는다.

### `components/`

여러 screen이 같은 의미와 동작으로 사용하는 UI를 둔다.

- `components/ui/`: Button, Input, Dialog 같은 디자인 시스템의 기본 단위
- 도메인 정책이 강한 화면 전용 컴포넌트는 해당 screen 아래에 유지

두 화면에서 모양이 비슷하다는 이유만으로 공통 컴포넌트로 올리지 않는다. 함께 바뀌어야 하는지가 기준이다.

### `hooks/`

여러 screen이 같은 행동과 생명주기로 사용하는 custom hook을 둔다.

- `useOnlineStatus`
- `useLocalStorage`
- `useDisclosure`

특정 화면의 자동 저장이나 권한 흐름은 해당 screen의 `hooks/`가 소유한다.

### `services/`

서버 요청과 외부 데이터 경계를 담당한다.

- URL, method, header와 payload 구성
- 응답 status 처리
- Zod 또는 명시적인 validator를 이용한 응답 검증
- `AbortSignal` 전달

여기서 toast, modal, 화면 이동과 전역 UI 상태 변경을 수행하지 않는다. 화면 행동은 요청을 호출하는 screen 또는 action이 조합한다.

Supabase client 생성과 cookie session 갱신은 `lib/supabase/`에 둔다. browser client와 server client를 같은 파일에서 조건 분기로 섞지 않는다.

### `store/`

여러 UI 영역이 공유하는 순수 클라이언트 상태를 둔다. 현재 설치된 기본 도구는 Zustand지만, 단순 local state를 먼저 검토한다.

서버에서 온 데이터를 Query cache와 store에 동시에 복제하지 않는다. 서버 상태 경계는 [React 애플리케이션 컨벤션](./REACT-APPLICATION-CONVENTIONS.md#2-상태-소유권)을 따른다.

### `utils/`

여러 screen이 실제로 같은 의미로 사용하는 순수 함수를 둔다.

- `cn`
- 날짜·금액 표시
- 파일 다운로드처럼 제품 전반에 같은 정책을 적용하는 함수

한 screen에서만 쓰는 순수 함수도 분리할 수 있지만 해당 screen의 `utils/`에 먼저 둔다.

### `types/`와 `constants/`

여러 screen이 같은 계약으로 사용하는 타입과 정책 상수만 둔다.

- 특정 화면 전용 타입은 해당 screen 가까이에 둔다.
- API 응답 타입은 가능한 한 Zod schema 또는 서버에서 생성된 계약과 함께 관리한다.
- debounce, page size와 timeout 같은 숫자는 의미가 드러나는 이름을 사용한다.
- 값이 한 곳에서만 쓰이고 그 자리에서 의미가 명확하면 무조건 전역 상수로 올리지 않는다.

### `providers/`, `lib/`, `styles/`

- `providers/`: QueryClient, theme처럼 앱 수명과 같은 Provider
- `lib/`: Supabase client처럼 프레임워크·외부 도구와 연결되는 경계
- `styles/`: 전역 CSS와 token

Provider는 필요한 범위보다 높게 두지 않는다. 특정 subtree만 사용하는 Context는 소유 screen 가까이에 둔다.

## 4. 위치와 공통화 판단

새 파일을 만들기 전에 다음 순서로 묻는다.

1. 특정 screen 하나가 소유하는가? 해당 screen 안에 둔다.
2. 여러 screen이 정확히 같은 의미와 정책으로 사용하는가? 최상위 공통 영역을 검토한다.
3. 서버 통신과 외부 응답 검증인가? `services/` 또는 screen의 API 모듈에 둔다.
4. 앱 전체가 공유하는 클라이언트 상태인가? `store/`를 검토한다.
5. 이름 붙일 독립 책임이나 테스트 가치가 있는가? 함수, hook 또는 컴포넌트로 분리한다.

사용 횟수만으로 다음 판단을 섞지 않는다.

| 판단                 | 기준                                              |
| -------------------- | ------------------------------------------------- |
| 로직을 분리할 것인가 | 독립된 책임, 이름 붙일 개념, 테스트 가치가 있는가 |
| 어디에 둘 것인가     | 지금 어느 screen이 소유하는가                     |
| 범용화할 것인가      | 실제로 같은 정책을 사용하는 소비자가 있는가       |

```ts
// 첫 사용부터 순수 함수로 분리할 수 있다.
// 위치는 먼저 screens/contract-form/utils/ 안이다.
export function calculateContractTotal(input: ContractTotalInput) {
  return Math.max(0, input.rent + input.fee - input.discount);
}
```

다른 screen도 같은 계약 계산 정책을 사용하게 되면 `src/utils`로 옮긴다. 계산 모양만 비슷하고 정책이 다르면 따로 유지한다.

## 5. screen, 컴포넌트, hook의 책임

이 문서는 코드의 위치를 정한다. 컴포넌트에 둘지, custom hook이나 순수 함수로 분리할지는 [React 애플리케이션 컨벤션](./REACT-APPLICATION-CONVENTIONS.md#1-컴포넌트-custom-hook과-순수-함수)을 단일 기준으로 사용한다.

위치만 판단하면 다음과 같다.

| 코드                                      | 기본 위치               |
| ----------------------------------------- | ----------------------- |
| 한 screen이 소유하는 컴포넌트·hook·함수   | 해당 `screens/<name>/`  |
| 여러 screen이 같은 정책으로 사용하는 코드 | 알맞은 최상위 공통 폴더 |
| 앱 전체 route와 Provider                  | `app/`, `providers/`    |

## 6. 파일명과 진입점

- React 컴포넌트 구현 파일은 컴포넌트와 같은 PascalCase 이름을 사용한다.
- `index.tsx`에 실제 화면 구현을 숨기지 않는다. Next.js가 요구하는 `page.tsx`, `layout.tsx` 이름은 예외다.
- `index.ts`는 package나 모듈의 의도적인 공개 API를 재수출할 때만 사용할 수 있다.
- 일반 앱 내부에서는 `HomeScreen.tsx`, `server.ts`, `cn.ts`처럼 검색 가능한 이름을 우선한다.

```text
# 피해야 함
screens/home/index.tsx
utils/index.ts

# 권장
screens/home/HomeScreen.tsx
lib/supabase/server.ts
utils/cn.ts
```

## 7. 피해야 할 구조

### 화면 전용 코드를 모두 공통 폴더에 두기

```text
# 피해야 함
src/components/DocumentEditor.tsx
src/hooks/useDocumentAutosave.ts

# 권장
src/screens/document-detail/components/DocumentEditor.tsx
src/screens/document-detail/hooks/useDocumentAutosave.ts
```

### 단순한 요구를 manager와 factory로 감싸기

```ts
// 현재 요구가 계산 한 번이면 이 API를 우선한다.
calculateContractTotal(input);

// 여러 전략의 생성과 수명 관리가 실제 요구일 때만 검토한다.
createCalculationManager({ strategies });
```

`manager`와 `factory`가 금지된 이름은 아니다. 실제로 여러 객체의 생명주기를 조율하거나 구현 생성 규칙이 있을 때 정확한 선택이 될 수 있다.

### 전달 단계 수만으로 Context나 전역 store 만들기

props가 몇 단계를 거쳤는지만 세지 않는다. 중간 컴포넌트가 값을 사용하지 않는지, composition으로 해결되는지, 소비자가 실제로 넓게 분포하는지, Provider가 상태 수명을 불필요하게 늘리는지 함께 본다.

## 8. 빠른 위치 표

| 질문                             | 기본 위치                         |
| -------------------------------- | --------------------------------- |
| URL과 대응하는 화면              | `screens/<name>/<Name>Screen.tsx` |
| screen 전용 UI·hook·utils        | `screens/<name>/...`              |
| 여러 screen이 공유하는 UI        | `components/`                     |
| 여러 screen이 공유하는 hook      | `hooks/`                          |
| 서버 통신과 외부 응답 검증       | `services/`                       |
| 앱이 공유하는 클라이언트 상태    | `store/`                          |
| 여러 screen이 공유하는 순수 함수 | `utils/`                          |
| route와 screen 연결              | `app/**/page.tsx`                 |
