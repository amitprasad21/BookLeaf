// Router, circuit breaker, budget, config and pricing (.back/AI_FAILURE_HANDLING.md
// AF-01..AF-08) with scripted providers: no network, no database.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createDailyBudget } from "../src/ai/budget.js";
import { CircuitBreaker } from "../src/ai/circuit-breaker.js";
import { aiPlan, createAiFromEnv, DEFAULT_MODELS } from "../src/ai/config.js";
import { estimateCostUsd } from "../src/ai/pricing.js";
import {
  ProviderError,
  type LlmProvider,
  type ProviderErrorKind,
  type ProviderName,
  type StructuredRequest,
} from "../src/ai/providers/types.js";
import { AiRouteError, createAiRouter, type AiRouterOptions } from "../src/ai/router.js";
import { createUsageRecorder } from "../src/ai/usage.js";
import { loadEnv } from "../src/config/env.js";
import type { UsageEventInput } from "../src/db/system-writer.js";
import { recordingSystemWriter } from "./fakes.js";
import { captureLogger } from "./helpers.js";

const Result = z.strictObject({ ok: z.boolean() });
const request: StructuredRequest<{ ok: boolean }> = {
  task: "triage",
  system: "s",
  user: "u",
  schema: Result,
  schemaName: "probe",
  maxOutputTokens: 100,
  timeoutMs: 1_000,
};
const CONTEXT = { ticketId: "6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c0001", promptVersion: "triage-v1" };
const USAGE = { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 };

type Step = "ok" | ProviderErrorKind | Error;

/** A provider that plays a script of outcomes, one per call (the last one repeats). */
function scripted(name: ProviderName, model: string, ...steps: Step[]) {
  let calls = 0;
  const provider: LlmProvider = {
    name,
    modelFor: () => model,
    async generateStructured<T>() {
      const step = steps[Math.min(calls, steps.length - 1)]!;
      calls += 1;
      if (step === "ok") return { value: { ok: true } as T, usage: USAGE, latencyMs: 42 };
      if (step instanceof Error) throw step;
      const usage = step === "invalid_output" ? USAGE : undefined;
      throw new ProviderError(name, step, `${name} ${step}`, usage);
    },
  };
  return { provider, calls: () => calls };
}

function setup(options: Partial<AiRouterOptions> & { tokensUsedToday?: number; dailyTokens?: number } = {}) {
  let now = Date.parse("2026-10-18T06:30:00Z");
  const usage: UsageEventInput[] = [];
  const { logger, lines } = captureLogger();
  const budget = createDailyBudget({
    dailyTokens: options.dailyTokens ?? 1_000,
    usedSince: async () => options.tokensUsedToday ?? 0,
    now: () => new Date(now),
  });
  const router = createAiRouter({
    primary: null,
    budget,
    recordUsage: async (event) => {
      usage.push(event);
    },
    breaker: { failureThreshold: 3, cooldownMs: 60_000 },
    logger,
    now: () => now,
    ...options,
  });
  return { router, usage, budget, lines, advance: (ms: number) => (now += ms) };
}

async function routeError(promise: Promise<unknown>): Promise<AiRouteError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AiRouteError);
  return error as AiRouteError;
}

const outcomes = (usage: UsageEventInput[]) => usage.map((event) => `${event.provider}:${event.outcome}`);

describe("AI router", () => {
  it("returns the result with provider and model, and records a priced usage event", async () => {
    const gemini = scripted("gemini", "gemini-3.5-flash-lite", "ok");
    const { router, usage, budget } = setup({ primary: gemini.provider });
    const result = await router.route(request, CONTEXT);

    expect(result).toMatchObject({ value: { ok: true }, provider: "gemini", model: "gemini-3.5-flash-lite" });
    expect(usage).toEqual([
      {
        ticketId: CONTEXT.ticketId,
        task: "triage",
        provider: "gemini",
        model: "gemini-3.5-flash-lite",
        promptVersion: "triage-v1",
        outcome: "success",
        ...USAGE,
        latencyMs: 42,
        estimatedCostUsd: estimateCostUsd("gemini-3.5-flash-lite", USAGE),
      },
    ]);
    expect((await budget.status()).usedTokens).toBe(120);
  });

  it("AF-07: provider none → not_configured, recorded, never retryable", async () => {
    const { router, usage } = setup({ primary: null });
    const error = await routeError(router.route(request, CONTEXT));
    expect([error.reason, error.retryable, error.status]).toEqual(["not_configured", false, 503]);
    expect(outcomes(usage)).toEqual(["none:not_configured"]);
  });

  it("AF-06: at the daily budget no provider is called; budget_blocked is recorded", async () => {
    const gemini = scripted("gemini", "m", "ok");
    const { router, usage } = setup({ primary: gemini.provider, tokensUsedToday: 1_000 });
    const error = await routeError(router.route(request, CONTEXT));
    expect([error.reason, error.retryable]).toEqual(["budget_exhausted", false]);
    expect(gemini.calls()).toBe(0);
    expect(outcomes(usage)).toEqual(["gemini:budget_blocked"]);
  });

  it("AF-01: a rate limit with no fallback → provider_unavailable (retryable), breaker counts it", async () => {
    const gemini = scripted("gemini", "m", "rate_limited");
    const { router, usage } = setup({ primary: gemini.provider });
    const error = await routeError(router.route(request, CONTEXT));
    expect([error.reason, error.retryable]).toEqual(["provider_unavailable", true]);
    expect(outcomes(usage)).toEqual(["gemini:rate_limited"]);
    expect(router.circuits().gemini).toMatchObject({ state: "closed", consecutiveFailures: 1 });
  });

  it("AF-02: three consecutive timeouts open the circuit; calls are skipped until a probe after the cooldown", async () => {
    const gemini = scripted("gemini", "m", "timeout", "timeout", "timeout", "ok");
    const { router, usage, advance } = setup({ primary: gemini.provider });
    for (let i = 0; i < 3; i += 1) await routeError(router.route(request, CONTEXT));
    expect(router.circuits().gemini?.state).toBe("open");

    const skipped = await routeError(router.route(request, CONTEXT));
    expect([skipped.reason, skipped.retryable]).toEqual(["circuit_open", true]);
    expect(gemini.calls()).toBe(3);
    expect(outcomes(usage).at(-1)).toBe("gemini:circuit_open");

    advance(60_000);
    expect(router.circuits().gemini?.state).toBe("half_open");
    await router.route(request, CONTEXT);
    expect(router.circuits().gemini).toMatchObject({ state: "closed", consecutiveFailures: 0 });
  });

  it("AF-03: an auth error is not retried, holds the circuit open, and never logs a key", async () => {
    const gemini = scripted("gemini", "m", "auth");
    const { router, lines, advance } = setup({ primary: gemini.provider });
    const error = await routeError(router.route(request, CONTEXT));
    expect([error.reason, error.retryable]).toEqual(["provider_unavailable", false]);
    expect(gemini.calls()).toBe(1);

    advance(24 * 60 * 60_000); // no cooldown ends a configuration problem
    expect(router.circuits().gemini).toMatchObject({ state: "open", heldOpen: true });
    await routeError(router.route(request, CONTEXT));
    expect(gemini.calls()).toBe(1);
    expect(lines().some((line) => line.msg === "AI provider configuration error (key or model access)")).toBe(
      true,
    );
    expect(JSON.stringify(lines())).not.toMatch(/api[_-]?key|bearer/i);
  });

  it("AF-04: invalid output is not failed over, counts its tokens, and leaves the repair to the caller", async () => {
    const gemini = scripted("gemini", "m", "invalid_output");
    const groq = scripted("groq", "g", "ok");
    const { router, usage, budget } = setup({ primary: gemini.provider, fallback: groq.provider });
    const error = await routeError(router.route(request, CONTEXT));
    expect([error.reason, error.retryable]).toEqual(["invalid_output", false]);
    expect(groq.calls()).toBe(0);
    expect(usage[0]).toMatchObject({ outcome: "invalid_output", inputTokens: 100, outputTokens: 20 });
    expect((await budget.status()).usedTokens).toBe(120);
  });

  it("AF-05: a refusal is not failed over", async () => {
    const gemini = scripted("gemini", "m", "refused");
    const groq = scripted("groq", "g", "ok");
    const { router } = setup({ primary: gemini.provider, fallback: groq.provider });
    expect((await routeError(router.route(request, CONTEXT))).reason).toBe("refused");
    expect(groq.calls()).toBe(0);
  });

  it("a bad request (our bug) is not failed over either", async () => {
    const gemini = scripted("gemini", "m", "bad_request");
    const groq = scripted("groq", "g", "ok");
    const { router } = setup({ primary: gemini.provider, fallback: groq.provider });
    const error = await routeError(router.route(request, CONTEXT));
    expect([error.reason, error.retryable]).toEqual(["provider_unavailable", false]);
    expect(groq.calls()).toBe(0);
  });

  it("AF-08: the fallback serves when the primary is overloaded; both attempts are recorded", async () => {
    const gemini = scripted("gemini", "m", "overloaded");
    const groq = scripted("groq", "openai/gpt-oss-120b", "ok");
    const { router, usage } = setup({ primary: gemini.provider, fallback: groq.provider });
    const result = await router.route(request, CONTEXT);
    expect(result.provider).toBe("groq");
    expect(outcomes(usage)).toEqual(["gemini:provider_error", "groq:success"]);
  });

  it("a quota error parks the primary for an hour and the fallback carries on", async () => {
    const gemini = scripted("gemini", "m", "quota", "ok");
    const groq = scripted("groq", "g", "ok");
    const { router, usage, advance } = setup({ primary: gemini.provider, fallback: groq.provider });
    expect((await router.route(request, CONTEXT)).provider).toBe("groq");
    expect((await router.route(request, CONTEXT)).provider).toBe("groq");
    expect(outcomes(usage)).toEqual([
      "gemini:rate_limited",
      "groq:success",
      "gemini:circuit_open",
      "groq:success",
    ]);

    advance(60 * 60_000);
    expect((await router.route(request, CONTEXT)).provider).toBe("gemini");
  });

  it("an unexpected error (our bug) is logged and reported as retryable unavailability", async () => {
    const gemini = scripted("gemini", "m", new TypeError("cannot read properties of undefined"));
    const { router, usage, lines } = setup({ primary: gemini.provider });
    const error = await routeError(router.route(request, CONTEXT));
    expect([error.reason, error.retryable]).toEqual(["provider_unavailable", true]);
    expect(outcomes(usage)).toEqual(["gemini:provider_error"]);
    expect(lines().some((line) => line.msg === "AI call failed unexpectedly")).toBe(true);
  });

  it("when every provider fails transiently, the error is retryable", async () => {
    const gemini = scripted("gemini", "m", "timeout");
    const groq = scripted("groq", "g", "connection");
    const { router, usage } = setup({ primary: gemini.provider, fallback: groq.provider });
    const error = await routeError(router.route(request, CONTEXT));
    expect([error.reason, error.retryable]).toEqual(["provider_unavailable", true]);
    expect(outcomes(usage)).toEqual(["gemini:timeout", "groq:provider_error"]);
  });

  it("a failing usage write never breaks the AI call", async () => {
    const writer = recordingSystemWriter({ fail: true });
    const { logger, lines } = captureLogger();
    const gemini = scripted("gemini", "m", "ok");
    const { router } = setup({
      primary: gemini.provider,
      recordUsage: createUsageRecorder(writer.writer, logger),
    });
    expect((await router.route(request, CONTEXT)).value).toEqual({ ok: true });
    expect(lines().some((line) => line.msg === "AI usage event not recorded")).toBe(true);
  });
});

describe("circuit breaker", () => {
  it("lets one probe through when half-open, and doubles the cooldown after a failed probe (capped)", () => {
    let now = 0;
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      cooldownMs: 1_000,
      maxCooldownMs: 3_000,
      now: () => now,
    });
    breaker.recordFailure();
    expect(breaker.tryAcquire()).toBe(true);
    breaker.recordFailure();
    expect(breaker.tryAcquire()).toBe(false);

    now = 1_000;
    expect(breaker.tryAcquire()).toBe(true); // the probe
    expect(breaker.tryAcquire()).toBe(false); // only one
    breaker.recordFailure();
    expect(breaker.snapshot()).toMatchObject({ state: "open", retryAt: 3_000 }); // 2 s cooldown

    now = 3_000;
    expect(breaker.tryAcquire()).toBe(true);
    breaker.recordFailure();
    expect(breaker.snapshot().retryAt).toBe(6_000); // capped at 3 s

    now = 6_000;
    expect(breaker.tryAcquire()).toBe(true);
    breaker.recordSuccess();
    expect(breaker.snapshot()).toEqual({
      state: "closed",
      consecutiveFailures: 0,
      retryAt: null,
      heldOpen: false,
    });
  });
});

describe("daily budget", () => {
  it("counts from 00:00 India time, caches for 30 s, adds spending locally and resets the next day", async () => {
    let now = new Date("2026-10-18T06:30:00Z");
    const asked: string[] = [];
    let stored = 400;
    const budget = createDailyBudget({
      dailyTokens: 1_000,
      usedSince: async (since) => {
        asked.push(since);
        return stored;
      },
      now: () => now,
    });

    expect(await budget.status()).toEqual({ date: "2026-10-18", budgetTokens: 1_000, usedTokens: 400 });
    expect(asked).toEqual(["2026-10-17T18:30:00.000Z"]);
    budget.add(600);
    expect(await budget.exhausted()).toBe(true);
    expect(asked).toHaveLength(1); // cached

    stored = 100; // e.g. the database is the truth after the cache expires
    now = new Date("2026-10-18T06:31:00Z");
    expect(await budget.exhausted()).toBe(false);

    now = new Date("2026-10-18T18:31:00Z"); // 00:01 on the 19th in India
    stored = 0;
    expect((await budget.status()).date).toBe("2026-10-19");
    expect(asked.at(-1)).toBe("2026-10-18T18:30:00.000Z");
  });
});

describe("AI configuration", () => {
  const base = { NODE_ENV: "test" };

  it("defaults: Gemini triage on Flash-Lite, drafts on 3.8 Flash; Groq gpt-oss-120b as fallback", () => {
    const plan = aiPlan(
      loadEnv({
        ...base,
        AI_PRIMARY_PROVIDER: "gemini",
        AI_FALLBACK_PROVIDER: "groq",
        GEMINI_API_KEY: "k",
        GROQ_API_KEY: "k",
      }),
    );
    expect(plan).toEqual({
      primary: { provider: "gemini", models: { triage: "gemini-3.5-flash-lite", draft: "gemini-3.8-flash" } },
      fallback: { provider: "groq", models: { triage: "openai/gpt-oss-120b", draft: "openai/gpt-oss-120b" } },
    });
    expect(DEFAULT_MODELS.mock).toEqual({ triage: "mock-1", draft: "mock-1" });
  });

  it("AI_PRIMARY_MODEL sets both tasks unless a draft model is given", () => {
    const env = { ...base, AI_PRIMARY_PROVIDER: "gemini", GEMINI_API_KEY: "k" };
    expect(aiPlan(loadEnv({ ...env, AI_PRIMARY_MODEL: "gemini-3.6-flash" })).primary?.models).toEqual({
      triage: "gemini-3.6-flash",
      draft: "gemini-3.6-flash",
    });
    expect(
      aiPlan(
        loadEnv({ ...env, AI_PRIMARY_MODEL: "gemini-3.6-flash", AI_PRIMARY_DRAFT_MODEL: "gemini-3.8-flash" }),
      ).primary?.models,
    ).toEqual({ triage: "gemini-3.6-flash", draft: "gemini-3.8-flash" });
  });

  it("none turns AI off entirely (a fallback is ignored)", () => {
    expect(aiPlan(loadEnv({ ...base, AI_PRIMARY_PROVIDER: "none", AI_FALLBACK_PROVIDER: "groq" }))).toEqual({
      primary: null,
      fallback: null,
    });
  });

  it("builds a working router from the environment (mock in tests)", async () => {
    const writer = recordingSystemWriter();
    const { logger } = captureLogger();
    const router = createAiFromEnv(loadEnv(base), writer.writer, logger, {
      mockResponders: { probe: () => ({ ok: true }) },
    });
    expect((await router.route(request, CONTEXT)).provider).toBe("mock");
    expect(writer.usage).toMatchObject([{ provider: "mock", model: "mock-1", outcome: "success" }]);
  });
});

describe("pricing", () => {
  it("estimates list-price cost per call, with cached input at its own rate; unknown models cost 0", () => {
    expect(
      estimateCostUsd("openai/gpt-oss-120b", { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0 }),
    ).toBe(0.15);
    expect(
      estimateCostUsd("openai/gpt-oss-120b", {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cacheReadTokens: 500_000,
      }),
    ).toBe(0.7125);
    expect(
      estimateCostUsd("gemini-3.8-flash", { inputTokens: 2_000, outputTokens: 500, cacheReadTokens: 0 }),
    ).toBe(0.003375);
    expect(estimateCostUsd("mock-1", { inputTokens: 5_000, outputTokens: 5_000, cacheReadTokens: 0 })).toBe(
      0,
    );
  });
});
