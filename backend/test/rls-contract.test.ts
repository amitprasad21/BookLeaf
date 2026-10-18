// Offline checks on the RLS migration text. The behavioural proof is the live
// suite in test-integration/rls.test.ts (npm run test:rls).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const schema = read("supabase/migrations/20261017090000_initial_schema.sql");
const rls = read("supabase/migrations/20261017120000_rls_policies.sql");

const tables = [...schema.matchAll(/create table public\.(\w+)/g)].map((match) => match[1]);
const policies = [...rls.matchAll(/create policy (\w+) on public\.(\w+)\s+for (\w+) to (\w+)/g)].map(
  ([, name, table, command, role]) => ({ name, table, command, role }),
);

describe("RLS migration contract", () => {
  it("gives every table at least a select policy", () => {
    for (const table of tables) {
      expect(
        policies.some((policy) => policy.table === table && policy.command === "select"),
        `${table} has no select policy`,
      ).toBe(true);
    }
  });

  it("grants policies to the authenticated role only, never anon or public", () => {
    expect(policies.length).toBeGreaterThan(0);
    expect(new Set(policies.map((policy) => policy.role))).toEqual(new Set(["authenticated"]));
  });

  it("has no update or delete policies for authors on tickets, and no delete policies at all", () => {
    expect(policies.filter((policy) => policy.command === "delete")).toEqual([]);
    expect(policies.filter((policy) => policy.table === "tickets" && policy.command === "update")).toEqual([
      { name: "tickets_admin_update", table: "tickets", command: "update", role: "authenticated" },
    ]);
  });

  it("revokes TRUNCATE (which ignores RLS) and DELETE from client roles", () => {
    expect(rls).toMatch(
      /revoke truncate, references, trigger on all tables in schema public from authenticated;/,
    );
    expect(rls).toMatch(/revoke delete on all tables in schema public from authenticated;/);
  });

  it("keeps security-definer helpers in the private schema with a pinned search_path", () => {
    const helpers = [...rls.matchAll(/create function (\S+)\(\)[\s\S]*?\$\$;/g)].map((match) => match[0]);
    expect(helpers.length).toBe(2);
    for (const helper of helpers) {
      expect(helper).toMatch(/^create function private\./);
      expect(helper).toContain("security definer");
      expect(helper).toContain("set search_path = ''");
    }
  });
});

describe("admin reply function (migration 20261018120000)", () => {
  const fn = read("supabase/migrations/20261018120000_admin_reply_function.sql");

  it("runs as the caller with a fixed search path, so RLS still decides", () => {
    expect(fn).toMatch(/security invoker\s+set search_path = ''/);
    expect(fn).not.toMatch(/security definer/);
  });

  it("checks for an admin, locks the ticket and only replies on open or in-progress tickets", () => {
    expect(fn).toMatch(/if not \(select private\.is_admin\(\)\) then/);
    expect(fn).toMatch(/for update;/);
    expect(fn).toMatch(/if v_status not in \('open', 'in_progress'\) then/);
    expect(fn).toMatch(/values \(p_ticket_id, 'admin', \(select auth\.uid\(\)\), p_body, p_draft_id\)/);
  });

  it("is callable by signed-in users only", () => {
    expect(fn).toMatch(
      /revoke all on function public\.admin_send_reply\(uuid, text, public\.ticket_status, uuid\) from public, anon;/,
    );
    expect(fn).toMatch(
      /grant execute on function public\.admin_send_reply\(uuid, text, public\.ticket_status, uuid\) to authenticated;/,
    );
  });
});
