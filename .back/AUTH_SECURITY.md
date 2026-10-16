# Authentication, Authorization and Secrets Boundary

**Owns:** how callers are authenticated, how roles and ownership are enforced, how privileged credentials are confined, and backend hardening. RLS policies: [SUPABASE_RLS.md](SUPABASE_RLS.md). Control checklist: [.agent/SECURITY_REVIEW_CHECKLIST.md](../.agent/SECURITY_REVIEW_CHECKLIST.md).

## 1. Authentication

1. Frontends sign in with Supabase Auth (email/password). Signups are disabled; accounts are created by the seed script with confirmed emails (no emails are sent).
2. Each API request carries `Authorization: Bearer <access_token>`.
3. `authenticate` middleware:
   - Rejects a missing or malformed header → 401.
   - Verifies the token with Supabase. The method is decided at API-2 per current docs: local verification against the project's JWKS (preferred: no network hop) or `auth.getUser(token)`.
   - Creates the request-scoped Supabase client with that token.
   - Loads `profiles` (`role`, `author_id`, `display_name`) through that client. No profile → 403 (an auth user without a BookLeaf profile has no access).
4. The token is never logged or echoed.

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
| `appendAuditEvent(event)` | Insert into `audit_events` |
| `appendUsageEvent(event)` | Insert into `ai_usage_events` |
| `sumTokensToday()` | Budget check |

**Guardrails:**
- Only `backend/src/ai/**` and `backend/src/modules/audit/**` may import `system-writer`, enforced by an ESLint `no-restricted-imports` rule and checked in review (SEC-2).
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
