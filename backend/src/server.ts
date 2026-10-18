import { createApp } from "./app.js";
import { createSupabaseVerifier } from "./auth/supabase-verifier.js";
import { loadEnv, type Env } from "./config/env.js";
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
// loadEnv guarantees both values outside NODE_ENV=test.
const verifier = createSupabaseVerifier({
  url: env.SUPABASE_URL!,
  publishableKey: env.SUPABASE_PUBLISHABLE_KEY!,
});

const server = createApp({ env, logger, verifier }).listen(env.PORT, () => {
  logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, "BookLeaf API listening");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    logger.info({ signal }, "Shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
