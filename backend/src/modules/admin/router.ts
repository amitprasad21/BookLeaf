import { AdminTicketQueueQuerySchema } from "@bookleaf/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Router } from "express";
import type { Clock } from "../../lib/clock.js";
import { authOf, dbOf } from "../../middleware/authenticate.js";
import type { AdminTicketsRepository } from "../tickets/admin-repository.js";
import { toAdminQueueItem } from "../tickets/serializers/admin.js";

export interface AdminRouterDeps {
  clock: Clock;
  adminTicketsRepository: (db: SupabaseClient) => AdminTicketsRepository;
}

/** /api/v1/admin/* (role admin, enforced in app.ts). */
export function createAdminRouter({ clock, adminTicketsRepository }: AdminRouterDeps) {
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

  // operationId: getAdminTicketSummary. Registered before any /tickets/:ticketId route.
  router.get("/tickets/summary", async (req, res) => {
    res.json({ data: await adminTicketsRepository(dbOf(req)).summary(clock()) });
  });

  return router;
}
