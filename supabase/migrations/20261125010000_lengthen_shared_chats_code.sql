-- 공유 코드를 8자리에서 16자리로 늘린다(src/services/sharedWiki/sharedWiki.ts의 CODE_LENGTH).
-- 이미 저장된 8자리 행은 1일 안에 만료되므로 NOT VALID로 기존 행 검사를 건너뛰고, 새로 넣는 행만 검사한다.
-- 제약 이름은 Postgres 기본 이름(shared_chats_id_check)이다. 실제 DB에 다른 이름의 id 제약이 있으면 그것도 지운다.

alter table public.shared_chats
  drop constraint if exists shared_chats_id_check;

alter table public.shared_chats
  add constraint shared_chats_id_check
  check (id ~ '^[A-Za-z0-9]{16}$') not valid;
