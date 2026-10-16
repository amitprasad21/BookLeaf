import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./helpers.js";

describe("API documentation", () => {
  it("serves the repository openapi.yaml unchanged", async () => {
    const res = await request(buildTestApp()).get("/api/openapi.yaml");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/yaml");
    expect(res.text).toMatch(/^openapi: 3\.1\.0/);
    expect(res.text).toContain("operationId: createAuthorTicket");
  });

  it("serves Swagger UI", async () => {
    const res = await request(buildTestApp()).get("/api/docs/");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain("swagger-ui");
  });
});
