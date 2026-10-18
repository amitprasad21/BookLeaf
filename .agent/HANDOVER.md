# Handover

**Session:** 2026-10-18 (Claude Code)
**Branch:** `feature/api-admin-replies` (from `main` at `bd0f2f2`; five API-7 commits; not merged, not pushed)

## Done

- Merged to `main` with approval: Phase 0 through API-6. The database in project `jhszxq…` has the schema, live RLS, the exact seed and the queue urgency rank. The API serves `/me`, `/author/books`, the author ticket endpoints, and the admin queue, summary, ticket detail and PATCH.
- **API-7** ([verification/2026-10-18-api7.md](verification/2026-10-18-api7.md), decision D-027):
  - Migration `20261018120000_admin_reply_function.sql`: `admin_send_reply`, an atomic reply (security invoker, locked row, open/in-progress only). **Applied by the user** (fingerprint `10 · 12 · 16 · false · 1 · 1`); rollback in `supabase/rollback/`. `check:db` probes it.
  - `AdminReplyRequestSchema` and `MessageBodyRequestSchema` in `packages/shared`.
  - `admin-repository.ts`: `sendReply` (RPC with error mapping), `listNotes`, `addNote`.
  - Routes: `POST /admin/tickets/:id/messages`, and `GET`/`POST /admin/tickets/:id/notes`. Audit records ids only, never text.
  - Test fakes: `adminRepository(overrides)`; `recordingSupabase` records `rpc()` and errors.
  - Tests:
    - `test/admin-replies.test.ts` (19).
    - Function contract checks in `rls-contract.test.ts` (+3).
    - `test-integration/admin-replies.test.ts` (7, including an author calling the function directly → 42501).
- Results:
  - `npm run check` exit 0 (181 tests); `test:live` 53 passed.
  - The full support-loop smoke passed, with 0 tickets left afterwards.

## In progress

- Nothing half-done. API-7 is committed on `feature/api-admin-replies`. Merging into `main` needs approval.

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
  | Reply / note | about 0.7 s |

  Ideas are in D-024 to D-026.
- Ticket writes and their audit events are separate writes. An audit failure is logged, not retried.
- The live suites write and delete tickets. An interrupted run can leave "RLS test ticket", "Live test: …", "Queue test Q…", "Admin test: …" or "Reply test: …" rows; delete them with the secret key.

## Next

1. Fast-forward `main` to `feature/api-admin-replies` after approval.
2. API-8 (SSE event hub, `GET /events`, scoped delivery), or the AI track (AI-1/AI-2: provider interface, mock provider, budget), which unblocks triage (AI-3) and drafts (AI-4).

## Do not touch

- `backend/.env`, `author-frontend/.env.local`, `admin-frontend/.env.local`: real credentials, git-ignored, never read into chat.
- `supabase/seed/bookleaf_sample_data.json` (byte-identical). `docs/blueprint/`.

## Commits (approved by the user 2026-10-18)

On `feature/api-admin-replies` (hashes: `git log --oneline main..`):

1. `feat(db): add atomic admin reply function` (migration, rollback, `check:db` probe, contract tests)
2. `feat(shared): add admin reply and note request schemas`
3. `feat(api): add admin replies and internal notes` (with offline tests, fakes and spec)
4. `test: add live admin replies suite`
5. `docs: record API-7 decisions and verification`
