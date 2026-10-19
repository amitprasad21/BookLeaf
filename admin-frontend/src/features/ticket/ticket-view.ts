// What the ticket page says (admin/SCREENS.md M3, FLOWS.md F-M2, F-M5, F-M7).
// Pure functions over the API's AdminTicketDetail.
import {
  AI_UNAVAILABLE_TEXT,
  CATEGORY_LABELS,
  LOW_CONFIDENCE_THRESHOLD,
  POLICY_FLOOR_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUS_TRANSITIONS,
  UNTRIAGED_LABEL,
  type AdminTicketDetailDto,
  type AiUnavailableReason,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  type TimelineEventDto,
} from "@bookleaf/shared";

// ---------- Status ----------

export interface StatusOption {
  value: TicketStatus;
  label: string;
}

/** The current status plus the transitions the lifecycle allows, named as actions. */
export function statusOptions(current: TicketStatus): StatusOption[] {
  const action = (to: TicketStatus) => {
    if (to === "in_progress") return current === "open" ? "Start (In progress)" : "Reopen (In progress)";
    if (to === "resolved") return "Resolve";
    if (to === "closed") return "Close";
    return STATUS_LABELS[to];
  };
  return [
    { value: current, label: `${STATUS_LABELS[current]} (current)` },
    ...STATUS_TRANSITIONS[current].map((to) => ({ value: to, label: action(to) })),
  ];
}

/** Closing and reopening ask for confirmation (F-M7). */
export function needsConfirmation(from: TicketStatus, to: TicketStatus): boolean {
  return to === "closed" || ((from === "resolved" || from === "closed") && to === "in_progress");
}

export function isUnresolved(status: TicketStatus): boolean {
  return status === "open" || status === "in_progress";
}

// ---------- Triage ----------

export const percent = (confidence: number) => `${Math.round(confidence * 100)}% confident`;

export function isLowConfidence(ticket: AdminTicketDetailDto): boolean {
  return ticket.ai.confidence !== null && ticket.ai.confidence < LOW_CONFIDENCE_THRESHOLD;
}

/** "AI suggestion · 82% confident", or for an admin value the AI's original pick. */
export function suggestionText(
  field: "category" | "priority",
  ticket: AdminTicketDetailDto,
): { source: "ai" | "admin"; tag: string; note: string | null } | null {
  const source = field === "category" ? ticket.categorySource : ticket.prioritySource;
  const suggested: TicketCategory | TicketPriority | null =
    field === "category" ? ticket.ai.suggestedCategory : ticket.ai.suggestedPriority;
  const label = (value: TicketCategory | TicketPriority) =>
    field === "category"
      ? CATEGORY_LABELS[value as TicketCategory]
      : PRIORITY_LABELS[value as TicketPriority];
  const confidence = ticket.ai.confidence;

  if (source === "admin") {
    return {
      source: "admin",
      tag: "Set by admin",
      note: suggested ? `AI suggested ${label(suggested)}` : null,
    };
  }
  if (source === "ai") {
    return {
      source: "ai",
      tag: confidence === null ? "AI suggestion" : `AI suggestion · ${percent(confidence)}`,
      note: null,
    };
  }
  return null;
}

/** "Raised to High by policy: ISBN errors are at least High" when a floor set the AI priority. */
export function policyFloorText(ticket: AdminTicketDetailDto): string | null {
  const rule = ticket.ai.policyFloorApplied;
  if (!rule || ticket.prioritySource !== "ai" || !ticket.priority) return null;
  const why = POLICY_FLOOR_LABELS[rule] ?? rule;
  return `Raised to ${PRIORITY_LABELS[ticket.priority]} by policy: ${why}`;
}

export function aiReasonText(reason: string | null | undefined): string {
  return reason && reason in AI_UNAVAILABLE_TEXT
    ? AI_UNAVAILABLE_TEXT[reason as AiUnavailableReason]
    : "The AI couldn't complete this";
}

export function priorityLabel(priority: TicketPriority | null): string {
  return priority ? PRIORITY_LABELS[priority] : UNTRIAGED_LABEL;
}

// ---------- Timeline ----------

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

function valueLabel(field: "category" | "priority" | "status", value: unknown): string {
  const key = asString(value);
  if (!key) return field === "priority" ? UNTRIAGED_LABEL : "not set";
  const labels: Record<string, string> =
    field === "category" ? CATEGORY_LABELS : field === "priority" ? PRIORITY_LABELS : STATUS_LABELS;
  return labels[key] ?? key;
}

/** One line per audit event. Metadata holds ids and old/new values, never message text. */
export function describeEvent(event: TimelineEventDto): string {
  const meta = event.metadata;
  switch (event.action) {
    case "ticket.created":
      return "Ticket raised";
    case "ticket.triaged":
      return `AI triaged: ${valueLabel("category", meta.category)} · ${valueLabel("priority", meta.priority)}`;
    case "ticket.triage_requested":
      return "AI triage re-run requested";
    case "ticket.category_overridden":
      return `Category changed from ${valueLabel("category", meta.from)} to ${valueLabel("category", meta.to)}`;
    case "ticket.priority_overridden":
      return `Priority changed from ${valueLabel("priority", meta.from)} to ${valueLabel("priority", meta.to)}`;
    case "ticket.status_changed":
      return `Status changed from ${valueLabel("status", meta.from)} to ${valueLabel("status", meta.to)}${
        meta.via === "reply" ? " with a reply" : ""
      }`;
    case "ticket.assigned":
      return "Assigned";
    case "ticket.unassigned":
      return "Unassigned";
    case "ticket.reply_sent":
      return meta.draftId ? "Reply sent (from an AI draft)" : "Reply sent";
    case "ticket.note_added":
      return "Internal note added";
    case "ai.draft_generated":
      return "AI draft generated";
    case "ai.draft_regenerated":
      return "AI draft regenerated";
    default:
      return event.action;
  }
}

/** Who made the latest change, for the version-conflict notice. */
export function latestActor(ticket: AdminTicketDetailDto): string {
  const latest = [...ticket.timeline].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  return latest?.actor?.displayName ?? "another admin";
}
