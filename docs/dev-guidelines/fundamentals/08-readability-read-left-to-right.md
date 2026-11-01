> 범위 비교가 수학식처럼 자연스럽게 읽히도록 정리하자. 핵심은 **사람이 읽기 편한 비교 순서**다.

# 왼쪽에서 오른쪽으로 읽히게 하기

## 왜 필요한가

사람은 조건을 왼쪽에서 오른쪽으로 읽는다.
같은 값을 두 번 비교하는 조건은 읽는 비용이 크다.

## 프로젝트 규칙

- 비교 기준을 통일한다.
- 범위 비교는 헬퍼 함수로 감싼다.
- `a >= b && a <= c` 같은 패턴은 의미 함수로 바꾼다.

## 예시

### 안 좋은 예

```ts
if (size >= minSize && size <= maxSize) { ... }
if (score >= 0 && score <= 100) { ... }
```

### 좋은 예

```ts
function isBetween(value: number, min: number, max: number) {
  return min <= value && value <= max;
}

if (isBetween(size, minSize, maxSize)) { ... }
if (isBetween(score, 0, 100)) { ... }
```

### 자주 쓰이는 곳

- 파일 크기 제한

- 페이지 번호 범위

- 점수/유사도 범위

- AI confidence threshold
