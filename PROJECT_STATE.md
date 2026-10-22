# Project State

**Owns:** the current milestone, verified facts, blockers and open questions. Update at the end of every session.

**Last updated:** 2026-10-22
**Milestone:** Core data/auth, API-1..8, both portals, shared UI and AI-1..8 are implemented. `feature/hardening` contains security fixes, provider/queue pacing, draft-policy repair checks and hosting preparation. The latest draft .5 run corrects the previously observed action/tone failures: eight answers, 48/49 automatic checks and no fact warnings, with Gemini and Groq exercised. Production estimates remain awaiting confirmation by the user's choice (AI-9 deferred). All 441 offline tests and production builds pass. The write-up is complete; README and deployment instructions are prepared. Browser QA, human security review, an unpatched development advisory and hosting access still prevent release. `main` is public at github.com/amitprasad21/BookLeaf and deployed by the user: API on Render (`bookleaf-338a.onrender.com`), portals on Vercel (`bookleaf-author.vercel.app`, `bookleafsupport.vercel.app`). Read-only live checks pass; the author portal's live build still calls `localhost:4000` (D-1) and must be redeployed. See [.agent/verification/2026-10-22-deployment.md](.agent/verification/2026-10-22-deployment.md).

## Verified facts (with evidence)

| Fact | Evidence |
|---|---|
| 2026-10-22 release preparation: 441 offline tests, 12 read-only live Supabase auth/books tests, all builds; draft .5 live review; runtime pacing; local secret/history scan; production audit zero. Code/hosting committed locally as `4576bcf` / `36b11ff`. User chose local-only review and confirmation-pending production estimates | [.agent/verification/2026-10-22-release-preparation.md](.agent/verification/2026-10-22-release-preparation.md) |
| 2026-10-21 hardening: global abuse limit counts failures, JWT signature regression, normalized redirect escape fixed in both portals. Payout facts separate the earlier passed deadline from the next scheduled one. Production audit zero; development audit has 5 high entries from one braces advisory | [.agent/verification/2026-10-21-hardening-ai-followup.md](.agent/verification/2026-10-21-hardening-ai-followup.md) |
| 2026-10-21 approved live evaluation: triage 36/36 category and priority, 3/3 injections; final draft prompt .4 scores 48/49 checks, 7/8 cases, no amount/date warnings. Missing production ETA and manual findings (unsupported finance-contact claim, missed apologies) remain open. Final full check and 433 offline tests pass | [.agent/verification/2026-10-21-live-ai-followup.md](.agent/verification/2026-10-21-live-ai-followup.md) |
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
| Signed-in browser checks (user signed in; one approved test ticket, deleted afterwards): My Books matches the seed incl. BK013's null wording; query validation; console queue, ticket tabs, AI draft panel, triage, notes, timeline; live updates reach the author in 1–3 s and the console queue shows "Show 1 update"; notes never reach the author. Five UI fixes made (1024 px book table, status wording, empty state, sent notice, filter layout). Finding: drafts can name the wrong overdue quarter | [.agent/verification/2026-10-20-ui-checks.md](.agent/verification/2026-10-20-ui-checks.md) |
| `main` fast-forwarded to AI-6 (`d35aa0a`) with the user's approval | `git branch -v` |
| AI-6: 36-case triage golden set and the assignment's 7 draft queries, scored through the production paths. Live (free tiers): category 36/36, priority 34/36, 0 schema failures, 3/3 injections; drafts 34/38 checks, no fact warnings, every reply read. A 2 s-paced burst exhausted both free per-minute quotas (7 cases re-run at 8 s). 341 offline tests | [.agent/verification/2026-10-20-ai6.md](.agent/verification/2026-10-20-ai6.md) |
| `main` fast-forwarded to API-8 (`1127692`) with the user's approval | `git branch -v` |
| API-8: `GET /api/v1/events` streams identifier-only ticket events; admins get all, an author only updates to their own tickets (live: a reply reached the owner and admin, never another author, and no reply text travelled); streams re-authenticate every 10 min, 5 per user; both portals stop polling while live and re-sync on reconnect. 323 offline backend tests, 4 live event tests + 57 other non-AI live tests, client backoff tests, `npm run check` exit 0 | [.agent/verification/2026-10-20-api8.md](.agent/verification/2026-10-20-api8.md) |
| `main` fast-forwarded to the support console (`a60195e`) with the user's approval | `git branch -v` |
| Support console (in progress): queue with URL filters, summary shortcuts, "Show N updates" polling and inline assign; ticket page with triage controls (allowed transitions, overrides with AI source and confidence, policy floor, retry triage), conflict handling, author context, notes, timeline; reply editor with the AI draft (warnings, missing information, escalation, regenerate, manual mode). Shared admin DTOs and labels (KB/floor names checked against the backend). `npm run check` exit 0 (303 backend tests), 29 admin + 22 author logic tests, production build, signed-out browser checks; signed-in screens not yet checked | [.agent/verification/2026-10-19-admin-portal.md](.agent/verification/2026-10-19-admin-portal.md) |
| `main` fast-forwarded to the author portal (`7a688a9`) with the user's approval | `git branch -v` |
| FE-1 + author portal (in progress): `packages/ui` primitives and icons, shared formatters and DTO types, author sign-in/session/API client, My Books, Raise a query, My Tickets and ticket detail (15 s polling). Typecheck, lint, production build, 33 new logic tests (11 shared + 22 author) and the signed-out browser checks pass; signed-in screens not yet checked | [.agent/verification/2026-10-19-fe1-author.md](.agent/verification/2026-10-19-fe1-author.md) |
| `main` fast-forwarded to AI-4 (`1e9a4bd`) with the user's approval | `git branch -v` |
| AI-4: admins get reply drafts grounded in the KB and the author's own facts (reused by context hash, regenerate capped, fact warnings, standard sign-off); on the free tier Gemini 3.8 Flash was too slow, so drafts use 3.5 Flash-Lite (about 2 s) with Groq fallback; a live draft that called an overdue payment "not overdue" led to explicit facts-reading rules; 290 offline tests, 61 live tests | [.agent/verification/2026-10-19-ai4.md](.agent/verification/2026-10-19-ai4.md) |
| `main` fast-forwarded to AI-3 (`444a223`) with the user's approval | `git branch -v` |
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

- No deployment. Author follow-up messages remain deferred (X-2). Current draft-policy guards target observed errors but do not prove semantic correctness; admins still review every reply. Authoritative stage durations (AI-9) are deferred because the user confirmed they are unavailable. Runtime pacing is implemented; the latest live draft run exercised both Gemini and Groq.
- Signed-in browser checks not yet run: AE-01, AE-06, the conflict notice with two admins, the full viewport matrix, 200% zoom, keyboard-only and screen reader (see the ui-checks record). Frontend component tests (Testing Library) and end-to-end tests (Playwright) are not installed; the author logic tests run with the root-hoisted Vitest, which `author-frontend/package.json` doesn't declare yet.
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
| B-05 | BookLeaf and hosting dashboards are signed out | Remaining signed-in browser QA and DEP-1/2 | User signs in directly in the open tabs; never paste credentials into chat |
| B-06 | Development-only braces advisory has no listed patch; separate human security review outstanding | Release acceptance | Maintainer reviews documented exposure and disposition. User selected local-only review; no source sent to Claude |

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
| Q-08 | Approved production durations / affected book's completion estimate | Answered: user says unavailable; keep estimates awaiting production confirmation | Missing estimate is explicit; AI-9 data enrichment deferred, original rubric remains failing |

## Next step

Finish signed-in browser QA after the user signs in, obtain human disposition of the local security record, redeploy the author portal with the Render API base (D-1), then run the live write journey (ticket → AI triage → draft → reply, and the AI-off path) with approval or in the user's browser. Fill in real demo URLs and intended demo credentials only after hosting is verified. Do not invent production estimates or treat the local-only review as an independent Claude/human review.
