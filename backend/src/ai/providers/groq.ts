// Groq adapter over its OpenAI-compatible chat completions API (no SDK: D-028).
// Structured output via response_format json_schema in strict mode (supported
// on openai/gpt-oss-120b). Failures are classified from the HTTP status and
// documented fields, never from message text.
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

const BASE_URL = "https://api.groq.com/openai/v1";
const QUOTA_RETRY_THRESHOLD_MS = 60_000;

interface GroqErrorBody {
  error?: { type?: string; code?: string };
}
interface GroqResponse {
  choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

export interface GroqOptions {
  apiKey: string;
  models: Record<AiTask, string>;
  maxRetries: number;
  fetchFn?: typeof fetch;
  sleep?: HttpPolicy["sleep"];
}

function classify(status: number, body: unknown, retryAfterMs: number | undefined): ProviderErrorKind {
  const code = (body as GroqErrorBody | null)?.error?.code;
  // The model produced JSON that failed the schema: an output problem, not our request.
  if (code === "json_validate_failed" || status === 422) return "invalid_output";
  if (status === 429 && retryAfterMs !== undefined && retryAfterMs > QUOTA_RETRY_THRESHOLD_MS) return "quota";
  if (status === 498) return "overloaded"; // capacity exceeded
  return kindForStatus(status);
}

function usageOf(response: GroqResponse): TokenUsage {
  const usage = response.usage ?? {};
  return {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
    cacheReadTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
    cacheWriteTokens: 0,
  };
}

export function createGroqProvider(options: GroqOptions): LlmProvider {
  return {
    name: "groq",
    modelFor: (task) => options.models[task],

    async generateStructured<T>(request: StructuredRequest<T>) {
      const started = Date.now();
      const response = await postJson(
        `${BASE_URL}/chat/completions`,
        { authorization: `Bearer ${options.apiKey}` },
        {
          model: options.models[request.task],
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: request.schemaName,
              strict: true,
              schema: toProviderJsonSchema(request.schema),
            },
          },
          max_completion_tokens: request.maxOutputTokens,
        },
        {
          provider: "groq",
          timeoutMs: request.timeoutMs,
          maxRetries: options.maxRetries,
          fetchFn: options.fetchFn,
          sleep: options.sleep,
        },
        classify,
      );

      const body = (response.body ?? {}) as GroqResponse;
      const usage = usageOf(body);
      const fail = (kind: ProviderErrorKind, why: string) =>
        new ProviderError("groq", kind, `groq ${why}`, usage);

      const choice = body.choices?.[0];
      if (!choice) throw fail("invalid_output", "returned no choice");
      if (choice.message?.refusal) throw fail("refused", "refused the request");
      if (choice.finish_reason === "content_filter") throw fail("refused", "filtered the output");
      if (choice.finish_reason !== "stop") {
        throw fail("invalid_output", `stopped (${choice.finish_reason ?? "unknown"})`);
      }
      const parsed = parseStructured(request.schema, choice.message?.content ?? "");
      if (!parsed.ok) throw fail("invalid_output", "output did not match the schema");
      return { value: parsed.value, usage, latencyMs: Date.now() - started };
    },
  };
}
