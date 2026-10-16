// Error envelope contract. Codes must match openapi.yaml
// (components/schemas/ErrorResponse) and INTEGRATION_CONTRACT.md section 6.

export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VERSION_CONFLICT",
  "INVALID_STATUS_TRANSITION",
  "INVALID_ASSIGNMENT",
  "RATE_LIMITED",
  "AI_UNAVAILABLE",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Reasons carried in `details[0].issue` when `code` is AI_UNAVAILABLE. */
export const AI_UNAVAILABLE_REASONS = [
  "not_configured",
  "provider_unavailable",
  "circuit_open",
  "budget_exhausted",
  "invalid_output",
  "refused",
] as const;

export type AiUnavailableReason = (typeof AI_UNAVAILABLE_REASONS)[number];

export interface ErrorDetail {
  path?: string;
  issue: string;
}

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
    requestId: string;
  };
}
