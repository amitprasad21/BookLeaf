// SEC-1 (TASKS.md; .agent/SECURITY_REVIEW_CHECKLIST.md R-01, R-10 and controls
// 2, 4, 7, 10, 14, 17). The route list comes from openapi.yaml, so a new
// endpoint is covered automatically.
import { readFileSync } from "node:fs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import type { TicketsRepository } from "../src/modules/tickets/repository.js";
import { TEST_TOKENS, bearer, buildTestApp, captureLogger } from "./helpers.js";

const spec = parse(readFileSync(new URL("../../openapi.yaml", import.meta.url), "utf8")) as {
  paths: Record<string, Record<string, unknown>>;
};
const METHODS = ["get", "post", "patch", "put", "delete"] as const;
const PUBLIC = new Set(["/health"]);
const SOME_ID = "6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c0003";

/** Every documented operation, with path parameters filled in. */
const operations = Object.entries(spec.paths).flatMap(([path, item]) =>
  METHODS.filter((method) => method in item).map((method) => ({
    method,
    path,
    url: `/api/v1${path.replace(/\{[^}]+\}/g, SOME_ID)}`,
  })),
);

const call = (app: ReturnType<typeof buildTestApp>, op: (typeof operations)[number], token?: string) => {
  const req = request(app)[op.method](op.url);
  if (token) req.set("Authorization", bearer(token));
  return op.method === "get" ? req : req.send({});
};

describe("route inventory (R-01, control 2)", () => {
  it("covers every documented operation", () => {
    expect(operations.length).toBeGreaterThanOrEqual(17);
  });

  it("refuses anonymous callers on every route except health", async () => {
    const app = buildTestApp();
    for (const op of operations.filter((candidate) => !PUBLIC.has(candidate.path))) {
      const res = await call(app, op);
      expect(res.status, `${op.method.toUpperCase()} ${op.path}`).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }
  });

  it("keeps admin routes from authors and author routes from admins (control 14)", async () => {
    const app = buildTestApp();
    for (const op of operations.filter((candidate) => candidate.path.startsWith("/admin/"))) {
      expect((await call(app, op, TEST_TOKENS.author)).status, op.path).toBe(403);
    }
    for (const op of operations.filter((candidate) => candidate.path.startsWith("/author/"))) {
      expect((await call(app, op, TEST_TOKENS.admin)).status, op.path).toBe(403);
    }
  });
});

describe("production mode (R-10, controls 7, 10, 17)", () => {
  const productionEnv = {
    NODE_ENV: "production",
    CORS_ALLOWED_ORIGINS: "https://author.example.app,https://admin.example.app",
    SUPABASE_URL: "https://example-ref.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    SUPABASE_SECRET_KEY: "sb_secret_test",
    AI_PRIMARY_PROVIDER: "gemini",
    GEMINI_API_KEY: "test-key",
  };
  const failing = (): TicketsRepository =>
    ({
      async listForAuthor() {
        throw new Error("relation tickets violates constraint (internal detail: password=hunter2)");
      },
    }) as unknown as TicketsRepository;

  it("answers an unexpected error with a generic 500: no stack, no internal message", async () => {
    const app = buildTestApp({
      logger: captureLogger().logger,
      env: productionEnv,
      ticketsRepository: failing,
    });
    const res = await request(app)
      .get("/api/v1/author/tickets")
      .set("Authorization", bearer(TEST_TOKENS.author));
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/hunter2|relation|constraint|stack|at .*\.ts/);
  });

  it("allows only the listed origins (preflight)", async () => {
    const app = buildTestApp({ logger: captureLogger().logger, env: productionEnv });
    const preflight = (origin: string) =>
      request(app)
        .options("/api/v1/me")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "GET")
        .set("Access-Control-Request-Headers", "authorization");

    const allowed = await preflight("https://admin.example.app");
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://admin.example.app");
    const refused = await preflight("https://evil.example");
    expect(refused.headers["access-control-allow-origin"]).toBeUndefined();
    const dev = await preflight("http://localhost:3000");
    expect(dev.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("sends HSTS and the other helmet headers", async () => {
    const res = await request(buildTestApp({ logger: captureLogger().logger, env: productionEnv })).get(
      "/api/v1/health",
    );
    expect(res.headers["strict-transport-security"]).toMatch(/max-age=\d+/);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("request limits (control 4)", () => {
  it("caps successful and rejected requests together at 300 per user across all routes", async () => {
    const app = buildTestApp();
    for (let i = 0; i < 300; i += 1) {
      const allowed = i % 2 === 0;
      const res = await request(app)
        .get(allowed ? "/api/v1/me" : "/api/v1/admin/tickets")
        .set("Authorization", bearer(TEST_TOKENS.author));
      expect(res.status).toBe(allowed ? 200 : 403);
    }
    const over = await request(app).get("/api/v1/me").set("Authorization", bearer(TEST_TOKENS.author));
    expect(over.status).toBe(429);
    expect(over.body.error.code).toBe("RATE_LIMITED");
    expect(Number(over.headers["retry-after"])).toBeGreaterThan(0);
    // Another user is unaffected.
    expect(
      (await request(app).get("/api/v1/me").set("Authorization", bearer(TEST_TOKENS.admin))).status,
    ).toBe(200);
  }, 15_000); // 300 real local HTTP requests; allow for Windows worker contention.

  it("slows down an IP that keeps sending bad tokens; only 401 answers count", async () => {
    const app = buildTestApp({ env: { TRUST_PROXY_HOPS: "1" } });
    const from = (ip: string, token: string) =>
      request(app).get("/api/v1/me").set("X-Forwarded-For", ip).set("Authorization", bearer(token));

    // Signed-in traffic from the same IP doesn't use up the allowance.
    for (let i = 0; i < 60; i += 1) expect((await from("203.0.113.9", TEST_TOKENS.author)).status).toBe(200);
    for (let i = 0; i < 50; i += 1) expect((await from("203.0.113.9", "not.a.token")).status).toBe(401);
    const over = await from("203.0.113.9", "not.a.token");
    expect(over.status).toBe(429);
    expect(over.body.error.code).toBe("RATE_LIMITED");
    // The limit is per IP: the whole address waits, other clients don't.
    expect((await from("203.0.113.9", TEST_TOKENS.author)).status).toBe(429);
    expect((await from("198.51.100.4", TEST_TOKENS.author)).status).toBe(200);
  });

  it("limits health checks per client IP, read through the proxy when configured", async () => {
    const app = buildTestApp({ env: { TRUST_PROXY_HOPS: "1" } });
    const from = (ip: string) => request(app).get("/api/v1/health").set("X-Forwarded-For", ip);
    for (let i = 0; i < 60; i += 1) expect((await from("203.0.113.7")).status).toBe(200);
    expect((await from("203.0.113.7")).status).toBe(429);
    expect((await from("198.51.100.4")).status).toBe(200); // a different client behind the same proxy
  });
});
