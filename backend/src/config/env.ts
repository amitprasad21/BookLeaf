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

export const AI_PROVIDERS = ["gemini", "groq", "mock", "none"] as const;
/** Which key each real provider needs (keys are never printed). */
export const AI_PROVIDER_KEYS = { gemini: "GEMINI_API_KEY", groq: "GROQ_API_KEY" } as const;

/** Empty values and the .env.example placeholders count as "not set". */
const optionalSetting = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && (value.trim() === "" || value.startsWith("replace-with"))
        ? undefined
        : value,
    schema.optional(),
  );

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
    // Server-only, bypasses RLS: used solely by db/system-writer.ts.
    SUPABASE_SECRET_KEY: z.string().min(1).optional(),

    // AI (AI_SPEC.md, .back/AI_PROVIDER_ORCHESTRATION.md section 9, D-028).
    AI_PRIMARY_PROVIDER: optionalSetting(z.enum(AI_PROVIDERS)),
    /** Model for triage (and drafts unless AI_PRIMARY_DRAFT_MODEL is set); default per provider. */
    AI_PRIMARY_MODEL: optionalSetting(z.string().min(1)),
    AI_PRIMARY_DRAFT_MODEL: optionalSetting(z.string().min(1)),
    AI_FALLBACK_PROVIDER: optionalSetting(z.enum(["gemini", "groq", "mock"])),
    AI_FALLBACK_MODEL: optionalSetting(z.string().min(1)),
    AI_FALLBACK_DRAFT_MODEL: optionalSetting(z.string().min(1)),
    GEMINI_API_KEY: optionalSetting(z.string().min(1)),
    GROQ_API_KEY: optionalSetting(z.string().min(1)),
    AI_DAILY_TOKEN_BUDGET: optionalSetting(z.coerce.number().int().min(0)).default(300_000),
    // Triage runs in the background; free-tier Flash-Lite took 8-13 s per call (D-029).
    AI_TRIAGE_TIMEOUT_MS: optionalSetting(z.coerce.number().int().min(1_000)).default(30_000),
    AI_DRAFT_TIMEOUT_MS: optionalSetting(z.coerce.number().int().min(1_000)).default(30_000),
    AI_MAX_RETRIES: optionalSetting(z.coerce.number().int().min(0).max(5)).default(2),
    AI_CIRCUIT_FAILURE_THRESHOLD: optionalSetting(z.coerce.number().int().min(1)).default(3),
    AI_CIRCUIT_COOLDOWN_MS: optionalSetting(z.coerce.number().int().min(1_000)).default(60_000),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.CORS_ALLOWED_ORIGINS) {
      ctx.addIssue({ code: "custom", path: ["CORS_ALLOWED_ORIGINS"], message: "is required in production" });
    }
    // Tests inject fakes; every real runtime needs Supabase.
    if (env.NODE_ENV !== "test") {
      for (const name of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"] as const) {
        if (!env[name]) ctx.addIssue({ code: "custom", path: [name], message: "is required" });
      }
    }
    // Production chooses its AI provider explicitly, and never the mock.
    if (env.NODE_ENV === "production" && (!env.AI_PRIMARY_PROVIDER || env.AI_PRIMARY_PROVIDER === "mock")) {
      ctx.addIssue({
        code: "custom",
        path: ["AI_PRIMARY_PROVIDER"],
        message: "must be gemini, groq or none in production",
      });
    }
    // A fallback is a different provider with its own key, never a second key for the same one (C-14).
    if (env.AI_FALLBACK_PROVIDER && env.AI_FALLBACK_PROVIDER === env.AI_PRIMARY_PROVIDER) {
      ctx.addIssue({
        code: "custom",
        path: ["AI_FALLBACK_PROVIDER"],
        message: "must differ from AI_PRIMARY_PROVIDER",
      });
    }
    if (env.NODE_ENV !== "test") {
      for (const provider of [env.AI_PRIMARY_PROVIDER, env.AI_FALLBACK_PROVIDER]) {
        const key = provider === "gemini" || provider === "groq" ? AI_PROVIDER_KEYS[provider] : null;
        if (key && !env[key])
          ctx.addIssue({ code: "custom", path: [key], message: `is required for ${provider}` });
      }
    }
  })
  .transform((env) => ({
    ...env,
    LOG_LEVEL: env.LOG_LEVEL ?? (env.NODE_ENV === "test" ? "silent" : "info"),
    CORS_ALLOWED_ORIGINS: env.CORS_ALLOWED_ORIGINS ?? DEV_ORIGINS,
    AI_PRIMARY_PROVIDER: env.AI_PRIMARY_PROVIDER ?? "mock",
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
