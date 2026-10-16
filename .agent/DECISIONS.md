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
