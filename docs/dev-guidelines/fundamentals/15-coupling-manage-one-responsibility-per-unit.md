> 결합도를 낮추기 위한 핵심 가이드. 하나의 unit이 URL 상태, 데이터 변환, UI 제어까지 다 잡으면 나중에 모든 것이 서로 묶인다.

# 책임을 하나씩 관리하기

## 왜 필요한가

책임이 여러 개 섞인 unit은 바꿀 때 영향 범위가 넓어진다.

## 프로젝트 규칙

- Hook 하나에 여러 계층 책임을 섞지 않는다.
- 컴포넌트는 UI 표현을 우선한다.
- screen의 event handler나 목적이 분명한 hook은 사용자 액션 흐름을 조합한다.
- services는 서버 통신을 담당한다.

## 예시

### 안 좋은 예

`useEditorPageState`

- URL tab 상태
- 문서 조회
- 에디터 인스턴스 초기화
- autosave
- toast
- 권한 검사
- analytics

### 좋은 예

- `useEditorTabParams`
- `useDocumentDetailQuery`
- `useEditorInstance`
- `useAutosaveDraft`
- `useEditorPermission`
- `useTrackEditorEvent`

## 판단 기준

“이 파일을 고칠 때 왜 unrelated 동작 테스트까지 해야 하지?”
싶으면 책임이 섞였을 가능성이 높다.
