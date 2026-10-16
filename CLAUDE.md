# CLAUDE.md

Entry point for Claude Code. Codex uses [AGENTS.md](AGENTS.md); both follow the same workflow.

## Start every session with

1. [AI_WORKFLOW.md](AI_WORKFLOW.md): the session procedure (plan → approval gates → implement → verify → hand over).
2. [PROJECT_STATE.md](PROJECT_STATE.md), [TASKS.md](TASKS.md), [.agent/HANDOVER.md](.agent/HANDOVER.md).
3. [.agent/CONSTRAINTS.md](.agent/CONSTRAINTS.md): non-negotiable rules.
4. [GIT_WORKFLOW.md](GIT_WORKFLOW.md): the only Git policy.

Then read only what the task needs ([DOCUMENTATION_MAP.md](DOCUMENTATION_MAP.md)).

## Project in one paragraph

BookLeaf Author Support & Communication Portal (take-home assessment). Two Next.js frontends (`author-frontend`, `admin-frontend`), one Express + TypeScript REST API (`backend`), Supabase Postgres + Auth with RLS, and AI triage/drafting with manual fallback. Seed data in `supabase/seed/bookleaf_sample_data.json` must load exactly.

## Hard rules (summary; full list in .agent/CONSTRAINTS.md)

- Never ask for, print, log or commit secrets. Credentials are handled just in time per [.agent/CREDENTIALS_GUIDE.md](.agent/CREDENTIALS_GUIDE.md).
- Tickets save before AI; AI never sends replies.
- No installs, migrations on hosted DBs, commits, pushes or deploys without explicit approval.
- Report only checks that actually ran.
