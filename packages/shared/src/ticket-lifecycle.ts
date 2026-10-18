// Ticket status machine (.back/TICKET_LIFECYCLE.md section 1). The API
// enforces it; the admin portal uses it to enable only allowed transitions.
// Authors never change status (A-17).
import type { TicketStatus } from "./enums.js";

export const STATUS_TRANSITIONS: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  open: ["in_progress", "resolved", "closed"],
  in_progress: ["resolved", "closed"],
  resolved: ["in_progress", "closed"], // reopen, or close
  closed: ["in_progress"], // reopen
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}
