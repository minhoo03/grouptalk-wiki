> 같은 종류의 Hook이면 반환 타입 규칙을 통일하라고 말합니다. 예시로 API Hook 하나는 query 객체, 다른 하나는 data만 반환하는 문제를 지적한다.

# 같은 종류의 함수는 반환 타입 통일하기

## 왜 필요한가

같은 계열의 Hook인데 반환 타입이 제각각이면 사용할 때마다 구현을 열어봐야 한다.

## 프로젝트 규칙

### Query Hook

- 서버 조회 Hook은 기본적으로 `useQuery` 결과 객체를 반환한다.
- 특별한 이유가 없다면 TanStack Query 결과 객체를 반환해 `data`, `isPending`, `error`, `refetch` 같은 표준 상태를 유지한다.

### Mutation Hook

- `useMutation` 결과 객체를 그대로 반환하거나,
- `mutateAsync` 중심의 일관된 custom shape를 사용한다.
  둘 중 하나로 팀 규칙을 고정한다.

### Selector Hook

- selector 성격의 Hook만 순수 값 반환 허용

## 예시

### 추천

```ts
export function useDocumentListQuery(params: DocumentListParams) {
  return useQuery({
    queryKey: documentQueryKeys.list(params),
    queryFn: () => fetchDocumentList(params),
  });
}
```

### 지양

```ts
export function useDocumentList() {
  return useQuery(...).data;
}
```

### 이유

- Suspense 미사용 구간에서도 다루기 쉽다.

- 로딩/에러/리패치 제어가 표준화된다.

- 팀원이 다음 Hook도 같은 방식일 거라 예측할 수 있다.
