# Handover

**Session:** 2026-10-20 (Claude Code)
**Branch:** `feature/api-sse` (from `main` at `a60195e`; six commits; not merged, not pushed)

## Done

- Merged to `main` with approval: Phase 0 through API-7, AI-1..AI-4, FE-1, the author portal (FE-A1..A4) and the support console (FE-M1..M4, AI-5). Neither portal's signed-in screens have been checked in a browser yet.
- **API-8 live updates, built and committed** ([verification/2026-10-20-api8.md](verification/2026-10-20-api8.md), D-033):
  - `packages/shared/src/events.ts`: event types, change names, `formatSseEvent`, SSE parser, `toTicketEvent`.
  - Backend:
    - `src/events/hub.ts` (role/owner filtering, 5 streams per user, `closeAll`); `src/events/ticket-events.ts` (PATCH actions → events); `src/modules/events/router.ts` (`GET /api/v1/events`: heartbeat 25 s, ends after 10 min, 429 past the limit).
    - Publishing in the author and admin routers; `ticket.triaged` from the triage queue wrapper in `server.ts`; `events.closeAll()` on shutdown.
    - `openapi.yaml` `/events` documented.
  - Portals: `lib/event-stream.ts` (same file in both) and `providers/LiveUpdatesProvider.tsx`; pages poll only while the stream is down; indicator "Live" / "Refreshing every 15 s".
  - Tests:
    - `backend/test/events.test.ts` and route-event tests in `tickets`, `admin-ticket`, `admin-replies`, `triage-routes`.
    - `backend/test-integration/events.test.ts` (live, I-20).
    - `event-stream.test.ts` in both portals.
- Results: 323 offline backend tests; live events 4/4, other non-AI live suites 57 passed (7 credential checks skipped); 28 author + 35 console logic tests; `npm run check` exit 0; server smoke (401 without a token, CORS preflight for the console).

## In progress

- **Signed-in browser checks for both portals** (author and admin), now including live updates. The demo passwords are in `backend/.env`, and sign-in goes to the hosted Supabase project, so the user signs in in the browser pane. Then check:
  - Author: My Books (Sneha Kulkarni: BK013 in production; Kavita Deshmukh: BK016 rollover), the query form, My Tickets, ticket detail; "Live" indicator; an admin reply appearing without refresh (AE-05).
  - Admin:
    - Queue filters and shortcuts; "Show N updates" after a new ticket.
    - Open a royalty ticket and review the AI draft (one free-tier call unless reused).
    - Override the category and see the draft refresh; add a note; send a reply on a test ticket (create and delete it like the live suites, only if approved).
  - The viewport matrix.

## Broken / risky

- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`). Root scripts swallow extra flags; run vitest inside a workspace when flags are needed.
- **Bash heredocs in this environment halve backslashes and can trip on quotes.** Write code containing `\n` or regexes with the file editor; for multi-file text edits, write a Python script file and run it.
- The frontend logic tests run with the root-hoisted Vitest (`npx vitest run --root author-frontend` / `--root admin-frontend`). They have no config, so tested modules avoid the `@/` alias. Declaring `vitest` (and Testing Library, jsdom) in the frontends needs approval; until then `npm test` doesn't run them.
- A partial-tree typecheck (e.g. while splitting commits) can trip over stale `.next/dev/types` left by a dev server; delete that git-ignored folder first.
- The event hub is in-process: one backend instance only (A-15).
- Free-tier Gemini: quotas unpublished; content may be used by Google (A-18).
- `GROQ_FALLBACK_API_KEY` in `backend/.env` is unused (C-14); delete it.
- Ticket writes and their audit events are separate writes. An audit failure is logged, not retried.
- The live suites write and delete tickets. An interrupted run can leave "RLS test ticket", "Live test: …", "Queue test Q…", "Admin test: …", "Reply test: …", "AI triage test: …", "AI draft test: …" or "Events test: …" rows; delete them with the secret key.

## Next

1. Fast-forward `main` to `feature/api-sse` (approval).
2. Signed-in checks (above).
3. AI-6 (evals; a live run needs approval), hardening (nonce CSP, a shared web package if the copied session/stream files drift), deployment.

## Do not touch

- `backend/.env`, `author-frontend/.env.local`, `admin-frontend/.env.local`: real credentials, git-ignored, never read into chat.
- `supabase/seed/bookleaf_sample_data.json` (byte-identical). `docs/blueprint/`.

## Commits (approved by the user 2026-10-20)

On `feature/api-sse` (hashes: `git log --oneline main..`). Each code commit was checked on its own (the rest stashed).

1. `feat(shared): add the ticket event contract and SSE parser`
2. `feat(api): add live ticket events over SSE`
3. `test: add the live event stream suite`
4. `feat(author): switch My Tickets and the ticket page to live updates`
5. `feat(admin): switch the queue and the ticket page to live updates`
6. `docs: record API-8 decisions and verification`
