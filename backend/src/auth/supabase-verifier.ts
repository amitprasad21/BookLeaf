import type { Role } from "@bookleaf/shared";
import { createUserClient, type SupabaseProject } from "../db/user-client.js";
import { ForbiddenError } from "../lib/errors.js";
import type { AuthVerifier, AuthorSummary } from "./types.js";

interface ProfileRow {
  role: Role;
  display_name: string;
  author: { author_id: string; name: string; city: string | null; joined_date: string } | null;
}

// The project signs with asymmetric keys (D-022). For a token that claims a
// symmetric algorithm or has no key id, getClaims() would ask Supabase Auth
// over the network, so anyone could make every junk request cost a round
// trip. Such tokens are refused here instead (D-035).
const ASYMMETRIC_ALGORITHMS = new Set(["ES256", "RS256"]);

export function hasAsymmetricHeader(token: string): boolean {
  try {
    const header: unknown = JSON.parse(Buffer.from(token.split(".")[0] ?? "", "base64url").toString("utf8"));
    if (typeof header !== "object" || header === null) return false;
    const { alg, kid } = header as { alg?: unknown; kid?: unknown };
    return typeof alg === "string" && ASYMMETRIC_ALGORITHMS.has(alg) && typeof kid === "string" && kid !== "";
  } catch {
    return false;
  }
}

/**
 * Production verifier. auth.getClaims() checks the JWT signature locally
 * against the project's JWKS and rejects expired tokens. The profile and
 * author summary are then read through the caller's own RLS-scoped client in
 * a single query.
 */
export function createSupabaseVerifier(project: SupabaseProject): AuthVerifier {
  return {
    async verify(token) {
      if (!hasAsymmetricHeader(token)) return null;
      const db = createUserClient(project, token);

      const { data, error } = await db.auth.getClaims(token);
      if (error) {
        // Bad or expired token -> 401. Supabase unreachable or failing -> 500.
        if (error.name === "AuthRetryableFetchError" || (error.status ?? 0) >= 500) {
          throw new Error(`token verification unavailable (${error.name})`);
        }
        return null;
      }
      const sub = data?.claims.sub;
      if (typeof sub !== "string" || data?.claims.role !== "authenticated") return null;

      const { data: profile, error: profileError } = await db
        .from("profiles")
        .select("role, display_name, author:authors(author_id, name, city, joined_date)")
        .eq("id", sub)
        .maybeSingle<ProfileRow>();
      if (profileError) throw new Error(`profile lookup failed (${profileError.code})`);
      if (!profile) throw new ForbiddenError("This account doesn't have access to BookLeaf.");

      const author: AuthorSummary | null = profile.author
        ? {
            authorId: profile.author.author_id,
            name: profile.author.name,
            city: profile.author.city,
            joinedDate: profile.author.joined_date,
          }
        : null;
      return { auth: { userId: sub, role: profile.role, displayName: profile.display_name, author }, db };
    },
  };
}
