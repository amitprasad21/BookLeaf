import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";

// Placeholder project values (not real credentials).
const SUPABASE = {
  SUPABASE_URL: "https://example-ref.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

describe("loadEnv", () => {
  it("applies development defaults", () => {
    expect(loadEnv({ ...SUPABASE })).toEqual({
      NODE_ENV: "development",
      PORT: 4000,
      LOG_LEVEL: "info",
      CORS_ALLOWED_ORIGINS: ["http://localhost:3000", "http://localhost:3001"],
      ...SUPABASE,
    });
  });

  it("silences logs by default in tests and doesn't require Supabase there", () => {
    expect(loadEnv({ NODE_ENV: "test" }).LOG_LEVEL).toBe("silent");
  });

  it("requires the Supabase project values outside tests", () => {
    expect(() => loadEnv({})).toThrow(
      /^Invalid environment configuration: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY$/,
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
    expect(() => loadEnv({ ...SUPABASE, NODE_ENV: "production" })).toThrow(
      /^Invalid environment configuration: CORS_ALLOWED_ORIGINS$/,
    );
  });

  it("names the invalid variable without echoing its value", () => {
    expect(() => loadEnv({ ...SUPABASE, PORT: "not-a-port-secret-value" })).toThrow(
      /^Invalid environment configuration: PORT$/,
    );
  });
});
