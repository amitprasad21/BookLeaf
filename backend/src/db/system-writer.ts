// The ONLY place the RLS-bypassing secret key is used at runtime
// (.back/AUTH_SECURITY.md section 5). Narrow, typed operations only, never a
// generic client. ESLint restricts imports to src/ai/**, src/modules/audit/**
// and src/server.ts.
import type {
  AiStatus,
  AiUnavailableReason,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TriageSignal,
  ValueSource,
} from "@bookleaf/shared";
import { createClient } from "@supabase/supabase-js";

export interface AuditEventInput {
  ticketId: string | null;
  /** null = system / AI */
  actorProfileId: string | null;
  /** e.g. "ticket.created"; must match ^[a-z_]+\.[a-z_]+$ (DB check). */
  action: string;
  /** Old/new values and ids only: never message bodies or ticket text. */
  metadata?: Record<string, unknown>;
}

export type UsageOutcome =
  | "success"
  | "invalid_output"
  | "refused"
  | "timeout"
  | "rate_limited"
  | "provider_error"
  | "auth_error"
  | "budget_blocked"
  | "circuit_open"
  | "not_configured";

/** One AI call attempt (or skip) for cost and reliability accounting. Never prompt or output text. */
export interface UsageEventInput {
  ticketId: string | null;
  task: "triage" | "draft";
  provider: string;
  model: string;
  promptVersion: string | null;
  outcome: UsageOutcome;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  latencyMs: number | null;
  estimatedCostUsd: number;
}

/** What background triage reads (there's no user session in a background job). */
export interface TriageTicket {
  id: string;
  version: number;
  authorId: string;
  bookId: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  aiStatus: AiStatus;
  aiAttempts: number;
  categorySource: ValueSource | null;
  prioritySource: ValueSource | null;
  /** The author's books, for the triage facts (catalogue and royalty fields only). */
  authorBooks: {
    book_id: string;
    title: string;
    status: string;
    publication_date: string | null;
    last_royalty_payout_date: string | null;
    royalty_pending: number;
  }[];
}

export interface TriageWrite {
  category: TicketCategory;
  /** After policy floors. */
  priority: TicketPriority;
  confidence: number;
  signals: TriageSignal[];
  rationale: string;
  policyFloor: string | null;
  promptVersion: string;
  processedAt: string;
}

/** The loaded state a triage write is conditional on (optimistic lock). */
export type TriageClaim = Pick<
  TriageTicket,
  "id" | "version" | "aiAttempts" | "categorySource" | "prioritySource"
>;

export interface SystemWriter {
  /** One insert for all events (a PATCH can record several changes at once). */
  appendAuditEvents(events: AuditEventInput[]): Promise<void>;
  appendUsageEvent(event: UsageEventInput): Promise<void>;
  /** Input + output tokens recorded since `sinceIso` (the daily AI budget). */
  tokensUsedSince(sinceIso: string): Promise<number>;
  loadTicketForTriage(ticketId: string): Promise<TriageTicket | null>;
  /**
   * Store the AI suggestion and mark it completed. Effective category/priority
   * change only where an admin hasn't set them. False if the ticket changed
   * since it was loaded (the caller reloads and tries again).
   */
  saveTriageResult(claim: TriageClaim, result: TriageWrite): Promise<boolean>;
  /** `final` → manual_review_required, else failed (the sweeper retries). Same lock as above. */
  markTriageFailure(
    claim: TriageClaim,
    reason: AiUnavailableReason,
    final: boolean,
    at: string,
  ): Promise<boolean>;
  /** Manual re-triage: back to pending with a fresh attempt count. False if the ticket doesn't exist. */
  resetTriage(ticketId: string): Promise<boolean>;
  /** Pending or failed tickets untouched since `olderThanIso`, with attempts left. */
  listTicketsForSweep(olderThanIso: string, maxAttempts: number, limit: number): Promise<string[]>;
}

const PAGE = 1000;

const TRIAGE_COLUMNS = [
  "id, version, author_id, book_id, subject, description, status",
  "ai_status, ai_attempts, category_source, priority_source",
  "author:authors!tickets_author_id_fkey(books(book_id, title, status, publication_date, last_royalty_payout_date, royalty_pending))",
].join(", ");

interface TriageRow {
  id: string;
  version: number;
  author_id: string;
  book_id: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  ai_status: AiStatus;
  ai_attempts: number;
  category_source: ValueSource | null;
  priority_source: ValueSource | null;
  author: { books: TriageTicket["authorBooks"] } | null;
}

export function createSystemWriter(project: { url: string; secretKey: string }): SystemWriter {
  const db = createClient(project.url, project.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    async appendAuditEvents(events) {
      if (events.length === 0) return;
      // One INSERT shares a single now(), so events would tie on created_at
      // and the timeline could show them in any order. Stamp them 1 ms apart.
      const start = Date.now();
      const { error } = await db.from("audit_events").insert(
        events.map((event, index) => ({
          ticket_id: event.ticketId,
          actor_profile_id: event.actorProfileId,
          action: event.action,
          metadata: event.metadata ?? {},
          created_at: new Date(start + index).toISOString(),
        })),
      );
      if (error) throw new Error(`audit insert failed (${error.code})`);
    },

    async appendUsageEvent(event) {
      const { error } = await db.from("ai_usage_events").insert({
        ticket_id: event.ticketId,
        task: event.task,
        provider: event.provider,
        model: event.model,
        prompt_version: event.promptVersion,
        outcome: event.outcome,
        input_tokens: event.inputTokens,
        output_tokens: event.outputTokens,
        cache_read_tokens: event.cacheReadTokens,
        cache_write_tokens: event.cacheWriteTokens,
        latency_ms: event.latencyMs,
        estimated_cost_usd: event.estimatedCostUsd,
      });
      if (error) throw new Error(`usage insert failed (${error.code})`);
    },

    async tokensUsedSince(sinceIso) {
      // Summed here: the Data API has aggregates off. A day is a few hundred rows.
      let total = 0;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db
          .from("ai_usage_events")
          .select("input_tokens, output_tokens")
          .gte("created_at", sinceIso)
          .order("id")
          .range(from, from + PAGE - 1);
        if (error) throw new Error(`usage read failed (${error.code})`);
        for (const row of data ?? []) total += row.input_tokens + row.output_tokens;
        if ((data ?? []).length < PAGE) return total;
      }
    },

    async loadTicketForTriage(ticketId) {
      const { data, error } = await db
        .from("tickets")
        .select(TRIAGE_COLUMNS)
        .eq("id", ticketId)
        .maybeSingle();
      if (error) throw new Error(`triage load failed (${error.code})`);
      if (!data) return null;
      const row = data as unknown as TriageRow;
      return {
        id: row.id,
        version: row.version,
        authorId: row.author_id,
        bookId: row.book_id,
        subject: row.subject,
        description: row.description,
        status: row.status,
        aiStatus: row.ai_status,
        aiAttempts: row.ai_attempts,
        categorySource: row.category_source,
        prioritySource: row.priority_source,
        authorBooks: row.author?.books ?? [],
      };
    },

    async saveTriageResult(claim, result) {
      const { data, error } = await db
        .from("tickets")
        .update({
          ai_status: "completed",
          ai_category: result.category,
          ai_priority: result.priority,
          ai_confidence: Math.round(result.confidence * 100) / 100, // numeric(3, 2)
          ai_signals: result.signals,
          ai_rationale: result.rationale,
          ai_policy_floor: result.policyFloor,
          ai_prompt_version: result.promptVersion,
          ai_processed_at: result.processedAt,
          ai_failure_reason: null,
          ai_attempts: claim.aiAttempts + 1,
          // Overrides are sacred: an admin-set value is never replaced by AI.
          ...(claim.categorySource === "admin" ? {} : { category: result.category, category_source: "ai" }),
          ...(claim.prioritySource === "admin" ? {} : { priority: result.priority, priority_source: "ai" }),
        })
        .eq("id", claim.id)
        .eq("version", claim.version)
        .select("id");
      if (error) throw new Error(`triage save failed (${error.code})`);
      return (data ?? []).length === 1;
    },

    async markTriageFailure(claim, reason, final, at) {
      const { data, error } = await db
        .from("tickets")
        .update({
          ai_status: final ? "manual_review_required" : "failed",
          ai_failure_reason: reason,
          ai_attempts: claim.aiAttempts + 1,
          ai_processed_at: at,
        })
        .eq("id", claim.id)
        .eq("version", claim.version)
        .select("id");
      if (error) throw new Error(`triage failure write failed (${error.code})`);
      return (data ?? []).length === 1;
    },

    async resetTriage(ticketId) {
      const { data, error } = await db
        .from("tickets")
        .update({ ai_status: "pending", ai_failure_reason: null, ai_attempts: 0 })
        .eq("id", ticketId)
        .select("id");
      if (error) throw new Error(`triage reset failed (${error.code})`);
      return (data ?? []).length === 1;
    },

    async listTicketsForSweep(olderThanIso, maxAttempts, limit) {
      const { data, error } = await db
        .from("tickets")
        .select("id")
        .in("ai_status", ["pending", "failed"])
        .lt("ai_attempts", maxAttempts)
        .lt("updated_at", olderThanIso)
        .order("created_at")
        .limit(limit);
      if (error) throw new Error(`sweep query failed (${error.code})`);
      return (data ?? []).map((row) => row.id as string);
    },
  };
}
