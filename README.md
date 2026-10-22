# BookLeaf Author Support & Communication Portal

A support system for BookLeaf Publishing with two web apps on one shared REST API:

- **Author portal:** authors sign in, check their books and royalties, raise support queries and follow the replies live.
- **Support console:** BookLeaf's operations team works one prioritised queue. AI suggests a category, a priority and a reply draft for every query; a person always reviews, edits and sends the reply.

AI never replies to an author on its own, never changes royalty data, and the whole system keeps working in manual mode when AI is off or unavailable.

## Live demo

| What | Link |
|---|---|
| Author portal | <https://bookleaf-author.vercel.app> |
| Support console (admin) | <https://bookleafsupport.vercel.app> |
| API base URL | `https://bookleaf-338a.onrender.com/api/v1` |
| API health | <https://bookleaf-338a.onrender.com/api/v1/health> |
| API docs (Swagger UI) | <https://bookleaf-338a.onrender.com/api/docs> |
| OpenAPI contract | <https://bookleaf-338a.onrender.com/api/openapi.yaml> · [openapi.yaml](openapi.yaml) |
| Source code | <https://github.com/amitprasad21/BookLeaf> |

> **First load can take about a minute.** The API runs on Render's free plan, which sleeps after 15 idle minutes. While it wakes up, the portals show "Waking up the server…". Opening the health link first wakes it.

### Demo accounts

The database holds the assessment dataset exactly (10 authors, 18 books) plus 12 logins:

| Who | Email | Password |
|---|---|---|
| Authors (10) | The `email` of each author in [the dataset](supabase/seed/bookleaf_sample_data.json), e.g. `priya.sharma@email.com` (AUTH001, 2 books), `rohit.kapoor@email.com` (AUTH002) | Shared author demo password: provided to evaluators with the submission |
| Ops admin | `admin@bookleaf.test` | Admin demo password: provided with the submission |
| Support lead | `support.lead@bookleaf.test` | Admin demo password: provided with the submission |

Sign-ups are disabled; every account comes from the seed script.

### Five-minute tour

1. **Author portal:** sign in as `priya.sharma@email.com`. *My Books* shows both books with copies sold, royalty earned, paid and pending, plus the next payout date.
2. **Raise a query:** choose a book (or "General / Account Level"), describe a problem, e.g. "My royalty for last quarter hasn't arrived", and send. It's saved at once; AI never delays it.
3. **Support console** (another browser or a private window): sign in as `admin@bookleaf.test`. The new ticket appears within seconds; AI triage then fills in the category and priority (e.g. *Royalty & Payments*, high) with its confidence, usually within half a minute on the free AI tiers.
4. **Open the ticket:** author context (books, royalties, payout status), the thread, internal notes, the timeline and the AI draft grounded in BookLeaf's knowledge base and the author's own figures. Edit the draft and send it with a status (e.g. *Resolved*).
5. **Back in the author portal:** the reply and the new status appear without a refresh. Internal notes never do.

## Features

**Author portal** ([author-frontend/](author-frontend/))

- Sign-in with Supabase Auth; only author accounts get in.
- *My Books:* every book with ISBN, status, MRP, copies sold, royalty earned / paid / pending and last payout; a royalty summary with the next payout deadline. Books still in production show their stage instead of zeros. Table from 1024 px, cards on smaller screens.
- *Raise a query:* about a specific book or the account, with validation and a per-author limit.
- *My Tickets:* status filters and a detail page with the conversation, updated live over Server-Sent Events (polling only while the stream is down).

**Support console** ([admin-frontend/](admin-frontend/))

- Queue across all authors sorted by urgency, filters for status, category, priority, assignee, AI status, overdue and search, kept in the URL. Summary counts (open, in progress, unassigned, critical, SLA breached, needs manual triage) and SLA indicators.
- "Show N updates" when the queue changes in the background, so rows never jump under the cursor.
- Ticket page: author context with royalty figures, conversation, internal notes, audit timeline, status changes along allowed transitions, category/priority overrides (showing what AI suggested and how confident it was), self-assignment.
- Reply editor with the AI draft: missing-information list, escalation hint, warnings for amounts or dates that don't match the facts, regenerate (capped), or write manually. Sending can resolve the ticket in one step.
- Two admins editing one ticket get a version conflict, never a silent overwrite.

**API** ([backend/](backend/))

- Express 5 + TypeScript REST API under `/api/v1`, documented in [openapi.yaml](openapi.yaml) and served as Swagger UI.
- Every route except `/health` requires a Supabase access token; author and admin routes are separated by role.
- Database access runs as the signed-in user, so Postgres row-level security applies even if an API check were wrong.
- Tickets are saved first; AI triage runs in a background queue with retries, pacing, a daily budget and a circuit breaker.

## Architecture

```text
author-frontend (Next.js, Vercel) ─┐
                                   ├─ HTTPS + Supabase JWT ─> backend (Express + TypeScript, Render, /api/v1)
admin-frontend  (Next.js, Vercel) ─┘          │                     │
           │                                  │ SSE /events         ├─> Supabase Postgres (RLS) + Auth
           └──── Supabase Auth (sign-in) ─────┘                     └─> AI router ─> Gemini (primary)
                                                                                  ─> Groq (fallback)
                                                                                  ─> manual mode
```

| Layer | Technology |
|---|---|
| Frontends | Next.js 16 (App Router), React 19, TanStack Query 5, shared `packages/ui` components (monochrome design tokens) |
| API | Node.js 24, Express 5, TypeScript 6, zod 4 validation, pino logging, helmet, express-rate-limit |
| Data and auth | Supabase Postgres with row-level security, Supabase Auth (ES256-signed JWTs, verified locally against the project's keys) |
| AI | Gemini `gemini-3.5-flash-lite` (primary), Groq `openai/gpt-oss-120b` (fallback), plain REST adapters |
| Shared code | `packages/shared`: DTO types, enums, validation schemas, labels, payout and SLA calendars |
| Hosting | Render (API, one instance), Vercel (two portals), Supabase cloud |

Key decisions (full list with reasons in [.agent/DECISIONS.md](.agent/DECISIONS.md)):

- **Save first, AI later:** a ticket is stored before any model call, so AI outages never lose or delay a query.
- **Defence in depth:** the API filters by the caller's identity *and* Postgres RLS enforces the same rules; the RLS-bypassing secret key is confined to one small "system writer" module.
- **Live updates over SSE:** an in-process event hub sends identifier-only events (admins: all tickets; authors: only their own), and the portals refetch what changed.
- **One backend instance:** the event hub, rate limits and AI queue live in memory. Scaling out would need Redis or Postgres LISTEN/NOTIFY first.

More: [ARCHITECTURE.md](ARCHITECTURE.md), [INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md).

## API reference

Base URL `https://bookleaf-338a.onrender.com/api/v1` (local: `http://localhost:4000/api/v1`). Send `Authorization: Bearer <Supabase access token>`. Responses are `{ "data": … }`; errors are `{ "error": { "code", "message", "requestId" } }` with no internal details.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/health` | public | Liveness check |
| GET | `/me` | signed in | Profile and role |
| GET | `/events` | signed in | Server-Sent Events stream of ticket changes, scoped to the caller |
| GET | `/author/books` | author | The caller's books with royalty figures and a summary |
| GET | `/author/tickets` | author | The caller's tickets |
| POST | `/author/tickets` | author | Create a ticket |
| GET | `/author/tickets/{ticketId}` | author | One ticket with its author-visible thread |
| GET | `/admin/tickets` | admin | Queue with filters, urgency sort and paging |
| GET | `/admin/tickets/summary` | admin | Queue counts |
| GET | `/admin/tickets/{ticketId}` | admin | Ticket with author context, thread, notes, AI suggestion and timeline |
| PATCH | `/admin/tickets/{ticketId}` | admin | Status, category/priority override, (un)assign; optimistic locking |
| POST | `/admin/tickets/{ticketId}/messages` | admin | Send a reply (optionally changing status) |
| GET, POST | `/admin/tickets/{ticketId}/notes` | admin | Internal notes, never visible to authors |
| POST | `/admin/tickets/{ticketId}/draft` | admin | Cached AI draft, or generate/regenerate one |
| POST | `/admin/tickets/{ticketId}/triage` | admin | Re-run AI triage for a ticket in manual review |

Specified but not built (P2): author follow-up messages (`POST /author/tickets/{ticketId}/messages`) and the AI usage view (`GET /admin/ai/usage`).

**Rate limits:** new queries 5 per 10 min and 20 per day per author (plus a database backstop); draft regeneration 10 per min per admin and 5 per ticket per day; triage re-runs 5 per min per admin; 300 requests per 5 min per signed-in user overall; requests without a valid session and health checks are also limited per IP. Over a limit: `429` with `Retry-After`.

## AI integration

| Step | What happens |
|---|---|
| Triage (background) | Category (the six assignment categories), priority, confidence and a short rationale. Policy floors raise priority for known urgent cases (e.g. long-missing royalties). Admin overrides always win. |
| Facts | Only the ticket author's own records: the selected book or their royalty totals and payout calendar. No other author's data reaches the model. |
| Knowledge base | A small, versioned BookLeaf KB in code, selected by category (no vector search). |
| Draft (on request) | Empathetic reply grounded in the KB and facts, a missing-information list and an escalation hint. Server-side checks enforce the house style; amounts or dates that don't match the facts are flagged to the admin. |
| Guardrails | Ticket text is passed as escaped, delimited data (prompt-injection attempts are treated as content); strict output schemas with one repair attempt; Groq fallback; circuit breaker; daily token budget; requests paced (`AI_REQUEST_MIN_INTERVAL_MS`, default 8 s). |
| Failure | Ticket goes to manual review; the admin triages and replies by hand. Setting `AI_PRIMARY_PROVIDER=none` turns AI off entirely. |

**Evaluation** (golden sets bound to the seed data, run through the production code; [details](.agent/verification/README.md)):

- Triage, 36 labelled tickets: **36/36 category, 36/36 priority**, 3/3 prompt-injection cases handled normally.
- Drafts, the assignment's sample queries: 48/49 automatic checks; every reply was also read by a person. The one failing check needs production timelines BookLeaf hasn't supplied, so drafts say the estimate is awaiting confirmation instead of inventing one.

Full behaviour: [AI_SPEC.md](AI_SPEC.md). Approach and trade-offs: [WRITEUP.md](WRITEUP.md).

## Security

- Authentication on every route except health; role separation between `/author/*` and `/admin/*`; identity always from the verified token, never from the request body.
- Row-level security on every table, tested with two authors and an admin; another author's ticket answers `404`.
- Strict zod schemas (unknown fields rejected), plain-text rendering only, 32 KB body limit.
- CORS allowlist of the two portal origins; helmet headers including HSTS; a Content-Security-Policy on both portals; no stack traces or provider errors in responses.
- Secrets live only in the API's environment (never `NEXT_PUBLIC_*`); the deployed JavaScript was scanned and contains none.
- Admin actions (status, overrides, assignment, replies, notes, AI drafts) are written to an audit log without message text.

Checklist and findings: [.agent/SECURITY_REVIEW_CHECKLIST.md](.agent/SECURITY_REVIEW_CHECKLIST.md). Threats: [.agent/THREAT_MODEL.md](.agent/THREAT_MODEL.md).

## Repository layout

| Path | Contents |
|---|---|
| `author-frontend/` | Author portal (Next.js) |
| `admin-frontend/` | Support console (Next.js) |
| `backend/` | REST API, AI triage/drafts/evals, offline and live test suites |
| `packages/shared/` | Contract types, enums, validation schemas, labels, payout/SLA calendars |
| `packages/ui/` | Shared UI components and design tokens |
| `supabase/migrations/` | Schema and row-level security policies |
| `supabase/seed/bookleaf_sample_data.json` | The assessment dataset, byte-identical to the provided file |
| `render.yaml`, `*/vercel.json` | Hosting configuration |
| Root `*.md`, `.agent/`, `.front/`, `.back/` | Product, design, API and process documentation ([map](DOCUMENTATION_MAP.md)) |
| `docs/blueprint/` | The planning blueprint the project followed |

## Run it locally

**Requirements:** Node.js 24 (≥ 20.9 works) and **npm ≥ 11**. npm 10.2.x crashes on this workspace (`Cannot read properties of null (reading 'edgesOut')`); Node 24 ships npm 11.

1. Install every workspace from the lockfile:

   ```bash
   npm ci
   ```

2. Create `backend/.env`, `author-frontend/.env.local` and `admin-frontend/.env.local` from the sections of [.env.example](.env.example). The API needs the Supabase URL, publishable key and secret key; each portal gets only its three `NEXT_PUBLIC_*` values (API base ending in `/api/v1`). With `AI_PRIMARY_PROVIDER=none` no model keys are needed. Where each value comes from: [.agent/CREDENTIALS_GUIDE.md](.agent/CREDENTIALS_GUIDE.md).
3. For a new Supabase project, apply `supabase/migrations/` in order, then load the dataset (`npm run seed` is a dry run; `npm run seed:apply` writes). See [.back/DEPLOYMENT.md](.back/DEPLOYMENT.md).
4. Build the shared packages and apps once:

   ```bash
   npm run build
   ```

5. Start each part in its own terminal:

   ```bash
   npm run dev:backend
   ```

   ```bash
   npm run dev:author
   ```

   ```bash
   npm run dev:admin
   ```

| Part | Local URL |
|---|---|
| Author portal | http://localhost:3000 |
| Support console | http://localhost:3001 |
| API health | http://localhost:4000/api/v1/health |
| Swagger UI | http://localhost:4000/api/docs |

Helper checks that print names and pass/fail only, never secret values: `npm run check:env` (credentials), `npm run check:db` (schema, policies, grants), `npm run check:ai` (AI configuration; `check:ai:live` makes one tiny call per model).

## Tests

| Suite | Command | Result (2026-10-22) |
|---|---|---|
| Format, lint, OpenAPI lint, typecheck, backend tests, all builds | `npm run check` | Pass; 375 backend tests |
| Author portal logic | `npx --no-install vitest run --root author-frontend` | 30 pass |
| Support console logic | `npx --no-install vitest run --root admin-frontend` | 36 pass |
| Live suites against Supabase (RLS, auth, books, tickets, events) | `npm run test:live` | Pass in earlier runs; they create and delete their own tickets |
| AI evals | `npm run eval:triage`, `npm run eval:drafts` (mock); `:live` variants call the providers | See the AI section |

Backend tests cover every documented route for anonymous (401) and wrong-role (403) access, production error handling, CORS, rate limits, token checks, ticket rules, the queue, replies, notes, SSE scoping and the AI pipeline. Evidence for each milestone: [.agent/verification/](.agent/verification/README.md).

## Deployment

| Piece | Host | Key settings |
|---|---|---|
| API | Render web service (free) | Root directory: repo root. Build `npx -y npm@11.6.2 ci --include=dev && npm run build:packages && npm run build -w backend`. Start `npm run start -w backend`. Health check `/api/v1/health`. Node 24 |
| Author portal | Vercel | Root directory `author-frontend`; install and build come from its `vercel.json` |
| Support console | Vercel | Root directory `admin-frontend`; same pattern |

API environment: `NODE_ENV=production`, `CORS_ALLOWED_ORIGINS` (the two portal origins), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `AI_PRIMARY_PROVIDER=gemini`, `AI_FALLBACK_PROVIDER=groq`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `TRUST_PROXY_HOPS`. Portal environment (baked in at build time): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_BASE_URL`. Step-by-step runbook, checks and troubleshooting: [.back/DEPLOYMENT.md](.back/DEPLOYMENT.md).

## Known limitations

- **Cold starts:** the free Render instance sleeps after 15 idle minutes; the first request takes about a minute.
- **One API instance:** live updates, rate limits, the AI queue and pacing are in memory and reset on restart or redeploy (clients reconnect and re-sync).
- **Per-IP limits on Render:** the API can't yet see each visitor's real IP behind Render's proxies, so the per-IP limits (health checks, requests without a valid session) aren't per visitor; the per-user limits are unaffected.
- **AI on free tiers:** calls are paced 8 s apart and a draft can take 15–30 s; provider quotas can push tickets to manual review. Drafts are suggestions: an admin must review each one.
- **Production timelines** aren't in the data, so drafts don't promise dates for books in production.
- **Not built (P2):** real attachment upload (the form records a file name only), author follow-up messages, the AI usage dashboard.
- **Dependencies:** the production dependency audit is clean; a development-only lint dependency (`braces`) has an advisory with no fix released.

## Assessment deliverables

| Deliverable | Where |
|---|---|
| Public source repository | <https://github.com/amitprasad21/BookLeaf> |
| Live demo (both portals, pre-seeded) | [Live demo](#live-demo) |
| README: setup, architecture, AI integration, API docs, test credentials, limitations | This file |
| One-page approach write-up | [WRITEUP.md](WRITEUP.md) |

## Further reading

[PRODUCT.md](PRODUCT.md) (problem and users) · [PRD.md](PRD.md) (requirements) · [ARCHITECTURE.md](ARCHITECTURE.md) · [AI_SPEC.md](AI_SPEC.md) · [INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md) · [TASKS.md](TASKS.md) (plan and status) · [PROJECT_STATE.md](PROJECT_STATE.md) · [GIT_WORKFLOW.md](GIT_WORKFLOW.md)
