> 복잡한 중첩 삼항 연산자가 구조를 흐리므로 단순화하자.

# 삼항 연산자 단순하게 하기

## 왜 필요한가

중첩 삼항은 짧아 보여도 읽기는 어렵다.
특히 상태가 3개 이상이면 `if`나 매핑 객체가 더 낫다.

## 프로젝트 규칙

- 중첩 삼항 금지
- JSX에서 삼항 2회 이상 중첩 금지
- 상태가 3개 이상이면 함수 분리 또는 상태 맵 사용

## 예시

### 안 좋은 예

```tsx
const badge =
  job.status === "FAILED"
    ? "실패"
    : job.status === "DONE"
      ? "완료"
      : job.status === "PROCESSING"
        ? "처리 중"
        : "대기";
```

### 좋은 예

```ts
const JOB_STATUS_LABEL: Record<AiJobStatus, string> = {
  QUEUED: "대기",
  PROCESSING: "처리 중",
  DONE: "완료",
  FAILED: "실패",
};
```

```ts
function getJobStatusLabel(status: AiJobStatus) {
  if (status === "FAILED") return "실패";
  if (status === "DONE") return "완료";
  if (status === "PROCESSING") return "처리 중";
  return "대기";
}
```
