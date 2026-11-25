-- 공유 링크로 저장하는 단톡방 문서(src/services/sharedWiki/sharedWiki.ts).
--
-- 이미 운영 DB에 만들어진 테이블을 저장소에 기록하기 위해 2026-11-25에 다시 작성했다.
-- 컬럼 이름(id, ciphertext, iv, expires_at, created_at)은 실제 DB에서 확인했지만,
-- 타입·기본값·Cron 작업은 앱 코드에서 추정한 값이다. 운영 DB와 다르면 이 파일을 실제 정의에 맞춘다.
-- 여러 번 실행해도 결과가 같도록 작성했다.

create table if not exists public.shared_chats (
  -- 8자리 영숫자 숏링크 코드. 앱이 만들고 충돌하면(23505) 다시 만든다.
  id text primary key check (id ~ '^[A-Za-z0-9]{8}$'),
  -- base64(AES-256-GCM 암호문 || 인증 태그). 키는 서버 환경변수 ENCRYPTION_KEY에만 있다.
  ciphertext text not null,
  -- base64(12바이트 nonce)
  iv text not null,
  created_at timestamptz not null default now(),
  -- 앱은 이 값을 보내지 않고 기본값(1일)을 따른다. 조회할 때도 만료된 행은 걸러 낸다.
  expires_at timestamptz not null default now() + interval '1 day'
);

create index if not exists shared_chats_expires_at_idx
  on public.shared_chats (expires_at);

-- 서버는 RLS를 우회하는 secret key로만 접근한다.
-- 정책을 두지 않고 anon·authenticated 권한을 거둬 publishable key로는 읽거나 쓸 수 없게 한다.
alter table public.shared_chats enable row level security;
revoke all on table public.shared_chats from anon, authenticated;

-- 만료된 문서를 매시간 지운다. 같은 이름으로 다시 등록하면 기존 작업을 덮어쓴다.
create extension if not exists pg_cron;

select cron.schedule(
  'delete-expired-shared-chats',
  '0 * * * *',
  $$delete from public.shared_chats where expires_at <= now()$$
);
