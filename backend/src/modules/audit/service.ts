import type { Logger } from "pino";
import type { AuditEventInput, SystemWriter } from "../../db/system-writer.js";

export type AuditRecorder = (events: AuditEventInput | AuditEventInput[]) => Promise<void>;

/**
 * Appends an audit event after the main write has succeeded. A failed audit
 * write is logged (without content) but never fails the user's request.
 */
export function createAuditRecorder(writer: SystemWriter, logger: Logger): AuditRecorder {
  return async (input) => {
    const events = Array.isArray(input) ? input : [input];
    try {
      await writer.appendAuditEvents(events);
    } catch (error) {
      logger.warn(
        {
          actions: events.map((event) => event.action),
          ticketId: events[0]?.ticketId,
          reason: error instanceof Error ? error.message : "unknown",
        },
        "audit event not recorded",
      );
    }
  };
}
