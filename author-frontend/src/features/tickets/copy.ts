import type { TicketStatus } from "@bookleaf/shared";

/**
 * One line under the status on the ticket page (author/SCREENS.md A5).
 * Resolved points to a new query: follow-up replies are P2 (AUTHOR-10).
 */
export const STATUS_EXPLAINERS: Record<TicketStatus, string> = {
  open: "Waiting for our team",
  in_progress: "Our team is working on this",
  resolved: "We believe this is sorted. If it isn't, raise a new query.",
  closed: "This conversation is closed.",
};

export const GENERAL_ACCOUNT = "General / Account";
export const NEW_REPLY_ANNOUNCEMENT = "New reply from BookLeaf Support.";
export const NO_REPLY_YET = "No reply yet. Most queries get a first response within one working day.";
export const NOT_FOUND = "We couldn't find that ticket.";
