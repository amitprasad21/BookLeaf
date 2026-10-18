// Live admin queue (npm run test:live): the real app with real admin sign-in
// and RLS. Eight fixture tickets covering every urgency rank and SLA state are
// inserted with the secret key (backdated, so the per-author creation limit
// isn't touched), queried through the API, and deleted afterwards.
// Needs migration 20261018090000_queue_urgency_rank.sql (npm run check:db).
import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { businessDate } from "@bookleaf/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_ACCOUNTS, SeedDataSchema, toBookRows } from "../scripts/seed-data.js";
import { createApp } from "../src/app.js";
import { createSupabaseVerifier } from "../src/auth/supabase-verifier.js";
import { loadEnv } from "../src/config/env.js";
import { createLogger } from "../src/lib/logger.js";
import { recordingSystemWriter } from "../test/fakes.js";

const env = {
  url: process.env.SUPABASE_URL ?? "",
  publishable: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  secret: process.env.SUPABASE_SECRET_KEY ?? "",
  adminPassword: process.env.SEED_ADMIN_PASSWORD ?? "",
};
const configured = Object.values(env).every((value) => value !== "" && !value.startsWith("replace-with"));

const data = SeedDataSchema.parse(
  JSON.parse(readFileSync(new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url), "utf8")),
);
const authorName = (id: string) => data.authors.find((author) => author.author_id === id)!.name;
const firstBook = (id: string) => toBookRows(data).find((book) => book.author_id === id)!;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const HOUR = 3_600_000;
const RUN = `Q${randomInt(100_000, 999_999)}`; // search tag isolating this run's tickets

type Key = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
interface Fixture {
  authorId: string;
  general?: boolean;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "critical" | "high" | "medium" | "low" | null;
  hoursAgo: number;
  repliedAfterHours?: number;
  assignee?: "ops" | "lead";
  aiStatus?: "pending" | "completed" | "failed" | "manual_review_required";
  category?: "royalty_payments" | "isbn_metadata";
  sla: string;
}

// Authors AUTH003..AUTH008 only: the RLS and ticket suites use AUTH001/AUTH002.
const FIXTURES: Record<Key, Fixture> = {
  A: {
    authorId: "AUTH003",
    status: "open",
    priority: "critical",
    hoursAgo: 1,
    category: "royalty_payments",
    sla: "on_track",
  },
  B: {
    authorId: "AUTH004",
    status: "open",
    priority: "critical",
    hoursAgo: 5,
    assignee: "ops",
    sla: "breached",
  },
  C: {
    authorId: "AUTH005",
    status: "in_progress",
    priority: "high",
    hoursAgo: 30,
    repliedAfterHours: 2,
    assignee: "ops",
    sla: "met",
  },
  D: {
    authorId: "AUTH006",
    general: true,
    status: "open",
    priority: null,
    hoursAgo: 26,
    aiStatus: "manual_review_required",
    sla: "breached",
  },
  E: {
    authorId: "AUTH007",
    status: "open",
    priority: "medium",
    hoursAgo: 40,
    assignee: "lead",
    sla: "due_soon",
  },
  F: {
    authorId: "AUTH008",
    status: "open",
    priority: "low",
    hoursAgo: 2,
    category: "isbn_metadata",
    sla: "on_track",
  },
  G: {
    authorId: "AUTH003",
    status: "resolved",
    priority: "critical",
    hoursAgo: 50,
    repliedAfterHours: 1,
    sla: "met",
  },
  H: {
    authorId: "AUTH004",
    general: true,
    status: "closed",
    priority: null,
    hoursAgo: 80,
    sla: "not_applicable",
  },
};
const URGENCY_ORDER: Key[] = ["B", "A", "C", "D", "E", "F", "G", "H"];

describe.runIf(configured)("admin queue against live Supabase", () => {
  const app = createApp({
    env: loadEnv({ NODE_ENV: "test", SUPABASE_URL: env.url, SUPABASE_PUBLISHABLE_KEY: env.publishable }),
    logger: createLogger({ LOG_LEVEL: "silent" }),
    verifier: createSupabaseVerifier({ url: env.url, publishableKey: env.publishable }),
    systemWriter: recordingSystemWriter().writer, // the queue only reads
  });
  let system: SupabaseClient;
  let token = "";
  const admins: Record<"ops" | "lead", { id: string; displayName: string }> = {} as never;
  const ids = {} as Record<Key, string>;
  const createdAt = {} as Record<Key, string>;
  let baseline: Record<string, number> = {};

  const get = (path: string) =>
    request(app).get(`/api/v1/admin${path}`).set("Authorization", `Bearer ${token}`);
  /** This run's fixtures in the order the API returned them. */
  const keysOf = (items: { id: string }[]) =>
    items.flatMap((item) => (Object.keys(ids) as Key[]).filter((key) => ids[key] === item.id));
  const queue = async (query: string) => {
    const res = await get(`/tickets?pageSize=100&q=${RUN}${query}`);
    expect(res.status, query).toBe(200);
    return keysOf(res.body.data);
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

    const profiles = await system.from("profiles").select("id, display_name").eq("role", "admin");
    for (const [key, account] of [
      ["ops", ADMIN_ACCOUNTS[0]!],
      ["lead", ADMIN_ACCOUNTS[1]!],
    ] as const) {
      const profile = profiles.data?.find((candidate) => candidate.display_name === account.displayName);
      if (!profile)
        throw new Error(`setup: admin profile "${account.displayName}" not found; run npm run seed:apply`);
      admins[key] = { id: profile.id, displayName: profile.display_name };
    }

    const summary = await get("/tickets/summary");
    if (summary.status !== 200) throw new Error(`setup: summary returned ${summary.status}`);
    baseline = summary.body.data;

    const now = Date.now();
    const rows = (Object.entries(FIXTURES) as [Key, Fixture][]).map(([key, fixture]) => {
      const created = new Date(now - fixture.hoursAgo * HOUR);
      createdAt[key] = created.toISOString();
      return {
        author_id: fixture.authorId,
        book_id: fixture.general ? null : firstBook(fixture.authorId).book_id,
        subject: `Queue test ${RUN}: fixture ${key}`,
        description: "Created by the automated live admin queue suite; deleted afterwards.",
        status: fixture.status,
        priority: fixture.priority,
        priority_source: fixture.priority ? "ai" : null,
        category: fixture.category ?? null,
        category_source: fixture.category ? "ai" : null,
        ai_status: fixture.aiStatus ?? "completed",
        assigned_admin_id: fixture.assignee ? admins[fixture.assignee].id : null,
        created_at: created.toISOString(),
        updated_at: created.toISOString(),
        first_response_at:
          fixture.repliedAfterHours === undefined
            ? null
            : new Date(created.getTime() + fixture.repliedAfterHours * HOUR).toISOString(),
      };
    });
    const inserted = await system.from("tickets").insert(rows).select("id, subject");
    if (inserted.error)
      throw new Error(`setup: fixture insert failed (${inserted.error.code}: ${inserted.error.message})`);
    for (const ticket of inserted.data) ids[ticket.subject.slice(-1) as Key] = ticket.id;
  });

  afterAll(async () => {
    const created = Object.values(ids);
    if (created.length === 0) return;
    const { error } = await system.from("tickets").delete().in("id", created);
    if (error)
      throw new Error(`cleanup failed (${error.code}); delete the "Queue test ${RUN}" tickets by hand`);
  });

  it("sorts by urgency: unresolved first, then critical, high, untriaged, medium, low, then oldest", async () => {
    expect(await queue("")).toEqual(URGENCY_ORDER);
    // Same relative order without the search, among whatever else is in the queue.
    const all = await get("/tickets?pageSize=100");
    expect(keysOf(all.body.data)).toEqual(URGENCY_ORDER);
  });

  it("computes slaState and maps authors, books and assignees", async () => {
    const res = await get(`/tickets?pageSize=100&q=${RUN}`);
    const byKey = Object.fromEntries(res.body.data.map((item: { id: string }) => [keysOf([item])[0], item]));
    for (const key of URGENCY_ORDER) {
      const fixture = FIXTURES[key];
      expect(byKey[key], key).toMatchObject({
        slaState: fixture.sla,
        author: { authorId: fixture.authorId, name: authorName(fixture.authorId) },
        book: fixture.general
          ? null
          : { bookId: firstBook(fixture.authorId).book_id, title: firstBook(fixture.authorId).title },
        assignedAdmin: fixture.assignee
          ? { userId: admins[fixture.assignee].id, displayName: admins[fixture.assignee].displayName }
          : null,
        status: fixture.status,
        priority: fixture.priority,
        version: 1,
      });
    }
  });

  it("filters by status, priority (incl. untriaged), category, assignee, AI status and overdue", async () => {
    expect(await queue("&status=resolved,closed")).toEqual(["G", "H"]);
    expect(await queue("&priority=untriaged")).toEqual(["D", "H"]);
    expect(await queue("&priority=critical,untriaged")).toEqual(["B", "A", "D", "G", "H"]);
    expect(await queue("&category=isbn_metadata")).toEqual(["F"]);
    expect(await queue("&assignee=me")).toEqual(["B", "C"]);
    expect(await queue("&assignee=unassigned")).toEqual(["A", "D", "F", "G", "H"]);
    expect(await queue("&aiStatus=manual_review_required")).toEqual(["D"]);
    expect(await queue("&overdue=true")).toEqual(["B", "D"]);
    expect(await queue("&overdue=true&priority=critical&status=open")).toEqual(["B"]);
  });

  it("filters by India business date", async () => {
    const today = businessDate(new Date());
    const expected = URGENCY_ORDER.filter((key) => businessDate(new Date(createdAt[key])) === today);
    expect(await queue(`&createdFrom=${today}&createdTo=${today}`)).toEqual(expected);
  });

  it("searches reference, subject and author name", async () => {
    const byReference = await get(`/tickets?pageSize=100&q=${RUN}`);
    const reference = byReference.body.data.find((item: { id: string }) => item.id === ids.C).reference;
    expect(keysOf((await get(`/tickets?q=${reference}`)).body.data)).toEqual(["C"]);
    const byAuthor = await get(`/tickets?pageSize=100&q=${encodeURIComponent(authorName("AUTH005"))}`);
    expect(keysOf(byAuthor.body.data)).toEqual(["C"]);
  });

  it("sorts newest first and pages in the database", async () => {
    expect(await queue("&sort=-created_at")).toEqual(["A", "F", "B", "D", "C", "E", "G", "H"]);
    const page = await get(`/tickets?q=${RUN}&pageSize=3&page=2`);
    expect(keysOf(page.body.data)).toEqual(["D", "E", "F"]);
    expect(page.body.meta).toEqual({ page: 2, pageSize: 3, total: 8 });
  });

  it("summary counts move by exactly this run's fixtures", async () => {
    const res = await get("/tickets/summary");
    expect(res.status).toBe(200);
    const delta = Object.fromEntries(
      Object.entries(res.body.data as Record<string, number>).map(([key, value]) => [
        key,
        value - baseline[key]!,
      ]),
    );
    expect(delta).toEqual({
      open: 5, // A, B, D, E, F
      inProgress: 1, // C
      resolved: 1, // G
      closed: 1, // H
      unassigned: 3, // A, D, F (unresolved only)
      critical: 2, // A, B
      high: 1, // C
      slaBreached: 2, // B, D
      needsManualTriage: 1, // D
    });
  });
});

describe.skipIf(configured)("admin queue against live Supabase (skipped)", () => {
  it("needs SUPABASE_* keys (including the secret key) and SEED_ADMIN_PASSWORD in backend/.env", () => {
    expect(configured).toBe(false);
  });
});
