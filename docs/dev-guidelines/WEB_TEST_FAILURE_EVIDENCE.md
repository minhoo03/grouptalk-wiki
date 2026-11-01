# 웹 테스트 실패 증거와 AI 검증 루프

이 문서는 웹 테스트 실패를 사람이 다시 판단할 수 있는 최소 증거로 남기고, AI를 원인 후보 정리와 반복 검증에 활용하는 기준이다. 별도 테스트 플랫폼이나 복잡한 리플레이 시스템을 만드는 것이 목적은 아니다.

현재 보일러플레이트에는 Vitest, Testing Library와 Playwright가 설치되어 있지 않다. 이 문서는 테스트 도구를 도입할 때 적용할 기준이며, package·설정·script가 실제로 추가되기 전에는 아래 결과물이 생성된다고 가정하지 않는다.

## 1. 기본 원칙

### 규칙

1. 순수 로직과 컴포넌트 상태는 Vitest와 Testing Library로 검증한다.
2. 뒤로가기, 실제 focus, storage처럼 브라우저가 결과에 영향을 주는 핵심 흐름만 Playwright로 검증한다.
3. Playwright 실패 시 기본 JSON 결과, trace와 실패 화면을 우선 사용한다.
4. 네트워크 순서가 원인인 테스트에만 민감정보를 제거한 fetch/XHR 로그를 추가한다.
5. AI는 코드를 수정하기 전에 확인된 사실, 원인 가설, 부족한 증거와 가장 작은 확인 실험을 구분한다.
6. 수정 후에는 실패했던 같은 테스트와 직접 관련된 낮은 계층 테스트를 다시 실행한다.

### 이유

Playwright Trace Viewer에는 action, DOM snapshot, console, network와 오류가 시간순으로 이미 들어 있다. 별도 이벤트 수집기를 크게 만들면 유지 비용과 중복만 늘어난다. 반대로 trace만으로 요청 순서를 정리하기 어렵다면 API 요청의 method·path·status·duration 정도만 작은 JSONL로 보완할 수 있다.

근거: [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer), [Playwright Reporters](https://playwright.dev/docs/test-reporters), [Vitest Reporters](https://vitest.dev/guide/reporters)

### 적용 조건

| 대상                                       | 기본 도구                   | 실패 시 필요한 최소 증거               |
| ------------------------------------------ | --------------------------- | -------------------------------------- |
| 계산, parser, 상태 전이                    | Vitest                      | 오류, 기대값·실제값, stack             |
| 컴포넌트의 로딩·오류·사용자 동작           | Vitest + Testing Library    | 사용자 행동, 관련 DOM, mocked API 순서 |
| history, 실제 focus, storage, 브라우저 API | Playwright                  | JSON 결과, trace, screenshot           |
| 요청 순서가 중요한 브라우저 실패           | Playwright + 선택적 fixture | 위 자료와 정제된 API JSONL             |

### 예외

- 순수 함수 실패에 trace나 영상을 만들지 않는다.
- 같은 사례를 Vitest와 Playwright에 중복 작성하지 않는다.
- 애니메이션, drag, focus 이동처럼 화면의 시간 흐름이 원인일 때만 영상을 켠다.

## 2. Playwright 도입 기준

Playwright의 `webServer`로 Next.js 개발 서버나 빌드 서버를 실행해 App Router의 실제 브라우저 흐름을 검증할 수 있다.

도입할 때는 다음 기본값을 검토한다.

- 사용자에게 보이는 role, accessible name, URL과 화면 상태를 검증한다.
- 각 테스트는 다른 테스트의 로그인·데이터·실행 순서에 의존하지 않는다.
- `trace: "retain-on-failure"`, `screenshot: "only-on-failure"`를 기본 후보로 둔다.
- JSON reporter는 CI나 AI가 실패 목록을 기계적으로 읽어야 할 때 추가한다.
- video는 항상 켜지 않고 실제 시간 흐름이 필요한 실패에서만 선택한다.
- retry와 timeout 증가는 원인을 가리는 기본 해결책으로 사용하지 않는다.

근거: [Playwright Best Practices](https://playwright.dev/docs/best-practices), [Playwright Recording Options](https://playwright.dev/docs/test-use-options#recording-options)

## 3. 실패 증거 구조

테스트 환경을 실제로 도입하면 결과 위치를 저장소에서 하나로 정한다. 다음은 권장 예시이지 현재 생성되는 파일 목록이 아니다.

```text
test-results/
  vitest/
    results.json
  playwright/
    results.json
    <failed-test>/
      trace.zip
      test-failed-1.png
      attachments/
        network.jsonl
```

- 성공한 실행의 trace, screenshot과 network log는 보존하지 않는다.
- 생성물은 기본적으로 Git에 커밋하지 않는다.
- CI artifact 보존 기간과 공개 범위는 프로젝트의 데이터 민감도에 맞춘다.
- 테스트 이름에는 단독 재실행에 사용할 수 있는 짧고 안정적인 식별자를 둔다.

## 4. 선택적 네트워크 JSONL

요청 순서나 취소가 실패 원인일 때만 다음 정도의 정보를 남긴다.

```jsonl
{"ts":"2026-10-31T00:03:51.978Z","seq":1,"requestId":"req-1","kind":"request","method":"GET","urlPath":"/api/documents"}
{"ts":"2026-10-31T00:03:52.138Z","seq":2,"requestId":"req-1","kind":"response","method":"GET","urlPath":"/api/documents","status":200,"durationMs":160}
```

- URL query, request·response body와 header는 기본적으로 저장하지 않는다.
- token, cookie, password, 개인정보와 session 값은 기록 전에 제거한다.
- 성공한 테스트의 네트워크 로그는 저장하지 않는다.
- 더 많은 데이터가 필요하면 원인 가설에 필요한 field만 명시적으로 추가한다.

## 5. AI를 사용하는 순서

1. 개발자가 기대 결과, 변경 허용 범위와 지켜야 할 조건을 적는다.
2. AI에는 실패 결과 JSON, 오류 메시지, 정제된 네트워크 로그와 관련 코드만 먼저 제공한다.
3. AI는 확인된 사실, 원인 가설, 반증 조건과 가장 작은 재현 실험을 제시한다.
4. trace와 screenshot은 사람이 먼저 민감정보를 확인한 뒤 필요한 경우에만 추가로 제공한다.
5. 개발자가 수정 방향을 선택하고 최소 범위로 구현한다.
6. 같은 테스트 식별자와 관련 단위·컴포넌트 테스트를 다시 실행한다.
7. 채택·수정·거절한 AI 제안과 실제 검증 결과를 작업 기록이나 PR에 남긴다.

AI에게 영상이나 trace만 주고 “알아서 고쳐”라고 하지 않는다. 또한 AI가 제품 코드와 테스트 기대값을 근거 없이 동시에 바꾸게 두지 않는다.

## 6. 민감정보와 CI

trace와 screenshot에는 화면 입력값이나 응답 데이터가 포함될 수 있으므로 기본적으로 외부 AI 공유 대상이 아니다. 로컬에서 사람이 확인한 뒤 필요한 부분만 전달한다.

공개 CI에는 다음처럼 정제한 자료만 올리는 것을 기본으로 검토한다.

- 테스트 결과 JSON
- 민감정보를 제거한 선택적 JSONL
- 공개 가능한 console과 오류 요약

trace, screenshot과 video를 CI artifact로 올려야 한다면 접근 권한, 보존 기간과 포함 데이터를 먼저 확인한다.

근거: [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), [GitHub Actions artifact 보존](https://docs.github.com/en/actions/tutorials/store-and-share-data)

## 7. 오버엔지니어링 방지

- Playwright 기본 reporter와 trace로 충분하면 custom reporter를 만들지 않는다.
- 성공 실행의 trace·screenshot·network log를 보존하지 않는다.
- 모든 테스트에 영상과 복잡한 로그 수집을 강제하지 않는다.
- flake 원인이 확인되지 않은 상태에서 retry를 추가하지 않는다.
- 실패 증거가 반복해서 부족할 때만 수집 항목을 확장한다.
- 테스트 도구를 도입하지 않은 프로젝트에 실행 명령과 artifact 경로만 먼저 약속하지 않는다.
