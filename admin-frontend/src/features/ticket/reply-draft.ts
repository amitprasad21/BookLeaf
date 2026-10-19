// Reply editor helpers (admin/FLOWS.md F-M3, F-M4). Unsent text is kept per
// ticket in sessionStorage until sent (FRONTEND_ARCHITECTURE section 7).
import {
  ESCALATION_TEAM_LABELS,
  KB_SECTION_LABELS,
  type AdminTicketDetailDto,
  type AiDraftDto,
} from "@bookleaf/shared";
// Relative, not "@/": the logic tests run without the Next.js path alias.
import { readSession, writeSession } from "../../lib/browser";

export interface SavedReply {
  text: string;
  /** The AI draft the text started from, if any (sent as draftId). */
  draftId: string | null;
}

const keyFor = (ticketId: string) => `bookleaf.admin.reply.${ticketId}`;

export function loadReply(ticketId: string): SavedReply | null {
  const raw = readSession(keyFor(ticketId));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SavedReply>;
    return typeof value.text === "string"
      ? { text: value.text, draftId: typeof value.draftId === "string" ? value.draftId : null }
      : null;
  } catch {
    return null;
  }
}

export function saveReply(ticketId: string, reply: SavedReply | null) {
  writeSession(keyFor(ticketId), reply ? JSON.stringify(reply) : null);
}

/**
 * Ask for a draft on open only when it's the team's turn: no reply yet, or
 * the author wrote last. Otherwise the admin asks for one, which saves AI
 * calls on tickets that are only being checked.
 */
export function shouldDraftOnOpen(ticket: AdminTicketDetailDto): boolean {
  if (ticket.status !== "open" && ticket.status !== "in_progress") return false;
  const last = ticket.messages[ticket.messages.length - 1];
  return !last || last.senderRole === "author";
}

/** "Royalty policy, Company overview" */
export function sectionsText(draft: AiDraftDto): string {
  return draft.kbSectionsUsed.map((id) => KB_SECTION_LABELS[id] ?? id).join(", ");
}

export function escalationText(draft: AiDraftDto): string | null {
  if (!draft.needsEscalation || draft.escalationTeam === "none") return null;
  return `Suggested escalation: ${ESCALATION_TEAM_LABELS[draft.escalationTeam]}`;
}
