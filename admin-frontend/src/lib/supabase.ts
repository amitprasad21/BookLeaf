// Browser Supabase client: URL + publishable key only, used for sign-in and
// the session. All data goes through the BookLeaf API (api-client.ts).
// Trade-off (FRONTEND_ARCHITECTURE.md section 4): supabase-js keeps the session
// in localStorage; CSP and plain-text rendering limit what XSS could reach.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicConfig } from "./config";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const config = publicConfig();
    client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "bookleaf-admin-auth",
      },
    });
  }
  return client;
}
