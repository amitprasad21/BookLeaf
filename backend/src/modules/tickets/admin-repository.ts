import {
  overdueCreatedBefore,
  type AdminTicketQueueQuery,
  type AiStatus,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  type ValueSource,
} from "@bookleaf/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
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

/** Who is asking and when: `assignee=me` and the overdue cut-offs depend on it. */
export interface QueueContext {
  adminUserId: string;
  now: Date;
}

/** Admin-side ticket reads. RLS lets admins see every ticket; nothing here writes. */
export interface AdminTicketsRepository {
  listQueue(
    query: AdminTicketQueueQuery,
    context: QueueContext,
  ): Promise<{ rows: AdminQueueRow[]; total: number }>;
  summary(now: Date): Promise<QueueSummaryCounts>;
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

const UNRESOLVED: TicketStatus[] = ["open", "in_progress"];

/** Business dates are Asia/Kolkata (A-04), which has no daylight saving. */
const businessDayStart = (date: string) => new Date(`${date}T00:00:00+05:30`);
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
  };
}
