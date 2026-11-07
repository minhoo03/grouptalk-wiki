"use server";

import { isLlmConfigured } from "@/services/wikiWriter/gemini";
import {
  wikiProseRequestSchema,
  type WikiProseResponse,
} from "@/services/wikiWriter/wikiWriter.schema";
import {
  writePersonProse,
  writeRoomProse,
} from "@/services/wikiWriter/wikiWriter";

const EMPTY: WikiProseResponse = { room: null, person: null };

/**
 * 분석 자료를 받아 Gemini로 단톡방·인물 문서의 서술 문단을 쓴다.
 * 공개 endpoint이므로 입력을 다시 검증한다. AI 서술은 부가 기능이라
 * 어떤 실패도 throw하지 않고 빈 결과를 돌려주며, 그때 화면은 규칙 기반 문장을 유지한다.
 */
export async function writeWikiProseAction(
  input: unknown,
): Promise<WikiProseResponse> {
  if (!isLlmConfigured()) return EMPTY;

  const parsed = wikiProseRequestSchema.safeParse(input);
  if (!parsed.success) {
    console.error("[단톡위키] AI 서술 요청 형식 오류", parsed.error.issues);
    return EMPTY;
  }

  const [room, person] = await Promise.all([
    writeRoomProse(parsed.data.room).catch((error: unknown) => {
      console.error("[단톡위키] AI 단톡방 서술 실패", error);
      return null;
    }),
    writePersonProse(parsed.data.person).catch((error: unknown) => {
      console.error("[단톡위키] AI 인물 서술 실패", error);
      return null;
    }),
  ]);
  return { room, person };
}
