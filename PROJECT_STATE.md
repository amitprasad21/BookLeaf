# Project State

**Owns:** the current milestone, verified facts, blockers and open questions. Update at the end of every session.

**Last updated:** 2026-10-17
**Milestone:** Phase 0, SETUP-2, SETUP-3 and API-1 are merged to `main`. DB-1 (Supabase project + credentials) is done and committed on `feature/db-supabase`, not yet merged. No product features yet (no schema, auth, tickets or AI).

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
| Supabase project exists (created by the user). Backend and both frontends have the URL + **publishable** key; the **secret** key is in `backend/.env` only; publishable key reaches the project; secret key accepted (read-only admin call); new-user sign-ups disabled; no secret in any frontend env file | `npm run check:env` → Result: OK ([.agent/verification/2026-10-17-db1.md](.agent/verification/2026-10-17-db1.md)) |
| API-1 backend skeleton: 28 backend tests pass (env, request id, error envelope, CORS, docs, logging, redaction); live server checks pass for both `npm start` (dist) and `npm run dev` (tsx); Swagger UI renders under helmet CSP | [.agent/verification/2026-10-16-api1.md](.agent/verification/2026-10-16-api1.md) |

## Not done / not verified

- No database, no Supabase project, no LLM key, no deployment, no feature code (auth, books, tickets, AI).
- Only scaffold tests exist (health route, 404 envelope, env validation).
- Mermaid diagrams in the docs have not been rendered locally (no renderer installed); they target GitHub's renderer.
- The blueprint PDF was not regenerated (pandoc/XeLaTeX not installed, and not required for this phase).

## Blockers

| ID | Blocker | Blocks | Next action |
|---|---|---|---|
| B-01 | ~~Approval to install dependencies~~ | Resolved 2026-10-16 (approved pinned list) | n/a |
| B-02 | ~~Supabase project credentials~~ | Resolved 2026-10-17 (DB-1) | n/a |
| B-04 | Way to apply migrations to the hosted database (just in time, at DB-2) | DB-2 onwards | Choose: Supabase CLI via `npx supabase` (install approval + access token/DB password) or pasting SQL into the dashboard SQL editor |
| B-03 | LLM provider confirmation + key (just in time) | AI-1 live smoke test only; mock provider unblocks everything else | Decide at AI-1 |

## Open questions

| ID | Question | Why it matters | Default if unanswered |
|---|---|---|---|
| Q-01 | When was the assignment received (deadline = +4 days)? | Scope and stretch-goal decisions | Assume received 2026-10-16 (bundle file dates); deadline 2026-10-20 |
| Q-02 | Can the four missing sources be provided: monochrome UI spec, "Defend What You Ship" AI Field Guide v2, skills/tools registry, security screenshot? | UI spec is named canonical for design | Provisional monochrome tokens ([.front/DESIGN_SYSTEM.md](.front/DESIGN_SYSTEM.md)); blueprint's summaries used for the rest |
| Q-03 | Should payout-window facts use the real current date or a fixed demo "as-of" date? | With the real date, most sample balances look overdue | Real date; admin verifies before sending |
| Q-04 | Confirm primary LLM (proposed Claude Haiku 5.5) and whether a fallback provider is wanted | Cost, quality, credentials | Decide at AI-1; mock provider until then |
| Q-05 | May the live demo be pre-loaded with a handful of demo tickets submitted through the real API? | An empty queue demos poorly; must not be confused with the provided dataset | Don't seed tickets unless approved |
| Q-06 | Confirm hosting: Vercel (two frontends) + Render (backend) + Supabase cloud | Accounts and credentials | Proposed default |
| Q-07 | Collaborator email from BookLeaf | Repository access for evaluators | Add when provided |

## Next step

Merge `feature/db-supabase` into `main` (needs approval). Then **DB-2: schema migrations**. The SQL can be written and reviewed first. Applying it to the hosted database needs a decision on the migration route (B-04), explained just in time.
