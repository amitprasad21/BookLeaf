import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AiUnavailableError,
  InvalidTransitionError,
  NotFoundError,
  RateLimitedError,
} from "../src/lib/errors.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { requestId } from "../src/middleware/request-id.js";
import { buildTestApp, captureLogger, settle } from "./helpers.js";

/** Minimal app exercising the real error handler with routes that throw. */
function throwingApp() {
  const { logger, lines } = captureLogger();
  const app = express()
    .use(requestId)
    .get("/not-found", () => {
      throw new NotFoundError();
    })
    .get("/transition", () => {
      throw new InvalidTransitionError("A closed ticket must be reopened first.");
    })
    .get("/rate-limited", () => {
      throw new RateLimitedError(120);
    })
    .get("/ai-down", () => {
      throw new AiUnavailableError("budget_exhausted");
    })
    .get("/zod", () => {
      z.object({ subject: z.string().min(5) }).parse({ subject: "hi" });
    })
    .get("/boom", async () => {
      throw new Error("db password=hunter2 leaked in message");
    })
    .use(errorHandler(logger));
  return { app, lines };
}

describe("error envelope", () => {
  it("returns 404 NOT_FOUND for unknown routes with the response's request id", async () => {
    const res = await request(buildTestApp()).get("/api/v1/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: "Resource not found.", requestId: res.headers["x-request-id"] },
    });
  });

  it("maps typed errors to their status and code", async () => {
    const { app } = throwingApp();

    const transition = await request(app).get("/transition");
    expect(transition.status).toBe(422);
    expect(transition.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    expect(transition.body.error.message).toBe("A closed ticket must be reopened first.");

    const notFound = await request(app).get("/not-found");
    expect(notFound.status).toBe(404);
  });

  it("sets Retry-After for rate limits", async () => {
    const res = await request(throwingApp().app).get("/rate-limited");

    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBe("120");
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });

  it("reports the AI unavailability reason in details", async () => {
    const res = await request(throwingApp().app).get("/ai-down");

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("AI_UNAVAILABLE");
    expect(res.body.error.details).toEqual([{ issue: "budget_exhausted" }]);
  });

  it("turns zod failures into field-level VALIDATION_FAILED details", async () => {
    const res = await request(throwingApp().app).get("/zod");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.details[0].path).toBe("subject");
  });

  it("hides unexpected errors behind a generic 500 and logs them with the request id", async () => {
    const { app, lines } = throwingApp();
    const res = await request(app).get("/boom");
    await settle();

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.ts/);

    const logged = lines().find((line) => line.msg === "Unhandled error");
    expect(logged?.requestId).toBe(res.headers["x-request-id"]);
  });
});

describe("request body errors", () => {
  it("rejects malformed JSON with 400", async () => {
    const res = await request(buildTestApp())
      .post("/api/v1/health")
      .set("Content-Type", "application/json")
      .send('{"subject": ');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: "VALIDATION_FAILED",
      message: "Request body is not valid JSON.",
    });
  });

  it("rejects bodies over 32 KB with 413", async () => {
    const res = await request(buildTestApp())
      .post("/api/v1/health")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ description: "x".repeat(33 * 1024) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });
});
