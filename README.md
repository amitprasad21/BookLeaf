# BookLeaf Author Support & Communication Portal

A web application for BookLeaf Publishing with two experiences, both backed by one shared REST API:

- **Author portal**: authors sign in, review their books and royalties, raise support tickets and follow replies in near real time.
- **Admin portal**: the operations team works a prioritised ticket queue. AI-suggested categories, priorities and reply drafts are always reviewed by a human before anything reaches an author.

> **Current status: planning and repository setup only.** No application code, database, credentials, AI integration or deployment exists yet. [PROJECT_STATE.md](PROJECT_STATE.md) is the source of truth for what is actually done and verified.

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
| `author-frontend/` | Author experience (Next.js) | Planned (task SETUP-2) |
| `admin-frontend/` | Admin experience (Next.js) | Planned (task SETUP-2) |
| `backend/` | The single REST API and AI orchestration | Planned (task SETUP-2) |
| `packages/shared/` | Shared contract types, enums and validation schemas | Planned (task SETUP-2) |
| `packages/ui/` | Shared monochrome UI primitives and tokens | Planned (task SETUP-2) |
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

*To be written when the workspace is scaffolded (task SETUP-2).* Expected shape:

```bash
npm install
```

Each runtime reads its own environment file. Variable names (never values) are listed in [.env.example](.env.example), and how to obtain each one is in [.agent/CREDENTIALS_GUIDE.md](.agent/CREDENTIALS_GUIDE.md).

## Test login credentials

*To be added after the seed script runs against the deployed demo (task DB-4).* Author logins will use the 10 author emails from the provided dataset, and admin logins use `@bookleaf.test` addresses.

## Assessment deliverables

| Deliverable | Status |
|---|---|
| Public source repository | Not started (local repository only) |
| Live demo URL (both portals, pre-seeded) | Not started |
| README: setup, architecture, AI integration, API docs, limitations | In progress (this file grows with the build) |
| One-page approach write-up | Not started (task DOCS-3) |

## Git workflow

All Git rules live in [GIT_WORKFLOW.md](GIT_WORKFLOW.md).
