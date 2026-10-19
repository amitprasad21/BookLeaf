// HTTP side of AI triage: ticket creation queues it (never waits for it), and
// POST /admin/tickets/{id}/triage re-runs it with caps and availability checks.
import { readFileSync } from "node:fs";
import type { AiUnavailableReason } from "@bookleaf/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { TriageControl } from "../src/ai/control.js";
import { SeedDataSchema, toBookRows } from "../scripts/seed-data.js";
import type { AdminTicketRow } from "../src/modules/tickets/admin-repository.js";
import { adminRepository, fakeTicketsStore, recordingSystemWriter } from "./fakes.js";
import { ADMIN_CONTEXT, TEST_TOKENS, bearer, buildTestApp, fixedClock } from "./helpers.js";

const dataset = SeedDataSchema.parse(
  JSON.parse(readFileSync(new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url), "utf8")),
);
const books = toBookRows(dataset).map(({ book_id, author_id, title }) => ({ book_id, author_id, title }));
const TICKET_ID = "6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c0010";
const AS_ADMIN = bearer(TEST_TOKENS.admin);

function recordingTriage(
  availability: { ok: true } | { ok: false; reason: AiUnavailableReason } = { ok: true },
) {
  const queued: string[] = [];
  const retried: string[] = [];
  const control: TriageControl = {
    enqueue: (id) => void queued.push(id),
    availability: async () => availability,
    retry: async (id) => {
      retried.push(id);
      return id === TICKET_ID;
    },
  };
  return { control, queued, retried };
}

describe("ticket creation queues triage", () => {
  it("queues the saved ticket after responding 201, and the ticket starts AI-pending", async () => {
    const store = fakeTicketsStore(books);
    const triage = recordingTriage();
    const app = buildTestApp({ ticketsRepository: store.factory, triage: triage.control });
    const res = await request(app)
      .post("/api/v1/author/tickets")
      .set("Authorization", bearer(TEST_TOKENS.author))
      .send({
        bookId: "BK001",
        subject: "Royalty for Q3 not received",
        description: "I haven't received my royalty payment for the last quarter.",
      });
    expect(res.status).toBe(201);
    expect(triage.queued).toEqual([res.body.data.id]);
  });

  it("nothing is queued when the create fails validation", async () => {
    const triage = recordingTriage();
    const app = buildTestApp({ ticketsRepository: fakeTicketsStore(books).factory, triage: triage.control });
    await request(app)
      .post("/api/v1/author/tickets")
      .set("Authorization", bearer(TEST_TOKENS.author))
      .send({ bookId: "BK001", subject: "Hi", description: "short" });
    expect(triage.queued).toEqual([]);
  });
});

describe("POST /api/v1/admin/tickets/:ticketId/triage", () => {
  const clock = fixedClock("2026-10-18"); // 06:30 UTC = 12:00 in India

  function setup(
    options: {
      aiStatus?: AdminTicketRow["ai_status"];
      requestsToday?: number;
      availability?: { ok: true } | { ok: false; reason: AiUnavailableReason };
    } = {},
  ) {
    const counts: [string, string, string][] = [];
    const repository = adminRepository({
      async findTicket(id) {
        return id === TICKET_ID
          ? ({ id, ai_status: options.aiStatus ?? "manual_review_required" } as AdminTicketRow)
          : null;
      },
      async countAuditEvents(ticketId, action, since) {
        counts.push([ticketId, action, since]);
        return options.requestsToday ?? 0;
      },
    });
    const triage = recordingTriage(options.availability);
    const audit = recordingSystemWriter();
    const app = buildTestApp({
      clock,
      adminTicketsRepository: () => repository,
      triage: triage.control,
      systemWriter: audit.writer,
    });
    return { app, triage, audit, counts };
  }

  const retry = (app: ReturnType<typeof setup>["app"], id = TICKET_ID) =>
    request(app).post(`/api/v1/admin/tickets/${id}/triage`).set("Authorization", AS_ADMIN);

  it("resets and re-queues the ticket (202), audited, counting today's requests from 00:00 India time", async () => {
    const { app, triage, audit, counts } = setup();
    const res = await retry(app);

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ data: { aiStatus: "pending" } });
    expect(triage.retried).toEqual([TICKET_ID]);
    expect(counts).toEqual([[TICKET_ID, "ticket.triage_requested", "2026-10-17T18:30:00.000Z"]]);
    expect(audit.events).toEqual([
      {
        ticketId: TICKET_ID,
        actorProfileId: ADMIN_CONTEXT.userId,
        action: "ticket.triage_requested",
        metadata: { previousAiStatus: "manual_review_required" },
      },
    ]);
  });

  it("is a no-op 202 when triage is already pending (nothing reset, nothing counted)", async () => {
    const { app, triage, audit } = setup({ aiStatus: "pending" });
    const res = await retry(app);
    expect(res.status).toBe(202);
    expect(triage.retried).toEqual([]);
    expect(audit.events).toEqual([]);
  });

  it("caps manual retries at 3 per ticket per day (429 until midnight India time)", async () => {
    const { app, triage } = setup({ requestsToday: 3 });
    const res = await retry(app);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
    expect(Number(res.headers["retry-after"])).toBe(12 * 60 * 60); // noon → midnight
    expect(triage.retried).toEqual([]);
  });

  it.each(["not_configured", "budget_exhausted", "circuit_open"] as const)(
    "answers 503 AI_UNAVAILABLE when AI can't serve (%s), changing nothing",
    async (reason) => {
      const { app, triage, audit } = setup({ availability: { ok: false, reason } });
      const res = await retry(app);
      expect(res.status).toBe(503);
      expect(res.body.error).toMatchObject({ code: "AI_UNAVAILABLE", details: [{ issue: reason }] });
      expect(triage.retried).toEqual([]);
      expect(audit.events).toEqual([]);
    },
  );

  it("answers 404 for an unknown ticket, 400 for a malformed id and 403 for authors", async () => {
    const { app } = setup();
    expect((await retry(app, "6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c9999")).status).toBe(404);
    expect((await retry(app, "BL-1010")).status).toBe(400);
    const asAuthor = await request(app)
      .post(`/api/v1/admin/tickets/${TICKET_ID}/triage`)
      .set("Authorization", bearer(TEST_TOKENS.author));
    expect(asAuthor.status).toBe(403);
  });

  it("limits each admin to 5 retry requests a minute", async () => {
    const { app } = setup({ aiStatus: "pending" });
    for (let i = 0; i < 5; i += 1) expect((await retry(app)).status).toBe(202);
    expect((await retry(app)).status).toBe(429);
  });
});
