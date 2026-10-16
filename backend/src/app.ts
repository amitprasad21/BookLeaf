// Builds the Express app without listening, so tests can drive it with Supertest.
// Scaffold only: the full middleware chain (request id, logging, CORS, auth,
// rate limits, validation, error handler) arrives in task API-1.
import { randomUUID } from "node:crypto";
import express from "express";
import helmet from "helmet";
import { APP_VERSION } from "./version.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/v1/health", (_req, res) => {
    res.json({ data: { status: "ok", version: APP_VERSION } });
  });

  app.use((_req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Resource not found.", requestId: `req_${randomUUID()}` },
    });
  });

  return app;
}
