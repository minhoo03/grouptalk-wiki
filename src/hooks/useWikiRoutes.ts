import { useParams } from "next/navigation";

import { createWikiRoutes } from "@/utils/wikiRoutes";

/**
 * 지금 URL 기준의 문서 경로. `/s/[code]` 아래에 있으면 공유 문서 경로를, 아니면 기본 경로를 돌려준다.
 * store의 shareCode가 아니라 URL을 기준으로 삼아, 직접 만든 문서를 공유한 뒤에도 보고 있던 경로 체계가 바뀌지 않게 한다.
 * 코드 형식은 `/s/[code]` layout이 이미 검증했으므로 여기서는 다시 검사하지 않는다.
 */
export function useWikiRoutes() {
  const params = useParams<{ code?: string }>();
  const code = typeof params?.code === "string" ? params.code : null;
  return createWikiRoutes(code);
}
