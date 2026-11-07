type JosaPair = "은/는" | "이/가" | "을/를" | "과/와";

export function hasBatchim(word: string): boolean {
  if (!word) return false;
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

export function josa(word: string, pair: JosaPair): string {
  const [withBatchim, without] = pair.split("/");
  return hasBatchim(word) ? withBatchim : without;
}
