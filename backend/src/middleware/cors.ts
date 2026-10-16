import cors from "cors";

/**
 * Exact-match origin allowlist (no wildcards). Requests without an Origin
 * header (curl, server-to-server) get no CORS headers; browsers on other
 * origins are refused by the browser.
 */
export function corsAllowlist(allowedOrigins: readonly string[]) {
  const allowed = new Set(allowedOrigins);
  return cors({
    origin: (origin, callback) => callback(null, origin !== undefined && allowed.has(origin)),
    methods: ["GET", "POST", "PATCH"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id", "Retry-After"],
    maxAge: 600,
  });
}
