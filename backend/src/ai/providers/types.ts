// Provider-neutral contract for LLM calls (.back/AI_PROVIDER_ORCHESTRATION.md
// section 2). Adapters translate HTTP or SDK failures into ProviderError kinds;
// the router decides failover, breaker and usage from the kind alone.
import type { ZodType } from "zod";

export type AiTask = "triage" | "draft";
export type ProviderName = "gemini" | "groq" | "mock";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface StructuredRequest<T> {
  task: AiTask;
  /** Stable instructions first (cache-friendly); never contains ticket text. */
  system: string;
  /** Volatile content: the ticket, delimited as untrusted data by the caller. */
  user: string;
  /** Output contract. Must use strict objects with every property required (nullable for optional). */
  schema: ZodType<T>;
  /** Name for the schema in provider requests, e.g. "triage_result". */
  schemaName: string;
  maxOutputTokens: number;
  timeoutMs: number;
}

export interface StructuredResult<T> {
  value: T;
  usage: TokenUsage;
  latencyMs: number;
}

export interface LlmProvider {
  readonly name: ProviderName;
  /** The model this provider uses for a task (models can differ per task). */
  modelFor(task: AiTask): string;
  generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>>;
}

export type ProviderErrorKind =
  | "auth" // 401/403: invalid or revoked key, or no access to the model
  | "quota" // hard quota or daily free-tier limit: retrying soon can't help
  | "rate_limited" // 429 after bounded retries
  | "overloaded" // 5xx after bounded retries
  | "timeout"
  | "connection"
  | "bad_request" // 400: our bug (schema, prompt size)
  | "refused" // safety block or refusal
  | "invalid_output"; // not valid JSON for the schema, or cut off at the token limit

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly provider: ProviderName;
  /** Usage that was still billed/counted for a failed call (e.g. invalid output). */
  readonly usage: TokenUsage | undefined;

  constructor(provider: ProviderName, kind: ProviderErrorKind, message: string, usage?: TokenUsage) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.kind = kind;
    this.usage = usage;
  }
}

export const NO_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};
