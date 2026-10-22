// Placeholder origin for parsing; only its identity matters.
const SAME_SITE = "https://portal.invalid";

/**
 * Where to go after sign-in: only same-site paths, never back to /login or to
 * another origin. The value is parsed the way the router will parse it, so
 * "//host", "/\host" and "/<tab>/host" (the URL parser drops tabs and
 * newlines) all count as other origins.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/tickets"): string {
  if (!value || !value.startsWith("/")) return fallback;
  let url: URL;
  try {
    url = new URL(value, SAME_SITE);
  } catch {
    return fallback;
  }
  if (url.origin !== SAME_SITE) return fallback;
  // Removing dot segments can produce "//host". The router would parse that
  // returned string again as an external URL, even though the first parse was same-origin.
  if (url.pathname.startsWith("//")) return fallback;
  if (url.pathname === "/login" || url.pathname.startsWith("/login/")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
