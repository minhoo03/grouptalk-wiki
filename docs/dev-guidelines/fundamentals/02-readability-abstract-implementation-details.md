> screen은 사용자가 보는 주요 상태와 UI가 먼저 읽혀야 한다. 구현 상세는 이름 붙일 독립 책임이 있을 때만 분리한다.

# 구현 상세 추상화하기

## 왜 필요한가

screen은 "무엇을 하는지"가 먼저 읽혀야 한다.
세부 구현이 먼저 나오면 화면의 역할이 흐려진다.

## 프로젝트 규칙

- 라우팅 보호, 인증, 권한과 feature flag처럼 반복되는 정책은 목적이 드러나는 컴포넌트나 hook으로 분리할 수 있다.
- screen은 사용자 상태와 주요 UI 영역이 먼저 읽혀야 한다.
- 화면 전용 구현은 `screens/<name>/` 안에 두고, 단순한 조건까지 무조건 wrapper로 감추지 않는다.

## 예시

### 안 좋은 예

`EditorPage`에서 직접:

- 로그인 여부 확인
- 문서 접근 권한 확인
- 없으면 `/login` 이동
- 초안 복구 여부 확인
- 협업 세션 초기화

### 좋은 예

- `RequireAuth`
- `RequireDocumentAccess`
- `useRestoreDraft`
- `useInitCollaborationSession`

screen에서는:

- "에디터를 렌더링한다"
- "필요한 섹션을 조립한다"
  정도만 보여야 한다.

## 네이밍 예시

- `useDocumentAccessGuard`
- `withAuthGuard`
- `useInitializeEditorSession`

## 금지

- screen 컴포넌트에서 `location.href`, `window.history`, raw role string 비교를 반복
