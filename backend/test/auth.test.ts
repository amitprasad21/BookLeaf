import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  ADMIN_CONTEXT,
  AUTHOR_CONTEXT,
  TEST_TOKENS,
  bearer,
  buildTestApp,
  captureLogger,
  settle,
} from "./helpers.js";

describe("authentication on /api/v1", () => {
  it("returns 401 without a token, including for unknown paths (route existence isn't revealed)", async () => {
    for (const path of ["/api/v1/me", "/api/v1/admin/tickets", "/api/v1/does-not-exist"]) {
      const res = await request(buildTestApp()).get(path);
      expect(res.status, path).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }
  });

  it("rejects malformed Authorization headers before calling the verifier", async () => {
    for (const header of [
      "Basic dXNlcjpwYXNz",
      "Bearer",
      "Bearer not-a-jwt",
      `Bearer a.b.c${"x".repeat(4100)}`,
    ]) {
      const res = await request(buildTestApp()).get("/api/v1/me").set("Authorization", header);
      expect(res.status, header.slice(0, 20)).toBe(401);
    }
  });

  it("returns 401 with a sign-in prompt for an invalid or expired token", async () => {
    const res = await request(buildTestApp())
      .get("/api/v1/me")
      .set("Authorization", bearer("forged.or.expired"));
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/sign in again/i);
  });

  it("returns 403 for a valid user without a BookLeaf profile", async () => {
    const res = await request(buildTestApp())
      .get("/api/v1/me")
      .set("Authorization", bearer(TEST_TOKENS.noProfile));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("hides verifier failures behind a generic 500", async () => {
    const { logger, lines } = captureLogger();
    const res = await request(buildTestApp({}, logger))
      .get("/api/v1/me")
      .set("Authorization", bearer(TEST_TOKENS.verifierDown));
    await settle();

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
    expect(lines().some((line) => line.msg === "Unhandled error")).toBe(true);
  });

  it("keeps health and API docs public", async () => {
    const app = buildTestApp();
    expect((await request(app).get("/api/v1/health")).status).toBe(200);
    expect((await request(app).get("/api/openapi.yaml")).status).toBe(200);
  });

  it("ignores identity claims in the query or body", async () => {
    const res = await request(buildTestApp())
      .get("/api/v1/me?role=admin&userId=someone-else")
      .set("Authorization", bearer(TEST_TOKENS.author));
    expect(res.body.data.role).toBe("author");
    expect(res.body.data.userId).toBe(AUTHOR_CONTEXT.userId);
  });
});

describe("GET /api/v1/me", () => {
  it("returns the author's profile with their author summary", async () => {
    const res = await request(buildTestApp())
      .get("/api/v1/me")
      .set("Authorization", bearer(TEST_TOKENS.author));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        userId: AUTHOR_CONTEXT.userId,
        role: "author",
        displayName: "Priya Sharma",
        author: { authorId: "AUTH001", name: "Priya Sharma", city: "Mumbai", joinedDate: "2023-03-15" },
      },
    });
  });

  it("returns an admin profile with author null", async () => {
    const res = await request(buildTestApp())
      .get("/api/v1/me")
      .set("Authorization", bearer(TEST_TOKENS.admin));
    expect(res.body.data).toEqual({
      userId: ADMIN_CONTEXT.userId,
      role: "admin",
      displayName: "Ops Admin",
      author: null,
    });
  });
});

describe("role guards", () => {
  it("forbids authors from /admin/* and admins from /author/*", async () => {
    const app = buildTestApp();
    const authorOnAdmin = await request(app)
      .get("/api/v1/admin/tickets")
      .set("Authorization", bearer(TEST_TOKENS.author));
    expect(authorOnAdmin.status).toBe(403);
    expect(authorOnAdmin.body.error.code).toBe("FORBIDDEN");

    const adminOnAuthor = await request(app)
      .get("/api/v1/author/books")
      .set("Authorization", bearer(TEST_TOKENS.admin));
    expect(adminOnAuthor.status).toBe(403);
  });

  it("lets the right role through to the namespace (404 until its routes exist)", async () => {
    const app = buildTestApp();
    expect(
      (await request(app).get("/api/v1/author/books").set("Authorization", bearer(TEST_TOKENS.author)))
        .status,
    ).toBe(404);
    expect(
      (await request(app).get("/api/v1/admin/tickets").set("Authorization", bearer(TEST_TOKENS.admin)))
        .status,
    ).toBe(404);
  });
});
