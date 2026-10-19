// Records one usage event per AI attempt or skip, through the system writer.
// Accounting must never break the AI path or a user request: failures are
// logged (without content) and swallowed, as audit events are.
import type { Logger } from "pino";
import type { SystemWriter, UsageEventInput } from "../db/system-writer.js";

export type UsageRecorder = (event: UsageEventInput) => Promise<void>;

export function createUsageRecorder(writer: SystemWriter, logger: Logger): UsageRecorder {
  return async (event) => {
    try {
      await writer.appendUsageEvent(event);
    } catch (error) {
      logger.warn(
        {
          task: event.task,
          provider: event.provider,
          outcome: event.outcome,
          reason: error instanceof Error ? error.message : "unknown",
        },
        "AI usage event not recorded",
      );
    }
  };
}
