# Release preparation — 2026-10-22

## Scope and authorization

The user approved implementing the remaining fixes and live AI evaluations, then requested completion of the remaining release work. They confirmed production estimates are unavailable and selected **keep estimates awaiting production confirmation**. They subsequently chose **keep review local only**. No source was transmitted to Claude: automatic approval review rejected the proposed source-bundle command before execution, and it was not retried after that choice.

Codex owns the current trackers and handover. Existing uncommitted changes were preserved. No package installation/upgrade, hosted database write, migration, outbound support message or deployment was performed in this continuation.

## Implementation

- `draft-2026-10-21.5`: replies describe operational tasks as next steps. A server policy guard sends observed completed-action phrasing, missing overdue apologies/period confirmation, a known balance-to-quarter attribution pattern and missing production estimates through one repair attempt. Repeated failure returns `invalid_output` without storing a generated draft. Amount/date warnings remain advisory; manual reply remains available.
- `AI_REQUEST_MIN_INTERVAL_MS` defaults to 8000, accepts 0–30000, and is documented in `.env.example` and the Render Blueprint. Triage jobs and shared per-provider HTTP starts are paced. Repairs and retries use the same provider gate. Cancelled waiting requests are not sent; the queue clears a scheduled wake on shutdown.
- Pacing is process-local and consumes request timeout. It reduces bursts; it does not guarantee provider token/minute quotas or an exact monetary cap.
- Render/Vercel instructions now match the repository-root workspace builds, actual Gemini/Groq environment names and frontend API base ending in `/api/v1`. `WRITEUP.md` is complete; README includes current setup, verification, AI rationale and limits. Hosted URLs and demo credentials are still pending.

## Offline verification

Commands use Node's bundled npm 11 with `C:/Program Files/nodejs` first on PATH. Elevated loopback access is needed for the HTTP integration-style unit tests on this Windows host.

| Check | Observed result |
|---|---|
| `npm run check` | Exit 0: format, lint, OpenAPI lint, all workspace typechecks, 375 backend tests in 31 files and all five workspace production builds |
| `node node_modules/vitest/vitest.mjs run --root author-frontend` | 30/30 tests, 4 files |
| `node node_modules/vitest/vitest.mjs run --root admin-frontend` | 36/36 tests, 6 files |
| Total offline tests | 441 passed; root `check` does not automatically include the two frontend suites |
| Focused pacing/draft/triage/env/eval run before the full check | 90 tests passed |
| `git diff --check` | Exit 0 |
| Documentation links | Initial 22-file check passed; final 18-file documentation batch has 245 local links, no missing targets |
| Hosting files | Render YAML and both Vercel JSON files parse; one API service, correct health path/workspace targets; Render Prettier check passes. Not hosted/deployed validation |

New regressions cover shared HTTP spacing including a retry, cancellation without poisoning later callers, independent provider gates/explicit disable, paced queue starts/deduplication/shutdown, observed draft-policy errors, production-category estimate requirements, and a repeated policy failure causing no draft persistence or generated-draft audit.

**Read-only live Supabase retest:** `node ../node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts test-integration/auth.test.ts test-integration/books.test.ts` passed 12 tests in two files. The two reported skips are the alternate “credentials not configured” sentinel tests, not skipped acceptance checks. Real author/admin sessions work; tampered signatures/subjects and role misuse are rejected. AUTH001, AUTH007 and AUTH009 receive their exact dataset books, including nulls, summary/payout and threshold-rollover checks. No application records were written and no AI providers were called. This is API evidence, not a signed-in browser journey or a full live RLS rerun.

**Local commits:** `4576bcf` records API/security/AI fixes; `36b11ff` records loading states and hosting preparation. Documentation and evidence are recorded in the subsequent documentation commit. No remote, push, merge or deployment occurred.

## Latest approved live draft run

Saved locally, git-ignored: `backend/eval-results/drafts-live-2026-10-21T13-38-17-856Z.json`. The filename is the UTC run timestamp; this continuation inspected the completed report on 2026-10-22. Prompt: `draft-2026-10-21.5`; cases: `draft-cases-2026-10-21.3`.

| Metric | Result |
|---|---|
| Cases answered | 8/8 |
| Automatic checks | 48/49; 7/8 whole cases |
| Amount/date warnings | 0 |
| Provider calls | 15: 14 successes, 1 timeout |
| Providers exercised | Gemini `gemini-3.5-flash-lite` and Groq `openai/gpt-oss-120b` |
| Tokens reported | 31,815 input; 4,199 output |
| Estimated list-price cost | USD 0.017848, not actual billing |
| Mean / maximum reported call latency | 17,930 ms / 30,026 ms, including pacing and timeout |

Every reply and checklist was inspected. The three royalty samples apologise and request finance confirmation of the affected period; pending amounts are presented as totals. Finance/distribution actions are future tasks instead of unsupported completed work. The production sample states Typesetting, stage 4 of 9, then Proofreading, and lists the missing estimate. The single failed check is the original requirement for a concrete production timeline. The user accepted confirmation-pending behavior; the scorer was not weakened to hide that failure.

The prior approved triage result remains 36/36 category and priority, 3/3 injection cases, recorded in [the earlier live follow-up](2026-10-21-live-ai-followup.md). It was not rerun unnecessarily. These are finite samples, not proof against every hallucination, injection or policy phrasing. Admin review is mandatory.

## Local security review and audit

- Revisited the changed auth/rate-limit/payout/draft paths and provider pacing, the RLS-scoped client, explicit author serializer, SSE ownership filtering and frontend security configuration. Protected route and generated ES256 regressions passed in the full suite. No auth weakening, migration, seed change or added dependency was found in this batch.
- A local scan compared the configured Supabase secret, Gemini/Groq keys and both seed passwords without displaying their values. It checked 369 non-ignored repository files, 808 historical Git blobs and 39 frontend static bundle files. **No matches**; no private-key headers; no private environment variable names in static bundles. This checks known configured credentials and specific patterns, not every possible secret type.
- Refreshed `npm audit --omit=dev --json`: zero vulnerabilities. Full `npm audit --json`: five high entries, all rooted in [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), braces stack exhaustion on deeply nested patterns. No patched release is listed. The affected path is development-only `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`.
- Current Next ESLint root directories are fixed repository paths; application inputs are not passed into this lint glob API. This narrows current exposure but does not patch the dependency or constitute maintainer acceptance. npm's proposed major downgrade was not applied. A newer inspected Next lint plugin also retains the affected fast-glob dependency.
- This is a **local Codex review**, not an independent Claude/human security sign-off. The user declined external source review. Human disposition of the development finding and deployment-specific HTTPS/CORS/proxy checks remain outstanding.
- Existing limitations remain: one backend process; request limits reset on restart; SSE reconnects for re-authentication after at most ten minutes; frontend CSP permits inline bootstrap scripts. No new claim of multi-instance safety or strict provider billing enforcement is made.

## Browser observations and limits

- Opened local author/admin portals and Render/Vercel dashboards using the normal in-app browser tools. Hosting pages require sign-in. Both BookLeaf portals were also signed out; the user was asked to sign in directly, without sharing credentials in chat.
- Author login was visually inspected at an observed **320 × 568**: no page-width overflow; email, password and submit controls each measured 44 px high. Tab moves email → password → submit. Enter on an empty form gives the visible error “Enter your email and password” and moves focus to that error.
- Admin login was visually inspected at its observed **1280 × 720** layout. No signed-in queue/detail interaction was performed in this continuation.
- Requests for the remaining viewport sizes did not change the measured author viewport; repeated measurements stayed at 320 × 568 even after reload. They are **not** successful matrix checks. The viewport reset API was called. Full matrix, 200% zoom, keyboard-only signed-in journeys and actual NVDA/VoiceOver checks remain unverified.
- Earlier signed-in evidence is retained in [2026-10-20-ui-checks.md](2026-10-20-ui-checks.md); it does not replace the outstanding two-admin UI conflict, additional-author and full accessibility checks.

## Release gates still open

1. User signs into the intended BookLeaf and hosting accounts; complete the remaining browser scenarios and disposable test-data workflow.
2. Maintainer reviews the local security findings and the unpatched development advisory. Separate human security review is not complete.
3. Publish the reviewed repository, deploy one API and two portals, verify origins/proxy/HTTPS and both support journeys including AI-off behavior. No production migration should be repeated blindly against the already seeded development project.
4. Add actual hosted URLs and the intended public demo login details to README after release verification. Production stage-duration enrichment remains deferred until authoritative information exists.
