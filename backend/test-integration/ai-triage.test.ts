// Live AI triage (npm run test:live): real providers (Gemini primary, Groq
// fallback, from the keys in backend/.env), the real system writer and the
// real database. A few Flash-Lite calls on synthetic tickets for AUTH005 and
// AUTH007; tickets are deleted afterwards. Usage events stay: they record
// real provider calls and count toward the daily budget, as they should.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAiFromEnv } from "../src/ai/config.js";
import { createTriageControl } from "../src/ai/control.js";
import { MOCK_RESPONDERS } from "../src/ai/prompts/triage.js";
import { createJobQueue } from "../src/ai/queue.js";
import { createTriageService } from "../src/ai/triage.js";
import { createApp } from "../src/app.js";
import { createSupabaseVerifier } from "../src/auth/supabase-verifier.js";
import { loadEnv } from "../src/config/env.js";
import { createSystemWriter } from "../src/db/system-writer.js";
import { createLogger } from "../src/lib/logger.js";
import { ADMIN_ACCOUNTS, SeedDataSchema, toBookRows } from "../scripts/seed-data.js";

const env = {
  url: process.env.SUPABASE_URL ?? "",
  publishable: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  secret: process.env.SUPABASE_SECRET_KEY ?? "",
  authorPassword: process.env.SEED_AUTHOR_PASSWORD ?? "",
  adminPassword: process.env.SEED_ADMIN_PASSWORD ?? "",
  gemini: process.env.GEMINI_API_KEY ?? "",
};
const configured = Object.values(env).every((value) => value !== "" && !value.startsWith("replace-with"));

const data = SeedDataSchema.parse(
  JSON.parse(readFileSync(new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url), "utf8")),
);
const firstBook = (authorId: string) => toBookRows(data).find((book) => book.author_id === authorId)!;
const authorEmail = (id: string) => data.authors.find((author) => author.author_id === id)!.email;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

describe.runIf(configured)("AI triage against live providers and Supabase", () => {
  // Real providers regardless of AI_PRIMARY_PROVIDER in .env: this suite is about them.
  const appEnv = loadEnv({
    ...process.env,
    NODE_ENV: "test",
    AI_PRIMARY_PROVIDER: "gemini",
    AI_FALLBACK_PROVIDER: process.env.GROQ_API_KEY ? "groq" : "",
  });
  const logger = createLogger({ LOG_LEVEL: "silent" });
  const writer = createSystemWriter({ url: env.url, secretKey: env.secret });
  const router = createAiFromEnv(appEnv, writer, logger, { mockResponders: MOCK_RESPONDERS });
  const service = createTriageService({ router, writer, clock: () => new Date(), logger, timeoutMs: 30_000 });
  const queue = createJobQueue({ concurrency: 2, run: (id) => service.run(id), logger });
  const app = createApp({
    env: appEnv,
    logger,
    verifier: createSupabaseVerifier({ url: env.url, publishableKey: env.publishable }),
    systemWriter: writer,
    triage: createTriageControl({ queue, writer, router }),
  });
  let system: SupabaseClient;
  const tokens = { author: "", admin: "" };
  const created: string[] = [];

  const insert = async (fields: Record<string, unknown>) => {
    const inserted = await system
      .from("tickets")
      .insert({
        description: "Created by the automated live AI triage suite; deleted afterwards.",
        ...fields,
      })
      .select("id")
      .single();
    if (inserted.error)
      throw new Error(`setup: insert failed (${inserted.error.code}: ${inserted.error.message})`);
    created.push(inserted.data.id);
    return inserted.data.id as string;
  };
  const row = async (id: string) =>
    (
      await system
        .from("tickets")
        .select(
          "ai_status, ai_category, ai_priority, ai_confidence, ai_signals, ai_rationale, ai_policy_floor, ai_prompt_version, ai_attempts, category, category_source, priority, priority_source",
        )
        .eq("id", id)
        .single()
    ).data!;

  beforeAll(async () => {
    system = createClient(env.url, env.secret, noSession);
    const signIn = async (email: string, password: string) => {
      const client = createClient(env.url, env.publishable, noSession);
      const { data: session, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !session.session) throw new Error(`sign-in failed (${error?.code})`);
      return session.session.access_token;
    };
    tokens.author = await signIn(authorEmail("AUTH007"), env.authorPassword);
    tokens.admin = await signIn(ADMIN_ACCOUNTS[0]!.email, env.adminPassword);
  });

  afterAll(async () => {
    await queue.close(30_000);
    if (created.length === 0) return;
    const { error } = await system.from("tickets").delete().in("id", created);
    if (error) throw new Error(`cleanup failed (${error.code}); delete the "AI triage test" tickets by hand`);
  });

  it("a ticket created through the API is saved first (201), then triaged in the background", async () => {
    const res = await request(app)
      .post("/api/v1/author/tickets")
      .set("Authorization", `Bearer ${tokens.author}`)
      .send({
        bookId: firstBook("AUTH007").book_id,
        subject: "AI triage test: royalty missing for six months",
        description:
          "I have not received any royalty payment for the last six months even though my book keeps selling. Please check what happened.",
      });
    expect(res.status).toBe(201);
    created.push(res.body.data.id);
    expect((await row(res.body.data.id)).ai_status).toBe("pending"); // saved before any AI

    await queue.idle();
    const triaged = await row(res.body.data.id);
    expect(triaged).toMatchObject({
      ai_status: "completed",
      ai_category: "royalty_payments",
      category: "royalty_payments",
      category_source: "ai",
      priority_source: "ai",
      ai_attempts: 1,
    });
    expect(["critical", "high"]).toContain(triaged.ai_priority);
    expect(triaged.ai_rationale.length).toBeGreaterThanOrEqual(10);
    expect(triaged.ai_rationale.length).toBeLessThanOrEqual(300);
    expect(triaged.ai_prompt_version).toMatch(/^triage-/);

    const audit = await system
      .from("audit_events")
      .select("action, actor_profile_id, metadata")
      .eq("ticket_id", res.body.data.id)
      .eq("action", "ticket.triaged")
      .single();
    expect(audit.data).toMatchObject({ actor_profile_id: null, metadata: { category: "royalty_payments" } });
    const usage = await system
      .from("ai_usage_events")
      .select("task, provider, outcome, input_tokens, output_tokens")
      .eq("ticket_id", res.body.data.id);
    expect(usage.data?.some((event) => event.outcome === "success" && event.task === "triage")).toBe(true);
  });

  it("an ISBN error is classified and the ISBN floor guarantees at least High", async () => {
    const id = await insert({
      author_id: "AUTH005",
      book_id: firstBook("AUTH005").book_id,
      subject: "AI triage test: wrong ISBN on the printed copy",
      description:
        "The ISBN printed on the back cover of my book does not match the ISBN shown on the Amazon listing. Readers are confused.",
    });
    expect(await service.run(id)).toBe("completed");
    const triaged = await row(id);
    expect(triaged.ai_category).toBe("isbn_metadata");
    expect(["critical", "high"]).toContain(triaged.ai_priority);
    if (triaged.ai_signals.includes("isbn_error") && triaged.ai_policy_floor) {
      expect(triaged.ai_policy_floor).toBe("isbn_error_floor");
    }
  });

  it("an admin's category and priority are never replaced, but the AI suggestion is stored", async () => {
    const id = await insert({
      author_id: "AUTH005",
      book_id: null,
      subject: "AI triage test: update my author bio",
      description: "Could you update the author bio on my profile page with my new achievements?",
      category: "printing_quality",
      category_source: "admin",
      priority: "critical",
      priority_source: "admin",
    });
    expect(await service.run(id)).toBe("completed");
    expect(await row(id)).toMatchObject({
      category: "printing_quality",
      category_source: "admin",
      priority: "critical",
      priority_source: "admin",
      ai_category: "general_inquiry",
    });
  });

  it("an admin can re-run triage for a ticket in manual review (202, audited, then completed)", async () => {
    const id = await insert({
      author_id: "AUTH005",
      book_id: null,
      subject: "AI triage test: which package includes distribution?",
      description:
        "I would like to know which publishing package includes distribution on Flipkart and Amazon.",
      ai_status: "manual_review_required",
      ai_failure_reason: "provider_unavailable",
      ai_attempts: 3,
    });
    const res = await request(app)
      .post(`/api/v1/admin/tickets/${id}/triage`)
      .set("Authorization", `Bearer ${tokens.admin}`);
    expect(res.status).toBe(202);
    await queue.idle();
    expect(await row(id)).toMatchObject({ ai_status: "completed", ai_attempts: 1 });
    const requested = await system
      .from("audit_events")
      .select("action")
      .eq("ticket_id", id)
      .eq("action", "ticket.triage_requested");
    expect(requested.data).toHaveLength(1);
  });
});

describe.skipIf(configured)("AI triage against live providers and Supabase (skipped)", () => {
  it("needs SUPABASE_* keys, SEED_* passwords and GEMINI_API_KEY in backend/.env", () => {
    expect(configured).toBe(false);
  });
});
