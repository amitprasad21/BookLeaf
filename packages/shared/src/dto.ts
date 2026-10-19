// Response DTOs (openapi.yaml components/schemas). The backend serializers
// return these types, so a field the contract doesn't list fails to compile
// there before a frontend can depend on it.
import type { EscalationTeam } from "./draft.js";
import type { AiStatus, Role, TicketCategory, TicketPriority, TicketStatus, ValueSource } from "./enums.js";
import type { AiUnavailableReason } from "./errors.js";
import type { SlaState } from "./sla.js";
import type { TriageSignal } from "./triage.js";

/** Success envelope: `{ data, meta? }`. */
export interface ApiEnvelope<T, M = undefined> {
  data: T;
  meta?: M;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface AuthorProfileDto {
  authorId: string;
  name: string;
  city: string | null;
  joinedDate: string;
}

/** GET /me */
export interface MeDto {
  userId: string;
  role: Role;
  displayName: string;
  author: AuthorProfileDto | null;
}

/** Nullable fields are null for books still in production; never coerce them to zero. */
export interface BookDto {
  bookId: string;
  title: string;
  isbn: string;
  genre: string;
  publicationDate: string | null;
  status: string;
  isPublished: boolean;
  mrp: number | null;
  authorRoyaltyPerCopy: number | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: number;
  royaltyPaid: number;
  royaltyPending: number;
  lastRoyaltyPayoutDate: string | null;
  printPartner: string | null;
  availableOn: string[];
}

export interface RoyaltySummaryDto {
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
  payoutThreshold: number;
  /** 0 < totalPending < payoutThreshold: rolls over to the next quarter. */
  pendingBelowThreshold: boolean;
  nextPayoutDueBy: string;
}

/** GET /author/books */
export interface AuthorBooksDto {
  books: BookDto[];
  summary: RoyaltySummaryDto;
}

export interface BookRefDto {
  bookId: string;
  title: string;
}

export interface ThreadMessageDto {
  id: string;
  senderRole: Role;
  senderName: string;
  body: string;
  createdAt: string;
}

export interface AuthorTicketSummaryDto {
  id: string;
  reference: string;
  subject: string;
  status: TicketStatus;
  book: BookRefDto | null;
  createdAt: string;
  updatedAt: string;
  hasAdminReply: boolean;
}

/** Author-safe view: no AI, priority, category, assignee or note fields. */
export interface AuthorTicketDetailDto extends AuthorTicketSummaryDto {
  description: string;
  attachmentName: string | null;
  messages: ThreadMessageDto[];
}

// ---------- Admin ----------

export interface AdminRefDto {
  userId: string;
  displayName: string;
}

/** GET /admin/tickets item. `slaState` is computed by the API at request time. */
export interface AdminQueueItemDto {
  id: string;
  reference: string;
  subject: string;
  author: { authorId: string; name: string };
  book: BookRefDto | null;
  status: TicketStatus;
  category: TicketCategory | null;
  categorySource: ValueSource | null;
  priority: TicketPriority | null;
  prioritySource: ValueSource | null;
  aiStatus: AiStatus;
  assignedAdmin: AdminRefDto | null;
  createdAt: string;
  updatedAt: string;
  firstResponseAt: string | null;
  slaState: SlaState;
  /** Optimistic lock for PATCH. */
  version: number;
}

/** GET /admin/tickets/summary. Status counts cover every ticket; the rest unresolved ones only. */
export interface QueueSummaryDto {
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  unassigned: number;
  critical: number;
  high: number;
  slaBreached: number;
  needsManualTriage: number;
}

export interface InternalNoteDto {
  id: string;
  author: AdminRefDto;
  body: string;
  createdAt: string;
}

export interface AiSuggestionDto {
  status: AiStatus;
  suggestedCategory: TicketCategory | null;
  suggestedPriority: TicketPriority | null;
  confidence: number | null;
  signals: TriageSignal[];
  rationale: string | null;
  /** The deterministic rule that raised the priority (POLICY_FLOOR_LABELS). */
  policyFloorApplied: string | null;
  processedAt: string | null;
  failureReason: AiUnavailableReason | null;
}

export interface TimelineEventDto {
  id: string;
  action: string;
  actor: AdminRefDto | null;
  /** Old/new values and ids only; never message or note text. */
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** GET/PATCH /admin/tickets/{id}; also `error.current` on VERSION_CONFLICT. */
export interface AdminTicketDetailDto extends AdminQueueItemDto {
  description: string;
  attachmentName: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  authorContext: { author: AuthorProfileDto; books: BookDto[] };
  messages: ThreadMessageDto[];
  notes: InternalNoteDto[];
  ai: AiSuggestionDto;
  timeline: TimelineEventDto[];
}

/** POST /admin/tickets/{id}/draft. A suggestion only, until an admin sends it. */
export interface AiDraftDto {
  id: string;
  ticketId: string;
  reply: string;
  kbSectionsUsed: string[];
  needsEscalation: boolean;
  escalationTeam: EscalationTeam;
  internalChecklist: string[];
  missingInformation: string[];
  factWarnings: string[];
  promptVersion: string;
  model: string;
  createdAt: string;
}

/** POST /admin/tickets/{id}/triage (202). */
export interface TriageAcceptedDto {
  aiStatus: "pending";
}
