import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";

describe("GET /api/v1/health", () => {
  it("returns ok with the API version in the success envelope", async () => {
    const res = await request(createApp()).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: "ok", version: "0.1.0" } });
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("unknown routes", () => {
  it("return the 404 error envelope with a request id", async () => {
    const res = await request(createApp()).get("/api/v1/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.requestId).toMatch(/^req_/);
  });
});

describe("loadEnv", () => {
  it("applies defaults", () => {
    expect(loadEnv({})).toEqual({ NODE_ENV: "development", PORT: 4000 });
  });

  it("names the invalid variable without echoing its value", () => {
    expect(() => loadEnv({ PORT: "not-a-port-secret-value" })).toThrow(/^Invalid environment configuration: PORT$/);
  });
});
