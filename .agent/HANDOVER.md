# Handover

**Session:** 2026-10-18 (Claude Code)
**Branch:** `feature/api-admin-ticket` (from `main` at `abefb28`; four API-6 commits; not merged, not pushed)

## Done

- Merged to `main` with approval: Phase 0 through API-5. The database in project `jhszxq…` has the schema, live RLS, the exact seed and the queue urgency rank. The API serves `/me`, `/author/books`, the author ticket endpoints and the admin queue and summary.
- **API-6** ([verification/2026-10-18-api6.md](verification/2026-10-18-api6.md), decision D-026):
  - `packages/shared/src/ticket-lifecycle.ts` (status machine) and `UpdateTicketRequestSchema`.
  - `backend/src/modules/tickets/admin-service.ts`: `planTicketUpdate`, a pure planner covering transitions, stamps, overrides, self-assignment and no-ops.
  - `admin-repository.ts`: `findTicket`, `findDetail`, `updateIfVersion`. `serializers/admin.ts`: `toAdminTicketDetail`.
  - `GET` and `PATCH /admin/tickets/:ticketId`. A stale version gets 409 with `error.current`, and the version is re-checked atomically in the UPDATE.
  - The system writer has `appendAuditEvents`: one insert, events stamped 1 ms apart. This fixes the order bug the live suite caught.
  - `openapi.yaml`: detail 400, PATCH rules, `error.current`.
  - Tests:
    - `test/admin-ticket.test.ts` (21).
    - `test-integration/admin-ticket.test.ts` (7, including a live two-admin race).
- Results:
  - `npm run check` exit 0 (159 tests); `test:live` 46 passed.
  - Server smoke passed, with 0 tickets left afterwards.

## In progress

- Nothing half-done. API-6 is committed on `feature/api-admin-ticket`. Merging into `main` needs approval.

## Broken / risky

- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`). Root scripts swallow extra flags; run vitest inside `backend/` when flags are needed.
- After a DDL change, the Data API's schema cache can lag for a minute: re-run `check:db` before concluding a migration didn't land.
- Latency per call:

  | Call | Time |
  |---|---|
  | Ticket create | about 1.5 s |
  | Queue | about 0.6–0.8 s |
  | Summary | about 1–1.3 s |
  | Admin detail | about 1.1 s |
  | Admin PATCH | about 1.5–1.9 s |

  Ideas are in D-024, D-025 and D-026.
- The ticket update and its audit events are two writes. An audit failure is logged, not retried.
- The live suites write and delete tickets. An interrupted run can leave "RLS test ticket", "Live test: …", "Queue test Q…" or "Admin test: …" rows; delete them with the secret key.

## Next

1. Fast-forward `main` to `feature/api-admin-ticket` after approval.
2. API-7: admin replies (`POST /admin/tickets/{id}/messages`: first-response tracking, `statusAfter`) and internal notes.

## Do not touch

- `backend/.env`, `author-frontend/.env.local`, `admin-frontend/.env.local`: real credentials, git-ignored, never read into chat.
- `supabase/seed/bookleaf_sample_data.json` (byte-identical). `docs/blueprint/`.

## Commits (approved by the user 2026-10-18)

On `feature/api-admin-ticket` (hashes: `git log --oneline main..`):

1. `feat(shared): add ticket status machine and update schema`
2. `feat(api): add admin ticket detail and PATCH with optimistic locking` (with offline tests, spec, batched audit)
3. `test: add live admin ticket suite`
4. `docs: record API-6 decisions and verification`
