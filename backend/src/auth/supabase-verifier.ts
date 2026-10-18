import type { Role } from "@bookleaf/shared";
import { createUserClient, type SupabaseProject } from "../db/user-client.js";
import { ForbiddenError } from "../lib/errors.js";
import type { AuthVerifier, AuthorSummary } from "./types.js";

interface ProfileRow {
  role: Role;
  display_name: string;
  author: { author_id: string; name: string; city: string | null; joined_date: string } | null;
}

/**
 * Production verifier. auth.getClaims() checks the JWT signature locally
 * against the project's JWKS (asymmetric signing keys) or asks Supabase Auth
 * (legacy symmetric secret), and rejects expired tokens. The profile and
 * author summary are then read through the caller's own RLS-scoped client in
 * a single query.
 */
export function createSupabaseVerifier(project: SupabaseProject): AuthVerifier {
  return {
    async verify(token) {
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
