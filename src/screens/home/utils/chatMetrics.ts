import type { ChatMessage } from "@/types/chat";
import type { MsgKind } from "@/screens/home/utils/insights.types";

export type { MsgKind };

const PHOTO = /^(사진(\s\d+장)?|<사진 읽지 않음>)$/;
const VIDEO = /^(동영상|<동영상 읽지 않음>)$/;
const EMOTICON = /^(이모티콘|\(이모티콘\)|<이모티콘>)$/;
const DELETED = /^(삭제된 메시지입니다\.?|메시지가 삭제되었습니다\.?)$/;
const FILE = /^(파일:|<파일)/;
const URL_GLOBAL = /https?:\/\/\S+/g;
const URL_TEST = /https?:\/\/\S+/;

const STOPWORDS = new Set(
  "그리고 근데 그냥 진짜 너무 나도 저도 이거 그거 저거 우리 아니 그래 그럼 이제 지금 오늘 내일 어제 사진 이모티콘 동영상 파일 있어 없어 하는 했어 해서 그래서 이렇게 저렇게 그런 이런 저런 근데요 그건 이건 일단 혹시 다들 같이 많이 하고 하면 하자 했는데 있는 없는 있음 없음 그거임 그게 이게 뭐야 뭐지".split(
    " ",
  ),
);

export function classify(raw: string): MsgKind {
  const text = raw.trim();
  if (PHOTO.test(text)) return "photo";
  if (VIDEO.test(text)) return "video";
  if (EMOTICON.test(text)) return "emoticon";
  if (DELETED.test(text)) return "deleted";
  if (FILE.test(text)) return "file";
  return "text";
}

/**
 * 이 단톡방이나 멤버 집단 전체를 가리키는 표현. 별칭·줄임말 후보를 찾는 데 쓴다.
 * "이방인"처럼 단어 일부가 걸릴 수 있어 후보로만 쓰고, 별칭인지는 AI가 맥락으로 판단한다.
 */
const ROOM_REFERENCE = /(우리|이)\s?(단톡방|단톡|톡방|방|모임)|단톡방|톡방/;

/** 방을 가리키는 표현이 있으면 공백을 하나로 맞춰 돌려준다. */
export function roomReference(text: string): string | null {
  const match = ROOM_REFERENCE.exec(text);
  return match ? match[0].replace(/\s+/g, " ") : null;
}

export function hasLink(text: string): boolean {
  return URL_TEST.test(text);
}

export function longestLaugh(text: string): number {
  const runs = text.match(/ㅋ+/g);
  if (!runs) return 0;
  let max = 0;
  for (const r of runs) if (r.length > max) max = r.length;
  return max;
}

/**
 * Word/phrase counter with a memory ceiling. Very large chats can contain millions of
 * unique tokens; when the map grows past `limit`, rarely-seen keys are dropped so the
 * browser tab doesn't run out of memory. Frequent keys (the only ones we report) survive.
 */
export class BoundedCounter {
  private map = new Map<string, number>();

  constructor(private readonly limit = 150000) {}

  add(key: string, by = 1) {
    this.map.set(key, (this.map.get(key) ?? 0) + by);
    if (this.map.size > this.limit) this.prune();
  }

  get(key: string): number {
    return this.map.get(key) ?? 0;
  }

  top(n: number): { key: string; count: number }[] {
    const out: { key: string; count: number }[] = [];
    this.map.forEach((count, key) => out.push({ key, count }));
    return out.sort((a, b) => b.count - a.count).slice(0, n);
  }

  forEach(cb: (count: number, key: string) => void) {
    this.map.forEach(cb);
  }

  private prune() {
    let threshold = 1;
    while (this.map.size > this.limit * 0.6) {
      this.map.forEach((count, key) => {
        if (count <= threshold) this.map.delete(key);
      });
      threshold++;
    }
  }
}

export function laughForms(text: string): string[] {
  const runs = text.match(/ㅋ{2,}|ㅎ{2,}/g) ?? [];
  return runs.map((r) => (r.length >= 5 ? `${r[0].repeat(5)}+` : r));
}

export function emojis(text: string): string[] {
  return text.match(/\p{Extended_Pictographic}/gu) ?? [];
}

export function tokenize(text: string): string[] {
  if (classify(text) !== "text") return [];
  return text
    .replace(URL_GLOBAL, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(
      (w) =>
        w.length >= 2 &&
        !/^[ㄱ-ㅎㅏ-ㅣ]+$/.test(w) &&
        !/^\d+$/.test(w) &&
        !STOPWORDS.has(w),
    );
}

/**
 * 어느 단톡방에서나 나오는 추임새·맞장구·인사. 유행어나 말버릇으로 보지 않는다.
 * 비교는 공백·문장부호·끝의 ㅋㅎㅠㅜ를 지운 형태로 한다. (예: "좋다ㅋㅋ!" → "좋다")
 */
const FILLER_PHRASES = new Set(
  (
    "좋다 좋아 좋네 좋지 좋음 좋아요 좋아좋아 굿굿 굳굳 오케이 오키 오키오키 " +
    "그래 그래요 그래그래 그럼 그렇지 그렇네 그러게 그러니까 그니까 그치 그쵸 " +
    "맞아 맞아요 맞네 맞지 맞음 인정 진짜 진짜로 정말 레알 대박 대박이다 " +
    "뭐야 머야 뭐지 뭐임 왜왜 아니 아니야 아닌데 아님 글쎄 " +
    "감사 감사합니다 감사해요 고마워 고마워요 땡큐 미안 미안해 죄송합니다 " +
    "넵넵 네네 넹넹 웅웅 응응 어어 엉엉 아하 아항 오호 와우 우와 헐랭 아이고 어휴 에휴 " +
    "아진짜 와진짜 오오오 아아아 수고 수고했어 수고하셨습니다 안녕 안녕하세요 " +
    "알겠어 알겠습니다 알았어 확인 나도 저도 나두 근데 오늘 내일 지금 가자 고고"
  ).split(" "),
);
const PHRASE_KEY_TRIM = /[\s\p{P}\p{S}]/gu;
const TRAILING_REACTION = /[ㅋㅎㅠㅜ]+$/;

/**
 * 유행어·말버릇 후보가 될 만한 말인가.
 * 완성된 한글 2음절(또는 영문 3글자) 이상이어야 하고, 자음·웃음·문장부호만 있는 말과 흔한 추임새는 제외한다.
 */
export function isMeaningfulPhrase(text: string): boolean {
  const key = text.replace(PHRASE_KEY_TRIM, "").replace(TRAILING_REACTION, "");
  const syllables = key.match(/[가-힣]/g)?.length ?? 0;
  const latin = key.match(/[a-zA-Z]/g)?.length ?? 0;
  if (syllables < 2 && latin < 3) return false;
  return !FILLER_PHRASES.has(key);
}

export function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dateToKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (keyToDate(b).getTime() - keyToDate(a).getTime()) / 86400000,
  );
}

export function addDays(key: string, n: number): string {
  const date = keyToDate(key);
  date.setDate(date.getDate() + n);
  return dateToKey(date);
}

export function toTs(m: ChatMessage): number | null {
  if (!m.dateKey || m.hour === null || m.minute === null) return null;
  const date = keyToDate(m.dateKey);
  date.setHours(m.hour, m.minute, 0, 0);
  return date.getTime();
}

export function isNight(hour: number | null): boolean {
  return hour !== null && (hour >= 23 || hour < 5);
}

export function isMorning(hour: number | null): boolean {
  return hour !== null && hour >= 5 && hour < 9;
}
