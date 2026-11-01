> 중첩된 filter/some/&& 조건을 사람이 읽을 수 있는 문장으로 바꾸자는 내용이다.

# 복잡한 조건에 이름 붙이기

## 왜 필요한가

복잡한 조건식은 맞더라도 읽는 사람이 의미를 복원해야 한다.
그 비용이 크면 리뷰와 수정이 느려진다.

## 프로젝트 규칙

- `&&`, `||`, `some`, `every`, `filter`가 중첩되면 조건을 변수/함수로 뽑는다.
- 조건 이름은 "무엇을 만족하는가"를 드러낸다.
- 불리언 변수는 `is`, `has`, `can`, `should` 접두어를 사용한다.

## 예시

### 안 좋은 예

```ts
const visibleDocs = docs.filter(
  (doc) =>
    doc.ownerId === user.id &&
    doc.status !== "ARCHIVED" &&
    (doc.visibility === "PUBLIC" || doc.sharedWith.includes(user.id)) &&
    !doc.isDeleted,
);
```

### 좋은 예

```ts
const isOwnedByCurrentUser = (doc: Document) => doc.ownerId === user.id;
const isActiveDocument = (doc: Document) =>
  doc.status !== "ARCHIVED" && !doc.isDeleted;
const canBeViewedByCurrentUser = (doc: Document) =>
  doc.visibility === "PUBLIC" || doc.sharedWith.includes(user.id);

const visibleDocs = docs.filter(
  (doc) =>
    isOwnedByCurrentUser(doc) &&
    isActiveDocument(doc) &&
    canBeViewedByCurrentUser(doc),
);
```

### 주의

이름만 늘리고 의미가 더 모호해지면 안 된다.
checkCondition, flag, statusOk 같은 이름은 금지한다.
