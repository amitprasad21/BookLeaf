# Handover

**Session:** 2026-10-20 (Claude Code)
**Branch:** `feature/ai-evals` (from `main` at `1127692`; three commits; not merged, not pushed)

## Done

- Merged to `main` with approval: Phase 0 through API-8, AI-1..AI-5, FE-1, the author portal and the support console. Neither portal's signed-in screens have been checked in a browser yet.
- **AI-6 evals, built and committed** ([verification/2026-10-20-ai6.md](verification/2026-10-20-ai6.md), D-034):
  - `backend/src/ai/eval/`: `triage-golden.json` (36 cases), `draft-cases.json` (7 sample queries), `golden.ts` (schemas, loaders), `triage-eval.ts`, `draft-eval.ts` (scoring, runner, `rescoreDraftReport`).
  - `backend/src/ai/triage.ts`: `createTriageClassifier` extracted (shared by the service and the eval; behaviour unchanged).
  - `backend/scripts/eval.ts`, with npm scripts `eval:triage`, `eval:drafts` and the `:live` variants (root and backend).
  - `.gitignore`: `backend/eval-results/`.
  - Docs: AI_SPEC section 13 as built, AI_PROVIDER_ORCHESTRATION layout, .back TEST_PLAN.
  - Tests: `backend/test/ai-eval.test.ts` (18).
- Live run approved by the user on 2026-10-20. Triage meets every target (36/36 category, 34/36 priority, 0 schema failures, 3/3 injections). Drafts: 34/38 checks, every reply read.

## In progress

- **Signed-in browser checks for both portals** (unchanged from before). The demo passwords are in `backend/.env`, and sign-in goes to the hosted Supabase project, so the user signs in in the browser pane.

## Broken / risky

- **Free-tier per-minute quotas:** a burst of about 12 triage calls a minute exhausts Gemini's, and Groq's runs out soon after. Real tickets then wait for the sweeper (or go to manual review after three attempts). Pace the eval with `--pace` (8 s is safe).
- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`). Root scripts swallow extra flags: run `npx tsx scripts/eval.ts …` inside `backend/` for `--only`, `--pace` or `--rescore`.
- **Bash heredocs in this environment halve backslashes and can trip on quotes.** Write code containing `\n` or regexes with the file editor; for multi-file text edits, write a Python script file and run it.
- The frontend logic tests run with the root-hoisted Vitest (`npx vitest run --root author-frontend` / `--root admin-frontend`). Declaring `vitest` (and Testing Library, jsdom) in the frontends needs approval.
- A partial-tree typecheck (e.g. while splitting commits) can trip over stale `.next/dev/types` left by a dev server; delete that git-ignored folder first.
- The event hub is in-process: one backend instance only (A-15).
- Free-tier Gemini: content may be used by Google (A-18).
- `GROQ_FALLBACK_API_KEY` in `backend/.env` is unused (C-14); delete it.
- The live suites write and delete tickets. An interrupted run can leave "RLS test ticket", "Live test: …", "Queue test Q…", "Admin test: …", "Reply test: …", "AI triage test: …", "AI draft test: …" or "Events test: …" rows; delete them with the secret key.

## Next

1. Fast-forward `main` to `feature/ai-evals` (approval).
2. Signed-in checks of both portals.
3. AI-6 follow-ups, if wanted: facts-reading rules for the triage prompt; tighter royalty drafts; stage durations in the KB; triage queue pacing. Each prompt change bumps its version and needs a live re-run (approval).
4. Hardening (nonce CSP, a shared web package if the copied session/stream files drift) and deployment.

## Do not touch

- `backend/.env`, `author-frontend/.env.local`, `admin-frontend/.env.local`: real credentials, git-ignored, never read into chat.
- `supabase/seed/bookleaf_sample_data.json` (byte-identical). `docs/blueprint/`.

## Commits (approved by the user 2026-10-20)

On `feature/ai-evals` (hashes: `git log --oneline main..`). Each code commit was checked on its own (the rest stashed).

1. `refactor(ai): extract the triage classifier`
2. `feat(ai): add golden sets and the eval runner`
3. `docs: record AI-6 decisions and the first live eval`
