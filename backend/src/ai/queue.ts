// In-process job queue and startup/periodic sweeper for AI triage
// (.back/AI_PROVIDER_ORCHESTRATION.md section 6, D-007). Single backend
// instance (A-15): duplicates are dropped by ticket id, and anything lost in
// a restart is picked up by the next sweep.
import type { AiUnavailableReason } from "@bookleaf/shared";
import type { Logger } from "pino";
import type { SystemWriter } from "../db/system-writer.js";
import type { Clock } from "../lib/clock.js";
import type { AiRouter } from "./router.js";
import { MAX_TRIAGE_ATTEMPTS } from "./triage.js";

export interface JobQueue {
  /** False when already queued or running, or when the queue is closed. */
  enqueue(id: string): boolean;
  /** Stop accepting jobs and wait (up to `timeoutMs`) for running ones. Queued ones are left to the sweeper. */
  close(timeoutMs: number): Promise<void>;
  /** Resolves when nothing is queued or running (tests and scripts). */
  idle(): Promise<void>;
  stats(): { queued: number; running: number };
}

export function createJobQueue(options: {
  concurrency: number;
  minStartIntervalMs?: number;
  run: (id: string) => Promise<unknown>;
  logger: Logger;
}): JobQueue {
  const waiting: string[] = [];
  const known = new Set<string>();
  let running = 0;
  let closed = false;
  let nextStart = 0;
  let wake: NodeJS.Timeout | null = null;
  let idleWaiters: (() => void)[] = [];

  const settleIdle = () => {
    if (running === 0 && (waiting.length === 0 || closed)) {
      for (const resolve of idleWaiters) resolve();
      idleWaiters = [];
    }
  };

  const pump = () => {
    while (!closed && running < options.concurrency && waiting.length > 0) {
      const wait = nextStart - Date.now();
      if (wait > 0) {
        if (!wake)
          wake = setTimeout(() => {
            wake = null;
            pump();
          }, wait);
        break;
      }
      const id = waiting.shift()!;
      nextStart = Date.now() + (options.minStartIntervalMs ?? 0);
      running += 1;
      options
        .run(id)
        .catch((error: unknown) =>
          options.logger.error({ err: error, jobId: id }, "AI job failed unexpectedly"),
        )
        .finally(() => {
          running -= 1;
          known.delete(id);
          pump();
          settleIdle();
        });
    }
    settleIdle();
  };

  return {
    enqueue(id) {
      if (closed || known.has(id)) return false;
      known.add(id);
      waiting.push(id);
      queueMicrotask(pump);
      return true;
    },
    async close(timeoutMs) {
      closed = true;
      if (wake) clearTimeout(wake);
      wake = null;
      for (const id of waiting.splice(0)) known.delete(id);
      await Promise.race([this.idle(), new Promise((resolve) => setTimeout(resolve, timeoutMs).unref())]);
    },
    idle() {
      return new Promise<void>((resolve) => {
        idleWaiters.push(resolve);
        settleIdle();
      });
    },
    stats: () => ({ queued: waiting.length, running }),
  };
}

export interface SweeperOptions {
  writer: SystemWriter;
  queue: JobQueue;
  router: AiRouter;
  clock: Clock;
  logger: Logger;
  intervalMs?: number;
  /** Only tickets untouched this long (default 2 min), so fresh jobs aren't doubled. */
  staleMs?: number;
  batch?: number;
}

/** Re-queues pending/failed triage with attempts left; skips while AI can't serve. */
export function createSweeper(options: SweeperOptions) {
  const staleMs = options.staleMs ?? 2 * 60_000;
  let timer: NodeJS.Timeout | null = null;

  async function runOnce(): Promise<{ queued: number; skipped?: AiUnavailableReason }> {
    const availability = await options.router.availability();
    if (!availability.ok) return { queued: 0, skipped: availability.reason };
    const olderThan = new Date(options.clock().getTime() - staleMs).toISOString();
    const ids = await options.writer.listTicketsForSweep(olderThan, MAX_TRIAGE_ATTEMPTS, options.batch ?? 20);
    const queued = ids.filter((id) => options.queue.enqueue(id)).length;
    if (queued > 0) options.logger.info({ queued }, "AI triage sweeper re-queued tickets");
    return { queued };
  }

  const safeRun = () =>
    runOnce().catch((error: unknown) => options.logger.warn({ err: error }, "AI triage sweep failed"));

  return {
    runOnce,
    start() {
      void safeRun(); // at startup
      timer = setInterval(safeRun, options.intervalMs ?? 5 * 60_000);
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
