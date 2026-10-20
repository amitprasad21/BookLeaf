# Handover

**Session:** 2026-10-20 (Claude Code)
**Branch:** `feature/ui-check-fixes` (from `main` at `d35aa0a`; three commits; not merged, not pushed)

## Done

- Merged to `main` with approval: everything through AI-6 (API, AI triage/drafts/evals, live updates, both portals).
- **Signed-in browser checks** ([verification/2026-10-20-ui-checks.md](verification/2026-10-20-ui-checks.md)): the user signed in (author Sneha, ops admin) in the Claude app's browser pane.
  - Both portals checked, including live updates: author status and reply in 1–3 s; console "Show 1 update".
  - One approved test ticket (BL-1277) was used and then deleted with the secret key; the database has 0 tickets.
- **Fixes (committed) from those checks:**
  - `author-frontend/src/features/books/`: the table fits 1024 px (ISBN one line, actions under the title, compact cells); `bookStatusText` shared with the query form.
  - `author-frontend/src/features/tickets/NewTicketScreen.tsx`: book option wording.
  - `admin-frontend/src/features/queue/`: "Nothing open right now" empty state; Status + Priority side by side.
  - `admin-frontend/src/features/ticket/`: the "Reply sent" notice lives in the conversation (survives "Send & resolve").
- Results: `npm run check` exit 0 (341 backend tests); author 29 and console 35 logic tests.

## In progress

- Nothing half-done.

## Broken / risky

- **Drafts can name the wrong overdue quarter** (seen live): fix the facts and prompt in the AI follow-up (proposed as its own session; a live re-run needs approval).
- **Free-tier per-minute quotas:** about 12 triage calls a minute exhaust Gemini's, then Groq's. Real tickets wait for the sweeper (or manual review after three attempts).
- **Claude in Chrome isn't connected** in this setup; signed-in UI checks run in the app's browser pane after the user signs in there.
- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`).
- **Bash heredocs in this environment halve backslashes and can trip on quotes.** Write code with backslashes using the file editor; for multi-file text edits, write a Python script file and run it.
- The frontend logic tests run with the root-hoisted Vitest (`npx vitest run --root author-frontend` / `--root admin-frontend`). Declaring `vitest` (and Testing Library, jsdom) in the frontends needs approval.
- Stale `.next/dev/types` from a dev server can break partial-tree typechecks; delete that git-ignored folder first.
- The event hub is in-process: one backend instance only (A-15).
- `GROQ_FALLBACK_API_KEY` in `backend/.env` is unused (C-14); delete it.

## Next

1. Fast-forward `main` to `feature/ui-check-fixes` (approval).
2. AI follow-up: overdue quarter in the facts, triage facts-reading rules, tighter royalty drafts; live re-run with approval.
3. Remaining manual checks (AE-01, AE-06, two-admin conflict, viewport matrix, keyboard, screen reader), hardening, deployment.

## Do not touch

- `backend/.env`, `author-frontend/.env.local`, `admin-frontend/.env.local`: real credentials, git-ignored, never read into chat.
- `supabase/seed/bookleaf_sample_data.json` (byte-identical). `docs/blueprint/`.

## Commits (approved by the user 2026-10-20)

On `feature/ui-check-fixes` (hashes: `git log --oneline main..`). Each code commit was checked on its own (the rest stashed).

1. `fix(author): fit the book table at 1024 px and share the status wording`
2. `fix(admin): keep the reply notice, clarify the empty queue, compact the filters`
3. `docs: record the signed-in browser checks`
