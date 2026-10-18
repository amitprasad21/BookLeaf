// Seed the assessment dataset and demo logins. Idempotent: re-running restores
// dataset values and resets demo passwords without duplicating anything. Uses
// the server-only secret key. Never touches tickets.
//
//   npm run seed         validate the dataset and show the plan; writes NOTHING (default)
//   npm run seed:apply   write, then verify every author and book field by field
//
// Writing requires the explicit --apply flag so a lost or mistyped argument can
// never turn a check into a write.
//
// Prints counts and IDs only: never passwords, keys or personal data.
// Spec: .back/SEED_DATA.md
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { classifyValue } from "./credential-checks.js";
import {
  SeedDataSchema,
  diffRows,
  seedAccounts,
  toAuthorRows,
  toBookRows,
  type SeedAccount,
} from "./seed-data.js";

const DATASET = new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url);
const MIN_PASSWORD_LENGTH = 12;
const apply = process.argv.includes("--apply");

const data = SeedDataSchema.parse(JSON.parse(readFileSync(DATASET, "utf8")));
const authors = toAuthorRows(data);
const books = toBookRows(data);
const accounts = seedAccounts(data);
const adminCount = accounts.filter((account) => account.role === "admin").length;

console.log(`Dataset valid: ${authors.length} authors, ${books.length} books`);
console.log(
  `Plan: upsert ${authors.length} authors and ${books.length} books; ensure ${accounts.length} logins`,
);
console.log(
  `      (${accounts.length - adminCount} authors, ${adminCount} admins) with confirmed emails and profiles`,
);
if (!apply) {
  console.log("Dry run: nothing written. Use npm run seed:apply to write.");
  process.exit(0);
}

// ------------------------------------------------------------------ config
const env = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SEED_AUTHOR_PASSWORD: process.env.SEED_AUTHOR_PASSWORD,
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD,
};
const missing = Object.entries(env)
  .filter(([, value]) => classifyValue(value) !== "configured")
  .map(([name]) => name);
if (missing.length > 0) {
  console.error(`Not configured in backend/.env: ${missing.join(", ")}`);
  process.exit(1);
}
for (const name of ["SEED_AUTHOR_PASSWORD", "SEED_ADMIN_PASSWORD"] as const) {
  if (env[name]!.length < MIN_PASSWORD_LENGTH) {
    console.error(`${name} must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }
}

const db = createClient(env.SUPABASE_URL!, env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const passwordFor = (account: SeedAccount) =>
  account.role === "admin" ? env.SEED_ADMIN_PASSWORD! : env.SEED_AUTHOR_PASSWORD!;

function fail(step: string, error: { code?: string; message?: string } | null): never {
  // Supabase error messages describe the failure (e.g. a constraint name), not credentials.
  console.error(`Seed failed at ${step}: ${error?.code ?? ""} ${error?.message ?? "unknown error"}`.trim());
  process.exit(1);
}

// ---------------------------------------------------------- catalogue data
{
  const { error } = await db.from("authors").upsert(authors, { onConflict: "author_id" });
  if (error) fail("authors upsert", error);
}
{
  const { error } = await db.from("books").upsert(books, { onConflict: "book_id" });
  if (error) fail("books upsert", error);
}
console.log(`Upserted ${authors.length} authors and ${books.length} books`);

// ------------------------------------------------------------------ logins
const existing = new Map<string, string>();
for (let page = 1; ; page += 1) {
  const { data: list, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) fail("listing auth users", error);
  for (const user of list.users) if (user.email) existing.set(user.email.toLowerCase(), user.id);
  if (list.users.length < 1000) break;
}

let created = 0;
let updated = 0;
const profiles: { id: string; role: SeedAccount["role"]; author_id: string | null; display_name: string }[] =
  [];
for (const account of accounts) {
  let id = existing.get(account.email);
  if (id) {
    const { error } = await db.auth.admin.updateUserById(id, {
      password: passwordFor(account),
      email_confirm: true,
    });
    if (error) fail(`updating login ${account.authorId ?? "admin"}`, error);
    updated += 1;
  } else {
    // email_confirm marks the address as confirmed; no confirmation email is sent.
    const { data: createdUser, error } = await db.auth.admin.createUser({
      email: account.email,
      password: passwordFor(account),
      email_confirm: true,
    });
    if (error) fail(`creating login ${account.authorId ?? "admin"}`, error);
    id = createdUser.user.id;
    created += 1;
  }
  profiles.push({ id, role: account.role, author_id: account.authorId, display_name: account.displayName });
}
{
  const { error } = await db.from("profiles").upsert(profiles, { onConflict: "id" });
  if (error) fail("profiles upsert", error);
}
console.log(`Logins: ${created} created, ${updated} updated; ${profiles.length} profiles upserted`);

// ------------------------------------------------------------------ verify
const { data: dbAuthors, error: authorsError } = await db.from("authors").select("*");
if (authorsError) fail("reading back authors", authorsError);
const { data: dbBooks, error: booksError } = await db.from("books").select("*");
if (booksError) fail("reading back books", booksError);
const { data: dbProfiles, error: profilesError } = await db.from("profiles").select("id, role, author_id");
if (profilesError) fail("reading back profiles", profilesError);

const authorMismatches = diffRows(authors, dbAuthors, "author_id");
const bookMismatches = diffRows(books, dbBooks, "book_id");
const linkedAuthors = new Set(dbProfiles.filter((p) => p.role === "author").map((p) => p.author_id));
const unlinked = authors.filter((author) => !linkedAuthors.has(author.author_id)).map((a) => a.author_id);
const extraAuthors = dbAuthors.length - authors.length;
const extraBooks = dbBooks.length - books.length;

console.log("\nVerification");
console.log(
  `  authors ${authors.length - new Set(authorMismatches.map((m) => m.split(".")[0])).size}/${authors.length} match`,
);
console.log(
  `  books   ${books.length - new Set(bookMismatches.map((m) => m.split(".")[0])).size}/${books.length} match`,
);
console.log(`  author logins linked to profiles: ${authors.length - unlinked.length}/${authors.length}`);
console.log(`  admin profiles: ${dbProfiles.filter((p) => p.role === "admin").length}`);

const problems = [
  ...authorMismatches.map((m) => `author ${m} differs from the dataset`),
  ...bookMismatches.map((m) => `book ${m} differs from the dataset`),
  ...unlinked.map((id) => `${id} has no login profile`),
  ...(extraAuthors > 0 ? [`${extraAuthors} author row(s) not in the dataset`] : []),
  ...(extraBooks > 0 ? [`${extraBooks} book row(s) not in the dataset`] : []),
];
console.log(`\nResult: ${problems.length === 0 ? "OK" : `${problems.length} problem(s)`}`);
for (const problem of problems) console.log(`  - ${problem}`);
process.exitCode = problems.length === 0 ? 0 : 1;
