import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseProject {
  url: string;
  publishableKey: string;
}

/**
 * A Supabase client for one request, sending the caller's access token on
 * every query. Postgres sees the caller as `authenticated` with their own
 * `auth.uid()`, so the DB-3 row level security policies apply even if a
 * backend check is wrong (defense in depth; .back/AUTH_SECURITY.md).
 */
export function createUserClient(project: SupabaseProject, accessToken: string): SupabaseClient {
  return createClient(project.url, project.publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
