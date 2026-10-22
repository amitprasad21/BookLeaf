import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";

// Placeholder project values (not real credentials).
const SUPABASE = {
  SUPABASE_URL: "https://example-ref.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  SUPABASE_SECRET_KEY: "sb_secret_x",
};

const AI_DEFAULTS = {
  AI_PRIMARY_PROVIDER: "mock",
  AI_DAILY_TOKEN_BUDGET: 300_000,
  AI_TRIAGE_TIMEOUT_MS: 30_000,
  AI_DRAFT_TIMEOUT_MS: 30_000,
  AI_REQUEST_MIN_INTERVAL_MS: 8_000,
  AI_MAX_RETRIES: 2,
  AI_CIRCUIT_FAILURE_THRESHOLD: 3,
  AI_CIRCUIT_COOLDOWN_MS: 60_000,
};

describe("loadEnv", () => {
  it("bounds provider pacing and permits an explicit zero for controlled environments", () => {
    expect(loadEnv({ NODE_ENV: "test", AI_REQUEST_MIN_INTERVAL_MS: "0" }).AI_REQUEST_MIN_INTERVAL_MS).toBe(0);
    expect(() => loadEnv({ NODE_ENV: "test", AI_REQUEST_MIN_INTERVAL_MS: "-1" })).toThrow(
      /AI_REQUEST_MIN_INTERVAL_MS/,
    );
    expect(() => loadEnv({ NODE_ENV: "test", AI_REQUEST_MIN_INTERVAL_MS: "30001" })).toThrow(
      /AI_REQUEST_MIN_INTERVAL_MS/,
    );
  });
  it("applies development defaults (AI on the local mock)", () => {
    expect(loadEnv({ ...SUPABASE })).toEqual({
      NODE_ENV: "development",
      PORT: 4000,
      LOG_LEVEL: "info",
      TRUST_PROXY_HOPS: 0,
      CORS_ALLOWED_ORIGINS: ["http://localhost:3000", "http://localhost:3001"],
      ...SUPABASE,
      ...AI_DEFAULTS,
    });
  });

  it("reads the number of trusted proxy hops (Render: 1)", () => {
    expect(loadEnv({ ...SUPABASE, TRUST_PROXY_HOPS: "1" }).TRUST_PROXY_HOPS).toBe(1);
    expect(() => loadEnv({ ...SUPABASE, TRUST_PROXY_HOPS: "9" })).toThrow(/TRUST_PROXY_HOPS/);
  });

  it("silences logs by default in tests and doesn't require Supabase there", () => {
    expect(loadEnv({ NODE_ENV: "test" }).LOG_LEVEL).toBe("silent");
  });

  it("requires the Supabase project values outside tests", () => {
    expect(() => loadEnv({})).toThrow(
      /^Invalid environment configuration: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY$/,
    );
  });

  it("requires an https Supabase URL", () => {
    expect(() => loadEnv({ ...SUPABASE, SUPABASE_URL: "http://example-ref.supabase.co" })).toThrow(
      /SUPABASE_URL/,
    );
  });

  it("parses a comma-separated origin allowlist", () => {
    const env = loadEnv({
      ...SUPABASE,
      CORS_ALLOWED_ORIGINS: " https://a.example.com , https://b.example.com ",
    });
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(["https://a.example.com", "https://b.example.com"]);
  });

  it("rejects origins with paths or wildcards", () => {
    expect(() => loadEnv({ ...SUPABASE, CORS_ALLOWED_ORIGINS: "https://a.example.com/app" })).toThrow(
      /CORS_ALLOWED_ORIGINS/,
    );
    expect(() => loadEnv({ ...SUPABASE, CORS_ALLOWED_ORIGINS: "*" })).toThrow(/CORS_ALLOWED_ORIGINS/);
  });

  it("requires an explicit allowlist in production", () => {
    expect(() => loadEnv({ ...SUPABASE, NODE_ENV: "production", AI_PRIMARY_PROVIDER: "none" })).toThrow(
      /^Invalid environment configuration: CORS_ALLOWED_ORIGINS$/,
    );
  });

  it("requires an explicit, real AI provider in production (never the mock)", () => {
    const production = { ...SUPABASE, NODE_ENV: "production", CORS_ALLOWED_ORIGINS: "https://a.example.com" };
    expect(() => loadEnv(production)).toThrow(/^Invalid environment configuration: AI_PRIMARY_PROVIDER$/);
    expect(() => loadEnv({ ...production, AI_PRIMARY_PROVIDER: "mock" })).toThrow(/AI_PRIMARY_PROVIDER/);
    expect(loadEnv({ ...production, AI_PRIMARY_PROVIDER: "none" }).AI_PRIMARY_PROVIDER).toBe("none");
  });

  it("requires the key of each configured AI provider, naming it without the value", () => {
    expect(() =>
      loadEnv({ ...SUPABASE, AI_PRIMARY_PROVIDER: "gemini", AI_FALLBACK_PROVIDER: "groq" }),
    ).toThrow(/^Invalid environment configuration: GEMINI_API_KEY, GROQ_API_KEY$/);
    const env = loadEnv({
      ...SUPABASE,
      AI_PRIMARY_PROVIDER: "gemini",
      GEMINI_API_KEY: "test-gemini-key",
    });
    expect(env.AI_PRIMARY_PROVIDER).toBe("gemini");
  });

  it("refuses a fallback on the same provider (no key cycling, C-14)", () => {
    expect(() =>
      loadEnv({ ...SUPABASE, AI_PRIMARY_PROVIDER: "groq", AI_FALLBACK_PROVIDER: "groq", GROQ_API_KEY: "k" }),
    ).toThrow(/^Invalid environment configuration: AI_FALLBACK_PROVIDER$/);
  });

  it("treats empty values and .env.example placeholders as not set", () => {
    const env = loadEnv({
      ...SUPABASE,
      AI_PRIMARY_MODEL: "replace-with-model-id",
      AI_FALLBACK_PROVIDER: "",
      AI_DAILY_TOKEN_BUDGET: "",
    });
    expect(env.AI_PRIMARY_MODEL).toBeUndefined();
    expect(env.AI_FALLBACK_PROVIDER).toBeUndefined();
    expect(env.AI_DAILY_TOKEN_BUDGET).toBe(300_000);
  });

  it("rejects an unknown AI provider", () => {
    expect(() => loadEnv({ ...SUPABASE, AI_PRIMARY_PROVIDER: "anthropic" })).toThrow(
      /^Invalid environment configuration: AI_PRIMARY_PROVIDER$/,
    );
  });

  it("names the invalid variable without echoing its value", () => {
    expect(() => loadEnv({ ...SUPABASE, PORT: "not-a-port-secret-value" })).toThrow(
      /^Invalid environment configuration: PORT$/,
    );
  });
});
