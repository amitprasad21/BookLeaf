# BookLeaf Author Support & Communication Portal

A web application for BookLeaf Publishing with two experiences, both backed by one shared REST API:

- **Author portal**: authors sign in, review their books and royalties, raise support tickets and follow replies in near real time.
- **Admin portal**: the operations team works a prioritised ticket queue. AI-suggested categories, priorities and reply drafts are always reviewed by a human before anything reaches an author.

> **Current status: API and both portals built, with live updates; signed-in checks pending.** The Supabase database has the schema and row-level security policies, verified by 15 live access-rule tests, and is seeded with the exact assessment dataset (10 authors, 18 books) plus 12 demo logins. The API verifies Supabase sign-ins on every `/api/v1` route (except health), enforces author/admin role guards, and serves `GET /api/v1/me` and `GET /api/v1/author/books` (books + royalty summary with the next payout deadline). It also serves the author ticket endpoints (create, list, detail; saved before any AI, rate-limited and audited), the admin queue (filters, urgency sort, first-response SLA state, summary counts), the admin ticket view and updates (status changes, category/priority overrides, self-assignment; safe against two admins editing at once, every change audited), and admin replies (first response and status recorded in one transaction) with internal notes that authors never see, plus Swagger UI at `/api/docs`. The AI provider layer is built and live-checked: Gemini 3.5 Flash-Lite (triage and drafts) with Groq gpt-oss-120b as fallback, plus circuit breaker, daily token budget and usage accounting. AI triage runs in the background after every new ticket: category, priority, confidence and a rationale for the admin. It never blocks ticket creation, never overrides an admin's choice, and admins can re-run it. Admins can request an AI reply draft grounded in the assignment's knowledge base and the author's own royalty and production data. Drafts are reused while nothing changes, and any figure that isn't in the records is flagged. A draft is never sent automatically: the admin edits and sends. The author portal (sign-in, My Books with royalties, Raise a query, My Tickets) and the support console (queue with filters and summary counts, ticket page with triage controls, notes, timeline and a reply editor with the AI draft) are built. Both update live over Server-Sent Events: an admin's reply appears for the author without a refresh, and new tickets show up for admins. If the stream drops, they refresh every 15 seconds until it's back. The AI is measured against a labelled golden set (`npm run eval:triage`, `npm run eval:drafts`): on the first live run triage picked the right category for 36 of 36 tickets and an acceptable priority for 34 of 36. Deployment comes next. [PROJECT_STATE.md](PROJECT_STATE.md) is the source of truth for what is actually done and verified.

## Planned architecture (summary)

```text
author-frontend (Next.js) ─┐
                           ├─ HTTPS + Supabase JWT ─> backend (Express + TypeScript, /api/v1)
admin-frontend  (Next.js) ─┘                              │
                                                          ├─> Supabase (Postgres + Auth + RLS)
                                                          └─> AI orchestrator ─> primary LLM
                                                                               ─> optional approved fallback
                                                                               ─> manual mode (always available)
```

Details: [ARCHITECTURE.md](ARCHITECTURE.md). Material decisions and their rationale: [.agent/DECISIONS.md](.agent/DECISIONS.md).

## Repository layout

| Path | Purpose | Exists today? |
|---|---|---|
| `author-frontend/` | Author experience (Next.js) | Scaffold: placeholder page |
| `admin-frontend/` | Admin experience (Next.js) | Scaffold: placeholder page |
| `backend/` | The single REST API and AI orchestration | Scaffold: `/api/v1/health` + tests |
| `packages/shared/` | Shared contract types, enums and validation schemas | Enums and labels |
| `packages/ui/` | Shared monochrome UI primitives and tokens | Tokens + `Panel` |
| `supabase/seed/bookleaf_sample_data.json` | Exact assessment dataset (10 authors, 18 books) | Yes |
| `supabase/migrations/` | Schema, RLS policies | Planned (task DB-2) |
| `docs/blueprint/` | Source blueprint bundle v2 (planning reference) | Yes |
| Root `*.md`, `.agent/`, `.front/`, `.back/` | Project documentation | Yes, see [DOCUMENTATION_MAP.md](DOCUMENTATION_MAP.md) |

## Where to start reading

1. [PRODUCT.md](PRODUCT.md): the problem and the people.
2. [PRD.md](PRD.md): requirements and acceptance criteria.
3. [ARCHITECTURE.md](ARCHITECTURE.md): system shape and trust boundaries.
4. [AI_SPEC.md](AI_SPEC.md): how classification, priority and drafting work, fail and stay cheap.
5. [INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md) + [openapi.yaml](openapi.yaml): the API contract.
6. [TASKS.md](TASKS.md): the implementation plan and status.

## Local setup

**Requirements:** Node.js ≥ 20.9 (developed on 24.12) and **npm ≥ 11**. npm 10.2.x crashes on this workspace with `Cannot read properties of null (reading 'edgesOut')`, a known npm bug. Node 24 ships npm 11.

Install all workspaces (exact versions from `package-lock.json`):

```bash
npm ci
```

Build shared packages first (the apps import their compiled output), then everything else:

```bash
npm run build
```

Run each part in its own terminal:

```bash
npm run dev:backend
```

```bash
npm run dev:author
```

```bash
npm run dev:admin
```

| Part | URL |
|---|---|
| API health | http://localhost:4000/api/v1/health |
| API docs (Swagger UI) | http://localhost:4000/api/docs |
| Author portal | http://localhost:3000 |
| Admin portal | http://localhost:3001 |

Run every check (format, lint, OpenAPI lint, typecheck, tests, build) in one go:

```bash
npm run check
```

Or one at a time: `npm run format:check`, `npm run lint`, `npm run lint:api`, `npm run typecheck`, `npm test`, `npm run build`. `npm run format` rewrites code formatting (Markdown docs and `openapi.yaml` are excluded).

Verify credentials without revealing them (prints configured/missing and pass/fail only):

```bash
npm run check:env
```

Verify the database schema after applying a migration (tables, client lockdown, a constraint probe; prints counts and pass/fail only):

```bash
npm run check:db
```

Check the AI configuration (providers, models and whether each key is set; never values). The `:live` variant makes one tiny synthetic call per configured model (free tier, no ticket data):

```bash
npm run check:ai
```

```bash
npm run check:ai:live
```

Load the assessment dataset and demo logins. The default is a dry run that writes nothing; writing needs the explicit `:apply` script:

```bash
npm run seed
```

```bash
npm run seed:apply
```

Run the live integration suites against Supabase: access rules, authentication, books and author tickets, all with real sign-ins. They need both migrations applied and the seed done. The access-rule and ticket suites create their own tickets and delete them afterwards with the secret key. `npm run test:rls` runs the access-rule part alone.

```bash
npm run test:live
```

Each runtime reads its own environment file. Variable names (never values) are listed in [.env.example](.env.example), and how to obtain each one is in [.agent/CREDENTIALS_GUIDE.md](.agent/CREDENTIALS_GUIDE.md).

## Test login credentials

The seed (`npm run seed:apply`) creates 12 demo logins:

| Who | Email | Password |
|---|---|---|
| 10 authors | The `email` of each author in [supabase/seed/bookleaf_sample_data.json](supabase/seed/bookleaf_sample_data.json), e.g. `priya.sharma@email.com` (AUTH001) | Shared author demo password |
| Ops admin | `admin@bookleaf.test` | Admin demo password |
| Support lead | `support.lead@bookleaf.test` | Admin demo password |

*Demo passwords will be published here for evaluators once the live demo is deployed (task DOCS-2).* Locally they live in `backend/.env` (`SEED_AUTHOR_PASSWORD`, `SEED_ADMIN_PASSWORD`), which is git-ignored.

## Assessment deliverables

| Deliverable | Status |
|---|---|
| Public source repository | Not started (local repository only) |
| Live demo URL (both portals, pre-seeded) | Not started |
| README: setup, architecture, AI integration, API docs, limitations | In progress (this file grows with the build) |
| One-page approach write-up | Not started (task DOCS-3) |

## Git workflow

All Git rules live in [GIT_WORKFLOW.md](GIT_WORKFLOW.md).
