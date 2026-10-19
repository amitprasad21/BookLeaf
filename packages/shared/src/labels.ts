// User-facing labels. Category labels are the exact wording from the assignment.
import type { EscalationTeam } from "./draft.js";
import type { AiStatus, TicketCategory, TicketPriority, TicketStatus } from "./enums.js";
import type { AiUnavailableReason } from "./errors.js";

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  royalty_payments: "Royalty & Payments",
  isbn_metadata: "ISBN & Metadata Issues",
  printing_quality: "Printing & Quality",
  distribution_availability: "Distribution & Availability",
  book_status_production: "Book Status & Production Updates",
  general_inquiry: "General Inquiry",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const UNTRIAGED_LABEL = "Needs triage";

// ---------- Support console ----------

export const AI_STATUS_LABELS: Record<AiStatus, string> = {
  pending: "Triaging…",
  completed: "Triaged",
  failed: "AI failed, retrying",
  manual_review_required: "Manual",
};

/** Why AI can't help right now, in plain words (admin FLOWS F-M4). */
export const AI_UNAVAILABLE_TEXT: Record<AiUnavailableReason, string> = {
  not_configured: "AI is turned off",
  provider_unavailable: "The AI service isn't responding",
  circuit_open: "The AI service isn't responding",
  budget_exhausted: "AI is paused (daily budget reached)",
  invalid_output: "The AI couldn't produce a usable answer",
  refused: "The AI declined this request",
};

export const ESCALATION_TEAM_LABELS: Record<EscalationTeam, string> = {
  none: "No escalation",
  finance: "finance team",
  production: "production team",
  distribution: "distribution team",
  printing: "printing team",
  support_lead: "support lead",
};

/**
 * Priority floors (AI_SPEC.md section 5) by rule name, as stored in
 * tickets.ai_policy_floor. backend/test/labels.test.ts keeps the names in step.
 */
export const POLICY_FLOOR_LABELS: Record<string, string> = {
  legal_floor: "Legal or rights concerns are Critical",
  isbn_error_floor: "ISBN errors are at least High",
  payment_overdue_floor: "Overdue payments are at least High",
};

/**
 * Knowledge base section titles by id (backend/src/ai/knowledge-base). Each
 * section's first line must match; backend/test/labels.test.ts checks it.
 */
export const KB_SECTION_LABELS: Record<string, string> = {
  "kb.company": "Company overview",
  "kb.royalty": "Royalty policy",
  "kb.isbn": "ISBN policy",
  "kb.printing": "Printing and quality",
  "kb.distribution": "Distribution and availability",
  "kb.production": "Production stages",
  "kb.guidance.royalty_payments": "Response guidance: Royalty & Payments",
  "kb.guidance.isbn_metadata": "Response guidance: ISBN & Metadata Issues",
  "kb.guidance.printing_quality": "Response guidance: Printing & Quality",
  "kb.guidance.distribution_availability": "Response guidance: Distribution & Availability",
  "kb.guidance.book_status_production": "Response guidance: Book Status & Production Updates",
  "kb.guidance.general_inquiry": "Response guidance: General Inquiry",
};
