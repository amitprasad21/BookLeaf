import { Writable } from "node:stream";
import type { Logger } from "pino";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { createLogger } from "../src/lib/logger.js";

/** App with test env defaults (silent logs, dev CORS origins) plus overrides. */
export function buildTestApp(envOverrides: NodeJS.ProcessEnv = {}, logger?: Logger) {
  const env = loadEnv({ NODE_ENV: "test", ...envOverrides });
  return createApp({ env, logger: logger ?? createLogger(env) });
}

/** A logger whose JSON lines are captured in memory for assertions. */
export function captureLogger() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  const logger = createLogger({ LOG_LEVEL: "info" }, stream);
  const lines = () =>
    chunks
      .join("")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  return { logger, lines };
}

/** pino-http writes its line on response finish; let that settle before reading logs. */
export const settle = () => new Promise((resolve) => setImmediate(resolve));
