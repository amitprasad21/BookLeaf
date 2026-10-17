// Pure helpers for scripts/check-env.ts. They classify credential values
// without ever returning or printing the values themselves.

export type ValueState = "missing" | "placeholder" | "configured";
export type SupabaseKeyKind = "publishable" | "secret" | "legacy-jwt" | "unknown";

const PLACEHOLDER_MARKERS = ["replace-with", "your-project-ref"];

export function classifyValue(value: string | undefined): ValueState {
  if (value === undefined || value.trim() === "") return "missing";
  if (PLACEHOLDER_MARKERS.some((marker) => value.includes(marker))) return "placeholder";
  return "configured";
}

export function supabaseKeyKind(value: string): SupabaseKeyKind {
  if (value.startsWith("sb_publishable_")) return "publishable";
  if (value.startsWith("sb_secret_")) return "secret";
  if (value.startsWith("eyJ")) return "legacy-jwt";
  return "unknown";
}

/** True when the value looks like https://<project-ref>.supabase.co (no path). */
export function isSupabaseProjectUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co") && url.pathname === "/";
  } catch {
    return false;
  }
}

/** Minimal KEY=VALUE parser for .env files (comments and blank lines ignored). */
export function parseEnvFile(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && (value.startsWith('"') || value.startsWith("'")) && value.endsWith(value[0]!)) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/**
 * Names of entries in a browser-exposed env file that look like server secrets:
 * a value equal to the backend secret key, any sb_secret_ value, or a SECRET/
 * SERVICE_ROLE variable name. Returns variable names only.
 */
export function leakedSecretNames(frontendEnv: Record<string, string>, backendSecret?: string): string[] {
  return Object.entries(frontendEnv)
    .filter(
      ([name, value]) =>
        (backendSecret !== undefined && backendSecret !== "" && value === backendSecret) ||
        value.startsWith("sb_secret_") ||
        /SECRET|SERVICE_ROLE/i.test(name),
    )
    .map(([name]) => name);
}
