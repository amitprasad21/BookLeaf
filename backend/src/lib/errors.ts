// Typed errors that services throw. Only middleware/error-handler.ts turns them
// into HTTP responses, using the envelope in INTEGRATION_CONTRACT.md section 5.
import type { AiUnavailableReason, ErrorCode, ErrorDetail } from "@bookleaf/shared";

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: ErrorDetail[] | undefined;

  constructor(status: number, code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Some fields are invalid.", details?: ErrorDetail[]) {
    super(400, "VALIDATION_FAILED", message, details);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Please sign in to continue.") {
    super(401, "UNAUTHENTICATED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have access to this resource.") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.") {
    super(404, "NOT_FOUND", message);
  }
}

export class VersionConflictError extends AppError {
  /** The resource as it is now; returned as `error.current`. */
  readonly current: unknown;

  constructor(
    current?: unknown,
    message = "Someone else changed this ticket. The latest version is shown; reapply your change if it's still needed.",
  ) {
    super(409, "VERSION_CONFLICT", message, [{ path: "version", issue: "is out of date" }]);
    this.current = current;
  }
}

export class InvalidTransitionError extends AppError {
  constructor(message: string) {
    super(422, "INVALID_STATUS_TRANSITION", message);
  }
}

export class InvalidAssignmentError extends AppError {
  constructor(message = "You can only assign tickets to yourself.") {
    super(422, "INVALID_ASSIGNMENT", message);
  }
}

export class RateLimitedError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = "Too many requests. Please try again later.") {
    super(429, "RATE_LIMITED", message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class AiUnavailableError extends AppError {
  constructor(reason: AiUnavailableReason, message = "AI assistance is unavailable right now.") {
    super(503, "AI_UNAVAILABLE", message, [{ issue: reason }]);
  }
}
