# AI Provider Orchestration

**Owns:** the provider interface, provider adapters, router, circuit breaker, budget, job queue, sweeper and usage accounting. What the AI does (taxonomy, prompts, schemas) is in [AI_SPEC.md](../AI_SPEC.md); failure semantics are in [AI_FAILURE_HANDLING.md](AI_FAILURE_HANDLING.md). Status: provider layer (AI-1/AI-2, D-028), triage with queue and sweeper (AI-3, D-029) and drafts (AI-4, D-030) built.

## 1. Module layout

```text
backend/src/ai/
├── drafts.ts              getOrCreate(): reuse by context hash or generate, guards, fact warnings, storage (built, AI-4)
├── config.ts              env → provider plan (per-task models) → router (built, AI-2)
├── router.ts              provider selection, failover, circuit + budget gates, usage events (built)
├── circuit-breaker.ts     (built)
├── budget.ts              daily token budget (system writer sums ai_usage_events) (built)
├── pricing.ts             list-price estimate per model (built)
├── usage.ts               usage event recording, failures logged and swallowed (built)
├── queue.ts               in-process job queue (concurrency 2) + startup/periodic sweeper (built, AI-3)
├── triage.ts              the triage job (built, AI-3)
├── control.ts             what routes may do: enqueue, availability, manual retry (built, AI-3)
├── providers/             (built)
│   ├── types.ts           LlmProvider interface + error taxonomy
│   ├── http.ts            fetch with timeout and the one bounded retry layer
│   ├── json-schema.ts     zod contract → provider JSON Schema; parse + validate output
│   ├── gemini.ts          Gemini REST generateContent adapter (no SDK)
│   ├── groq.ts            Groq OpenAI-compatible adapter (no SDK)
│   └── mock.ts            deterministic provider for tests and local dev
├── prompts/               triage.ts, draft.ts (built: static prompts, delimited user content, repair notes, mock responders); index.ts collects the mocks
├── knowledge-base/        index.ts: the 12 KB sections, KB_VERSION, selectKbSections (built, AI-4)
├── facts/                 triage-facts.ts, draft-facts.ts (built); payout rules from @bookleaf/shared
├── validation/            floors.ts, draft-guards.ts (shape problems, fact warnings, standard sign-off) (built); schemas live in packages/shared
└── eval/                  golden sets (triage-golden.json, draft-cases.json) + runners (AI-6; scripts/eval.ts)
```

## 2. Provider interface

As built (`backend/src/ai/providers/types.ts`):

```ts
interface LlmProvider {
  readonly name: 'gemini' | 'groq' | 'mock';
  modelFor(task: 'triage' | 'draft'): string;   // models can differ per task (D-028)
  generateStructured<T>(req: {
    task: 'triage' | 'draft';
    system: string;        // stable instructions, never ticket text
    user: string;          // volatile content, ticket delimited as untrusted data
    schema: ZodType<T>;    // strict objects, every property required (nullable for optional)
    schemaName: string;
    maxOutputTokens: number;
    timeoutMs: number;
  }): Promise<{ value: T; usage: TokenUsage; latencyMs: number }>;
}

type ProviderErrorKind =
  | 'auth'            // 401/403/404 or Gemini API_KEY_INVALID: key or model access (configuration)
  | 'quota'           // 429 with a retry delay > 60 s: a quota window (e.g. free-tier daily cap)
  | 'rate_limited'    // 429 after the bounded retries
  | 'overloaded'      // 5xx / Groq 498 after the bounded retries
  | 'timeout'
  | 'connection'
  | 'bad_request'     // 400/413: our bug or prompt too large
  | 'refused'         // safety stop, blocked prompt, refusal, content filter
  | 'invalid_output'; // not JSON for the schema, or cut off at the token limit (usage still counted)
```

Adapters classify failures from HTTP status and documented structured fields, never by matching message text. Transient retries happen **inside the adapter** (`http.ts`):
- up to `AI_MAX_RETRIES` extra attempts for 408/429/5xx and connection drops;
- the provider's retry delay is honoured when it is 5 s or less;
- a timeout is never retried (it already used the attempt's time).

The router adds no second retry loop. Provider-specific request and response details: [AI_SPEC.md](../AI_SPEC.md) §2.

## 3. Router algorithm

```text
route(request):
  if config.primary == none            → throw AiUnavailable('not_configured')
  if budget.exhausted()                → record budget_blocked; throw AiUnavailable('budget_exhausted')
  for provider in [primary, fallback?]:            # fallback only if configured
      if breaker(provider).isOpen()    → record circuit_open; continue
      try:
          result = provider.generateStructured(request)
          breaker(provider).recordSuccess()
          usage.record(success, result.usage)
          return result
      catch ProviderError e:
          usage.record(e.kind)
          switch e.kind:
            auth        → breaker(provider).forceOpen(untilConfigChange); log config error (no key); continue
            quota       → breaker(provider).openFor(1 hour); continue   # the fallback carries on
            bad_request → do not fail over (same request fails anywhere); throw AiUnavailable('provider_unavailable')
            refused     → do not fail over (policy decision, not outage); throw AiUnavailable('refused')
            invalid_output → (caller may do one repair attempt) ; throw AiUnavailable('invalid_output')
            rate_limited | overloaded | timeout | connection →
                          breaker(provider).recordFailure(); continue   # try fallback if any
  throw AiUnavailable('provider_unavailable' or 'circuit_open')
```

**Fallback rules (constraint C-14):** a fallback is a *different, explicitly configured provider* with its own key and budget share. Never a second key for the same account. Disabled when `AI_FALLBACK_PROVIDER` is empty (default).

## 4. Circuit breaker (per provider)

| State | Behaviour | Transition |
|---|---|---|
| Closed | Calls allowed | `AI_CIRCUIT_FAILURE_THRESHOLD` (3) consecutive transient failures → Open |
| Open | Calls skipped (`circuit_open`) | After `AI_CIRCUIT_COOLDOWN_MS` (60 s) → Half-open. Auth failures stay open until restart/config change |
| Half-open | One probe call allowed | Success → Closed; failure → Open (cooldown doubles, max 10 min) |

State is in-memory (single instance, A-15) and exposed in `GET /admin/ai/usage`.

## 5. Budget

- `AI_DAILY_TOKEN_BUDGET`: sum of `input_tokens + output_tokens` in `ai_usage_events` since 00:00 Asia/Kolkata, cached for 30 s.
- Checked before each call. Once at or over budget, new AI work stops with `budget_exhausted` until the next day; manual mode continues.
- Per-ticket caps: 1 automatic triage + 2 sweeper retries; 3 manual re-triages/day; 5 draft regenerations/day.

## 6. Job queue and sweeper

As built (AI-3, D-029):
- **Enqueue:** `triage.enqueue(ticketId)` after the ticket insert commits (author router). Concurrency 2, in-process (D-007); duplicates are dropped by id.
- **Pacing (AI-8):** queue starts are separated by `AI_REQUEST_MIN_INTERVAL_MS` (default 8000). A shared gate per provider instance also spaces HTTP attempts across triage, drafts, repairs and retries. Cancelled waiting requests are not sent; closing the queue clears its wake timer. Waiting consumes provider timeout, so busy periods may use fallback/manual mode. Pacing reduces bursts rather than guaranteeing token/minute quotas; it is single-process only.
- **Job:** `loadTicketForTriage` → build facts → triage prompt → `route()` (one repair attempt on `invalid_output`) → zod validate + floors → `saveTriageResult`, or `markTriageFailure(reason, final)`.
  - Both writes increment `ai_attempts` and are conditional on the version loaded. On a conflict the job reloads and re-applies the same outcome (no second AI call).
  - Transient (router `retryable`, attempts left) → `failed`, eligible for the sweeper.
  - Otherwise `manual_review_required`: not configured, budget exhausted, invalid output after repair, refusal, bad request, configuration error, or 3 attempts used.
- **Sweeper:** at startup and every 5 minutes, re-enqueues `failed`/`pending` tickets untouched for 2 minutes with `ai_attempts < 3` (20 per pass). It skips while `router.availability()` is not ok: AI off, budget spent, or every circuit open.
- **Manual re-run:** `resetTriage` (pending, attempts 0), then enqueue (`POST /admin/tickets/{id}/triage`).
- **Graceful shutdown:** stop accepting jobs and wait up to 8 s for running ones (the process exits by 10 s). Anything unfinished is picked up by the next sweep.

## 7. Draft service

`getOrCreateDraft(ticketId, adminId, { regenerate })`:
1. Load ticket (admin client) → build `TicketFacts` → select KB sections → compute `context_hash`.
2. If `!regenerate` and a `ready` draft with this hash exists → return it (200).
3. Check regeneration caps → `route()` with the draft prompt.
4. Validate schema, KB subset, shape and draft-policy guards. Policy checks target observed completed-action claims, missing overdue apologies/period confirmation, total-balance quarter attribution and missing production estimates. On failure, make one repair attempt with the error appended, then `AiUnavailable('invalid_output')`; no failed draft is persisted. Amount/date warnings remain advisory.
5. Run the fact guard → `fact_warnings`.
6. Mark earlier drafts `superseded`; insert the new draft; audit `ai.draft_generated` / `ai.draft_regenerated`; return 201.

As built (AI-4, D-030):
- It runs on the admin's request with the admin's RLS-scoped repository (`findDetail`, `findReadyDraft`, `insertDraft`, `supersedeOtherDrafts`, `countAuditEvents`), so no system writer is involved.
- The guards also reject a reply with no paragraph breaks, and the server sets the standard sign-off before the fact guard runs.
- Regeneration caps: 5 per ticket per India business day (from audit events) and 10 per minute per admin (route limiter).
- With AI off, the route answers 503 `not_configured`.

## 8. Usage accounting and cost estimate

Every attempt (including failures and budget/circuit skips) writes one `ai_usage_events` row: task, provider, model, prompt version, outcome, tokens (incl. cache read/write), latency, estimated cost. Cost uses a per-model price table in `ai/pricing.ts` (USD per 1M tokens for input, output, cache read and cache write). Prices are verified against the provider's current pricing at AI-1 and always labelled "estimate".

## 9. Configuration

| Variable | Default | Meaning |
|---|---|---|
| `AI_PRIMARY_PROVIDER` | `mock` (dev/test); required in prod (`gemini`, `groq` or `none`; never `mock`) | `gemini` \| `groq` \| `mock` \| `none` |
| `AI_PRIMARY_MODEL` / `AI_PRIMARY_DRAFT_MODEL` | Gemini: `gemini-3.5-flash-lite` for both (D-030; `gemini-3.8-flash` was too slow for drafts on the free tier); Groq: `openai/gpt-oss-120b` | The model sets both tasks unless the draft model is given |
| `AI_FALLBACK_PROVIDER` (+ `_MODEL`, `_DRAFT_MODEL`) | empty | Must differ from the primary (C-14) |
| `GEMINI_API_KEY` / `GROQ_API_KEY` | (none) | Required for each configured provider; never printed. Placeholders and empty values count as not set |
| `AI_DAILY_TOKEN_BUDGET` | 300000 | Hard daily cap |
| `AI_TRIAGE_TIMEOUT_MS` / `AI_DRAFT_TIMEOUT_MS` | 30000 / 30000 | Per-attempt timeouts (triage raised from 15 s: free-tier calls took 8–13 s, D-029) |
| `AI_MAX_RETRIES` | 2 | SDK retries for transient errors |
| `AI_CIRCUIT_FAILURE_THRESHOLD` / `AI_CIRCUIT_COOLDOWN_MS` | 3 / 60000 | Breaker |

`mock` returns deterministic outputs keyed by keywords in the ticket and can be told to fail in specific ways (`[mock:timeout]`, `[mock:invalid]` markers, honoured only when `NODE_ENV !== 'production'`) for tests and demos of degradation.
