# Handover

**Session:** 2026-10-19 (Claude Code)
**Branch:** `feature/ai-triage` (from `main` at `9d6fc78`; five AI-3 commits; not merged, not pushed)

## Done

- Merged to `main` with approval: Phase 0 through API-7 and AI-1/AI-2. The ticket API is complete except SSE; the AI provider layer is Gemini primary + Groq fallback.
- **AI-3 triage** ([verification/2026-10-19-ai3.md](verification/2026-10-19-ai3.md), decision D-029):
  - Shared `TriageResultSchema` and signals, plus `businessDayStart`.
  - `backend/src/ai/`:
    - `facts/triage-facts.ts`, `prompts/triage.ts` (static prompt, JSON-escaped ticket, mock responder), `validation/floors.ts`.
    - `triage.ts` (job), `queue.ts` (queue + sweeper), `control.ts`, `router.availability()`.
    - The provider schema is shape-only.
  - System writer: `loadTicketForTriage`, `saveTriageResult`, `markTriageFailure`, `resetTriage`, `listTicketsForSweep`.
  - The author create queues triage; new `POST /admin/tickets/{id}/triage` (202, 3/day per ticket, 5/min per admin, 503 when AI can't serve). `server.ts` wires the queue, the sweeper and a graceful drain.
  - Triage timeout default raised to 30 s.
- Results:
  - `npm run check` exit 0 (267 tests).
  - `test:live` 57 passed, including 4 on real Gemini.
  - Server smoke on Gemini: royalty critical, description change low, the injection attempt ignored, one live repair.

## In progress

- Nothing half-done. AI-3 is committed on `feature/ai-triage`. Merging into `main` needs approval.

## Needs the user

- **`backend/.env` still lacks the provider settings** (file last saved 2026-10-18 20:40). Add and save:
  - `AI_PRIMARY_PROVIDER=gemini`
  - `AI_FALLBACK_PROVIDER=groq`
- If the file has `AI_TRIAGE_TIMEOUT_MS=15000` (copied from the old example), change it to `30000` or delete it.
- Delete `GROQ_FALLBACK_API_KEY` (unused, C-14).
- Then `npm run check:ai` should show both providers.

## Broken / risky

- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`). Root scripts swallow extra flags; run vitest inside `backend/` when flags are needed.
- Free-tier quotas are small and unpublished. Triage uses Flash-Lite (larger quota); drafts (3.8 Flash) must be cached by context hash (AI-4).
- Gemini's free tier may use content to improve Google's products (A-18): fine for the fictional demo data only.
- The live AI suite's provider calls stay in `ai_usage_events` (real usage, counted in the daily budget).
- After a DDL change the Data API's schema cache can lag for a minute: re-run `check:db`.
- Ticket writes and their audit events are separate writes. An audit failure is logged, not retried.
- The live suites write and delete tickets. An interrupted run can leave "RLS test ticket", "Live test: …", "Queue test Q…", "Admin test: …", "Reply test: …" or "AI triage test: …" rows; delete them with the secret key.

## Next

1. Fast-forward `main` to `feature/ai-triage` after approval.
2. AI-4: drafts (KB sections, facts builder, prompt, validation, fact guard, context-hash reuse, `/draft`).
3. Then the portals (FE-*), AI-5 (admin AI UI), API-8 (SSE) and AI-6 (evals).

## Do not touch

- `backend/.env`, `author-frontend/.env.local`, `admin-frontend/.env.local`: real credentials, git-ignored, never read into chat.
- `supabase/seed/bookleaf_sample_data.json` (byte-identical). `docs/blueprint/`.

## Commits (approved by the user 2026-10-19)

On `feature/ai-triage` (hashes: `git log --oneline main..`):

1. `feat(shared): add triage result contract and business day start`
2. `feat(ai): add background triage with floors, queue and sweeper` (facts, prompt, floors, job, queue, sweeper, control, system-writer ops, router availability, provider schema, timeout, offline AI tests)
3. `feat(api): queue triage on ticket creation and add manual re-run` (app/server wiring, author router, admin endpoint, spec, route tests)
4. `test: add live AI triage suite`
5. `docs: record AI-3 decisions and verification`
