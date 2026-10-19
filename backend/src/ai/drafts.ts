// AI reply drafts (AI_SPEC.md section 9, .back/AI_PROVIDER_ORCHESTRATION.md
// section 7). Runs on the admin's request with the admin's RLS-scoped data:
// load the ticket → KB sections + facts → context hash → reuse a ready draft,
// or generate (one repair attempt) → guards → fact warnings → store → audit.
// A draft is only ever a suggestion: nothing reaches the author until an
// admin sends a reply.
import { createHash } from "node:crypto";
import {
  businessDate,
  businessDayStart,
  DraftResultSchema,
  type DraftResult,
  type TicketCategory,
} from "@bookleaf/shared";
import { NotFoundError, RateLimitedError } from "../lib/errors.js";
import type { Clock } from "../lib/clock.js";
import type { AuditRecorder } from "../modules/audit/service.js";
import type { AdminTicketsRepository, AiDraftRow } from "../modules/tickets/admin-repository.js";
import { buildDraftFacts } from "./facts/draft-facts.js";
import { KB_VERSION, selectKbSections } from "./knowledge-base/index.js";
import {
  buildDraftUserContent,
  DRAFT_MAX_OUTPUT_TOKENS,
  DRAFT_PROMPT_VERSION,
  DRAFT_SCHEMA_NAME,
  DRAFT_SYSTEM_PROMPT,
  draftRepairNote,
} from "./prompts/draft.js";
import { AiRouteError, type AiRouter, type RoutedResult } from "./router.js";
import { draftShapeProblem, factWarnings, withStandardSignOff } from "./validation/draft-guards.js";

/** Forced regenerations per ticket per India business day (AI_SPEC section 9). */
export const DRAFT_REGENERATIONS_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DraftStore = Pick<
  AdminTicketsRepository,
  "findDetail" | "findReadyDraft" | "insertDraft" | "supersedeOtherDrafts" | "countAuditEvents"
>;

export interface DraftRequest {
  store: DraftStore;
  ticketId: string;
  adminId: string;
  regenerate: boolean;
}

export interface DraftService {
  /** `created: false` means a ready draft for the same context was reused (no AI call). */
  getOrCreate(request: DraftRequest): Promise<{ draft: AiDraftRow; created: boolean }>;
}

export function createDraftService(deps: {
  router: AiRouter;
  clock: Clock;
  audit: AuditRecorder;
  timeoutMs: number;
}): DraftService {
  const route = (ticketId: string, user: string) =>
    deps.router.route(
      {
        task: "draft",
        system: DRAFT_SYSTEM_PROMPT,
        user,
        schema: DraftResultSchema,
        schemaName: DRAFT_SCHEMA_NAME,
        maxOutputTokens: DRAFT_MAX_OUTPUT_TOKENS,
        timeoutMs: deps.timeoutMs,
      },
      { ticketId, promptVersion: DRAFT_PROMPT_VERSION },
    );

  /** One generation plus at most one repair attempt for schema or guard problems. */
  async function generate(
    ticketId: string,
    user: string,
    sections: readonly string[],
  ): Promise<RoutedResult<DraftResult>> {
    let problem: string;
    try {
      const first = await route(ticketId, user);
      const shape = draftShapeProblem(first.value, sections);
      if (!shape) return first;
      problem = shape;
    } catch (error) {
      if (!(error instanceof AiRouteError) || error.reason !== "invalid_output") throw error;
      problem = "it did not match the required JSON format and limits";
    }
    const repaired = await route(ticketId, user + draftRepairNote(problem));
    if (draftShapeProblem(repaired.value, sections)) throw new AiRouteError("invalid_output", false);
    return repaired;
  }

  return {
    async getOrCreate({ store, ticketId, adminId, regenerate }) {
      const detail = await store.findDetail(ticketId);
      if (!detail) throw new NotFoundError("We couldn't find that ticket.");
      const { ticket } = detail;
      const now = deps.clock();
      const today = businessDate(now);

      const category: TicketCategory = ticket.category ?? ticket.ai_category ?? "general_inquiry";
      const sections = selectKbSections(category, ticket.ai_signals ?? []);
      const facts = buildDraftFacts(
        {
          authorName: ticket.author.name,
          bookId: ticket.book?.book_id ?? null,
          category,
          books: detail.books,
        },
        today,
      );
      const thread = detail.messages.map((message) => ({
        senderRole: message.sender_role,
        body: message.body,
      }));
      const contextHash = createHash("sha256")
        .update(
          JSON.stringify([
            DRAFT_PROMPT_VERSION,
            KB_VERSION,
            deps.router.modelFor("draft") ?? "none",
            category,
            ticket.subject,
            ticket.description,
            detail.messages.at(-1)?.id ?? null,
            facts,
          ]),
        )
        .digest("hex");

      if (!regenerate) {
        const cached = await store.findReadyDraft(ticketId, contextHash);
        if (cached) return { draft: cached, created: false };
      } else {
        const dayStart = businessDayStart(today);
        const used = await store.countAuditEvents(ticketId, "ai.draft_regenerated", dayStart.toISOString());
        if (used >= DRAFT_REGENERATIONS_PER_DAY) {
          throw new RateLimitedError(
            Math.max(1, Math.ceil((dayStart.getTime() + DAY_MS - now.getTime()) / 1000)),
            `This ticket's draft was regenerated ${DRAFT_REGENERATIONS_PER_DAY} times today. Edit the current draft or write the reply manually.`,
          );
        }
      }

      const user = buildDraftUserContent({
        sections,
        facts,
        ticket: {
          category,
          priority: ticket.priority,
          subject: ticket.subject,
          description: ticket.description,
        },
        thread,
      });
      const result = await generate(ticketId, user, sections);
      const reply = withStandardSignOff(result.value.reply);
      const warnings = factWarnings(reply, {
        facts,
        authorText: [ticket.subject, ticket.description, ...thread.map((message) => message.body)].join("\n"),
      });

      const draft = await store.insertDraft({
        ticket_id: ticketId,
        reply,
        kb_sections_used: result.value.kb_sections_used,
        needs_escalation: result.value.needs_escalation,
        escalation_team: result.value.escalation_team,
        internal_checklist: result.value.internal_checklist,
        missing_information: result.value.missing_information,
        fact_warnings: warnings,
        context_hash: contextHash,
        prompt_version: DRAFT_PROMPT_VERSION,
        provider: result.provider,
        model: result.model,
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        requested_by: adminId,
      });
      await store.supersedeOtherDrafts(ticketId, draft.id);
      await deps.audit({
        ticketId,
        actorProfileId: adminId,
        action: regenerate ? "ai.draft_regenerated" : "ai.draft_generated",
        metadata: {
          draftId: draft.id,
          provider: result.provider,
          model: result.model,
          promptVersion: DRAFT_PROMPT_VERSION,
          kbSections: result.value.kb_sections_used,
          factWarnings: warnings.length,
        },
      });
      return { draft, created: true };
    },
  };
}

/** AI turned off (and the default in tests): every draft request is 503 not_configured. */
export const disabledDrafts: DraftService = {
  async getOrCreate() {
    throw new AiRouteError("not_configured", false);
  },
};
