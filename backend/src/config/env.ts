// The only place that reads process.env. Validates at startup and fails fast,
// naming missing or invalid variables but never printing their values.
import { z } from "zod";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
const DEV_ORIGINS = ["http://localhost:3000", "http://localhost:3001"];

function isOrigin(value: string): boolean {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

const OriginList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .refine((origins) => origins.length > 0 && origins.every(isOrigin), {
    message: "must be a comma-separated list of exact origins, e.g. https://app.example.com",
  });

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
    CORS_ALLOWED_ORIGINS: OriginList.optional(),
    // Public project values; the backend uses them to verify tokens and to
    // build request-scoped clients that carry the caller's JWT (RLS applies).
    SUPABASE_URL: z.url({ protocol: /^https$/ }).optional(),
    SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.CORS_ALLOWED_ORIGINS) {
      ctx.addIssue({ code: "custom", path: ["CORS_ALLOWED_ORIGINS"], message: "is required in production" });
    }
    // Tests inject a fake token verifier; every real runtime needs Supabase.
    if (env.NODE_ENV !== "test") {
      for (const name of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"] as const) {
        if (!env[name]) ctx.addIssue({ code: "custom", path: [name], message: "is required" });
      }
    }
  })
  .transform((env) => ({
    ...env,
    LOG_LEVEL: env.LOG_LEVEL ?? (env.NODE_ENV === "test" ? "silent" : "info"),
    CORS_ALLOWED_ORIGINS: env.CORS_ALLOWED_ORIGINS ?? DEV_ORIGINS,
  }));

export type Env = z.output<typeof EnvSchema>;
export type LogLevel = Env["LOG_LEVEL"];

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid environment configuration: ${names.join(", ")}`);
  }
  return parsed.data;
}
