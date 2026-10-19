// The ONLY place the RLS-bypassing secret key is used at runtime
// (.back/AUTH_SECURITY.md section 5). Narrow, typed operations only, never a
// generic client. ESLint restricts imports to src/ai/**, src/modules/audit/**
// and src/server.ts.
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

export interface SystemWriter {
  /** One insert for all events (a PATCH can record several changes at once). */
  appendAuditEvents(events: AuditEventInput[]): Promise<void>;
  appendUsageEvent(event: UsageEventInput): Promise<void>;
  /** Input + output tokens recorded since `sinceIso` (the daily AI budget). */
  tokensUsedSince(sinceIso: string): Promise<number>;
}

const PAGE = 1000;

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
  };
}
