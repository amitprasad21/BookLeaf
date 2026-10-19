import { createAiFromEnv } from "./ai/config.js";
import { createTriageControl } from "./ai/control.js";
import { MOCK_RESPONDERS } from "./ai/prompts/index.js";
import { createJobQueue, createSweeper } from "./ai/queue.js";
import { createTriageService } from "./ai/triage.js";
import { createApp } from "./app.js";
import { createSupabaseVerifier } from "./auth/supabase-verifier.js";
import { loadEnv, type Env } from "./config/env.js";
import { createSystemWriter } from "./db/system-writer.js";
import { systemClock } from "./lib/clock.js";
import { createLogger } from "./lib/logger.js";

function loadEnvOrExit(): Env {
  try {
    return loadEnv();
  } catch (error) {
    // loadEnv names the offending variables, never their values.
    console.error(error instanceof Error ? error.message : error);
    return process.exit(1);
  }
}

const env = loadEnvOrExit();
const logger = createLogger(env);
// loadEnv guarantees the Supabase values outside NODE_ENV=test.
const verifier = createSupabaseVerifier({
  url: env.SUPABASE_URL!,
  publishableKey: env.SUPABASE_PUBLISHABLE_KEY!,
});
const systemWriter = createSystemWriter({ url: env.SUPABASE_URL!, secretKey: env.SUPABASE_SECRET_KEY! });

// AI triage: router (providers, breaker, budget, usage) → background queue
// (concurrency 2) → sweeper for anything pending or failed (D-007, D-028).
const aiRouter = createAiFromEnv(env, systemWriter, logger, { mockResponders: MOCK_RESPONDERS });
const triageService = createTriageService({
  router: aiRouter,
  writer: systemWriter,
  clock: systemClock,
  logger,
  timeoutMs: env.AI_TRIAGE_TIMEOUT_MS,
});
const triageQueue = createJobQueue({ concurrency: 2, run: (id) => triageService.run(id), logger });
const sweeper = createSweeper({
  writer: systemWriter,
  queue: triageQueue,
  router: aiRouter,
  clock: systemClock,
  logger,
});
const triage = createTriageControl({ queue: triageQueue, writer: systemWriter, router: aiRouter });

const server = createApp({ env, logger, verifier, systemWriter, triage }).listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, nodeEnv: env.NODE_ENV, ai: env.AI_PRIMARY_PROVIDER },
    "BookLeaf API listening",
  );
  sweeper.start();
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    logger.info({ signal }, "Shutting down");
    sweeper.stop();
    // Running AI jobs get up to 8 s; anything unfinished is picked up by the next sweep.
    void triageQueue.close(8_000).then(() => server.close(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
