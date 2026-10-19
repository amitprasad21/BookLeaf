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
  return withoutConstraints(json) as Record<string, unknown>;
}

// Strict structured-output modes accept different subsets of JSON Schema, and
// a keyword one provider rejects fails the whole request. Providers get the
// shape (types, enums, required, nesting, descriptions); length, range and
// count limits are enforced by the zod contract after parsing (parseStructured).
const CONSTRAINT_KEYWORDS = new Set([
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minItems",
  "maxItems",
  "uniqueItems",
  "pattern",
  "format",
  "default",
]);

function withoutConstraints(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withoutConstraints);
  if (node === null || typeof node !== "object") return node;
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => !CONSTRAINT_KEYWORDS.has(key))
      .map(([key, value]) => [
        key,
        key === "properties" || key === "$defs" ? mapValues(value) : withoutConstraints(value),
      ]),
  );
}

/** Property maps hold names, not keywords: keep every key and clean each schema. */
function mapValues(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([name, schema]) => [name, withoutConstraints(schema)]),
  );
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
