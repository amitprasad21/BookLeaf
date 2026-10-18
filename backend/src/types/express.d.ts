import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "../auth/types.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by middleware/request-id.ts; echoed in X-Request-Id and every error body. */
      requestId: string;
      /** Set by middleware/authenticate.ts on every /api/v1 route except health. */
      auth?: AuthContext;
      /** Request-scoped Supabase client with the caller's JWT (RLS applies). */
      db?: SupabaseClient;
    }
  }
}

export {};
