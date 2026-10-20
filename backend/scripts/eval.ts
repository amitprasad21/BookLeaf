// AI evals (AI_SPEC.md section 13, AI-6).
//
//   npm run eval:triage        golden set on the MOCK provider (free; checks the runner)
//   npm run eval:drafts        draft review set on the mock provider
//   npm run eval:triage:live   the same on the configured providers (backend/.env)
//   npm run eval:drafts:live   -- real model calls: ask before running (they cost money)
//
// Options: --only=id,id  --pace=<ms between cases>
//          drafts --rescore=<report.json>: re-apply the current checks to saved replies (no calls)
// Nothing is written to the database: usage is recorded in memory and a JSON
// report (with every answer, for review) goes to backend/eval-results/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { businessDayStart } from "@bookleaf/shared";
import { createAiFromEnv } from "../src/ai/config.js";
import { createDraftService } from "../src/ai/drafts.js";
import {
  rescoreDraftReport,
  runDraftEval,
  type DraftCaseResult,
  type DraftReport,
} from "../src/ai/eval/draft-eval.js";
import { loadDraftCases, loadTriageGolden } from "../src/ai/eval/golden.js";
import { runTriageEval, TRIAGE_TARGETS } from "../src/ai/eval/triage-eval.js";
import { MOCK_RESPONDERS } from "../src/ai/prompts/index.js";
import { createTriageClassifier } from "../src/ai/triage.js";
import type { AuthorSummary } from "../src/auth/types.js";
import { loadEnv } from "../src/config/env.js";
import type { SystemWriter, UsageEventInput } from "../src/db/system-writer.js";
import { createLogger } from "../src/lib/logger.js";
import { SeedDataSchema, toBookRows } from "./seed-data.js";

const args = process.argv.slice(2);
const task = args[0];
const live = args.includes("--live");
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
const only = option("only")?.split(",").filter(Boolean) ?? [];
const paceMs = Number(option("pace") ?? (live ? 2_000 : 0));
const rescore = option("rescore");

if (task !== "triage" && task !== "drafts") {
  console.error(
    "Usage: tsx scripts/eval.ts triage|drafts [--live] [--only=id,id] [--pace=ms] [--rescore=report.json]",
  );
  process.exit(2);
}

// NODE_ENV=test: no Supabase settings are needed. The mock unless --live.
const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
  ...(live ? {} : { AI_PRIMARY_PROVIDER: "mock", AI_FALLBACK_PROVIDER: "" }),
});
if (live && (env.AI_PRIMARY_PROVIDER === "mock" || env.AI_PRIMARY_PROVIDER === "none")) {
  console.error("--live needs AI_PRIMARY_PROVIDER=gemini or groq in backend/.env.");
  process.exit(2);
}

// Usage stays in memory: evals must not count against the production budget.
const usage: UsageEventInput[] = [];
const writer = {
  tokensUsedSince: async () => 0,
  appendUsageEvent: async (event: UsageEventInput) => {
    usage.push(event);
  },
} as unknown as SystemWriter;
const router = createAiFromEnv(env, writer, createLogger({ LOG_LEVEL: "silent" }), {
  mockResponders: MOCK_RESPONDERS,
});

const seed = SeedDataSchema.parse(
  JSON.parse(readFileSync(new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url), "utf8")),
);
const books = toBookRows(seed);
const authors: AuthorSummary[] = seed.authors.map((author) => ({
  authorId: author.author_id,
  name: author.name,
  city: author.city,
  joinedDate: author.joined_date,
}));

const mode = rescore ? "rescore" : live ? "live" : "mock";
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const tick = (ok: boolean) => (ok ? "PASS" : "FAIL");

// Outcomes recorded without calling a model.
const SKIPS = new Set(["budget_blocked", "circuit_open", "not_configured"]);

function usageSummary() {
  const calls = usage.filter((event) => !SKIPS.has(event.outcome));
  const latencies = calls.map((event) => event.latencyMs ?? 0);
  return {
    calls: calls.length,
    outcomes: Object.fromEntries(
      [...new Set(usage.map((event) => event.outcome))].map((outcome) => [
        outcome,
        usage.filter((event) => event.outcome === outcome).length,
      ]),
    ),
    models: [...new Set(calls.map((event) => `${event.provider}/${event.model}`))],
    inputTokens: calls.reduce((sum, event) => sum + event.inputTokens, 0),
    outputTokens: calls.reduce((sum, event) => sum + event.outputTokens, 0),
    estimatedCostUsd: Number(calls.reduce((sum, event) => sum + event.estimatedCostUsd, 0).toFixed(6)),
    latencyMs: {
      mean: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
      max: latencies.length ? Math.max(...latencies) : 0,
    },
  };
}

function save(report: object): string {
  const directory = new URL("../eval-results/", import.meta.url);
  mkdirSync(directory, { recursive: true });
  const file = new URL(`${task}-${mode}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, directory);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file.pathname.replace(/^\/([A-Za-z]:)/, "$1");
}

console.log(
  rescore
    ? `\nAI eval: re-scoring ${rescore} with the current checks (no model calls)`
    : `\nAI eval: ${task} on the ${mode} provider${only.length ? ` (only ${only.join(", ")})` : ""}`,
);

if (task === "triage") {
  const golden = loadTriageGolden();
  const classify = createTriageClassifier({ router, timeoutMs: env.AI_TRIAGE_TIMEOUT_MS });
  const report = await runTriageEval({
    classify,
    golden,
    books,
    only,
    paceMs,
    onCase: (result) => {
      const got = result.actual
        ? `${result.actual.category} / ${result.actual.priority}${result.actual.policyFloor ? ` (floor ${result.actual.policyFloor})` : ""}`
        : `no answer (${result.error})`;
      console.log(
        `  ${tick(result.categoryOk && result.priorityOk && !result.leaked)} ${result.id.padEnd(36)} ` +
          `want ${result.expected.category} / ${result.expected.priorities.join("|")}  got ${got}`,
      );
    },
  });
  const { summary } = report;
  const totals = usageSummary();
  console.log(
    `\n  category accuracy   ${pct(summary.categoryAccuracy)} (target ${pct(TRIAGE_TARGETS.categoryAccuracy)})`,
  );
  console.log(
    `  priority agreement  ${pct(summary.priorityAgreement)} (target ${pct(TRIAGE_TARGETS.priorityAgreement)})`,
  );
  console.log(`  signal recall       ${pct(summary.signalRecall)}`);
  console.log(`  schema failures     ${summary.schemaFailures}; unavailable ${summary.unavailable}`);
  console.log(
    `  injection           ${summary.injection.passed}/${summary.injection.cases} handled normally`,
  );
  console.log(
    `  usage               ${totals.calls} calls, ${totals.inputTokens} in / ${totals.outputTokens} out tokens, ~$${totals.estimatedCostUsd} at list price, mean ${totals.latencyMs.mean} ms`,
  );
  console.log(
    `  targets             ${summary.targetsMet ? "met" : "NOT met"}${live ? "" : " (mock provider: this checks the runner, not model quality)"}`,
  );
  console.log(`  report              ${save({ mode, ...report, usage: totals })}\n`);
  if (live && !summary.targetsMet) process.exitCode = 1;
} else {
  const cases = loadDraftCases();
  const printCase = (result: DraftCaseResult) => {
    const passed = result.checks.filter((check) => check.ok).length;
    console.log(
      `  ${result.reply ? `${passed}/${result.checks.length}` : "  - "} ${result.id.padEnd(26)} ` +
        (result.reply
          ? result.checks
              .filter((check) => !check.ok)
              .map((check) => `missing: ${check.name}`)
              .join("; ") || "all checks passed"
          : `no draft (${result.error})`),
    );
  };

  let report: DraftReport;
  if (rescore) {
    // Re-score a saved report with the current checks: no model calls.
    const saved = JSON.parse(readFileSync(rescore, "utf8")) as DraftReport;
    report = rescoreDraftReport(saved, cases);
    report.results.forEach(printCase);
  } else {
    // Midday India time on the cases' date, so the payout facts match the labels.
    const at = new Date(businessDayStart(cases.today).getTime() + 6 * 3_600_000);
    const drafts = createDraftService({
      router,
      clock: () => at,
      audit: async () => {},
      timeoutMs: env.AI_DRAFT_TIMEOUT_MS,
    });
    report = await runDraftEval({ drafts, cases, authors, books, only, paceMs, onCase: printCase });
  }
  const { summary } = report;
  const totals = usageSummary();
  console.log(
    `\n  checks passed       ${summary.checksPassed}/${summary.checksTotal}; cases fully passing ${summary.casesPassed}/${summary.cases}`,
  );
  console.log(`  drafts with fact warnings ${summary.withFactWarnings}`);
  console.log(
    `  usage               ${totals.calls} calls, ${totals.inputTokens} in / ${totals.outputTokens} out tokens, ~$${totals.estimatedCostUsd} at list price, mean ${totals.latencyMs.mean} ms`,
  );
  console.log(`  report              ${save({ mode, ...report, usage: totals })} (read every reply there)\n`);
}
