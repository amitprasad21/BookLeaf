# Project State

**Owns:** the current milestone, verified facts, blockers and open questions. Update at the end of every session.

**Last updated:** 2026-10-19
**Milestone:** Phase 0, SETUP-2, SETUP-3 and API-1 are merged to `main`. DB-1 (Supabase project + credentials) is merged to `main`. DB-2 (initial schema, applied and verified) is merged to `main`. DB-3 (RLS policies) and DB-4 (seed) are **applied, seeded, verified and merged** (project `jhszxq…`). API-2 (auth, role guards, `GET /me`), API-3 (`GET /author/books` + royalty summary + shared payout calendar), API-4 (author tickets), API-5 (admin queue + summary; migration `20261018090000_queue_urgency_rank.sql` applied by the user) and API-6 (admin ticket detail + PATCH) are merged. API-7 (admin replies + internal notes; migration `20261018120000_admin_reply_function.sql` applied by the user) is merged. AI-1/AI-2 (providers: Gemini primary, Groq fallback; router, breaker, budget, usage) are merged. AI-3 (triage: queue, sweeper, floors, manual re-run) is done, verified and committed on `feature/ai-triage`, not yet merged. No AI, portal screens or deployment yet.

## Verified facts (with evidence)

| Fact | Evidence |
|---|---|
| Assignment PDF, sample JSON and blueprint bundle v2 were read in full | Session 2026-10-16; see [SOURCE_REGISTER.md](SOURCE_REGISTER.md) |
| Sample data: 10 authors, 18 books; for every book, copies × royalty-per-copy = earned and paid + pending = earned | Python check run 2026-10-16 ([.agent/verification/2026-10-16-phase0.md](.agent/verification/2026-10-16-phase0.md)) |
| `supabase/seed/bookleaf_sample_data.json` is byte-identical to the provided file | `cmp` run 2026-10-16 (same record) |
| Git repository initialised; Phase 0 committed as three commits on `docs/initial-setup`; `main` has no commits until merged; nothing pushed | `git log --oneline` |
| Local tools: git 2.44, Node 24.12, npm 10.2.5, pnpm 10.6.1, gh 2.88.1 | Version check 2026-10-16 |
| Not installed: Supabase CLI, Vercel CLI, pandoc, XeLaTeX, Graphviz | Version check 2026-10-16 |
| `main` created at the Phase 0 docs commit (with the user's approval) | `git branch -v` |
| Workspace scaffold: `npm install` (npm 11.6.2) adds 206 packages; all 5 workspaces build; typecheck passes; 4 backend tests pass | [.agent/verification/2026-10-16-setup2.md](.agent/verification/2026-10-16-setup2.md) |
| Running servers: `/api/v1/health` returns 200 with the success envelope; unknown routes return the 404 error envelope; both portals return 200 with baseline security headers | Same file |
| The global npm 10.2.5 on PATH crashes on this workspace (npm bug); Node's bundled npm 11.6.2 works | Same file |
| `main` fast-forwarded to the scaffold (`81446bf`) with the user's approval | `git branch -v` |
| `npm run check` (format, lint, OpenAPI lint, typecheck, tests, build) exits 0; `openapi.yaml` is valid OpenAPI 3.1 with 18 operationIds; fresh `npm ci` rebuilds shared packages via `prepare` | [.agent/verification/2026-10-16-setup3.md](.agent/verification/2026-10-16-setup3.md) |
| `main` fast-forwarded to SETUP-3 (`6898131`) with the user's approval | `git branch -v` |
| `main` fast-forwarded to API-1 (`af9fc08`) with the user's approval | `git branch -v` |
| AI-3: tickets are triaged in the background after saving (never blocking creation), with one repair attempt, priority floors, admin values never replaced, a sweeper for pending/failed work and a capped manual re-run; live on Gemini an injection attempt was ignored and "no royalty for six months" came out royalty/critical; 267 offline tests, 57 live tests | [.agent/verification/2026-10-19-ai3.md](.agent/verification/2026-10-19-ai3.md) |
| `main` fast-forwarded to AI-1/AI-2 (`9d6fc78`) with the user's approval | `git branch -v` |
| AI-1/AI-2: Gemini (`gemini-3.5-flash-lite` triage, `gemini-3.8-flash` drafts) and Groq `openai/gpt-oss-120b` fallback answer one synthetic structured call each (live, free tier); REST adapters, router failover, circuit breaker, daily budget and usage events covered by 55 offline tests (236 total) | [.agent/verification/2026-10-19-ai1-ai2.md](.agent/verification/2026-10-19-ai1-ai2.md) |
| `main` fast-forwarded to API-7 (`4d09a91`) with the user's approval | `git branch -v` |
| API-7: admin replies are atomic (message, first response, status in one Postgres function, refused for authors even when called directly); replies on resolved/closed tickets need a reopen; internal notes never reach authors; replies and notes audited without text; 181 offline tests, 53 live tests, full support-loop server smoke | [.agent/verification/2026-10-18-api7.md](.agent/verification/2026-10-18-api7.md) |
| `main` fast-forwarded to API-6 (`bd0f2f2`) with the user's approval | `git branch -v` |
| API-6: admin ticket detail (author context with royalty figures, thread, notes, AI suggestion, timeline) and PATCH (status machine, overrides, self-assignment) with an optimistic lock that holds under a live two-admin race; every change audited in order; 159 offline tests, 46 live tests, live server smoke | [.agent/verification/2026-10-18-api6.md](.agent/verification/2026-10-18-api6.md) |
| `main` fast-forwarded to API-5 (`abefb28`) with the user's approval | `git branch -v` |
| API-5: admin queue sorts by urgency in the database (generated `urgency_rank`), filters by status, category, priority incl. untriaged, assignee, AI status, overdue, India business dates and search; `slaState` and summary counts follow the shared SLA rules; 138 offline tests, 39 live tests, live server smoke, search text redacted from logs | [.agent/verification/2026-10-18-api5.md](.agent/verification/2026-10-18-api5.md) |
| `main` fast-forwarded to API-4 (`551e0f9`) with the user's approval | `git branch -v` |
| API-4: author tickets save first (`ai_status=pending`), are audited (`ticket.created`) and rate-limited (5 / 10 min per author); another author's ticket → 404 and their `bookId` → 400; 106 offline tests, 32 live tests, live server smoke, no test tickets left behind | [.agent/verification/2026-10-18-api4.md](.agent/verification/2026-10-18-api4.md) |
| `main` fast-forwarded to API-3 (`12c49ba`) with the user's approval | `git branch -v` |
| API-3: `GET /author/books` returns each author's exact dataset books + royalty summary (paise-safe totals, ₹1,000 rollover, next payout deadline from the shared calendar); 88 offline tests, 27 live tests | [.agent/verification/2026-10-18-api3.md](.agent/verification/2026-10-18-api3.md) |
| API-2: `authenticate` (getClaims, ES256, local JWKS) + role guards + `GET /me`; 69 offline tests and 21 live tests (6 auth with real tokens + 15 RLS); live server returns Priya's and the admin's profiles, and 401/403 where expected | [.agent/verification/2026-10-18-api2.md](.agent/verification/2026-10-18-api2.md) |
| Seed applied: 10/10 authors and 18/18 books match the dataset field by field; 12 logins (10 authors + 2 admins) with profiles; admin-API user creation works with sign-ups off | `npm run seed:apply` → Result OK ([.agent/verification/2026-10-18-db3-db4.md](.agent/verification/2026-10-18-db3-db4.md)) |
| RLS policies + grants live in `jhszxq…`: 15/15 live access-rule tests pass; test data cleaned up (tickets/messages/notes 0) | `npm run test:rls`, `npm run check:db` → OK (same record) |
| Initial schema applied: 9 tables exist (0 rows), anon access denied, royalty balance constraint enforced | `npm run check:db` → OK ([.agent/verification/2026-10-17-db2.md](.agent/verification/2026-10-17-db2.md)) |
| Supabase project exists (created by the user). Backend and both frontends have the URL + **publishable** key; the **secret** key is in `backend/.env` only; publishable key reaches the project; secret key accepted (read-only admin call); new-user sign-ups disabled; no secret in any frontend env file | `npm run check:env` → Result: OK ([.agent/verification/2026-10-17-db1.md](.agent/verification/2026-10-17-db1.md)) |
| API-1 backend skeleton: 28 backend tests pass (env, request id, error envelope, CORS, docs, logging, redaction); live server checks pass for both `npm start` (dist) and `npm run dev` (tsx); Swagger UI renders under helmet CSP | [.agent/verification/2026-10-16-api1.md](.agent/verification/2026-10-16-api1.md) |

## Not done / not verified

- No deployment. The running app still uses the mock AI provider until `AI_PRIMARY_PROVIDER=gemini` and `AI_FALLBACK_PROVIDER=groq` are set in `backend/.env`. Not built yet: SSE (API-8), AI drafts (AI-4), evals (AI-6) and the portal screens. Author follow-up messages are deferred (X-2).
- Rate limits are in-memory per instance (A-15); the database trigger is the cross-instance cap.
- Mermaid diagrams in the docs have not been rendered locally (no renderer installed); they target GitHub's renderer.
- The blueprint PDF was not regenerated (pandoc/XeLaTeX not installed, and not required for this phase).

## Blockers

| ID | Blocker | Blocks | Next action |
|---|---|---|---|
| B-01 | ~~Approval to install dependencies~~ | Resolved 2026-10-16 (approved pinned list) | n/a |
| B-02 | ~~Supabase project credentials~~ | Resolved 2026-10-17 (DB-1) | n/a |
| B-04 | ~~Migration route~~ | Resolved 2026-10-17: SQL Editor by the user, verified with `npm run check:db` (D-021) | n/a |
| B-03 | ~~LLM provider confirmation + key~~ | Resolved 2026-10-18: Gemini + Groq keys provided; D-028 | n/a |

## Open questions

| ID | Question | Why it matters | Default if unanswered |
|---|---|---|---|
| Q-01 | When was the assignment received (deadline = +4 days)? | Scope and stretch-goal decisions | Assume received 2026-10-16 (bundle file dates); deadline 2026-10-20 |
| Q-02 | Can the four missing sources be provided: monochrome UI spec, "Defend What You Ship" AI Field Guide v2, skills/tools registry, security screenshot? | UI spec is named canonical for design | Provisional monochrome tokens ([.front/DESIGN_SYSTEM.md](.front/DESIGN_SYSTEM.md)); blueprint's summaries used for the rest |
| Q-03 | Should payout-window facts use the real current date or a fixed demo "as-of" date? | With the real date, most sample balances look overdue | Real date; admin verifies before sending |
| Q-04 | ~~Confirm primary LLM and fallback~~ | Answered 2026-10-18 | Gemini primary (per-task models), Groq fallback, free tiers (D-028) |
| Q-05 | May the live demo be pre-loaded with a handful of demo tickets submitted through the real API? | An empty queue demos poorly; must not be confused with the provided dataset | Don't seed tickets unless approved |
| Q-06 | Confirm hosting: Vercel (two frontends) + Render (backend) + Supabase cloud | Accounts and credentials | Proposed default |
| Q-07 | Collaborator email from BookLeaf | Repository access for evaluators | Add when provided |

## Next step

Fast-forward `main` to `feature/ai-triage` (needs approval). Save `AI_PRIMARY_PROVIDER=gemini` and `AI_FALLBACK_PROVIDER=groq` in `backend/.env` (still missing: the running app uses the mock until then). Then **AI-4**: drafts (KB sections, facts builder, prompt, validation, fact guard, context-hash reuse, `/draft`).
