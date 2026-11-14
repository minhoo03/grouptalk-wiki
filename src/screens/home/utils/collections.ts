import type { Ranked } from "@/screens/home/utils/insights.types";

export function inc(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

export function rank(map: Map<string, number>): Ranked[] {
  const out: Ranked[] = [];
  map.forEach((value, name) => out.push({ name, value }));
  return out.sort((a, b) => b.value - a.value);
}

/** Highest-count key; ties resolve to the key inserted first (same as a stable sort). */
export function top(map: Map<string, number>): string | null {
  let best: string | null = null;
  let bestValue = -Infinity;
  map.forEach((value, name) => {
    if (value > bestValue) {
      bestValue = value;
      best = name;
    }
  });
  return best;
}

export function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
