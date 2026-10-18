// Builds the Express app without listening, so tests can drive it with Supertest.
// Middleware order follows .back/API_IMPLEMENTATION.md section 2; rate limits
// and request validation are added with the routes that need them.
import express from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import type { AuthVerifier } from "./auth/types.js";
import type { Env } from "./config/env.js";
import { systemClock, type Clock } from "./lib/clock.js";
import { authenticate } from "./middleware/authenticate.js";
import { corsAllowlist } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { httpLogger } from "./middleware/http-logger.js";
import { notFound } from "./middleware/not-found.js";
import { requestId } from "./middleware/request-id.js";
import { requireRole } from "./middleware/require-role.js";
import { adminRouter } from "./modules/admin/router.js";
import { createAuthorRouter } from "./modules/author/router.js";
import { healthRouter } from "./modules/health/router.js";
import { meRouter } from "./modules/me/router.js";
import { docsRouter } from "./openapi/docs.js";

export interface AppDeps {
  env: Env;
  logger: Logger;
  /** Production: createSupabaseVerifier(); tests inject a fake. */
  verifier: AuthVerifier;
  /** Defaults to the system clock; tests pin it. */
  clock?: Clock;
}

export function createApp({ env, logger, verifier, clock = systemClock }: AppDeps) {
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
  app.use("/api/v1", authenticate(verifier));
  app.use("/api/v1/me", meRouter);
  app.use("/api/v1/author", requireRole("author"), createAuthorRouter({ clock }));
  app.use("/api/v1/admin", requireRole("admin"), adminRouter);

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
