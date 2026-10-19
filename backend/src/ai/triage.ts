// AI triage job (AI_SPEC.md section 6, .back/AI_PROVIDER_ORCHESTRATION.md
// section 6). Runs after the ticket is saved, never on the request path:
// load (system writer) → facts → prompt → route (one repair attempt on an
// unusable answer) → validate → floors → save, or record the failure.
import {
  businessDate,
  TriageResultSchema,
  type AiUnavailableReason,
  type TriageResult,
} from "@bookleaf/shared";
import type { Logger } from "pino";
import type { SystemWriter, TriageClaim, TriageTicket, TriageWrite } from "../db/system-writer.js";
import type { Clock } from "../lib/clock.js";
import { createAuditRecorder } from "../modules/audit/service.js";
import { buildTriageFacts } from "./facts/triage-facts.js";
import {
  buildTriageUserContent,
  TRIAGE_MAX_OUTPUT_TOKENS,
  TRIAGE_PROMPT_VERSION,
  TRIAGE_REPAIR_NOTE,
  TRIAGE_SCHEMA_NAME,
  TRIAGE_SYSTEM_PROMPT,
} from "./prompts/triage.js";
import { AiRouteError, type AiRouter, type RoutedResult } from "./router.js";
import { applyPriorityFloors } from "./validation/floors.js";

export const MAX_TRIAGE_ATTEMPTS = 3; // 1 automatic + 2 sweeper retries

export type TriageOutcome = "completed" | "failed" | "manual_review_required" | "skipped";

export interface TriageServiceDeps {
  router: AiRouter;
  writer: SystemWriter;
  clock: Clock;
  logger: Logger;
  timeoutMs: number;
}

const eligible = (ticket: TriageTicket) =>
  (ticket.aiStatus === "pending" || ticket.aiStatus === "failed") && ticket.aiAttempts < MAX_TRIAGE_ATTEMPTS;

export function createTriageService({ router, writer, clock, logger, timeoutMs }: TriageServiceDeps) {
  const audit = createAuditRecorder(writer, logger);

  const route = (ticketId: string, user: string) =>
    router.route(
      {
        task: "triage",
        system: TRIAGE_SYSTEM_PROMPT,
        user,
        schema: TriageResultSchema,
        schemaName: TRIAGE_SCHEMA_NAME,
        maxOutputTokens: TRIAGE_MAX_OUTPUT_TOKENS,
        timeoutMs,
      },
      { ticketId, promptVersion: TRIAGE_PROMPT_VERSION },
    );

  async function routeWithRepair(ticketId: string, user: string): Promise<RoutedResult<TriageResult>> {
    try {
      return await route(ticketId, user);
    } catch (error) {
      if (!(error instanceof AiRouteError) || error.reason !== "invalid_output") throw error;
      return route(ticketId, user + TRIAGE_REPAIR_NOTE); // one repair attempt
    }
  }

  /** Write with the optimistic lock; on a conflict reload and re-apply (no new AI call). */
  async function persist(
    ticket: TriageTicket,
    write: (claim: TriageClaim) => Promise<boolean>,
  ): Promise<boolean> {
    let claim: TriageTicket | null = ticket;
    for (let attempt = 0; attempt < 3 && claim; attempt += 1) {
      if (await write(claim)) return true;
      claim = await writer.loadTicketForTriage(ticket.id);
      if (claim && !eligible(claim)) return false; // someone else finished it meanwhile
    }
    return false;
  }

  async function run(ticketId: string): Promise<TriageOutcome> {
    const ticket = await writer.loadTicketForTriage(ticketId);
    if (!ticket || !eligible(ticket)) return "skipped";

    const now = clock();
    const user = buildTriageUserContent(
      buildTriageFacts(ticket.bookId, ticket.authorBooks, businessDate(now)),
      ticket,
    );
    try {
      const routed = await routeWithRepair(ticketId, user);
      const value = routed.value;
      const floored = applyPriorityFloors(value.priority, value.signals);
      const result: TriageWrite = {
        category: value.category,
        priority: floored.priority,
        confidence: value.confidence,
        signals: value.signals,
        rationale: value.rationale,
        policyFloor: floored.floor,
        promptVersion: TRIAGE_PROMPT_VERSION,
        processedAt: clock().toISOString(),
      };
      if (!(await persist(ticket, (claim) => writer.saveTriageResult(claim, result)))) return "skipped";
      await audit({
        ticketId,
        actorProfileId: null, // system / AI
        action: "ticket.triaged",
        metadata: {
          category: result.category,
          priority: result.priority,
          confidence: result.confidence,
          policyFloor: result.policyFloor,
          provider: routed.provider,
          model: routed.model,
          promptVersion: TRIAGE_PROMPT_VERSION,
        },
      });
      return "completed";
    } catch (error) {
      if (!(error instanceof AiRouteError)) throw error;
      const reason: AiUnavailableReason = error.reason;
      // Retry later only if it can succeed and attempts remain; otherwise a human takes over.
      const final = !error.retryable || ticket.aiAttempts + 1 >= MAX_TRIAGE_ATTEMPTS;
      const at = clock().toISOString();
      if (!(await persist(ticket, (claim) => writer.markTriageFailure(claim, reason, final, at))))
        return "skipped";
      logger.info({ ticketId, reason, final }, "AI triage unavailable; ticket left for manual triage");
      return final ? "manual_review_required" : "failed";
    }
  }

  return { run };
}

export type TriageService = ReturnType<typeof createTriageService>;
