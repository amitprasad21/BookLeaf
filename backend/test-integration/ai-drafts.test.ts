// Live AI reply drafts (npm run test:live): real providers (Gemini 3.8 Flash
// for drafts, Groq fallback), real admin sign-in and RLS. A fixture ticket for
// AUTH003 with a short thread is inserted with the secret key and deleted
// afterwards (drafts, messages and audit rows cascade). Two or three draft
// calls; their usage events stay (real usage, counted in the daily budget).
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAiFromEnv } from "../src/ai/config.js";
import { createDraftService } from "../src/ai/drafts.js";
import { selectKbSections } from "../src/ai/knowledge-base/index.js";
import { MOCK_RESPONDERS } from "../src/ai/prompts/index.js";
import { createApp } from "../src/app.js";
import { createSupabaseVerifier } from "../src/auth/supabase-verifier.js";
import { loadEnv } from "../src/config/env.js";
import { createSystemWriter } from "../src/db/system-writer.js";
import { createLogger } from "../src/lib/logger.js";
import { createAuditRecorder } from "../src/modules/audit/service.js";
import { ADMIN_ACCOUNTS, SeedDataSchema, toBookRows } from "../scripts/seed-data.js";

const env = {
  url: process.env.SUPABASE_URL ?? "",
  publishable: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  secret: process.env.SUPABASE_SECRET_KEY ?? "",
  adminPassword: process.env.SEED_ADMIN_PASSWORD ?? "",
  gemini: process.env.GEMINI_API_KEY ?? "",
};
const configured = Object.values(env).every((value) => value !== "" && !value.startsWith("replace-with"));

const data = SeedDataSchema.parse(
  JSON.parse(readFileSync(new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url), "utf8")),
);
const AUTHOR_ID = "AUTH003";
const author = data.authors.find((candidate) => candidate.author_id === AUTHOR_ID)!;
const book = toBookRows(data).find((candidate) => candidate.author_id === AUTHOR_ID)!;
const firstName = author.name.split(" ")[0]!;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

// Real model calls: allow for a provider timeout plus the fallback.
describe.runIf(configured)("AI reply drafts against live providers and Supabase", { timeout: 90_000 }, () => {
  const appEnv = loadEnv({
    ...process.env,
    NODE_ENV: "test",
    AI_PRIMARY_PROVIDER: "gemini",
    AI_FALLBACK_PROVIDER: process.env.GROQ_API_KEY ? "groq" : "",
  });
  const logger = createLogger({ LOG_LEVEL: "silent" });
  const writer = createSystemWriter({ url: env.url, secretKey: env.secret });
  const router = createAiFromEnv(appEnv, writer, logger, { mockResponders: MOCK_RESPONDERS });
  const app = createApp({
    env: appEnv,
    logger,
    verifier: createSupabaseVerifier({ url: env.url, publishableKey: env.publishable }),
    systemWriter: writer,
    drafts: createDraftService({
      router,
      clock: () => new Date(),
      audit: createAuditRecorder(writer, logger),
      timeoutMs: appEnv.AI_DRAFT_TIMEOUT_MS,
    }),
  });
  let system: SupabaseClient;
  let token = "";
  let adminId = "";
  let ticketId = "";
  let firstDraftId = "";

  const draft = (body?: object) => {
    const req = request(app)
      .post(`/api/v1/admin/tickets/${ticketId}/draft`)
      .set("Authorization", `Bearer ${token}`);
    return body ? req.send(body) : req;
  };

  beforeAll(async () => {
    system = createClient(env.url, env.secret, noSession);
    const client = createClient(env.url, env.publishable, noSession);
    const signIn = await client.auth.signInWithPassword({
      email: ADMIN_ACCOUNTS[0]!.email,
      password: env.adminPassword,
    });
    if (signIn.error || !signIn.data.session) throw new Error(`admin sign-in failed (${signIn.error?.code})`);
    token = signIn.data.session.access_token;
    adminId = signIn.data.user!.id;

    const inserted = await system
      .from("tickets")
      .insert({
        author_id: AUTHOR_ID,
        book_id: book.book_id,
        subject: "AI draft test: royalty not received",
        description:
          "Created by the automated live AI draft suite (deleted afterwards). My book has been selling well but I have not received any royalty for months. Can you tell me when I will be paid?",
        status: "open",
        category: "royalty_payments",
        category_source: "ai",
        priority: "high",
        priority_source: "ai",
        ai_status: "completed",
        ai_category: "royalty_payments",
        ai_priority: "high",
        ai_signals: ["payment_missing"],
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
    if (error) throw new Error(`cleanup failed (${error.code}); delete the "AI draft test" ticket by hand`);
  });

  it("generates a draft in BookLeaf's voice from the selected knowledge base sections (201)", async () => {
    const res = await draft();
    expect(res.status).toBe(201);
    const data = res.body.data;
    firstDraftId = data.id;
    expect(data.reply).toMatch(new RegExp(`^\\s*(Hi|Hello|Dear) ${firstName}\\b`));
    expect(data.reply).toMatch(/Warm regards,\s*\n\s*BookLeaf Author Support\s*$/);
    expect(data.reply).not.toMatch(/\[[^\]]+\]|\{\{/);
    const offered = selectKbSections("royalty_payments", ["payment_missing"]);
    expect(data.kbSectionsUsed.every((id: string) => (offered as string[]).includes(id))).toBe(true);
    expect(Array.isArray(data.factWarnings)).toBe(true);

    const row = await system
      .from("ai_drafts")
      .select("status, requested_by, provider, model, prompt_version, context_hash")
      .eq("id", data.id)
      .single();
    expect(row.data).toMatchObject({
      status: "ready",
      requested_by: adminId,
      prompt_version: data.promptVersion,
    });
    expect(["gemini", "groq"]).toContain(row.data!.provider);
    const audit = await system
      .from("audit_events")
      .select("action, actor_profile_id")
      .eq("ticket_id", ticketId);
    expect(audit.data).toContainEqual({ action: "ai.draft_generated", actor_profile_id: adminId });
  });

  it("reuses the same draft while nothing changed (200, no new AI call)", async () => {
    const before = await system
      .from("ai_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticketId);
    const res = await draft({});
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(firstDraftId);
    const after = await system
      .from("ai_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticketId);
    expect(after.count).toBe(before.count);
  });

  it("regenerates on request (201) and supersedes the earlier draft", async () => {
    const res = await draft({ regenerate: true });
    expect(res.status).toBe(201);
    expect(res.body.data.id).not.toBe(firstDraftId);
    const old = await system.from("ai_drafts").select("status").eq("id", firstDraftId).single();
    expect(old.data?.status).toBe("superseded");
  });

  it("a reply can be sent from the draft, linked to it (the admin's text is what's sent)", async () => {
    const current = await draft({});
    const edited = `${current.body.data.reply}\n\n(Edited by the admin.)`.slice(0, 5000);
    const sent = await request(app)
      .post(`/api/v1/admin/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: edited, draftId: current.body.data.id });
    expect(sent.status).toBe(201);
    const message = await system
      .from("ticket_messages")
      .select("ai_draft_id, body")
      .eq("id", sent.body.data.id)
      .single();
    expect(message.data).toMatchObject({ ai_draft_id: current.body.data.id, body: edited.trim() });
  });
});

describe.skipIf(configured)("AI reply drafts against live providers and Supabase (skipped)", () => {
  it("needs SUPABASE_* keys, SEED_ADMIN_PASSWORD and GEMINI_API_KEY in backend/.env", () => {
    expect(configured).toBe(false);
  });
});
