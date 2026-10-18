// Live authentication tests (npm run test:live): the real Supabase verifier
// inside the real app, with access tokens from real sign-ins of seeded users.
// Reads only; nothing is written.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN_ACCOUNTS, SeedDataSchema } from "../scripts/seed-data.js";
import { createApp } from "../src/app.js";
import { createSupabaseVerifier } from "../src/auth/supabase-verifier.js";
import { loadEnv } from "../src/config/env.js";
import { createLogger } from "../src/lib/logger.js";
import { recordingSystemWriter } from "../test/fakes.js";

const env = {
  url: process.env.SUPABASE_URL ?? "",
  publishable: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  authorPassword: process.env.SEED_AUTHOR_PASSWORD ?? "",
  adminPassword: process.env.SEED_ADMIN_PASSWORD ?? "",
};
const configured = Object.values(env).every((value) => value !== "" && !value.startsWith("replace-with"));

const data = SeedDataSchema.parse(
  JSON.parse(readFileSync(new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url), "utf8")),
);
const priya = data.authors.find((author) => author.author_id === "AUTH001")!;
const admin = ADMIN_ACCOUNTS[0]!;

async function accessToken(email: string, password: string): Promise<string> {
  const client = createClient(env.url, env.publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !session.session)
    throw new Error(`Sign-in failed for a seeded account (${error?.code}). Run npm run seed:apply.`);
  return session.session.access_token;
}

describe.runIf(configured)("authentication against live Supabase", () => {
  const app = createApp({
    env: loadEnv({ NODE_ENV: "test", SUPABASE_URL: env.url, SUPABASE_PUBLISHABLE_KEY: env.publishable }),
    logger: createLogger({ LOG_LEVEL: "silent" }),
    verifier: createSupabaseVerifier({ url: env.url, publishableKey: env.publishable }),
    systemWriter: recordingSystemWriter().writer, // read-only suite: nothing is audited
  });
  let authorToken = "";
  let adminToken = "";

  beforeAll(async () => {
    [authorToken, adminToken] = await Promise.all([
      accessToken(priya.email, env.authorPassword),
      accessToken(admin.email, env.adminPassword),
    ]);
  });

  it("GET /me returns the seeded author's profile and author summary", async () => {
    const res = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      role: "author",
      displayName: priya.name,
      author: { authorId: "AUTH001", name: priya.name, city: priya.city, joinedDate: priya.joined_date },
    });
    expect(res.body.data.userId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("GET /me returns the admin profile with no author record", async () => {
    const res = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ role: "admin", displayName: admin.displayName, author: null });
  });

  it("role guards hold with real tokens", async () => {
    const authorOnAdmin = await request(app)
      .get("/api/v1/admin/tickets")
      .set("Authorization", `Bearer ${authorToken}`);
    expect(authorOnAdmin.status).toBe(403);
    const adminOnAuthor = await request(app)
      .get("/api/v1/author/books")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminOnAuthor.status).toBe(403);
  });

  it("rejects a token whose signature was tampered with", async () => {
    const [header, payload, signature] = authorToken.split(".");
    const flipped = signature!.slice(0, -2) + (signature!.endsWith("AA") ? "BB" : "AA");
    const res = await request(app)
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${header}.${payload}.${flipped}`);
    expect(res.status).toBe(401);
  });

  it("rejects a token whose payload was edited to claim another user", async () => {
    const [header, payload, signature] = adminToken.split(".");
    const claims = JSON.parse(Buffer.from(payload!, "base64url").toString()) as Record<string, unknown>;
    const forged = Buffer.from(
      JSON.stringify({ ...claims, sub: "00000000-0000-4000-8000-000000000000" }),
    ).toString("base64url");
    const res = await request(app)
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${header}.${forged}.${signature}`);
    expect(res.status).toBe(401);
  });

  it("rejects the publishable key used as a bearer token", async () => {
    const res = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${env.publishable}`);
    expect(res.status).toBe(401);
  });
});

describe.skipIf(configured)("authentication against live Supabase (skipped)", () => {
  it("needs SUPABASE_* and SEED_* values in backend/.env", () => {
    expect(configured).toBe(false);
  });
});
