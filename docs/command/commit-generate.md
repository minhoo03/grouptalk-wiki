# /commit-generate

## Overview

현재 로컬 변경사항을 분석하여 프로젝트 커밋 규칙에 맞는 커밋을 자동으로 생성하는 커맨드입니다.

**사용 시점**

- 코드 작업이 완료되어 커밋할 준비가 되었을 때
- 여러 성격의 변경사항이 혼재되어 있어 커밋 분리가 필요할 때
- 커밋 메시지 작성이 번거로울 때

## Prerequisites / Notes

**필수 요구사항**

- Git 저장소 내에서 실행
- 프로젝트에 `docs/dev-guidelines/COMMIT_CONVENTION.md` 파일 존재
- 변경사항(staged 또는 unstaged)이 존재해야 함

**주의사항**

- main/master 브랜치에서 실행 시 경고 표시
- merge conflict 상태에서는 실행 불가
- 커밋 분리가 3개 이상인 경우 사용자 확인 요청 가능
- 이미 staged된 파일은 필요시 unstage 후 재분류됨

## Usage

```bash
/commit-generate
```

커맨드만 입력하면 자동으로 변경사항을 분석하고 커밋을 생성합니다.

## How It Works

**처리 과정**

1. `git status`와 `git diff`로 모든 변경사항 분석
2. 변경된 파일의 실제 내용을 읽고 성격 분류
3. 변경 유형에 따라 그룹화 (feat/fix/refactor/docs/chore)
4. 논리적으로 연관된 파일끼리 묶음
5. 커밋 계획 제시 (각 커밋별 포함 파일 목록)
6. 순차적으로 커밋 실행

**준수하는 규칙**

- `COMMIT_CONVENTION.md`의 형식을 엄격히 따름
- 커밋 형식: `[type] summary`
- One Commit = One Intent 원칙
- Avoid Mixed Commits 원칙

**분리 기준**

- feat와 refactor가 혼재: 분리
- feat와 chore(의존성)가 혼재: 분리
- 문서와 코드 변경: 분리
- 같은 기능의 여러 파일: 하나로 묶음
- 모든 변경이 같은 성격: 커밋 1개로 충분

## Output

**생성되는 커밋**

- 성격별로 분리된 여러 개의 커밋 (또는 1개)
- 각 커밋 메시지는 `COMMIT_CONVENTION.md` 형식 준수

**커밋 메시지 구조**

```
[type] 50자 내외 요약

상세 설명 (필요시)
```

**실행 예시**

```
커밋 계획

분석 결과: 총 3개의 커밋으로 분리합니다.

커밋 1: [feat] 로그인 OAuth 연동 추가
- src/screens/login/components/LoginForm.tsx
- src/services/auth.ts

커밋 2: [chore] OAuth 라이브러리 의존성 추가
- package.json

커밋 3: [docs] OAuth 설치 및 사용 방법 문서화
- README.md

---

총 3개의 커밋이 생성되었습니다.
```

**후속 작업 안내**

- 원격 푸시: `git push`
- PR 생성: `/pr-generate`
- 커밋 수정: `git reset --soft HEAD~N`
