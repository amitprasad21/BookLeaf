// Provider selection and failover (.back/AI_PROVIDER_ORCHESTRATION.md section 3,
// .back/AI_FAILURE_HANDLING.md). The adapters' bounded retry is the only retry
// layer: the router never loops on a provider, it fails over to the configured
// fallback (a different provider: C-14) and records every attempt or skip.
import type { AiUnavailableReason } from "@bookleaf/shared";
import type { Logger } from "pino";
import type { UsageOutcome } from "../db/system-writer.js";
import { AiUnavailableError } from "../lib/errors.js";
import type { DailyBudget } from "./budget.js";
import { CircuitBreaker, type CircuitBreakerOptions, type CircuitSnapshot } from "./circuit-breaker.js";
import { estimateCostUsd } from "./pricing.js";
import {
  NO_USAGE,
  ProviderError,
  type LlmProvider,
  type ProviderErrorKind,
  type ProviderName,
  type StructuredRequest,
  type StructuredResult,
  type TokenUsage,
} from "./providers/types.js";
import type { UsageRecorder } from "./usage.js";

export interface RouteContext {
  ticketId: string | null;
  promptVersion: string | null;
}

export interface RoutedResult<T> extends StructuredResult<T> {
  provider: ProviderName;
  model: string;
}

/**
 * AI is unavailable for this request. `retryable` is true when a later attempt
 * may succeed (outage, rate limit, open circuit); false for configuration,
 * budget, refusal or unusable output (the ticket goes to manual review).
 */
export class AiRouteError extends AiUnavailableError {
  readonly reason: AiUnavailableReason;
  readonly retryable: boolean;

  constructor(reason: AiUnavailableReason, retryable: boolean) {
    super(reason);
    this.reason = reason;
    this.retryable = retryable;
  }
}

export type AiAvailability =
  { ok: true } | { ok: false; reason: "not_configured" | "budget_exhausted" | "circuit_open" };

export interface AiRouter {
  route<T>(request: StructuredRequest<T>, context: RouteContext): Promise<RoutedResult<T>>;
  /** Whether a call could go out now (no call is made): for the sweeper and manual retries. */
  availability(): Promise<AiAvailability>;
  /** The primary provider's model for a task, or null when AI is off. */
  modelFor(task: "triage" | "draft"): string | null;
  circuits(): Partial<Record<ProviderName, CircuitSnapshot>>;
}

export interface AiRouterOptions {
  /** null = AI turned off (AI_PRIMARY_PROVIDER=none). */
  primary: LlmProvider | null;
  fallback?: LlmProvider | null;
  budget: DailyBudget;
  recordUsage: UsageRecorder;
  breaker: Omit<CircuitBreakerOptions, "now">;
  logger: Logger;
  now?: () => number;
  /** How long a provider stays skipped after a quota error (default 1 h). */
  quotaCooldownMs?: number;
}

const OUTCOMES: Record<ProviderErrorKind, UsageOutcome> = {
  auth: "auth_error",
  quota: "rate_limited",
  rate_limited: "rate_limited",
  overloaded: "provider_error",
  timeout: "timeout",
  connection: "provider_error",
  bad_request: "provider_error",
  refused: "refused",
  invalid_output: "invalid_output",
};

export function createAiRouter(options: AiRouterOptions): AiRouter {
  const providers = [options.primary, options.fallback].filter((p): p is LlmProvider => Boolean(p));
  const breakers = new Map(
    providers.map((provider) => [
      provider.name,
      new CircuitBreaker({ ...options.breaker, now: options.now }),
    ]),
  );
  const quotaCooldownMs = options.quotaCooldownMs ?? 60 * 60_000;

  const record = (
    request: StructuredRequest<unknown>,
    context: RouteContext,
    provider: string,
    model: string,
    outcome: UsageOutcome,
    usage: TokenUsage = NO_USAGE,
    latencyMs: number | null = null,
  ) =>
    options.recordUsage({
      ticketId: context.ticketId,
      task: request.task,
      provider,
      model,
      promptVersion: context.promptVersion,
      outcome,
      ...usage,
      latencyMs,
      estimatedCostUsd: estimateCostUsd(model, usage),
    });

  return {
    async route<T>(request: StructuredRequest<T>, context: RouteContext): Promise<RoutedResult<T>> {
      const generic = request as StructuredRequest<unknown>;
      if (!options.primary) {
        await record(generic, context, "none", "none", "not_configured");
        throw new AiRouteError("not_configured", false);
      }
      if (await options.budget.exhausted()) {
        await record(
          generic,
          context,
          options.primary.name,
          options.primary.modelFor(request.task),
          "budget_blocked",
        );
        throw new AiRouteError("budget_exhausted", false);
      }

      let sawTransient = false;
      let attempted = false;
      for (const provider of providers) {
        const model = provider.modelFor(request.task);
        const breaker = breakers.get(provider.name)!;
        if (!breaker.tryAcquire()) {
          sawTransient = true; // a cooldown ends; the work can be retried later
          await record(generic, context, provider.name, model, "circuit_open");
          continue;
        }
        attempted = true;
        const started = Date.now();
        try {
          const result = await provider.generateStructured(request);
          breaker.recordSuccess();
          options.budget.add(result.usage.inputTokens + result.usage.outputTokens);
          await record(generic, context, provider.name, model, "success", result.usage, result.latencyMs);
          return { ...result, provider: provider.name, model };
        } catch (error) {
          if (!(error instanceof ProviderError)) {
            // Our bug, not the provider's: count it, keep the details in the log.
            breaker.recordFailure();
            options.logger.error(
              { err: error, provider: provider.name, task: request.task },
              "AI call failed unexpectedly",
            );
            await record(
              generic,
              context,
              provider.name,
              model,
              "provider_error",
              NO_USAGE,
              Date.now() - started,
            );
            throw new AiRouteError("provider_unavailable", true);
          }
          const usage = error.usage ?? NO_USAGE;
          options.budget.add(usage.inputTokens + usage.outputTokens);
          await record(
            generic,
            context,
            provider.name,
            model,
            OUTCOMES[error.kind],
            usage,
            Date.now() - started,
          );
          options.logger.warn(
            { provider: provider.name, model, task: request.task, kind: error.kind },
            "AI call failed",
          );

          switch (error.kind) {
            case "auth":
              // Configuration problem: never retried, provider skipped until restart (key never logged).
              breaker.holdOpen();
              options.logger.error(
                { provider: provider.name, model },
                "AI provider configuration error (key or model access)",
              );
              continue;
            case "quota":
              breaker.openFor(quotaCooldownMs);
              continue;
            case "bad_request":
              // The same request would fail anywhere: no failover.
              throw new AiRouteError("provider_unavailable", false);
            case "refused":
              throw new AiRouteError("refused", false);
            case "invalid_output":
              // The caller may make one repair attempt.
              throw new AiRouteError("invalid_output", false);
            default:
              // rate_limited, overloaded, timeout, connection: try the fallback, retry later.
              breaker.recordFailure();
              sawTransient = true;
              continue;
          }
        }
      }
      if (!attempted) throw new AiRouteError("circuit_open", true);
      throw new AiRouteError("provider_unavailable", sawTransient);
    },

    modelFor(task) {
      return options.primary?.modelFor(task) ?? null;
    },

    async availability() {
      if (!options.primary) return { ok: false, reason: "not_configured" };
      if (await options.budget.exhausted()) return { ok: false, reason: "budget_exhausted" };
      const open = [...breakers.values()].every((breaker) => breaker.state === "open");
      return open ? { ok: false, reason: "circuit_open" } : { ok: true };
    },

    circuits() {
      return Object.fromEntries([...breakers].map(([name, breaker]) => [name, breaker.snapshot()]));
    },
  };
}
