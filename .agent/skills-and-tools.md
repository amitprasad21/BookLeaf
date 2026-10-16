# Skills and Tools

**Owns:** an inventory of tools actually available in the development environment and their install state. **Listing a tool here is not permission to install it.** Installs follow the approval gate in [AI_WORKFLOW.md](../AI_WORKFLOW.md) §3.

The blueprint refers to a separate skills/tools registry (S-09); it was not provided. This file records what was observed instead.

## Local machine (checked 2026-10-16)

| Tool | State | Used for |
|---|---|---|
| git 2.44.0 | Installed | Version control |
| Node.js 24.12.0 | Installed | Runtime, build, tests |
| npm 11.6.2 (bundled with Node, `C:/Program Files/nodejs/node_modules/npm`) | Installed | **Use this one.** Workspaces install/build |
| npm 10.2.5 (user-global, first on PATH) | Installed | **Do not use for installs.** Crashes on this workspace (`Cannot read properties of null (reading 'edgesOut')`) |
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

## Project dependencies (installed 2026-10-16, approved list)

Policy (D-018): exact pins, the newest stable release at least 14 days old at install time, and the lockfile committed.

| Workspace | Runtime dependencies | Dev dependencies |
|---|---|---|
| `packages/shared` | zod 4.6.5 | typescript 6.0.3 |
| `packages/ui` | react 19.3.0 (peer) | @types/react 19.3.0, typescript 6.0.3 |
| `backend` | express 5.2.1, zod 4.6.5, @supabase/supabase-js 2.117.2, pino 10.4.0, pino-http 11.0.0, helmet 8.3.0, cors 2.8.6, express-rate-limit 8.7.0, swagger-ui-express 5.0.1, yaml 2.9.1 | typescript 6.0.3, tsx 4.23.15, vitest 5.0.3, supertest 7.3.1, @types/express 5.0.6, @types/cors 2.8.19, @types/supertest 7.2.1, @types/swagger-ui-express 4.1.8, @types/node 24.19.1 |
| `author-frontend`, `admin-frontend` | next 16.3.8, react 19.3.0, react-dom 19.3.0, @supabase/supabase-js 2.117.2, @tanstack/react-query 5.104.1 | typescript 6.0.3, @types/react 19.3.0, @types/react-dom 19.3.0, @types/node 24.19.1 |

| root (SETUP-3) | n/a | eslint 9.39.5, @eslint/js 9.39.5, typescript-eslint 8.71.0, eslint-config-next 16.3.8, globals 17.13.0, prettier 3.9.9, @redocly/cli 2.57.0 |

Not yet installed: `@anthropic-ai/sdk` (AI-2) and `@testing-library/react` (FE tasks). Each needs approval. Transitive dependencies are not age-filtered; the lockfile pins them.
