> wrapper와 원본 라이브러리 이름이 같으면 혼란이 생긴다.

# 이름 겹치지 않게 관리하기

## 왜 필요한가

같은 이름이 서로 다른 계층에서 같은 파일/문맥에 등장하면
읽는 사람은 "이게 원본인지 래퍼인지" 계속 확인해야 한다.

## 프로젝트 규칙

- 외부 라이브러리 wrapper는 원본 이름과 다르게 짓는다.
- domain 타입과 API 응답 타입도 이름을 구분한다.
- UI model, server model, form model 이름을 분리한다.

## 예시

### 안 좋은 예

- `http` 라이브러리를 감싼 파일도 `http`
- 서버 응답도 `Document`, 화면 모델도 `Document`

### 좋은 예

- `apiClient`
- `serverDocumentResponse`
- `documentListItem`
- `documentFormValues`

## 추천 접미사

- `Response`
- `Payload`
- `Params`
- `Values`
- `Model`
- `Item`
- `Entity`

## 금지

- `data`
- `result`
- `item`
- `info`
  같이 맥락 없는 범용 이름 남발
