import type { RoomProfile } from "@/types/chat";

export const HOME_PATH = "/";
export const ROOM_PATH = "/room";

export function sharedWikiPath(code: string) {
  return `/s/${encodeURIComponent(code)}`;
}

export function personPath(name: string) {
  return `/person?name=${encodeURIComponent(name)}`;
}

export function searchPath(query: string) {
  return `/search?q=${encodeURIComponent(query)}`;
}

/**
 * 검색어를 문서 경로로 바꾼다.
 * 우선순위: 단톡방 이름 정확히 일치 → 인물 이름 정확히 일치 → 인물 이름 부분 일치 → 단톡방 이름 부분 일치 → 없는 문서.
 */
export function resolveSearchPath(room: RoomProfile | null, query: string) {
  if (!room) return searchPath(query);

  const normalizedQuery = query.toLowerCase();
  const names = room.participants.map((person) => person.name);
  const roomTitle = room.roomTitle.toLowerCase();

  if (roomTitle === normalizedQuery) return ROOM_PATH;

  const exactName = names.find(
    (name) => name.toLowerCase() === normalizedQuery,
  );
  const partialName = names.find((name) =>
    name.toLowerCase().includes(normalizedQuery),
  );
  const matchedName = exactName ?? partialName;
  if (matchedName) return personPath(matchedName);

  if (roomTitle.includes(normalizedQuery)) return ROOM_PATH;
  return searchPath(query);
}

/** URL 검색 파라미터는 외부 입력이므로 배열·누락 값을 빈 문자열로 좁힌다. */
export function readSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}
