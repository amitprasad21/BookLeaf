import { readFileSync } from "node:fs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { InvalidTransitionError, NotFoundError, ValidationError } from "../src/lib/errors.js";
import {
  createAdminTicketsRepository,
  type NewReply,
  type NoteRow,
  type SentReply,
} from "../src/modules/tickets/admin-repository.js";
import { adminRepository, recordingSupabase, recordingSystemWriter } from "./fakes.js";
import { ADMIN_CONTEXT, TEST_TOKENS, bearer, buildTestApp, captureLogger, settle } from "./helpers.js";

const spec = parse(readFileSync(new URL("../../openapi.yaml", import.meta.url), "utf8")) as {
  components: { schemas: Record<string, { properties?: Record<string, unknown> }> };
};

const AS_ADMIN = bearer(TEST_TOKENS.admin);
const TICKET_ID = "6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c0003";
const MESSAGE_ID = "8a1f0c2d-3b4e-4f50-9a61-7c8d9e0f1a2b";
const NOTE: NoteRow = {
  id: "9b2e1d3c-4a5f-4e60-8b71-6d7e8f9a0b1c",
  body: "Escalated to finance (FIN-2231).",
  created_at: "2026-10-18T07:00:00.000Z",
  admin: { id: ADMIN_CONTEXT.userId, display_name: "Ops Admin" },
};

function setup(
  options: {
    sent?: Partial<SentReply>;
    replyError?: Error;
    notes?: NoteRow[] | null;
    failAudit?: boolean;
  } = {},
) {
  const replies: [string, NewReply][] = [];
  const notesAdded: [string, string, string][] = [];
  const repository = adminRepository({
    async sendReply(ticketId, reply) {
      replies.push([ticketId, reply]);
      if (options.replyError) throw options.replyError;
      return {
        messageId: MESSAGE_ID,
        createdAt: "2026-10-18T06:45:00.000Z",
        previousStatus: "open",
        newStatus: "in_progress",
        firstResponse: true,
        ...options.sent,
      };
    },
    async listNotes(ticketId) {
      return ticketId === TICKET_ID ? (options.notes === undefined ? [NOTE] : options.notes) : null;
    },
    async addNote(ticketId, adminId, body) {
      if (ticketId !== TICKET_ID) throw new NotFoundError("We couldn't find that ticket.");
      notesAdded.push([ticketId, adminId, body]);
      return { ...NOTE, body };
    },
  });
  const audit = recordingSystemWriter({ fail: options.failAudit });
  const { logger, lines } = captureLogger();
  const app = buildTestApp({ logger, systemWriter: audit.writer, adminTicketsRepository: () => repository });
  return { app, replies, notesAdded, audit, lines };
}

const reply = (app: ReturnType<typeof setup>["app"], body: object, id = TICKET_ID) =>
  request(app).post(`/api/v1/admin/tickets/${id}/messages`).set("Authorization", AS_ADMIN).send(body);
const addNote = (app: ReturnType<typeof setup>["app"], body: object, id = TICKET_ID) =>
  request(app).post(`/api/v1/admin/tickets/${id}/notes`).set("Authorization", AS_ADMIN).send(body);

describe("POST /api/v1/admin/tickets/:ticketId/messages", () => {
  it("sends the reply (trimmed), defaults to in_progress and returns the thread message", async () => {
    const { app, replies } = setup();
    const res = await reply(app, { body: "  We've escalated this to our finance team.  " });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      id: MESSAGE_ID,
      senderRole: "admin",
      senderName: "Ops Admin",
      body: "We've escalated this to our finance team.",
      createdAt: "2026-10-18T06:45:00.000Z",
    });
    expect(replies).toEqual([
      [
        TICKET_ID,
        { body: "We've escalated this to our finance team.", statusAfter: "in_progress", draftId: null },
      ],
    ]);
  });

  it("audits the reply (no body) and, when the status moved, the status change", async () => {
    const { app, audit } = setup();
    await reply(app, { body: "Thanks, looking into it." });
    expect(audit.events).toEqual([
      {
        ticketId: TICKET_ID,
        actorProfileId: ADMIN_CONTEXT.userId,
        action: "ticket.reply_sent",
        metadata: { messageId: MESSAGE_ID, draftId: null, firstResponse: true },
      },
      {
        ticketId: TICKET_ID,
        actorProfileId: ADMIN_CONTEXT.userId,
        action: "ticket.status_changed",
        metadata: { from: "open", to: "in_progress", via: "reply" },
      },
    ]);
    expect(JSON.stringify(audit.events)).not.toContain("looking into it");
  });

  it("passes statusAfter=resolved and a draft id through; a later reply records only the reply", async () => {
    const draftId = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
    const { app, replies, audit } = setup({
      sent: { previousStatus: "in_progress", newStatus: "in_progress", firstResponse: false },
    });
    await reply(app, { body: "Resolved: the payout was released today.", statusAfter: "resolved", draftId });
    expect(replies[0]![1]).toEqual({
      body: "Resolved: the payout was released today.",
      statusAfter: "resolved",
      draftId,
    });
    expect(audit.events.map((event) => event.action)).toEqual(["ticket.reply_sent"]);
    expect(audit.events[0]!.metadata).toEqual({ messageId: MESSAGE_ID, draftId, firstResponse: false });
  });

  it("maps the database's refusals: 404 unknown ticket, 422 resolved/closed, 400 unknown draft", async () => {
    const cases: [Error, number, string][] = [
      [new NotFoundError("We couldn't find that ticket."), 404, "NOT_FOUND"],
      [
        new InvalidTransitionError("Reopen this ticket (set it to In progress) before replying."),
        422,
        "INVALID_STATUS_TRANSITION",
      ],
      [
        new ValidationError(undefined, [{ path: "draftId", issue: "must be a draft of this ticket" }]),
        400,
        "VALIDATION_FAILED",
      ],
    ];
    for (const [error, status, code] of cases) {
      const { app, audit } = setup({ replyError: error });
      const res = await reply(app, { body: "Hello" });
      expect(res.status, code).toBe(status);
      expect(res.body.error.code).toBe(code);
      expect(audit.events).toHaveLength(0);
    }
  });

  it("validates the body", async () => {
    const { app, replies } = setup();
    const cases: [object, string][] = [
      [{ body: "   " }, "body"],
      [{ body: "x".repeat(5001) }, "body"],
      [{ body: "Hi", statusAfter: "closed" }, "statusAfter"],
      [{ body: "Hi", draftId: "draft-1" }, "draftId"],
      [{ body: "Hi", senderRole: "author" }, ""],
      [{}, "body"],
    ];
    for (const [body, path] of cases) {
      const res = await reply(app, body);
      expect(res.status, JSON.stringify(body).slice(0, 60)).toBe(400);
      if (path) expect(res.body.error.details.map((detail: { path: string }) => detail.path)).toContain(path);
    }
    expect(replies).toHaveLength(0);
  });

  it("still returns 201 when the audit write fails, and logs it", async () => {
    const { app, lines } = setup({ failAudit: true });
    const res = await reply(app, { body: "Hello" });
    await settle();
    expect(res.status).toBe(201);
    expect(lines().some((line) => line.msg === "audit event not recorded")).toBe(true);
  });

  it("is admin-only", async () => {
    const { app, replies } = setup();
    const res = await request(app)
      .post(`/api/v1/admin/tickets/${TICKET_ID}/messages`)
      .set("Authorization", bearer(TEST_TOKENS.author))
      .send({ body: "I am the admin now" });
    expect(res.status).toBe(403);
    expect(replies).toHaveLength(0);
  });
});

describe("internal notes", () => {
  it("GET lists the notes, oldest first, with their author", async () => {
    const { app } = setup();
    const res = await request(app)
      .get(`/api/v1/admin/tickets/${TICKET_ID}/notes`)
      .set("Authorization", AS_ADMIN);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [
        {
          id: NOTE.id,
          author: { userId: ADMIN_CONTEXT.userId, displayName: "Ops Admin" },
          body: NOTE.body,
          createdAt: NOTE.created_at,
        },
      ],
    });
  });

  it("GET answers 404 for an unknown ticket", async () => {
    const { app } = setup();
    const res = await request(app)
      .get("/api/v1/admin/tickets/6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c9999/notes")
      .set("Authorization", AS_ADMIN);
    expect(res.status).toBe(404);
  });

  it("POST adds a note as the caller and audits it without the text", async () => {
    const { app, notesAdded, audit } = setup();
    const res = await addNote(app, { body: "  Called the printer; reprint scheduled.  " });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      author: { userId: ADMIN_CONTEXT.userId, displayName: "Ops Admin" },
      body: "Called the printer; reprint scheduled.",
    });
    expect(notesAdded).toEqual([[TICKET_ID, ADMIN_CONTEXT.userId, "Called the printer; reprint scheduled."]]);
    expect(audit.events).toEqual([
      {
        ticketId: TICKET_ID,
        actorProfileId: ADMIN_CONTEXT.userId,
        action: "ticket.note_added",
        metadata: { noteId: NOTE.id },
      },
    ]);
  });

  it("POST validates the body, answers 404 for an unknown ticket and is admin-only", async () => {
    const { app, notesAdded } = setup();
    expect((await addNote(app, { body: "" })).status).toBe(400);
    expect((await addNote(app, { body: "ok", adminProfileId: "someone" })).status).toBe(400);
    expect((await addNote(app, { body: "ok" }, "6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c9999")).status).toBe(404);
    const asAuthor = await request(app)
      .post(`/api/v1/admin/tickets/${TICKET_ID}/notes`)
      .set("Authorization", bearer(TEST_TOKENS.author))
      .send({ body: "peek" });
    expect(asAuthor.status).toBe(403);
    expect(notesAdded).toHaveLength(0);
  });
});

describe("reply and note contract", () => {
  const props = (schema: string) => Object.keys(spec.components.schemas[schema]?.properties ?? {}).sort();

  it("reply and note keys match ThreadMessage and InternalNote in openapi.yaml", async () => {
    const { app } = setup();
    expect(Object.keys((await reply(app, { body: "Hi" })).body.data).sort()).toEqual(props("ThreadMessage"));
    expect(Object.keys((await addNote(app, { body: "Hi" })).body.data).sort()).toEqual(props("InternalNote"));
  });
});

describe("Supabase admin repository: replies and notes (recorded calls)", () => {
  const NEW_REPLY: NewReply = { body: "Hello", statusAfter: "resolved", draftId: null };

  it("calls admin_send_reply once and maps its row", async () => {
    const { db, queries } = recordingSupabase({
      "rpc:admin_send_reply": {
        data: {
          message_id: MESSAGE_ID,
          message_created_at: "2026-10-18T06:45:00.000Z",
          previous_status: "open",
          new_status: "resolved",
          first_response: true,
        },
      },
    });
    const sent = await createAdminTicketsRepository(db).sendReply(TICKET_ID, NEW_REPLY);
    expect(queries).toEqual([
      {
        table: "rpc:admin_send_reply",
        calls: [
          [
            "rpc",
            "admin_send_reply",
            { p_ticket_id: TICKET_ID, p_body: "Hello", p_status_after: "resolved", p_draft_id: null },
          ],
          ["single"],
        ],
      },
    ]);
    expect(sent).toEqual({
      messageId: MESSAGE_ID,
      createdAt: "2026-10-18T06:45:00.000Z",
      previousStatus: "open",
      newStatus: "resolved",
      firstResponse: true,
    });
  });

  it.each([
    [{ code: "P0002", message: "ticket_not_found" }, NotFoundError],
    [{ code: "P0001", message: "reply_requires_reopen" }, InvalidTransitionError],
    [{ code: "P0001", message: "draft_not_found" }, ValidationError],
  ])("maps %o", async (error, expected) => {
    const { db } = recordingSupabase({ "rpc:admin_send_reply": { error } });
    await expect(createAdminTicketsRepository(db).sendReply(TICKET_ID, NEW_REPLY)).rejects.toBeInstanceOf(
      expected,
    );
  });

  it("turns anything else (e.g. a missing function) into a generic error", async () => {
    const { db } = recordingSupabase({
      "rpc:admin_send_reply": { error: { code: "PGRST202", message: "Could not find the function" } },
    });
    const failure = await createAdminTicketsRepository(db)
      .sendReply(TICKET_ID, NEW_REPLY)
      .catch((error: Error) => error);
    expect(failure).not.toHaveProperty("status");
    expect((failure as Error).message).toBe("admin reply failed (PGRST202)");
  });

  it("adds a note as the given admin, and a missing ticket (FK) is a 404", async () => {
    const ok = recordingSupabase({ internal_notes: { data: NOTE } });
    await createAdminTicketsRepository(ok.db).addNote(TICKET_ID, ADMIN_CONTEXT.userId, "Hi");
    expect(ok.queries[0]!.calls.slice(0, 1)).toEqual([
      ["insert", { ticket_id: TICKET_ID, admin_profile_id: ADMIN_CONTEXT.userId, body: "Hi" }],
    ]);

    const missing = recordingSupabase({ internal_notes: { error: { code: "23503", message: "fk" } } });
    await expect(
      createAdminTicketsRepository(missing.db).addNote(TICKET_ID, ADMIN_CONTEXT.userId, "Hi"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lists notes only for a ticket that exists", async () => {
    const found = recordingSupabase({
      tickets: { data: { id: TICKET_ID } },
      internal_notes: { data: [NOTE] },
    });
    expect(await createAdminTicketsRepository(found.db).listNotes(TICKET_ID)).toEqual([NOTE]);
    const gone = recordingSupabase({ tickets: { data: null }, internal_notes: { data: [] } });
    expect(await createAdminTicketsRepository(gone.db).listNotes(TICKET_ID)).toBeNull();
  });
});
