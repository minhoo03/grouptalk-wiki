> 폼을 볼 때도 응집도를 생각하자. 필드 단위와 폼 단위 응집을 구분해서 설계해야 유지보수가 쉽다.

# 폼의 응집도 생각하기

## 왜 필요한가

폼은 보통

- 입력값
- 검증
- 에러 표시
- 제출
- 서버 에러 매핑
  이 함께 바뀐다.

이걸 흩어 놓으면 수정 범위가 커진다.

## 프로젝트 규칙

- 필드 고유 검증은 필드 근처에 둔다.
- 폼 전체 규칙은 schema에 둔다.
- 서버 payload 변환은 submit action에서 처리한다.
- 화면 에러 문구와 validation rule을 너무 멀리 떼어놓지 않는다.

## 추천 설계

- `schema/document-upload.schema.ts`
- `ui/document-upload-form.tsx`
- `lib/map-document-upload-form-to-payload.ts`
- `hooks/use-document-upload-form.ts`

## 예시

문서 업로드 폼에서

- 파일 타입 검증
- 파일 크기 검증
- 제목 필수값
- 태그 최대 개수
  는 schema와 필드 근처에서 함께 읽혀야 한다.

## 주의

폼 상태와 제출 mutation, 성공 후 라우팅까지 한 파일에 다 욱여넣지 않는다.
