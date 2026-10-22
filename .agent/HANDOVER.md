# Handover

**Session:** 2026-10-22 (Codex)
**Branch:** `main` pushed to `origin` (github.com/amitprasad21/BookLeaf, public). **Deployed by the user 2026-10-22:** API https://bookleaf-338a.onrender.com/api/v1, author portal https://bookleaf-author.vercel.app, support console https://bookleafsupport.vercel.app.

**Deployment check 2026-10-22 (Claude Code, branch `docs/live-deployment`):** [record](verification/2026-10-22-deployment.md). API health, headers, docs, auth, roles, CORS (both portals allowed, others refused), SSE and the dataset books pass (13/13 read-only signed-in checks). Open: **D-1** the author portal's live build still calls `http://localhost:4000/api/v1`; set `NEXT_PUBLIC_API_BASE_URL` for Production in Vercel and redeploy without the build cache. **D-2** per-IP limits aren't per visitor behind Render's proxies (follow-up proposal exists). Not yet run live: ticket → AI triage → draft → reply, AI-off path (they write records and call AI: need approval). README rewritten for evaluators; demo passwords are deliberately not in it.

**Update 2026-10-22 (Claude Code, branch `docs/deployment-runbook`):** re-ran the checks on `main`: lint, OpenAPI lint, typecheck, 375 backend tests and all five builds pass; author 30 and console 36 tests pass. `npm run check` stops at lint locally only because ESLint also reads the git-ignored helper scripts in `.cache/` (absent from a clone); run `npx eslint . --ignore-pattern ".cache/**"` or delete `.cache/`. Wrote the click-by-click Render + Vercel runbook in `.back/DEPLOYMENT.md`, including a proxy check: if `TRUST_PROXY_HOPS` is too low on Render, every visitor shares one per-IP bucket and 50 failed sign-ins lock everyone out for up to 5 minutes.
**Ownership:** Codex owns this batch and the shared trackers. Earlier uncommitted work was preserved. No concurrent agent owner is recorded.
**Authorization:** User approved implementation and live AI evaluations, then requested completion of the listed release work. Production estimates are unavailable: keep them awaiting production confirmation. User explicitly selected **Keep review local only**; do not send source to Claude or another external reviewer. A separate human release review is still required.

## Done

- SEC-1 hardening: global request ceiling counts failures; auth/IP health limits; asymmetric JWT prefilter plus real generated-key signature regression; normalized login redirect escape fixed in both portals.
- AI-7: overdue reference quarter and next scheduled deadline separated; deadline day remains inclusive. Draft .5 adds one-repair policy enforcement for observed completed actions, overdue tone/period omissions, balance attribution and missing production estimates. Repeated failure stores no generated draft; manual replies remain available.
- AI-8: configurable provider HTTP pacing (default eight seconds) shared across tasks, repairs and retries; triage queue start pacing, duplicate suppression, cancellation and shutdown covered.
- AI-9: authoritative estimates remain unavailable. User accepted the missing-estimate fallback; data enrichment is deferred and the original specific-timeline rubric still fails honestly.
- Latest approved live drafts: eight answers, 48/49 automatic checks, seven whole cases, zero amount/date warnings; every reply/checklist inspected. Earlier action/tone issues corrected in these samples. Both Gemini and Groq exercised; 15 calls (14 success, one timeout), estimated list price USD 0.017848. Previous triage result remains 36/36 category and priority, 3/3 injection cases; not rerun unnecessarily.
- Full `npm run check` passed: format, lint, API lint, types, 375 backend tests and all five workspace builds. Separate author/admin suites passed 30 and 36 tests: total 441.
- Read-only live Supabase auth/books retest passed 12 tests; two alternate missing-credentials sentinel tests were skipped as designed. Real sessions, tampered JWT rejection, role guards and exact/isolation/rollover books for three authors pass. This made no application writes and no AI calls; it does not replace browser QA.
- Refreshed dependency audit: production 0; development 5 high entries from one braces advisory, still unpatched. Local review and configured-secret scan: no matches across 369 working files, 808 historical blobs and 39 static bundle files. No migration/seed/dependency changes.
- Render/Vercel files prepared, including pacing; deployment guide corrected for repo-root workspace builds and actual provider names. Hosting YAML/JSON parse and expected targets match; Render formatting passes. README updated; `WRITEUP.md` complete. Initial 22-file Markdown check passed; final 18-file docs batch has 245 checked local links, none missing.
- Evidence: [release preparation](verification/2026-10-22-release-preparation.md). Historical [hardening](verification/2026-10-21-hardening-ai-followup.md) and [live AI](verification/2026-10-21-live-ai-followup.md) records remain unchanged as history. Decisions D-037/D-038 record current choices.

## Open release gates

1. **QA-1:** author/admin portals are signed out. User was asked to sign in directly, not share passwords. Author login checked at observed 320×568 (44 px controls, no width overflow, keyboard order and empty-submit error focus); admin login visually checked at observed 1280×720. Further viewport requests did not alter measured dimensions, so the matrix is not passed. Full signed-in/zoom/keyboard/screen-reader journey, additional-author checks and two-admin UI conflict remain. Earlier signed-in evidence exists from October 20.
2. **SEC-2:** local review is recorded, not independent human sign-off. The external Claude source-bundle command was rejected by automatic approval review before execution; user then chose local-only. No source was sent. The unpatched development braces finding needs maintainer disposition; no major package downgrade was attempted. Deployed CORS/proxy/HTTPS still need verification.
3. **DEP-1..3:** Render and Vercel dashboards need sign-in. No external project/repository created, no actual URLs. Confirm the Supabase demo project; the existing development project is already seeded, so don't blindly rerun migrations/seed. One backend instance is required.
4. **DOCS-2:** actual hosted links and intended public demo credentials await deployment. Do not publish backend/provider secrets. WRITEUP is complete but must reflect final deployment state if it changes.

## Browser and processes

- In-app browser id `2`; last kept tabs: author `6` (localhost:3000/login), admin `7` (localhost:3001/login), Render `8`, Vercel `9`. They were marked for handoff; use inventory if stale. Hosting tabs show login pages. The viewport reset API was called, but subsequent measured author dimensions remained 320×568; don't claim responsive sizes that did not apply.
- Existing local Next dev/API processes from prior work remain. Attempts to start production frontends reported EADDRINUSE; no process was killed. Existing API was originally started with AI disabled for QA. Inspect actual process/port state before starting more servers or claiming which build is served.
- Node bundled npm 11: `C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js`; put Node's directory first on PATH. Elevated loopback access needed for Vitest HTTP tests. Avoid concurrent Next dev/build operations on shared output.
- GitHub CLI is installed and earlier elevated auth verified `amitprasad21`; no remote exists. Render/Vercel CLIs/tokens were not installed/configured.

## Do not touch / limits

- Preserve ignored credential files (`backend/.env` and both frontend `.env.local` files); never output their values. Use presence checks and direct user entry in hosting settings.
- Keep the seed JSON byte-identical; preserve `docs/blueprint/`. No hosted DB writes occurred in this continuation; live model evals use in-memory stores.
- Pacing/limits/SSE are single-process. Queue waiting consumes call timeout; the latest mean 17.93 s is per reported provider call, not a promise for whole-draft latency. Multiple calls may be needed for repair/fallback. Guards and finite evals do not replace admin review.
- Frontend AGENTS.md/CLAUDE.md files were generated by Next dev; inspected and preserved. Follow their local Next documentation requirement before future frontend code changes.
- Local helpers under ignored `.cache/` scan configured secrets/history/bundles and documentation links without printing secrets. They are not deployed artifacts.

## Local commits

- `4576bcf` — `fix: harden API boundaries and AI draft processing`
- `36b11ff` — `chore: prepare portal loading states and hosting configuration`
- This handover and release evidence are included in `docs: record release verification and remaining access gates`; obtain its hash from `git log`.

Verify final status from Git. The next release action depends on signed-in sessions and human security review; do not claim deployment is complete.
