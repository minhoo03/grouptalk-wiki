> 함수 이름에 드러나지 않는 로깅 같은 숨은 부작용을 분리하자.

# 숨은 로직 드러내기

## 왜 필요한가

이름, 파라미터, 반환값만 보고 예측할 수 없는 일이 안에서 일어나면
사용하는 쪽이 동작을 오해한다.

## 프로젝트 규칙

아래 로직은 숨기지 않는다.

- logging
- analytics
- toast
- redirect
- cache invalidation
- localStorage/sessionStorage 기록
- editor focus 이동
- modal open/close

## 예시

### 안 좋은 예

```ts
async function fetchDocument() {
  const doc = await apiClient.get(...);
  analytics.track("document_fetched");
  return doc;
}
```

### 좋은 예

```ts
async function fetchDocument() {
  return apiClient.get(...);
}

async function handleOpenDocument() {
  const doc = await fetchDocument();
  analytics.track("document_opened");
  return doc;
}
```

### 원칙

- 조회 함수는 조회만

- 저장 함수는 저장만

- UI 행동은 해당 screen의 event handler, action 또는 목적이 분명한 hook에서 조합

### 예외

mutation의 성공·실패 callback처럼 동작과 직접 연결된 위치에 feedback을 둘 수 있다. TanStack Query v5의 query에는 `onSuccess`와 `onError` callback이 없으므로, query 조회 함수에 UI 부수효과를 숨기지 않는다.
