import { readFileSync } from "node:fs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { SeedDataSchema, toBookRows } from "../scripts/seed-data.js";
import { RateLimitedError, ValidationError } from "../src/lib/errors.js";
import { mapPostgrestError } from "../src/modules/tickets/repository.js";
import { fakeTicketsStore, recordingSystemWriter } from "./fakes.js";
import { AUTHOR_CONTEXT, TEST_TOKENS, bearer, buildTestApp, captureLogger, settle } from "./helpers.js";

const dataset = SeedDataSchema.parse(
  JSON.parse(readFileSync(new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url), "utf8")),
);
const books = toBookRows(dataset).map(({ book_id, author_id, title }) => ({ book_id, author_id, title }));

const spec = parse(readFileSync(new URL("../../openapi.yaml", import.meta.url), "utf8")) as {
  components: {
    schemas: Record<string, { properties?: Record<string, unknown>; allOf?: { properties?: object }[] }>;
  };
};

const AS_AUTHOR = bearer(TEST_TOKENS.author); // AUTH001 (Priya): BK001, BK002
const validTicket = {
  bookId: "BK001",
  subject: "Royalty for Q3 not received",
  description: "I haven't received my royalty payment for the last quarter. Could you check?",
};

function setup(options: { failAudit?: boolean } = {}) {
  const store = fakeTicketsStore(books);
  const audit = recordingSystemWriter({ fail: options.failAudit });
  const { logger, lines } = captureLogger();
  const app = buildTestApp({ ticketsRepository: store.factory, systemWriter: audit.writer, logger });
  return { app, store, audit, lines };
}

const create = (app: ReturnType<typeof setup>["app"], body: unknown) =>
  request(app)
    .post("/api/v1/author/tickets")
    .set("Authorization", AS_AUTHOR)
    .send(body as object);

describe("POST /api/v1/author/tickets", () => {
  it("creates a ticket in its initial state and returns the author-safe detail", async () => {
    const { app } = setup();
    const res = await create(app, validTicket);

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/author/tickets/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({
      reference: expect.stringMatching(/^BL-\d+$/),
      subject: validTicket.subject,
      description: validTicket.description,
      status: "open",
      book: { bookId: "BK001", title: "Whispers of the Ganges" },
      hasAdminReply: false,
      attachmentName: null,
      messages: [],
    });
  });

  it("records a ticket.created audit event without any ticket text", async () => {
    const { app, audit } = setup();
    const res = await create(app, validTicket);

    expect(audit.events).toEqual([
      {
        ticketId: res.body.data.id,
        actorProfileId: AUTHOR_CONTEXT.userId,
        action: "ticket.created",
        metadata: { bookId: "BK001" },
      },
    ]);
  });

  it("still creates the ticket when the audit write fails, and logs it", async () => {
    const { app, lines } = setup({ failAudit: true });
    const res = await create(app, validTicket);
    await settle();

    expect(res.status).toBe(201);
    expect(lines().some((line) => line.msg === "audit event not recorded")).toBe(true);
  });

  it("accepts a General / Account Level ticket (bookId null)", async () => {
    const { app } = setup();
    const res = await create(app, { ...validTicket, bookId: null });
    expect(res.status).toBe(201);
    expect(res.body.data.book).toBeNull();
  });

  it("trims whitespace before validating and storing", async () => {
    const { app } = setup();
    const res = await create(app, { ...validTicket, subject: "   Royalty question   " });
    expect(res.body.data.subject).toBe("Royalty question");
  });

  it("rejects another author's book with the same answer as an unknown book", async () => {
    const { app, store } = setup();
    for (const bookId of ["BK003", "BK999"]) {
      const res = await create(app, { ...validTicket, bookId });
      expect(res.status, bookId).toBe(400);
      expect(res.body.error.details).toEqual([
        { path: "bookId", issue: "must be one of your books, or null for General / Account Level" },
      ]);
    }
    expect(store.tickets).toHaveLength(0);
  });

  it("validates lengths, required fields and the attachment type with field-level details", async () => {
    const { app } = setup();
    const cases: [object, string][] = [
      [{ ...validTicket, subject: "Hi" }, "subject"],
      [{ ...validTicket, description: "Too short" }, "description"],
      [{ subject: validTicket.subject, description: validTicket.description }, "bookId"],
      [{ ...validTicket, attachmentName: "malware.exe" }, "attachmentName"],
    ];
    for (const [body, path] of cases) {
      const res = await create(app, body);
      expect(res.status, path).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
      expect(res.body.error.details.map((detail: { path: string }) => detail.path)).toContain(path);
    }
  });

  it("rejects fields a client must never set (identity, status, priority)", async () => {
    const { app, store } = setup();
    for (const extra of [{ authorId: "AUTH002" }, { status: "resolved" }, { priority: "critical" }]) {
      const res = await create(app, { ...validTicket, ...extra });
      expect(res.status, JSON.stringify(extra)).toBe(400);
    }
    expect(store.tickets).toHaveLength(0);
  });

  it("limits each author to 5 new tickets per 10 minutes; rejected requests don't count", async () => {
    const { app } = setup();
    expect((await create(app, { ...validTicket, subject: "x" })).status).toBe(400); // doesn't count
    for (let i = 0; i < 5; i += 1) expect((await create(app, validTicket)).status).toBe(201);

    const limited = await create(app, validTicket);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("is author-only", async () => {
    const { app } = setup();
    const res = await request(app)
      .post("/api/v1/author/tickets")
      .set("Authorization", bearer(TEST_TOKENS.admin))
      .send(validTicket);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/v1/author/tickets", () => {
  it("lists only the caller's tickets, newest activity first, with paging meta", async () => {
    const { app, store } = setup();
    const first = (await create(app, { ...validTicket, subject: "First question" })).body.data;
    await create(app, { ...validTicket, subject: "Second question" });
    await store
      .factory()
      .insertTicket({ ...validTicket, authorId: "AUTH002", bookId: "BK003", attachmentName: null });
    store.addMessage(first.id, "admin", "We're looking into it.");

    const res = await request(app).get("/api/v1/author/tickets").set("Authorization", AS_AUTHOR);
    expect(res.status).toBe(200);
    expect(res.body.data.map((ticket: { subject: string }) => ticket.subject)).toEqual([
      "First question", // reply arrived last, so it has the newest activity
      "Second question",
    ]);
    expect(res.body.data[0].hasAdminReply).toBe(true);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 25, total: 2 });
  });

  it("filters by status and pages", async () => {
    const { app, store } = setup();
    for (let i = 0; i < 3; i += 1) await create(app, { ...validTicket, subject: `Question number ${i}` });
    store.tickets[0]!.status = "resolved";

    const open = await request(app).get("/api/v1/author/tickets?status=open").set("Authorization", AS_AUTHOR);
    expect(open.body.meta.total).toBe(2);

    const page2 = await request(app)
      .get("/api/v1/author/tickets?pageSize=2&page=2")
      .set("Authorization", AS_AUTHOR);
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.meta).toEqual({ page: 2, pageSize: 2, total: 3 });
  });

  it("rejects an unknown status or an oversized page", async () => {
    const { app } = setup();
    for (const query of ["status=urgent", "pageSize=500", "page=0"]) {
      const res = await request(app).get(`/api/v1/author/tickets?${query}`).set("Authorization", AS_AUTHOR);
      expect(res.status, query).toBe(400);
    }
  });

  it("returns an empty list for an author with no tickets", async () => {
    const { app } = setup();
    const res = await request(app).get("/api/v1/author/tickets").set("Authorization", AS_AUTHOR);
    expect(res.body).toEqual({ data: [], meta: { page: 1, pageSize: 25, total: 0 } });
  });
});

describe("GET /api/v1/author/tickets/:ticketId", () => {
  it("returns the ticket with its thread; replies are signed by the team", async () => {
    const { app, store } = setup();
    const ticket = (await create(app, validTicket)).body.data;
    store.addMessage(ticket.id, "admin", "We've escalated this to finance.");
    store.addMessage(ticket.id, "author", "Thank you!");

    const res = await request(app).get(`/api/v1/author/tickets/${ticket.id}`).set("Authorization", AS_AUTHOR);
    expect(res.status).toBe(200);
    expect(
      res.body.data.messages.map((message: { senderRole: string; senderName: string; body: string }) => [
        message.senderRole,
        message.senderName,
        message.body,
      ]),
    ).toEqual([
      ["admin", "BookLeaf Support", "We've escalated this to finance."],
      ["author", "Priya Sharma", "Thank you!"],
    ]);
  });

  it("answers 404 for another author's ticket (never 403) and 400 for a malformed id", async () => {
    const { app, store } = setup();
    const others = await store
      .factory()
      .insertTicket({ ...validTicket, authorId: "AUTH002", bookId: "BK003", attachmentName: null });

    const notOwned = await request(app)
      .get(`/api/v1/author/tickets/${others.id}`)
      .set("Authorization", AS_AUTHOR);
    expect(notOwned.status).toBe(404);
    expect(notOwned.body.error.code).toBe("NOT_FOUND");

    const malformed = await request(app)
      .get("/api/v1/author/tickets/not-a-uuid")
      .set("Authorization", AS_AUTHOR);
    expect(malformed.status).toBe(400);
  });
});

describe("author ticket contract", () => {
  const props = (schema: string) => Object.keys(spec.components.schemas[schema]?.properties ?? {});
  const summaryKeys = props("AuthorTicketSummary").sort();
  const detailExtras = Object.keys(spec.components.schemas.AuthorTicketDetail!.allOf![1]!.properties!);

  it("summary and detail DTO keys match openapi.yaml exactly (no internal fields)", async () => {
    const { app } = setup();
    const created = await create(app, validTicket);
    const list = await request(app).get("/api/v1/author/tickets").set("Authorization", AS_AUTHOR);

    expect(Object.keys(list.body.data[0]).sort()).toEqual(summaryKeys);
    expect(Object.keys(created.body.data).sort()).toEqual([...summaryKeys, ...detailExtras].sort());
    expect(JSON.stringify(created.body)).not.toMatch(/priority|category|ai_|assigned|version|note/i);
  });
});

describe("mapPostgrestError", () => {
  it("translates database errors into API errors", () => {
    expect(mapPostgrestError({ code: "P0001", message: "rate_limited" }, "insert")).toBeInstanceOf(
      RateLimitedError,
    );
    const fk = mapPostgrestError({ code: "23503", message: "fk" }, "insert");
    expect(fk).toBeInstanceOf(ValidationError);
    expect((fk as ValidationError).details?.[0]?.path).toBe("bookId");
    expect(mapPostgrestError({ code: "23514", message: "check" }, "insert")).toBeInstanceOf(ValidationError);
    expect(mapPostgrestError({ code: "42501", message: "rls" }, "insert")).toMatchObject({ status: 403 });
    const unknown = mapPostgrestError({ code: "XX000", message: "secret internals" }, "insert");
    expect(unknown).not.toHaveProperty("status");
    expect(unknown.message).not.toContain("secret internals");
  });
});
