import {
  HALL_OF_FAME_KEY,
  HALL_OF_FAME_PER_JOB,
  PEOPLE_PER_JOB,
  ROOM_JOB_GROUPS,
  ROOM_SUBS_MAX_PER_JOB,
  type PreferredModel,
  type ProseJob,
  type RoomProseRequest,
  type WikiProseRequest,
} from "@/services/wikiWriter/wikiWriter.schema";

type RoomSection = RoomProseRequest["sections"][number];

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    chunks.push(items.slice(i, i + size));
  return chunks;
}

const subCount = (sections: RoomSection[]) =>
  sections.reduce((sum, section) => sum + section.subs.length, 0);

/**
 * 묶음이 서버 상한(ROOM_SUBS_MAX_PER_JOB)을 넘으면 섹션 경계에서 나눈다.
 * 보통의 방에서는 일어나지 않고, 구성원이 아주 많거나 섹션이 늘어났을 때를 위한 안전장치다.
 */
function fitWithinLimit(sections: RoomSection[]): RoomSection[][] {
  if (subCount(sections) <= ROOM_SUBS_MAX_PER_JOB) return [sections];
  const jobs: RoomSection[][] = [];
  let current: RoomSection[] = [];
  for (const section of sections) {
    if (
      current.length &&
      subCount(current) + section.subs.length > ROOM_SUBS_MAX_PER_JOB
    ) {
      jobs.push(current);
      current = [];
    }
    current.push(section);
  }
  if (current.length) jobs.push(current);
  return jobs;
}

/**
 * 단톡방 섹션을 ROOM_JOB_GROUPS 순서의 묶음으로 나눈다.
 * 명예의 전당은 구성원 수만큼 하위 문단이 늘어나므로 HALL_OF_FAME_PER_JOB명씩 끊고,
 * 첫 조각만 같은 묶음(여담)과 함께 보낸다. 묶음에 없는 섹션은 마지막 묶음 하나로 모은다.
 */
function groupRoomSections(sections: RoomSection[]): RoomSection[][] {
  const groups: RoomSection[][] = ROOM_JOB_GROUPS.map(() => []);
  const extraJobs: RoomSection[][] = [];
  const ungrouped: RoomSection[] = [];

  for (const section of sections) {
    const groupIndex = ROOM_JOB_GROUPS.findIndex((keys) =>
      keys.includes(section.key),
    );
    if (groupIndex < 0) {
      ungrouped.push(section);
      continue;
    }
    if (section.key === HALL_OF_FAME_KEY) {
      const [first, ...rest] = chunk(section.subs, HALL_OF_FAME_PER_JOB);
      if (first) groups[groupIndex].push({ ...section, subs: first });
      rest.forEach((subs) => extraJobs.push([{ ...section, subs }]));
      continue;
    }
    groups[groupIndex].push(section);
  }

  return [...groups, ...extraJobs, ungrouped]
    .filter((job) => job.length > 0)
    .flatMap(fitWithinLimit);
}

/**
 * 문서 전체 요청을 Gemini 호출 묶음으로 나눈다.
 * 무료 등급의 실제 제약은 하루 요청 수(모델별 20회)라, 응답이 길어지더라도 요청 수를 줄인다.
 * 15명 방 기준으로 단톡방 3회 + 인물 2회다.
 * 모델별 분당 요청 수도 작아서, 묶음마다 먼저 시도할 모델을 번갈아 배정한다.
 */
export function splitProseJobs({ room, person }: WikiProseRequest): ProseJob[] {
  const modelFor = (index: number): PreferredModel =>
    index % 2 === 0 ? "primary" : "secondary";

  const roomJobs: ProseJob[] = groupRoomSections(room.sections).map(
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
