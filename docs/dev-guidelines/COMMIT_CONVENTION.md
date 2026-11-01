# Commit Message Convention

이 문서는 **커밋 로그만으로 변경 의도와 맥락을 빠르게 파악**하기 위한 규칙이다.
릴리즈/핫픽스 상황에서도 **일관된 커밋 이력 관리**를 목표로 한다.

---

## 1. Goals (목적)

- 커밋 로그만 보고도 **무엇이 변경되었는지** 즉시 이해한다
- 변경 이력의 **추적 가능성**을 확보한다
- 릴리즈 / 핫픽스 상황에서도 **형식이 무너지지 않도록** 한다

---

## 2. Core Principles (기본 원칙)

1. **One Commit = One Intent**
   - 한 커밋에는 하나의 목적만 담는다 (기능 / 버그 / 리팩터링 등)

2. **Describe WHAT, not HOW**
   - 구현 방식보다 **변경 결과와 의도**를 중심으로 작성한다

3. **Avoid Mixed Commits**
   - 성격이 다른 변경은 커밋을 분리한다
     (예: `feat` + `style` → 분리 권장)

4. **Logic Impact Matters**
   - 동작이 바뀌지 않으면 `refactor`
   - 동작/결과가 바뀌면 `fix` 또는 `feat`

---

## 3. Commit Message Format (권장 형식)

```
[type] summary
```

예시

```
[feat] 로그인 시 토큰 재발급 로직 추가
```

### Rules

- Subject(요약)는 **50자 내외**
- 마침표(`.`)는 사용하지 않음 (로그 가독성)
- 상세 설명이 필요하면 한 줄 띄고 본문 작성
- 필요 시 Footer에 Breaking Change 명시

---

## 4. Commit Type Rules

| type       | 사용 목적                                   |
| ---------- | ------------------------------------------- |
| `feat`     | 사용자 관점의 기능 추가 또는 변경           |
| `fix`      | 버그 수정, 잘못된 동작 수정                 |
| `refactor` | **동작 변경 없이** 구조/가독성 개선         |
| `docs`     | 문서 수정 (README, Wiki 등)                 |
| `chore`    | 빌드, 설정, 의존성, 스크립트 등 운영성 작업 |
| `hotfix`   | 배포 후 긴급 수정 (운영 이슈 대응)          |

### refactor 기준

- 함수 분리
- 중복 제거
- 네이밍 개선
- 구조 정리
  **동작이 100% 동일해야 함**

---

## 5. Hotfix Rules (운영 기준)

- `hotfix`는 **배포 이후 긴급 수정**에만 사용
- 일반 `fix`와 구분하여 릴리즈 히스토리를 명확히 한다

---

## 6. Commit Message Examples

### Feature

```
[feat] 로그인 시 토큰 재발급 로직 추가
```

### Bug Fix

```
[fix] 중복 결제 요청 시 예외 처리 누락 수정
```

### Refactor (No Behavior Change)

```
[refactor] 결제 검증 로직 메서드 분리 및 네이밍 정리
```

### Docs

```
[docs] 로컬 실행 방법 및 환경변수 설명 추가
```

### Chore

```
[chore] 의존성 버전 업데이트 및 불필요 패키지 제거
```

### Hotfix

```
[hotfix] 운영 환경 결제 오류 긴급 수정
```

---

## 7. Anti-patterns (금지 / 주의)

### 의미 없는 메시지

```
[fix] 수정
[refactor] 정리
```

### 성격 혼합 커밋

- feat + style + chore 혼합
- 가능하면 목적별로 커밋 분리

### refactor로 버그 수정

- 버그가 고쳐졌다면 `fix` 사용
- 또는 refactor / fix 커밋 분리
