import type { Role } from "@bookleaf/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuthorSummary {
  authorId: string;
  name: string;
  city: string | null;
  joinedDate: string;
}

/** Who is calling. Derived only from the verified token and the profiles table, never from the request. */
export interface AuthContext {
  userId: string;
  role: Role;
  displayName: string;
  author: AuthorSummary | null;
}

export interface VerifiedAuth {
  auth: AuthContext;
  /** Request-scoped Supabase client carrying the caller's JWT, so RLS applies to every query. */
  db: SupabaseClient;
}

/**
 * Verifies a bearer token and loads the caller's profile.
 * Returns null for a missing, malformed, expired or forged token (-> 401).
 * Throws ForbiddenError for a valid user without a BookLeaf profile (-> 403),
 * and a plain Error when Supabase itself can't be reached (-> 500).
 */
export interface AuthVerifier {
  verify(token: string): Promise<VerifiedAuth | null>;
}
