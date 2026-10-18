import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp, captureLogger, settle } from "./helpers.js";

describe("request logging", () => {
  it("logs one minimal line per request: id, method, url, status; no headers or client data", async () => {
    const { logger, lines } = captureLogger();
    const res = await request(buildTestApp({ logger }))
      .get("/api/v1/unknown")
      .set("Authorization", "Bearer supersecret.jwtshaped.token")
      .set("Cookie", "session=also-secret");
    await settle();

    const raw = JSON.stringify(lines());
    expect(raw).not.toContain("supersecret.jwtshaped.token");
    expect(raw).not.toContain("also-secret");

    const entry = lines().find(
      (line) => (line.req as { id?: string } | undefined)?.id === res.headers["x-request-id"],
    );
    expect(entry?.level).toBe(40); // warn for 4xx (401: unknown token)
    expect(entry?.req).toEqual({ id: res.headers["x-request-id"], method: "GET", url: "/api/v1/unknown" });
    expect(entry?.res).toEqual({ statusCode: 401 });
  });

  it("does not log health checks", async () => {
    const { logger, lines } = captureLogger();
    await request(buildTestApp({ logger })).get("/api/v1/health");
    await settle();

    expect(lines()).toHaveLength(0);
  });
});

describe("logger redaction", () => {
  it("masks credential-like fields in any structured log call", () => {
    const { logger, lines } = captureLogger();
    logger.info(
      { provider: { apiKey: "sk-test-123" }, user: { password: "hunter2" }, session: { token: "t0k" } },
      "config check",
    );

    const raw = JSON.stringify(lines());
    expect(raw).not.toMatch(/sk-test-123|hunter2|t0k/);
    expect(lines()[0]).toMatchObject({
      provider: { apiKey: "[REDACTED]" },
      user: { password: "[REDACTED]" },
      session: { token: "[REDACTED]" },
    });
  });
});
