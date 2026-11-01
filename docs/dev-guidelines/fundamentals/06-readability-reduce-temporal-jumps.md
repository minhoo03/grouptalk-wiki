> 읽는 사람이 한 줄에서 선언된 추상 개념을 해석하려고 다른 파일/함수/정책으로 자꾸 점프하지 않게 하라는 취지다. 권한 정책 예시에서 `policy.canInvite` 같은 추상값이 실제 의미를 숨길 수 있음을 보여준다.

# 시점 이동 줄이기

## 왜 필요한가

코드를 이해하기 위해

- 다른 변수 선언으로 이동하고
- 다른 함수 정의로 이동하고
- 다른 파일 정책으로 이동해야 하면
  읽는 흐름이 끊긴다.

## 프로젝트 규칙

- 화면 바로 앞에서 필요한 핵심 판단은 너무 멀리 숨기지 않는다.
- 단순한 표시 조건은 화면 근처에 둔다.
- 너무 추상적인 boolean 하나로 실제 의미를 감추지 않는다.

## 예시

### 안 좋은 예

```ts
const policy = getPolicyByRole(user.role);
<Button disabled={!policy.canEdit}>수정</Button>
```

이 경우 canEdit가 정확히 무엇인지 다시 따라가야 한다.

### 좋은 예

```ts
const isOwner = document.ownerId === user.id;
const isAdmin = user.role === "ADMIN";
const canEditDocument = isOwner || isAdmin;

<Button disabled={!canEditDocument}>수정</Button>
```

### 원칙

- 읽는 곳 근처에서 이해 가능한가?

- 한 단계 추상화가 의미를 더 분명하게 만드는가? 둘 중 하나라도 아니면 숨기지 않는다.
