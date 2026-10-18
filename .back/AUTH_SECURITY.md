# Authentication, Authorization and Secrets Boundary

**Owns:** how callers are authenticated, how roles and ownership are enforced, how privileged credentials are confined, and backend hardening. RLS policies: [SUPABASE_RLS.md](SUPABASE_RLS.md). Control checklist: [.agent/SECURITY_REVIEW_CHECKLIST.md](../.agent/SECURITY_REVIEW_CHECKLIST.md).

## 1. Authentication

1. Frontends sign in with Supabase Auth (email/password). Signups are disabled; accounts are created by the seed script with confirmed emails (no emails are sent).
2. Each API request carries `Authorization: Bearer <access_token>`.
3. `authenticate` middleware ([backend/src/middleware/authenticate.ts](../backend/src/middleware/authenticate.ts)), mounted on every `/api/v1` route except `/health`. Unknown paths therefore answer 401 to anonymous callers:
   - Rejects a missing header, a non-`Bearer` scheme, anything not shaped like a JWT (three base64url segments), or a token over 4 KB → 401, without any network call.
   - Verifies the token with **`supabase.auth.getClaims(token)`** ([backend/src/auth/supabase-verifier.ts](../backend/src/auth/supabase-verifier.ts), D-022). The project signs tokens with **ES256** (asymmetric), so verification is local against the cached JWKS. Expired, tampered or forged tokens → 401. The `role` claim must be `authenticated`.
   - Creates the request-scoped Supabase client with that token ([backend/src/db/user-client.ts](../backend/src/db/user-client.ts)).
   - Loads the profile **and** author summary in one RLS-scoped query (`profiles` + embedded `authors`). No profile → 403. Supabase unreachable → 500 (generic body, details in the log).
   - Sets `req.auth` (`userId`, `role`, `displayName`, `author`) and `req.db`.
4. The token is never logged or echoed (request logs carry id, method, URL and status only).
5. Verified by `backend/test/auth.test.ts` (fake verifier, offline) and `backend/test-integration/auth.test.ts` (real tokens: tampered signature, edited payload and publishable key as bearer are all 401).

## 2. Authorization layers

| Layer | Enforces | Failure |
|---|---|---|
| Route namespace guard | `/author/*` needs `author`; `/admin/*` needs `admin` | 403 `FORBIDDEN` |
| Service ownership | Author queries always scoped by `req.auth.authorId` | 404 `NOT_FOUND` |
| Action rules | Transitions, self-assignment only, follow-ups only on open tickets | 422 |
| RLS (database) | Same ownership rules, independent of backend code | Empty result / insert rejected |
| Serializers | Author DTOs physically exclude internal fields | n/a |

## 3. What the frontend may hold

| Value | Where | Why it's acceptable |
|---|---|---|
| Supabase URL | Both frontends | Public project identifier |
| Supabase publishable key | Both frontends | Designed to be public; RLS protects data |
| User access/refresh tokens | Browser session storage (supabase-js) | Required for auth; XSS mitigations in [.front/FRONTEND_ARCHITECTURE.md](../.front/FRONTEND_ARCHITECTURE.md) §4 |
| API base URL | Both frontends | Public |

Never in frontends: the Supabase secret key, any LLM key, the database connection string.

## 4. Secrets handling

- Server secrets live only in `backend/.env` (local) and Render environment settings (deployed).
- `config/env.ts` validates presence at startup and refuses to start if required variables are missing. Error messages name the variable, never the value.
- Pino redaction covers `authorization`, `apiKey`, `api_key`, `secret`, `password`, `token`.
- Provider SDK errors are mapped to internal reason codes. Raw provider error bodies are not logged at `info` and never returned to clients.

## 5. System writer (RLS-bypassing client)

The secret key bypasses RLS, so its use is deliberately narrow.

**Allowed operations** (typed functions in `db/system-writer.ts`, nothing generic):

| Function | Purpose |
|---|---|
| `loadTicketForTriage(ticketId)` | Read one ticket's subject/description/author_id/book_id and that book's facts for background triage (no user JWT exists in a background job) |
| `saveTriageResult(ticketId, result)` | Update AI columns; set effective category/priority **only where `*_source` is null** (single conditional `update … where`) |
| `markTriageFailure(ticketId, reason, final)` | Update `ai_status`, `ai_failure_reason`, increment `ai_attempts` |
| `listTicketsForSweep()` | IDs of tickets eligible for retry |
| `appendAuditEvent(event)` | Insert into `audit_events` **(built, API-4)** |
| `appendUsageEvent(event)` | Insert into `ai_usage_events` |
| `sumTokensToday()` | Budget check |

**Guardrails:**
- Only `backend/src/ai/**` and `backend/src/modules/audit/**` may import `system-writer`, plus the bootstrap (`server.ts` creates it; `app.ts` passes it to the audit recorder). Enforced by an ESLint `no-restricted-imports` rule in `eslint.config.mjs` (API-4; a probe import from `modules/tickets` fails lint) and checked in review (SEC-2).
- Inputs are IDs and already-validated values. Never request bodies.
- The seed script uses its own secret-key client and runs only locally/manually.

## 6. Hardening

| Control | Implementation |
|---|---|
| CORS | Exact origin allowlist; no `*` |
| Headers | helmet (API); Next.js headers (frontends) |
| Body limits | 32 KB JSON |
| Rate limits | [API_IMPLEMENTATION.md](API_IMPLEMENTATION.md) §5 + DB trigger backstop |
| Errors | Envelope only; generic 500; stack traces only in server logs |
| Debug | No debug routes; `NODE_ENV=production` in deploy; Swagger UI exposes only the public contract |
| Dependencies | Minimal set; lockfile committed; `npm audit` before deploy |
| SQL | Supabase query builder / RPC with parameters only; no string-built SQL |
| CSRF | Bearer tokens in headers (no cookies), so classic CSRF doesn't apply |
