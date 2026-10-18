# BookLeaf Author Support & Communication Portal

A web application for BookLeaf Publishing with two experiences, both backed by one shared REST API:

- **Author portal**: authors sign in, review their books and royalties, raise support tickets and follow replies in near real time.
- **Admin portal**: the operations team works a prioritised ticket queue. AI-suggested categories, priorities and reply drafts are always reviewed by a human before anything reaches an author.

> **Current status: data layer ready.** The Supabase database has the schema and row-level security policies, verified by 15 live access-rule tests, and is seeded with the exact assessment dataset (10 authors, 18 books) plus 12 demo logins. The API has its middleware chain and serves `/api/v1/health` plus Swagger UI at `/api/docs`, but doesn't yet authenticate or serve data. No ticket features, AI or deployment yet. [PROJECT_STATE.md](PROJECT_STATE.md) is the source of truth for what is actually done and verified.

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

Load the assessment dataset and demo logins. The default is a dry run that writes nothing; writing needs the explicit `:apply` script:

```bash
npm run seed
```

```bash
npm run seed:apply
```

Run the live row-level-security suite (needs both migrations applied and the seed done):

```bash
npm run test:rls
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
