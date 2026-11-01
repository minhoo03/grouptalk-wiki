# /pr-generate

## Overview

현재 브랜치의 변경사항을 분석하여 Pull Request를 자동으로 생성하는 커맨드입니다.

**사용 시점**

- 코드 변경이 완료되어 PR을 생성할 준비가 되었을 때
- 커밋이 이미 완료되었고 원격 저장소에 푸시할 준비가 되었을 때

## Prerequisites / Notes

**필수 요구사항**

- GitHub CLI (`gh`) 설치 및 인증 완료 - https://cli.github.com/
- `gh auth login` 완료
- 프로젝트에 `docs/dev-guidelines/PULL_REQUEST.md` 파일 존재
- 프로젝트에 `docs/dev-guidelines/COMMIT_CONVENTION.md` 파일 존재
- Git 저장소가 GitHub에 연결되어 있어야 함
- main 브랜치 대비 커밋된 변경사항이 있어야 함

**주의사항**

- main/master 브랜치가 아닌 작업 브랜치에서 실행 권장
- 원격 추적 브랜치가 없는 경우 자동으로 설정됨 (`git push -u origin`)

## Usage

```bash
/pr-generate
```

커맨드만 입력하면 모든 작업이 자동으로 진행됩니다.

## How It Works

**처리 과정**

1. `git log main..HEAD`로 현재 브랜치의 커밋 목록 확인
2. `git diff main..HEAD`로 main 브랜치 대비 변경 내용 분석
3. `COMMIT_CONVENTION.md` 규칙에 따라 커밋 타입 판단 (feat/fix/refactor/docs/chore)
4. PR 제목 자동 생성 (커밋 메시지 기반)
5. `PULL_REQUEST.md` 템플릿에 맞춰 PR 본문 작성
6. 현재 브랜치를 원격 저장소에 푸시
7. GitHub CLI를 통해 PR 생성

**준수하는 규칙**

- PR 본문은 `PULL_REQUEST.md`의 구조를 엄격히 따름
- 작업 유형(기능 개발/버그 개선/리팩토링) 자동 선택
- 섹션별 내용을 변경사항 기반으로 자동 채움

## Output

**생성되는 내용**

- PR 제목: `[type] 작업 내용 요약`
- PR 본문: `PULL_REQUEST.md` 형식의 완전한 문서

**PR 본문 구조**

- 작업 유형 (체크박스)
- 작업 요약
- 작업 배경/목적
- 작업 내용 (변경 유형에 따라 다름)
- UI 변경사항
- 테스트 및 검증
- 참고 자료
- 추가 메모

**실행 결과**

- GitHub에 새로운 Pull Request 생성
- PR URL 반환
