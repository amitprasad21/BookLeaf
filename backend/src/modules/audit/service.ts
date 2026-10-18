import type { Logger } from "pino";
import type { AuditEventInput, SystemWriter } from "../../db/system-writer.js";

export type AuditRecorder = (event: AuditEventInput) => Promise<void>;

/**
 * Appends an audit event after the main write has succeeded. A failed audit
 * write is logged (without content) but never fails the user's request.
 */
export function createAuditRecorder(writer: SystemWriter, logger: Logger): AuditRecorder {
  return async (event) => {
    try {
      await writer.appendAuditEvent(event);
    } catch (error) {
      logger.warn(
        {
          action: event.action,
          ticketId: event.ticketId,
          reason: error instanceof Error ? error.message : "unknown",
        },
        "audit event not recorded",
      );
    }
  };
}
