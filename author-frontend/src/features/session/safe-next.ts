/** Where to go after sign-in: only same-site paths, never back to /login or to another origin. */
export function safeNextPath(value: string | null | undefined, fallback = "/books"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/login/")) return fallback;
  return value;
}
