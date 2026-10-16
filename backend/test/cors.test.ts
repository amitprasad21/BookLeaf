import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./helpers.js";

const app = () =>
  buildTestApp({ CORS_ALLOWED_ORIGINS: "https://author.example.com,https://admin.example.com" });

describe("CORS allowlist", () => {
  it("allows a listed origin, including preflight for PATCH with auth headers", async () => {
    const res = await request(app())
      .options("/api/v1/health")
      .set("Origin", "https://admin.example.com")
      .set("Access-Control-Request-Method", "PATCH")
      .set("Access-Control-Request-Headers", "authorization,content-type");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://admin.example.com");
    expect(res.headers["access-control-allow-methods"]).toContain("PATCH");
    expect(res.headers["access-control-allow-headers"]).toContain("Authorization");
  });

  it("exposes the request id header to the browser", async () => {
    const res = await request(app()).get("/api/v1/health").set("Origin", "https://author.example.com");
    expect(res.headers["access-control-expose-headers"]).toContain("X-Request-Id");
  });

  it("gives an unlisted origin no CORS headers", async () => {
    const res = await request(app()).get("/api/v1/health").set("Origin", "https://evil.example.com");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("never answers with a wildcard origin", async () => {
    const res = await request(app()).get("/api/v1/health");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
