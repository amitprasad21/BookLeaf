# 2026-10-21: Hardening and payout-quarter follow-up

Branch: `feature/hardening`, based on `0c37073` (also local `main` and `feature/ui-check-fixes`). The user authorised implementing fixes after the read-only assessment. Existing uncommitted security, slow-loading UI and hosting work was preserved. Nothing committed, pushed or deployed.

## Changes and review

- Completed the existing offline security coverage: every documented protected route rejects anonymous callers; role separation; production CORS, headers and generic errors; user/IP request limits; asymmetric JWT prefilter. Added a generated ES256 key/signature regression: an edited subject never reaches the profile lookup; the correctly signed token does.
- Fixed the pending global rate limiter: failed requests now count toward the 300 / 5 min abuse ceiling. Per-route quotas still ignore failures. One test alternates 150 successful and 150 forbidden requests, then asserts 429 and isolation from another user.
- Found and fixed a second parsing problem in both pending redirect helpers: `/section/..//evil.example` normalised to `//evil.example`, which a router would then interpret as an external URL. The author regression failed with that exact result before the fix; both helpers now reject a normalised double-slash pathname. Encoded dot segments are also covered.
- D-036: triage and draft facts now include `possiblyOverduePeriod` and `nextPayoutDueBy`. The reference period is a heuristic, not a per-quarter ledger. On the reported BK011 case, the overdue reference is April–June 2026 / 14 August, while the next scheduled deadline is 14 November. Both prompt versions are `2026-10-21.1`; date warnings recognise the supplied earlier deadline. The deadline day itself stays within the payment window.
- Draft instructions now distinguish overdue and upcoming periods, preserve uncertainty, include the known pending balance / 45-day policy / next scheduled deadline, and ask only whether bank details are linked. Triage instructions distinguish informational distribution questions from outages.
- The draft golden set retains all seven assignment cases and adds BK011's quarter regression (8 cases total). A scoring test rejects the known wrong-quarter sentence. Regex scoring and date/amount guards are not semantic proof; live output still needs review.
- Source review found no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function` use in application/UI sources. Privileged-writer imports are type-only outside the server composition and the existing allowed modules; the secret value is passed at server startup. Existing SQL functions use fixed `search_path`; no migration or authorization policy was changed.

## Checks actually run

Commands use `C:/Program Files/nodejs/node.exe` and its bundled `node_modules/npm/bin/npm-cli.js`; `C:/Program Files/nodejs` is prepended to PATH for nested npm scripts.

| Check | Result |
|---|---|
| Existing backend baseline | 30 files, 354 tests passed |
| Focused payout/draft/triage/signature regressions | 4 files, 67 tests passed |
| `npm run check` | Exit 0: format, ESLint, OpenAPI lint, all-workspace typecheck, 365 backend tests, all 5 workspace builds |
| Author logic suite (`vitest run --root author-frontend`) | 4 files, 30 passed, including redirect regression |
| Admin logic suite (`vitest run --root admin-frontend`) | 6 files, 36 passed, including redirect regression |
| Final redirect source/test lint and format checks | Exit 0; these were rerun after the last redirect edit; production builds included that edit |
| Mock golden-set runners | Covered by `backend/test/ai-eval.test.ts` in the full backend run (36 triage, 8 draft cases); validates the harness, not real-model quality |
| `npm audit --json --registry=https://registry.npmjs.org` | Exit 1: 5 high entries, all traced to the same development dependency advisory below |
| `npm audit --omit=dev --json --registry=https://registry.npmjs.org` | Exit 0: zero reported production dependency vulnerabilities |
| Frontend production static-bundle scan | Broad scan matched two files, each only at the SDK literal `startsWith("sb_secret_")`; zero credential-shaped matches or private environment variable names in either bundle |
| `git diff --check` | Exit 0 |

The first sandboxed Vitest attempt failed loading shared transform files from process-specific Windows temporary directories. A workspace-local temporary directory resolved that issue, then Supertest encountered sandbox loopback `EACCES`. The offline suites passed with approved execution outside the sandbox. A full-run attempt then hit the 5-second default timeout in a duplicated 300-request security test. The failure-counting assertion was combined into the existing 300-request test, with a 15-second timeout for real local HTTP calls; the final full run passed without reducing the limit assertions.

## Dependency finding (SEC-2 remains open)

`eslint-config-next@16.3.8` → `@next/eslint-plugin-next@16.3.8` → `fast-glob@3.3.1` → `micromatch@4.0.8` → `braces@3.0.3`.

The advisory is [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) (CVE-2026-93687): deeply nested brace patterns can exhaust the stack. The advisory lists no patched version as checked 2026-10-21. npm's suggested fix is a major downgrade of `eslint-config-next` to 14.2.35; it was not applied. The five audit entries are the affected package and its dependency chain, not five independent runtime vulnerabilities. Production-only audit reports zero, but this does not make the development finding resolved. Do not accept untrusted glob patterns in development/build automation. Dependency remediation or explicit risk disposition is still needed before SEC-2 sign-off.

Raw audit JSON is in git-ignored `.cache/security-audit-2026-10-21.json` and `.cache/security-audit-production-2026-10-21.json`.

## Not run / still required

The user subsequently approved running the updated live AI evaluations on 2026-10-21. Completed runs, review findings and the final 367-test backend check are recorded in [the live follow-up](2026-10-21-live-ai-followup.md); the list below describes the earlier offline batch boundary.

- Live AI evaluations had not run at this offline checkpoint; they subsequently ran with approval. See the linked live follow-up for current prompt versions and results.
- Live Supabase auth/RLS suites (no hosted writes in this batch); prior evidence remains linked in the security checklist.
- Signed-in browser, accessibility, viewport, conflict and AI-disabled end-to-end checks. The inherited slow-loading UI is built but not newly browser-verified here.
- Independent/human security review, deployed proxy/origin/HTTPS checks, hosting configuration validation and deployment.
- Triage queue pacing and authoritative production-stage durations remain separate AI follow-ups.
