# Security Review Checklist

**Owns:** the security control baseline (the 18 controls from the security screenshot, as listed in the blueprint) and review findings. Threats and reasoning: [THREAT_MODEL.md](THREAT_MODEL.md).

**An item is not done because it is written here.** Status changes to `verified` only with evidence (test name, command output or reviewed diff) recorded in [verification/](verification/README.md).

## Controls

| # | Control | Applicability | BookLeaf implementation plan | Evidence | Status |
|---|---|---|---|---|---|
| 1 | Row Level Security | Required | RLS enabled on every application table; policies per [.back/SUPABASE_RLS.md](../.back/SUPABASE_RLS.md); tested with author A, author B, admin | `npm run test:rls` 15/15 + `check:db` access probes ([verification](verification/2026-10-18-db3-db4.md)) | verified (database layer) |
| 2 | Auth on every API route | Required | Global auth middleware; explicit public allowlist (`/health`, docs); route inventory test | `authenticate` on all of `/api/v1` except health; `auth.test.ts` (no token → 401 even on unknown paths; malformed/forged/tampered/expired → 401); live `test-integration/auth.test.ts` with real tokens (API-2) | verified (API-2 routes) |
| 3 | Never trust the frontend | Required | Identity/role from token + DB; strict zod schemas; ownership in every query; transitions validated server-side | Identity from verified token + `profiles` only; query `?role=admin` ignored (test). API-4: strict ticket schemas reject `authorId`, `status`, `priority` (`tickets.test.ts`); every author query filters by the caller's author id. API-6: status transitions, assignment rules and the version are checked server-side; PATCH accepts only status/category/priority/assignee (content fields → 400, and the DB trigger freezes content) (`admin-ticket.test.ts`, live `test-integration/admin-ticket.test.ts`) | verified (API routes so far) |
| 4 | Rate limiting | Required | Ticket creation, draft, triage per user; Supabase Auth limits for login | Ticket creation: 5 / 10 min per author → 429 with `Retry-After`, failed requests not counted (`tickets.test.ts`); DB trigger backstop live (RLS-09). Draft/triage: AI-4/AI-5 | partially verified |
| 5 | Sanitize/validate input | Required | zod (length, enums, unknown keys rejected); plain-text rendering; ticket text delimited as untrusted prompt data | Ticket create/list/detail: lengths, trimming, attachment type, status/paging enums, UUID ids, unknown keys (`tickets.test.ts`). Admin queue: every filter validated, search text normalised to letters/digits/space/`- ' . & / #` (`admin-queue.test.ts`). Rendering: FE-A3/A4; prompts: AI-6 | partially verified |
| 6 | Parameterized queries | Required | Supabase client query builder only; no string-built SQL; any SQL function reviewed | Queue `or` filters are built only from validated enums, ISO timestamps, author ids and normalised search text, which is also quoted; the exact filters are asserted in `admin-queue.test.ts`. Full review: SEC-2 | partially verified |
| 7 | Locked-down CORS | Required (deploy) | Allowlist from `CORS_ALLOWED_ORIGINS`; no wildcard; no credentials mode needed (bearer tokens); production refuses to start without an explicit allowlist | `backend/test/cors.test.ts`, `env.test.ts` (API-1); deployed-origin check pending (SEC-2) | verified locally |
| 8 | HTTPS everywhere | Required (deploy) | Vercel/Render/Supabase HTTPS endpoints; HSTS via helmet | DEP-3 | not run |
| 9 | Stop IDOR bugs | Required | Not-owned → 404; composite FK for ticket→book ownership; UUIDs | Database layer: RLS-03/04/05 pass (live). API layer: `/author/books` filters by the caller's author id even when the data source returns all 18 books (`books.test.ts`), and live authors see disjoint book sets. Author tickets (API-4): another author's ticket → 404 and absent from lists; another author's `bookId` → the same 400 as an unknown book, nothing stored (offline + live `test-integration/tickets.test.ts`). Messages and admin endpoints: API-5+ | partially verified |
| 10 | Debug mode off in production | Required (deploy) | `NODE_ENV=production`; generic 500s; no provider error bodies; Swagger UI allowed (no secrets) | `backend/test/errors.test.ts`: unexpected error → generic 500, no message/stack leak (API-1); production-mode check pending (SEC-1) | verified locally |
| 11 | CAPTCHA on public forms | Conditional: **N/A** | No public/unauthenticated forms (signups disabled; login protected by Supabase Auth rate limits). Revisit if a public form is added | n/a | n/a |
| 12 | Log admin actions | Recommended | `audit_events` for status, overrides, assignment, replies, notes, draft regeneration; old/new values only, no bodies | Pipeline built: `ticket.created` written by the system writer with `{ bookId }` only, live-checked (API-4). API-6: status changes, category/priority overrides (old/new + old source) and (un)assignment are audited with the acting admin, in order, live-checked. Replies, notes, drafts: API-7/AI-4 | partially verified |
| 13 | Private storage buckets | Conditional | Only if X-1 (real uploads) is built: private bucket, type/size limits, short-lived signed URLs, owner checks | X-1 | n/a until built |
| 14 | Hide admin pages properly | Required | Admin UI is a separate app; backend enforces `role=admin` on `/admin/*` regardless | `requireRole` guards; author → `/admin/*` 403 and admin → `/author/*` 403 (offline + live with real tokens) | verified (backend) |
| 15 | Update vulnerable packages | Required (pre-demo) | Minimal deps; lockfile committed; `npm audit` reviewed | SEC-2 | not run |
| 16 | Claude security review | Required workflow | Run a focused security review on the actual diff before deploy; findings reviewed by a human and recorded below | SEC-2 | not run |
| 17 | Security headers | Required | helmet on API; Next.js headers config on frontends (CSP compatible with Supabase auth endpoints) | API: `health.test.ts` + live header capture (API-1); frontends: baseline headers live-checked (SETUP-2), CSP pending (FE-A1/FE-M1) | partially verified |
| 18 | Verify webhook signatures | Conditional: **N/A** | No webhooks in scope. If added: signature, timestamp/replay, idempotency | n/a | n/a |

## Review scenarios (from the blueprint)

| # | Scenario | Expected result | Status |
|---|---|---|---|
| R-01 | Anonymous user calls an admin API route | 401 | partially run: `GET /admin/tickets/summary` with no token → 401 (live smoke, API-5); offline `auth.test.ts` covers `/admin/tickets` |
| R-02 | Author A substitutes Author B's ticket/book ID in path, query or body | 404 / 400, no data | partially run: author ticket detail and create pass offline + live (API-4); messages pending |
| R-03 | Author requests internal notes or admin-only fields | Not present in any author response; `/admin/*` → 403 | partially run: author ticket DTO keys equal `openapi.yaml` exactly, no priority/category/AI/assignee/note fields (API-4) |
| R-04 | Author spams ticket creation or an admin spams draft regeneration | 429 after limit; budget unaffected beyond caps | partially run: ticket creation → 429 on the 6th in 10 min (offline, API-4); drafts pending |
| R-05 | Ticket prompt-injects for secrets or other authors' data | Normal triage; draft contains nothing outside the author's own facts | not run |
| R-06 | Malformed model output sets an invalid category/priority | Rejected; ticket → manual review | not run |
| R-07 | RLS misconfigured or secret key used outside the system writer | RLS tests fail loudly; grep check for the key's import sites | partially run: ESLint rule blocks `db/system-writer` imports outside the allowlist (probe, API-4); SEC-2 grep pending |
| R-08 | Private attachment URL reused after expiry | n/a unless X-1 | n/a |
| R-09 | Provider key missing, invalid, over quota or logged | Manual mode; config error logged without the key | not run |
| R-10 | Production returns a stack trace or accepts an unapproved origin | Neither happens | not run |

## Findings log

| Date | Finding | Severity | Evidence | Owner | Remediation | Retest |
|---|---|---|---|---|---|---|
| 2026-10-17 | `npm run seed -- --dry-run` from the root lost the flag (npm consumed it) and the seed took its **write** path; it stopped only at the missing-password check | Medium (accidental writes to the hosted DB) | Dry-run output showed the config check instead of "Dry run" | Claude Code | Seed is dry-run by default; writing needs the separate `seed:apply` script (`--apply`) | Stray flags stay dry-run; `seed:apply` refuses without passwords; `check:db` showed 0 rows: PASS |
| 2026-10-18 | DB-3 reported "Success" twice but wasn't live: once not persisted, once applied to a second Supabase project | Medium (the RLS policies everyone relied on were missing) | `test:rls` setup failure; `check:db` access probes; fingerprint query showed `0 · 0` | Claude Code + user | `check:db` now signs in and asserts that policies and grants are live; migration log documents a fingerprint query to run before and after each migration | Re-applied in the right project: `check:db` OK, `test:rls` 15/15 |
| 2026-10-18 | The request log recorded queue search text in the URL (`q=<author name>`), personal data the minimise-logging rule excludes | Low | Live server log during the API-5 smoke test | Claude Code | The logged URL redacts the `q` value (`q=redacted`) | `logging.test.ts`; live log re-checked: no author name, `q=redacted`: PASS |
| 2026-10-16 | Default pino-http request logs recorded every request header, client IP and user agent (auth headers were redacted, but this is more personal data than the minimise-logging rule allows) | Low | Live server log during API-1 smoke test | Claude Code | Custom serializers: log only id, method, URL, status, timing | `logging.test.ts` asserts the exact `req`/`res` shape; live log re-checked: PASS |
