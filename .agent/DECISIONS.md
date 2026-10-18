# Decisions

**Owns:** material decisions: context, choice, rationale, cost and when to revisit. Options that lost are in [ALTERNATIVES.md](ALTERNATIVES.md).
**Status values:** `accepted` · `proposed` (awaiting user confirmation) · `superseded`.

| ID | Decision | Status | Date |
|---|---|---|---|
| D-001 | Two frontend apps + one backend in an npm-workspaces monorepo | accepted | 2026-10-16 |
| D-002 | Supabase Postgres + Supabase Auth | accepted | 2026-10-16 |
| D-003 | Backend: Express 5 + TypeScript + zod | proposed | 2026-10-16 |
| D-004 | Frontends: Next.js (App Router) + TanStack Query; shared `packages/shared` and `packages/ui` | proposed | 2026-10-16 |
| D-005 | User-scoped DB access (RLS enforced) + narrow system writer | proposed | 2026-10-16 |
| D-006 | Real-time via SSE (fetch streaming) with polling fallback | proposed | 2026-10-16 |
| D-007 | Save-first, asynchronous in-process AI triage with startup sweeper | proposed | 2026-10-16 |
| D-008 | One combined triage call (category + priority) | proposed | 2026-10-16 |
| D-009 | Deterministic facts builder + category-based KB sectioning | proposed | 2026-10-16 |
| D-010 | Primary LLM: Anthropic Claude Haiku 5.5 | proposed | 2026-10-16 |
| D-011 | API namespaces `/author/*` and `/admin/*` with separate serializers | proposed | 2026-10-16 |
| D-012 | Not-owned resources return 404 | proposed | 2026-10-16 |
| D-013 | Optimistic locking via `version` on admin ticket updates | proposed | 2026-10-16 |
| D-014 | Provisional monochrome design tokens | proposed | 2026-10-16 |
| D-015 | Attachments are UI-only (filename metadata) unless stretch X-1 is done | proposed | 2026-10-16 |
| D-016 | Full blueprint documentation tree | accepted | 2026-10-16 |
| D-017 | Hosting: Vercel ×2 + Render + Supabase cloud | proposed | 2026-10-16 |
| D-018 | Dependency policy: exact pins, newest stable ≥ 14 days old; TypeScript 6.0.3; npm ≥ 11 | accepted | 2026-10-16 |
| D-019 | Tooling: ESLint 9 flat config (Next rules scoped to React workspaces), Prettier for code only, Redocly OpenAPI lint, `prepare` builds shared packages | accepted | 2026-10-16 |
| D-020 | Supabase: new publishable/secret API keys (not legacy anon/service_role); self sign-up off, accounts from seed only | accepted | 2026-10-17 |
| D-021 | Migrations applied by the user via the dashboard SQL Editor; repo files are canonical; manual migration log in `.back/DATA_MODEL.md` | accepted | 2026-10-17 |
| D-022 | Token verification via `supabase.auth.getClaims()` (ES256/JWKS, local); profile + author loaded per request through the caller's RLS client | accepted | 2026-10-18 |
| D-023 | Payout calendar in `packages/shared`; ₹1,000 threshold on the author's total pending; `nextPayoutDueBy` = earliest deadline not yet passed | accepted | 2026-10-18 |
| D-024 | Author ticket API: zod parse in handlers (no `validate` middleware), same 400 for unknown and not-owned books, per-user limits + DB backstop, audit via the system writer | accepted | 2026-10-18 |
| D-025 | Admin queue: urgency as a generated `urgency_rank` column (sorted and paged in the database); SLA rules in `packages/shared`; overdue = unresolved, unanswered, past target; `overdue=true` filter; normalised search; search text redacted from logs | accepted | 2026-10-18 |

---

### D-001: Two frontend apps + one backend (monorepo)
- **Context:** The assignment requires author-facing and admin-facing interfaces. The blueprint mandates two distinct experiences and exactly one backend, and allows either two apps or one app with route groups. The user asked to follow the blueprint's full structure.
- **Choice:** `author-frontend/` and `admin-frontend/` as separate Next.js apps, `backend/` as the single API, all in npm workspaces.
- **Rationale:** Admin code and routes are never shipped to authors. Each portal deploys and fails independently. The separation is obvious to reviewers. Shared packages remove duplication.
- **Cost:** Two deploy targets and some duplicated app boilerplate.
- **Revisit if:** Deployment time becomes the bottleneck. Collapsing into one app with route groups is mechanical because both share `packages/*`.

### D-002: Supabase Postgres + Auth
- **Context:** Blueprint project decision.
- **Choice:** Supabase cloud project for Postgres, Auth (email/password, signups disabled) and RLS.
- **Rationale:** Managed Postgres with built-in auth and row-level security gives a second authorization layer without running our own auth.
- **Revisit if:** Free-tier limits block the demo.

### D-003: Express 5 + TypeScript + zod
- **Choice:** Express 5 (native async error propagation), zod for validation shared with frontends, pino logging, helmet, express-rate-limit.
- **Rationale:** Explicit, linear middleware order that can be explained line by line in the review. zod schemas are reused for request validation, frontend forms and AI output validation.
- **Alternatives:** Fastify, NestJS, Next.js route handlers ([ALTERNATIVES.md](ALTERNATIVES.md)).

### D-004: Next.js + TanStack Query, shared packages
- **Choice:** Next.js App Router (client-side data fetching against the backend), TanStack Query for caching and invalidation, `packages/shared` (enums, labels, schemas, DTO types), `packages/ui` (tokens + primitives).
- **Rationale:** Vercel-native deploys. Query invalidation pairs naturally with SSE events. One contract package keeps the frontends honest.

### D-005: User-scoped DB access + narrow system writer
- **Choice:** The backend forwards the caller's JWT to Supabase for all user-initiated queries, so RLS applies. A single `system-writer` module holds the secret key, for AI result writes and append-only audit/usage logs.
- **Rationale:** Defense in depth. A missed ownership check in a service is still blocked by RLS. The RLS-bypassing surface is small and reviewable.
- **Cost:** RLS policies must be correct for admins too; per-request client creation.
- **Revisit if:** Performance requires a pooled direct connection (would need explicit authorization checks everywhere).

### D-006: SSE with polling fallback
- **Choice:** `GET /events` read via `fetch` streaming with the bearer header; events carry IDs only; clients refetch via REST; poll every 15 s when disconnected.
- **Rationale:** Updates are one-directional (server → client). SSE is simpler than WebSockets, and refetching through REST keeps authorization in one place.
- **Cost:** The in-process event hub supports one backend instance.
- **Revisit if:** Scaling out (move to Postgres LISTEN/NOTIFY or Supabase Realtime broadcast).

### D-007: Save-first async triage
- **Choice:** Insert the ticket, respond 201, then run triage in an in-process queue (concurrency 2). A startup sweeper re-queues `pending`/`failed` tickets older than 2 minutes (max 2 automatic retries).
- **Rationale:** Ticket creation never waits on or fails because of the AI provider (assignment requirement D.3).
- **Cost:** Work in flight is lost on crash and recovered by the sweeper; not a durable queue.
- **Revisit if:** Volume grows: use a durable queue (pg-boss / Supabase Queues), task X-4.

### D-008: One combined triage call
- **Choice:** One structured call returns category, priority, confidence, signals and rationale.
- **Rationale:** Half the calls and tokens of two classifiers, and priority can reason from the category. Assignment D.4 rewards this.

### D-009: Deterministic facts + KB sectioning
- **Choice:** Code computes dates, payout windows, thresholds and production stage. The KB is split into sections selected by category.
- **Rationale:** LLMs are unreliable at date arithmetic. Sectioning sends only the relevant ~20–40% of the KB. Both are unit-testable.

### D-010: Primary LLM, Claude Haiku 5.5 (proposed)
- **Context:** The assignment suggests gpt-4o-mini or Claude Haiku for cost; the blueprint says to choose the provider just in time.
- **Proposal:** `claude-haiku-5-5` for both tasks, structured outputs, prompt caching. Sonnet 5.5 for drafts only if the eval shows Haiku drafts need heavy edits.
- **Rationale:** Lowest cost tier with schema-constrained JSON. One model keeps one cache and one eval baseline. Details: [AI_SPEC.md](../AI_SPEC.md) section 2.
- **Pending:** User confirmation at AI-1 (Q-04). Record eval results here when available.

### D-011: Separate author/admin namespaces and serializers
- **Rationale:** The authorization surface is explicit per path. Author DTOs physically cannot include internal fields (C-08).

### D-012: 404 for not-owned resources
- **Rationale:** Doesn't confirm that another author's ticket ID exists (prevents enumeration).

### D-013: Optimistic locking
- **Rationale:** Two admins acting on one ticket must not silently overwrite each other; 409 + reload is cheap and clear.

### D-014: Provisional monochrome tokens
- **Context:** The canonical UI specification was not provided (S-07).
- **Choice:** Dark monochrome token set in [.front/DESIGN_SYSTEM.md](../.front/DESIGN_SYSTEM.md), following the rules the blueprint quotes.
- **Revisit when:** The specification arrives. Replace values only; component APIs stay.

### D-015: UI-only attachments
- **Rationale:** The assignment marks upload as bonus. The control validates type/size and records the filename, and the UI says uploads aren't enabled. Real upload (private bucket, signed URLs) is X-1.

### D-016: Full blueprint documentation tree
- **Context:** A lean doc set was offered; the user chose the blueprint's full tree on 2026-10-16.
- **Consequence:** About 60 documents. Keep each focused and link to owners to avoid duplication.

### D-017: Hosting (proposed)
- **Choice:** Two Vercel projects (frontends), one Render web service (backend), Supabase cloud.
- **Rationale:** Free tiers, Git-based deploys, simple env management.
- **Known cost:** Render's free tier sleeps when idle, so the first request after idle is slow. Documented in the README.

### D-018: Dependency version policy
- **Context:** SETUP-2 installs. Several latest releases were only 1–7 days old (e.g. next 16.4.2, supabase-js 2.118.0). Compromised npm releases are usually caught within days.
- **Choice:** Pin exact versions (`.npmrc save-exact=true`, lockfile committed), choosing the newest stable release published at least 14 days before install. **TypeScript 6.0.3**, not 7.x: 7.x is the new native compiler, and staying on 6.x avoids betting on Next.js tooling compatibility during a 4-day build. Requires **npm ≥ 11** (npm 10.2.x crashes on this workspace).
- **Approved by:** user, 2026-10-16 (exact list in [skills-and-tools.md](skills-and-tools.md)).
- **Revisit:** Before deploy (`npm audit`); when a security advisory affects a pinned version; TypeScript 7 after the build is stable.
- **Confirmed at SETUP-3:** typescript-eslint 8.71 supports TypeScript `< 6.1`, so TypeScript 7 would not have worked with linting either.

### D-019: Lint, format and contract tooling
- **Choice:** One root `eslint.config.mjs` (ESLint 9 flat config): `@eslint/js` + typescript-eslint everywhere; `eslint-config-next` (core-web-vitals + typescript) applied only to `author-frontend`, `admin-frontend` and `packages/ui`, plus `react/no-danger: error` (T-17). Prettier formats code and JSON/YAML/CSS only. Docs, `openapi.yaml`, the lockfile and the seed data are excluded. Redocly CLI lints `openapi.yaml` with the `recommended` ruleset. `info-license` is off (no license chosen), and two per-location exceptions with reasons are in `.redocly.lint-ignore.yaml`. A root `prepare` script builds `packages/shared` and `packages/ui` on every install, so fresh clones and hosting builds typecheck.
- **ESLint 9, not 10:** `eslint-plugin-react` (inside `eslint-config-next`) supports ESLint `≤ ^9.7`. npm marks 9.39.5 as no longer supported. Accepted because ESLint is a dev-only tool that never ships to users.
- **Approved by:** user, 2026-10-16.
- **Revisit:** When `eslint-config-next` supports ESLint 10; add type-aware lint rules once real code exists.

### D-020: Supabase keys and account provisioning
- **Context:** DB-1. Official Supabase docs (checked 2026-10-17) describe publishable (`sb_publishable_…`, browser-safe) and secret (`sb_secret_…`, backend-only, bypasses RLS) keys under **Settings → API Keys**. Legacy `anon`/`service_role` JWT keys are deprecated, with removal planned by the end of 2026. The user re-confirmed that self sign-up is not wanted.
- **Choice:** Use the new publishable/secret keys (variable names unchanged from `.env.example`). "Allow new users to sign up" is **off**; the 10 dataset authors and 2 admins are created by the seed script through the server-side admin API (DB-4).
- **Evidence:** `npm run check:env` confirms key kinds, placement, connectivity and `disable_signup = true` without printing values.
- **Verified 2026-10-18:** admin-API user creation works with sign-ups disabled (`seed:apply` created all 12 logins).

### D-021: Migration route
- **Context:** DB-2. The options were the dashboard SQL Editor (no install, no new credentials) or the Supabase CLI (tracked history, but needs an install, a personal access token and the database password).
- **Choice:** The user applies each reviewed migration file in the SQL Editor, wrapped in `begin; … commit;`, and the agent verifies with `npm run check:db` (read-only, names/counts/pass-fail only). Applied migrations are logged in `.back/DATA_MODEL.md`.
- **Cost:** No automatic migration history; production deploys repeat the manual step. Rollback scripts live in `supabase/rollback/`, outside the migrations folder.
- **Revisit:** If migrations become frequent or a CI deploy pipeline is added, adopt the Supabase CLI (`db push`) with the same files.
- **Lesson (2026-10-18, DB-3):** "Success" in the editor doesn't prove the change landed in the app's database. Two attempts failed silently: one wasn't persisted, and one went to another project. The process now requires the fingerprint query (`.back/DATA_MODEL.md` migration log) before and after, plus `npm run check:db` (now with live access-rule probes). If manual application keeps failing, switch to a direct connection or the CLI so the agent can apply and verify in one step.

### D-022: Token verification and per-request identity
- **Context:** API-2. `.back/AUTH_SECURITY.md` left the choice between local JWKS verification and `auth.getUser(token)`. A dedicated JWT library (`jose`) would be a new dependency.
- **Choice:** `supabase.auth.getClaims(token)` from the already-installed supabase-js 2.117.2. The project signs with **ES256**, so verification is local against the cached JWKS (only the first request fetches it); for legacy symmetric secrets it falls back to a server check. Require `role = authenticated`. Then one RLS-scoped query loads `profiles` with the embedded `authors` row, which both builds `req.auth` and proves the policies agree with the token.
- **Errors:** bad, expired or forged token → 401; no profile → 403; Supabase unreachable → 500. A verifier outage never becomes "not signed in".
- **Testability:** `AuthVerifier` interface; offline tests inject a fake, and live tests use the real verifier with real tokens.
- **Cost:** about 230 ms per request for the profile query (Supabase round trip); the first request is about 600 ms with the JWKS fetch.
- **Revisit:** Add a short per-token profile cache (e.g. 30–60 s, keyed by token `jti`/hash) if latency matters. Role changes would then take effect after the cache window.

### D-023: Payout calendar and royalty summary rules
- **Context:** API-3. The Knowledge Base says royalties are quarterly, paid within 45 days, and that accumulated royalties under ₹1,000 roll over. The author UI, the API summary and the AI facts builder all need the same arithmetic.
- **Choice:** One pure module, `packages/shared/src/payout-calendar.ts`, holding the business date (Asia/Kolkata), calendar quarters, `quarterEnd + 45` deadlines, the threshold and the overdue heuristic. Unit-tested against the AI spec's worked examples.
- **Rules:** The threshold is applied to the **author's total** pending royalties, not per book, because "accumulated royalties" is about the author's payout. `nextPayoutDueBy` is the last closed quarter's deadline while it hasn't passed (inclusive of the day itself), otherwise the current quarter's. Money totals are summed in paise to avoid floating-point drift.
- **Revisit:** If finance confirms different quarter boundaries or a business-day window (assumptions A-02/A-03), only this module changes.

### D-024: Author ticket API (API-4)
- **Context:** API-4: `POST/GET /author/tickets` and `GET /author/tickets/{id}`. The plan named a `middleware/validate.ts`, a per-author limit and mapping database errors.
- **Validation:** handlers call the shared zod schemas directly (`CreateTicketRequestSchema.parse(req.body)` and the query/params schemas from `packages/shared/src/schemas.ts`). The error handler already turns a `ZodError` into a 400 with field details, so a `validate()` middleware would add a layer without changing behaviour, and parsing in the handler keeps the parsed values typed. Bodies are strict (unknown keys such as `authorId`, `status`, `priority` → 400) and text is trimmed before length checks.
- **Book ownership:** checked before the insert. An unknown book and another author's book get the **same** 400 on `bookId`, so book ids can't be probed. The composite FK is the backstop (23503 → the same 400).
- **Database errors:** mapped in the tickets repository (`mapPostgrestError`): trigger `rate_limited` → 429 (`Retry-After: 600`), 23503/23514 → 400, 42501 → 403, anything else → generic 500.
- **Rate limit:** `express-rate-limit`, keyed by user id, 5 per 10 min and 20 per day; failed requests don't count. In-memory per instance (A-15); the DB trigger enforces the same caps across instances.
- **Audit:** `ticket.created` is appended through the system writer after the insert, with `{ bookId }` only (no ticket text). A failed audit write is logged and never fails the request.
- **Author view:** `hasAdminReply` comes from `first_response_at`; replies are signed "BookLeaf Support" (A-07). Lists sort by `updated_at`, then `created_at`, both descending.
- **System writer confinement:** an ESLint `no-restricted-imports` rule allows `db/system-writer` only in `src/ai/**`, `src/modules/audit/**` and the bootstrap (`server.ts` creates it, `app.ts` hands it to the audit recorder).
- **Cost:** creating a ticket takes four sequential Supabase round trips (profile, book check, insert, audit): about 0.8–1.5 s, up to 5 s on a cold connection in the smoke test.
- **Revisit:** if latency matters, run the book check alongside the profile load, or append the audit event after sending the response.

### D-025: Admin queue (API-5)
- **Context:** API-5: `GET /admin/tickets` (filters, urgency sort, paging, `slaState`) and `GET /admin/tickets/summary`. TICKET_LIFECYCLE §4 asks for the urgency order in SQL so pages stay stable, but the Data API (PostgREST) can only order by columns.
- **Urgency sort:** migration `20261018090000_queue_urgency_rank.sql` adds a generated `urgency_rank` column (unresolved 0–4, resolved/closed 10–14; critical, high, untriaged, medium, low) and an index `(urgency_rank, created_at)`. The queue orders by `urgency_rank`, `created_at`, then `id`, and pages with `range`. The alternative, sorting in the API after fetching every match, was rejected because its cost grows with the queue. **Approved by:** user, 2026-10-18; applied by the user in the SQL Editor.
- **SLA rules:** `packages/shared/src/sla.ts` holds the targets (A-08), `slaState()` and the overdue cut-offs, so the API, the summary's SQL filters and the admin portal agree. Two refinements to TICKET_LIFECYCLE §3:
  - A resolved or closed ticket **without** a reply is `not_applicable`; the spec named only closed ones, and a ticking timer on finished work misleads.
  - "Overdue" (`slaBreached`, `overdue=true`) is the actionable subset of `breached`: unresolved, no first reply, past the target. A late first reply still shows `breached` on the row.
- **Filters:** comma lists (deduplicated), `priority=untriaged` for "no priority yet", `assignee=me|unassigned|any`, `aiStatus`, `overdue=true` (new, for the summary's Overdue button), `createdFrom`/`createdTo` as inclusive India business dates, and `q` over reference, subject and author name.
- **Search safety:** the shared schema replaces anything other than letters, digits, spaces and `- ' . & / #` with spaces before the text reaches a filter, and the repository quotes it again. Author-name matches resolve to author ids first.
- **Summary:** status counts cover every ticket; unassigned, critical, high, overdue and needs-manual-triage cover unresolved tickets only, to match what the queue's buttons filter to. These are nine head-only counts run in parallel.
- **Logging:** the request log redacts the `q` value (`q=redacted`), because search text can contain author names (T-14). Found in the API-5 server smoke test.
- **Cost:** the queue takes about 0.6 s and 0.8 s with a search (one extra lookup); the summary takes about 1.0–1.3 s (nine parallel counts).
- **Revisit:** a single SQL function for the summary if latency matters; a trigram index on subject and name if search gets slow.
