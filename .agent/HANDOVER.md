# Handover

**Session:** 2026-10-18 (Claude Code)
**Branch:** `feature/api-author-tickets` (from `main` at `12c49ba`; four API-4 commits; not merged, not pushed)

## Done

- Merged to `main` with approval: Phase 0 through API-3. The database in project `jhszxq…` has the schema, live RLS and the exact seed. The API verifies Supabase sessions and serves `/me` and `/author/books`.
- **API-4** ([verification/2026-10-18-api4.md](verification/2026-10-18-api4.md), decision D-024):
  - `packages/shared/src/schemas.ts`: strict create/list/detail schemas and ticket limits, shared with the frontends.
  - `backend/src/modules/tickets/`: author-scoped repository (`mapPostgrestError` maps DB errors to 429/400/403), author serializer (allowlisted fields; replies signed "BookLeaf Support", A-07).
  - `backend/src/db/system-writer.ts` (`appendAuditEvent`) and `modules/audit/service.ts` (failures are logged, never fail the request). An ESLint rule confines system-writer imports.
  - `middleware/rate-limit.ts` (`perUserLimit`: 5 per 10 min, 20 per day, failed requests not counted).
  - `createAuthorRouter({ clock, audit, ticketsRepository })` with `POST /tickets`, `GET /tickets` and `GET /tickets/:ticketId`. `createApp` now needs a `systemWriter`, and `SUPABASE_SECRET_KEY` is required outside tests.
  - Tests:
    - `test/tickets.test.ts` (18).
    - `test/fakes.ts` (`fakeTicketsStore`, `recordingSystemWriter`).
    - `buildTestApp(options)` now takes an options object.
    - `test-integration/tickets.test.ts`: creates as Priya, checks the DB row and audit with the secret key, then deletes.
  - `openapi.yaml`: 400 on a malformed ticket id, request patterns, `senderName` wording, `attachmentName` required in the detail.
- Results:
  - `npm run check` exit 0 (106 tests); `test:live` 32 passed.
  - Server smoke passed twice, with 0 tickets left in the database afterwards.

## In progress

- Nothing half-done. API-4 is committed on `feature/api-author-tickets`. Merging into `main` needs approval.

## Broken / risky

- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`). Root scripts swallow extra flags; run vitest inside `backend/` when flags are needed.
- `POST /author/tickets` makes four sequential Supabase round trips: about 1.5 s, and 5 s once on a cold connection. Options are in D-024.
- `test:rls` and `test:live` write and delete tickets. An interrupted run can leave "RLS test ticket" or "Live test: …" rows; delete them with the secret key.
- Rate limits are in-memory per instance (A-15).

## Next

1. Fast-forward `main` to `feature/api-author-tickets` after approval.
2. API-5: admin queue (filters, urgency sort, paging, summary counts, SLA state).

## Do not touch

- `backend/.env`, `author-frontend/.env.local`, `admin-frontend/.env.local`: real credentials, git-ignored, never read into chat.
- `supabase/seed/bookleaf_sample_data.json` (byte-identical). `docs/blueprint/`.

## Commits (approved by the user 2026-10-18)

On `feature/api-author-tickets` (hashes: `git log --oneline main..`):

1. `feat(shared): add ticket request schemas`
2. `feat(api): add author ticket create, list and detail` (with offline tests)
3. `test: add live author tickets suite`
4. `docs: record API-4 decisions and verification`
