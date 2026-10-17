// Safe credential check (npm run check:env). Diagnostic tool, outside the app
// runtime. Prints variable NAMES with configured/missing and pass/fail only.
// Never prints values, lengths, prefixes beyond the key kind, or response bodies.
// See .agent/CREDENTIALS_GUIDE.md.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  classifyValue,
  isSupabaseProjectUrl,
  leakedSecretNames,
  parseEnvFile,
  supabaseKeyKind,
} from "./credential-checks.js";

const problems: string[] = [];
const line = (label: string, status: string) => console.log(`  ${label.padEnd(44, ".")} ${status}`);
const fail = (label: string, status: string, problem: string) => {
  line(label, status);
  problems.push(problem);
};

function checkPresence(name: string, value: string | undefined): boolean {
  const state = classifyValue(value);
  if (state === "configured") {
    line(name, "configured");
    return true;
  }
  fail(name, state, `${name} is ${state}`);
  return false;
}

// ---------------------------------------------------------------- backend
console.log("\nBackend (backend/.env, server-only)");
const url = process.env.SUPABASE_URL;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

const hasUrl = checkPresence("SUPABASE_URL", url);
if (hasUrl && !isSupabaseProjectUrl(url!)) {
  fail("  format", "unexpected", "SUPABASE_URL should look like https://<project-ref>.supabase.co");
}
const hasPublishable = checkPresence("SUPABASE_PUBLISHABLE_KEY", publishable);
if (hasPublishable) {
  const kind = supabaseKeyKind(publishable!);
  if (kind === "secret") {
    fail("  key kind", "SECRET KEY", "SUPABASE_PUBLISHABLE_KEY holds a secret key");
  } else {
    line("  key kind", kind);
  }
}
const hasSecret = checkPresence("SUPABASE_SECRET_KEY", secret);
if (hasSecret) {
  const kind = supabaseKeyKind(secret!);
  if (kind === "publishable") {
    fail("  key kind", "publishable", "SUPABASE_SECRET_KEY holds a publishable key");
  } else {
    line("  key kind", kind);
  }
}
if (hasPublishable && hasSecret && publishable === secret) {
  fail("publishable != secret", "SAME VALUE", "publishable and secret keys are identical");
}

// --------------------------------------------------------------- frontends
for (const app of ["author-frontend", "admin-frontend"] as const) {
  const path = fileURLToPath(new URL(`../../${app}/.env.local`, import.meta.url));
  console.log(`\n${app} (${app}/.env.local, browser-exposed)`);
  if (!existsSync(path)) {
    fail(".env.local", "missing", `${app}/.env.local is missing`);
    continue;
  }
  const env = parseEnvFile(readFileSync(path, "utf8"));
  if (checkPresence("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL) && hasUrl) {
    if (env.NEXT_PUBLIC_SUPABASE_URL === url) line("  matches backend SUPABASE_URL", "yes");
    else fail("  matches backend SUPABASE_URL", "NO", `${app} Supabase URL differs from backend`);
  }
  if (
    checkPresence("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) &&
    hasPublishable
  ) {
    if (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === publishable)
      line("  matches backend publishable", "yes");
    else fail("  matches backend publishable", "NO", `${app} publishable key differs from backend`);
  }
  checkPresence("NEXT_PUBLIC_API_BASE_URL", env.NEXT_PUBLIC_API_BASE_URL);
  const leaked = leakedSecretNames(env, secret);
  if (leaked.length === 0) line("no server secrets in this file", "ok");
  else
    fail(
      "no server secrets in this file",
      "LEAK",
      `${app}/.env.local holds a server secret in: ${leaked.join(", ")}`,
    );
}

// ------------------------------------------------------------- connections
console.log("\nConnections (pass/fail only)");
if (hasUrl && hasPublishable) {
  try {
    const res = await fetch(new URL("/auth/v1/settings", url), { headers: { apikey: publishable! } });
    if (res.ok) {
      line("project reachable with publishable key", "pass");
      const settings = (await res.json()) as { disable_signup?: boolean };
      if (settings.disable_signup === true) line("new user sign-ups disabled", "yes");
      else fail("new user sign-ups disabled", "NO", "turn off 'Allow new users to sign up' in Auth settings");
    } else {
      fail("project reachable with publishable key", `fail (HTTP ${res.status})`, "publishable key rejected");
    }
  } catch {
    fail("project reachable with publishable key", "fail (network)", "could not reach SUPABASE_URL");
  }
} else {
  line("project reachable with publishable key", "skipped");
}

if (hasUrl && hasSecret) {
  try {
    const admin = createClient(url!, secret!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) fail("secret key accepted (read-only admin call)", "fail", "secret key rejected");
    else line("secret key accepted (read-only admin call)", "pass");
  } catch {
    fail("secret key accepted (read-only admin call)", "fail (network)", "could not reach SUPABASE_URL");
  }
} else {
  line("secret key accepted (read-only admin call)", "skipped");
}

// ------------------------------------------------------------------ result
console.log(`\nResult: ${problems.length === 0 ? "OK" : `${problems.length} problem(s)`}`);
for (const problem of problems) console.log(`  - ${problem}`);
process.exitCode = problems.length === 0 ? 0 : 1;
