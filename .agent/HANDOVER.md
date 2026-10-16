# Handover

**Session:** 2026-10-16 (Claude Code)
**Branch:** `feature/tooling` (branched from `main` at `81446bf`; three SETUP-3 commits; not merged, not pushed)

## Done

- Phase 0: sources read, repository initialised, full documentation tree (commits on `docs/initial-setup`, now in `main`).
- SETUP-2: npm workspace scaffold (commits `ff9822c`, `81446bf`). With the user's approval, `main` was fast-forwarded to `81446bf`.
- SETUP-3 ([verification/2026-10-16-setup3.md](verification/2026-10-16-setup3.md)):
  - Root dev tools installed from the user-approved pinned list (D-018/D-019).
  - `eslint.config.mjs`: typescript-eslint everywhere; Next.js rules scoped to both apps and `packages/ui`; `react/no-danger` is an error.
  - Prettier (`.prettierrc.json`, `.prettierignore`) formats code only; docs, `openapi.yaml`, lockfile and seed are excluded. Applied once: 5 files reformatted (cosmetic).
  - `openapi.yaml`: added 18 `operationId`s and 5 tag descriptions; Redocly `recommended` passes with `info-license` off and 2 justified ignores (`.redocly.lint-ignore.yaml`).
  - Root scripts: `prepare` (builds shared packages on install), `lint`, `lint:api`, `format`, `format:check`, `check`.
  - Lockfile resynced (optional `@emnapi/*` entries) so `npm ci` works.

## In progress

- Nothing half-done. SETUP-3 is committed on `feature/tooling`. Merging into `main` needs approval.

## Broken / risky

- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`) or upgrade the global npm (user's call).
- **ESLint 9.39.5 is marked unsupported by npm.** It's dev-only and needed until `eslint-config-next` supports ESLint 10 (D-019).
- Four blueprint-cited sources are still missing (S-07..S-10); design tokens are provisional. Model choice (D-010) is still a proposal.

## Next

1. Merge `feature/tooling` into `main` (fast-forward) after approval.
2. API-1: backend skeleton (request id, pino with redaction, CORS allowlist, error handler + envelope, Swagger UI at `/api/docs`). No credentials needed.
3. DB-1: guided Supabase setup when reached (just in time).

## Do not touch

- `supabase/seed/bookleaf_sample_data.json` (byte-identical to the provided file; excluded from Prettier).
- `docs/blueprint/` (source material).

## Commits (approved by the user 2026-10-16)

On `feature/tooling` (hashes: `git log --oneline main..`):

1. `chore: add ESLint, Prettier and OpenAPI lint tooling`
2. `docs(api): add operationIds and tag descriptions to openapi.yaml`
3. `docs: record tooling decisions and verification`
