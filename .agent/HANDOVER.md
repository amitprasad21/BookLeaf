# Handover

**Session:** 2026-10-16 (Claude Code)
**Branch:** `feature/workspace-scaffold` (branched from `main`; two commits; not merged, not pushed)

## Done

- Phase 0 (earlier in session): sources read; repo initialised; full documentation tree; three commits on `docs/initial-setup`. With the user's approval, `main` was then created at the same commit (`0852d64`).
- SETUP-2: npm workspaces scaffolded and verified ([verification/2026-10-16-setup2.md](verification/2026-10-16-setup2.md)):
  - Root: `package.json` (workspaces, scripts, engines), `tsconfig.base.json` (strict, NodeNext, explicit `types`), `.npmrc` (`save-exact=true`), `package-lock.json`.
  - `packages/shared`: contract enums + zod schemas + labels (exact assignment category wording).
  - `packages/ui`: provisional monochrome `tokens.css` (from `.front/DESIGN_SYSTEM.md`) and a `Panel` primitive.
  - `backend`: `createApp()` with helmet, JSON limit, `/api/v1/health`, 404 error envelope; zod env loader; Vitest + Supertest tests (4 passing).
  - `author-frontend` / `admin-frontend`: Next.js 16.3.8 App Router placeholders on ports 3000/3001 with baseline security headers; `typecheck` uses `next typegen`.
- Installed only the user-approved pinned list (D-018).

## In progress

- Nothing half-done. The scaffold and its doc record are committed on `feature/workspace-scaffold`. Merging into `main` needs approval.

## Broken / risky

- **npm 10.2.5 on PATH** (`%AppData%\npm`) crashes on this workspace (`edgesOut` bug). Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`) or upgrade the global npm (needs the user's OK). Root `engines.npm` is `>=11.0.0` so old npm warns.
- `.claude/launch.json` (preview launcher) holds a machine-specific npm path and is git-ignored.
- Four blueprint-cited sources are still missing (S-07..S-10); design tokens are provisional.
- Model choice (D-010) is still a proposal.

## Next

1. Merge `feature/workspace-scaffold` into `main` (fast-forward) after approval.
2. SETUP-3: ESLint + Prettier + OpenAPI linter (install approval needed).
3. API-1: backend skeleton (request id, pino, CORS, error handler, Swagger UI). No credentials needed.
4. DB-1: guided Supabase setup when reached (just in time).

## Do not touch

- `supabase/seed/bookleaf_sample_data.json`: must stay byte-identical to the provided file.
- `docs/blueprint/`: source material.

## Commits (approved by the user 2026-10-16)

On `feature/workspace-scaffold` (hashes: `git log --oneline main..`):

1. `chore: scaffold npm workspaces with backend, two Next.js apps and shared packages`
2. `docs: record workspace scaffold decisions and verification`
