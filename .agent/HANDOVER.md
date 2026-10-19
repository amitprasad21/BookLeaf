# Handover

**Session:** 2026-10-19 (Claude Code)
**Branch:** `feature/ai-drafts` (from `main` at `444a223`; five AI-4 commits; not merged, not pushed)

## Done

- Merged to `main` with approval: Phase 0 through API-7, AI-1/AI-2 and AI-3. The backend API is complete except SSE. Tickets are triaged by AI in the background (Gemini Flash-Lite, Groq fallback). `backend/.env` now selects Gemini + Groq.
- **AI-4 reply drafts** ([verification/2026-10-19-ai4.md](verification/2026-10-19-ai4.md), decision D-030):
  - Shared `DraftResultSchema`, escalation teams, `DraftRequestSchema`.
  - `backend/src/ai/`:
    - `knowledge-base/index.ts` (12 sections from the assignment, `KB_VERSION`, selection by category); `facts/draft-facts.ts`.
    - `prompts/draft.ts` (`draft-2026-10-19.2`, including facts-reading rules); `prompts/index.ts`.
    - `validation/draft-guards.ts` (shape problems, fact warnings, standard sign-off); `drafts.ts` (service).
  - Admin repository: `findReadyDraft`, `insertDraft`, `supersedeOtherDrafts` (admin RLS, no system writer). `toAiDraft`.
  - `POST /admin/tickets/{id}/draft`: 201 new, 200 reused; regenerate limited to 10/min per admin and 5/day per ticket; 503 when AI is off.
  - **Draft model is now Flash-Lite:** 3.8 Flash timed out on the free tier (measured), so it's left as an opt-in.
  - Two fixes came from live output: facts-reading rules (a draft wrongly said "not overdue"), and the one-block / duplicate sign-off handling.
- Results:
  - `npm run check` exit 0 (290 tests).
  - `test:live` 61 passed.
  - Server smoke with real drafts reviewed (in the verification record).

## In progress

- Nothing half-done. AI-4 is committed on `feature/ai-drafts`. Merging into `main` needs approval.

## Broken / risky

- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`). Root scripts swallow extra flags; run vitest inside `backend/` when flags are needed.
- **Bash heredocs in this environment halve backslashes.** Write code containing `\n` or regexes with the file editor, not via heredoc + Python.
- Free-tier Gemini: 3.8 Flash was too slow for drafts. Quotas are unpublished, and the content may be used by Google (A-18).
- Live AI suites' usage events stay in `ai_usage_events` (real usage).
- `GROQ_FALLBACK_API_KEY` in `backend/.env` is unused (C-14); delete it.
- Ticket writes and their audit events are separate writes. An audit failure is logged, not retried.
- The live suites write and delete tickets. An interrupted run can leave "RLS test ticket", "Live test: …", "Queue test Q…", "Admin test: …", "Reply test: …", "AI triage test: …" or "AI draft test: …" rows; delete them with the secret key.

## Next

1. Fast-forward `main` to `feature/ai-drafts` after approval.
2. The portals:
   - FE-1 (`packages/ui` tokens and primitives).
   - FE-A1..A4 (author: sign-in, My Books, submit query, My Tickets).
   - FE-M1..M3 + AI-5 (admin: queue, detail, triage and draft panel).
3. Then API-8 (SSE), AI-6 (evals), hardening and deployment.

## Do not touch

- `backend/.env`, `author-frontend/.env.local`, `admin-frontend/.env.local`: real credentials, git-ignored, never read into chat.
- `supabase/seed/bookleaf_sample_data.json` (byte-identical). `docs/blueprint/`.

## Commits (approved by the user 2026-10-19)

On `feature/ai-drafts` (hashes: `git log --oneline main..`):

1. `feat(shared): add draft result contract`
2. `feat(ai): add knowledge base, draft facts, prompt and guards` (KB, facts, prompt, mocks index, guards, draft service, router.modelFor, Flash-Lite draft default, AI tests)
3. `feat(api): add the admin draft endpoint` (repository draft storage, serializer, route, limiter skip, app/server wiring, spec, route tests)
4. `test: add live AI draft suite`
5. `docs: record AI-4 decisions and verification`
