import { readFileSync } from "node:fs";
import { STATUS_TRANSITIONS, TICKET_STATUSES, type UpdateTicketRequest } from "@bookleaf/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { SeedDataSchema, toBookRows } from "../scripts/seed-data.js";
import { InvalidAssignmentError, InvalidTransitionError } from "../src/lib/errors.js";
import type {
  AdminTicketDetailRows,
  AdminTicketRow,
  TicketChanges,
} from "../src/modules/tickets/admin-repository.js";
import { planTicketUpdate } from "../src/modules/tickets/admin-service.js";
import { adminRepository, recordingSystemWriter } from "./fakes.js";
import {
  ADMIN_CONTEXT,
  TEST_TOKENS,
  bearer,
  buildTestApp,
  captureLogger,
  fixedClock,
  settle,
} from "./helpers.js";

const spec = parse(readFileSync(new URL("../../openapi.yaml", import.meta.url), "utf8")) as {
  components: {
    schemas: Record<string, { properties?: Record<string, unknown>; allOf?: { properties?: object }[] }>;
  };
};
const dataset = SeedDataSchema.parse(
  JSON.parse(readFileSync(new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url), "utf8")),
);

const AS_ADMIN = bearer(TEST_TOKENS.admin);
const clock = fixedClock("2026-10-18");
const NOW = clock();
const ME = { id: ADMIN_CONTEXT.userId, display_name: "Ops Admin" };
const LEAD = { id: "00000000-0000-4000-8000-0000000000bb", display_name: "Support Lead" };
const TICKET_ID = "6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c0002";
const AUTHOR_PROFILE = { id: "00000000-0000-4000-8000-000000000001", display_name: "Priya Sharma" };

const ticketRow = (overrides: Partial<AdminTicketRow> = {}): AdminTicketRow => ({
  id: TICKET_ID,
  reference: "BL-1002",
  subject: "Royalty for Q3 not received",
  description: "I haven't received my royalty payment for the last quarter. Could you check?",
  attachment_name: null,
  status: "open",
  category: "royalty_payments",
  category_source: "ai",
  priority: "high",
  priority_source: "ai",
  ai_status: "completed",
  ai_category: "royalty_payments",
  ai_priority: "high",
  ai_confidence: 0.86,
  ai_signals: ["royalty_delay"],
  ai_rationale: "Royalty payment overdue for a published book.",
  ai_policy_floor: null,
  ai_processed_at: "2026-10-18T02:00:05.000Z",
  ai_failure_reason: null,
  created_at: "2026-10-18T02:00:00.000Z",
  updated_at: "2026-10-18T02:00:05.000Z",
  first_response_at: null,
  resolved_at: null,
  closed_at: null,
  version: 3,
  author: { author_id: "AUTH001", name: "Priya Sharma", city: "Mumbai", joined_date: "2023-03-15" },
  book: { book_id: "BK001", title: "Whispers of the Ganges" },
  assigned_admin: null,
  ...overrides,
});

// ------------------------------------------------------------- planning (U-05)

describe("planTicketUpdate", () => {
  const plan = (request: Omit<UpdateTicketRequest, "version">, current: Partial<AdminTicketRow> = {}) =>
    planTicketUpdate(ticketRow(current), { version: 3, ...request }, ME.id, NOW);

  it("allows exactly the transitions in the status machine", () => {
    for (const from of TICKET_STATUSES) {
      for (const to of TICKET_STATUSES) {
        if (from === to) continue;
        const attempt = () => plan({ status: to }, { status: from });
        if (STATUS_TRANSITIONS[from].includes(to)) {
          expect(attempt().changes.status, `${from} -> ${to}`).toBe(to);
        } else {
          expect(attempt, `${from} -> ${to}`).toThrow(InvalidTransitionError);
        }
      }
    }
    expect(STATUS_TRANSITIONS).toEqual({
      open: ["in_progress", "resolved", "closed"],
      in_progress: ["resolved", "closed"],
      resolved: ["in_progress", "closed"],
      closed: ["in_progress"],
    });
  });

  it("stamps resolved_at / closed_at and clears both on reopen", () => {
    expect(plan({ status: "resolved" }).changes).toEqual({
      status: "resolved",
      resolved_at: NOW.toISOString(),
    });
    expect(plan({ status: "closed" }, { status: "resolved" }).changes).toEqual({
      status: "closed",
      closed_at: NOW.toISOString(),
    });
    expect(plan({ status: "in_progress" }, { status: "closed" }).changes).toEqual({
      status: "in_progress",
      resolved_at: null,
      closed_at: null,
    });
    expect(plan({ status: "in_progress" }).changes).toEqual({ status: "in_progress" });
    expect(plan({ status: "closed" }).audit).toEqual([
      { action: "ticket.status_changed", metadata: { from: "open", to: "closed" } },
    ]);
  });

  it("explains a refused transition in words", () => {
    expect(() => plan({ status: "open" }, { status: "closed" })).toThrow(
      "A ticket can't move from Closed to Open.",
    );
  });

  it("overrides category and priority as admin-set, keeping old values and source in the audit", () => {
    const result = plan({ category: "isbn_metadata", priority: "critical" });
    expect(result.changes).toEqual({
      category: "isbn_metadata",
      category_source: "admin",
      priority: "critical",
      priority_source: "admin",
    });
    expect(result.audit).toEqual([
      {
        action: "ticket.category_overridden",
        metadata: { from: "royalty_payments", fromSource: "ai", to: "isbn_metadata" },
      },
      { action: "ticket.priority_overridden", metadata: { from: "high", fromSource: "ai", to: "critical" } },
    ]);
  });

  it("treats confirming the AI's value as an override, but an unchanged admin value as no change", () => {
    expect(plan({ priority: "high" }).changes).toEqual({ priority: "high", priority_source: "admin" });
    expect(plan({ priority: "high" }, { priority_source: "admin" })).toEqual({ changes: {}, audit: [] });
    expect(plan({ category: "general_inquiry" }, { category: null, category_source: null }).audit).toEqual([
      {
        action: "ticket.category_overridden",
        metadata: { from: null, fromSource: null, to: "general_inquiry" },
      },
    ]);
  });

  it("lets admins take an unassigned ticket or release their own, and nothing else (A-16)", () => {
    expect(plan({ assignedAdminId: ME.id })).toEqual({
      changes: { assigned_admin_id: ME.id },
      audit: [{ action: "ticket.assigned", metadata: { adminId: ME.id } }],
    });
    expect(plan({ assignedAdminId: null }, { assigned_admin: ME })).toEqual({
      changes: { assigned_admin_id: null },
      audit: [{ action: "ticket.unassigned", metadata: { adminId: ME.id } }],
    });
    expect(() => plan({ assignedAdminId: LEAD.id })).toThrow(InvalidAssignmentError);
    expect(() => plan({ assignedAdminId: ME.id }, { assigned_admin: LEAD })).toThrow(
      "This ticket is assigned to Support Lead. They need to unassign it first.",
    );
    expect(() => plan({ assignedAdminId: null }, { assigned_admin: LEAD })).toThrow(
      "Only Support Lead can unassign this ticket.",
    );
  });

  it("ignores values equal to the current ones", () => {
    expect(plan({ status: "open" })).toEqual({ changes: {}, audit: [] });
    expect(plan({ assignedAdminId: null })).toEqual({ changes: {}, audit: [] });
    expect(plan({ assignedAdminId: ME.id }, { assigned_admin: ME })).toEqual({ changes: {}, audit: [] });
  });

  it("combines several changes into one update with one audit event each", () => {
    const result = plan({ status: "in_progress", priority: "critical", assignedAdminId: ME.id });
    expect(result.changes).toEqual({
      status: "in_progress",
      priority: "critical",
      priority_source: "admin",
      assigned_admin_id: ME.id,
    });
    expect(result.audit.map((event) => event.action)).toEqual([
      "ticket.status_changed",
      "ticket.priority_overridden",
      "ticket.assigned",
    ]);
  });
});

// ------------------------------------------------------------------ routes

/** In-memory admin ticket store with real version semantics. */
function fakeAdminTicketStore(options: { raceOnUpdate?: boolean } = {}) {
  const admins = new Map([ME, LEAD].map((admin) => [admin.id, admin]));
  const state = {
    ticket: ticketRow(),
    updates: [] as { version: number; changes: TicketChanges }[],
  };
  const detailParts = (): Omit<AdminTicketDetailRows, "ticket"> => ({
    books: toBookRows(dataset).filter((book) => book.author_id === "AUTH001"),
    messages: [
      {
        id: "m1",
        sender_role: "author",
        body: "Any update?",
        created_at: "2026-10-18T03:00:00.000Z",
        sender: { display_name: AUTHOR_PROFILE.display_name },
      },
      {
        id: "m2",
        sender_role: "admin",
        body: "Checking with finance.",
        created_at: "2026-10-18T04:00:00.000Z",
        sender: { display_name: LEAD.display_name },
      },
    ],
    notes: [
      {
        id: "n1",
        body: "Finance ticket FIN-2231 raised.",
        created_at: "2026-10-18T04:05:00.000Z",
        admin: LEAD,
      },
    ],
    timeline: [
      {
        id: "a1",
        action: "ticket.created",
        metadata: { bookId: "BK001" },
        created_at: "2026-10-18T02:00:00.000Z",
        actor: AUTHOR_PROFILE,
      },
      {
        id: "a2",
        action: "ticket.triaged",
        metadata: {},
        created_at: "2026-10-18T02:00:05.000Z",
        actor: null,
      },
    ],
  });
  let raced = false;
  const repository = adminRepository({
    async findTicket(ticketId) {
      return ticketId === state.ticket.id ? structuredClone(state.ticket) : null;
    },
    async findDetail(ticketId) {
      return ticketId === state.ticket.id
        ? { ticket: structuredClone(state.ticket), ...detailParts() }
        : null;
    },
    async updateIfVersion(ticketId, version, changes) {
      if (options.raceOnUpdate && !raced) {
        // Another admin's write lands between our read and our update.
        raced = true;
        state.ticket.version += 1;
      }
      if (ticketId !== state.ticket.id || version !== state.ticket.version) return false;
      state.updates.push({ version, changes });
      const { assigned_admin_id, ...columns } = changes;
      Object.assign(state.ticket, columns);
      if (assigned_admin_id !== undefined) {
        state.ticket.assigned_admin = assigned_admin_id === null ? null : admins.get(assigned_admin_id)!;
      }
      state.ticket.version += 1;
      state.ticket.updated_at = NOW.toISOString();
      return true;
    },
  });
  return { factory: () => repository, state };
}

function setup(options: { raceOnUpdate?: boolean; failAudit?: boolean } = {}) {
  const store = fakeAdminTicketStore(options);
  const audit = recordingSystemWriter({ fail: options.failAudit });
  const { logger, lines } = captureLogger();
  const app = buildTestApp({
    clock,
    logger,
    systemWriter: audit.writer,
    adminTicketsRepository: store.factory,
  });
  return { app, store, audit, lines };
}

const getTicket = (app: ReturnType<typeof setup>["app"], id = TICKET_ID) =>
  request(app).get(`/api/v1/admin/tickets/${id}`).set("Authorization", AS_ADMIN);
const patchTicket = (app: ReturnType<typeof setup>["app"], body: object, id = TICKET_ID) =>
  request(app).patch(`/api/v1/admin/tickets/${id}`).set("Authorization", AS_ADMIN).send(body);

describe("GET /api/v1/admin/tickets/:ticketId", () => {
  it("returns the full admin view: context, thread, notes, AI suggestion and timeline", async () => {
    const { app } = setup();
    const res = await getTicket(app);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toMatchObject({
      id: TICKET_ID,
      reference: "BL-1002",
      description: expect.stringContaining("royalty payment"),
      status: "open",
      priority: "high",
      prioritySource: "ai",
      slaState: "on_track", // high, created 4.5 h ago
      version: 3,
      resolvedAt: null,
      closedAt: null,
      authorContext: {
        author: { authorId: "AUTH001", name: "Priya Sharma", city: "Mumbai", joinedDate: "2023-03-15" },
      },
      ai: {
        status: "completed",
        suggestedCategory: "royalty_payments",
        suggestedPriority: "high",
        confidence: 0.86,
        signals: ["royalty_delay"],
        rationale: "Royalty payment overdue for a published book.",
        policyFloorApplied: null,
        failureReason: null,
      },
    });
    expect(data.authorContext.books.map((book: { bookId: string }) => book.bookId)).toEqual([
      "BK001",
      "BK002",
    ]);
    expect(data.authorContext.books[0]).toMatchObject({
      royaltyPending: 3570,
      lastRoyaltyPayoutDate: expect.any(String),
    });
    expect(
      data.messages.map((m: { senderRole: string; senderName: string }) => [m.senderRole, m.senderName]),
    ).toEqual([
      ["author", "Priya Sharma"],
      ["admin", "Support Lead"], // admins see who replied
    ]);
    expect(data.notes).toEqual([
      {
        id: "n1",
        author: { userId: LEAD.id, displayName: "Support Lead" },
        body: "Finance ticket FIN-2231 raised.",
        createdAt: "2026-10-18T04:05:00.000Z",
      },
    ]);
    expect(
      data.timeline.map((event: { action: string; actor: unknown }) => [event.action, event.actor]),
    ).toEqual([
      ["ticket.created", { userId: AUTHOR_PROFILE.id, displayName: "Priya Sharma" }],
      ["ticket.triaged", null], // system / AI
    ]);
  });

  it("never includes the author's email or phone", async () => {
    const { app } = setup();
    const author = dataset.authors.find((candidate) => candidate.author_id === "AUTH001")!;
    const raw = JSON.stringify((await getTicket(app)).body);
    expect(raw).not.toContain(author.email);
    if (author.phone) expect(raw).not.toContain(author.phone);
    expect(raw).not.toMatch(/"email"|"phone"/);
  });

  it("answers 404 for an unknown ticket, 400 for a malformed id and 403 for authors", async () => {
    const { app } = setup();
    expect((await getTicket(app, "6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c9999")).status).toBe(404);
    expect((await getTicket(app, "BL-1002")).status).toBe(400);
    const asAuthor = await request(app)
      .get(`/api/v1/admin/tickets/${TICKET_ID}`)
      .set("Authorization", bearer(TEST_TOKENS.author));
    expect(asAuthor.status).toBe(403);
  });
});

describe("PATCH /api/v1/admin/tickets/:ticketId", () => {
  it("applies the change at the given version, audits it and returns the updated ticket", async () => {
    const { app, store, audit } = setup();
    const res = await patchTicket(app, {
      version: 3,
      status: "in_progress",
      priority: "critical",
      assignedAdminId: ME.id,
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: "in_progress",
      priority: "critical",
      prioritySource: "admin",
      assignedAdmin: { userId: ME.id, displayName: "Ops Admin" },
      version: 4,
    });
    expect(store.state.updates).toEqual([
      {
        version: 3,
        changes: {
          status: "in_progress",
          priority: "critical",
          priority_source: "admin",
          assigned_admin_id: ME.id,
        },
      },
    ]);
    expect(audit.events).toEqual([
      {
        ticketId: TICKET_ID,
        actorProfileId: ME.id,
        action: "ticket.status_changed",
        metadata: { from: "open", to: "in_progress" },
      },
      {
        ticketId: TICKET_ID,
        actorProfileId: ME.id,
        action: "ticket.priority_overridden",
        metadata: { from: "high", fromSource: "ai", to: "critical" },
      },
      { ticketId: TICKET_ID, actorProfileId: ME.id, action: "ticket.assigned", metadata: { adminId: ME.id } },
    ]);
  });

  it("rejects a stale version with 409 and the current ticket, writing nothing", async () => {
    const { app, store, audit } = setup();
    const res = await patchTicket(app, { version: 2, status: "resolved" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "VERSION_CONFLICT",
      details: [{ path: "version", issue: "is out of date" }],
      current: { id: TICKET_ID, version: 3, status: "open" },
    });
    expect(store.state.updates).toHaveLength(0);
    expect(audit.events).toHaveLength(0);
  });

  it("returns 409 when another admin's write lands between the read and the update", async () => {
    const { app, store, audit } = setup({ raceOnUpdate: true });
    const res = await patchTicket(app, { version: 3, status: "resolved" });

    expect(res.status).toBe(409);
    expect(res.body.error.current.version).toBe(4);
    expect(store.state.updates).toHaveLength(0);
    expect(audit.events).toHaveLength(0);
  });

  it("refuses a transition the status machine doesn't allow (422), writing nothing", async () => {
    const { app, store } = setup();
    store.state.ticket.status = "closed";
    const res = await patchTicket(app, { version: 3, status: "resolved" });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
      message: "A ticket can't move from Closed to Resolved.",
    });
    expect(store.state.updates).toHaveLength(0);
  });

  it("refuses assigning someone else or taking a colleague's ticket (422)", async () => {
    const { app, store } = setup();
    const other = await patchTicket(app, { version: 3, assignedAdminId: LEAD.id });
    expect(other.status).toBe(422);
    expect(other.body.error.code).toBe("INVALID_ASSIGNMENT");

    store.state.ticket.assigned_admin = LEAD;
    const takeOver = await patchTicket(app, { version: 3, assignedAdminId: ME.id });
    expect(takeOver.status).toBe(422);
    expect(takeOver.body.error.message).toBe(
      "This ticket is assigned to Support Lead. They need to unassign it first.",
    );
    expect(store.state.updates).toHaveLength(0);
  });

  it("returns the ticket unchanged when nothing actually changes (no write, no audit, same version)", async () => {
    const { app, store, audit } = setup();
    const res = await patchTicket(app, { version: 3, status: "open", assignedAdminId: null });

    expect(res.status).toBe(200);
    expect(res.body.data.version).toBe(3);
    expect(store.state.updates).toHaveLength(0);
    expect(audit.events).toHaveLength(0);
  });

  it("still succeeds when the audit write fails, and logs it", async () => {
    const { app, lines } = setup({ failAudit: true });
    const res = await patchTicket(app, { version: 3, status: "resolved" });
    await settle();

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "resolved", resolvedAt: NOW.toISOString(), version: 4 });
    expect(lines().some((line) => line.msg === "audit event not recorded")).toBe(true);
  });

  it("validates the body: version required, at least one change, known fields and values only", async () => {
    const { app, store } = setup();
    const cases: [object, string][] = [
      [{ status: "resolved" }, "version"],
      [{ version: 0, status: "resolved" }, "version"],
      [{ version: 3 }, ""],
      [{ version: 3, status: "done" }, "status"],
      [{ version: 3, priority: "urgent" }, "priority"],
      [{ version: 3, assignedAdminId: "Ops Admin" }, "assignedAdminId"],
      [{ version: 3, subject: "Changed subject" }, ""],
      [{ version: 3, aiStatus: "completed" }, ""],
    ];
    for (const [body, path] of cases) {
      const res = await patchTicket(app, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
      if (path) {
        expect(res.body.error.details.map((detail: { path: string }) => detail.path)).toContain(path);
      }
    }
    expect(store.state.updates).toHaveLength(0);
  });

  it("answers 404 for an unknown ticket and 403 for authors", async () => {
    const { app } = setup();
    expect(
      (await patchTicket(app, { version: 1, status: "resolved" }, "6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c9999"))
        .status,
    ).toBe(404);
    const asAuthor = await request(app)
      .patch(`/api/v1/admin/tickets/${TICKET_ID}`)
      .set("Authorization", bearer(TEST_TOKENS.author))
      .send({ version: 3, status: "resolved" });
    expect(asAuthor.status).toBe(403);
  });
});

describe("admin ticket contract", () => {
  const props = (schema: { properties?: object } | undefined) => Object.keys(schema?.properties ?? {});
  const detailKeys = [
    ...props(spec.components.schemas.AdminQueueItem),
    ...props(spec.components.schemas.AdminTicketDetail?.allOf?.[1]),
  ].sort();

  it("detail keys (and the 409 `current` payload) match openapi.yaml exactly", async () => {
    const { app } = setup();
    const detail = await getTicket(app);
    expect(Object.keys(detail.body.data).sort()).toEqual(detailKeys);
    expect(Object.keys(detail.body.data.ai).sort()).toEqual(
      props(spec.components.schemas.AiSuggestion).sort(),
    );
    expect(Object.keys(detail.body.data.authorContext.author).sort()).toEqual(
      props(spec.components.schemas.AuthorProfile).sort(),
    );
    expect(Object.keys(detail.body.data.notes[0]).sort()).toEqual(
      props(spec.components.schemas.InternalNote).sort(),
    );
    expect(Object.keys(detail.body.data.timeline[0]).sort()).toEqual(
      props(spec.components.schemas.TimelineEvent).sort(),
    );

    const conflict = await patchTicket(app, { version: 1, status: "resolved" });
    expect(Object.keys(conflict.body.error.current).sort()).toEqual(detailKeys);
  });
});
