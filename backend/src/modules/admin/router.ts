import {
  businessDate,
  businessDayStart,
  AdminReplyRequestSchema,
  DraftRequestSchema,
  AdminTicketQueueQuerySchema,
  MessageBodyRequestSchema,
  TicketIdParamsSchema,
  UpdateTicketRequestSchema,
  type QueueSummaryDto,
  type ThreadMessageDto,
  type TriageAcceptedDto,
} from "@bookleaf/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Router } from "express";
import type { Logger } from "pino";
import type { Clock } from "../../lib/clock.js";
import type { TriageControl } from "../../ai/control.js";
import type { DraftService } from "../../ai/drafts.js";
import type { EventHub } from "../../events/hub.js";
import { updateEvents } from "../../events/ticket-events.js";
import {
  AiUnavailableError,
  NotFoundError,
  RateLimitedError,
  VersionConflictError,
} from "../../lib/errors.js";
import { perUserLimit } from "../../middleware/rate-limit.js";
import { authOf, dbOf } from "../../middleware/authenticate.js";
import type { AuditRecorder } from "../audit/service.js";
import type { AdminTicketsRepository } from "../tickets/admin-repository.js";
import { planTicketUpdate } from "../tickets/admin-service.js";
import {
  toAdminQueueItem,
  toAdminTicketDetail,
  toAiDraft,
  toInternalNote,
} from "../tickets/serializers/admin.js";

export interface AdminRouterDeps {
  clock: Clock;
  audit: AuditRecorder;
  adminTicketsRepository: (db: SupabaseClient) => AdminTicketsRepository;
  triage: TriageControl;
  drafts: DraftService;
  events: EventHub;
  logger: Logger;
}

const TICKET_NOT_FOUND = "We couldn't find that ticket.";
/** Manual AI re-triage cap per ticket per business day (AI_PROVIDER_ORCHESTRATION section 5). */
export const MANUAL_TRIAGE_PER_DAY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAGE_ACCEPTED: TriageAcceptedDto = { aiStatus: "pending" };

/** /api/v1/admin/* (role admin, enforced in app.ts). */
export function createAdminRouter({
  clock,
  audit,
  adminTicketsRepository,
  triage,
  drafts,
  events,
  logger,
}: AdminRouterDeps) {
  const router = Router();
  const triageLimit = perUserLimit({
    windowMs: 60_000,
    limit: 5,
    message: "Too many AI triage requests. Please wait a minute.",
  });

  // operationId: listAdminTickets. Default sort: unresolved first, then
  // priority (critical, high, untriaged, medium, low), then oldest.
  router.get("/tickets", async (req, res) => {
    const query = AdminTicketQueueQuerySchema.parse(req.query);
    const now = clock();
    const { rows, total } = await adminTicketsRepository(dbOf(req)).listQueue(query, {
      adminUserId: authOf(req).userId,
      now,
    });
    res.json({
      data: rows.map((row) => toAdminQueueItem(row, now)),
      meta: { page: query.page, pageSize: query.pageSize, total },
    });
  });

  // operationId: getAdminTicketSummary. Registered before /tickets/:ticketId.
  router.get("/tickets/summary", async (req, res) => {
    const summary: QueueSummaryDto = await adminTicketsRepository(dbOf(req)).summary(clock());
    res.json({ data: summary });
  });

  // operationId: getAdminTicket
  router.get("/tickets/:ticketId", async (req, res) => {
    const { ticketId } = TicketIdParamsSchema.parse(req.params);
    const detail = await adminTicketsRepository(dbOf(req)).findDetail(ticketId);
    if (!detail) throw new NotFoundError(TICKET_NOT_FOUND);
    res.json({ data: toAdminTicketDetail(detail, clock()) });
  });

  // operationId: updateAdminTicket. Optimistic lock on `version`: a stale
  // version is a 409 carrying the current ticket, checked again atomically in
  // the UPDATE so two admins can't both win. Audit events follow the commit.
  router.patch("/tickets/:ticketId", async (req, res) => {
    const { ticketId } = TicketIdParamsSchema.parse(req.params);
    const input = UpdateTicketRequestSchema.parse(req.body);
    const auth = authOf(req);
    const repository = adminTicketsRepository(dbOf(req));
    const now = clock();

    const conflict = async () => {
      const latest = await repository.findDetail(ticketId);
      if (!latest) return new NotFoundError(TICKET_NOT_FOUND);
      return new VersionConflictError(toAdminTicketDetail(latest, now));
    };

    const current = await repository.findTicket(ticketId);
    if (!current) throw new NotFoundError(TICKET_NOT_FOUND);
    if (current.version !== input.version) throw await conflict();

    const plan = planTicketUpdate(current, input, auth.userId, now);
    if (plan.audit.length > 0) {
      if (!(await repository.updateIfVersion(ticketId, input.version, plan.changes))) throw await conflict();
      await audit(plan.audit.map((event) => ({ ticketId, actorProfileId: auth.userId, ...event })));
    }

    const detail = await repository.findDetail(ticketId);
    if (!detail) throw new NotFoundError(TICKET_NOT_FOUND);
    const actions = plan.audit.map((event) => event.action);
    for (const event of updateEvents(ticketId, detail.ticket.author.author_id, actions))
      events.publish(event);
    res.json({ data: toAdminTicketDetail(detail, now) });
  });

  // operationId: createAdminReply. Reply, first response and status change
  // happen in one database transaction; audit follows.
  router.post("/tickets/:ticketId/messages", async (req, res) => {
    const { ticketId } = TicketIdParamsSchema.parse(req.params);
    const input = AdminReplyRequestSchema.parse(req.body);
    const auth = authOf(req);
    const repository = adminTicketsRepository(dbOf(req));
    const sent = await repository.sendReply(ticketId, {
      body: input.body,
      statusAfter: input.statusAfter,
      draftId: input.draftId ?? null,
    });

    await audit([
      {
        ticketId,
        actorProfileId: auth.userId,
        action: "ticket.reply_sent",
        metadata: {
          messageId: sent.messageId,
          draftId: input.draftId ?? null,
          firstResponse: sent.firstResponse,
        },
      },
      ...(sent.previousStatus !== sent.newStatus
        ? [
            {
              ticketId,
              actorProfileId: auth.userId,
              action: "ticket.status_changed",
              metadata: { from: sent.previousStatus, to: sent.newStatus, via: "reply" },
            },
          ]
        : []),
    ]);

    // The ticket's author gets the event too; without their id only admins do.
    const authorId = await repository
      .findTicket(ticketId)
      .then((ticket) => ticket?.author.author_id ?? null)
      .catch((error: unknown) => {
        logger.warn({ err: error, ticketId }, "reply event sent to admins only: ticket author not loaded");
        return null;
      });
    events.publish({
      type: "ticket.updated",
      ticketId,
      authorId,
      changes: sent.previousStatus !== sent.newStatus ? ["messages", "status"] : ["messages"],
    });

    const message: ThreadMessageDto = {
      id: sent.messageId,
      senderRole: "admin",
      senderName: auth.displayName,
      body: input.body,
      createdAt: sent.createdAt,
    };
    res.status(201).json({ data: message });
  });

  // operationId: listInternalNotes
  router.get("/tickets/:ticketId/notes", async (req, res) => {
    const { ticketId } = TicketIdParamsSchema.parse(req.params);
    const notes = await adminTicketsRepository(dbOf(req)).listNotes(ticketId);
    if (!notes) throw new NotFoundError(TICKET_NOT_FOUND);
    res.json({ data: notes.map(toInternalNote) });
  });

  // operationId: createInternalNote. The audit event never carries the note text.
  router.post("/tickets/:ticketId/notes", async (req, res) => {
    const { ticketId } = TicketIdParamsSchema.parse(req.params);
    const { body } = MessageBodyRequestSchema.parse(req.body);
    const auth = authOf(req);
    const note = await adminTicketsRepository(dbOf(req)).addNote(ticketId, auth.userId, body);
    await audit({
      ticketId,
      actorProfileId: auth.userId,
      action: "ticket.note_added",
      metadata: { noteId: note.id },
    });
    events.publish({ type: "ticket.internal_updated", ticketId, authorId: null, changes: ["notes"] });
    res.status(201).json({ data: toInternalNote(note) });
  });

  // operationId: retryTriage. Re-runs AI triage in the background (202). Admin
  // overrides are never replaced; the per-ticket cap is counted from audit events.
  router.post("/tickets/:ticketId/triage", triageLimit, async (req, res) => {
    const { ticketId } = TicketIdParamsSchema.parse(req.params);
    const auth = authOf(req);
    const repository = adminTicketsRepository(dbOf(req));
    const ticket = await repository.findTicket(ticketId);
    if (!ticket) throw new NotFoundError(TICKET_NOT_FOUND);
    if (ticket.ai_status === "pending") {
      res.status(202).json({ data: TRIAGE_ACCEPTED }); // already queued or running
      return;
    }

    const now = clock();
    const today = businessDate(now);
    const used = await repository.countAuditEvents(
      ticketId,
      "ticket.triage_requested",
      businessDayStart(today).toISOString(),
    );
    if (used >= MANUAL_TRIAGE_PER_DAY) {
      const resetsAt = businessDayStart(today).getTime() + DAY_MS;
      throw new RateLimitedError(
        Math.max(1, Math.ceil((resetsAt - now.getTime()) / 1000)),
        `AI triage was already retried ${MANUAL_TRIAGE_PER_DAY} times today for this ticket. Please triage it manually.`,
      );
    }
    const availability = await triage.availability();
    if (!availability.ok) throw new AiUnavailableError(availability.reason);

    if (!(await triage.retry(ticketId))) throw new NotFoundError(TICKET_NOT_FOUND);
    await audit({
      ticketId,
      actorProfileId: auth.userId,
      action: "ticket.triage_requested",
      metadata: { previousAiStatus: ticket.ai_status },
    });
    events.publish({ type: "ticket.internal_updated", ticketId, authorId: null, changes: ["ai"] });
    res.status(202).json({ data: TRIAGE_ACCEPTED });
  });

  // operationId: getOrCreateDraft. 200 = a ready draft for the same context was
  // reused (no AI call); 201 = generated. Regenerations: 10 a minute per admin,
  // 5 a day per ticket. 503 AI_UNAVAILABLE → the admin writes the reply manually.
  const regenerateLimit = perUserLimit({
    windowMs: 60_000,
    limit: 10,
    message: "Too many draft regenerations. Please wait a minute.",
    skip: (req) => (req.body as { regenerate?: unknown } | undefined)?.regenerate !== true,
  });
  router.post("/tickets/:ticketId/draft", regenerateLimit, async (req, res) => {
    const { ticketId } = TicketIdParamsSchema.parse(req.params);
    const { regenerate } = DraftRequestSchema.parse(req.body ?? {});
    const { draft, created } = await drafts.getOrCreate({
      store: adminTicketsRepository(dbOf(req)),
      ticketId,
      adminId: authOf(req).userId,
      regenerate,
    });
    res.status(created ? 201 : 200).json({ data: toAiDraft(draft) });
  });

  return router;
}
