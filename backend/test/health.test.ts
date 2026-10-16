import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./helpers.js";

describe("GET /api/v1/health", () => {
  it("returns ok with the API version in the success envelope", async () => {
    const res = await request(buildTestApp()).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: "ok", version: "0.1.0" } });
  });

  it("sets security headers and hides the framework", async () => {
    const res = await request(buildTestApp()).get("/api/v1/health");

    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toContain("max-age=");
  });
});
