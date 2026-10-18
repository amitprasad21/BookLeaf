import { rateLimit } from "express-rate-limit";
import { RateLimitedError } from "../lib/errors.js";

/**
 * Per-user limiter for authenticated routes (in-memory, single instance: A-15).
 * Requests that fail (4xx/5xx) don't count, so a typo doesn't use up a slot.
 * The database trigger is the backstop for anything that bypasses the API.
 */
export function perUserLimit(options: { windowMs: number; limit: number; message: string }) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: false,
    legacyHeaders: false,
    skipFailedRequests: true,
    keyGenerator: (req) => req.auth?.userId ?? "anonymous",
    handler: (req, _res, next) => {
      // express-rate-limit attaches its counters as req.rateLimit at runtime.
      const resetTime = (req as { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
      const retryAfter = resetTime
        ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
        : Math.ceil(options.windowMs / 1000);
      next(new RateLimitedError(retryAfter, options.message));
    },
  });
}
