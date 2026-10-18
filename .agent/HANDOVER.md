# Handover

**Session:** 2026-10-18 (Claude Code)
**Branch:** `feature/api-admin-queue` (from `main` at `551e0f9`; five API-5 commits; not merged, not pushed)

## Done

- Merged to `main` with approval: Phase 0 through API-4. The database in project `jhszxq…` has the schema, live RLS and the exact seed. The API serves `/me`, `/author/books` and the author ticket endpoints.
- **API-5** ([verification/2026-10-18-api5.md](verification/2026-10-18-api5.md), decision D-025):
  - Migration `20261018090000_queue_urgency_rank.sql`: a generated `tickets.urgency_rank` column plus an index. **Applied by the user** (fingerprint `10 · 12 · 16 · false · 1`); rollback in `supabase/rollback/`. `check:db` probes the column.
  - `packages/shared/src/sla.ts`: targets, `slaState`, overdue cut-offs. `schemas.ts`: `AdminTicketQueueQuerySchema`.
  - `backend/src/modules/tickets/admin-repository.ts`: filters, urgency sort and paging in the database, plus the nine-count summary. Also `serializers/admin.ts`, and `createAdminRouter` with `GET /admin/tickets` and `GET /admin/tickets/summary`.
  - The request log redacts `q` (a finding from the smoke test).
  - `openapi.yaml`: `overdue` parameter; documentation of dates, search, the urgency rule, `SlaState` and `QueueSummary`.
  - Tests:
    - `test/sla.test.ts` (9).
    - `test/admin-queue.test.ts` (20, including recorded Supabase calls via `recordingSupabase` in `test/fakes.ts`).
    - Contract and logging additions.
    - `test-integration/admin-queue.test.ts` (7, with fixtures A–H inserted and deleted with the secret key).
- Results:
  - `npm run check` exit 0 (138 tests); `test:live` 39 passed.
  - Server smoke passed twice, with 0 tickets left afterwards.

## In progress

- Nothing half-done. API-5 is committed on `feature/api-admin-queue`. Merging into `main` needs approval.

## Broken / risky

- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`). Root scripts swallow extra flags; run vitest inside `backend/` when flags are needed.
- After a DDL change, the Data API's schema cache can lag for a minute. `check:db` reported `urgency_rank MISSING` once right after the migration and OK on re-run.
- Latency per call:

  | Call | Time |
  |---|---|
  | Ticket create | about 1.5 s |
  | Queue | about 0.6 s |
  | Queue with search | about 0.8 s |
  | Summary | about 1–1.3 s |

  Ideas are in D-024 and D-025.
- `test:rls` and `test:live` write and delete tickets. An interrupted run can leave "RLS test ticket", "Live test: …" or "Queue test Q…" rows; delete them with the secret key.

## Next

1. Fast-forward `main` to `feature/api-admin-queue` after approval.
2. API-6: admin ticket detail and `PATCH` (transitions, overrides, self-assign, optimistic lock, audit events).

## Do not touch

- `backend/.env`, `author-frontend/.env.local`, `admin-frontend/.env.local`: real credentials, git-ignored, never read into chat.
- `supabase/seed/bookleaf_sample_data.json` (byte-identical). `docs/blueprint/`.

## Commits (approved by the user 2026-10-18)

On `feature/api-admin-queue` (hashes: `git log --oneline main..`):

1. `feat(db): add generated queue urgency rank` (migration, rollback, `check:db` probe)
2. `feat(shared): add SLA rules and admin queue query schema`
3. `feat(api): add admin ticket queue and summary` (with offline tests, spec and log redaction)
4. `test: add live admin queue suite`
5. `docs: record API-5 decisions and verification`
