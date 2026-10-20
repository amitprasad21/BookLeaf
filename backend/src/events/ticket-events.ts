// Which events an admin update raises (INTEGRATION_CONTRACT.md section 9).
// A status change is author-visible (`ticket.updated`); overrides and
// assignment are internal (`ticket.internal_updated`, admins only), so an
// author never learns that internal fields changed.
import type { TicketChange } from "@bookleaf/shared";
import type { PublishedEvent } from "./hub.js";

const INTERNAL_CHANGES: Readonly<Record<string, TicketChange>> = {
  "ticket.category_overridden": "category",
  "ticket.priority_overridden": "priority",
  "ticket.assigned": "assignee",
  "ticket.unassigned": "assignee",
};

/** Events for a PATCH, from the audit actions it recorded. */
export function updateEvents(
  ticketId: string,
  authorId: string | null,
  actions: readonly string[],
): PublishedEvent[] {
  const events: PublishedEvent[] = [];
  if (actions.includes("ticket.status_changed")) {
    events.push({ type: "ticket.updated", ticketId, authorId, changes: ["status"] });
  }
  const internal = [
    ...new Set(actions.flatMap((action) => (INTERNAL_CHANGES[action] ? [INTERNAL_CHANGES[action]] : []))),
  ];
  if (internal.length > 0) {
    events.push({ type: "ticket.internal_updated", ticketId, authorId, changes: internal });
  }
  return events;
}
