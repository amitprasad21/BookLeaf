# 2026-10-21: Live AI follow-up

The user explicitly approved live evaluations against the configured providers after approving implementation. These runs use the repository's synthetic golden cases and seed facts through the production AI service paths, with in-memory stores and usage accounting. No hosted database writes, credential changes, dependency changes, commits or deployments were made.

Commands, run sequentially from `backend/` using the installed Node executable:

```text
node ../node_modules/tsx/dist/cli.mjs --env-file-if-exists=.env scripts/eval.ts triage --live --pace=8000
node ../node_modules/tsx/dist/cli.mjs --env-file-if-exists=.env scripts/eval.ts drafts --live --pace=8000
```

Eight seconds separates cases to avoid the burst that exhausted the free-tier quotas in the earlier evaluation. This does not implement pacing in the runtime triage queue. Every returned draft, its missing-information list and its internal checklist was read; automatic pattern scores alone do not establish factual correctness.

## Triage

`triage-2026-10-21.1`, 36 cases: **36/36 category, 36/36 priority**, 94.4% signal recall, **3/3 injection cases handled normally**, zero final schema failures or unavailable answers. One invalid response was repaired successfully. The informational distribution / within-window listing cases now have the expected priorities.

Report: `backend/eval-results/triage-live-2026-10-21T09-03-27-163Z.json` (git-ignored).

37 calls; 49,233 input / 3,128 output tokens; estimated list-price cost $0.022593; mean 1,443 ms / maximum 2,487 ms per provider call. All calls used Gemini `gemini-3.5-flash-lite`; Groq fallback was not exercised.

## Draft iterations and review findings

All runs use eight cases, with facts fixed at 2026-10-20 for consistent deadlines. Scores use the rubric version recorded in each report; the check count grew as live review exposed unsupported statements.

| Prompt | Rubric | Automatic result | Review / action |
|---|---|---|---|
| `draft-2026-10-21.1` | `draft-cases-2026-10-21.1` | 43/46 checks; 6/8 complete cases; 1 fact warning | The royalty-amount answer omitted the breakdown offer and used a mismatched deadline year. Added explicit answer-first and exact-date rules. The production timeline was missing. |
| `draft-2026-10-21.2` | `draft-cases-2026-10-21.1` | 45/46 checks; 7/8 cases; no fact warnings | Manual review found a whole balance assigned to April–June and an unsupported claim that production was progressing without hold-ups. Added regressions and stronger uncertainty rules. |
| `draft-2026-10-21.3` | `draft-cases-2026-10-21.2` | 47/48 checks; 7/8 cases; no fact warnings | The quarter and balance statements were corrected, and the missing production estimate was listed. Review still found an unsupported claim that the production team was working closely on the manuscript, plus a re-sync described as already triggered. Tightened stage-only facts and planned-action wording; added a completed-action regression. |
| `draft-2026-10-21.4` | `draft-cases-2026-10-21.3` | **48/49 checks; 7/8 cases; no fact warnings** | Distribution now describes a planned re-sync; production states the recorded stage and asks for an estimate. The only automatic failure is the missing timeline. Manual review still found a past-tense finance-contact claim and missing apologies in the royalty replies, so this is not full draft-quality acceptance. |

Local reports:

- `.1`: `backend/eval-results/drafts-live-2026-10-21T09-05-04-262Z.json`
- `.2`: `backend/eval-results/drafts-live-2026-10-21T13-08-21-045Z.json`
- `.3`: `backend/eval-results/drafts-live-2026-10-21T13-14-07-881Z.json`
- `.4`: `backend/eval-results/drafts-live-2026-10-21T13-18-03-923Z.json`

| Draft run | Calls | Input / output tokens | Estimated list-price USD | Mean / max call latency |
|---|---|---|---|---|
| `.1` | 15 | 25,918 / 4,245 | $0.018387 | 1,890 / 2,163 ms |
| `.2` | 15 | 28,062 / 4,170 | $0.018845 | 3,375 / 7,776 ms |
| `.3` | 14 | 28,977 / 3,992 | $0.018674 | 2,380 / 4,145 ms |
| `.4` | 15 | 32,612 / 3,970 | $0.019712 | 3,705 / 12,247 ms |

Provider-call success is distinct from a usable draft: the service can request a repair for a shape/length or fact-guard problem even after a successful provider response. Costs are estimates from the configured rate table, not verified billing charges. Gemini handled these runs; this evidence does not validate Groq quality or fallback behavior.

## Final offline verification

After the final prompt and rubric changes, `npm run check` exited 0: formatting, ESLint, OpenAPI lint (two existing ignored rules), all-workspace typechecking, **367 backend tests in 30 files**, and all five workspace production builds. Earlier unchanged frontend logic suites passed **30 author + 36 admin tests**, bringing this batch's offline total to **433**. The final production bundle scan again found no credential-shaped strings or private environment variable names; `git diff --check` passed.

The five completed live runs used **96 provider calls**, 164,802 input and 19,505 output tokens, with **$0.098211 estimated list-price cost** in total. This is not a billing statement.

## Final draft review

- All three royalty replies correctly separate total pending balances, the April–June reference deadline of 14 August 2026, and the next scheduled payout where requested. Each lists finance confirmation of the affected period as missing information. The amount-query case explains the net-profit deductions, 80% share and breakdown offer.
- ISBN, printing, distribution and metadata answers retain their supplied policy timelines. Distribution now says the team will be asked to re-sync and includes that action in the checklist.
- Production gives Typesetting, stage 4 of 9, then Proofreading; it asks for a completion estimate and records that missing information. It does not establish a specific timeline or reason for delay.
- **Residual manual findings:** the royalty-amount reply says finance has already been asked to investigate, despite no supporting action record; its internal checklist also initially names April–June as the affected payout before asking finance to confirm. The royalty replies acknowledge concern but omit the requested explicit apology. An admin must correct these before sending. These failures are not caught by the amount/date guard or the current pattern checks; AI-7 remains in progress.
- Replies must also be checked for tone and length; passing pattern checks are not a promise that every style instruction was followed. No message was sent to an author and no escalation or re-sync was performed by the evaluation.

## Remaining limits

- The assignment asks for a specific production timeline, but the supplied knowledge base and seed facts have no authoritative stage durations or completion estimate. The timeline rubric remains a failure; it was not removed or weakened. BookLeaf must supply that information before this case can satisfy the requirement.
- The overdue period is a reference from a heuristic, not a quarterly ledger. Finance must confirm the affected period; drafts must not assign the whole outstanding balance to that quarter.
- Amount/date guards and regex checks cannot prove a reply's meaning. Admin review is still required before sending or carrying out any recommended action.
- No live Supabase security rerun, signed-in browser QA, independent/human security review, deployment or hosting validation was performed in this follow-up. See the [hardening record](2026-10-21-hardening-ai-followup.md) for offline security checks and the open development dependency advisory.

One earlier attempt to start draft `.2` was rejected by automatic approval review because its usage limit had been reached; that attempt did not execute. The user said to continue, and the subsequent approved execution completed. Sandbox loopback restrictions also prevented five HTTP tests in a focused run; full verification uses approved execution with local HTTP access.
