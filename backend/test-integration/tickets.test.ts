// Live author tickets (npm run test:live): the real app with the real verifier,
// RLS-scoped repository and system writer. Creates tickets as Priya, checks
// what the database stored, and deletes them afterwards with the secret key.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SeedDataSchema } from "../scripts/seed-data.js";
import { createApp } from "../src/app.js";
import { createSupabaseVerifier } from "../src/auth/supabase-verifier.js";
import { loadEnv } from "../src/config/env.js";
import { createSystemWriter } from "../src/db/system-writer.js";
import { createLogger } from "../src/lib/logger.js";

const env = {
  url: process.env.SUPABASE_URL ?? "",
  publishable: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  secret: process.env.SUPABASE_SECRET_KEY ?? "",
  authorPassword: process.env.SEED_AUTHOR_PASSWORD ?? "",
};
const configured = Object.values(env).every((value) => value !== "" && !value.startsWith("replace-with"));

const data = SeedDataSchema.parse(
  JSON.parse(readFileSync(new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url), "utf8")),
);
const authorEmail = (id: string) => data.authors.find((author) => author.author_id === id)!.email;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

async function accessToken(email: string): Promise<string> {
  const client = createClient(env.url, env.publishable, noSession);
  const { data: session, error } = await client.auth.signInWithPassword({
    email,
    password: env.authorPassword,
  });
  if (error || !session.session) throw new Error(`Sign-in failed for a seeded author (${error?.code}).`);
  return session.session.access_token;
}

describe.runIf(configured)("author tickets against live Supabase", () => {
  const app = createApp({
    env: loadEnv({ NODE_ENV: "test", SUPABASE_URL: env.url, SUPABASE_PUBLISHABLE_KEY: env.publishable }),
    logger: createLogger({ LOG_LEVEL: "silent" }),
    verifier: createSupabaseVerifier({ url: env.url, publishableKey: env.publishable }),
    systemWriter: createSystemWriter({ url: env.url, secretKey: env.secret }),
  });
  let system: SupabaseClient;
  const tokens: Record<string, string> = {};
  const created: string[] = [];

  const as = (id: string) => `Bearer ${tokens[id]}`;
  const createTicket = (body: object) =>
    request(app).post("/api/v1/author/tickets").set("Authorization", as("AUTH001")).send(body);

  beforeAll(async () => {
    system = createClient(env.url, env.secret, noSession);
    for (const id of ["AUTH001", "AUTH002"]) tokens[id] = await accessToken(authorEmail(id));
  });

  afterAll(async () => {
    if (created.length === 0) return;
    // Thread messages and audit events go with the ticket (on delete cascade).
    const { error } = await system.from("tickets").delete().in("id", created);
    if (error) throw new Error(`cleanup failed (${error.code}); delete the "Live test" tickets by hand`);
  });

  it("creates a ticket save-first: stored as open with AI pending, and audited", async () => {
    const res = await createTicket({
      bookId: "BK001",
      subject: "Live test: royalty question",
      description: "Created by the automated live ticket suite; deleted afterwards.",
      attachmentName: "statement.pdf",
    });
    expect(res.status).toBe(201);
    created.push(res.body.data.id);
    expect(res.body.data).toMatchObject({
      reference: expect.stringMatching(/^BL-\d+$/),
      status: "open",
      book: { bookId: "BK001", title: "Whispers of the Ganges" },
      attachmentName: "statement.pdf",
      hasAdminReply: false,
      messages: [],
    });

    const stored = await system
      .from("tickets")
      .select("author_id, ai_status, priority, category")
      .eq("id", res.body.data.id)
      .single();
    expect(stored.data).toEqual({
      author_id: "AUTH001",
      ai_status: "pending",
      priority: null,
      category: null,
    });

    const audit = await system
      .from("audit_events")
      .select("action, actor_profile_id, metadata")
      .eq("ticket_id", res.body.data.id);
    expect(audit.data).toEqual([
      { action: "ticket.created", actor_profile_id: expect.any(String), metadata: { bookId: "BK001" } },
    ]);
  });

  it("creates a General / Account Level ticket", async () => {
    const res = await createTicket({
      bookId: null,
      subject: "Live test: account question",
      description: "Created by the automated live ticket suite; deleted afterwards.",
    });
    expect(res.status).toBe(201);
    created.push(res.body.data.id);
    expect(res.body.data.book).toBeNull();
  });

  it("refuses another author's book with a field error and stores nothing", async () => {
    const before = await system.from("tickets").select("id", { count: "exact", head: true });
    const res = await createTicket({
      bookId: "BK003",
      subject: "Live test: not my book",
      description: "This must be refused because BK003 belongs to another author.",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe("bookId");
    const after = await system.from("tickets").select("id", { count: "exact", head: true });
    expect(after.count).toBe(before.count);
  });

  it("lists the author's own tickets newest first and shows the detail", async () => {
    const list = await request(app).get("/api/v1/author/tickets").set("Authorization", as("AUTH001"));
    expect(list.status).toBe(200);
    const ids = list.body.data.map((ticket: { id: string }) => ticket.id);
    expect(ids.slice(0, 2)).toEqual([created[1], created[0]]);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(2);

    const detail = await request(app)
      .get(`/api/v1/author/tickets/${created[0]}`)
      .set("Authorization", as("AUTH001"));
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ id: created[0], messages: [] });
  });

  it("hides one author's tickets from another (404 on detail, absent from list)", async () => {
    const detail = await request(app)
      .get(`/api/v1/author/tickets/${created[0]}`)
      .set("Authorization", as("AUTH002"));
    expect(detail.status).toBe(404);

    const list = await request(app).get("/api/v1/author/tickets").set("Authorization", as("AUTH002"));
    const ids = list.body.data.map((ticket: { id: string }) => ticket.id);
    expect(ids).not.toContain(created[0]);
    expect(ids).not.toContain(created[1]);
  });
});

describe.skipIf(configured)("author tickets against live Supabase (skipped)", () => {
  it("needs SUPABASE_* keys (including the secret key) and SEED_AUTHOR_PASSWORD in backend/.env", () => {
    expect(configured).toBe(false);
  });
});
