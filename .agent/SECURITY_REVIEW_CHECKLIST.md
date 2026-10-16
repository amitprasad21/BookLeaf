# Security Review Checklist

**Owns:** the security control baseline (the 18 controls from the security screenshot, as listed in the blueprint) and review findings. Threats and reasoning: [THREAT_MODEL.md](THREAT_MODEL.md).

**An item is not done because it is written here.** Status changes to `verified` only with evidence (test name, command output or reviewed diff) recorded in [verification/](verification/README.md).

## Controls

| # | Control | Applicability | BookLeaf implementation plan | Evidence | Status |
|---|---|---|---|---|---|
| 1 | Row Level Security | Required | RLS enabled on every application table; policies per [.back/SUPABASE_RLS.md](../.back/SUPABASE_RLS.md); tested with author A, author B, admin | DB-3 tests | not run |
| 2 | Auth on every API route | Required | Global auth middleware; explicit public allowlist (`/health`, docs); route inventory test | SEC-1 | not run |
| 3 | Never trust the frontend | Required | Identity/role from token + DB; strict zod schemas; ownership in every query; transitions validated server-side | SEC-1 | not run |
| 4 | Rate limiting | Required | Ticket creation, draft, triage per user; Supabase Auth limits for login | SEC-1 | not run |
| 5 | Sanitize/validate input | Required | zod (length, enums, unknown keys rejected); plain-text rendering; ticket text delimited as untrusted prompt data | SEC-1, AI-6 | not run |
| 6 | Parameterized queries | Required | Supabase client query builder only; no string-built SQL; any SQL function reviewed | SEC-2 review | not run |
| 7 | Locked-down CORS | Required (deploy) | Allowlist from `CORS_ALLOWED_ORIGINS`; no wildcard; no credentials mode needed (bearer tokens) | SEC-2 preflight test | not run |
| 8 | HTTPS everywhere | Required (deploy) | Vercel/Render/Supabase HTTPS endpoints; HSTS via helmet | DEP-3 | not run |
| 9 | Stop IDOR bugs | Required | Not-owned → 404; composite FK for ticket→book ownership; UUIDs | SEC-1 | not run |
| 10 | Debug mode off in production | Required (deploy) | `NODE_ENV=production`; generic 500s; no provider error bodies; Swagger UI allowed (no secrets) | SEC-1 forced-error test | not run |
| 11 | CAPTCHA on public forms | Conditional: **N/A** | No public/unauthenticated forms (signups disabled; login protected by Supabase Auth rate limits). Revisit if a public form is added | n/a | n/a |
| 12 | Log admin actions | Recommended | `audit_events` for status, overrides, assignment, replies, notes, draft regeneration; old/new values only, no bodies | API-6 tests | not run |
| 13 | Private storage buckets | Conditional | Only if X-1 (real uploads) is built: private bucket, type/size limits, short-lived signed URLs, owner checks | X-1 | n/a until built |
| 14 | Hide admin pages properly | Required | Admin UI is a separate app; backend enforces `role=admin` on `/admin/*` regardless | SEC-1 | not run |
| 15 | Update vulnerable packages | Required (pre-demo) | Minimal deps; lockfile committed; `npm audit` reviewed | SEC-2 | not run |
| 16 | Claude security review | Required workflow | Run a focused security review on the actual diff before deploy; findings reviewed by a human and recorded below | SEC-2 | not run |
| 17 | Security headers | Required | helmet on API; Next.js headers config on frontends (CSP compatible with Supabase auth endpoints) | SEC-2 | not run |
| 18 | Verify webhook signatures | Conditional: **N/A** | No webhooks in scope. If added: signature, timestamp/replay, idempotency | n/a | n/a |

## Review scenarios (from the blueprint)

| # | Scenario | Expected result | Status |
|---|---|---|---|
| R-01 | Anonymous user calls an admin API route | 401 | not run |
| R-02 | Author A substitutes Author B's ticket/book ID in path, query or body | 404 / 400, no data | not run |
| R-03 | Author requests internal notes or admin-only fields | Not present in any author response; `/admin/*` → 403 | not run |
| R-04 | Author spams ticket creation or an admin spams draft regeneration | 429 after limit; budget unaffected beyond caps | not run |
| R-05 | Ticket prompt-injects for secrets or other authors' data | Normal triage; draft contains nothing outside the author's own facts | not run |
| R-06 | Malformed model output sets an invalid category/priority | Rejected; ticket → manual review | not run |
| R-07 | RLS misconfigured or secret key used outside the system writer | RLS tests fail loudly; grep check for the key's import sites | not run |
| R-08 | Private attachment URL reused after expiry | n/a unless X-1 | n/a |
| R-09 | Provider key missing, invalid, over quota or logged | Manual mode; config error logged without the key | not run |
| R-10 | Production returns a stack trace or accepts an unapproved origin | Neither happens | not run |

## Findings log

| Date | Finding | Severity | Evidence | Owner | Remediation | Retest |
|---|---|---|---|---|---|---|
| (none yet) | | | | | | |
