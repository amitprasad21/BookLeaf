// Live admin ticket detail and PATCH (npm run test:live): real admin sign-ins,
// RLS, the immutable-field and version triggers, and the real system writer.
// A fixture ticket for AUTH009 (with a thread, a note and an audit row) is
// inserted with the secret key and deleted afterwards.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_ACCOUNTS, SeedDataSchema, toBookRows } from "../scripts/seed-data.js";
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
const AUTHOR_ID = "AUTH009"; // not used by the other ticket suites
const author = data.authors.find((candidate) => candidate.author_id === AUTHOR_ID)!;
const authorBooks = toBookRows(data).filter((book) => book.author_id === AUTHOR_ID);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

describe.runIf(configured)("admin ticket detail and updates against live Supabase", () => {
  const app = createApp({
    env: loadEnv({ NODE_ENV: "test", SUPABASE_URL: env.url, SUPABASE_PUBLISHABLE_KEY: env.publishable }),
    logger: createLogger({ LOG_LEVEL: "silent" }),
    verifier: createSupabaseVerifier({ url: env.url, publishableKey: env.publishable }),
    systemWriter: createSystemWriter({ url: env.url, secretKey: env.secret }),
  });
  let system: SupabaseClient;
  const tokens = { ops: "", lead: "", author: "" };
  const ids = { ops: "", lead: "", author: "" };
  let ticketId = "";

  const as = (who: keyof typeof tokens) => `Bearer ${tokens[who]}`;
  const patch = (who: "ops" | "lead", body: object) =>
    request(app).patch(`/api/v1/admin/tickets/${ticketId}`).set("Authorization", as(who)).send(body);
  const row = async () =>
    (
      await system
        .from("tickets")
        .select(
          "status, version, priority, priority_source, ai_priority, category, category_source, assigned_admin_id, resolved_at, closed_at, subject",
        )
        .eq("id", ticketId)
        .single()
    ).data!;
  const auditActions = async () =>
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
      return { token: session.session.access_token, id: session.user!.id };
    };
    const [ops, lead, authorSession] = await Promise.all([
      signIn(ADMIN_ACCOUNTS[0]!.email, env.adminPassword),
      signIn(ADMIN_ACCOUNTS[1]!.email, env.adminPassword),
      signIn(author.email, env.authorPassword),
    ]);
    Object.assign(tokens, { ops: ops.token, lead: lead.token, author: authorSession.token });
    Object.assign(ids, { ops: ops.id, lead: lead.id, author: authorSession.id });

    const created = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const inserted = await system
      .from("tickets")
      .insert({
        author_id: AUTHOR_ID,
        book_id: authorBooks[1]!.book_id,
        subject: "Admin test: royalty below threshold",
        description: "Created by the automated live admin ticket suite; deleted afterwards.",
        category: "royalty_payments",
        category_source: "ai",
        priority: "high",
        priority_source: "ai",
        ai_status: "completed",
        ai_category: "royalty_payments",
        ai_priority: "high",
        ai_confidence: 0.82,
        ai_signals: ["royalty_question"],
        ai_rationale: "Pending royalty below the payout threshold.",
        ai_processed_at: created,
        created_at: created,
        updated_at: created,
      })
      .select("id")
      .single();
    if (inserted.error)
      throw new Error(`setup: insert failed (${inserted.error.code}: ${inserted.error.message})`);
    ticketId = inserted.data.id;

    const extras = await Promise.all([
      system.from("audit_events").insert({
        ticket_id: ticketId,
        actor_profile_id: ids.author,
        action: "ticket.created",
        metadata: { bookId: authorBooks[1]!.book_id },
      }),
      system.from("ticket_messages").insert([
        {
          ticket_id: ticketId,
          sender_role: "author",
          sender_profile_id: ids.author,
          body: "Any update on this?",
        },
      ]),
      system
        .from("internal_notes")
        .insert({ ticket_id: ticketId, admin_profile_id: ids.lead, body: "Checked: ₹850 pending." }),
    ]);
    const failed = extras.find((result) => result.error);
    if (failed?.error)
      throw new Error(`setup: fixture insert failed (${failed.error.code}: ${failed.error.message})`);
  });

  afterAll(async () => {
    if (!ticketId) return;
    const { error } = await system.from("tickets").delete().eq("id", ticketId);
    if (error) throw new Error(`cleanup failed (${error.code}); delete the "Admin test" ticket by hand`);
  });

  it("GET returns the admin view: author context with royalty figures, thread, notes, AI and timeline", async () => {
    const res = await request(app).get(`/api/v1/admin/tickets/${ticketId}`).set("Authorization", as("ops"));
    expect(res.status).toBe(200);
    const detail = res.body.data;
    const version = (await row()).version; // the thread trigger bumped it
    expect(detail).toMatchObject({
      id: ticketId,
      status: "open",
      version,
      slaState: "on_track",
      book: { bookId: authorBooks[1]!.book_id, title: authorBooks[1]!.title },
      authorContext: {
        author: { authorId: AUTHOR_ID, name: author.name, city: author.city, joinedDate: author.joined_date },
      },
      ai: { status: "completed", suggestedPriority: "high", confidence: 0.82, signals: ["royalty_question"] },
    });
    expect(
      detail.authorContext.books.map((book: { bookId: string; royaltyPending: number }) => [
        book.bookId,
        book.royaltyPending,
      ]),
    ).toEqual(authorBooks.map((book) => [book.book_id, book.royalty_pending]));
    expect(detail.messages.map((message: { senderName: string }) => message.senderName)).toEqual([
      author.name,
    ]);
    expect(detail.notes).toMatchObject([
      { author: { userId: ids.lead, displayName: "Support Lead" }, body: "Checked: ₹850 pending." },
    ]);
    expect(detail.timeline).toMatchObject([{ action: "ticket.created", actor: { userId: ids.author } }]);
    expect(JSON.stringify(detail)).not.toContain(author.email);
  });

  it("PATCH applies status, priority override and self-assignment in one versioned write, audited", async () => {
    const before = await row();
    const res = await patch("ops", {
      version: before.version,
      status: "in_progress",
      priority: "critical",
      assignedAdminId: ids.ops,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: "in_progress",
      priority: "critical",
      prioritySource: "admin",
      assignedAdmin: { userId: ids.ops, displayName: "Ops Admin" },
      version: before.version + 1,
    });

    const after = await row();
    expect(after).toMatchObject({
      status: "in_progress",
      priority: "critical",
      priority_source: "admin",
      ai_priority: "high", // the AI's suggestion is kept
      assigned_admin_id: ids.ops,
      version: before.version + 1,
    });
    expect((await auditActions()).slice(1)).toEqual([
      {
        action: "ticket.status_changed",
        actor_profile_id: ids.ops,
        metadata: { from: "open", to: "in_progress" },
      },
      {
        action: "ticket.priority_overridden",
        actor_profile_id: ids.ops,
        metadata: { from: "high", fromSource: "ai", to: "critical" },
      },
      { action: "ticket.assigned", actor_profile_id: ids.ops, metadata: { adminId: ids.ops } },
    ]);
    expect(res.body.data.timeline.map((event: { action: string }) => event.action)).toEqual([
      "ticket.created",
      "ticket.status_changed",
      "ticket.priority_overridden",
      "ticket.assigned",
    ]);
  });

  it("a stale version gets 409 with the current ticket and changes nothing", async () => {
    const before = await row();
    const res = await patch("lead", { version: before.version - 1, category: "isbn_metadata" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "VERSION_CONFLICT",
      current: { id: ticketId, version: before.version },
    });
    expect(await row()).toEqual(before);
  });

  it("when two admins save the same version at once, exactly one wins", async () => {
    const before = await row();
    const [first, second] = await Promise.all([
      patch("ops", { version: before.version, category: "general_inquiry" }),
      patch("lead", { version: before.version, category: "isbn_metadata" }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const after = await row();
    expect(after.version).toBe(before.version + 1);
    const winner = first.status === 200 ? "general_inquiry" : "isbn_metadata";
    expect(after).toMatchObject({ category: winner, category_source: "admin" });
    const loser = first.status === 409 ? first : second;
    expect(loser.body.error.current).toMatchObject({ category: winner, version: after.version });
  });

  it("assignment is self-service: a colleague can neither take nor release the ticket", async () => {
    let version = (await row()).version;
    const take = await patch("lead", { version, assignedAdminId: ids.lead });
    expect(take.status).toBe(422);
    expect(take.body.error.code).toBe("INVALID_ASSIGNMENT");
    const release = await patch("lead", { version, assignedAdminId: null });
    expect(release.status).toBe(422);

    const own = await patch("ops", { version, assignedAdminId: null });
    expect(own.status).toBe(200);
    expect((await row()).assigned_admin_id).toBeNull();
    version = (await row()).version;
    expect((await patch("lead", { version, assignedAdminId: ids.lead })).status).toBe(200);
    expect((await row()).assigned_admin_id).toBe(ids.lead);
  });

  it("enforces the status machine and stamps resolve/close times; reopening clears them", async () => {
    const resolve = await patch("ops", { version: (await row()).version, status: "resolved" });
    expect(resolve.status).toBe(200);
    expect((await row()).resolved_at).not.toBeNull();

    const close = await patch("ops", { version: (await row()).version, status: "closed" });
    expect(close.status).toBe(200);
    expect((await row()).closed_at).not.toBeNull();

    const back = await patch("ops", { version: (await row()).version, status: "resolved" });
    expect(back.status).toBe(422);
    expect(back.body.error.code).toBe("INVALID_STATUS_TRANSITION");

    const reopen = await patch("ops", { version: (await row()).version, status: "in_progress" });
    expect(reopen.status).toBe(200);
    expect(await row()).toMatchObject({ status: "in_progress", resolved_at: null, closed_at: null });
  });

  it("can't touch ticket content, and authors can't use the admin endpoints", async () => {
    const before = await row();
    const edit = await patch("ops", { version: before.version, subject: "Rewritten by an admin" });
    expect(edit.status).toBe(400);
    expect((await row()).subject).toBe(before.subject);

    const asAuthor = await request(app)
      .patch(`/api/v1/admin/tickets/${ticketId}`)
      .set("Authorization", as("author"))
      .send({ version: before.version, status: "closed" });
    expect(asAuthor.status).toBe(403);
    const unknown = await request(app)
      .get("/api/v1/admin/tickets/6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c9999")
      .set("Authorization", as("ops"));
    expect(unknown.status).toBe(404);
  });
});

describe.skipIf(configured)("admin ticket detail and updates against live Supabase (skipped)", () => {
  it("needs SUPABASE_* keys (including the secret key) and SEED_* passwords in backend/.env", () => {
    expect(configured).toBe(false);
  });
});
