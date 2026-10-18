// First-response targets for the admin queue (internal operational targets,
// never promised to authors: assumption A-08, .back/TICKET_LIFECYCLE.md §3).
// Pure functions; the API computes `slaState`, and the admin portal can use the
// same rules for countdowns.
import type { TicketPriority, TicketStatus } from "./enums.js";

export const SLA_STATES = ["on_track", "due_soon", "breached", "met", "not_applicable"] as const;
export type SlaState = (typeof SLA_STATES)[number];

/** Hours from `created_at` to the first admin reply. Untriaged counts as High. */
export const FIRST_RESPONSE_TARGET_HOURS = {
  critical: 4,
  high: 24,
  untriaged: 24,
  medium: 48,
  low: 72,
} as const satisfies Record<TicketPriority | "untriaged", number>;

/** "Due soon" once less than this share of the target is left. */
export const DUE_SOON_FRACTION = 0.25;

const HOUR_MS = 60 * 60 * 1000;
const UNRESOLVED: readonly TicketStatus[] = ["open", "in_progress"];

export function isUnresolved(status: TicketStatus): boolean {
  return UNRESOLVED.includes(status);
}

export function firstResponseTargetMs(priority: TicketPriority | null): number {
  return FIRST_RESPONSE_TARGET_HOURS[priority ?? "untriaged"] * HOUR_MS;
}

export function firstResponseDueAt(createdAt: Date, priority: TicketPriority | null): Date {
  return new Date(createdAt.getTime() + firstResponseTargetMs(priority));
}

export interface SlaInput {
  status: TicketStatus;
  priority: TicketPriority | null;
  createdAt: Date;
  firstResponseAt: Date | null;
}

/**
 * - met / breached: the first reply came on or before / after the target.
 * - Without a reply, a resolved or closed ticket is not_applicable (the
 *   clock stops when work ends; spam and duplicates never get a reply).
 * - Otherwise breached after the target, due_soon in its last 25%, else on_track.
 */
export function slaState(ticket: SlaInput, now: Date): SlaState {
  const due = firstResponseDueAt(ticket.createdAt, ticket.priority).getTime();
  if (ticket.firstResponseAt) return ticket.firstResponseAt.getTime() <= due ? "met" : "breached";
  if (!isUnresolved(ticket.status)) return "not_applicable";
  const remaining = due - now.getTime();
  if (remaining < 0) return "breached";
  if (remaining < firstResponseTargetMs(ticket.priority) * DUE_SOON_FRACTION) return "due_soon";
  return "on_track";
}

/**
 * Overdue = unresolved, no first reply yet, and past the target: the
 * actionable subset of `breached`. For each priority, tickets created before
 * the returned instant are overdue at `now` (used to filter in SQL).
 */
export function overdueCreatedBefore(now: Date): Record<TicketPriority | "untriaged", Date> {
  const before = (hours: number) => new Date(now.getTime() - hours * HOUR_MS);
  return {
    critical: before(FIRST_RESPONSE_TARGET_HOURS.critical),
    high: before(FIRST_RESPONSE_TARGET_HOURS.high),
    untriaged: before(FIRST_RESPONSE_TARGET_HOURS.untriaged),
    medium: before(FIRST_RESPONSE_TARGET_HOURS.medium),
    low: before(FIRST_RESPONSE_TARGET_HOURS.low),
  };
}
