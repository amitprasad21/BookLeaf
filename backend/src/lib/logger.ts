import { pino, type DestinationStream, type Logger } from "pino";
import type { Env } from "../config/env.js";

// Never log credentials. Request/response bodies are not logged at all.
export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "*.password",
  "*.token",
  "*.apiKey",
  "*.api_key",
  "*.secret",
];

export function createLogger(env: Pick<Env, "LOG_LEVEL">, destination?: DestinationStream): Logger {
  return pino(
    {
      level: env.LOG_LEVEL,
      base: { service: "bookleaf-api" },
      redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    },
    destination,
  );
}
