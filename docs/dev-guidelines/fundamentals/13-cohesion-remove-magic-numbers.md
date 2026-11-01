> 같은 “매직 넘버”라도 응집도 관점에서는 **같이 바뀌어야 할 규칙이 떨어져 있으면 위험하다**는 점이 핵심이다.

# 매직 넘버 없애기

## 왜 필요한가

숫자 이름이 없으면 읽기 힘들 뿐 아니라,
관련 정책이 바뀌어도 같이 수정되어야 할 지점을 놓치기 쉽다.

## 프로젝트 규칙

정책 숫자는 반드시 한 곳에서 관리한다.

- 업로드 최대 파일 크기
- chunk size
- AI polling interval
- editor autosave interval
- 검색 debounce
- cache stale time / gc time
- pagination size

## 예시

```ts
export const DOCUMENT_UPLOAD_MAX_SIZE_MB = 50;
export const AI_JOB_POLLING_INTERVAL_MS = 3000;
export const DOCUMENT_SEARCH_DEBOUNCE_MS = 250;
```

### 위치

- 앱 전체 정책이면 `constants/`

- 특정 screen 전용이면 `screens/<name>/`의 소유 코드 가까이

### 추가 규칙

상수 이름만 만들고 실제 관계를 안 묶으면 안 된다.
예:

- 애니메이션 duration은 CSS와 TS에서 같은 정책을 보게 할 것
- staleTime은 query key 설계와 함께 문서화할 것
