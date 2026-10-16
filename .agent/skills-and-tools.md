# Skills and Tools

**Owns:** an inventory of tools actually available in the development environment and their install state. **Listing a tool here is not permission to install it.** Installs follow the approval gate in [AI_WORKFLOW.md](../AI_WORKFLOW.md) §3.

The blueprint refers to a separate skills/tools registry (S-09); it was not provided. This file records what was observed instead.

## Local machine (checked 2026-10-16)

| Tool | State | Used for |
|---|---|---|
| git 2.44.0 | Installed | Version control |
| Node.js 24.12.0 / npm 10.2.5 | Installed | Workspaces, build, tests |
| pnpm 10.6.1 | Installed (not used; npm workspaces chosen) | n/a |
| GitHub CLI 2.88.1 | Installed | Creating the public repo / PRs, **only when approved** |
| Python 3.14 (+ pypdf) | Installed | Ad-hoc data checks (e.g. seed verification during Phase 0) |
| pdftotext (poppler, mingw64) | Installed | Reading the assignment PDF |
| Supabase CLI | **Not installed** | Migrations/linking. Can run via `npx supabase` once approved at DB-2 |
| Vercel CLI | **Not installed** | Optional; dashboard Git deploys work without it |
| pandoc / XeLaTeX | **Not installed** | Only needed to regenerate the blueprint PDF |
| Graphviz (`dot`) | **Not installed** | Only needed to re-render blueprint diagrams |
| PyYAML | **Not installed** | n/a (OpenAPI validated another way, see verification log) |

## Claude Code capabilities available in this environment

| Capability | Use in this project |
|---|---|
| `security-review` skill | Security review of the pending diff before deploy (control 16) |
| `code-review` skill | Correctness review of a branch or diff |
| `claude-api` skill | Reference for Claude model IDs, structured outputs, caching, error handling (AI-1..AI-6) |
| Built-in browser pane | Visual checks of both portals at the required viewports (QA-1) |
| Artifacts | Optional sharing of reports; not needed for the build |

## Planned project dependencies

Proposed in [TASKS.md](../TASKS.md) SETUP-2 and awaiting approval. Versions are pinned at install time and recorded here afterwards.
