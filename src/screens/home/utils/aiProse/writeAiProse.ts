import type { Excerpt } from "@/services/wikiWriter/wikiWriter.schema";
import type { GeneratedWiki } from "@/store/wikiStore";
import type { RoomProfile } from "@/types/chat";
import type { RoomWiki } from "@/types/wiki";
import { writeWikiProseAction } from "../../writeWikiProseAction";
import { applyRoomProse, toPersonProse } from "./applyProse";
import { buildProseRequest } from "./buildProseRequest";

type WriteAiProseInput = {
  room: RoomProfile;
  wiki: RoomWiki;
  excerpts: Excerpt[];
};

/**
 * 규칙 기반 문서에 AI 서술을 입힌다.
 * AI 서술은 부가 기능이므로 어떤 실패도 throw하지 않고 규칙 기반 문서를 그대로 돌려준다.
 */
export async function writeAiProse({
  room,
  wiki,
  excerpts,
}: WriteAiProseInput): Promise<GeneratedWiki> {
  const fallback: GeneratedWiki = {
    room,
    wiki,
    personProse: {},
    aiWritten: false,
  };

  try {
    const response = await writeWikiProseAction(
      buildProseRequest(room, wiki, excerpts),
    );
    const memberNames = new Set(room.participants.map((p) => p.name));
    const personProse = toPersonProse(response.person, memberNames);
    const aiWritten =
      Boolean(response.room?.sections.length) ||
      Object.keys(personProse).length > 0;

    return {
      room,
      wiki: applyRoomProse(wiki, response.room, memberNames),
      personProse,
      aiWritten,
    };
  } catch (error) {
    console.error("[단톡위키] AI 서술을 받지 못해 기본 문장을 사용합니다.", error);
    return fallback;
  }
}
