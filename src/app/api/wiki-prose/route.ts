import { isLlmConfigured } from "@/services/wikiWriter/gemini";
import { proseJobSchema } from "@/services/wikiWriter/wikiWriter.schema";
import { writeProseJob } from "@/services/wikiWriter/wikiWriter";

/**
 * AI 서술 묶음 하나를 쓴다.
 * Server Action은 클라이언트가 한 번에 하나씩만 보내므로, 묶음을 병렬로 보내고
 * 묶음마다 진행률을 보여 주기 위해 Route Handler로 둔다.
 * 공개 endpoint이므로 입력을 다시 검증한다.
 */

/** gemini.ts의 CALL_DEADLINE_MS(150초)보다 길게 둔다. */
export const maxDuration = 180;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = proseJobSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[단톡위키] AI 서술 요청 형식 오류", parsed.error.issues);
    return Response.json({ error: "invalid request" }, { status: 400 });
  }
  if (!isLlmConfigured()) {
    return Response.json({ kind: parsed.data.kind, result: null });
  }
  return Response.json(await writeProseJob(parsed.data));
}
