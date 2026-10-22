# BookLeaf Author Support & Communication Portal

A web application for BookLeaf Publishing with two experiences, both backed by one shared REST API:

- **Author portal**: authors sign in, review their books and royalties, raise support tickets and follow replies in near real time.
- **Admin portal**: the operations team works a prioritised ticket queue. AI-suggested categories, priorities and reply drafts are always reviewed by a human before anything reaches an author.

> **Current status: implementation complete through AI-8; release checks remain.** The API, both portals, live updates, security fixes, runtime AI pacing and draft-policy checks are built. All 441 offline tests and production builds pass. Latest approved live evaluation: triage 36/36 category and priority; drafts eight answers and 48/49 checks, with the earlier action/tone errors corrected in those samples. The remaining timeline check requires information BookLeaf has not supplied; estimates await production confirmation. The write-up and hosting configurations are ready. Full browser/accessibility checks, human security review, an unpatched development dependency advisory and deployment remain open. See [PROJECT_STATE.md](PROJECT_STATE.md), [TASKS.md](TASKS.md) and [release evidence](.agent/verification/2026-10-22-release-preparation.md).

## Architecture (summary)

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
| `author-frontend/` | Author experience (Next.js) | Sign-in, books/royalties, query form, tickets and live replies |
| `admin-frontend/` | Admin experience (Next.js) | Queue, filters, ticket management, notes and AI draft editor |
| `backend/` | The single REST API and AI orchestration | Protected API, SSE, AI triage/drafts/evals and offline/live test suites |
| `packages/shared/` | Shared contract types, enums and validation schemas | DTOs, validation, labels, payout/SLA calendars and ticket rules |
| `packages/ui/` | Shared monochrome UI primitives and tokens | Components used by both portals |
| `supabase/seed/bookleaf_sample_data.json` | Exact assessment dataset (10 authors, 18 books) | Yes |
| `supabase/migrations/` | Schema, RLS policies | Applied and verified in the existing Supabase project |
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

Create `backend/.env`, `author-frontend/.env.local` and `admin-frontend/.env.local` using the corresponding sections of [.env.example](.env.example). The backend needs Supabase URL, publishable key and server-only secret key; each frontend receives only its three `NEXT_PUBLIC_*` values. The API base ends in `/api/v1`. Use `AI_PRIMARY_PROVIDER=none` for manual mode without model keys. For a new Supabase project, follow the ordered migrations and seed instructions in [deployment guidance](.back/DEPLOYMENT.md); the provided seed dry run is safe by default.

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

Or one at a time: `npm run format:check`, `npm run lint`, `npm run lint:api`, `npm run typecheck`, `npm test`, `npm run build`. The frontend logic suites currently run separately with the root-hoisted Vitest: `npx --no-install vitest run --root author-frontend` and `npx --no-install vitest run --root admin-frontend`. `npm run check` includes the backend suite; it does not run those two frontend suites. `npm run format` rewrites code formatting (Markdown docs and `openapi.yaml` are excluded).

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
| Public source repository | Local repository prepared; remote publication pending |
| Live demo URL (both portals, pre-seeded) | Render/Vercel configurations prepared; hosting sign-in and deployment pending |
| README: setup, architecture, AI integration, API docs, limitations | Prepared; actual hosted links and intended demo credentials remain pending |
| One-page approach write-up | [WRITEUP.md](WRITEUP.md) |

## AI integration and limits

Gemini `gemini-3.5-flash-lite` is the configured primary for triage and drafting, with Groq `openai/gpt-oss-120b` as the explicitly configured fallback. The small versioned KB is selected by category instead of vector search. Facts contain only the ticket author's relevant records. Schema validation, one repair attempt, policy floors, draft-policy checks, amount/date warnings and context-hash reuse constrain mistakes and repeated calls. AI never sends a reply or changes royalty records; an admin reviews, edits and sends it. See [AI_SPEC.md](AI_SPEC.md) for the complete behavior and evaluation method.

Runtime calls and retries are spaced by `AI_REQUEST_MIN_INTERVAL_MS` (default 8000). Pacing, a daily token budget and circuit breakers reduce bursts and cost, but cannot guarantee provider availability or a precise billing cap. The latest paced draft run averaged 17.93 seconds per reported provider call, including one timeout; repairs/fallback may require multiple calls per draft. Manual mode remains available. Live evals call configured providers and may incur charges; their saved reports are git-ignored and summaries are under [.agent/verification](.agent/verification/README.md).

Payout overdue periods are heuristic references, not a quarterly ledger. Production completion estimates are unavailable and must be confirmed by production. The service is designed for one backend instance; SSE, queue deduplication, pacing and request limits need shared infrastructure before horizontal scaling. A Render free service may take about a minute to wake after idling; the portals show a delayed loading hint. Attachments currently record a filename only; real uploads, author follow-up messages and a usage dashboard are deferred. Production dependency audit is clean; the development lint chain's unpatched braces finding and review limits are documented in [release verification](.agent/verification/2026-10-22-release-preparation.md). Hosting steps and rollback pointers are in [.back/DEPLOYMENT.md](.back/DEPLOYMENT.md).

## Git workflow

All Git rules live in [GIT_WORKFLOW.md](GIT_WORKFLOW.md).
