const PALETTE: { bg: string; fg: string }[] = [
  { bg: "#00A495", fg: "#FFFFFF" },
  { bg: "#F2B200", fg: "#1E2A28" },
  { bg: "#D9480F", fg: "#FFFFFF" },
  { bg: "#1971C2", fg: "#FFFFFF" },
  { bg: "#6741D9", fg: "#FFFFFF" },
  { bg: "#2B8A3E", fg: "#FFFFFF" },
  { bg: "#FFD8A8", fg: "#1E2A28" },
];

export function avatarColor(name: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function avatarInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const hangul = trimmed.match(/[가-힣]/g);
  if (hangul && hangul.length >= 2 && trimmed.length <= 4)
    return hangul[hangul.length - 2] + hangul[hangul.length - 1];
  return trimmed.slice(0, 1).toUpperCase();
}
