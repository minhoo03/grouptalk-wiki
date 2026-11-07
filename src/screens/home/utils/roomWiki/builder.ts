import type {
  Block,
  Inline,
  NoteRef,
  Rich,
  WikiSec,
  WikiSub,
} from "@/types/wiki";
import type { RoomProfile } from "@/types/chat";
import type { Insights, Ranked, TimedMessage } from "../roomInsights";
import { formatDateKey, formatTime, truncate } from "@/utils/format";
import { josa } from "@/utils/korean";

export interface BuildCtx {
  room: RoomProfile;
  ins: Insights;
  title: string;
  omitted: string[];
  builtKeys: Set<string>;
  /** Adds a footnote. `ref` links it to a related sub-section, e.g. the method that explains a number. */
  fn: (note: string, ref?: NoteRef) => Inline;
}

export interface SubDef {
  key: string;
  title: string;
  build: () => Block[] | null;
}

export function section(
  ctx: BuildCtx,
  key: string,
  title: string,
  subs: SubDef[],
): WikiSec | null {
  const built: WikiSub[] = [];
  subs.forEach((s) => {
    const blocks = s.build();
    if (blocks && blocks.length)
      built.push({ key: s.key, title: s.title, blocks });
    else ctx.omitted.push(`${title} › ${s.title}`);
  });
  return built.length ? { key, title, subs: built } : null;
}

type JosaPair = Parameters<typeof josa>[1];

export const b = (text: string): Inline => ({ t: "b", text });
export const del = (text: string): Inline => ({ t: "del", text });
export const muted = (text: string): Inline => ({ t: "muted", text });
export const link = (name: string): Inline => ({ t: "link", name });
export const anchor = (id: string, text: string): Inline => ({
  t: "anchor",
  id,
  text,
});
export const who = (name: string, pair: JosaPair): Inline[] => [
  link(name),
  josa(name, pair),
];
export const word = (w: string, pair: JosaPair): string =>
  `'${w}'${josa(w, pair)}`;

export const p = (...content: Inline[]): Block => ({ type: "p", content });
export const ul = (items: Rich[]): Block => ({ type: "list", items });
export const table = (head: string[], rows: Rich[][]): Block => ({
  type: "table",
  head,
  rows,
});
export const quote = (q: string, caption: Rich): Block => ({
  type: "quote",
  quote: q,
  caption,
});
export const hours = (data: number[], label: string): Block => ({
  type: "hours",
  data,
  label,
});

export function bars(
  list: Ranked[],
  fmt: (v: number) => string,
  limit = 8,
  linked = true,
): Block | null {
  const items = list.filter((r) => r.value > 0).slice(0, limit);
  if (!items.length) return null;
  const max = Math.max(...items.map((r) => r.value));
  return {
    type: "bars",
    items: items.map((r) => ({
      label: linked ? [link(r.name)] : [r.name],
      value: Math.round((r.value / max) * 100),
      raw: fmt(r.value),
    })),
  };
}

export function compact(
  blocks: (Block | null | undefined | false)[],
): Block[] | null {
  const out = blocks.filter((x): x is Block => Boolean(x));
  return out.length ? out : null;
}

export const day = (key: string | null) => formatDateKey(key);
export const at = (m: TimedMessage) =>
  `${formatDateKey(m.dateKey)} ${formatTime(m.hour, m.minute)}`.trim();
export const say = (text: string, max = 50) => `“${truncate(text, max)}”`;
export const pct = (a: number, total: number) =>
  total ? Math.round((a / total) * 1000) / 10 : 0;
/** Formats a count. Fails loudly with context instead of a bare "reading 'toLocaleString'" on bad data. */
export const n = (v: number) => {
  if (typeof v !== "number" || !Number.isFinite(v))
    throw new TypeError(
      `숫자 형식 오류: 숫자가 와야 할 자리에 ${String(v)} 값이 전달되었습니다.`,
    );
  return v.toLocaleString();
};

export function dur(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 1) return "1분";
  if (m < 60) return `${m}분`;
  if (m < 1440)
    return `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ""}`;
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return `${d}일${h ? ` ${h}시간` : ""}`;
}

export const UNIT_LABEL = { 월: "한 달", 주: "한 주", 일: "하루" } as const;
