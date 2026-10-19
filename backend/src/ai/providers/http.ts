// One bounded retry layer for the REST adapters (no SDKs: D-028). Retries only
// what can succeed soon: 408/429/5xx and connection drops, honouring the
// provider's retry delay when it is short. A long retry delay means a quota
// window, so the call fails fast as `quota` and the router fails over instead.
import { ProviderError, type ProviderErrorKind, type ProviderName } from "./types.js";

export interface HttpPolicy {
  provider: ProviderName;
  timeoutMs: number;
  /** Extra attempts after the first (AI_MAX_RETRIES). */
  maxRetries: number;
  /** Longest provider-requested wait we honour before giving up (default 5 s). */
  maxRetryWaitMs?: number;
  /** Injectable for tests. */
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

/** Why a non-2xx response failed, decided by the adapter from structured fields. */
export interface FailureClassifier {
  (status: number, body: unknown, retryAfterMs: number | undefined): ProviderErrorKind;
}

const RETRYABLE = new Set(["rate_limited", "overloaded", "timeout", "connection"]);
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function retryAfterFromHeader(headers: Headers): number | undefined {
  const value = headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

/** Default status mapping; adapters refine it with provider-specific fields. */
export function kindForStatus(status: number): ProviderErrorKind {
  if (status === 401 || status === 403 || status === 404) return "auth"; // key, permission or model access
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "overloaded";
  return "bad_request";
}

export async function postJson(
  url: string,
  headers: Record<string, string>,
  payload: unknown,
  policy: HttpPolicy,
  classify: FailureClassifier,
  retryAfterFromBody?: (body: unknown) => number | undefined,
): Promise<HttpResponse> {
  const fetchFn = policy.fetchFn ?? fetch;
  const sleep = policy.sleep ?? defaultSleep;
  const maxWait = policy.maxRetryWaitMs ?? 5_000;

  for (let attempt = 0; ; attempt += 1) {
    let kind: ProviderErrorKind;
    let retryAfterMs: number | undefined;
    let detail: string;
    try {
      const response = await fetchFn(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(policy.timeoutMs),
      });
      const text = await response.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
      if (response.ok) return { status: response.status, body };
      retryAfterMs = retryAfterFromHeader(response.headers) ?? retryAfterFromBody?.(body);
      kind = classify(response.status, body, retryAfterMs);
      detail = `HTTP ${response.status}`;
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      kind = name === "TimeoutError" || name === "AbortError" ? "timeout" : "connection";
      detail = kind;
    }

    // A timeout already used the whole budget for this attempt: don't stack another.
    const retryable = RETRYABLE.has(kind) && kind !== "timeout";
    const wait = retryAfterMs ?? 500 * 2 ** attempt + Math.floor(Math.random() * 250);
    if (!retryable || attempt >= policy.maxRetries || wait > maxWait) {
      throw new ProviderError(policy.provider, kind, `${policy.provider} request failed (${detail})`);
    }
    await sleep(wait);
  }
}
