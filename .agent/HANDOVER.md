# Handover

**Session:** 2026-10-19 (Claude Code)
**Branch:** `feature/ai-core` (from `main` at `4d09a91`; three AI-1/AI-2 commits; not merged, not pushed)

## Done

- Merged to `main` with approval: Phase 0 through API-7. The database in project `jhszxq…` has the schema, live RLS, the exact seed, the queue urgency rank and the atomic reply function. The ticket API is complete except SSE.
- **AI-1/AI-2** ([verification/2026-10-19-ai1-ai2.md](verification/2026-10-19-ai1-ai2.md), decision D-028):
  - Providers:
    - Gemini `gemini-3.5-flash-lite` (triage) and `gemini-3.8-flash` (drafts), with Groq `openai/gpt-oss-120b` as fallback, all on free tiers.
    - REST adapters without SDKs. The Anthropic SDK install was not done: there's no Anthropic key.
  - `backend/src/ai/`:
    - `providers/` (types, http retry layer, gemini, groq, mock, json-schema).
    - `circuit-breaker.ts`, `budget.ts`, `pricing.ts`, `usage.ts`, `router.ts`, `config.ts`.
  - Config: new AI settings in `config/env.ts` (placeholders count as unset; production needs a real provider; the fallback must be a different provider, C-14). The system writer gained `appendUsageEvent` and `tokensUsedSince`.
  - `npm run check:ai` / `check:ai:live`. The live run made one synthetic call per model: all OK, with 3.8 Flash OK on retry after one transient overload.
  - `.env.example`, AI_SPEC §2, AI_PROVIDER_ORCHESTRATION, AI_FAILURE_HANDLING, CREDENTIALS_GUIDE updated; D-010 superseded; A-18 (Gemini free-tier data use).
- Results: `npm run check` exit 0 (236 tests, 55 of them new AI tests).

## In progress

- Nothing half-done. AI-1/AI-2 are committed on `feature/ai-core`. Merging into `main` needs approval.

## Needs the user

- In `backend/.env` (non-secret settings): set `AI_PRIMARY_PROVIDER=gemini` and `AI_FALLBACK_PROVIDER=groq`; until then the app uses the mock. Delete `GROQ_FALLBACK_API_KEY` (unused; key cycling is not allowed, C-14). Then `npm run check:ai` should show both providers.

## Broken / risky

- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`). Root scripts swallow extra flags; run vitest inside `backend/` when flags are needed.
- Free-tier quotas are small and unpublished (about 20 requests/day reported for 3.8 Flash). Drafts should be cached (context hash, AI-4), and evals (AI-6) should mostly run on Flash-Lite or Groq.
- On the Gemini free tier, Google may use prompts and outputs to improve its products (A-18). This is fine for the fictional demo data, not for production.
- After a DDL change the Data API's schema cache can lag for a minute: re-run `check:db`.
- Ticket writes and their audit events are separate writes. An audit failure is logged, not retried.
- The live suites write and delete tickets. An interrupted run can leave "RLS test ticket", "Live test: …", "Queue test Q…", "Admin test: …" or "Reply test: …" rows; delete them with the secret key.

## Next

1. Fast-forward `main` to `feature/ai-core` after approval.
2. AI-3: triage (prompt, schema, policy floors, async queue after ticket creation, startup sweeper, `/triage` retry).
3. Then AI-4 (drafts), the portals (FE-*), and API-8 (SSE).

## Do not touch

- `backend/.env`, `author-frontend/.env.local`, `admin-frontend/.env.local`: real credentials, git-ignored, never read into chat.
- `supabase/seed/bookleaf_sample_data.json` (byte-identical). `docs/blueprint/`.

## Commits (approved by the user 2026-10-19)

On `feature/ai-core` (hashes: `git log --oneline main..`):

1. `feat(ai): add provider adapters for Gemini, Groq and a mock` (types, http retry layer, json-schema, adapters, adapter tests)
2. `feat(ai): add router with circuit breaker, daily budget and usage events` (router, breaker, budget, pricing, usage, config, env settings, system writer, `check:ai`, tests)
3. `docs: record AI provider decision and AI-1/AI-2 verification`
