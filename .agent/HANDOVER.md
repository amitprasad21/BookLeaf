# Handover

**Session:** 2026-10-18 (Claude Code)
**Branch:** `feature/api-books` (branched from `main` at `0737d47`; four API-3 commits; not merged, not pushed)

## Done

- Merged to `main` with approval: Phase 0 through API-2. The database in project `jhszxq…` has the schema, live RLS and the exact seed; the API verifies Supabase sessions.
- **API-3** ([verification/2026-10-18-api3.md](verification/2026-10-18-api3.md)):
  - `packages/shared/src/payout-calendar.ts` (D-023): business date, quarters, 45-day deadlines, ₹1,000 threshold, overdue heuristic. Tests in `backend/test/payout-calendar.test.ts` (U-01..U-04).
  - `backend/src/modules/books/` (repository with an explicit author filter, serializer, royalty summary in paise).
  - `createAuthorRouter({ clock })` with `GET /books`, injectable `lib/clock.ts`, and `dbOf` / `authorIdOf` helpers.
  - Tests: `test/books.test.ts` (fake data source returning all 18 books; DTO ↔ OpenAPI contract) and `test-integration/books.test.ts` (field-for-field against the dataset). `test/helpers.ts` gained `fakeDb` and `fixedClock`.
  - OpenAPI: all always-present `Book` fields are now required.
- Results: `npm run check` exit 0 (88 tests); `test:live` 27 passed; the live server returned the right books and summaries for Priya and Kavita, and 403 for the admin.

## In progress

- Nothing half-done. API-3 is committed on `feature/api-books`. Merging into `main` needs approval.

## Broken / risky

- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`). Root scripts swallow extra flags.
- `/author/books` takes about 0.6–0.8 s warm (two sequential Supabase round trips) and about 2 s cold. Optimisation is noted in D-022.
- `test:rls` writes and deletes tickets; an interrupted run could leave "RLS test ticket" rows.

## Next

1. Merge `feature/api-books` into `main` (fast-forward) after approval.
2. API-4: author tickets.
   - `POST /author/tickets`: save-first, `ai_status=pending`, `bookId` null or own.
   - `GET /author/tickets`: list.
   - `GET /author/tickets/{id}`: detail with thread.
   - Author serializer (no internal fields), `middleware/validate.ts` (zod from `packages/shared`), per-author rate limit, and mapping of the DB `rate_limited` error to 429.

## Do not touch

- `backend/.env`, `author-frontend/.env.local`, `admin-frontend/.env.local`: real credentials, git-ignored, never read into chat.
- `supabase/seed/bookleaf_sample_data.json` (byte-identical). `docs/blueprint/`.

## Commits (approved by the user 2026-10-18)

On `feature/api-books` (hashes: `git log --oneline main..`):

1. `feat(shared): add royalty payout calendar`
2. `feat(api): add GET /author/books with royalty summary`
3. `test: add live author books suite`
4. `docs: record API-3 decisions and verification`
