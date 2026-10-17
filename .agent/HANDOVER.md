# Handover

**Session:** 2026-10-16 → 2026-10-17 (Claude Code)
**Branch:** `feature/db-supabase` (branched from `main` at `af9fc08`; two DB-1 commits; not merged, not pushed)

## Done

- Phase 0, SETUP-2, SETUP-3 and API-1 merged to `main` (`af9fc08`) with the user's approval.
- DB-1, Supabase project + credentials ([verification/2026-10-17-db1.md](verification/2026-10-17-db1.md)):
  - Official Supabase docs checked for current key types, dashboard locations and the sign-up setting (D-020).
  - `backend/scripts/check-env.ts` + `credential-checks.ts` (`npm run check:env`): names-only presence, key-kind, frontend↔backend match, secret-leak and connection checks. 5 unit tests.
  - Git-ignored env files created with placeholders. The **user** filled in the real values; the agent never read or printed them.
  - Final check: **Result OK**. Both keys are valid and correctly placed, there are no secrets in frontend files, and sign-ups are disabled. (The first run caught the sign-up toggle not yet saved.)
  - The user re-confirmed **no self sign-up**: accounts come from the seed only.

## In progress

- Nothing half-done. DB-1 is committed on `feature/db-supabase`. Merging into `main` needs approval. **The env files are git-ignored and must never be committed.**

## Broken / risky

- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`).
- Admin-API user creation with sign-ups disabled is expected to work but unproven until DB-4.
- `VersionConflictError` lacks the current representation (API-6). Still open: S-07..S-10, D-010, ESLint 9 support (D-019).

## Next

1. Merge `feature/db-supabase` into `main` (fast-forward) after approval.
2. DB-2: write the migration SQL (enums, tables, constraints, indexes, triggers per `.back/DATA_MODEL.md`) for review. **Before applying it,** explain the migration route just in time (B-04): Supabase CLI via `npx supabase` (install approval + access token / database password) or pasting into the dashboard SQL editor.
3. DB-3 RLS policies + tests, then DB-4 seed.

## Do not touch

- `backend/.env`, `author-frontend/.env.local`, `admin-frontend/.env.local`: real credentials, git-ignored, never read into chat.
- `supabase/seed/bookleaf_sample_data.json` (byte-identical to the provided file). `docs/blueprint/` (source material).

## Commits (approved by the user 2026-10-17)

On `feature/db-supabase` (hashes: `git log --oneline main..`):

1. `feat(backend): add safe Supabase credential check (npm run check:env)`
2. `docs: record Supabase setup (DB-1) and credential verification`
