// Live admin replies and internal notes (npm run test:live): real sign-ins,
// RLS and the admin_send_reply function (migration 20261018120000). A fixture
// ticket for AUTH006 is inserted with the secret key and deleted afterwards.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_ACCOUNTS, SeedDataSchema } from "../scripts/seed-data.js";
import { createApp } from "../src/app.js";
import { createSupabaseVerifier } from "../src/auth/supabase-verifier.js";
import { loadEnv } from "../src/config/env.js";
import { createSystemWriter } from "../src/db/system-writer.js";
import { createLogger } from "../src/lib/logger.js";

const env = {
  url: process.env.SUPABASE_URL ?? "",
  publishable: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  secret: process.env.SUPABASE_SECRET_KEY ?? "",
  adminPassword: process.env.SEED_ADMIN_PASSWORD ?? "",
  authorPassword: process.env.SEED_AUTHOR_PASSWORD ?? "",
};
const configured = Object.values(env).every((value) => value !== "" && !value.startsWith("replace-with"));

const data = SeedDataSchema.parse(
  JSON.parse(readFileSync(new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url), "utf8")),
);
const AUTHOR_ID = "AUTH006";
const author = data.authors.find((candidate) => candidate.author_id === AUTHOR_ID)!;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

describe.runIf(configured)("admin replies and notes against live Supabase", () => {
  const app = createApp({
    env: loadEnv({ NODE_ENV: "test", SUPABASE_URL: env.url, SUPABASE_PUBLISHABLE_KEY: env.publishable }),
    logger: createLogger({ LOG_LEVEL: "silent" }),
    verifier: createSupabaseVerifier({ url: env.url, publishableKey: env.publishable }),
    systemWriter: createSystemWriter({ url: env.url, secretKey: env.secret }),
  });
  let system: SupabaseClient;
  let authorClient: SupabaseClient;
  const tokens = { ops: "", lead: "", author: "" };
  const ids = { ops: "", lead: "" };
  let ticketId = "";

  const as = (who: keyof typeof tokens) => `Bearer ${tokens[who]}`;
  const reply = (body: object, who: "ops" | "lead" = "ops") =>
    request(app).post(`/api/v1/admin/tickets/${ticketId}/messages`).set("Authorization", as(who)).send(body);
  const row = async () =>
    (
      await system
        .from("tickets")
        .select("status, version, first_response_at, resolved_at")
        .eq("id", ticketId)
        .single()
    ).data!;
  const messageCount = async () =>
    (
      await system
        .from("ticket_messages")
        .select("id", { count: "exact", head: true })
        .eq("ticket_id", ticketId)
    ).count;
  const audit = async () =>
    (
      await system
        .from("audit_events")
        .select("action, actor_profile_id, metadata")
        .eq("ticket_id", ticketId)
        .order("created_at")
        .order("id")
    ).data!;

  beforeAll(async () => {
    system = createClient(env.url, env.secret, noSession);
    const signIn = async (email: string, password: string) => {
      const client = createClient(env.url, env.publishable, noSession);
      const { data: session, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !session.session) throw new Error(`sign-in failed (${error?.code})`);
      return { client, token: session.session.access_token, id: session.user!.id };
    };
    const [ops, lead, authorSession] = await Promise.all([
      signIn(ADMIN_ACCOUNTS[0]!.email, env.adminPassword),
      signIn(ADMIN_ACCOUNTS[1]!.email, env.adminPassword),
      signIn(author.email, env.authorPassword),
    ]);
    Object.assign(tokens, { ops: ops.token, lead: lead.token, author: authorSession.token });
    Object.assign(ids, { ops: ops.id, lead: lead.id });
    authorClient = authorSession.client;

    const inserted = await system
      .from("tickets")
      .insert({
        author_id: AUTHOR_ID,
        book_id: null,
        subject: "Reply test: account email change",
        description: "Created by the automated live admin reply suite; deleted afterwards.",
        priority: "high",
        priority_source: "ai",
        created_at: new Date(Date.now() - 3_600_000).toISOString(),
      })
      .select("id")
      .single();
    if (inserted.error)
      throw new Error(`setup: insert failed (${inserted.error.code}: ${inserted.error.message})`);
    ticketId = inserted.data.id;
  });

  afterAll(async () => {
    if (!ticketId) return;
    const { error } = await system.from("tickets").delete().eq("id", ticketId);
    if (error) throw new Error(`cleanup failed (${error.code}); delete the "Reply test" ticket by hand`);
  });

  it("the first reply records the first response and moves the ticket to in progress, atomically", async () => {
    const before = await row();
    const res = await reply({ body: "Thanks for reaching out. We're updating your account email now." });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ senderRole: "admin", senderName: "Ops Admin" });

    const after = await row();
    expect(after.status).toBe("in_progress");
    expect(after.first_response_at).toBe(
      (await system.from("ticket_messages").select("created_at").eq("id", res.body.data.id).single()).data!
        .created_at,
    );
    expect(after.version).toBeGreaterThan(before.version);
    expect(await audit()).toEqual([
      {
        action: "ticket.reply_sent",
        actor_profile_id: ids.ops,
        metadata: { messageId: res.body.data.id, draftId: null, firstResponse: true },
      },
      {
        action: "ticket.status_changed",
        actor_profile_id: ids.ops,
        metadata: { from: "open", to: "in_progress", via: "reply" },
      },
    ]);
  });

  it("the author sees the reply signed by the team, and the admin sees the SLA met", async () => {
    const own = await request(app)
      .get(`/api/v1/author/tickets/${ticketId}`)
      .set("Authorization", as("author"));
    expect(own.status).toBe(200);
    expect(own.body.data.hasAdminReply).toBe(true);
    expect(own.body.data.messages).toMatchObject([{ senderRole: "admin", senderName: "BookLeaf Support" }]);

    const admin = await request(app)
      .get(`/api/v1/admin/tickets/${ticketId}`)
      .set("Authorization", as("lead"));
    expect(admin.body.data).toMatchObject({ slaState: "met", status: "in_progress" });
    expect(admin.body.data.messages).toMatchObject([{ senderName: "Ops Admin" }]);
  });

  it("a reply cannot be sent by an author, even by calling the database function directly", async () => {
    const count = await messageCount();
    const viaApi = await request(app)
      .post(`/api/v1/admin/tickets/${ticketId}/messages`)
      .set("Authorization", as("author"))
      .send({ body: "Pretending to be support" });
    expect(viaApi.status).toBe(403);

    const direct = await authorClient.rpc("admin_send_reply", {
      p_ticket_id: ticketId,
      p_body: "Pretending",
    });
    expect(direct.error?.code).toBe("42501");
    const anon = await createClient(env.url, env.publishable, noSession).rpc("admin_send_reply", {
      p_ticket_id: ticketId,
      p_body: "Anonymous",
    });
    expect(anon.error).not.toBeNull();
    expect(await messageCount()).toBe(count);
  });

  it("an unknown draft is refused and nothing is sent", async () => {
    const count = await messageCount();
    const res = await reply({ body: "From a draft", draftId: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f" });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ path: "draftId", issue: "must be a draft of this ticket" }]);
    expect(await messageCount()).toBe(count);
  });

  it("a stale PATCH conflicts after a reply, because the reply moved the version", async () => {
    const version = (await row()).version;
    expect((await reply({ body: "One more detail: please confirm your new email." })).status).toBe(201);
    const stale = await request(app)
      .patch(`/api/v1/admin/tickets/${ticketId}`)
      .set("Authorization", as("lead"))
      .send({ version, priority: "medium" });
    expect(stale.status).toBe(409);
  });

  it("statusAfter=resolved resolves; a resolved ticket refuses replies until reopened", async () => {
    const firstResponseAt = (await row()).first_response_at;
    const resolve = await reply({ body: "Done: your account email is updated.", statusAfter: "resolved" });
    expect(resolve.status).toBe(201);
    const resolved = await row();
    expect(resolved).toMatchObject({ status: "resolved", first_response_at: firstResponseAt });
    expect(resolved.resolved_at).not.toBeNull();
    expect((await audit()).slice(-2).map((event) => [event.action, event.metadata])).toEqual([
      ["ticket.reply_sent", { messageId: resolve.body.data.id, draftId: null, firstResponse: false }],
      ["ticket.status_changed", { from: "in_progress", to: "resolved", via: "reply" }],
    ]);

    const count = await messageCount();
    const refused = await reply({ body: "Following up" });
    expect(refused.status).toBe(422);
    expect(refused.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    expect(await messageCount()).toBe(count);

    const reopen = await request(app)
      .patch(`/api/v1/admin/tickets/${ticketId}`)
      .set("Authorization", as("ops"))
      .send({ version: resolved.version, status: "in_progress" });
    expect(reopen.status).toBe(200);
    const auditCount = (await audit()).length;
    expect((await reply({ body: "Reopened: one more question." })).status).toBe(201);
    expect((await audit()).slice(auditCount).map((event) => event.action)).toEqual(["ticket.reply_sent"]);
  });

  it("internal notes: admins add and list them; authors can't see them anywhere", async () => {
    const added = await request(app)
      .post(`/api/v1/admin/tickets/${ticketId}/notes`)
      .set("Authorization", as("lead"))
      .send({ body: "Verified the new email with the author by phone." });
    expect(added.status).toBe(201);
    expect(added.body.data.author).toEqual({ userId: ids.lead, displayName: "Support Lead" });

    const list = await request(app)
      .get(`/api/v1/admin/tickets/${ticketId}/notes`)
      .set("Authorization", as("ops"));
    expect(list.body.data.map((note: { id: string }) => note.id)).toEqual([added.body.data.id]);
    expect((await audit()).at(-1)).toEqual({
      action: "ticket.note_added",
      actor_profile_id: ids.lead,
      metadata: { noteId: added.body.data.id },
    });

    const direct = await authorClient.from("internal_notes").select("id").eq("ticket_id", ticketId);
    expect(direct.data ?? []).toEqual([]);
    const own = await request(app)
      .get(`/api/v1/author/tickets/${ticketId}`)
      .set("Authorization", as("author"));
    expect(JSON.stringify(own.body)).not.toContain("Verified the new email");

    const unknown = await request(app)
      .post("/api/v1/admin/tickets/6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c9999/notes")
      .set("Authorization", as("ops"))
      .send({ body: "Nowhere" });
    expect(unknown.status).toBe(404);
  });
});

describe.skipIf(configured)("admin replies and notes against live Supabase (skipped)", () => {
  it("needs SUPABASE_* keys (including the secret key) and SEED_* passwords in backend/.env", () => {
    expect(configured).toBe(false);
  });
});
