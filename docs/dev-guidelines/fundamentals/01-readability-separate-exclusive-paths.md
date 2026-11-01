> 하나의 컴포넌트 안에서 서로 배타적인 상태를 동시에 처리하면 읽기 어려워진다.

# 같이 실행되지 않는 코드 분리하기

## 왜 필요한가

한 컴포넌트 안에서

- 로딩 화면
- 권한 없음 화면
- 빈 상태 화면
- 정상 화면
- 에러 재시도 화면

을 모두 한 번에 처리하면, 읽는 사람은 실제로 동시에 실행되지 않는 경로를 머릿속에 같이 올려야 한다.

## 프로젝트 규칙

- 상태가 서로 배타적이면 서브 컴포넌트로 분리한다.
- `if`가 3개 이상 이어지면 “상태별 컴포넌트 분리”를 먼저 검토한다.
- 한 화면에서 역할이 다른 CTA도 분리한다.

## 안 좋은 예

- `DocumentListPage` 안에서
  - auth guard
  - empty state
  - loading skeleton
  - document card grid
  - quota warning
  - onboarding banner
    를 모두 처리

## 좋은 예

- `DocumentListPage`
  - `UnauthorizedDocumentView`
  - `DocumentListLoadingView`
  - `EmptyDocumentView`
  - `DocumentListContent`

## 체크리스트

- 이 분기들이 동시에 실행될 수 있는가?
- 아니면 상태별로 분리해도 되는가?
- 분기 로직이 렌더링 곳곳에 흩어져 있지 않은가?
