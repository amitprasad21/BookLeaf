// A provider instance shares this gate across triage, drafts and HTTP retries.
// Single process only; provider token/day limits still use the budget/breaker.
import { setTimeout as delay } from "node:timers/promises";

export function pacedFetch(fetchFn: typeof fetch, intervalMs: number): typeof fetch {
  if (intervalMs === 0) return fetchFn;
  let nextStart = 0;
  let turn = Promise.resolve();
  return async (input, init) => {
    const previous = turn;
    let release!: () => void;
    turn = new Promise<void>((resolve) => {
      release = resolve;
    });
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    try {
      await previous;
      signal?.throwIfAborted();
      const wait = Math.max(0, nextStart - Date.now());
      if (wait > 0) await delay(wait, undefined, { signal: signal ?? undefined });
      signal?.throwIfAborted();
      nextStart = Date.now() + intervalMs;
    } finally {
      release();
    }
    return fetchFn(input, init);
  };
}
