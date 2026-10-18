import { readFileSync } from "node:fs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  createAdminTicketsRepository,
  type AdminQueueRow,
  type AdminTicketsRepository,
  type QueueSummaryCounts,
} from "../src/modules/tickets/admin-repository.js";
import { recordingSupabase, type BuilderCall } from "./fakes.js";
import { ADMIN_CONTEXT, TEST_TOKENS, bearer, buildTestApp, fixedClock } from "./helpers.js";

const spec = parse(readFileSync(new URL("../../openapi.yaml", import.meta.url), "utf8")) as {
  components: { schemas: Record<string, { properties?: Record<string, unknown> }> };
};

const AS_ADMIN = bearer(TEST_TOKENS.admin);
const clock = fixedClock("2026-10-18"); // 2026-10-18T06:30:00Z
const NOW = clock();
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

const row = (overrides: Partial<AdminQueueRow> = {}): AdminQueueRow => ({
  id: "6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c0001",
  reference: "BL-1001",
  subject: "Royalty for Q3 not received",
  status: "open",
  category: "royalty_payments",
  category_source: "ai",
  priority: "critical",
  priority_source: "admin",
  ai_status: "completed",
  created_at: hoursAgo(3.5),
  updated_at: hoursAgo(3.5),
  first_response_at: null,
  version: 2,
  author: { author_id: "AUTH001", name: "Priya Sharma" },
  book: { book_id: "BK001", title: "Whispers of the Ganges" },
  assigned_admin: { id: ADMIN_CONTEXT.userId, display_name: "Ops Admin" },
  ...overrides,
});

const SUMMARY: QueueSummaryCounts = {
  open: 4,
  inProgress: 3,
  resolved: 9,
  closed: 1,
  unassigned: 2,
  critical: 1,
  high: 2,
  slaBreached: 1,
  needsManualTriage: 1,
};

const notUsed = async (): Promise<never> => {
  throw new Error("not used by the queue routes");
};

/** Records what the routes ask the repository for and returns canned data. */
function recordingAdminRepository(rows: AdminQueueRow[] = [row()], options: { fail?: boolean } = {}) {
  const listCalls: Parameters<AdminTicketsRepository["listQueue"]>[] = [];
  const summaryCalls: Date[] = [];
  const repository: AdminTicketsRepository = {
    async listQueue(query, context) {
      listCalls.push([query, context]);
      if (options.fail) throw new Error("ticket queue failed (XX000)");
      return { rows, total: 42 };
    },
    async summary(now) {
      summaryCalls.push(now);
      if (options.fail) throw new Error("queue summary failed (XX000)");
      return SUMMARY;
    },
    // Ticket detail and updates are covered in admin-ticket.test.ts.
    findTicket: notUsed,
    findDetail: notUsed,
    updateIfVersion: notUsed,
  };
  return { factory: () => repository, listCalls, summaryCalls };
}

function setup(rows?: AdminQueueRow[], options?: { fail?: boolean }) {
  const repo = recordingAdminRepository(rows, options);
  const app = buildTestApp({ clock, adminTicketsRepository: repo.factory });
  return { app, repo };
}

const getQueue = (app: ReturnType<typeof setup>["app"], query = "") =>
  request(app).get(`/api/v1/admin/tickets${query}`).set("Authorization", AS_ADMIN);

describe("GET /api/v1/admin/tickets", () => {
  it("returns queue items with a computed slaState, paging meta and the default query", async () => {
    const { app, repo } = setup();
    const res = await getQueue(app);

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 25, total: 42 });
    expect(res.body.data).toEqual([
      {
        id: "6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c0001",
        reference: "BL-1001",
        subject: "Royalty for Q3 not received",
        author: { authorId: "AUTH001", name: "Priya Sharma" },
        book: { bookId: "BK001", title: "Whispers of the Ganges" },
        status: "open",
        category: "royalty_payments",
        categorySource: "ai",
        priority: "critical",
        prioritySource: "admin",
        aiStatus: "completed",
        assignedAdmin: { userId: ADMIN_CONTEXT.userId, displayName: "Ops Admin" },
        createdAt: hoursAgo(3.5),
        updatedAt: hoursAgo(3.5),
        firstResponseAt: null,
        slaState: "due_soon", // critical, 30 minutes left of 4 hours
        version: 2,
      },
    ]);
    expect(repo.listCalls).toEqual([
      [
        { page: 1, pageSize: 25, assignee: "any", sort: "urgency" },
        { adminUserId: ADMIN_CONTEXT.userId, now: NOW },
      ],
    ]);
  });

  it("keeps nulls for untriaged, unassigned, general tickets", async () => {
    const { app } = setup([
      row({
        priority: null,
        priority_source: null,
        category: null,
        category_source: null,
        book: null,
        assigned_admin: null,
        ai_status: "manual_review_required",
        created_at: hoursAgo(30),
      }),
    ]);
    const [item] = (await getQueue(app)).body.data;
    expect(item).toMatchObject({
      priority: null,
      prioritySource: null,
      category: null,
      categorySource: null,
      book: null,
      assignedAdmin: null,
      aiStatus: "manual_review_required",
      slaState: "breached", // untriaged counts as High: 24 h
    });
  });

  it("parses every filter: comma lists (deduplicated), dates, overdue, search and sort", async () => {
    const { app, repo } = setup();
    const res = await getQueue(
      app,
      "?status=open,in_progress,open&category=royalty_payments&priority=critical,untriaged" +
        "&assignee=me&aiStatus=manual_review_required&overdue=true&createdFrom=2026-10-01" +
        "&createdTo=2026-10-18&q=" +
        encodeURIComponent('  BL-1001, (Priya) "x" %_* ') +
        "&sort=-updated_at&page=2&pageSize=10&cacheBust=1",
    );
    expect(res.status).toBe(200);
    expect(repo.listCalls[0]![0]).toEqual({
      status: ["open", "in_progress"],
      category: ["royalty_payments"],
      priority: ["critical", "untriaged"],
      assignee: "me",
      aiStatus: "manual_review_required",
      overdue: true,
      createdFrom: "2026-10-01",
      createdTo: "2026-10-18",
      q: "BL-1001 Priya x", // filter-syntax characters become spaces
      sort: "-updated_at",
      page: 2,
      pageSize: 10,
    });
    expect(res.body.meta).toMatchObject({ page: 2, pageSize: 10 });
  });

  it("drops a search that has nothing searchable left", async () => {
    const { app, repo } = setup();
    await getQueue(app, `?q=${encodeURIComponent(' %*(),"\\ ')}`);
    expect(repo.listCalls[0]![0].q).toBeUndefined();
  });

  it("rejects invalid filters with field-level details", async () => {
    const { app, repo } = setup();
    const cases: [string, string][] = [
      ["?status=urgent", "status"],
      ["?category=royalties", "category"],
      ["?priority=urgent", "priority"],
      ["?assignee=bob", "assignee"],
      ["?aiStatus=done", "aiStatus"],
      ["?overdue=false", "overdue"],
      ["?createdFrom=2026-13-01", "createdFrom"],
      ["?createdFrom=2026-10-18&createdTo=2026-10-01", "createdTo"],
      [`?q=${"x".repeat(101)}`, "q"],
      ["?sort=priority", "sort"],
      ["?pageSize=500", "pageSize"],
    ];
    for (const [query, path] of cases) {
      const res = await getQueue(app, query);
      expect(res.status, query).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
      // List items are named by position, e.g. "status.0".
      const paths = res.body.error.details.map((detail: { path: string }) => detail.path.split(".")[0]);
      expect(paths, query).toContain(path);
    }
    expect(repo.listCalls).toHaveLength(0);
  });

  it("is admin-only", async () => {
    const { app, repo } = setup();
    for (const path of ["/api/v1/admin/tickets", "/api/v1/admin/tickets/summary"]) {
      const res = await request(app).get(path).set("Authorization", bearer(TEST_TOKENS.author));
      expect(res.status, path).toBe(403);
    }
    expect(repo.listCalls).toHaveLength(0);
    expect(repo.summaryCalls).toHaveLength(0);
  });

  it("turns a database failure into a generic 500", async () => {
    const { app } = setup(undefined, { fail: true });
    const res = await getQueue(app);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("XX000");
  });
});

describe("GET /api/v1/admin/tickets/summary", () => {
  it("returns the queue counts computed at the clock's time", async () => {
    const { app, repo } = setup();
    const res = await request(app).get("/api/v1/admin/tickets/summary").set("Authorization", AS_ADMIN);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: SUMMARY });
    expect(repo.summaryCalls).toEqual([NOW]);
  });
});

describe("admin queue contract", () => {
  const props = (schema: string) => Object.keys(spec.components.schemas[schema]?.properties ?? {}).sort();

  it("queue item and summary keys match openapi.yaml exactly", async () => {
    const { app } = setup();
    const list = await getQueue(app);
    const summary = await request(app).get("/api/v1/admin/tickets/summary").set("Authorization", AS_ADMIN);
    expect(Object.keys(list.body.data[0]).sort()).toEqual(props("AdminQueueItem"));
    expect(Object.keys(summary.body.data).sort()).toEqual(props("QueueSummary"));
  });
});

describe("Supabase admin repository (recorded queries)", () => {
  const CONTEXT = { adminUserId: ADMIN_CONTEXT.userId, now: NOW };
  const baseQuery = { page: 1, pageSize: 25, assignee: "any", sort: "urgency" } as const;
  const ticketCalls = async (query: object, authors: string[] = []) => {
    const { db, queries } = recordingSupabase({
      authors: { data: authors.map((author_id) => ({ author_id })) },
    });
    await createAdminTicketsRepository(db).listQueue({ ...baseQuery, ...query }, CONTEXT);
    return {
      tickets: queries.find((query) => query.table === "tickets")!.calls,
      authors: queries.find((query) => query.table === "authors")?.calls,
    };
  };
  const filters = (calls: BuilderCall[]) =>
    calls.filter(([method]) => !["select", "order", "range"].includes(method));

  it("sorts by urgency rank, then oldest, then id, and pages in the database", async () => {
    const { tickets } = await ticketCalls({ page: 3, pageSize: 10 });
    expect(tickets[0]![0]).toBe("select");
    expect(tickets[0]![2]).toEqual({ count: "exact" });
    expect(tickets.filter(([method]) => method !== "select")).toEqual([
      ["order", "urgency_rank"],
      ["order", "created_at"],
      ["order", "id"],
      ["range", 20, 29],
    ]);
  });

  it.each([
    ["created_at", [["order", "created_at"]]],
    ["-created_at", [["order", "created_at", { ascending: false }]]],
    ["-updated_at", [["order", "updated_at", { ascending: false }]]],
  ])("sort=%s", async (sort, expected) => {
    const { tickets } = await ticketCalls({ sort });
    expect(tickets.filter(([method]) => method === "order")).toEqual([...expected, ["order", "id"]]);
  });

  it("names the author and assignee relationships explicitly", async () => {
    const { tickets } = await ticketCalls({});
    const columns = tickets[0]![1] as string;
    expect(columns).toContain("author:authors!tickets_author_id_fkey(author_id, name)");
    expect(columns).toContain("assigned_admin:profiles!tickets_assigned_admin_id_fkey(id, display_name)");
    expect(columns).not.toMatch(/description|ai_rationale|ai_signals/);
  });

  it("maps priority filters, including untriaged (no priority yet)", async () => {
    expect(filters((await ticketCalls({ priority: ["critical", "high"] })).tickets)).toEqual([
      ["in", "priority", ["critical", "high"]],
    ]);
    expect(filters((await ticketCalls({ priority: ["untriaged"] })).tickets)).toEqual([
      ["is", "priority", null],
    ]);
    expect(filters((await ticketCalls({ priority: ["critical", "untriaged"] })).tickets)).toEqual([
      ["or", "priority.in.(critical),priority.is.null"],
    ]);
  });

  it("maps status, category, assignee and AI status filters", async () => {
    const { tickets } = await ticketCalls({
      status: ["open"],
      category: ["isbn_metadata"],
      assignee: "me",
      aiStatus: "failed",
    });
    expect(filters(tickets)).toEqual([
      ["in", "status", ["open"]],
      ["in", "category", ["isbn_metadata"]],
      ["eq", "assigned_admin_id", ADMIN_CONTEXT.userId],
      ["eq", "ai_status", "failed"],
    ]);
    expect(filters((await ticketCalls({ assignee: "unassigned" })).tickets)).toEqual([
      ["is", "assigned_admin_id", null],
    ]);
  });

  it("treats created dates as whole India business days", async () => {
    const { tickets } = await ticketCalls({ createdFrom: "2026-10-01", createdTo: "2026-10-18" });
    expect(filters(tickets)).toEqual([
      ["gte", "created_at", "2026-09-30T18:30:00.000Z"],
      ["lt", "created_at", "2026-10-18T18:30:00.000Z"],
    ]);
  });

  it("overdue = unresolved, no first reply, created before the priority's cut-off", async () => {
    const { tickets } = await ticketCalls({ overdue: true });
    expect(filters(tickets)).toEqual([
      ["in", "status", ["open", "in_progress"]],
      ["is", "first_response_at", null],
      [
        "or",
        [
          `and(priority.eq.critical,created_at.lt."${hoursAgo(4)}")`,
          `and(priority.eq.high,created_at.lt."${hoursAgo(24)}")`,
          `and(priority.is.null,created_at.lt."${hoursAgo(24)}")`,
          `and(priority.eq.medium,created_at.lt."${hoursAgo(48)}")`,
          `and(priority.eq.low,created_at.lt."${hoursAgo(72)}")`,
        ].join(","),
      ],
    ]);
  });

  it("searches reference and subject (quoted) plus the ids of authors whose name matches", async () => {
    const withAuthors = await ticketCalls({ q: "Priya" }, ["AUTH001"]);
    expect(withAuthors.authors).toEqual([
      ["select", "author_id"],
      ["ilike", "name", "%Priya%"],
      ["limit", 100],
    ]);
    expect(filters(withAuthors.tickets)).toEqual([
      ["or", 'reference.ilike."*Priya*",subject.ilike."*Priya*",author_id.in.(AUTH001)'],
    ]);

    const noAuthors = await ticketCalls({ q: "BL-1001" });
    expect(filters(noAuthors.tickets)).toEqual([
      ["or", 'reference.ilike."*BL-1001*",subject.ilike."*BL-1001*"'],
    ]);
  });

  it("summary runs nine head-only counts and maps them in order", async () => {
    const { db, queries } = recordingSupabase({ tickets: (_calls, index) => ({ count: index + 1 }) });
    const summary = await createAdminTicketsRepository(db).summary(NOW);

    expect(summary).toEqual({
      open: 1,
      inProgress: 2,
      resolved: 3,
      closed: 4,
      unassigned: 5,
      critical: 6,
      high: 7,
      slaBreached: 8,
      needsManualTriage: 9,
    });
    expect(queries.every((query) => query.calls[0]![2] !== undefined)).toBe(true);
    expect(queries.map((query) => query.calls[0]![2])).toEqual(Array(9).fill({ count: "exact", head: true }));
    const unresolved = ["in", "status", ["open", "in_progress"]];
    expect(queries.map((query) => filters(query.calls))).toEqual([
      [["eq", "status", "open"]],
      [["eq", "status", "in_progress"]],
      [["eq", "status", "resolved"]],
      [["eq", "status", "closed"]],
      [unresolved, ["is", "assigned_admin_id", null]],
      [unresolved, ["eq", "priority", "critical"]],
      [unresolved, ["eq", "priority", "high"]],
      [
        unresolved,
        ["is", "first_response_at", null],
        ["or", expect.stringContaining("priority.eq.critical")],
      ],
      [unresolved, ["eq", "ai_status", "manual_review_required"]],
    ]);
  });
});
