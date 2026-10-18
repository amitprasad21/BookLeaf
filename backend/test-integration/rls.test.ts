// Row level security tests against the real Supabase project (npm run test:rls).
// Signs in as seeded users with the PUBLISHABLE key, exactly what any client
// (or attacker) could do, and checks every row of the access matrix in
// .back/SUPABASE_RLS.md. Requires: both migrations applied and npm run seed done.
// Tickets created here are deleted afterwards with the secret key.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_ACCOUNTS, SeedDataSchema } from "../scripts/seed-data.js";

const env = {
  url: process.env.SUPABASE_URL ?? "",
  publishable: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  secret: process.env.SUPABASE_SECRET_KEY ?? "",
  authorPassword: process.env.SEED_AUTHOR_PASSWORD ?? "",
  adminPassword: process.env.SEED_ADMIN_PASSWORD ?? "",
};
const configured = Object.values(env).every((value) => value !== "" && !value.startsWith("replace-with"));

const data = SeedDataSchema.parse(
  JSON.parse(readFileSync(new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url), "utf8")),
);
const authorA = data.authors.find((author) => author.author_id === "AUTH001")!; // Priya: BK001, BK002
const authorB = data.authors.find((author) => author.author_id === "AUTH002")!; // Rohit: BK003, BK004
const admin = ADMIN_ACCOUNTS[0]!;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(env.url, env.publishable, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error)
    throw new Error(`Sign-in failed for a seeded account (${error.code ?? error.status}). Run npm run seed.`);
  return client;
}

const newTicket = (authorId: string, bookId: string | null, extra: Record<string, unknown> = {}) => ({
  author_id: authorId,
  book_id: bookId,
  subject: "RLS test ticket",
  description: "Created by the automated row level security test suite.",
  ...extra,
});

describe.runIf(configured)("row level security (live Supabase)", () => {
  let anon: SupabaseClient;
  let a: SupabaseClient;
  let b: SupabaseClient;
  let ops: SupabaseClient;
  let system: SupabaseClient;
  const created: string[] = [];
  let ticketA = "";
  let ticketB = "";

  beforeAll(async () => {
    anon = createClient(env.url, env.publishable, noSession);
    system = createClient(env.url, env.secret, noSession);
    [a, b, ops] = await Promise.all([
      signIn(authorA.email, env.authorPassword),
      signIn(authorB.email, env.authorPassword),
      signIn(admin.email, env.adminPassword),
    ]);

    // An author must see their own profile once the DB-3 policies exist; with RLS
    // on but no policies, every read is empty and every insert is refused.
    const ownProfile = await a.from("profiles").select("author_id");
    if (ownProfile.data?.length !== 1) {
      throw new Error(
        "setup: author A cannot see their own profile. Is supabase/migrations/20261017120000_rls_policies.sql applied? (npm run check:db)",
      );
    }

    const setupError = (who: string, error: { code?: string; message?: string }) =>
      new Error(`setup: ${who} insert failed (${error.code}: ${error.message})`);

    const insertedA = await a.from("tickets").insert(newTicket("AUTH001", "BK001")).select("id").single();
    if (insertedA.error) throw setupError("author A", insertedA.error);
    ticketA = insertedA.data.id;
    created.push(ticketA);

    const insertedB = await b.from("tickets").insert(newTicket("AUTH002", "BK003")).select("id").single();
    if (insertedB.error) throw setupError("author B", insertedB.error);
    ticketB = insertedB.data.id;
    created.push(ticketB);
  });

  afterAll(async () => {
    if (created.length > 0) await system.from("tickets").delete().in("id", created);
  });

  // ---------------------------------------------------------------- anon
  it("RLS-01 anon can read nothing", async () => {
    for (const table of ["authors", "books", "tickets", "profiles", "internal_notes"]) {
      const { error } = await anon.from(table).select("*").limit(1);
      expect(error?.code, table).toBe("42501");
    }
  });

  // ------------------------------------------------------- author reads
  it("RLS-02 an author sees exactly their own books, author record and profile", async () => {
    const books = await a.from("books").select("book_id").order("book_id");
    expect(books.data?.map((book) => book.book_id)).toEqual(["BK001", "BK002"]);

    const authors = await a.from("authors").select("author_id");
    expect(authors.data?.map((row) => row.author_id)).toEqual(["AUTH001"]);

    const profiles = await a.from("profiles").select("author_id, role");
    expect(profiles.data).toEqual([{ author_id: "AUTH001", role: "author" }]);
  });

  it("RLS-03 an author cannot see another author's ticket", async () => {
    const { data } = await a.from("tickets").select("id").eq("id", ticketB);
    expect(data).toEqual([]);
  });

  // ------------------------------------------------------ author writes
  it("RLS-04 an author cannot create a ticket for another author", async () => {
    const { error } = await a.from("tickets").insert(newTicket("AUTH002", "BK003"));
    expect(error?.code).toBe("42501");
  });

  it("RLS-05 an author cannot attach another author's book", async () => {
    const { error } = await a.from("tickets").insert(newTicket("AUTH001", "BK003"));
    expect(error?.code).toBe("23503"); // composite FK: book must belong to the ticket's author
  });

  it("RLS-06 an author cannot pre-set priority, status or AI fields", async () => {
    for (const extra of [
      { priority: "critical", priority_source: "admin" },
      { status: "resolved" },
      { ai_status: "completed" },
    ]) {
      const { error } = await a.from("tickets").insert(newTicket("AUTH001", null, extra));
      expect(error?.code, JSON.stringify(extra)).toBe("42501");
    }
  });

  it("RLS-07 an author cannot update or delete their own ticket", async () => {
    const update = await a.from("tickets").update({ status: "closed" }).eq("id", ticketA).select("id");
    expect(update.data ?? []).toEqual([]);

    const remove = await a.from("tickets").delete().eq("id", ticketA);
    expect(remove.error?.code).toBe("42501");
  });

  it("RLS-08 an author cannot read internal notes, drafts or logs", async () => {
    await ops.from("internal_notes").insert({
      ticket_id: ticketA,
      admin_profile_id: (await ops.auth.getUser()).data.user!.id,
      body: "Internal: RLS test note",
    });
    for (const table of ["internal_notes", "ai_drafts", "audit_events", "ai_usage_events"]) {
      const { data } = await a.from(table).select("*");
      expect(data ?? [], table).toEqual([]);
    }
  });

  // ---------------------------------------------------------- messages
  it("thread messages: admin replies are visible only to the ticket's author", async () => {
    const adminId = (await ops.auth.getUser()).data.user!.id;
    const reply = await ops
      .from("ticket_messages")
      .insert({ ticket_id: ticketB, sender_role: "admin", sender_profile_id: adminId, body: "Reply to B" })
      .select("id")
      .single();
    expect(reply.error).toBeNull();

    const seenByA = await a.from("ticket_messages").select("id").eq("ticket_id", ticketB);
    expect(seenByA.data).toEqual([]);
    const seenByB = await b.from("ticket_messages").select("id").eq("ticket_id", ticketB);
    expect(seenByB.data?.map((row) => row.id)).toEqual([reply.data!.id]);
  });

  it("thread messages: authors can follow up on their own ticket only, and cannot pose as admin", async () => {
    const aId = (await a.auth.getUser()).data.user!.id;
    const own = await a
      .from("ticket_messages")
      .insert({ ticket_id: ticketA, sender_role: "author", sender_profile_id: aId, body: "Follow-up" });
    expect(own.error).toBeNull();

    const others = await a
      .from("ticket_messages")
      .insert({ ticket_id: ticketB, sender_role: "author", sender_profile_id: aId, body: "Intrusion" });
    expect(others.error?.code).toBe("42501");

    const impersonate = await a
      .from("ticket_messages")
      .insert({ ticket_id: ticketA, sender_role: "admin", sender_profile_id: aId, body: "Fake admin" });
    expect(impersonate.error?.code).toBe("42501");
  });

  // ------------------------------------------------------------- admin
  it("RLS-10 an admin sees every author's tickets", async () => {
    const { data } = await ops.from("tickets").select("id").in("id", [ticketA, ticketB]);
    expect(data?.map((row) => row.id).sort()).toEqual([ticketA, ticketB].sort());
  });

  it("an admin update bumps the version; ticket content stays immutable (RLS-11)", async () => {
    const before = await ops.from("tickets").select("version").eq("id", ticketA).single();
    const update = await ops
      .from("tickets")
      .update({ status: "in_progress" })
      .eq("id", ticketA)
      .select("version")
      .single();
    expect(update.error).toBeNull();
    expect(update.data!.version).toBeGreaterThan(before.data!.version);

    const tamper = await ops.from("tickets").update({ subject: "Changed by admin" }).eq("id", ticketA);
    expect(tamper.error?.message).toBe("immutable_field");
  });

  it("RLS-12 nobody but the system writer can write audit or usage logs", async () => {
    const audit = await ops.from("audit_events").insert({ ticket_id: ticketA, action: "ticket.note_added" });
    expect(audit.error?.code).toBe("42501");
    const usage = await ops
      .from("ai_usage_events")
      .insert({ task: "triage", provider: "x", model: "x", outcome: "success" });
    expect(usage.error?.code).toBe("42501");
  });

  it("catalogue is read-only even for admins", async () => {
    const { error } = await ops.from("books").update({ mrp: 1 }).eq("book_id", "BK001");
    expect(error?.code).toBe("42501");
  });

  // ------------------------------------------------------- rate limit
  it("RLS-09 the database caps ticket creation at 5 per 10 minutes per author", async () => {
    let rejected: { code?: string; message?: string } | null = null;
    for (let attempt = 0; attempt < 6 && !rejected; attempt += 1) {
      const { data: row, error } = await a
        .from("tickets")
        .insert(newTicket("AUTH001", null))
        .select("id")
        .single();
      if (error) rejected = error;
      else created.push(row.id);
    }
    expect(rejected?.message).toBe("rate_limited");
  });
});

describe.skipIf(configured)("row level security (skipped)", () => {
  it("needs SUPABASE_* keys and SEED_* passwords in backend/.env", () => {
    expect(configured).toBe(false);
  });
});
