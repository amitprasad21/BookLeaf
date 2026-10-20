# Defense: Preparing for the Technical Discussion

**Owns:** concise, honest answers to the questions reviewers are likely to ask, each pointing to where the evidence lives. Update answers once things are built and measured. **Until then, every answer describes the plan, not proof.**

| # | Question | Short answer | Evidence |
|---|---|---|---|
| 1 | Why two frontends and one backend? Where is authorization enforced? | Separate bundles keep admin code away from authors. All rules live in the one API: auth middleware → role guard → ownership in every query → RLS underneath | [ARCHITECTURE.md](../ARCHITECTURE.md) §3, D-001, D-005 |
| 2 | How do you stop cross-author access? | Identity from the verified JWT, author ID from the DB profile, ownership filters in services, 404 on not-owned, and RLS because user queries run with the caller's JWT | [.back/SUPABASE_RLS.md](../.back/SUPABASE_RLS.md), SEC-1 tests |
| 3 | Why save the ticket before calling AI? | The author's submission must never depend on a third-party API. AI runs after the 201; failures leave a usable ticket in manual review | D-007, [.agent/FLOW.md](FLOW.md) §2 |
| 4 | What happens on rate limit / budget exhaustion / invalid key? | SDK retries transient errors (bounded, honours retry-after); circuit breaker after repeated failures; budget stop; invalid key → no retries, config alert; all → manual mode | [.back/AI_FAILURE_HANDLING.md](../.back/AI_FAILURE_HANDLING.md) |
| 5 | Why isn't fallback just rotating keys? | That evades provider limits and terms. A fallback is a different, explicitly approved provider with its own budget, or manual mode | C-14, [.back/AI_PROVIDER_ORCHESTRATION.md](../.back/AI_PROVIDER_ORCHESTRATION.md) |
| 6 | How do you contain prompt injection? | The model sees only the requesting author's own data (nothing to leak), input is delimited, output is schema-constrained, the model has no tools, and a human sends every reply | [AI_SPEC.md](../AI_SPEC.md) §10 |
| 7 | Which keys are public and which are secret? | Supabase URL and publishable key are public (RLS protects data). Supabase secret key and LLM keys are server-only in `backend/.env` and host secrets | [.agent/CREDENTIALS_GUIDE.md](CREDENTIALS_GUIDE.md) |
| 8 | How is token cost controlled? | One triage call, lazy cached drafts, category-selected KB sections, own-book facts only, capped thread, prompt caching, daily budget, per-user limits, usage logging | [AI_SPEC.md](../AI_SPEC.md) §11 |
| 9 | Why Claude Haiku 5.5? | Proposed: cheapest tier with structured outputs, adequate for classification and short drafts; one model = one cache + eval baseline; upgrade drafts to Sonnet only if evals demand it | D-010 (pending eval) |
| 10 | How do you know classification is accurate? | A 36-case golden set bound to the real seed data, scored through the production classifier: 100% category, 94.4% priority within the acceptable set (targets 90% / 85%), no schema failures, 3/3 injection attempts ignored (2026-10-20, Gemini Flash-Lite with Groq fallback) | [verification/2026-10-20-ai6.md](verification/2026-10-20-ai6.md), D-034 |
| 11 | Why compute dates in code? | Payout windows and thresholds are policy arithmetic; models get them wrong. Code is testable; the model only writes prose | D-009, [AI_SPEC.md](../AI_SPEC.md) §8 |
| 12 | How do you prevent AI hallucinating numbers to authors? | Facts supplied explicitly, prompt forbids invention, fact guard flags mismatches, a human sends | [AI_SPEC.md](../AI_SPEC.md) §9 |
| 13 | How are Git changes reviewed? What's a proposed vs real commit? | Full diff review against the checklist; agents propose messages and the user approves; only real hashes are reported | [GIT_WORKFLOW.md](../GIT_WORKFLOW.md) |
| 14 | What has actually been verified? | See the verification log. Anything not there is unverified | [verification/](verification/README.md), [PROJECT_STATE.md](../PROJECT_STATE.md) |
| 15 | How would you roll back a risky change? | Revert commits, promote previous deploys, `AI_PRIMARY_PROVIDER=none` for AI issues, backups before migrations | [ROLLBACK.md](ROLLBACK.md) |
| 16 | What would you do with more time / for production? | Durable job queue, multi-instance event bus, Redis rate limits, real uploads, SLA reporting, per-platform royalty breakdown, eval in CI on every prompt change | [TASKS.md](../TASKS.md) stretch, ALTERNATIVES |
