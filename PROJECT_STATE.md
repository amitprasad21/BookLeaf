# Project State

**Owns:** the current milestone, verified facts, blockers and open questions. Update at the end of every session.

**Last updated:** 2026-10-16
**Milestone:** Phase 0 (sources inspected, documentation tree created, repository initialised). Implementation not started.

## Verified facts (with evidence)

| Fact | Evidence |
|---|---|
| Assignment PDF, sample JSON and blueprint bundle v2 were read in full | Session 2026-10-16; see [SOURCE_REGISTER.md](SOURCE_REGISTER.md) |
| Sample data: 10 authors, 18 books; for every book, copies × royalty-per-copy = earned and paid + pending = earned | Python check run 2026-10-16 ([.agent/verification/2026-10-16-phase0.md](.agent/verification/2026-10-16-phase0.md)) |
| `supabase/seed/bookleaf_sample_data.json` is byte-identical to the provided file | `cmp` run 2026-10-16 (same record) |
| Git repository initialised; Phase 0 committed as three commits on `docs/initial-setup`; `main` has no commits until merged; nothing pushed | `git log --oneline` |
| Local tools: git 2.44, Node 24.12, npm 10.2.5, pnpm 10.6.1, gh 2.88.1 | Version check 2026-10-16 |
| Not installed: Supabase CLI, Vercel CLI, pandoc, XeLaTeX, Graphviz | Version check 2026-10-16 |

## Not done / not verified

- No application code, no database, no Supabase project, no LLM key, no deployment.
- No tests exist; nothing has been run against an API.
- Mermaid diagrams in the docs have not been rendered locally (no renderer installed); they target GitHub's renderer.
- The blueprint PDF was not regenerated (pandoc/XeLaTeX not installed, and not required for this phase).

## Blockers

| ID | Blocker | Blocks | Next action |
|---|---|---|---|
| B-01 | Approval to install dependencies and scaffold the workspace | SETUP-2 onwards | User approves the package list in [TASKS.md](TASKS.md) SETUP-2 |
| B-02 | Supabase project credentials (just in time) | DB-1 | Guided setup when DB-1 starts ([.agent/CREDENTIALS_GUIDE.md](.agent/CREDENTIALS_GUIDE.md)) |
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

SETUP-2: scaffold the npm workspace (backend, two Next.js apps, shared packages). This needs install approval (B-01).
