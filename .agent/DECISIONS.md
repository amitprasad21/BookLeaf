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
| D-010 | Primary LLM: Anthropic Claude Haiku 5.5 | superseded by D-028 | 2026-10-16 |
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
| D-032 | Support console: session layer copied from the author portal (no shared web package yet); polled queue offered as "Show N updates"; AI draft requested on open only when it's the team's turn; category override refetches the draft; KB and policy-floor names in `packages/shared` with a sync test | accepted | 2026-10-19 |
| D-031 | Frontend foundation: `packages/ui` is presentation-only (no `@bookleaf/shared` dependency; CSS classes over tokens); DTO types in `packages/shared` and returned by the serializers; session from `INITIAL_SESSION` + `/me`; 15 s polling until SSE; CSP with `'unsafe-inline'` scripts (nonce CSP is a hardening option) | accepted | 2026-10-19 |
| D-030 | AI drafts: Flash-Lite for drafts (3.8 Flash too slow on the free tier), KB as a TS module with category selection, facts-reading rules in the prompt, guards with one repair, server-set sign-off, fact warnings, context-hash reuse, admin-RLS storage | accepted | 2026-10-19 |
| D-029 | AI triage: background queue + sweeper; attempts counted on the final write under the version lock; admin values never replaced; manual re-run caps; JSON-escaped ticket; provider schema shape-only; 30 s triage timeout | accepted | 2026-10-19 |
| D-028 | AI providers: Gemini (3.5 Flash-Lite triage, 3.8 Flash drafts) + Groq gpt-oss-120b fallback on free tiers; REST adapters without SDKs; no second key per provider; no Logfire | accepted | 2026-10-18 |
| D-027 | Admin reply as one Postgres function (`admin_send_reply`, security invoker, locked row, open/in-progress only); notes via RLS insert; audit after commit without text | accepted | 2026-10-18 |
| D-026 | Admin ticket PATCH: plan-then-conditional-update optimistic lock; 409 returns the ticket in `error.current`; same values are no-ops; strict self-assignment; batched audit stamped 1 ms apart | accepted | 2026-10-18 |
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

### D-010: Primary LLM, Claude Haiku 5.5 (superseded by D-028)
- **Context:** The assignment suggests gpt-4o-mini or Claude Haiku for cost; the blueprint says to choose the provider just in time.
- **Proposal:** `claude-haiku-5-5` for both tasks, structured outputs, prompt caching. Sonnet 5.5 for drafts only if the eval shows Haiku drafts need heavy edits.
- **Rationale:** Lowest cost tier with schema-constrained JSON. One model keeps one cache and one eval baseline. Details: [AI_SPEC.md](../AI_SPEC.md) section 2.
- **Outcome (2026-10-18):** not adopted. At AI-1 the user provided Gemini and Groq keys instead and asked for the best free-tier models; see D-028.

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

### D-026: Admin ticket detail and PATCH (API-6)
- **Context:** API-6: `GET /admin/tickets/{id}` (full admin view) and `PATCH` (status, category/priority override, self-assignment) with optimistic locking (ADMIN-15) and audit events (ADMIN-17).
- **Optimistic lock:** read the ticket. A body `version` that differs → 409 straight away. Otherwise a pure planner (`modules/tickets/admin-service.ts`) validates and builds the column changes. The update is `UPDATE … WHERE id = ? AND version = ?`, and the version trigger bumps it. If no row matches, another write landed in between → 409. Two admins saving the same version can't both win (verified live with parallel requests).
- **409 payload:** `details: [{ path: "version", issue: "is out of date" }]` plus `error.current` holding the ticket as it is now (AdminTicketDetail). The UI can refresh and say who changed it without another request (FLOWS F-M2). This is a new optional field on the error envelope, used only for VERSION_CONFLICT.
- **No-op values:** a field equal to its current value is not a change, so a repeated PATCH returns 200 with the same version and no audit. This replaces the spec's "same-status transitions are rejected by validation": the outcome (no write, no audit noise) is the same, without an error for a harmless retry. Confirming the AI's category or priority **is** a change: it becomes admin-set.
- **Assignment (A-16, made precise):** an admin may take an **unassigned** ticket or release **their own**. Taking a colleague's ticket, releasing it, or assigning someone else → 422 `INVALID_ASSIGNMENT`, with a message naming the current assignee.
- **Status stamps:** resolving sets `resolved_at` and closing sets `closed_at`, both from the API clock. Reopening (to `in_progress` from resolved/closed) clears both; history stays in the audit trail.
- **Audit:** one event per changed aspect (`ticket.status_changed`, `ticket.category_overridden`, `ticket.priority_overridden`, `ticket.assigned`, `ticket.unassigned`), with old/new values and the old source. Events go through the system writer in **one insert**. Rows in one statement share `now()`, so the writer stamps them 1 ms apart to keep their order (a live test caught the shuffled order). Audit failures are logged and never fail the request (as in API-4).
- **Detail view:** the author profile has name, city and joined date, never email or phone. It includes the author's books with royalty figures (the API-3 serializer), the thread with real sender names (admins see who replied), internal notes, the AI suggestion (raw `ai_*` columns, kept after overrides) and the audit timeline (actor null = system).
- **Cost:**

  | Request | Round trips | Time |
  |---|---|---|
  | Detail | 2 (ticket, then books, thread, notes and timeline in parallel) | about 1.1 s |
  | Changing PATCH | about 5 | about 1.5–1.9 s |

- **Revisit:** return the planned changes without re-reading everything; move the update and audit into one Postgres function if atomicity of the audit trail becomes a requirement.

### D-027: Admin replies and internal notes (API-7)
- **Context:** API-7: `POST /admin/tickets/{id}/messages` (reply, first-response tracking, `statusAfter`) and internal notes. A reply touches two tables (the message, then the ticket's `first_response_at`, status and `resolved_at`). API_IMPLEMENTATION §4 asked for multi-step writes like this to be atomic.
- **Choice:** migration `20261018120000_admin_reply_function.sql` adds `public.admin_send_reply(ticket, body, status_after, draft)`. In one transaction it:
  - locks the ticket row, so replies and PATCHes queue up;
  - refuses resolved/closed tickets (reopen first) and unknown drafts;
  - inserts the message as `auth.uid()`;
  - sets `first_response_at` only if empty, moves the status to `in_progress` or `resolved`, and stamps `resolved_at`.

  **Approved by:** user, 2026-10-18; applied by the user in the SQL Editor.
- **Security:**
  - `security invoker` with `search_path = ''`: it runs with the admin's own rights, so the existing RLS policies still decide; the `is_admin()` check only gives a clear error first.
  - `EXECUTE` is revoked from `public`/`anon` and granted to `authenticated`.
  - Verified live: an author calling the function directly gets 42501, and anon is refused too.
- **Rejected alternative:** two API calls (insert, then update), which could leave a reply on record with the ticket still `open` and no first response time.
- **Versions:** a reply bumps the ticket version (the message trigger, plus the status/first-response update when something changes), so a PATCH built on the pre-reply version gets 409 (verified live).
- **Notes:** a plain RLS-scoped insert (`admin_profile_id` = caller, enforced by the policy). The ticket FK doubles as the existence check (23503 → 404). There is no version bump, since notes are append-only internal data.
- **Audit:** after the commit through the system writer: `ticket.reply_sent` `{ messageId, draftId, firstResponse }`, `ticket.status_changed` `{ from, to, via: "reply" }` when the status moved, and `ticket.note_added` `{ noteId }`. Message and note text never enters the audit trail.
- **Cost:** a reply, a note or a refusal (422) each takes about 0.5–0.7 s.

### D-028: AI providers and the provider layer (AI-1, AI-2)
- **Context:** AI-1/AI-2. The user added `GEMINI_API_KEY`, `GROQ_API_KEY` and `GROQ_FALLBACK_API_KEY` to `backend/.env` and asked for the best models usable on the free tier. There is no Anthropic key, so D-010 doesn't apply.
- **Models** (verified on the providers' pages 2026-10-18; AI_SPEC §2):
  - Triage: Gemini `gemini-3.5-flash-lite`.
  - Drafts: Gemini `gemini-3.8-flash`.
  - Fallback for both: Groq `openai/gpt-oss-120b`.
  - Per-task models replace "one model for both": on the free tier the most capable Flash model has a small daily quota, so it goes where quality matters and volume is low.
- **No second key per provider:** `GROQ_FALLBACK_API_KEY` is deliberately unused. A backup key for the same provider is key cycling (C-14). Config validation rejects a fallback on the same provider, and `check:ai` flags the extra key.
- **No SDKs:** both providers are plain REST APIs, so the adapters use `fetch`. This adds zero dependencies; the Anthropic SDK install the user approved earlier was not done, since there's no key.
- **Error mapping:** failures are classified from HTTP status and structured fields (Gemini `ErrorInfo.reason`, `RetryInfo`, `finishReason`; Groq `error.code`, `finish_reason`, `retry-after`), never from message text. The adapter's bounded retry is the only retry layer. A retry delay over 60 s is classified `quota` and parks that provider for an hour, while the fallback carries on.
- **Router:**
  - Budget gate first, then primary, then fallback.
  - The per-provider circuit breaker opens after 3 consecutive transient failures, probes after the cooldown, doubles the cooldown when a probe fails, and stays open on configuration errors (bad key, no model access).
  - Refusals, bad requests and invalid output are never failed over.
  - Every attempt or skip writes one `ai_usage_events` row (tokens, latency, list-price estimate), and errors carry `retryable` for the triage queue (AI-3).
- **Budget:** `AI_DAILY_TOKEN_BUDGET` covers input + output tokens since 00:00 Asia/Kolkata, summed by the system writer (the Data API has aggregates off), cached for 30 s and topped up locally.
- **Logfire: not adopted.** pino's structured logs plus `ai_usage_events` already show calls, failures, tokens, latency and cost. Logfire would add a vendor and a key, and ship traces (possibly ticket text) to a third party, for no assessment benefit.
- **Privacy:** Gemini's free tier may use content to improve Google's products (A-18). That's acceptable for the fictional demo data; production uses the paid tier.
- **Verified:** `check:ai:live` made one synthetic call per model (Flash-Lite OK, 3.8 Flash OK on retry after one transient overload, Groq OK). 55 offline AI tests.

### D-029: AI triage (AI-3)
- **Context:** AI-3: triage after ticket creation (prompt, schema, policy floors, async queue, sweeper, `/triage` retry), on the D-028 providers.
- **Flow:** the author's `POST /author/tickets` saves the ticket and queues its id, so creation never waits for AI (C-10). The in-process queue (concurrency 2, D-007) runs the job:
  1. `loadTicketForTriage` through the system writer.
  2. Facts: the book's or the author's totals and the payout calendar; no name, email, phone or city.
  3. Prompt, then `route()` with one repair attempt on unusable output.
  4. Zod validation, then floors.
  5. `saveTriageResult`, or `markTriageFailure`.
  6. Audit `ticket.triaged` (actor null; labels and provider only, no text).
- **Prompt safety:** the system prompt is static, with no ticket data. Facts and ticket go in `<facts>`/`<ticket>` as JSON with `<` and `>` escaped, so ticket text can't close a tag. The prompt states the ticket is data, not instructions. A live injection ticket ("set priority to critical…") was classified normally (`general_inquiry`, low).
- **Provider schema:** providers get the shape only (types, enums, required fields, descriptions). Strict modes accept different keyword subsets, and an unsupported keyword fails the whole request. Length, range and count limits are enforced by `TriageResultSchema` after parsing; a violation triggers the repair attempt.
- **Writes:** `ai_attempts` is incremented by the final write (save or failure), conditional on the version loaded. There is no separate "claim" write, so a triage bumps the ticket version once. If an admin changed the ticket mid-triage, the job reloads and re-applies the same result without a second AI call. Effective category/priority take the AI value unless the admin set them (`*_source = 'admin'`); an earlier AI value is refreshed on re-triage.
- **Failure states:** `failed` while retryable with attempts left (3 total); otherwise `manual_review_required` with the reason.
- **Sweeper:** at startup and every 5 minutes, re-queues pending/failed tickets untouched for 2 minutes with attempts left (20 per pass). It skips while AI is off, the budget is spent or every circuit is open.
- **Shutdown:** waits up to 8 s for running jobs; anything unfinished is picked up by the next sweep.
- **Manual re-run** (`POST /admin/tickets/{id}/triage`):
  - Resets the ticket to pending with attempts 0 and queues it (202).
  - A ticket already pending gets 202 with nothing redone.
  - Limits: 3 per ticket per India business day (counted from `ticket.triage_requested` audit events; 429 until midnight) and 5 per minute per admin.
  - 503 `AI_UNAVAILABLE` when AI can't serve (checked first, with no call).
- **Timeout:** `AI_TRIAGE_TIMEOUT_MS` default raised from 15 s to 30 s. Free-tier Flash-Lite took 8–13 s per triage in the smoke test, and nobody waits on a background job.
- **Measured:** about 1,100–1,150 input and 74–107 output tokens per triage on `gemini-3.5-flash-lite` (≈ $0.0005 at list price; free tier). One unusable answer in five was fixed by the repair attempt.
- **Live test usage:** the live suite's provider calls stay in `ai_usage_events` (with `ticket_id` null once the test tickets are deleted). They are real usage and count toward the daily budget.

### D-030: AI reply drafts (AI-4)
- **Context:** AI-4: `POST /admin/tickets/{id}/draft`, with knowledge base sections, a facts builder, the prompt, validation, the fact guard and context-hash reuse.
- **Draft model changed from D-028:** Gemini **3.5 Flash-Lite** is now the default for drafts too.
  - Measured on the free tier 2026-10-19: `gemini-3.8-flash` timed out on draft-sized prompts three times at 30 s, then gave no answer in 90 s even with thinking set to low. Earlier it also returned one 5xx overload.
  - `gemini-3.5-flash-lite` drafted in about 2 s (1.3–1.4k tokens in, 240–360 out).
  - Groq gpt-oss-120b (about 2.4 s) remains the fallback.
  - 3.8 Flash stays available through `AI_PRIMARY_DRAFT_MODEL=gemini-3.8-flash`, e.g. on a paid key. AI-6 evals can compare quality.
- **Knowledge base:** `backend/src/ai/knowledge-base/index.ts`.
  - A TypeScript module, not `.md` files, so it ships with the build without file copying.
  - Twelve sections transcribed from the assignment PDF on 2026-10-19 (₹ signs and ranges restored where text extraction dropped them); `KB_VERSION` is part of the context hash.
  - Section choice is deterministic by effective category (AI_SPEC §7), plus distribution for a metadata change request.
- **Facts:** `facts/draft-facts.ts`.
  - First name only; the book's catalogue and royalty figures; the author's books for General royalty/general tickets.
  - The payout calendar with the overdue and threshold flags; the production stage, its position of 9, the next stage and known delay points.
  - Never email, phone or city.
- **Prompt** (`draft-2026-10-19.2`):
  - The assignment's tone guidelines plus explicit rules for reading the facts. After a live draft told an author with `paymentPossiblyOverdue: true` that the payment was not overdue, the prompt now requires: acknowledge it, escalate to finance, update within 48 hours. Below threshold → explain the rollover; production → stage and next step without blame.
  - KB sections, facts, ticket and the last 4 thread messages (1,500 characters each) are delimited and JSON-escaped.
- **Guards:**
  - Shape problems (sections not provided, `[…]`/`{{…}}` placeholders, a nameless greeting, a reply with no paragraph breaks) trigger one repair attempt; a second failure is 503 `invalid_output`. The paragraph rule came from a live one-block reply, which the repair fixed.
  - The sign-off is set by the server, replacing whatever closing the model wrote. A live draft had it inline and then twice.
  - The fact guard turns ₹ amounts and dates that are in neither the facts nor the author's words into `factWarnings`. It never blocks.
- **Reuse:** `context_hash` = sha256 of [prompt version, KB version, primary draft model, effective category, subject, description, latest message id, facts]. A `ready` draft with the same hash is returned with 200 and no AI call.
- **Regeneration:** 201, limited to 5 per ticket per India business day (counted from `ai.draft_regenerated` audit events) and 10 per minute per admin (plain opens aren't limited). Earlier drafts become `superseded`.
- **Storage:** drafts are stored through the admin's RLS-scoped client (policy: `requested_by` = caller; admins may only change `status`). No system writer is involved. Audit `ai.draft_generated`/`ai.draft_regenerated` records ids, provider, model, sections and the warning count, never text.
- **Measured:** about 4–7 s per `/draft` request end to end, with the model call itself about 2 s on Flash-Lite. A reused draft returns in about 1.4 s.

### D-031: Frontend foundation (FE-1, FE-A1..A4)
- **Context:** the first portal screens. Both apps need shared visuals, the same contract types and the same session rules.
- **`packages/ui` is presentation only.**
  - It doesn't depend on `@bookleaf/shared`. Callers pass labels (e.g. `StatusBadge status="open" label={STATUS_LABELS.open}`), so wording stays in one place.
  - The alternative needed a new workspace dependency and lockfile change.
  - Styles are CSS classes in `components.css` that read `tokens.css`. Inline styles can't express hover, focus or media queries.
  - `MoneyValue`/`DateValue` from COMPONENTS.md became shared formatters (`formatInr`, `formatDate`, `formatRelative`, `NULL_WORDING`).
  - Admin-only components (sortable table, filter bar, pagination, dialog, tabs, reply editor, timeline, SLA indicator) come with FE-M1..M4.
- **Contract types:** response DTOs live in `packages/shared/src/dto.ts`. The backend serializers declare them as return types, so a field the contract doesn't list fails to compile on the server before a frontend can use it.
- **Session:**
  - supabase-js keeps the session (localStorage, FRONTEND_ARCHITECTURE §4).
  - On `INITIAL_SESSION` the app calls `GET /me`. Role `author` → signed in. Any other role, or 403 → local sign-out + "This account doesn't have access to the author portal." API unreachable → a retry screen instead of a sign-out.
  - A 401 refreshes once and retries; a second 401 signs out locally and goes to `/login?reason=expired`.
  - `next` keeps the destination; only same-site paths are accepted.
- **Live updates:** My Tickets and the ticket page poll every 15 s (TanStack `refetchInterval`) and say "Refreshing every 15 s". API-8 adds SSE and switches the indicator to "Live".
- **CSP:**
  - `script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'` in dev only); `connect-src` limited to self, the API origin and the Supabase origin.
  - The App Router's inline bootstrap scripts need `'unsafe-inline'` unless every page renders dynamically with a per-request nonce. Static pages and simpler hosting won.
  - React escapes all text, no `dangerouslySetInnerHTML` is allowed (lint rule), and messages are plain text. A nonce CSP is the hardening upgrade.
- **Unsent text:** the query draft (about, subject, description) is kept in `sessionStorage` until sent, so it survives errors, reloads and an expired session (FLOWS F-A5).
- **Revisit:** at API-8 (indicator and invalidation), at hardening (nonce CSP, cookie sessions per ALTERNATIVES), and if a monochrome spec arrives (tokens only).

### D-032: Support console (FE-M1..M4, AI-5)
- **Context:** the admin portal: queue, ticket page, triage controls, the AI draft in the reply editor.
- **Session layer copied, not shared:** `lib/` (config, Supabase client, API client), the session provider and the sign-in screen are copies of the author portal's, with role `admin`, storage key `bookleaf-admin-auth` and the console copy.
  - A shared package would need a new workspace (and a lockfile change), because `packages/ui` stays free of Supabase and React Query.
  - Revisit at hardening if the copies start to drift.
- **Live queue without reordering:**
  - The shown list is fetched on load, filter changes and the admin's own actions.
  - A second, polled copy (15 s) is compared with it: new, changed (version or AI state) and removed tickets give "Show N updates", and new tickets are announced politely.
  - Rows never move under the admin (admin/SCREENS.md M2). API-8 will invalidate the polled copy instead.
- **AI draft on open, only when it's the team's turn:** no reply yet, or the author wrote last.
  - Otherwise the editor offers "Draft a reply with AI", so opening a ticket just to check it doesn't spend a model call.
  - The API's context-hash reuse (D-030) makes reopening free either way.
- **Draft vs typing:** the field shows the draft until the admin types. Typing first keeps the typed text when a late draft arrives (MT-10).
  - The draft the text started from is sent as `draftId`.
  - Unsent text is kept per ticket in `sessionStorage`.
  - Regenerating over edits asks first.
- **Category override refetches the shown draft:** the knowledge base sections follow the category; the API reuses the draft if nothing changed.
- **Names from the backend sources live in `packages/shared`:** knowledge base section titles and policy-floor rules. `backend/test/labels.test.ts` fails if they drift.
- **Deviations from admin/SCREENS.md:**
  - The queue has no "Low confidence" marker, because the list API carries no confidence; the ticket page shows it.
  - "Assign to me" is always visible (hover-only controls fail on touch).
  - The urgency rule is hint text under Sort, not a tooltip.

