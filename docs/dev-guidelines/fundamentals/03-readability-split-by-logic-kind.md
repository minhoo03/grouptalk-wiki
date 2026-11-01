> 하나의 hook이 URL, 날짜 파싱, API 요청과 UI feedback까지 이유 없이 소유하면 읽기와 변경이 어려워진다.

# 로직 종류에 따라 합쳐진 함수 쪼개기

## 왜 필요한가

한 Hook이 여러 종류의 맥락을 동시에 다루면

- 읽기 어렵고
- 테스트가 어려워지고
- 수정 시 영향 범위를 예측하기 어려워진다.

## 프로젝트 규칙

하나의 hook이나 함수는 가능한 한 하나의 주된 변경 이유를 가진다.

- URL 상태 관리
- 폼 상태 관리
- 서버 상태 조회
- 서버 상태 변경
- 데이터 변환/정규화
- UI 이벤트 조합
- 에디터 인스턴스 제어

## 예시

### 안 좋은 예

`useDocumentPageState`

- search params 읽기
- query key 만들기
- API 요청
- 응답 정규화
- toast 처리
- modal 열기
- permission 판정

### 분리를 검토할 수 있는 예

- `useDocumentSearchParams`
- `useDocumentListQuery`
- `normalizeDocumentListResponse`
- `useDeleteDocumentAction`
- `useDocumentPermission`

## 주의

목록에 맞추려고 작은 화면에도 hook을 여섯 개씩 만들지 않는다. 독립적으로 변경하거나 검증할 이유가 있을 때 분리하고, screen hook이 관련 행동을 조합하는 것은 허용한다. React hook이 필요 없는 계산과 변환은 순수 함수로 둔다.
