// Builds the Express app without listening, so tests can drive it with Supertest.
// Middleware order follows .back/API_IMPLEMENTATION.md section 2; auth, role
// guards, rate limits and validation are added with the routes that need them.
import express from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import type { Env } from "./config/env.js";
import { corsAllowlist } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { httpLogger } from "./middleware/http-logger.js";
import { notFound } from "./middleware/not-found.js";
import { requestId } from "./middleware/request-id.js";
import { healthRouter } from "./modules/health/router.js";
import { docsRouter } from "./openapi/docs.js";

export interface AppDeps {
  env: Env;
  logger: Logger;
}

export function createApp({ env, logger }: AppDeps) {
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

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
