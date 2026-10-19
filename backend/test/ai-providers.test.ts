// Gemini and Groq adapters against a scripted fetch (no network), plus the mock.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createGeminiProvider } from "../src/ai/providers/gemini.js";
import { createGroqProvider } from "../src/ai/providers/groq.js";
import { toProviderJsonSchema } from "../src/ai/providers/json-schema.js";
import { createMockProvider } from "../src/ai/providers/mock.js";
import { ProviderError, type StructuredRequest } from "../src/ai/providers/types.js";

const API_KEY = "test-key-should-never-appear";
const Result = z.strictObject({
  category: z.enum(["royalty_payments", "general_inquiry"]),
  note: z.string().nullable(),
});
type Result = z.infer<typeof Result>;
const request: StructuredRequest<Result> = {
  task: "triage",
  system: "Classify the ticket.",
  user: "<ticket>My royalty is late</ticket>",
  schema: Result,
  schemaName: "triage_result",
  maxOutputTokens: 500,
  timeoutMs: 5_000,
};

type Scripted = { status: number; body?: unknown; headers?: Record<string, string> } | Error;

/** A fetch that replays responses in order and records each request. */
function scriptedFetch(...responses: Scripted[]) {
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(String(init.body)) as Record<string, unknown>,
    });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)]!;
    if (next instanceof Error) throw next;
    return new Response(next.body === undefined ? "" : JSON.stringify(next.body), {
      status: next.status,
      headers: next.headers,
    });
  }) as typeof fetch;
  return { fetchFn, calls };
}

const sleeps: number[] = [];
const sleep = async (ms: number) => {
  sleeps.push(ms);
};

async function failure(promise: Promise<unknown>): Promise<ProviderError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ProviderError);
  expect((error as Error).message).not.toContain(API_KEY);
  return error as ProviderError;
}

// ----------------------------------------------------------------- Gemini

const geminiOk = (text: string, finishReason = "STOP") => ({
  candidates: [{ finishReason, content: { parts: [{ text: "thinking…", thought: true }, { text }] } }],
  usageMetadata: {
    promptTokenCount: 120,
    candidatesTokenCount: 30,
    thoughtsTokenCount: 12,
    cachedContentTokenCount: 20,
  },
});
const gemini = (...responses: Scripted[]) => {
  const { fetchFn, calls } = scriptedFetch(...responses);
  sleeps.length = 0;
  const provider = createGeminiProvider({
    apiKey: API_KEY,
    models: { triage: "gemini-3.5-flash-lite", draft: "gemini-3.8-flash" },
    maxRetries: 2,
    fetchFn,
    sleep,
  });
  return { provider, calls };
};

describe("Gemini adapter", () => {
  it("sends a structured-output request for the task's model, with the key in a header", async () => {
    const { provider, calls } = gemini({
      status: 200,
      body: geminiOk('{"category":"royalty_payments","note":null}'),
    });
    const result = await provider.generateStructured(request);

    expect(result.value).toEqual({ category: "royalty_payments", note: null });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
    );
    expect(calls[0]!.headers["x-goog-api-key"]).toBe(API_KEY);
    expect(calls[0]!.url).not.toContain(API_KEY);
    expect(calls[0]!.body).toEqual({
      systemInstruction: { parts: [{ text: "Classify the ticket." }] },
      contents: [{ role: "user", parts: [{ text: "<ticket>My royalty is late</ticket>" }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: toProviderJsonSchema(Result),
        maxOutputTokens: 500,
      },
    });
    expect(provider.modelFor("draft")).toBe("gemini-3.8-flash");
  });

  it("counts thinking as output and reports cached input, ignoring thought parts in the text", async () => {
    const { provider } = gemini({ status: 200, body: geminiOk('{"category":"general_inquiry","note":"x"}') });
    const result = await provider.generateStructured(request);
    expect(result.usage).toEqual({
      inputTokens: 120,
      outputTokens: 42,
      cacheReadTokens: 20,
      cacheWriteTokens: 0,
    });
  });

  it.each([
    ["a cut-off at the token limit", geminiOk('{"category":', "MAX_TOKENS"), "invalid_output"],
    ["a safety stop", geminiOk("{}", "SAFETY"), "refused"],
    ["a blocked prompt", { promptFeedback: { blockReason: "PROHIBITED_CONTENT" } }, "refused"],
    ["JSON that breaks the schema", geminiOk('{"category":"refunds","note":null}'), "invalid_output"],
    ["text that isn't JSON", geminiOk("Sure! Here is the category."), "invalid_output"],
    ["no candidate", { candidates: [] }, "invalid_output"],
  ])("maps %s", async (_case, body, kind) => {
    const { provider } = gemini({ status: 200, body });
    expect((await failure(provider.generateStructured(request))).kind).toBe(kind);
  });

  it("keeps the usage of a failed output so it still counts against the budget", async () => {
    const { provider } = gemini({ status: 200, body: geminiOk("not json") });
    expect((await failure(provider.generateStructured(request))).usage?.inputTokens).toBe(120);
  });

  it("treats an invalid key (ErrorInfo API_KEY_INVALID), 403 and an unknown model as configuration errors, without retrying", async () => {
    const invalidKey = {
      status: 400,
      body: {
        error: {
          status: "INVALID_ARGUMENT",
          details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "API_KEY_INVALID" }],
        },
      },
    };
    for (const response of [invalidKey, { status: 403, body: {} }, { status: 404, body: {} }]) {
      const { provider, calls } = gemini(response);
      expect((await failure(provider.generateStructured(request))).kind).toBe("auth");
      expect(calls).toHaveLength(1);
    }
  });

  it("retries a short rate limit using the provider's RetryInfo delay, then succeeds", async () => {
    const limited = {
      status: 429,
      body: {
        error: { details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "2s" }] },
      },
    };
    const { provider, calls } = gemini(limited, {
      status: 200,
      body: geminiOk('{"category":"general_inquiry","note":null}'),
    });
    await provider.generateStructured(request);
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([2000]);
  });

  it("fails fast as quota when the retry delay is long (free-tier daily cap)", async () => {
    const daily = {
      status: 429,
      body: {
        error: { details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "3600s" }] },
      },
    };
    const { provider, calls } = gemini(daily);
    expect((await failure(provider.generateStructured(request))).kind).toBe("quota");
    expect(calls).toHaveLength(1);
  });

  it("gives up on persistent 5xx after the retry budget (1 + 2 attempts)", async () => {
    const { provider, calls } = gemini({ status: 503, body: {} });
    expect((await failure(provider.generateStructured(request))).kind).toBe("overloaded");
    expect(calls).toHaveLength(3);
    expect(sleeps).toHaveLength(2);
  });

  it("retries connection drops but never stacks another attempt after a timeout", async () => {
    const dropped = gemini(new TypeError("fetch failed"));
    expect((await failure(dropped.provider.generateStructured(request))).kind).toBe("connection");
    expect(dropped.calls).toHaveLength(3);

    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    const slow = gemini(timeout);
    expect((await failure(slow.provider.generateStructured(request))).kind).toBe("timeout");
    expect(slow.calls).toHaveLength(1);
  });
});

// ------------------------------------------------------------------- Groq

const groqOk = (content: string, finish_reason = "stop") => ({
  choices: [{ finish_reason, message: { content } }],
  usage: { prompt_tokens: 90, completion_tokens: 25, prompt_tokens_details: { cached_tokens: 10 } },
});
const groq = (...responses: Scripted[]) => {
  const { fetchFn, calls } = scriptedFetch(...responses);
  sleeps.length = 0;
  const provider = createGroqProvider({
    apiKey: API_KEY,
    models: { triage: "openai/gpt-oss-120b", draft: "openai/gpt-oss-120b" },
    maxRetries: 2,
    fetchFn,
    sleep,
  });
  return { provider, calls };
};

describe("Groq adapter", () => {
  it("sends a strict json_schema chat completion with a bearer key", async () => {
    const { provider, calls } = groq({
      status: 200,
      body: groqOk('{"category":"royalty_payments","note":null}'),
    });
    const result = await provider.generateStructured(request);

    expect(result.value).toEqual({ category: "royalty_payments", note: null });
    expect(result.usage).toEqual({
      inputTokens: 90,
      outputTokens: 25,
      cacheReadTokens: 10,
      cacheWriteTokens: 0,
    });
    expect(calls[0]!.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(calls[0]!.headers.authorization).toBe(`Bearer ${API_KEY}`);
    expect(calls[0]!.body).toEqual({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: "Classify the ticket." },
        { role: "user", content: "<ticket>My royalty is late</ticket>" },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "triage_result", strict: true, schema: toProviderJsonSchema(Result) },
      },
      max_completion_tokens: 500,
    });
  });

  it("the generated schema meets strict mode: no extra properties, every property required", () => {
    const schema = toProviderJsonSchema(Result) as {
      additionalProperties: boolean;
      required: string[];
      properties: object;
      $schema?: string;
    };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required.sort()).toEqual(Object.keys(schema.properties).sort());
    expect(schema.$schema).toBeUndefined();
  });

  it.each([
    ["finish_reason length", { status: 200, body: groqOk('{"cat', "length") }, "invalid_output"],
    [
      "a refusal",
      {
        status: 200,
        body: { choices: [{ finish_reason: "stop", message: { content: null, refusal: "no" } }] },
      },
      "refused",
    ],
    ["a content filter", { status: 200, body: groqOk("", "content_filter") }, "refused"],
    [
      "json_validate_failed",
      { status: 400, body: { error: { type: "invalid_request_error", code: "json_validate_failed" } } },
      "invalid_output",
    ],
    ["422", { status: 422, body: {} }, "invalid_output"],
    ["401", { status: 401, body: {} }, "auth"],
    ["404 model", { status: 404, body: {} }, "auth"],
    ["413", { status: 413, body: {} }, "bad_request"],
  ])("maps %s", async (_case, response, kind) => {
    const { provider } = groq(response as Scripted);
    expect((await failure(provider.generateStructured(request))).kind).toBe(kind);
  });

  it("honours a short retry-after header, and treats a long one as quota", async () => {
    const short = groq(
      { status: 429, body: {}, headers: { "retry-after": "1" } },
      { status: 200, body: groqOk('{"category":"general_inquiry","note":null}') },
    );
    await short.provider.generateStructured(request);
    expect(short.calls).toHaveLength(2);
    expect(sleeps).toEqual([1000]);

    const long = groq({ status: 429, body: {}, headers: { "retry-after": "7200" } });
    expect((await failure(long.provider.generateStructured(request))).kind).toBe("quota");
    expect(long.calls).toHaveLength(1);
  });

  it("retries a capacity error (498) as overloaded", async () => {
    const { provider, calls } = groq({ status: 498, body: {} });
    expect((await failure(provider.generateStructured(request))).kind).toBe("overloaded");
    expect(calls).toHaveLength(3);
  });
});

// ------------------------------------------------------------------- Mock

describe("mock provider", () => {
  const responders = { triage_result: () => ({ category: "general_inquiry", note: null }) };

  it("answers from the responder for the schema, validated like a real model", async () => {
    const result = await createMockProvider({ responders }).generateStructured(request);
    expect(result.value).toEqual({ category: "general_inquiry", note: null });
    expect(result.usage.inputTokens).toBeGreaterThan(0);
  });

  it("returns invalid_output when no responder fits the schema", async () => {
    expect((await failure(createMockProvider().generateStructured(request))).kind).toBe("invalid_output");
  });

  it("simulates failures from [mock:<kind>] markers only when allowed", async () => {
    const marked = { ...request, user: "<ticket>[mock:timeout] late royalty</ticket>" };
    const allowed = createMockProvider({ responders, failureMarkers: true });
    expect((await failure(allowed.generateStructured(marked))).kind).toBe("timeout");

    const production = createMockProvider({ responders, failureMarkers: false });
    expect((await production.generateStructured(marked)).value.category).toBe("general_inquiry");
  });
});
