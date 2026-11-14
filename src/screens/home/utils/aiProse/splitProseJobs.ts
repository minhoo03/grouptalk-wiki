import {
  PEOPLE_PER_JOB,
  ROOM_SUBS_PER_JOB,
  type PreferredModel,
  type ProseJob,
  type RoomProseRequest,
  type WikiProseRequest,
} from "@/services/wikiWriter/wikiWriter.schema";

type RoomSection = RoomProseRequest["sections"][number];

/**
 * 섹션을 하위 문단 ROOM_SUBS_PER_JOB개 이하의 묶음으로 나눈다.
 * 섹션은 되도록 한 묶음에 두고, 한 섹션이 상한보다 클 때만 쪼갠다.
 */
function splitRoomSections(sections: RoomSection[]): RoomSection[][] {
  const groups: RoomSection[][] = [];
  let current: RoomSection[] = [];
  let subCount = 0;
  for (const section of sections) {
    for (let i = 0; i < section.subs.length; i += ROOM_SUBS_PER_JOB) {
      const subs = section.subs.slice(i, i + ROOM_SUBS_PER_JOB);
      if (current.length && subCount + subs.length > ROOM_SUBS_PER_JOB) {
        groups.push(current);
        current = [];
        subCount = 0;
      }
      current.push({ ...section, subs });
      subCount += subs.length;
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * 문서 전체 요청을 Gemini 호출 1회 분량의 묶음으로 나눈다.
 * 무료 등급은 모델별 분당 요청 수가 작아서, 묶음마다 먼저 시도할 모델을 번갈아 배정한다.
 */
export function splitProseJobs({ room, person }: WikiProseRequest): ProseJob[] {
  const modelFor = (index: number): PreferredModel =>
    index % 2 === 0 ? "primary" : "secondary";

  const roomJobs: ProseJob[] = splitRoomSections(room.sections).map(
    (sections, index) => ({
      kind: "room",
      preferredModel: modelFor(index),
      request: { ...room, sections },
    }),
  );
  const personJobs: ProseJob[] = chunk(person.people, PEOPLE_PER_JOB).map(
    (people, index) => ({
      kind: "person",
      preferredModel: modelFor(roomJobs.length + index),
      request: { ...person, people },
    }),
  );
  return [...roomJobs, ...personJobs];
}
