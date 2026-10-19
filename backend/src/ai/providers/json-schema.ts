import { z, type ZodType } from "zod";

/**
 * JSON Schema for a provider's structured-output mode, generated from the
 * zod output contract (one source of truth). Strict objects become
 * `additionalProperties: false`; every property should be required, with
 * nullable types for optional values (Groq strict mode requires this).
 */
export function toProviderJsonSchema(schema: ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { io: "output" }) as Record<string, unknown>;
  delete json.$schema; // providers reject or ignore the meta-schema URI
  return json;
}

/** Parse model text as JSON and validate it against the contract. */
export function parseStructured<T>(schema: ZodType<T>, text: string): { ok: true; value: T } | { ok: false } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false };
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}
