/**
 * Cooperative time-slicing for long synchronous analyses.
 *
 * Heavy analyses are written as generators that `yield` a progress fraction (0..1)
 * every few thousand items. `runSliced` drives them in ~12ms slices and hands control
 * back to the browser between slices, so the UI keeps painting and the progress bar
 * moves. `runSync` drives the exact same generator to completion in one go (tests,
 * small inputs), which guarantees both paths produce identical results.
 */

export type Steps<T> = Generator<number, T, void>;

/** Check `(i & YIELD_MASK) === 0` inside hot loops to yield every 2048 items. */
export const YIELD_MASK = 2047;

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export function createAbortError(): Error {
  const err = new Error("작업이 취소되었습니다.");
  err.name = "AbortError";
  return err;
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw createAbortError();
}

export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function runSync<T>(steps: Steps<T>): T {
  let r = steps.next();
  while (!r.done) r = steps.next();
  return r.value;
}

/** Re-maps a child generator's 0..1 progress into the parent's [from, to] range. */
export function* scaled<T>(
  steps: Steps<T>,
  from: number,
  to: number,
): Steps<T> {
  let r = steps.next();
  while (!r.done) {
    const f = Math.min(1, Math.max(0, r.value));
    yield from + (to - from) * f;
    r = steps.next();
  }
  return r.value;
}

export async function runSliced<T>(
  steps: Steps<T>,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
  budgetMs = 12,
): Promise<T> {
  let progress = 0;
  for (;;) {
    throwIfAborted(signal);
    const start = now();
    for (;;) {
      const r = steps.next();
      if (r.done) {
        onProgress(1);
        return r.value;
      }
      progress = r.value;
      if (now() - start >= budgetMs) break;
    }
    onProgress(progress);
    await yieldToMain();
  }
}
