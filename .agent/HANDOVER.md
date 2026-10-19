# Handover

**Session:** 2026-10-19 (Claude Code)
**Branch:** `feature/author-portal` (from `main` at `1e9a4bd`; seven commits; not merged, not pushed)

## Done

- Merged to `main` with approval: Phase 0 through API-7 and AI-1..AI-4. The backend API is complete except SSE. Tickets are triaged by AI in the background, and admins can request reply drafts (Gemini 3.5 Flash-Lite, Groq fallback).
- **FE-1 + author portal, built and committed** ([verification/2026-10-19-fe1-author.md](verification/2026-10-19-fe1-author.md), D-031, A-19):
  - `packages/ui`: `components.css` + icons + primitives (AppShell/NavBar, PageHeader, Panel, Button, fields, badges, ChipGroup, Notice, states, KeyFigure, ConnectionIndicator, MessageThread, Disclosure). Presentation only; callers pass the wording.
  - `packages/shared`:
    - `format.ts` (INR, dates, relative time, null wording), `dto.ts` (response types), `production.ts` (stages moved from the draft facts).
    - Backend serializers now return these DTO types.
  - `author-frontend`:
    - `lib/` (config, Supabase client, API client with refresh-once, query client), `providers/` (session with `/me` role check).
    - Features: session (login, portal shell + guard), books (view model + screen), tickets (form logic, new, list, detail, seen markers).
    - Routes `/login`, `/books`, `/tickets`, `/tickets/new`, `/tickets/[ticketId]`; CSP in `next.config.ts`.
  - `.claude/launch.json` gained `author-frontend-dev`.
- Results: author typecheck, lint, Prettier and production build pass. 11 shared + 22 author logic tests pass. Signed-out browser checks pass (guard, `next`, expired notice, headers, 320 px).

## In progress

- **Signed-in browser checks** (skipped for now at the user's request, 2026-10-19). The author demo password is in `backend/.env`, and the sign-in form sends credentials to the hosted Supabase project, so the user signs in (in the browser pane). Then check:
  - My Books for Sneha Kulkarni (BK013 in production) and Kavita Deshmukh (BK016 rollover).
  - The query form: validation, then one real submit if approved (creates a ticket and one free-tier triage call; delete it afterwards like the live suites do).
  - My Tickets and the ticket detail; the viewport matrix.
- Then mark FE-A1..A4 done in TASKS with the evidence.

## Broken / risky

- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`). Root scripts swallow extra flags; run vitest inside a workspace when flags are needed.
- **Bash heredocs in this environment halve backslashes.** Write code containing `\n` or regexes with the file editor, not via heredoc + Python.
- The author logic tests run with the root-hoisted Vitest (`npx vitest run --root author-frontend`). Declaring `vitest` (and Testing Library, jsdom) in `author-frontend/package.json` needs approval. Until then, `npm test` doesn't run them.
- Free-tier Gemini: quotas unpublished; content may be used by Google (A-18).
- `GROQ_FALLBACK_API_KEY` in `backend/.env` is unused (C-14); delete it.
- Ticket writes and their audit events are separate writes. An audit failure is logged, not retried.
- The live suites write and delete tickets. An interrupted run can leave "RLS test ticket", "Live test: …", "Queue test Q…", "Admin test: …", "Reply test: …", "AI triage test: …" or "AI draft test: …" rows; delete them with the secret key.

## Next

1. Signed-in author checks (above), then commits on `feature/author-portal` after approval.
2. Admin portal: FE-M1..M4 + AI-5 (queue, detail, triage and draft panel, reply editor), building the remaining `packages/ui` components.
3. API-8 (SSE; switches both portals from polling to "Live"), AI-6 (evals), hardening and deployment.

## Do not touch

- `backend/.env`, `author-frontend/.env.local`, `admin-frontend/.env.local`: real credentials, git-ignored, never read into chat.
- `supabase/seed/bookleaf_sample_data.json` (byte-identical). `docs/blueprint/`.

## Commits (approved by the user 2026-10-19; grouping left to the agent)

On `feature/author-portal` (hashes: `git log --oneline main..`). Each code commit was checked on its own (the rest stashed): typecheck, lint and the relevant tests.

1. `feat(shared): add display formatters, response DTOs and production stages`
2. `refactor(api): return the shared DTO types and production stages`
3. `feat(ui): add component styles, icons and primitives`
4. `feat(author): add sign-in, session and API client`
5. `feat(author): add My Books`
6. `feat(author): add Raise a query, My Tickets and ticket detail`
7. `docs: record FE-1 and author portal decisions and verification`
