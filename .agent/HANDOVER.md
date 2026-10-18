# Handover

**Session:** 2026-10-17 → 2026-10-18 (Claude Code)
**Branch:** `feature/db-rls-seed` (branched from `main` at `a403fba`; four DB-3/DB-4 commits; not merged, not pushed)

## Done

- Merged to `main` earlier with approval: Phase 0, SETUP-2/3, API-1, DB-1, DB-2.
- **DB-3, access rules: applied and verified** in project `jhszxq…` ([verification/2026-10-18-db3-db4.md](verification/2026-10-18-db3-db4.md)).
  - Contents: `supabase/migrations/20261017120000_rls_policies.sql` (private helpers, 16 policies, tightened grants), the rollback, `test/rls-contract.test.ts`, and the live suite `test-integration/rls.test.ts`.
  - Results: `npm run test:rls` 15/15 pass. `check:db` now also signs in as a seeded author and asserts that policies and grants are live.
- **DB-4, seed: done.**
  - Contents: `scripts/seed.ts` + `seed-data.ts`. Dry run is the default; `seed:apply` writes.
  - Result: 10/10 authors and 18/18 books match exactly, 12 logins with profiles.
  - Demo passwords were generated into `backend/.env` at the user's request and never displayed.
- Incidents caught and fixed (recorded in SECURITY_REVIEW_CHECKLIST and D-021):
  1. The seed `--dry-run` flag was dropped by npm, so the script took the write path. It stopped before any write; writing now needs `seed:apply`.
  2. DB-3 "Success" twice without landing: once not persisted, once applied to another project. Caught by the live suite and `check:db`; the migration log now prescribes a fingerprint query before and after each migration.
- The second Supabase project the user has holds DB-2 + DB-3 schema with no data. Unused; the user may delete it.

## In progress

- Nothing half-done. DB-3/DB-4 are committed on `feature/db-rls-seed`. Merging into `main` needs approval.

## Broken / risky

- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`). Root scripts swallow extra flags (e.g. `-- --reporter=verbose`), so run them in `backend/` directly when you need flags.
- `test:rls` writes and deletes tickets as AUTH001/AUTH002; an interrupted run could leave "RLS test ticket" rows.
- Not yet exercised: the `ai_drafts` status-only update and the 24-hour rate limit.

## Next

1. Merge `feature/db-rls-seed` into `main` (fast-forward) after approval.
2. API-2: auth middleware (verify JWT, load profile, role guards) + `GET /me`. Then API-3/API-4.

## Do not touch

- `backend/.env`, `author-frontend/.env.local`, `admin-frontend/.env.local`: real credentials, git-ignored, never read into chat.
- `supabase/seed/bookleaf_sample_data.json` (byte-identical). `docs/blueprint/`.

## Commits (approved by the user 2026-10-18)

On `feature/db-rls-seed` (hashes: `git log --oneline main..`):

1. `feat(db): add row level security policies and grants migration`
2. `feat(backend): add idempotent seed script with safe dry-run default` (carries all new npm scripts, including `test:rls`)
3. `test(security): add live row level security suite and access probes`
4. `docs: record DB-3/DB-4, migration lessons and verification`
