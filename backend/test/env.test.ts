import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";

describe("loadEnv", () => {
  it("applies development defaults", () => {
    expect(loadEnv({})).toEqual({
      NODE_ENV: "development",
      PORT: 4000,
      LOG_LEVEL: "info",
      CORS_ALLOWED_ORIGINS: ["http://localhost:3000", "http://localhost:3001"],
    });
  });

  it("silences logs by default in tests", () => {
    expect(loadEnv({ NODE_ENV: "test" }).LOG_LEVEL).toBe("silent");
  });

  it("parses a comma-separated origin allowlist", () => {
    const env = loadEnv({ CORS_ALLOWED_ORIGINS: " https://a.example.com , https://b.example.com " });
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(["https://a.example.com", "https://b.example.com"]);
  });

  it("rejects origins with paths or wildcards", () => {
    expect(() => loadEnv({ CORS_ALLOWED_ORIGINS: "https://a.example.com/app" })).toThrow(
      /CORS_ALLOWED_ORIGINS/,
    );
    expect(() => loadEnv({ CORS_ALLOWED_ORIGINS: "*" })).toThrow(/CORS_ALLOWED_ORIGINS/);
  });

  it("requires an explicit allowlist in production", () => {
    expect(() => loadEnv({ NODE_ENV: "production" })).toThrow(
      /^Invalid environment configuration: CORS_ALLOWED_ORIGINS$/,
    );
  });

  it("names the invalid variable without echoing its value", () => {
    expect(() => loadEnv({ PORT: "not-a-port-secret-value" })).toThrow(
      /^Invalid environment configuration: PORT$/,
    );
  });
});
