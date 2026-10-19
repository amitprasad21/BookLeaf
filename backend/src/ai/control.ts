// What the HTTP layer may do with AI triage: queue a saved ticket, check
// availability, request a manual re-run. Routes never touch the system writer
// or call a model themselves, and a ticket save never waits for AI (C-10).
import type { AiUnavailableReason } from "@bookleaf/shared";
import type { SystemWriter } from "../db/system-writer.js";
import type { JobQueue } from "./queue.js";
import type { AiAvailability, AiRouter } from "./router.js";

export interface TriageControl {
  /** Fire and forget after a ticket is saved. Never throws, never waits. */
  enqueue(ticketId: string): void;
  availability(): Promise<{ ok: true } | { ok: false; reason: AiUnavailableReason }>;
  /** Manual re-triage: reset to pending with fresh attempts and queue it. False if the ticket doesn't exist. */
  retry(ticketId: string): Promise<boolean>;
}

export function createTriageControl(deps: {
  queue: JobQueue;
  writer: SystemWriter;
  router: AiRouter;
}): TriageControl {
  return {
    enqueue(ticketId) {
      deps.queue.enqueue(ticketId);
    },
    availability: (): Promise<AiAvailability> => deps.router.availability(),
    async retry(ticketId) {
      if (!(await deps.writer.resetTriage(ticketId))) return false;
      deps.queue.enqueue(ticketId);
      return true;
    },
  };
}

/** AI turned off (and the default in tests): nothing is queued, retries report not_configured. */
export const disabledTriage: TriageControl = {
  enqueue() {},
  availability: async () => ({ ok: false, reason: "not_configured" }),
  retry: async () => false,
};
