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

export interface SystemWriter {
  /** One insert for all events (a PATCH can record several changes at once). */
  appendAuditEvents(events: AuditEventInput[]): Promise<void>;
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
  };
}
