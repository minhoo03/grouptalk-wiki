import { randomInt } from "node:crypto";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  SHARE_CODE_PATTERN,
  sharedWikiSchema,
  type SharedWiki,
} from "@/services/sharedWiki/sharedWiki.schema";
import {
  decryptText,
  encryptText,
} from "@/services/sharedWiki/sharedWikiCipher";

/**
 * 공유 문서 저장소(public.shared_chats) 접근.
 * secret key client를 쓰므로 서버(Server Component·Server Action)에서만 호출한다.
 * 행 삭제는 Supabase Cron이 expires_at 기준으로 처리한다.
 */

const TABLE = "shared_chats";
const CODE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CODE_LENGTH = 8;
const MAX_CODE_ATTEMPTS = 3;
/** Postgres unique_violation */
const UNIQUE_VIOLATION = "23505";

const encryptedRowSchema = z.object({
  ciphertext: z.string(),
  iv: z.string(),
});

function createShareCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** 암호화해 저장하고 숏링크 코드를 반환한다. 만료 시각은 DB 기본값(now() + 1일)을 따른다. */
export async function saveSharedWiki(sharedWiki: SharedWiki): Promise<string> {
  const supabase = createAdminClient();
  const plainText = JSON.stringify(sharedWiki);

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = createShareCode();
    const { ciphertext, iv } = encryptText(plainText, code);
    const { error } = await supabase
      .from(TABLE)
      .insert({ id: code, ciphertext, iv });

    if (!error) return code;
    if (error.code !== UNIQUE_VIOLATION) {
      throw new Error(`공유 문서 저장 실패: ${error.message}`);
    }
  }

  throw new Error("공유 코드 생성이 반복해서 충돌했습니다.");
}

/**
 * 코드에 해당하는 공유 문서를 복호화해 반환한다.
 * 형식이 틀린 코드, 없거나 만료된 행, 복호화·검증 실패는 모두 "없는 링크"로 보고 null을 반환한다.
 * DB 연결 오류처럼 예상하지 못한 실패만 throw해 Error Boundary가 처리하게 한다.
 */
export async function getSharedWiki(code: string): Promise<SharedWiki | null> {
  if (!SHARE_CODE_PATTERN.test(code)) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("ciphertext, iv")
    .eq("id", code)
    // Cron이 지우기 전이라도 만료된 문서는 보여 주지 않는다.
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error(`공유 문서 조회 실패: ${error.message}`);
  if (!data) return null;

  try {
    const row = encryptedRowSchema.parse(data);
    const json: unknown = JSON.parse(decryptText(row, code));
    return sharedWikiSchema.parse(json);
  } catch (decodeError) {
    console.error(`[단톡위키] 공유 문서(${code})를 복호화하지 못했습니다.`, decodeError);
    return null;
  }
}
