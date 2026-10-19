import { Writable } from "node:stream";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "pino";
import { createApp, type AppDeps } from "../src/app.js";
import type { AuthContext, AuthVerifier } from "../src/auth/types.js";
import { loadEnv } from "../src/config/env.js";
import type { SystemWriter } from "../src/db/system-writer.js";
import type { Clock } from "../src/lib/clock.js";
import { ForbiddenError } from "../src/lib/errors.js";
import { createLogger } from "../src/lib/logger.js";
import { recordingSystemWriter } from "./fakes.js";

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

type Row = Record<string, unknown>;
type QueryResult = { data: Row[] | null; error: { code: string; message: string } | null };

/**
 * Minimal in-memory stand-in for the Supabase query builder: from().select()
 * .eq().order(), awaited like the real thing. It does NOT emulate RLS, so tests
 * built on it prove the backend's own filters. `failWith` simulates a query error.
 */
export function fakeDb(
  tables: Record<string, Row[]>,
  failWith?: { code: string; message: string },
): SupabaseClient {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const builder = {
        select: () => builder,
        eq(column: string, value: unknown) {
          rows = rows.filter((row) => row[column] === value);
          return builder;
        },
        order(column: string, options?: { ascending?: boolean }) {
          const direction = options?.ascending === false ? -1 : 1;
          rows.sort((a, b) => (String(a[column]) < String(b[column]) ? -direction : direction));
          return builder;
        },
        then<T>(resolve: (result: QueryResult) => T, reject?: (reason: unknown) => T) {
          const result: QueryResult = failWith
            ? { data: null, error: failWith }
            : { data: rows, error: null };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

/** Offline stand-in for the Supabase verifier. Unknown tokens are rejected (null -> 401). */
export function fakeVerifier(db: SupabaseClient = fakeDb({})): AuthVerifier {
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

export interface TestAppOptions {
  env?: NodeJS.ProcessEnv;
  logger?: Logger;
  verifier?: AuthVerifier;
  clock?: Clock;
  systemWriter?: SystemWriter;
  ticketsRepository?: AppDeps["ticketsRepository"];
  adminTicketsRepository?: AppDeps["adminTicketsRepository"];
  triage?: AppDeps["triage"];
}

/** App with test defaults (silent logs, dev CORS origins, fake verifier, recording audit writer). */
export function buildTestApp(options: TestAppOptions = {}) {
  const env = loadEnv({ NODE_ENV: "test", ...options.env });
  return createApp({
    env,
    logger: options.logger ?? createLogger(env),
    verifier: options.verifier ?? fakeVerifier(),
    systemWriter: options.systemWriter ?? recordingSystemWriter().writer,
    ...(options.clock ? { clock: options.clock } : {}),
    ...(options.ticketsRepository ? { ticketsRepository: options.ticketsRepository } : {}),
    ...(options.adminTicketsRepository ? { adminTicketsRepository: options.adminTicketsRepository } : {}),
    ...(options.triage ? { triage: options.triage } : {}),
  });
}

/** A clock pinned to a business date (midday India time). */
export const fixedClock =
  (isoDate: string): Clock =>
  () =>
    new Date(`${isoDate}T06:30:00Z`);

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
