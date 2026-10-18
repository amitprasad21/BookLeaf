// Read-only schema check (npm run check:db). Diagnostic tool, outside the app
// runtime. Confirms the migrated tables exist, that client roles are locked
// out, and that a key constraint is enforced. Prints table names, row counts
// and pass/fail only: never row data, keys or connection details.
import { createClient } from "@supabase/supabase-js";
import { classifyValue } from "./credential-checks.js";

const TABLES = [
  "authors",
  "books",
  "profiles",
  "tickets",
  "ai_drafts",
  "ticket_messages",
  "internal_notes",
  "audit_events",
  "ai_usage_events",
] as const;

const problems: string[] = [];
const line = (label: string, status: string) => console.log(`  ${label.padEnd(44, ".")} ${status}`);

const url = process.env.SUPABASE_URL;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
for (const [name, value] of [
  ["SUPABASE_URL", url],
  ["SUPABASE_PUBLISHABLE_KEY", publishable],
  ["SUPABASE_SECRET_KEY", secret],
] as const) {
  if (classifyValue(value) !== "configured") {
    console.log(`${name} is not configured; run npm run check:env first.`);
    process.exit(1);
  }
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const system = createClient(url!, secret!, noSession);
const anon = createClient(url!, publishable!, noSession);

// ------------------------------------------------------------------ tables
console.log("\nTables (secret key, counts only)");
for (const table of TABLES) {
  const { count, error } = await system.from(table).select("*", { count: "exact", head: true });
  if (error) {
    line(table, `MISSING or unreadable (${error.code ?? "error"})`);
    problems.push(`table ${table} not available`);
  } else {
    line(table, `exists, ${count ?? 0} row(s)`);
  }
}

// ---------------------------------------------------------------- lockdown
console.log("\nClient lockdown (publishable key, no user session)");
for (const table of ["authors", "tickets", "internal_notes"] as const) {
  const { data, error } = await anon.from(table).select("*").limit(1);
  if (error?.code === "42501") {
    line(`anon read ${table}`, "denied (permission)");
  } else if (!error && Array.isArray(data) && data.length === 0) {
    line(`anon read ${table}`, "empty (RLS) but grant present");
    problems.push(`anon still has a grant on ${table}`);
  } else if (error) {
    line(`anon read ${table}`, `error (${error.code ?? "unknown"})`);
    problems.push(`unexpected error reading ${table} as anon`);
  } else {
    line(`anon read ${table}`, "ROWS VISIBLE");
    problems.push(`anon can read ${table}`);
  }
}

// ------------------------------------------------------- constraint probe
// Insert a book whose royalties don't balance, for an author that doesn't
// exist. CHECK constraints run before foreign keys, so a present constraint
// rejects it with 23514; a missing one falls through to the FK (23503).
// Either way nothing is written.
console.log("\nConstraint probe (insert designed to fail; writes nothing)");
const { error: probeError } = await system.from("books").insert({
  book_id: "PROBE-CHECK-DB",
  author_id: "AUTH999",
  title: "probe",
  isbn: "probe-check-db",
  genre: "probe",
  status: "Published & Live",
  total_royalty_earned: 100,
  royalty_paid: 10,
  royalty_pending: 10,
});
if (probeError?.code === "23514") {
  line("royalty balance check", "enforced");
} else if (probeError?.code === "23503") {
  line("royalty balance check", "MISSING (FK caught it)");
  problems.push("books_royalty_balance_check is missing");
} else if (probeError) {
  line("royalty balance check", `unexpected error (${probeError.code ?? "unknown"})`);
  problems.push("constraint probe failed unexpectedly");
} else {
  line("royalty balance check", "ROW WAS INSERTED");
  problems.push("probe row was inserted: delete book_id PROBE-CHECK-DB");
}

// --------------------------------------------------- queue rank (API-5)
// The admin queue sorts on the generated tickets.urgency_rank column.
console.log("\nQueue urgency rank (API-5)");
const rank = await system.from("tickets").select("urgency_rank", { count: "exact", head: true });
if (rank.error) {
  line("tickets.urgency_rank", `MISSING (${rank.error.code ?? "error"})`);
  problems.push("apply supabase/migrations/20261018090000_queue_urgency_rank.sql");
} else {
  line("tickets.urgency_rank", "present");
}

// ---------------------------------------------------- access rules (DB-3)
// Only once seeded: sign in as the first dataset author (publishable key) and
// confirm the DB-3 policies and grants are live. Changes nothing: the probe
// update targets the author's own book and is refused by grants or matches 0 rows.
console.log("\nAccess rules (signed in as a seeded author)");
const authorPassword = process.env.SEED_AUTHOR_PASSWORD;
const { data: firstProfile } = await system
  .from("profiles")
  .select("author_id")
  .eq("role", "author")
  .order("author_id")
  .limit(1)
  .maybeSingle();
if (!firstProfile || classifyValue(authorPassword) !== "configured") {
  line("policies active", "skipped (not seeded yet)");
} else {
  const { data: authorRow } = await system
    .from("authors")
    .select("email")
    .eq("author_id", firstProfile.author_id)
    .single();
  const author = createClient(url!, publishable!, noSession);
  const signIn = await author.auth.signInWithPassword({ email: authorRow!.email, password: authorPassword! });
  if (signIn.error) {
    line("seeded author can sign in", `NO (${signIn.error.code ?? "error"})`);
    problems.push("seeded author cannot sign in: re-run npm run seed:apply");
  } else {
    line("seeded author can sign in", "yes");
    const own = await author.from("profiles").select("author_id");
    if (own.data?.length === 1 && own.data[0]?.author_id === firstProfile.author_id) {
      line("author sees own profile (policies active)", "yes");
    } else {
      line("author sees own profile (policies active)", "NO");
      problems.push("RLS policies are not active: apply supabase/migrations/20261017120000_rls_policies.sql");
    }
    const edit = await author
      .from("books")
      .update({ genre: "probe" })
      .eq("author_id", firstProfile.author_id);
    if (edit.error?.code === "42501") {
      line("catalogue edit refused (grants applied)", "yes");
    } else {
      line("catalogue edit refused (grants applied)", "NO");
      problems.push(
        "DB-3 grant changes are not active: apply supabase/migrations/20261017120000_rls_policies.sql",
      );
    }
  }
}

console.log(`\nResult: ${problems.length === 0 ? "OK" : `${problems.length} problem(s)`}`);
for (const problem of problems) console.log(`  - ${problem}`);
process.exitCode = problems.length === 0 ? 0 : 1;
