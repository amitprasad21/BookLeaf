// AI provider check (AI-1). `npm run check:ai` prints the configured providers
// and models and whether each key is set (never values). `npm run check:ai:live`
// also makes ONE tiny structured call per configured model with synthetic
// content (no ticket data), retries off, and prints only the outcome kind,
// latency and token counts. Nothing is written to the database.
import { z } from "zod";
import { aiPlan, createProvider, DEFAULT_MODELS, type ProviderPlan } from "../src/ai/config.js";
import { ProviderError, type AiTask } from "../src/ai/providers/types.js";
import { AI_PROVIDER_KEYS, loadEnv, type Env } from "../src/config/env.js";
import { classifyValue } from "./credential-checks.js";

const live = process.argv.includes("--live");
const problems: string[] = [];
const line = (label: string, status: string) => console.log(`  ${label.padEnd(44, ".")} ${status}`);

console.log("\nAI configuration (names and models only)");
let env: Env | null = null;
try {
  env = loadEnv();
} catch (error) {
  // The message lists variable names only (config/env.ts never echoes values).
  line("environment", error instanceof Error ? error.message : "invalid");
  problems.push("fix the AI settings named above in backend/.env");
}

for (const name of [...Object.values(AI_PROVIDER_KEYS), "GROQ_FALLBACK_API_KEY"]) {
  const state = classifyValue(process.env[name]);
  if (name === "GROQ_FALLBACK_API_KEY") {
    if (state === "configured") {
      line(name, "present but NOT used");
      console.log(
        "    A second key for the same provider would be key cycling (C-14). Remove it from backend/.env.",
      );
    }
    continue;
  }
  line(name, state);
}

let plans: ProviderPlan[] = [];
if (env) {
  const plan = aiPlan(env);
  line("AI_PRIMARY_PROVIDER", env.AI_PRIMARY_PROVIDER);
  if (plan.primary)
    line("  models (triage / draft)", `${plan.primary.models.triage} / ${plan.primary.models.draft}`);
  line("AI_FALLBACK_PROVIDER", plan.fallback?.provider ?? "(none)");
  if (plan.fallback)
    line("  models (triage / draft)", `${plan.fallback.models.triage} / ${plan.fallback.models.draft}`);
  if (env.AI_PRIMARY_PROVIDER === "mock") {
    console.log(
      "    Still on the local mock. For real AI set AI_PRIMARY_PROVIDER=gemini and AI_FALLBACK_PROVIDER=groq.",
    );
  }
  plans = [plan.primary, plan.fallback].filter((p): p is ProviderPlan => p !== null && p.provider !== "mock");
  // Also try any provider whose key is present but isn't configured yet, with its default models.
  for (const provider of ["gemini", "groq"] as const) {
    if (
      !plans.some((p) => p.provider === provider) &&
      classifyValue(env[AI_PROVIDER_KEYS[provider]]) === "configured"
    ) {
      plans.push({ provider, models: DEFAULT_MODELS[provider] });
    }
  }
}

if (live && env) {
  console.log("\nLive check (one synthetic call per model; free tier, no ticket data)");
  const Probe = z.strictObject({ ok: z.boolean(), word: z.string() });
  for (const plan of plans) {
    const tasks = (Object.keys(plan.models) as AiTask[]).filter(
      (task, index, all) => all.findIndex((other) => plan.models[other] === plan.models[task]) === index,
    );
    const provider = createProvider(plan, { ...env, AI_MAX_RETRIES: 0 });
    for (const task of tasks) {
      const label = `${plan.provider} ${plan.models[task]}`;
      try {
        const result = await provider.generateStructured({
          task,
          system: "You are a connectivity check for a support tool. Answer with JSON only.",
          user: 'Set ok to true and word to "bookleaf".',
          schema: Probe,
          schemaName: "connectivity_check",
          maxOutputTokens: 1024,
          timeoutMs: 30_000,
        });
        const answer =
          result.value.ok && result.value.word.toLowerCase() === "bookleaf" ? "OK" : "UNEXPECTED ANSWER";
        line(
          label,
          `${answer} (${result.latencyMs} ms, ${result.usage.inputTokens} in / ${result.usage.outputTokens} out)`,
        );
        if (answer !== "OK") problems.push(`${label} answered unexpectedly`);
      } catch (error) {
        const kind = error instanceof ProviderError ? error.kind : "unexpected error";
        line(label, `FAILED (${kind})`);
        problems.push(`${label} failed: ${kind}`);
      }
    }
  }
  if (plans.length === 0) line("providers", "none with a key configured");
} else if (!live) {
  console.log("\n(Config only. Run npm run check:ai:live for one real call per model.)");
}

console.log(`\nResult: ${problems.length === 0 ? "OK" : `${problems.length} problem(s)`}`);
for (const problem of problems) console.log(`  - ${problem}`);
process.exitCode = problems.length === 0 ? 0 : 1;
