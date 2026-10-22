import type { Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { RateLimitedError } from "../lib/errors.js";

/**
 * Per-user limiter for authenticated routes (in-memory, single instance: A-15).
 * Route quotas ignore failed requests by default; the global abuse ceiling
 * counts them too, so repeated invalid requests cannot bypass it.
 * The database trigger is the backstop for anything that bypasses the API.
 */
export function perUserLimit(options: {
  windowMs: number;
  limit: number;
  message: string;
  /** Requests for which the limit doesn't apply (they aren't counted either). */
  skip?: (req: Request) => boolean;
  skipFailedRequests?: boolean;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: false,
    legacyHeaders: false,
    skipFailedRequests: options.skipFailedRequests ?? true,
    ...(options.skip ? { skip: options.skip } : {}),
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

/**
 * Per-IP limiter for the public health check (API_IMPLEMENTATION.md section 5)
 * and for requests without a valid session. Behind a proxy the IP comes from
 * X-Forwarded-For only when TRUST_PROXY_HOPS is set; otherwise every caller
 * would share the proxy's address.
 */
export function perIpLimit(options: {
  windowMs: number;
  limit: number;
  message: string;
  /** Count only the responses this returns true for (default: all). */
  counts?: (res: Response) => boolean;
}) {
  const { counts } = options;
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: false,
    legacyHeaders: false,
    ...(counts ? { skipSuccessfulRequests: true, requestWasSuccessful: (_req, res) => !counts(res) } : {}),
    handler: (_req, _res, next) =>
      next(new RateLimitedError(Math.ceil(options.windowMs / 1000), options.message)),
  });
}
