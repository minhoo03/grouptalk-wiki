"use server";

import { sharedWikiSchema } from "@/services/sharedWiki/sharedWiki.schema";
import { saveSharedWiki } from "@/services/sharedWiki/sharedWiki";

export type CreateShareLinkResult =
  | { ok: true; code: string }
  | { ok: false; message: string };

/** next.config.ts의 serverActions.bodySizeLimit(5mb)보다 작게 잡아 JSON 직렬화 크기를 제한한다. */
const MAX_SHARED_JSON_CHARS = 4 * 1024 * 1024;

/**
 * 생성된 단톡방 문서를 암호화해 저장하고 숏링크 코드를 돌려준다.
 * Server Action은 누구나 호출할 수 있는 공개 endpoint이므로 입력을 다시 검증한다.
 * 예상 가능한 실패는 값으로 반환해 버튼 근처에서 안내한다.
 */
export async function createShareLinkAction(
  input: unknown,
): Promise<CreateShareLinkResult> {
  const parsed = sharedWikiSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "공유할 문서 형식이 올바르지 않아요." };
  }
  if (JSON.stringify(parsed.data).length > MAX_SHARED_JSON_CHARS) {
    return {
      ok: false,
      message: "문서가 너무 커서 공유할 수 없어요. 더 짧은 기간의 대화로 시도해 주세요.",
    };
  }

  try {
    const code = await saveSharedWiki(parsed.data);
    return { ok: true, code };
  } catch (error) {
    console.error("[단톡위키] 공유 링크 생성 실패", error);
    return {
      ok: false,
      message: "공유 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.",
    };
  }
}
