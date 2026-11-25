import type { RoomProfile } from "@/types/chat";

export const HOME_PATH = "/";
export const ROOM_PATH = "/room";

export function sharedWikiPath(code: string) {
  return `/s/${encodeURIComponent(code)}`;
}

export type WikiRoutes = {
  room: string;
  person: (name: string) => string;
  search: (query: string) => string;
};

/**
 * 문서 사이를 오가는 경로.
 * 공유 링크로 연 문서는 `/s/{code}` 아래에서만 이동해야 새로고침하거나 주소를 다시 공유해도 같은 문서가 열린다.
 * 공유 코드가 없으면 메모리(store)에만 있는 문서를 보는 기본 경로를 쓴다.
 */
export function createWikiRoutes(shareCode: string | null): WikiRoutes {
  const base = shareCode ? sharedWikiPath(shareCode) : "";
  return {
    room: shareCode ? base : ROOM_PATH,
    person: (name) => `${base}/person?name=${encodeURIComponent(name)}`,
    search: (query) => `${base}/search?q=${encodeURIComponent(query)}`,
  };
}

/**
 * 검색어를 문서 경로로 바꾼다.
 * 우선순위: 단톡방 이름 정확히 일치 → 인물 이름 정확히 일치 → 인물 이름 부분 일치 → 단톡방 이름 부분 일치 → 없는 문서.
 */
export function resolveSearchPath(
  room: RoomProfile | null,
  query: string,
  routes: WikiRoutes,
) {
  if (!room) return routes.search(query);

  const normalizedQuery = query.toLowerCase();
  const names = room.participants.map((person) => person.name);
  const roomTitle = room.roomTitle.toLowerCase();

  if (roomTitle === normalizedQuery) return routes.room;

  const exactName = names.find(
    (name) => name.toLowerCase() === normalizedQuery,
  );
  const partialName = names.find((name) =>
    name.toLowerCase().includes(normalizedQuery),
  );
  const matchedName = exactName ?? partialName;
  if (matchedName) return routes.person(matchedName);

  if (roomTitle.includes(normalizedQuery)) return routes.room;
  return routes.search(query);
}

/** URL 검색 파라미터는 외부 입력이므로 배열·누락 값을 빈 문자열로 좁힌다. */
export function readSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}
