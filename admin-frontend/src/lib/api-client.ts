// Fetch wrapper for the BookLeaf API (FRONTEND_ARCHITECTURE.md sections 4 and 8):
// base URL, bearer token, one refresh-and-retry on 401, and the error
// envelope turned into ApiError. A second 401 ends the session.
import type { ApiEnvelope, ErrorBody, ErrorDetail } from "@bookleaf/shared";
import { publicConfig } from "./config";
import { getSupabase } from "./supabase";

export const NETWORK_ERROR = "NETWORK_ERROR";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ErrorDetail[] = [],
    readonly requestId: string | null = null,
    readonly retryAfterSeconds: number | null = null,
    /** VERSION_CONFLICT only: the resource as it is now. */
    readonly current: unknown = undefined,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

type Query = Record<string, string | number | undefined>;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

// Set by the session provider, which wraps every screen that calls the API.
let onSessionExpired: () => void = () => {};

/** The session provider signs out locally and routes to /login?reason=expired. */
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

function urlFor(path: string, query?: Query): string {
  const url = new URL(`${publicConfig().apiBaseUrl}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function currentToken(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token ?? null;
}

async function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(urlFor(path, options.query), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(0, NETWORK_ERROR, "We couldn't reach BookLeaf. Check your connection and try again.");
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("X-Request-Id");
  const retryAfter = Number(response.headers.get("Retry-After"));
  const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null;
  try {
    const body = (await response.json()) as Partial<ErrorBody>;
    if (body.error && typeof body.error.code === "string" && typeof body.error.message === "string") {
      return new ApiError(
        response.status,
        body.error.code,
        body.error.message,
        body.error.details ?? [],
        body.error.requestId ?? requestId,
        retryAfterSeconds,
        body.error.current,
      );
    }
  } catch {
    // Not the documented envelope (e.g. a proxy page): never show its text.
  }
  return new ApiError(
    response.status,
    "INTERNAL_ERROR",
    "Something went wrong on our side.",
    [],
    requestId,
    retryAfterSeconds,
  );
}

export async function apiRequest<T, M = undefined>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiEnvelope<T, M>> {
  let response = await send(path, options, await currentToken());

  if (response.status === 401) {
    const { data } = await getSupabase().auth.refreshSession();
    if (data.session) response = await send(path, options, data.session.access_token);
    if (response.status === 401) {
      await getSupabase().auth.signOut({ scope: "local" });
      onSessionExpired();
      throw await toApiError(response);
    }
  }

  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as ApiEnvelope<T, M>;
}

export const api = {
  get: <T, M = undefined>(path: string, options: Omit<RequestOptions, "method" | "body"> = {}) =>
    apiRequest<T, M>(path, options),
  post: <T>(path: string, body: unknown, options: Omit<RequestOptions, "method" | "body"> = {}) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body: unknown, options: Omit<RequestOptions, "method" | "body"> = {}) =>
    apiRequest<T>(path, { ...options, method: "PATCH", body }),
};
