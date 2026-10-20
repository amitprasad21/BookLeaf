// Builds the Express app without listening, so tests can drive it with Supertest.
// Middleware order follows .back/API_IMPLEMENTATION.md section 2; per-route
// rate limits and request validation live with the routes that need them.
import type { SupabaseClient } from "@supabase/supabase-js";
import express from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import { disabledTriage, type TriageControl } from "./ai/control.js";
import { disabledDrafts, type DraftService } from "./ai/drafts.js";
import type { AuthVerifier } from "./auth/types.js";
import type { Env } from "./config/env.js";
import type { SystemWriter } from "./db/system-writer.js";
import { createEventHub, type EventHub } from "./events/hub.js";
import { systemClock, type Clock } from "./lib/clock.js";
import { authenticate } from "./middleware/authenticate.js";
import { corsAllowlist } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { httpLogger } from "./middleware/http-logger.js";
import { notFound } from "./middleware/not-found.js";
import { requestId } from "./middleware/request-id.js";
import { requireRole } from "./middleware/require-role.js";
import { createAdminRouter } from "./modules/admin/router.js";
import { createAuditRecorder } from "./modules/audit/service.js";
import { createAuthorRouter } from "./modules/author/router.js";
import { createEventsRouter, type EventsRouterOptions } from "./modules/events/router.js";
import { healthRouter } from "./modules/health/router.js";
import { meRouter } from "./modules/me/router.js";
import {
  createAdminTicketsRepository,
  type AdminTicketsRepository,
} from "./modules/tickets/admin-repository.js";
import { createTicketsRepository, type TicketsRepository } from "./modules/tickets/repository.js";
import { docsRouter } from "./openapi/docs.js";

export interface AppDeps {
  env: Env;
  logger: Logger;
  /** Production: createSupabaseVerifier(); tests inject a fake. */
  verifier: AuthVerifier;
  /** RLS-bypassing writer for audit (and later AI) records; tests inject a recorder. */
  systemWriter: SystemWriter;
  /** Defaults to the system clock; tests pin it. */
  clock?: Clock;
  /** Defaults to the Supabase implementation over the caller's RLS client; tests inject a fake. */
  ticketsRepository?: (db: SupabaseClient) => TicketsRepository;
  /** Same, for the admin queue. */
  adminTicketsRepository?: (db: SupabaseClient) => AdminTicketsRepository;
  /** AI triage (queue + retries). Defaults to disabled; server.ts wires the real one. */
  triage?: TriageControl;
  /** AI reply drafts. Defaults to disabled (503 not_configured); server.ts wires the real one. */
  drafts?: DraftService;
  /** Real-time event hub. Defaults to a new in-process hub; server.ts shares one with the triage queue. */
  events?: EventHub;
  /** Stream timings (tests shorten them). */
  eventStream?: Omit<EventsRouterOptions, "hub">;
}

export function createApp({
  env,
  logger,
  verifier,
  systemWriter,
  clock = systemClock,
  ticketsRepository = createTicketsRepository,
  adminTicketsRepository = createAdminTicketsRepository,
  triage = disabledTriage,
  drafts = disabledDrafts,
  events = createEventHub({ clock, logger }),
  eventStream = {},
}: AppDeps) {
  const app = express();
  app.disable("x-powered-by");

  app.use(requestId);
  app.use(httpLogger(logger));
  app.use(helmet());
  app.use(corsAllowlist(env.CORS_ALLOWED_ORIGINS));
  app.use(express.json({ limit: "32kb" }));

  // Public routes (no auth by design: no data).
  app.use("/api/v1/health", healthRouter);
  app.use("/api", docsRouter());

  // Everything else under /api/v1 needs a verified session, so even unknown
  // paths answer 401 to anonymous callers and route existence isn't revealed.
  const audit = createAuditRecorder(systemWriter, logger);
  app.use("/api/v1", authenticate(verifier));
  app.use("/api/v1/me", meRouter);
  app.use("/api/v1/events", createEventsRouter({ hub: events, ...eventStream }));
  app.use(
    "/api/v1/author",
    requireRole("author"),
    createAuthorRouter({ clock, audit, ticketsRepository, triage, events }),
  );
  app.use(
    "/api/v1/admin",
    requireRole("admin"),
    createAdminRouter({ clock, audit, adminTicketsRepository, triage, drafts, events, logger }),
  );

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
