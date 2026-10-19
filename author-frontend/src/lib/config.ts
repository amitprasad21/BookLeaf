// Public browser configuration, inlined by Next.js at build time. Only the
// Supabase URL, the publishable key and the API base URL: no secrets.
// Read lazily so a build without them fails on use, not on import.

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set. Copy the variable names from .env.example.`);
  return value;
}

export function publicConfig() {
  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabasePublishableKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
    /** Includes the version prefix, e.g. http://localhost:4000/api/v1 */
    apiBaseUrl: required("NEXT_PUBLIC_API_BASE_URL", process.env.NEXT_PUBLIC_API_BASE_URL).replace(
      /\/+$/,
      "",
    ),
  };
}
