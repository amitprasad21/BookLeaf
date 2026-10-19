// Builds the AI router from validated configuration (D-028, D-030). Model
// defaults per provider: Gemini 3.5 Flash-Lite for both tasks. Measured on the
// free tier, 3.8 Flash timed out on draft-sized prompts (30 s three times, then
// no answer in 90 s) while Flash-Lite drafted in about 2 s; set
// AI_PRIMARY_DRAFT_MODEL=gemini-3.8-flash on a key where it's fast enough.
// Groq's gpt-oss-120b serves both tasks as the fallback.
import type { Logger } from "pino";
import type { Env } from "../config/env.js";
import type { SystemWriter } from "../db/system-writer.js";
import { createDailyBudget } from "./budget.js";
import { createGeminiProvider } from "./providers/gemini.js";
import { createGroqProvider } from "./providers/groq.js";
import { createMockProvider, MOCK_MODEL, type MockResponder } from "./providers/mock.js";
import type { AiTask, LlmProvider, ProviderName } from "./providers/types.js";
import { createAiRouter, type AiRouter } from "./router.js";
import { createUsageRecorder } from "./usage.js";

export const DEFAULT_MODELS: Record<ProviderName, Record<AiTask, string>> = {
  gemini: { triage: "gemini-3.5-flash-lite", draft: "gemini-3.5-flash-lite" },
  groq: { triage: "openai/gpt-oss-120b", draft: "openai/gpt-oss-120b" },
  mock: { triage: MOCK_MODEL, draft: MOCK_MODEL },
};

export interface ProviderPlan {
  provider: ProviderName;
  models: Record<AiTask, string>;
}

/** Which providers and models the configuration selects (safe to print: no keys). */
export function aiPlan(env: Env): { primary: ProviderPlan | null; fallback: ProviderPlan | null } {
  const plan = (
    provider: ProviderName | undefined,
    model?: string,
    draftModel?: string,
  ): ProviderPlan | null => {
    if (!provider) return null;
    const defaults = DEFAULT_MODELS[provider];
    const triage = model ?? defaults.triage;
    return { provider, models: { triage, draft: draftModel ?? (model ? triage : defaults.draft) } };
  };
  const primary = env.AI_PRIMARY_PROVIDER === "none" ? undefined : env.AI_PRIMARY_PROVIDER;
  return {
    primary: plan(primary, env.AI_PRIMARY_MODEL, env.AI_PRIMARY_DRAFT_MODEL),
    fallback: primary
      ? plan(env.AI_FALLBACK_PROVIDER, env.AI_FALLBACK_MODEL, env.AI_FALLBACK_DRAFT_MODEL)
      : null,
  };
}

export interface ProviderDeps {
  fetchFn?: typeof fetch;
  mockResponders?: Record<string, MockResponder>;
}

export function createProvider(plan: ProviderPlan, env: Env, deps: ProviderDeps = {}): LlmProvider {
  const common = { models: plan.models, maxRetries: env.AI_MAX_RETRIES, fetchFn: deps.fetchFn };
  switch (plan.provider) {
    case "gemini":
      return createGeminiProvider({ ...common, apiKey: env.GEMINI_API_KEY! });
    case "groq":
      return createGroqProvider({ ...common, apiKey: env.GROQ_API_KEY! });
    case "mock":
      return createMockProvider({
        responders: deps.mockResponders,
        failureMarkers: env.NODE_ENV !== "production",
      });
  }
}

export function createAiFromEnv(
  env: Env,
  writer: SystemWriter,
  logger: Logger,
  deps: ProviderDeps = {},
): AiRouter {
  const plan = aiPlan(env);
  return createAiRouter({
    primary: plan.primary && createProvider(plan.primary, env, deps),
    fallback: plan.fallback && createProvider(plan.fallback, env, deps),
    budget: createDailyBudget({
      dailyTokens: env.AI_DAILY_TOKEN_BUDGET,
      usedSince: (since) => writer.tokensUsedSince(since),
    }),
    recordUsage: createUsageRecorder(writer, logger),
    breaker: { failureThreshold: env.AI_CIRCUIT_FAILURE_THRESHOLD, cooldownMs: env.AI_CIRCUIT_COOLDOWN_MS },
    logger,
  });
}
