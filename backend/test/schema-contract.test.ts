// Keeps the three copies of the contract in step: Postgres enums/checks in the
// migration, the constants in @bookleaf/shared, and openapi.yaml. Runs offline
// against the SQL text, so it needs no database.
import { readFileSync } from "node:fs";
import {
  AI_STATUSES,
  AI_UNAVAILABLE_REASONS,
  ERROR_CODES,
  ROLES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  VALUE_SOURCES,
} from "@bookleaf/shared";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const repoFile = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const migration = repoFile("supabase/migrations/20261017090000_initial_schema.sql");
const spec = parse(repoFile("openapi.yaml")) as {
  components: { schemas: Record<string, { enum?: string[]; properties?: Record<string, unknown> }> };
};

const quotedValues = (list: string): string[] =>
  [...list.matchAll(/'([^']+)'/g)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));

function sqlEnum(name: string): string[] {
  const match = migration.match(new RegExp(`create type public\\.${name} as enum \\(([^)]*)\\)`));
  if (!match) throw new Error(`enum ${name} not found in migration`);
  return quotedValues(match[1]!);
}

function sqlCheckList(column: string): string[] {
  const match = migration.match(new RegExp(`${column} in \\(([^)]*)\\)`));
  if (!match) throw new Error(`check list for ${column} not found in migration`);
  return quotedValues(match[1]!);
}

const openApiEnum = (schema: string) => spec.components.schemas[schema]?.enum;

describe("schema contract: migration ↔ @bookleaf/shared ↔ openapi.yaml", () => {
  it.each([
    ["user_role", "Role", ROLES],
    ["ticket_status", "TicketStatus", TICKET_STATUSES],
    ["ticket_category", "TicketCategory", TICKET_CATEGORIES],
    ["ticket_priority", "TicketPriority", TICKET_PRIORITIES],
    ["ai_status", "AiStatus", AI_STATUSES],
    ["value_source", "ValueSource", VALUE_SOURCES],
  ])("enum %s matches shared and OpenAPI %s", (sqlName, openApiName, shared) => {
    expect(sqlEnum(sqlName)).toEqual([...shared]);
    expect(openApiEnum(openApiName)).toEqual([...shared]);
  });

  it("AI failure reasons in the tickets check match the shared AI_UNAVAILABLE reasons", () => {
    expect(sqlCheckList("ai_failure_reason")).toEqual([...AI_UNAVAILABLE_REASONS]);
  });

  it("OpenAPI error codes match the shared error codes", () => {
    const errorSchema = spec.components.schemas.ErrorResponse?.properties?.error as {
      properties: { code: { enum: string[] } };
    };
    expect(errorSchema.properties.code.enum).toEqual([...ERROR_CODES]);
  });

  it("enables row level security on every table it creates", () => {
    const created = [...migration.matchAll(/create table public\.(\w+)/g)].map((match) => match[1]);
    const secured = [...migration.matchAll(/alter table public\.(\w+)\s+enable row level security/g)].map(
      (match) => match[1],
    );
    expect(created.length).toBeGreaterThan(0);
    expect(secured.sort()).toEqual(created.sort());
  });

  it("revokes all access from the anon role", () => {
    expect(migration).toMatch(/revoke all on all tables in schema public from anon;/);
  });
});
