// Gemini adapter over the REST generateContent endpoint (no SDK: D-028).
// Structured output via responseMimeType + responseJsonSchema; failures are
// classified from structured fields (HTTP status, ErrorInfo.reason, RetryInfo,
// finishReason), never from message text.
import { parseStructured, toProviderJsonSchema } from "./json-schema.js";
import { kindForStatus, postJson, type HttpPolicy } from "./http.js";
import {
  ProviderError,
  type AiTask,
  type LlmProvider,
  type ProviderErrorKind,
  type StructuredRequest,
  type TokenUsage,
} from "./types.js";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
/** A retry delay longer than this means a quota window (e.g. the free tier's daily cap). */
const QUOTA_RETRY_THRESHOLD_MS = 60_000;
const REFUSAL_REASONS = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"]);

interface GeminiErrorBody {
  error?: { status?: string; details?: { "@type"?: string; reason?: string; retryDelay?: string }[] };
}
interface GeminiResponse {
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    cachedContentTokenCount?: number;
  };
}

export interface GeminiOptions {
  apiKey: string;
  models: Record<AiTask, string>;
  maxRetries: number;
  fetchFn?: typeof fetch;
  sleep?: HttpPolicy["sleep"];
}

function retryDelayMs(body: unknown): number | undefined {
  const details = (body as GeminiErrorBody | null)?.error?.details ?? [];
  const delay = details.find((detail) => detail["@type"]?.endsWith("google.rpc.RetryInfo"))?.retryDelay;
  const seconds = delay ? Number.parseFloat(delay) : Number.NaN;
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

function classify(status: number, body: unknown, retryAfterMs: number | undefined): ProviderErrorKind {
  const details = (body as GeminiErrorBody | null)?.error?.details ?? [];
  if (details.some((detail) => detail.reason === "API_KEY_INVALID")) return "auth";
  if (status === 429 && retryAfterMs !== undefined && retryAfterMs > QUOTA_RETRY_THRESHOLD_MS) return "quota";
  return kindForStatus(status);
}

function usageOf(response: GeminiResponse): TokenUsage {
  const usage = response.usageMetadata ?? {};
  return {
    inputTokens: usage.promptTokenCount ?? 0,
    // Thinking tokens are billed as output.
    outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
    cacheReadTokens: usage.cachedContentTokenCount ?? 0,
    cacheWriteTokens: 0,
  };
}

export function createGeminiProvider(options: GeminiOptions): LlmProvider {
  return {
    name: "gemini",
    modelFor: (task) => options.models[task],

    async generateStructured<T>(request: StructuredRequest<T>) {
      const model = options.models[request.task];
      const started = Date.now();
      const response = await postJson(
        `${BASE_URL}/models/${encodeURIComponent(model)}:generateContent`,
        { "x-goog-api-key": options.apiKey },
        {
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: "user", parts: [{ text: request.user }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: toProviderJsonSchema(request.schema),
            maxOutputTokens: request.maxOutputTokens,
          },
        },
        {
          provider: "gemini",
          timeoutMs: request.timeoutMs,
          maxRetries: options.maxRetries,
          fetchFn: options.fetchFn,
          sleep: options.sleep,
        },
        classify,
        retryDelayMs,
      );

      const body = (response.body ?? {}) as GeminiResponse;
      const usage = usageOf(body);
      const fail = (kind: ProviderErrorKind, why: string) =>
        new ProviderError("gemini", kind, `gemini ${why}`, usage);

      if (body.promptFeedback?.blockReason) throw fail("refused", "blocked the prompt");
      const candidate = body.candidates?.[0];
      if (!candidate) throw fail("invalid_output", "returned no candidate");
      if (candidate.finishReason && REFUSAL_REASONS.has(candidate.finishReason)) {
        throw fail("refused", `stopped (${candidate.finishReason})`);
      }
      if (candidate.finishReason !== "STOP") {
        throw fail("invalid_output", `stopped (${candidate.finishReason ?? "unknown"})`);
      }
      const text = (candidate.content?.parts ?? [])
        .filter((part) => !part.thought && typeof part.text === "string")
        .map((part) => part.text)
        .join("");
      const parsed = parseStructured(request.schema, text);
      if (!parsed.ok) throw fail("invalid_output", "output did not match the schema");
      return { value: parsed.value, usage, latencyMs: Date.now() - started };
    },
  };
}
