# Tasks

**Owns:** implementation work items, their dependencies, acceptance and evidence. Requirement IDs refer to [PRD.md](PRD.md).

**Status values:** `todo` · `in_progress` · `blocked` · `done` (acceptance met **and** evidence recorded) · `deferred`.
**Order of work:** core ticket flow without AI first, then AI, then hardening and deploy, as the assignment advises.

## Phase 0: Sources, documentation, repository

| ID | Task | Depends on | Status | Acceptance / evidence |
|---|---|---|---|---|
| DOC-1 | Create the full blueprint documentation tree (root, `.agent/`, `.front/`, `.back/`) | none | done | All files present; relative links resolve; see [.agent/verification/2026-10-16-phase0.md](.agent/verification/2026-10-16-phase0.md) |
| SETUP-1 | `git init`, `.gitignore`, `.gitattributes`, `.env.example`, root `GIT_WORKFLOW.md`, exact seed copy, blueprint sources under `docs/blueprint/` | none | done | `cmp` identical seed; `.env` patterns ignored; committed on `docs/initial-setup` |
| SETUP-2 | Scaffold npm workspaces: `backend/`, `author-frontend/`, `admin-frontend/`, `packages/shared/`, `packages/ui/` | SETUP-1, install approval (given 2026-10-16) | done | Install, build, typecheck and 4 backend tests pass; live smoke of health + both portals ([.agent/verification/2026-10-16-setup2.md](.agent/verification/2026-10-16-setup2.md)) |
| SETUP-3 | Tooling: TypeScript strict, ESLint, Prettier, Vitest, OpenAPI lint, root scripts (`dev`, `build`, `test`, `typecheck`, `lint`, `lint:api`, `format`, `check`) | SETUP-2, install approval (given 2026-10-16) | done | `npm run check` exits 0; fresh `npm ci` rebuilds shared packages and typechecks ([.agent/verification/2026-10-16-setup3.md](.agent/verification/2026-10-16-setup3.md)) |

**SETUP-2 installed packages** (approved 2026-10-16; exact pins, newest release ≥ 14 days old, D-018). The versions are listed in [.agent/skills-and-tools.md](.agent/skills-and-tools.md).
SETUP-3 added the root dev tools (ESLint, Prettier, Redocly CLI) under the same policy.
Still to add, each with approval: `@anthropic-ai/sdk` (AI-2) and `@testing-library/react` (FE tasks).

## Phase 1: Data and auth

| ID | Task | Depends on | Status | Req. IDs |
|---|---|---|---|---|
| DB-1 | Create Supabase project; disable signups; configure env (just-in-time credential step) | SETUP-2 | done ([.agent/verification/2026-10-17-db1.md](.agent/verification/2026-10-17-db1.md)) | AUTH-06 |
| DB-2 | Migrations: enums, tables, constraints, indexes, `updated_at`/`version` triggers ([.back/DATA_MODEL.md](.back/DATA_MODEL.md)) | DB-1 | done: applied 2026-10-17 via the dashboard SQL editor; `npm run check:db` OK ([.agent/verification/2026-10-17-db2.md](.agent/verification/2026-10-17-db2.md)) | NFR-01 |
| DB-3 | RLS helper functions + policies + isolation tests ([.back/SUPABASE_RLS.md](.back/SUPABASE_RLS.md)) | DB-2 | done: applied 2026-10-18; 15/15 live RLS tests ([.agent/verification/2026-10-18-db3-db4.md](.agent/verification/2026-10-18-db3-db4.md)) | AUTH-03 |
| DB-4 | Seed script: exact JSON load, auth users for 10 authors + 2 admins, profiles, field-by-field verification | DB-2 | done: 10/10 authors, 18/18 books, 12 logins verified | NFR-01, AUTH-01 |
| API-1 | Express skeleton: env validation, request id, logger with redaction, helmet, CORS allowlist, error envelope, `/health`, `/api/docs` | SETUP-3 | done ([.agent/verification/2026-10-16-api1.md](.agent/verification/2026-10-16-api1.md)) | API-05, API-06 |
| API-2 | Auth middleware (verify JWT, load profile), role guards, `/me` | API-1, DB-3 | done ([.agent/verification/2026-10-18-api2.md](.agent/verification/2026-10-18-api2.md)) | AUTH-02..05 |

## Phase 2: Core ticket slice (no AI)

| ID | Task | Depends on | Status | Req. IDs |
|---|---|---|---|---|
| API-3 | `GET /author/books` + royalty summary; shared payout-calendar library | API-2 | done ([.agent/verification/2026-10-18-api3.md](.agent/verification/2026-10-18-api3.md)) | AUTHOR-01..03 |
| API-4 | Author tickets: create (save-first, `ai_status=pending`), list, detail; author DTO serializer; rate limit | API-2 | done ([.agent/verification/2026-10-18-api4.md](.agent/verification/2026-10-18-api4.md)) | AUTHOR-04..07 |
| API-5 | Admin queue: filters, urgency sort, paging, summary counts, SLA state | API-4 | done ([.agent/verification/2026-10-18-api5.md](.agent/verification/2026-10-18-api5.md)) | ADMIN-01..03, ADMIN-14 |
| API-6 | Admin detail + `PATCH`: transitions, overrides, self-assign, optimistic lock, audit events | API-5 | done ([.agent/verification/2026-10-18-api6.md](.agent/verification/2026-10-18-api6.md)) | ADMIN-05/07/11/13/15/16/17 |
| API-7 | Admin replies (`/messages`) and internal notes; first-response tracking | API-6 | done ([.agent/verification/2026-10-18-api7.md](.agent/verification/2026-10-18-api7.md)) | ADMIN-09/10/12 |
| API-8 | SSE event hub + `/events`; scoped delivery | API-4 | done ([.agent/verification/2026-10-20-api8.md](.agent/verification/2026-10-20-api8.md)); portals live, browser check pending | AUTHOR-09 |
| FE-1 | `packages/ui`: tokens + primitives ([.front/COMPONENTS.md](.front/COMPONENTS.md)) | SETUP-2 | done: author set (D-031) plus the console set (D-032) built and used by both portals ([.agent/verification/2026-10-19-fe1-author.md](.agent/verification/2026-10-19-fe1-author.md), [.agent/verification/2026-10-19-admin-portal.md](.agent/verification/2026-10-19-admin-portal.md)); rendered component tests wait for Testing Library | NFR-03 |
| FE-A1 | Author sign-in, session handling, portal-role check | API-2, FE-1 | in_progress: built; signed-out states verified; signed-in check pending | AUTH-01/05 |
| FE-A2 | My Books | API-3, FE-A1 | in_progress: built; logic tests pass; browser check pending | AUTHOR-01..03 |
| FE-A3 | Submit a Query form | API-4, FE-A1 | in_progress: built; validation tests pass; browser check pending | AUTHOR-04/05 |
| FE-A4 | My Tickets list + detail + live updates (SSE + polling fallback) | API-4, API-8 | in_progress: list + detail with live updates (SSE, polling fallback) built; browser check pending | AUTHOR-06/07/09 |
| FE-M1 | Admin sign-in + portal-role check | API-2, FE-1 | in_progress: built; signed-out checks pass; signed-in check pending ([.agent/verification/2026-10-19-admin-portal.md](.agent/verification/2026-10-19-admin-portal.md)) | AUTH-01/05 |
| FE-M2 | Queue: filters in URL, urgency sort, summary bar, live updates | API-5, API-8 | in_progress: built with live updates feeding "Show N updates" (polling fallback); logic tests pass; browser check pending | ADMIN-01..03/14 |
| FE-M3 | Ticket detail: context panel, thread, notes, timeline, status/assign/override controls, conflict handling | API-6, API-7 | in_progress: built; logic tests pass; browser check pending | ADMIN-05..17 |
| FE-M4 | Reply editor (manual first) + Send with status choice | API-7 | in_progress: built; browser check pending | ADMIN-09/10 |

**Milestone M1:** an author creates a ticket, an admin sees it, replies and resolves it, and the author sees the reply live, all with AI turned off.

## Phase 3: AI

| ID | Task | Depends on | Status | Req. IDs |
|---|---|---|---|---|
| AI-1 | Confirm provider/model (Q-04); just-in-time key setup; safe presence check + one low-cost smoke call | API-1 | done ([.agent/verification/2026-10-19-ai1-ai2.md](.agent/verification/2026-10-19-ai1-ai2.md)) | AI-02, AI-05 |
| AI-2 | Provider interface, mock provider, router, circuit breaker, daily budget, usage events | API-4 | done ([.agent/verification/2026-10-19-ai1-ai2.md](.agent/verification/2026-10-19-ai1-ai2.md)) | AI-03, AI-04 |
| AI-3 | Triage: prompt, schema, policy floors, async queue, startup sweeper, `/triage` retry | AI-2 | done ([.agent/verification/2026-10-19-ai3.md](.agent/verification/2026-10-19-ai3.md)) | ADMIN-04/06, AI-06 |
| AI-4 | Draft: KB sections, facts builder, prompt, validation, fact guard, context-hash reuse, `/draft` | AI-2, API-3 | done ([.agent/verification/2026-10-19-ai4.md](.agent/verification/2026-10-19-ai4.md)) | ADMIN-08, AI-01/07/09 |
| AI-5 | Admin UI: suggestion badges with source, low-confidence flag, draft panel, regenerate, warnings, manual-mode states | AI-3, AI-4, FE-M3 | in_progress: built (D-032); browser check with a live draft pending | ADMIN-08..10 |
| AI-6 | Golden sets + eval runner; record results (live run needs approval: it costs money) | AI-3, AI-4 | done ([.agent/verification/2026-10-20-ai6.md](.agent/verification/2026-10-20-ai6.md)): live triage 100% category, 94.4% priority, 0 schema failures, 3/3 injections; drafts 34/38 checks | AI-08 |

**Milestone M2:** tickets are triaged automatically and drafts are policy-accurate. With the provider disabled, M1 still passes.

## Phase 4: Hardening

| ID | Task | Depends on | Status | Req. IDs |
|---|---|---|---|---|
| SEC-1 | Security tests: anonymous admin access, cross-author ID substitution, note leakage, injection tickets, rate limits, invalid AI output | M2 | todo | AUTH-03, AI-07, NFR-05 |
| SEC-2 | Security review checklist pass, `npm audit`, frontend bundle grep for secrets | SEC-1 | todo | AI-02, NFR-05 |
| QA-1 | Accessibility and viewport checks; empty/loading/error states | M1 | todo | NFR-03/04/06 |

## Phase 5: Deploy and document

| ID | Task | Depends on | Status | Req. IDs |
|---|---|---|---|---|
| DEP-1 | Deploy backend to Render (just-in-time hosting credentials) | SEC-2 | todo | NFR-02 |
| DEP-2 | Deploy both frontends to Vercel; lock CORS to their origins | DEP-1 | todo | NFR-02 |
| DEP-3 | Migrate and seed the production database; live smoke test of both journeys and the AI-down path | DEP-2 | todo | NFR-01/02 |
| DOCS-2 | Final README: setup, architecture, AI integration, API docs link, test credentials, limitations | DEP-3 | todo | Documentation criterion |
| DOCS-3 | One-page write-up (`WRITEUP.md`) | DOCS-2 | todo | Deliverable 4 |

## Stretch (P2)

| ID | Task | Status |
|---|---|---|
| X-1 | Real attachment upload to a private Supabase Storage bucket (AUTHOR-08) | deferred |
| X-2 | Author follow-up messages (AUTHOR-10) | deferred |
| X-3 | AI usage view (ADMIN-18) | deferred |
| X-4 | Durable job queue for AI work (replace in-process queue) | deferred |
