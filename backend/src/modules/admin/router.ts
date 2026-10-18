import {
  AdminTicketQueueQuerySchema,
  TicketIdParamsSchema,
  UpdateTicketRequestSchema,
} from "@bookleaf/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Router } from "express";
import type { Clock } from "../../lib/clock.js";
import { NotFoundError, VersionConflictError } from "../../lib/errors.js";
import { authOf, dbOf } from "../../middleware/authenticate.js";
import type { AuditRecorder } from "../audit/service.js";
import type { AdminTicketsRepository } from "../tickets/admin-repository.js";
import { planTicketUpdate } from "../tickets/admin-service.js";
import { toAdminQueueItem, toAdminTicketDetail } from "../tickets/serializers/admin.js";

export interface AdminRouterDeps {
  clock: Clock;
  audit: AuditRecorder;
  adminTicketsRepository: (db: SupabaseClient) => AdminTicketsRepository;
}

const TICKET_NOT_FOUND = "We couldn't find that ticket.";

/** /api/v1/admin/* (role admin, enforced in app.ts). */
export function createAdminRouter({ clock, audit, adminTicketsRepository }: AdminRouterDeps) {
  const router = Router();

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
    res.json({ data: await adminTicketsRepository(dbOf(req)).summary(clock()) });
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
    res.json({ data: toAdminTicketDetail(detail, now) });
  });

  return router;
}
