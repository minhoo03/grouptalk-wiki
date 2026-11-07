import type { ChatMessage } from "@/types/chat";

/**
 * 분석 전에 봇 계정을 걸러낸다.
 * 아래 기준 중 2개 이상이면 봇 후보이고, 확인 화면에서 기본으로 "제외"가 선택된다.
 * 확정된 결정은 메시지 단계에서 적용하므로 이후 모든 통계(지분, 시간대, 유행어, 관계도 등)에 함께 반영된다.
 *
 * 이름을 바꾼 동일 인물은 추정하거나 합치지 않는다. 이름이 다르면 다른 사람으로 센다.
 */

export type BotCandidate = {
  name: string;
  messageCount: number;
  reasons: string[];
};

export type ParticipantCandidates = {
  bots: BotCandidate[];
};

export type ParticipantDecisions = {
  /** 통계에서 뺄 봇 이름 */
  excludedBots: string[];
};

const BOT_NAME = /봇|bot|알림|공지|자동/i;
const COMMAND = /^[/!][^\s/!]/;
/** 템플릿 판별: 숫자를 지운 앞부분이 같은 메시지 */
const TEMPLATE_PREFIX_CHARS = 8;
const BRACKET_TEMPLATE = /^\s*[[【〔<]/;
const MIN_BOT_MESSAGES = 3;
const MIN_BOT_SIGNALS = 2;
const COMMAND_REPLY_SHARE = 0.5;
const TEMPLATE_SHARE = 0.4;
const LONG_FORMATTED_RATIO = 2;
const FORMATTED_SHARE = 0.5;

function minutesOf(message: ChatMessage) {
  return message.hour === null || message.minute === null
    ? null
    : message.hour * 60 + message.minute;
}

/** 직전 메시지가 다른 사람의 명령어이고, 같은 날 1분 안에 답했는가 */
function isCommandReply(prev: ChatMessage | undefined, message: ChatMessage) {
  if (!prev || prev.author === message.author) return false;
  if (!COMMAND.test(prev.text.trim()) || prev.dateKey !== message.dateKey)
    return false;
  const a = minutesOf(prev);
  const b = minutesOf(message);
  return a !== null && b !== null && b - a >= 0 && b - a <= 1;
}

function templateKey(text: string) {
  return text.replace(/\d+/g, "#").trim().slice(0, TEMPLATE_PREFIX_CHARS);
}

function detectBots(messages: ChatMessage[]): BotCandidate[] {
  type Stat = {
    count: number;
    chars: number;
    commandReplies: number;
    formatted: number;
    bracketed: number;
    templates: Map<string, number>;
  };
  const stats = new Map<string, Stat>();
  let totalChars = 0;

  messages.forEach((message, index) => {
    const stat = stats.get(message.author) ?? {
      count: 0,
      chars: 0,
      commandReplies: 0,
      formatted: 0,
      bracketed: 0,
      templates: new Map(),
    };
    const text = message.text;
    stat.count += 1;
    stat.chars += text.length;
    totalChars += text.length;
    if (isCommandReply(messages[index - 1], message)) stat.commandReplies += 1;
    if (text.includes("\n")) stat.formatted += 1;
    if (BRACKET_TEMPLATE.test(text)) stat.bracketed += 1;
    const key = templateKey(text);
    stat.templates.set(key, (stat.templates.get(key) ?? 0) + 1);
    stats.set(message.author, stat);
  });

  const roomAvgChars = messages.length ? totalChars / messages.length : 0;
  const bots: BotCandidate[] = [];

  for (const [name, stat] of stats) {
    if (stat.count < MIN_BOT_MESSAGES) continue;
    const reasons: string[] = [];
    if (BOT_NAME.test(name)) reasons.push("이름에 봇·알림·공지 등이 들어감");
    if (stat.commandReplies / stat.count >= COMMAND_REPLY_SHARE)
      reasons.push(
        `메시지의 ${Math.round((stat.commandReplies / stat.count) * 100)}%가 명령어(/, !) 직후 1분 안의 응답`,
      );
    const topTemplate = Math.max(...stat.templates.values());
    if (
      topTemplate >= MIN_BOT_MESSAGES &&
      (topTemplate / stat.count >= TEMPLATE_SHARE ||
        stat.bracketed / stat.count >= TEMPLATE_SHARE)
    )
      reasons.push("같은 문장 틀이 반복됨");
    const avgChars = stat.chars / stat.count;
    if (
      avgChars >= roomAvgChars * LONG_FORMATTED_RATIO &&
      stat.formatted / stat.count >= FORMATTED_SHARE
    )
      reasons.push("줄바꿈 형식이 일정한 긴 메시지가 대부분");
    if (reasons.length >= MIN_BOT_SIGNALS)
      bots.push({ name, messageCount: stat.count, reasons });
  }
  return bots;
}

export function findParticipantCandidates(
  messages: ChatMessage[],
): ParticipantCandidates {
  return { bots: detectBots(messages) };
}

export function hasCandidates(candidates: ParticipantCandidates) {
  return candidates.bots.length > 0;
}

/** 확인 없이 진행할 때의 기본값: 봇 후보는 모두 제외한다. */
export function defaultDecisions(
  candidates: ParticipantCandidates,
): ParticipantDecisions {
  return { excludedBots: candidates.bots.map((b) => b.name) };
}

/**
 * 결정을 메시지에 적용한다.
 * 봇을 뺐다면, 사람이 봇을 부르려고 보낸 명령어("/운세", "!날씨", "@봇이름 ...")도 함께 뺀다.
 */
export function applyParticipantDecisions(
  messages: ChatMessage[],
  decisions: ParticipantDecisions,
): ChatMessage[] {
  const excluded = new Set(decisions.excludedBots);
  const mentionsBot = (text: string) =>
    [...excluded].some((bot) => text.startsWith(`@${bot}`));

  return messages.flatMap((message) => {
    if (excluded.has(message.author)) return [];
    const text = message.text.trim();
    if (excluded.size && (COMMAND.test(text) || mentionsBot(text))) return [];
    return [message];
  });
}
