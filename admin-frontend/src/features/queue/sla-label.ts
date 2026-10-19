// First-response wording for the queue and ticket header ("Overdue · 6 h",
// "Due in 1 h"), from the same targets the API uses (packages/shared sla.ts).
import { firstResponseDueAt, type SlaState, type TicketPriority } from "@bookleaf/shared";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** "45 min", "6 h", "3 d". */
export function shortDuration(ms: number): string {
  const value = Math.max(0, ms);
  if (value < HOUR) return `${Math.max(1, Math.round(value / MINUTE))} min`;
  if (value < 48 * HOUR) return `${Math.floor(value / HOUR)} h`;
  return `${Math.floor(value / (24 * HOUR))} d`;
}

export interface SlaInputs {
  slaState: SlaState;
  priority: TicketPriority | null;
  createdAt: string;
}

/** Text for breached and due-soon tickets; null when there's nothing to flag. */
export function slaLabel(ticket: SlaInputs, now: Date = new Date()): string | null {
  const due = firstResponseDueAt(new Date(ticket.createdAt), ticket.priority).getTime();
  if (ticket.slaState === "breached") {
    return due <= now.getTime() ? `Overdue · ${shortDuration(now.getTime() - due)}` : "First reply was late";
  }
  if (ticket.slaState === "due_soon") return `Due in ${shortDuration(due - now.getTime())}`;
  return null;
}
