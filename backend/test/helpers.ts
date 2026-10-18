import { Writable } from "node:stream";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "pino";
import { createApp } from "../src/app.js";
import type { AuthContext, AuthVerifier } from "../src/auth/types.js";
import { loadEnv } from "../src/config/env.js";
import { ForbiddenError } from "../src/lib/errors.js";
import { createLogger } from "../src/lib/logger.js";

/** JWT-shaped tokens (three dot-separated segments) understood by fakeVerifier(). */
export const TEST_TOKENS = {
  author: "test.author.token",
  admin: "test.admin.token",
  noProfile: "test.noprofile.token",
  verifierDown: "test.verifierdown.token",
} as const;

export const AUTHOR_CONTEXT: AuthContext = {
  userId: "00000000-0000-4000-8000-000000000001",
  role: "author",
  displayName: "Priya Sharma",
  author: { authorId: "AUTH001", name: "Priya Sharma", city: "Mumbai", joinedDate: "2023-03-15" },
};

export const ADMIN_CONTEXT: AuthContext = {
  userId: "00000000-0000-4000-8000-0000000000aa",
  role: "admin",
  displayName: "Ops Admin",
  author: null,
};

/** Offline stand-in for the Supabase verifier. Unknown tokens are rejected (null -> 401). */
export function fakeVerifier(): AuthVerifier {
  const db = {} as SupabaseClient; // no route under test touches the database yet
  return {
    async verify(token) {
      switch (token) {
        case TEST_TOKENS.author:
          return { auth: AUTHOR_CONTEXT, db };
        case TEST_TOKENS.admin:
          return { auth: ADMIN_CONTEXT, db };
        case TEST_TOKENS.noProfile:
          throw new ForbiddenError("This account doesn't have access to BookLeaf.");
        case TEST_TOKENS.verifierDown:
          throw new Error("token verification unavailable (internal detail: db password=hunter2)");
        default:
          return null;
      }
    },
  };
}

export const bearer = (token: string) => `Bearer ${token}`;

/** App with test env defaults (silent logs, dev CORS origins, fake verifier) plus overrides. */
export function buildTestApp(envOverrides: NodeJS.ProcessEnv = {}, logger?: Logger, verifier?: AuthVerifier) {
  const env = loadEnv({ NODE_ENV: "test", ...envOverrides });
  return createApp({ env, logger: logger ?? createLogger(env), verifier: verifier ?? fakeVerifier() });
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
