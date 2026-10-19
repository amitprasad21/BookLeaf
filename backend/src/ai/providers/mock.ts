// Deterministic provider for tests, local development and degradation demos
// (.back/AI_PROVIDER_ORCHESTRATION.md section 9). Responses come from
// per-schema responders (registered by the triage and draft features), and
// `[mock:<kind>]` markers in the ticket text simulate failures when allowed.
import { parseStructured } from "./json-schema.js";
import {
  ProviderError,
  type LlmProvider,
  type ProviderErrorKind,
  type StructuredRequest,
  type TokenUsage,
} from "./types.js";

export const MOCK_MODEL = "mock-1";

/** Builds the raw JSON a real model would return for one schema. */
export type MockResponder = (request: StructuredRequest<unknown>) => unknown;

export interface MockOptions {
  responders?: Record<string, MockResponder>;
  /** Honour `[mock:<kind>]` markers. Never in production. */
  failureMarkers?: boolean;
  /** Fixed latency reported in results (no real waiting). */
  latencyMs?: number;
}

const MARKER_KINDS: readonly ProviderErrorKind[] = [
  "auth",
  "quota",
  "rate_limited",
  "overloaded",
  "timeout",
  "connection",
  "bad_request",
  "refused",
  "invalid_output",
];

/** Rough, deterministic token estimate (about 4 characters per token). */
const tokens = (text: string) => Math.ceil(text.length / 4);

export function createMockProvider(options: MockOptions = {}): LlmProvider {
  const responders = options.responders ?? {};
  return {
    name: "mock",
    modelFor: () => MOCK_MODEL,

    async generateStructured<T>(request: StructuredRequest<T>) {
      const inputTokens = tokens(request.system) + tokens(request.user);
      if (options.failureMarkers) {
        const kind = MARKER_KINDS.find((candidate) => request.user.includes(`[mock:${candidate}]`));
        if (kind) {
          const usage: TokenUsage | undefined =
            kind === "invalid_output" || kind === "refused"
              ? { inputTokens, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
              : undefined;
          throw new ProviderError("mock", kind, `mock simulated ${kind}`, usage);
        }
      }
      const responder = responders[request.schemaName];
      const raw = responder ? responder(request as StructuredRequest<unknown>) : {};
      const text = JSON.stringify(raw);
      const usage = { inputTokens, outputTokens: tokens(text), cacheReadTokens: 0, cacheWriteTokens: 0 };
      const parsed = parseStructured(request.schema, text);
      if (!parsed.ok)
        throw new ProviderError("mock", "invalid_output", "mock output did not match the schema", usage);
      return { value: parsed.value, usage, latencyMs: options.latencyMs ?? 5 };
    },
  };
}
