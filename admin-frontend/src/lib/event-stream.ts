// Live ticket events (FRONTEND_ARCHITECTURE.md section 6, INTEGRATION_CONTRACT
// section 9): GET /events read with fetch streaming, so the bearer token
// stays in a header. Reconnects with backoff 1 s, 2 s, 5 s, then 15 s; the
// caller polls while the status is "polling". Same file as in the author portal (D-032).
import { createSseParser, toTicketEvent, type TicketEvent } from "@bookleaf/shared";

export type LiveMode = "live" | "polling";

export const BACKOFF_MS = [1_000, 2_000, 5_000, 15_000] as const;
/** A stream that ends sooner than this counts as a failure (no tight reconnect loop). */
const MIN_HEALTHY_MS = 5_000;

export interface EventStreamOptions {
  url: string;
  getToken: () => Promise<string | null>;
  /** On 401: refresh the session once; false means signed out (stop). */
  refreshSession: () => Promise<boolean>;
  onEvent: (event: TicketEvent) => void;
  /** Every time a stream opens: re-fetch what may have been missed while disconnected. */
  onOpen: () => void;
  onMode: (mode: LiveMode) => void;
  fetchFn?: typeof fetch;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
}

const abortableSleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

/** Runs until `signal` aborts or the session ends. Never throws. */
export async function runEventStream(options: EventStreamOptions, signal: AbortSignal): Promise<void> {
  const fetchFn = options.fetchFn ?? fetch;
  const sleep = options.sleep ?? abortableSleep;
  const now = options.now ?? Date.now;
  let failures = 0;
  let refreshed = false;

  while (!signal.aborted) {
    let healthy = false;
    try {
      const token = await options.getToken();
      if (!token) return; // signed out
      const response = await fetchFn(options.url, {
        headers: { Accept: "text/event-stream", Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal,
      });
      if (response.status === 401) {
        if (refreshed || !(await options.refreshSession())) return; // the API client handles expiry
        refreshed = true;
        continue;
      }
      if (!response.ok || !response.body) throw new Error(`event stream refused (${response.status})`);

      refreshed = false;
      const openedAt = now();
      options.onMode("live");
      options.onOpen();
      const parser = createSseParser((message) => {
        const event = toTicketEvent(message);
        if (event) options.onEvent(event);
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
      // The server ends streams after a while so they re-authenticate: reconnect at once.
      healthy = now() - openedAt >= MIN_HEALTHY_MS;
    } catch {
      if (signal.aborted) return;
    }
    if (healthy) {
      failures = 0;
      continue;
    }
    options.onMode("polling");
    await sleep(BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)]!, signal);
    failures += 1;
  }
}
