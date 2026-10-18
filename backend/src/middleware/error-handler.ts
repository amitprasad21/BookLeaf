import type { ErrorBody } from "@bookleaf/shared";
import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import { ZodError } from "zod";
import { AppError, RateLimitedError, ValidationError, VersionConflictError } from "../lib/errors.js";

const GENERIC_MESSAGE = "Something went wrong on our side. Please try again.";

/**
 * The single place that formats error responses. Known errors keep their
 * status and message; anything else becomes a generic 500 so stack traces and
 * internal messages never reach clients (they go to the log with the request id).
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const known = toAppError(err);
    if (!known) {
      logger.error({ err, requestId: req.requestId }, "Unhandled error");
    }
    const error = known ?? new AppError(500, "INTERNAL_ERROR", GENERIC_MESSAGE);

    if (error instanceof RateLimitedError) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
    }

    const body: ErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
        ...(error instanceof VersionConflictError && error.current !== undefined
          ? { current: error.current }
          : {}),
        requestId: req.requestId,
      },
    };
    res.status(error.status).json(body);
  };
}

function toAppError(err: unknown): AppError | undefined {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    return new ValidationError(
      undefined,
      err.issues.map((issue) => ({ path: issue.path.join("."), issue: issue.message })),
    );
  }
  return bodyParserError(err);
}

// express.json() failures carry a `type` string (body-parser convention).
function bodyParserError(err: unknown): AppError | undefined {
  if (typeof err !== "object" || err === null || !("type" in err)) return undefined;
  switch (err.type) {
    case "entity.parse.failed":
      return new ValidationError("Request body is not valid JSON.");
    case "entity.too.large":
      return new AppError(413, "VALIDATION_FAILED", "Request body is larger than 32 KB.");
    case "encoding.unsupported":
    case "charset.unsupported":
      return new AppError(415, "VALIDATION_FAILED", "Request body encoding is not supported.");
    default:
      return undefined;
  }
}
