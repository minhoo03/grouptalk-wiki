> 가독성 관점에서는 **숫자의 의미가 드러나야 한다**는 점이 핵심이다.

# 매직 넘버에 이름 붙이기

## 왜 필요한가

숫자 그 자체는 맥락이 없다.
특히 시간, 길이, 제한 수치, 페이지 크기, 재시도 횟수는 이름이 없으면 의도가 사라진다.

## 프로젝트 규칙

아래 값은 상수화한다.

- debounce 시간
- polling interval
- max file size
- page size
- editor autosave interval
- AI job retry count
- upload timeout

## 예시

### 안 좋은 예

```ts
await delay(300);
const PAGE_SIZE = 20; // 이것조차 맥락이 부족할 수 있음
```

### 좋은 예

```ts
const LIKE_SYNC_DELAY_MS = 300;
const DOCUMENT_LIST_PAGE_SIZE = 20;
const EDITOR_AUTOSAVE_INTERVAL_MS = 5000;
```

### 어디에 둘까

- 앱 전체에서 쓰이면 `constants/`

- 특정 screen 전용이면 `screens/<name>/`의 소유 코드 가까이

### 금지

- 5000, 20, 3 같은 숫자를 직접 여러 파일에 복붙
