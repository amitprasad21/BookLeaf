# Handover

**Session:** 2026-10-19 (Claude Code)
**Branch:** `feature/admin-portal` (from `main` at `7a688a9`; seven commits; not merged, not pushed)

## Done

- Merged to `main` with approval: Phase 0 through API-7, AI-1..AI-4, FE-1 (author set) and the author portal FE-A1..A4. The author portal's signed-in screens are still unchecked in a browser.
- **Support console, built and committed** ([verification/2026-10-19-admin-portal.md](verification/2026-10-19-admin-portal.md), D-032):
  - `packages/shared`: admin DTOs (returned by the admin serializers and routes) and console labels. Knowledge base and policy-floor names are checked against the backend by `backend/test/labels.test.ts`.
  - `packages/ui`: `CheckboxGroup`, `Tabs`, `ConfirmDialog`, `Pagination`, `SlaIndicator`, `Timeline`.
  - `admin-frontend`:
    - Session layer copied from the author portal (role admin).
    - `features/queue` (URL filters, summary shortcuts, "Show N updates", inline assign).
    - `features/ticket` (header, triage + assignment, author context, notes, timeline, version-conflict handling, reply editor with the AI draft).
  - `.claude/launch.json` gained `admin-frontend-dev` (port 3001).
- Results: `npm run check` exit 0 (303 backend tests); 29 admin + 22 author logic tests; console production build; signed-out console checks in the browser.

## In progress

- **Signed-in browser checks for both portals** (author and admin). The demo passwords are in `backend/.env`, and sign-in goes to the hosted Supabase project, so the user signs in in the browser pane. Then check:
  - Author: My Books (Sneha Kulkarni: BK013 in production; Kavita Deshmukh: BK016 rollover), the query form, My Tickets, ticket detail.
  - Admin:
    - Queue filters and shortcuts; open a royalty ticket and review the AI draft (one free-tier call unless reused).
    - Override the category and see the draft refresh; add a note; send a reply on a test ticket (create and delete it like the live suites, only if approved).
  - The viewport matrix.
- Then mark FE-M1..M4, AI-5 and FE-A1..A4 done in TASKS with the evidence.

## Broken / risky

- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`). Root scripts swallow extra flags; run vitest inside a workspace when flags are needed.
- **Bash heredocs in this environment halve backslashes.** Write code containing `\n` or regexes with the file editor, not via heredoc + Python.
- The frontend logic tests run with the root-hoisted Vitest (`npx vitest run --root author-frontend` / `--root admin-frontend`). They have no config, so tested modules avoid the `@/` alias. Declaring `vitest` (and Testing Library, jsdom) in the frontends needs approval; until then `npm test` doesn't run them.
- A partial-tree typecheck (e.g. while splitting commits) can trip over stale `.next/dev/types` left by a dev server; delete that git-ignored folder first.
- Free-tier Gemini: quotas unpublished; content may be used by Google (A-18).
- `GROQ_FALLBACK_API_KEY` in `backend/.env` is unused (C-14); delete it.
- Ticket writes and their audit events are separate writes. An audit failure is logged, not retried.
- The live suites write and delete tickets. An interrupted run can leave "RLS test ticket", "Live test: …", "Queue test Q…", "Admin test: …", "Reply test: …", "AI triage test: …" or "AI draft test: …" rows; delete them with the secret key.

## Next

1. Fast-forward `main` to `feature/admin-portal` (needs approval); the signed-in checks (above).
2. API-8 (SSE): both portals switch from polling to "Live"; the queue's polled copy becomes event-driven.
3. AI-6 (evals; a live run needs approval), hardening (nonce CSP, shared web package if the session copies drift), deployment.

## Do not touch

- `backend/.env`, `author-frontend/.env.local`, `admin-frontend/.env.local`: real credentials, git-ignored, never read into chat.
- `supabase/seed/bookleaf_sample_data.json` (byte-identical). `docs/blueprint/`.

## Commits (approved by the user 2026-10-19)

On `feature/admin-portal` (hashes: `git log --oneline main..`). Each code commit was checked on its own (the rest stashed): typecheck, lint and the relevant tests.

1. `feat(shared): add admin response DTOs and console labels`
2. `refactor(api): return the shared admin DTO types`
3. `feat(ui): add checkbox group, tabs, dialog, pagination, SLA indicator and timeline`
4. `feat(admin): add sign-in, session and API client`
5. `feat(admin): add the ticket queue`
6. `feat(admin): add the ticket page with triage, notes, timeline and the AI reply editor`
7. `docs: record support console decisions and verification`
