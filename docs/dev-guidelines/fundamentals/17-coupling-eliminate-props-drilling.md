> 동일한 prop이 중간 컴포넌트를 거쳐 계속 내려가면 수정 범위가 쓸데없이 넓어진다.

# Props Drilling 지우기

## 왜 필요한가

중간 컴포넌트가 실제로 쓰지도 않는 prop을 전달만 하면,
나중에 prop 하나를 없앨 때 관련 파일을 너무 많이 건드리게 된다.

## 프로젝트 규칙

아래 상황이 함께 나타나면 props drilling 제거를 검토한다.

- 여러 중간 컴포넌트가 값을 사용하지 않고 전달만 함
- 소비자가 한 subtree 안에 넓게 분포함
- 하나의 모달/섹션 내부에서만 공유되는 상태
- props 변경 때문에 관계없는 중간 컴포넌트의 API까지 계속 바뀜

## 해결 방법

- 먼저 component composition이나 children/slot
- Local Context
- Custom Hook + Provider

## 예시

`DocumentEditorModal -> DocumentEditorBody -> Toolbar -> SaveButton`
로 `documentId`, `canEdit`, `onSave`, `saving`을 계속 넘기지 않는다.

composition으로 충분하지 않고 subtree 전체가 같은 상태를 소유한다면:

- `DocumentEditorProvider`
- `useDocumentEditorContext`

를 사용한다.

## 주의

전역 상태로 올릴 필요가 없는 것은 로컬 context에 둔다.
props drilling을 없애겠다고 아무 상태나 zustand 전역 스토어로 올리면 오히려 더 나빠질 수 있다.
전달 단계 수만으로 Context를 만들지 않는다. 소비자 수, 상태 수명과 Provider 도입 비용을 함께 본다.
