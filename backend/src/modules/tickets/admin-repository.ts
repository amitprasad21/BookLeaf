import {
  businessDayStart,
  overdueCreatedBefore,
  type AdminTicketQueueQuery,
  type AiStatus,
  type AiUnavailableReason,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  type ValueSource,
} from "@bookleaf/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listBooksForAuthor, type BookRow } from "../books/repository.js";
import { InvalidTransitionError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { mapPostgrestError } from "./repository.js";

export interface AdminQueueRow {
  id: string;
  reference: string;
  subject: string;
  status: TicketStatus;
  category: TicketCategory | null;
  category_source: ValueSource | null;
  priority: TicketPriority | null;
  priority_source: ValueSource | null;
  ai_status: AiStatus;
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
  version: number;
  author: { author_id: string; name: string };
  book: { book_id: string; title: string } | null;
  assigned_admin: { id: string; display_name: string } | null;
}

export interface QueueSummaryCounts {
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

/** One ticket with everything the admin detail view shows. */
export interface AdminTicketRow extends Omit<AdminQueueRow, "author"> {
  description: string;
  attachment_name: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  ai_category: TicketCategory | null;
  ai_priority: TicketPriority | null;
  ai_confidence: number | null;
  ai_signals: string[];
  ai_rationale: string | null;
  ai_policy_floor: string | null;
  ai_processed_at: string | null;
  ai_failure_reason: AiUnavailableReason | null;
  author: { author_id: string; name: string; city: string | null; joined_date: string };
}

export interface ThreadEntryRow {
  id: string;
  sender_role: "author" | "admin";
  body: string;
  created_at: string;
  sender: { display_name: string } | null;
}

export interface NoteRow {
  id: string;
  body: string;
  created_at: string;
  admin: { id: string; display_name: string };
}

export interface AuditRow {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor: { id: string; display_name: string } | null;
}

export interface AdminTicketDetailRows {
  ticket: AdminTicketRow;
  books: BookRow[];
  messages: ThreadEntryRow[];
  notes: NoteRow[];
  timeline: AuditRow[];
}

/** The only ticket columns an admin update may write (content and ownership are frozen). */
export interface TicketChanges {
  status?: TicketStatus;
  category?: TicketCategory;
  category_source?: ValueSource;
  priority?: TicketPriority;
  priority_source?: ValueSource;
  assigned_admin_id?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
}

/** Who is asking and when: `assignee=me` and the overdue cut-offs depend on it. */
export interface QueueContext {
  adminUserId: string;
  now: Date;
}

/** Admin-side ticket access over the admin's RLS-scoped client (admins see and update every ticket). */
export interface AdminTicketsRepository {
  listQueue(
    query: AdminTicketQueueQuery,
    context: QueueContext,
  ): Promise<{ rows: AdminQueueRow[]; total: number }>;
  summary(now: Date): Promise<QueueSummaryCounts>;
  findTicket(ticketId: string): Promise<AdminTicketRow | null>;
  /** The ticket plus the author's books, thread, internal notes and audit timeline. */
  findDetail(ticketId: string): Promise<AdminTicketDetailRows | null>;
  /**
   * Optimistic lock: applies `changes` only while the ticket is still at
   * `version` (the DB trigger then bumps it). False when it moved on or is gone.
   */
  updateIfVersion(ticketId: string, version: number, changes: TicketChanges): Promise<boolean>;
  /**
   * Admin reply, first response and status in one transaction (the
   * admin_send_reply function, migration 20261018120000). Throws NotFound,
   * InvalidTransition (ticket resolved/closed) or Validation (unknown draft).
   */
  sendReply(ticketId: string, reply: NewReply): Promise<SentReply>;
  /** Null when the ticket doesn't exist. */
  listNotes(ticketId: string): Promise<NoteRow[] | null>;
  addNote(ticketId: string, adminProfileId: string, body: string): Promise<NoteRow>;
  /** How many audit events with this action the ticket has had since the instant (per-ticket caps). */
  countAuditEvents(ticketId: string, action: string, sinceIso: string): Promise<number>;
}

export interface NewReply {
  body: string;
  statusAfter: "in_progress" | "resolved";
  draftId: string | null;
}

export interface SentReply {
  messageId: string;
  createdAt: string;
  previousStatus: TicketStatus;
  newStatus: TicketStatus;
  /** True when this reply was the ticket's first response. */
  firstResponse: boolean;
}

// Both relationships are named: tickets reach profiles and authors through
// several tables (messages, notes, drafts), so PostgREST needs the exact FK.
const QUEUE_COLUMNS = [
  "id, reference, subject, status, category, category_source, priority, priority_source",
  "ai_status, created_at, updated_at, first_response_at, version",
  "author:authors!tickets_author_id_fkey(author_id, name)",
  "book:books(book_id, title)",
  "assigned_admin:profiles!tickets_assigned_admin_id_fkey(id, display_name)",
].join(", ");

const DETAIL_COLUMNS = [
  "id, reference, subject, description, attachment_name, status",
  "category, category_source, priority, priority_source",
  "ai_status, ai_category, ai_priority, ai_confidence, ai_signals, ai_rationale, ai_policy_floor",
  "ai_processed_at, ai_failure_reason",
  "created_at, updated_at, first_response_at, resolved_at, closed_at, version",
  "author:authors!tickets_author_id_fkey(author_id, name, city, joined_date)",
  "book:books(book_id, title)",
  "assigned_admin:profiles!tickets_assigned_admin_id_fkey(id, display_name)",
].join(", ");

const UNRESOLVED: TicketStatus[] = ["open", "in_progress"];
const NOTE_COLUMNS =
  "id, body, created_at, admin:profiles!internal_notes_admin_profile_id_fkey(id, display_name)";
const TICKET_NOT_FOUND = "We couldn't find that ticket.";

/** Business dates are Asia/Kolkata (A-04). */
const nextBusinessDayStart = (date: string) =>
  new Date(businessDayStart(date).getTime() + 24 * 60 * 60 * 1000);

/** One `or` group: tickets created before their priority's overdue cut-off. */
function overdueGroup(now: Date): string {
  const cutOff = overdueCreatedBefore(now);
  const before = (date: Date) => `created_at.lt."${date.toISOString()}"`;
  return [
    `and(priority.eq.critical,${before(cutOff.critical)})`,
    `and(priority.eq.high,${before(cutOff.high)})`,
    `and(priority.is.null,${before(cutOff.untriaged)})`,
    `and(priority.eq.medium,${before(cutOff.medium)})`,
    `and(priority.eq.low,${before(cutOff.low)})`,
  ].join(",");
}

/** Filter methods shared by the list and the head-only counts. */
interface Filterable<Q> {
  eq(column: string, value: unknown): Q;
  in(column: string, values: readonly unknown[]): Q;
  is(column: string, value: null): Q;
  gte(column: string, value: string): Q;
  lt(column: string, value: string): Q;
  or(filters: string): Q;
}

function onlyOverdue<Q extends Filterable<Q>>(builder: Q, now: Date): Q {
  return builder.in("status", UNRESOLVED).is("first_response_at", null).or(overdueGroup(now));
}

/**
 * Supabase implementation over the admin's RLS-scoped client. Sorting and
 * paging happen in the database; `urgency_rank` is the generated column from
 * migration 20261018090000 (unresolved first, then critical, high, untriaged,
 * medium, low). Search text arrives normalised by the shared schema (no filter
 * syntax characters), and is quoted again here.
 */
export function createAdminTicketsRepository(db: SupabaseClient): AdminTicketsRepository {
  async function findTicket(ticketId: string): Promise<AdminTicketRow | null> {
    const { data, error } = await db.from("tickets").select(DETAIL_COLUMNS).eq("id", ticketId).maybeSingle();
    if (error) throw mapPostgrestError(error, "ticket lookup");
    return data as unknown as AdminTicketRow | null;
  }

  return {
    async listQueue(query, { adminUserId, now }) {
      let request = db.from("tickets").select(QUEUE_COLUMNS, { count: "exact" });

      if (query.status?.length) request = request.in("status", query.status);
      if (query.category?.length) request = request.in("category", query.category);
      if (query.priority?.length) {
        const named = query.priority.filter((priority) => priority !== "untriaged");
        const untriaged = named.length < query.priority.length;
        if (!untriaged) request = request.in("priority", named);
        else if (named.length === 0) request = request.is("priority", null);
        else request = request.or(`priority.in.(${named.join(",")}),priority.is.null`);
      }
      if (query.assignee === "me") request = request.eq("assigned_admin_id", adminUserId);
      if (query.assignee === "unassigned") request = request.is("assigned_admin_id", null);
      if (query.aiStatus) request = request.eq("ai_status", query.aiStatus);
      if (query.overdue) request = onlyOverdue(request, now);
      if (query.createdFrom)
        request = request.gte("created_at", businessDayStart(query.createdFrom).toISOString());
      if (query.createdTo)
        request = request.lt("created_at", nextBusinessDayStart(query.createdTo).toISOString());

      if (query.q) {
        const authors = await db.from("authors").select("author_id").ilike("name", `%${query.q}%`).limit(100);
        if (authors.error) throw mapPostgrestError(authors.error, "author search");
        const matches = [`reference.ilike."*${query.q}*"`, `subject.ilike."*${query.q}*"`];
        const authorIds = (authors.data ?? []).map((author) => author.author_id as string);
        if (authorIds.length > 0) matches.push(`author_id.in.(${authorIds.join(",")})`);
        request = request.or(matches.join(","));
      }

      switch (query.sort) {
        case "urgency":
          request = request.order("urgency_rank").order("created_at");
          break;
        case "created_at":
          request = request.order("created_at");
          break;
        case "-created_at":
          request = request.order("created_at", { ascending: false });
          break;
        case "-updated_at":
          request = request.order("updated_at", { ascending: false });
          break;
      }
      // Final tie-break keeps pages stable when timestamps are equal.
      const from = (query.page - 1) * query.pageSize;
      request = request.order("id").range(from, from + query.pageSize - 1);

      const { data, error, count } = await request;
      if (error) throw mapPostgrestError(error, "ticket queue");
      return { rows: (data ?? []) as unknown as AdminQueueRow[], total: count ?? 0 };
    },

    async summary(now) {
      const count = () => db.from("tickets").select("id", { count: "exact", head: true });
      const results = await Promise.all([
        count().eq("status", "open"),
        count().eq("status", "in_progress"),
        count().eq("status", "resolved"),
        count().eq("status", "closed"),
        count().in("status", UNRESOLVED).is("assigned_admin_id", null),
        count().in("status", UNRESOLVED).eq("priority", "critical"),
        count().in("status", UNRESOLVED).eq("priority", "high"),
        onlyOverdue(count(), now),
        count().in("status", UNRESOLVED).eq("ai_status", "manual_review_required"),
      ]);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw mapPostgrestError(failed.error, "queue summary");
      const [open, inProgress, resolved, closed, unassigned, critical, high, slaBreached, needsManualTriage] =
        results.map((result) => result.count ?? 0) as [
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
        ];
      return {
        open,
        inProgress,
        resolved,
        closed,
        unassigned,
        critical,
        high,
        slaBreached,
        needsManualTriage,
      };
    },

    findTicket,

    async findDetail(ticketId) {
      const ticket = await findTicket(ticketId);
      if (!ticket) return null;
      const [books, messages, notes, timeline] = await Promise.all([
        listBooksForAuthor(db, ticket.author.author_id),
        db
          .from("ticket_messages")
          .select(
            "id, sender_role, body, created_at, sender:profiles!ticket_messages_sender_profile_id_fkey(display_name)",
          )
          .eq("ticket_id", ticketId)
          .order("created_at")
          .order("id"),
        db
          .from("internal_notes")
          .select(
            "id, body, created_at, admin:profiles!internal_notes_admin_profile_id_fkey(id, display_name)",
          )
          .eq("ticket_id", ticketId)
          .order("created_at")
          .order("id"),
        db
          .from("audit_events")
          .select(
            "id, action, metadata, created_at, actor:profiles!audit_events_actor_profile_id_fkey(id, display_name)",
          )
          .eq("ticket_id", ticketId)
          .order("created_at")
          .order("id"),
      ]);
      for (const [result, operation] of [
        [messages, "thread lookup"],
        [notes, "notes lookup"],
        [timeline, "timeline lookup"],
      ] as const) {
        if (result.error) throw mapPostgrestError(result.error, operation);
      }
      return {
        ticket,
        books,
        messages: (messages.data ?? []) as unknown as ThreadEntryRow[],
        notes: (notes.data ?? []) as unknown as NoteRow[],
        timeline: (timeline.data ?? []) as unknown as AuditRow[],
      };
    },

    async updateIfVersion(ticketId, version, changes) {
      const { data, error } = await db
        .from("tickets")
        .update(changes)
        .eq("id", ticketId)
        .eq("version", version)
        .select("id");
      if (error) throw mapPostgrestError(error, "ticket update");
      return (data ?? []).length === 1;
    },

    async sendReply(ticketId, reply) {
      const { data, error } = await db
        .rpc("admin_send_reply", {
          p_ticket_id: ticketId,
          p_body: reply.body,
          p_status_after: reply.statusAfter,
          p_draft_id: reply.draftId,
        })
        .single();
      if (error) {
        if (error.code === "P0002") throw new NotFoundError(TICKET_NOT_FOUND);
        if (error.message === "reply_requires_reopen") {
          throw new InvalidTransitionError("Reopen this ticket (set it to In progress) before replying.");
        }
        if (error.message === "draft_not_found") {
          throw new ValidationError(undefined, [
            { path: "draftId", issue: "must be a draft of this ticket" },
          ]);
        }
        throw mapPostgrestError(error, "admin reply");
      }
      const row = data as {
        message_id: string;
        message_created_at: string;
        previous_status: TicketStatus;
        new_status: TicketStatus;
        first_response: boolean;
      };
      return {
        messageId: row.message_id,
        createdAt: row.message_created_at,
        previousStatus: row.previous_status,
        newStatus: row.new_status,
        firstResponse: row.first_response,
      };
    },

    async listNotes(ticketId) {
      const [ticket, notes] = await Promise.all([
        db.from("tickets").select("id").eq("id", ticketId).maybeSingle(),
        db
          .from("internal_notes")
          .select(NOTE_COLUMNS)
          .eq("ticket_id", ticketId)
          .order("created_at")
          .order("id"),
      ]);
      if (ticket.error) throw mapPostgrestError(ticket.error, "ticket lookup");
      if (notes.error) throw mapPostgrestError(notes.error, "notes lookup");
      return ticket.data ? ((notes.data ?? []) as unknown as NoteRow[]) : null;
    },

    async addNote(ticketId, adminProfileId, body) {
      const { data, error } = await db
        .from("internal_notes")
        .insert({ ticket_id: ticketId, admin_profile_id: adminProfileId, body })
        .select(NOTE_COLUMNS)
        .single();
      // The ticket FK is the existence check (one round trip).
      if (error?.code === "23503") throw new NotFoundError(TICKET_NOT_FOUND);
      if (error) throw mapPostgrestError(error, "note insert");
      return data as unknown as NoteRow;
    },

    async countAuditEvents(ticketId, action, sinceIso) {
      const { count, error } = await db
        .from("audit_events")
        .select("id", { count: "exact", head: true })
        .eq("ticket_id", ticketId)
        .eq("action", action)
        .gte("created_at", sinceIso);
      if (error) throw mapPostgrestError(error, "audit count");
      return count ?? 0;
    },
  };
}
