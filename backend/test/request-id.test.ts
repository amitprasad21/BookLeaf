import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./helpers.js";

describe("request id", () => {
  it("is generated when the caller sends none", async () => {
    const res = await request(buildTestApp()).get("/api/v1/health");
    expect(res.headers["x-request-id"]).toMatch(/^req_[0-9a-f-]{36}$/);
  });

  it("echoes a safe caller-supplied id", async () => {
    const res = await request(buildTestApp()).get("/api/v1/health").set("X-Request-Id", "client-abc_123");
    expect(res.headers["x-request-id"]).toBe("client-abc_123");
  });

  it("replaces an unsafe caller-supplied id", async () => {
    const res = await request(buildTestApp())
      .get("/api/v1/health")
      .set("X-Request-Id", "bad id with spaces; injected");
    expect(res.headers["x-request-id"]).toMatch(/^req_/);
  });
});
