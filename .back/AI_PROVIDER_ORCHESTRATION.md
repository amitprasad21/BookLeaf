# AI Provider Orchestration

**Owns:** the provider interface, provider adapters, router, circuit breaker, budget, job queue, sweeper and usage accounting. What the AI does (taxonomy, prompts, schemas) is in [AI_SPEC.md](../AI_SPEC.md); failure semantics are in [AI_FAILURE_HANDLING.md](AI_FAILURE_HANDLING.md). Status: planned (AI-2..AI-4).

## 1. Module layout

```text
backend/src/ai/
├── orchestrator.ts        triageTicket(), getOrCreateDraft(): the only entry points used by services
├── router.ts              provider selection, failover, circuit + budget gates
├── circuit-breaker.ts
├── budget.ts              daily token budget (reads ai_usage_events via system writer)
├── queue.ts               in-process job queue (concurrency 2) + startup sweeper
├── usage.ts               usage event recording + cost estimate
├── providers/
│   ├── types.ts           LlmProvider interface + error taxonomy
│   ├── anthropic.ts       @anthropic-ai/sdk adapter (structured outputs)
│   ├── openai-compatible.ts  optional fallback adapter (configured base URL)
│   └── mock.ts            deterministic provider for tests and local dev
├── prompts/               triage.ts, draft.ts (versioned prompt builders)
├── knowledge-base/        kb.*.md section files + index.ts (section registry)
├── facts/                 build-facts.ts (uses lib/payout-calendar.ts)
├── validation/            schemas (from packages/shared), floors.ts, fact-guard.ts, placeholder-guard.ts
└── eval/                  golden sets + runners
```

## 2. Provider interface

```ts
interface LlmProvider {
  readonly name: 'anthropic' | 'openai-compatible' | 'mock';
  readonly model: string;
  generateStructured<T>(req: {
    task: 'triage' | 'draft';
    system: SystemBlock[];          // stable blocks first, with cache hints
    user: string;                   // volatile content last
    schema: ZodType<T>;
    maxTokens: number;
    effort?: 'low' | 'medium' | 'high';
    timeoutMs: number;
  }): Promise<{ value: T; usage: TokenUsage; latencyMs: number }>;
}

type ProviderErrorKind =
  | 'auth'            // 401/403: invalid or revoked key
  | 'rate_limited'    // 429 after SDK retries
  | 'overloaded'      // 529/5xx after SDK retries
  | 'timeout'
  | 'connection'
  | 'bad_request'     // 400: our bug or prompt too large
  | 'refused'         // stop_reason === 'refusal'
  | 'invalid_output'; // schema/semantic validation failed, or stop_reason === 'max_tokens'

class ProviderError extends Error { kind: ProviderErrorKind; retryAfterMs?: number }
```

Adapters translate SDK-specific typed exceptions into `ProviderError`, never by matching error message strings. Retries for transient errors happen **inside the SDK** (`maxRetries = AI_MAX_RETRIES`, which honours `retry-after`). The router does not add a second retry loop.

**Anthropic adapter specifics** (see [AI_SPEC.md](../AI_SPEC.md) §2): `client.messages.parse()` with `output_config.format` from the zod schema; no `temperature`/`top_p`/`top_k`; `output_config.effort` per task; check `stop_reason` before reading content; system prompt blocks carry `cache_control` breakpoints; usage maps `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`.

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

- `queue.enqueueTriage(ticketId)` after the ticket insert commits. Concurrency 2, in-process (D-007).
- Job: `loadTicketForTriage` → build facts → triage prompt → `route()` → validate + floors → `saveTriageResult`, or `markTriageFailure(reason, final)`.
  - Transient reasons (`provider_unavailable`, `circuit_open`) → `failed` (eligible for sweeper).
  - Final reasons (`not_configured`, `budget_exhausted`, `invalid_output` after repair, `refused`, attempts ≥ 3) → `manual_review_required`.
- Sweeper: at startup and every 5 minutes, re-enqueue `failed`/`pending` tickets older than 2 minutes with `ai_attempts < 3`, skipping while the breaker is open or the budget is exhausted.
- Graceful shutdown: stop accepting jobs and wait up to 10 s for in-flight jobs. Anything unfinished is picked up by the next sweep.

## 7. Draft service

`getOrCreateDraft(ticketId, adminId, { regenerate })`:
1. Load ticket (admin client) → build `TicketFacts` → select KB sections → compute `context_hash`.
2. If `!regenerate` and a `ready` draft with this hash exists → return it (200).
3. Check regeneration caps → `route()` with the draft prompt.
4. Validate (schema, KB subset, placeholder guard). On failure, make one repair attempt with the error appended, then `AiUnavailable('invalid_output')`.
5. Run the fact guard → `fact_warnings`.
6. Mark earlier drafts `superseded`; insert the new draft; audit `ai.draft_generated` / `ai.draft_regenerated`; return 201.

## 8. Usage accounting and cost estimate

Every attempt (including failures and budget/circuit skips) writes one `ai_usage_events` row: task, provider, model, prompt version, outcome, tokens (incl. cache read/write), latency, estimated cost. Cost uses a per-model price table in `ai/pricing.ts` (USD per 1M tokens for input, output, cache read and cache write). Prices are verified against the provider's current pricing at AI-1 and always labelled "estimate".

## 9. Configuration

| Variable | Default | Meaning |
|---|---|---|
| `AI_PRIMARY_PROVIDER` | `mock` (dev) / required in prod | `anthropic` \| `openai-compatible` \| `mock` \| `none` |
| `AI_PRIMARY_MODEL` | (none) | e.g. `claude-haiku-5-5` (pending D-010) |
| `AI_FALLBACK_*` | empty | Optional fallback provider |
| `AI_DAILY_TOKEN_BUDGET` | 300000 | Hard daily cap |
| `AI_TRIAGE_TIMEOUT_MS` / `AI_DRAFT_TIMEOUT_MS` | 15000 / 30000 | Per-attempt timeouts |
| `AI_MAX_RETRIES` | 2 | SDK retries for transient errors |
| `AI_CIRCUIT_FAILURE_THRESHOLD` / `AI_CIRCUIT_COOLDOWN_MS` | 3 / 60000 | Breaker |

`mock` returns deterministic outputs keyed by keywords in the ticket and can be told to fail in specific ways (`[mock:timeout]`, `[mock:invalid]` markers, honoured only when `NODE_ENV !== 'production'`) for tests and demos of degradation.
