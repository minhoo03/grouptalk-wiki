# 프론트엔드 코드 운영 규칙

상세 문서는 가독성, 예측 가능성, 응집도와 결합도라는 네 축으로 코드를 검토한다. 다음은 이 저장소의 기본 합의다.

## screen은 주요 상태와 UI를 조립한다

인증, API 세부사항과 응답 정규화를 `Screen.tsx`에 길게 두지 않는다. 그렇다고 모든 짧은 로직을 hook으로 옮기지도 않는다.

- 단순 UI state와 짧은 handler: 컴포넌트
- 서버 상태: TanStack Query
- 계산·검증·변환: 순수 함수
- 여러 상태 전이와 생명주기를 가진 행동: custom hook

## screen 전용 코드는 screen 안에 둔다

`components/`, `hooks/`, `utils/`는 여러 screen이 같은 정책으로 사용할 때만 최상위로 올린다. 한 screen에서만 바뀌는 코드는 `screens/<name>/` 안에 colocate한다.

## service는 외부 데이터 경계를 담당한다

API 함수는 요청, status와 응답 검증을 담당한다. toast, modal, 화면 이동 같은 UI 흐름은 호출하는 action이나 screen에서 명시적으로 조합한다.

## 상태의 원본을 복제하지 않는다

서버 데이터는 Query cache, 가까운 UI 상태는 React state, 공유 클라이언트 상태는 필요한 경우 Zustand, 재현해야 할 조회 조건은 URL이 소유한다.

## 공통화보다 변경 방향을 먼저 본다

“두 번 사용했다”가 아니라 앞으로도 같은 이유로 함께 바뀌는지가 기준이다. 독립적으로 달라질 모달, 리스트와 툴바는 짧은 중복이 잘못된 공통화보다 안전할 수 있다.

## 숫자와 문자열 정책에 이름을 준다

debounce 시간, polling interval, 파일 크기와 page size처럼 의미가 숨는 값에는 이름을 준다. 한 screen만 소유하는 정책은 그 screen 가까이에 둔다.

## Context와 전역 상태는 전달 깊이만으로 결정하지 않는다

중간 컴포넌트가 값을 사용하지 않는지, composition으로 해결되는지, 소비자가 실제로 넓게 분포하는지를 먼저 확인한다. 상태 수명을 불필요하게 넓히지 않는다.

## 파생 값과 Effect를 구분한다

현재 props와 state로 계산할 수 있는 값은 렌더 중 계산한다. Effect는 외부 시스템과 동기화할 때 사용하며 시작한 구독, listener와 timer를 cleanup한다.

상세 판단은 [프로젝트 구조 가이드](../FRONTEND-PROJECT-STRUCTURE-GUIDE.md)와 [React 애플리케이션 컨벤션](../REACT-APPLICATION-CONVENTIONS.md)을 따른다.
