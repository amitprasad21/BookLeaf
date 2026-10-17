import { describe, expect, it } from "vitest";
import {
  classifyValue,
  isSupabaseProjectUrl,
  leakedSecretNames,
  parseEnvFile,
  supabaseKeyKind,
} from "../scripts/credential-checks.js";

describe("credential checks", () => {
  it("classifies missing, placeholder and configured values", () => {
    expect(classifyValue(undefined)).toBe("missing");
    expect(classifyValue("  ")).toBe("missing");
    expect(classifyValue("replace-with-secret-key")).toBe("placeholder");
    expect(classifyValue("https://your-project-ref.supabase.co")).toBe("placeholder");
    expect(classifyValue("sb_publishable_abc")).toBe("configured");
  });

  it("recognises Supabase key kinds by prefix", () => {
    expect(supabaseKeyKind("sb_publishable_x")).toBe("publishable");
    expect(supabaseKeyKind("sb_secret_x")).toBe("secret");
    expect(supabaseKeyKind("eyJhbGciOi.legacy")).toBe("legacy-jwt");
    expect(supabaseKeyKind("something-else")).toBe("unknown");
  });

  it("accepts only https project URLs without a path", () => {
    expect(isSupabaseProjectUrl("https://abcd1234.supabase.co")).toBe(true);
    expect(isSupabaseProjectUrl("http://abcd1234.supabase.co")).toBe(false);
    expect(isSupabaseProjectUrl("https://abcd1234.supabase.co/rest/v1")).toBe(false);
    expect(isSupabaseProjectUrl("not a url")).toBe(false);
  });

  it("parses .env files, ignoring comments and stripping quotes", () => {
    expect(parseEnvFile("# c\nA=1\n\nB = \"two\"\r\nC='3'\nnot-a-pair\n")).toEqual({
      A: "1",
      B: "two",
      C: "3",
    });
  });

  it("flags server secrets in browser env files by name only", () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ok",
      NEXT_PUBLIC_OOPS: "sb_secret_leaked",
      SUPABASE_SERVICE_ROLE_KEY: "anything",
      COPIED: "the-backend-secret",
    };
    expect(leakedSecretNames(env, "the-backend-secret").sort()).toEqual([
      "COPIED",
      "NEXT_PUBLIC_OOPS",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]);
    expect(leakedSecretNames({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ok" }, "s")).toEqual([]);
  });
});
