# 프론트엔드 컴포넌트 코딩 가이드

이 문서는 React 컴포넌트의 이름, 읽는 순서와 import 규칙을 정한다. 형식 자체보다 사람이 위에서 아래로 데이터 흐름을 이해하고 파일의 책임을 예상할 수 있게 하는 것이 목적이다.

## 1. 적용 원칙

- 새 코드는 이 가이드를 기본값으로 사용한다.
- 기존 코드는 수정하는 범위 안에서 함께 정리한다.
- 동작 변경과 무관한 대규모 rename은 별도 작업으로 분리한다.
- 자동 검사되지 않는 취향 규칙 때문에 중요한 정확성·접근성 문제를 가리지 않는다.

## 2. 파일과 식별자 이름

### 컴포넌트

컴포넌트 파일과 export 이름은 PascalCase로 맞춘다.

```text
UserProfile.tsx
DocumentHeader.tsx
HomeScreen.tsx
```

```tsx
export function DocumentHeader() {
  return <header />;
}
```

`index.tsx`에 실제 컴포넌트 구현을 숨기지 않는다. 파일 이름으로 검색했을 때 책임을 바로 찾을 수 있어야 한다.

### 그 밖의 이름

| 대상        | 기본 이름                   |
| ----------- | --------------------------- |
| custom hook | `useDocumentAutosave.ts`    |
| 순수 함수   | `calculateContractTotal.ts` |
| screen 폴더 | `document-detail/`          |
| 타입 파일   | `document-detail.types.ts`  |
| schema 파일 | `document-detail.schema.ts` |

boolean은 가능하면 `is`, `has`, `can`, `should`로 의미를 드러낸다. `data`, `result`, `manager`처럼 넓은 이름은 실제 책임을 설명할 때만 사용한다.

## 3. 컴포넌트 내부의 읽는 흐름

### 규칙

선언은 대체로 다음 흐름을 따른다.

1. props와 context에서 읽는 입력
2. local state와 외부 hook
3. 현재 값에서 계산하는 파생 값
4. event handler
5. 외부 시스템 동기화를 위한 Effect
6. 상태별 early return과 JSX

이 순서는 lint처럼 강제하는 고정 구획이 아니다. 서로 강하게 관련된 값과 handler를 가까이 두고, 의존되는 값이 먼저 나오게 한다.

### 이유

hook 종류만 기준으로 모든 state, 모든 callback을 각각 모으면 하나의 행동을 이해하기 위해 파일 위아래를 왕복할 수 있다. 반대로 아무 순서 없이 섞으면 데이터가 어디서 와서 어디로 가는지 예측하기 어렵다. 기본 흐름을 유지하되 관련성도 함께 본다.

### 예시

```tsx
type UserProfileProps = {
  userId: string;
};

export function UserProfile({ userId }: UserProfileProps) {
  const profileQuery = useUserProfileQuery(userId);

  const displayEmail = profileQuery.data?.email ?? "이메일 없음";
  const isPremiumUser = profileQuery.data?.grade === "premium";

  function handleRetry() {
    void profileQuery.refetch();
  }

  if (profileQuery.isPending) {
    return <p role="status">프로필을 불러오는 중입니다.</p>;
  }

  if (profileQuery.isError) {
    return (
      <div role="alert">
        <p>프로필을 불러오지 못했습니다.</p>
        <button type="button" onClick={handleRetry}>
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <section>
      <p>{displayEmail}</p>
      <p>{isPremiumUser ? "프리미엄 사용자" : "일반 사용자"}</p>
    </section>
  );
}
```

`isPremiumUser` 같은 자명한 비교는 `useMemo`로 감싸지 않는다. 서버 조회도 컴포넌트 Effect와 별도 loading state로 복제하지 않고 TanStack Query가 소유하게 한다.

상세 원리: [React 애플리케이션 컨벤션](./REACT-APPLICATION-CONVENTIONS.md#4-렌더링-순수성과-effect)

## 4. Props의 선언과 전달

### 규칙

- 컴포넌트 props는 공개 경계이므로 타입을 명시한다.
- 일반 데이터, 함수, boolean 순으로 두면 읽기 쉽지만 의미 있는 그룹이 있으면 그 그룹을 우선한다.
- boolean shorthand는 값이 `true`임이 분명할 때 사용한다.
- HTML 기본 props와 충돌하거나 의미가 모호한 이름을 만들지 않는다.

```tsx
type CustomButtonProps = {
  title: string;
  variant: "primary" | "secondary";
  size: "small" | "large";
  onClick: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

<CustomButton
  title="프로필 저장"
  variant="primary"
  size="large"
  onClick={handleUpdateProfile}
  disabled={isPending}
  autoFocus
/>;
```

JSX props 순서는 읽기 보조 규칙이다. 순서만 다르다는 이유로 병합을 막거나 동작 변경과 섞인 대규모 정리를 하지 않는다.

## 5. Import 규칙

### 규칙

- 외부 package와 내부 모듈을 빈 줄로 구분한다.
- 다른 screen이나 최상위 공통 영역을 참조할 때는 `@/` alias를 사용한다.
- 같은 screen 폴더 안의 강하게 결합된 파일은 상대 경로를 사용할 수 있다.
- type-only 의존성은 `import type`으로 드러낸다.
- 구현 파일을 일반적인 `index.ts` barrel 뒤에 숨기지 않는다.

```tsx
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { fetchDocument } from "@/services/documents";
import { DocumentHeader } from "./components/DocumentHeader";
import type { DocumentDetailScreenProps } from "./document-detail.types";
```

### 이유

`@/`는 깊은 `../../../` 경로를 없애고 최상위 경계를 드러낸다. 같은 screen 안의 상대 경로는 코드가 함께 이동하는 지역 의존성임을 보여 준다.

alias import와 상대 import 중 어느 것을 선택했는지는 브라우저가 로드하는 모듈 수를 줄이지 않는다. 둘 다 Next.js bundler가 같은 module graph로 해석한다. 번들 크기는 실제로 client boundary가 가져간 코드, package의 export 방식, side effect와 tree-shaking 가능성에 영향을 받는다.

따라서 다음 주장은 사용하지 않는다.

```text
절대 경로로 import하면 로드가 줄어든다.
파일별 import는 언제나 package root import보다 작다.
```

package의 공식 문서가 subpath import를 제공하거나 측정 결과가 있을 때만 bundle 최적화를 이유로 import 경로를 바꾼다.

### Barrel 사용 기준

`index.ts`는 package 또는 독립 모듈의 의도적인 공개 API를 정의할 때 사용할 수 있다. 앱 내부 구현 파일을 무조건 재수출하면 실제 소유권, 순환 의존성과 사용되지 않는 export를 찾기 어려워질 수 있다.

```ts
// package의 공개 API라면 가능
export { Button } from "./Button";
export type { ButtonProps } from "./Button.types";
```

이 저장소의 화면과 단일 util 구현은 `HomeScreen.tsx`, `server.ts`, `cn.ts`처럼 직접적인 파일 이름을 사용한다. `page.tsx`와 `layout.tsx`는 Next.js가 요구하는 route 파일 이름이므로 예외다.

근거: [Next.js Absolute Imports and Module Path Aliases](https://nextjs.org/docs/app/getting-started/installation#set-up-absolute-imports-and-module-path-aliases), [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components), [TypeScript type-only imports](https://www.typescriptlang.org/docs/handbook/modules/reference.html#type-only-imports-and-exports)

## 6. 함수와 event handler

- JSX에서 사용하는 handler는 `handleSave`, `handleRetry`처럼 사용자 행동을 표현한다.
- 다른 계층에 전달하는 callback prop은 `onSave`, `onRetry`처럼 이벤트 계약으로 표현한다.
- 이름에 없는 toast, redirect, storage 기록과 analytics를 함수 안에 숨기지 않는다.
- 여러 단계의 동작을 조합하는 함수라면 이름이 그 흐름을 설명해야 한다.

```ts
// 피해야 함: 조회 함수 안에 분석 이벤트가 숨음
async function fetchDocument() {
  const document = await apiClient.get("/document");
  analytics.track("document_opened");
  return document;
}

// 권장: 데이터 경계와 사용자 행동을 분리
async function fetchDocument() {
  return apiClient.get("/document");
}

async function handleOpenDocument() {
  const document = await fetchDocument();
  analytics.track("document_opened");
  return document;
}
```

## 7. 한 파일의 책임

한 파일은 하나의 주된 책임을 가진다. 이는 “한 파일에는 함수 하나만 둔다”는 뜻이 아니다. 함께 읽고 함께 바뀌는 작은 helper는 같은 파일에 둘 수 있다.

다음 경우 분리를 검토한다.

- 독립된 이름과 입력·출력이 있다.
- 다른 이유로 변경된다.
- 독립적으로 검증할 가치가 있다.
- 읽는 사람이 세 개 이상의 별도 상태 전이나 외부 경계를 동시에 추적해야 한다.

다음 경우에는 먼저 같은 파일에 둔다.

- 짧고 해당 컴포넌트에서만 의미가 있다.
- 분리하면 호출부와 구현을 계속 왕복해야 한다.
- 아직 별도 책임의 이름을 정할 수 없다.

## 8. 빠른 체크리스트

- 파일명과 컴포넌트명이 일치하는가
- 입력 → 상태 → 파생 값 → 행동 → 화면 흐름이 읽히는가
- 단순 파생 값을 Effect state나 불필요한 `useMemo`로 복제하지 않았는가
- screen 경계 밖은 `@/`, screen 내부는 필요한 경우 상대 경로를 사용했는가
- type-only import를 구분했는가
- import 방식에 근거 없는 번들 성능 주장을 붙이지 않았는가
- 숨은 toast, 이동, cache 변경과 storage 기록이 없는가
- 형식 규칙보다 정확성, 접근성과 검증을 우선했는가
