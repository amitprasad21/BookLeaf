# Handover

**Session:** 2026-10-18 (Claude Code)
**Branch:** `feature/api-auth` (branched from `main` at `897afdc`; three API-2 commits; not merged, not pushed)

## Done

- Merged to `main` with approval: Phase 0, SETUP-2/3, API-1, DB-1, DB-2, DB-3, DB-4. The database in project `jhszxq…` has the schema, live RLS policies and the exact seed.
- **API-2** ([verification/2026-10-18-api2.md](verification/2026-10-18-api2.md)):
  - `src/auth/types.ts` (`AuthContext`, `AuthVerifier`) and `src/auth/supabase-verifier.ts`. `getClaims` verifies tokens locally (project uses ES256), requires `role=authenticated`, then loads the profile + author in one RLS-scoped query.
  - `src/db/user-client.ts`: request-scoped Supabase client carrying the caller's JWT.
  - `src/middleware/authenticate.ts` (on all `/api/v1` except health; 401 / 403 / 500 mapping) and `require-role.ts`.
  - `GET /api/v1/me`, plus empty `/author` and `/admin` routers behind role guards.
  - Env now requires `SUPABASE_URL` (https) and `SUPABASE_PUBLISHABLE_KEY` outside tests.
  - Tests: `test/auth.test.ts` (fake verifier) and `test-integration/auth.test.ts` (real tokens). New `npm run test:live` runs every live suite; `test:rls` runs only the RLS one.
  - OpenAPI: `/me` 403 added; `AuthorProfile.city` nullable.
- Results: `npm run check` exit 0 (69 tests); `test:live` 21 passed; the live server returned correct `/me` responses and 401/403.

## In progress

- Nothing half-done. API-2 is committed on `feature/api-auth`. Merging into `main` needs approval.

## Broken / risky

- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`). Root scripts swallow extra flags; run in `backend/` when you need flags.
- About 230 ms per authenticated request for the profile query. A short profile cache is a possible later optimisation (D-022).
- `test:rls` writes and deletes tickets as AUTH001/AUTH002; an interrupted run could leave "RLS test ticket" rows.

## Next

1. Merge `feature/api-auth` into `main` (fast-forward) after approval.
2. API-3: `GET /author/books` + royalty summary + shared payout-calendar library (unit-tested dates per AI_SPEC §8).
3. API-4: author tickets (create save-first with `ai_status=pending`, list, detail), author serializer, zod validation, rate limit.

## Do not touch

- `backend/.env`, `author-frontend/.env.local`, `admin-frontend/.env.local`: real credentials, git-ignored, never read into chat.
- `supabase/seed/bookleaf_sample_data.json` (byte-identical). `docs/blueprint/`.

## Commits (approved by the user 2026-10-18)

On `feature/api-auth` (hashes: `git log --oneline main..`):

1. `feat(api): verify Supabase sessions, add role guards and GET /me`
2. `test(security): add live authentication suite with real tokens`
3. `docs: record API-2 auth decisions and verification`
