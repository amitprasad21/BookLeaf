// D-035: tokens that would make getClaims() call Supabase Auth are refused locally.
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { createSupabaseVerifier, hasAsymmetricHeader } from "../src/auth/supabase-verifier.js";

const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const tokenWith = (header: object) =>
  `${part(header)}.${part({ sub: "6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c0003", role: "authenticated" })}.c2lnbmF0dXJl`;

describe("hasAsymmetricHeader", () => {
  it("accepts asymmetric algorithms with a key id", () => {
    expect(hasAsymmetricHeader(tokenWith({ alg: "ES256", kid: "key-1", typ: "JWT" }))).toBe(true);
    expect(hasAsymmetricHeader(tokenWith({ alg: "RS256", kid: "key-2" }))).toBe(true);
  });

  it("refuses symmetric or missing algorithms, a missing key id and unreadable headers", () => {
    for (const token of [
      tokenWith({ alg: "HS256", kid: "key-1" }),
      tokenWith({ alg: "none", kid: "key-1" }),
      tokenWith({ kid: "key-1" }),
      tokenWith({ alg: "ES256" }),
      tokenWith({ alg: "ES256", kid: "" }),
      tokenWith({ alg: "ES256", kid: 7 }),
      `${Buffer.from("not json").toString("base64url")}.e30.c2ln`,
      `${Buffer.from("null").toString("base64url")}.e30.c2ln`,
    ]) {
      expect(hasAsymmetricHeader(token), token).toBe(false);
    }
  });
});

describe("createSupabaseVerifier", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("answers a symmetric-algorithm token with null and makes no network call", async () => {
    const fetch = vi.fn(() => Promise.reject(new Error("no network in this test")));
    vi.stubGlobal("fetch", fetch);
    const verifier = createSupabaseVerifier({
      url: "https://example-ref.supabase.co",
      publishableKey: "sb_publishable_test",
    });
    await expect(verifier.verify(tokenWith({ alg: "HS256", typ: "JWT" }))).resolves.toBeNull();
    await expect(verifier.verify(tokenWith({ alg: "ES256" }))).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("still verifies the asymmetric signature before looking up the caller's profile", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const kid = "offline-signature-test";
    const sub = "6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c0003";
    const claims = { sub, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 300 };
    const unsigned = `${part({ alg: "ES256", kid, typ: "JWT" })}.${part(claims)}`;
    const signature = sign("sha256", Buffer.from(unsigned), {
      key: privateKey,
      dsaEncoding: "ieee-p1363",
    }).toString("base64url");
    const token = `${unsigned}.${signature}`;
    const fetch = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/.well-known/jwks.json")) {
        return new Response(
          JSON.stringify({
            keys: [{ ...publicKey.export({ format: "jwk" }), kid, alg: "ES256", use: "sig" }],
          }),
        );
      }
      if (url.includes("/rest/v1/profiles?")) {
        return new Response(JSON.stringify({ role: "admin", display_name: "Test admin", author: null }));
      }
      throw new Error("Unexpected request in offline verifier test");
    });
    vi.stubGlobal("fetch", fetch);
    const verifier = createSupabaseVerifier({
      url: "https://signature-test.supabase.co",
      publishableKey: "sb_publishable_test",
    });
    // Same valid-looking header and signature, but a modified subject.
    const forged = `${part({ alg: "ES256", kid, typ: "JWT" })}.${part({ ...claims, sub: "another-user" })}.${signature}`;
    await expect(verifier.verify(forged)).resolves.toBeNull();
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/rest/v1/"))).toBe(false);
    await expect(verifier.verify(token)).resolves.toMatchObject({ auth: { userId: sub, role: "admin" } });
    expect(fetch.mock.calls.filter(([url]) => String(url).includes("/rest/v1/profiles?"))).toHaveLength(1);
  });
});
