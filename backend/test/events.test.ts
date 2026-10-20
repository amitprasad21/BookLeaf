// Real-time events (API-8): the SSE format and parser, hub filtering, the
// update -> event mapping, and GET /api/v1/events over a real socket.
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import {
  createSseParser,
  formatSseEvent,
  toTicketEvent,
  type SseMessage,
  type TicketEvent,
} from "@bookleaf/shared";
import { afterEach, describe, expect, it } from "vitest";
import { createEventHub, MAX_STREAMS_PER_USER, type EventHub } from "../src/events/hub.js";
import { updateEvents } from "../src/events/ticket-events.js";
import { TEST_TOKENS, bearer, buildTestApp, captureLogger, listenTo } from "./helpers.js";

const NOW = new Date("2026-10-20T06:30:00.000Z");
const clock = () => NOW;
const TICKET = "6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c0003";

describe("SSE format and parser", () => {
  const event: TicketEvent = {
    type: "ticket.updated",
    ticketId: TICKET,
    changes: ["status", "messages"],
    at: NOW.toISOString(),
  };

  it("formats identifiers only, as the contract shows", () => {
    expect(formatSseEvent(event)).toBe(
      `event: ticket.updated\ndata: {"ticketId":"${TICKET}","changes":["status","messages"],"at":"${NOW.toISOString()}"}\n\n`,
    );
  });

  it("parses frames split across chunks, CRLF and comments", () => {
    const messages: SseMessage[] = [];
    const parser = createSseParser((message) => messages.push(message));
    const text = `: connected\r\n\r\n${formatSseEvent(event)}: ping\n\nevent: ticket.created\ndata: {"a":\ndata: 1}\n\n`;
    for (const chunk of text.match(/.{1,7}/gs) ?? []) parser.push(chunk);
    expect(messages).toEqual([
      { event: "ticket.updated", data: formatSseEvent(event).split("\n")[1]!.slice(6) },
      { event: "ticket.created", data: '{"a":\n1}' },
    ]);
    expect(toTicketEvent(messages[0]!)).toEqual(event);
  });

  it("ignores unknown event types, bad JSON and unknown change names", () => {
    expect(toTicketEvent({ event: "ticket.deleted", data: "{}" })).toBeNull();
    expect(toTicketEvent({ event: "ticket.updated", data: "not json" })).toBeNull();
    expect(
      toTicketEvent({
        event: "ticket.updated",
        data: JSON.stringify({ ticketId: TICKET, changes: ["status", "secret"], at: "x" }),
      }),
    ).toEqual({ type: "ticket.updated", ticketId: TICKET, changes: ["status"], at: "x" });
  });
});

describe("event hub", () => {
  const { logger, lines } = captureLogger();
  const hub = () => createEventHub({ clock, logger });

  it("gives admins every event and authors only updates to their own tickets", () => {
    const events = hub();
    const admin = listenTo(events, { role: "admin", authorId: null });
    const priya = listenTo(events, { role: "author", authorId: "AUTH001" });
    const rohit = listenTo(events, { role: "author", authorId: "AUTH002" });

    events.publish({ type: "ticket.created", ticketId: "t1", authorId: "AUTH001", changes: ["created"] });
    events.publish({ type: "ticket.triaged", ticketId: "t1", authorId: null, changes: ["ai"] });
    events.publish({
      type: "ticket.internal_updated",
      ticketId: "t1",
      authorId: "AUTH001",
      changes: ["notes"],
    });
    events.publish({ type: "ticket.updated", ticketId: "t1", authorId: "AUTH001", changes: ["messages"] });
    events.publish({ type: "ticket.updated", ticketId: "t2", authorId: null, changes: ["messages"] });

    expect(admin.map((event) => event.type)).toEqual([
      "ticket.created",
      "ticket.triaged",
      "ticket.internal_updated",
      "ticket.updated",
      "ticket.updated",
    ]);
    expect(priya).toEqual([
      { type: "ticket.updated", ticketId: "t1", changes: ["messages"], at: NOW.toISOString() },
    ]);
    expect(rohit).toEqual([]);
  });

  it("limits open streams per user, and stops sending after unsubscribe", () => {
    const events = hub();
    const subscriber = {
      userId: "u1",
      role: "admin" as const,
      authorId: null,
      send: () => {},
      close: () => {},
    };
    const handles = Array.from({ length: MAX_STREAMS_PER_USER }, () => events.subscribe({ ...subscriber }));
    expect(handles.every(Boolean)).toBe(true);
    expect(events.subscribe({ ...subscriber })).toBeNull();
    expect(events.subscribe({ ...subscriber, userId: "u2" })).not.toBeNull();
    handles[0]!();
    expect(events.size()).toBe(MAX_STREAMS_PER_USER);
  });

  it("keeps delivering when one stream fails, and closes every stream on shutdown", () => {
    const events = hub();
    let closed = 0;
    events.subscribe({
      userId: "broken",
      role: "admin",
      authorId: null,
      send: () => {
        throw new Error("socket gone");
      },
      close: () => (closed += 1),
    });
    const admin = listenTo(events, { role: "admin", authorId: null });
    events.publish({ type: "ticket.created", ticketId: "t1", authorId: null, changes: ["created"] });
    expect(admin).toHaveLength(1);
    expect(lines().some((line) => line.msg === "event delivery failed")).toBe(true);

    events.closeAll();
    expect(closed).toBe(1);
    expect(events.size()).toBe(0);
  });
});

describe("updateEvents", () => {
  it("makes status author-visible and keeps overrides and assignment internal", () => {
    expect(
      updateEvents("t1", "AUTH001", [
        "ticket.status_changed",
        "ticket.priority_overridden",
        "ticket.assigned",
        "ticket.unassigned",
      ]),
    ).toEqual([
      { type: "ticket.updated", ticketId: "t1", authorId: "AUTH001", changes: ["status"] },
      {
        type: "ticket.internal_updated",
        ticketId: "t1",
        authorId: "AUTH001",
        changes: ["priority", "assignee"],
      },
    ]);
    expect(updateEvents("t1", "AUTH001", ["ticket.category_overridden"])).toEqual([
      { type: "ticket.internal_updated", ticketId: "t1", authorId: "AUTH001", changes: ["category"] },
    ]);
    expect(updateEvents("t1", "AUTH001", [])).toEqual([]);
  });
});

describe("GET /api/v1/events", () => {
  let server: Server | undefined;
  afterEach(() => {
    server?.closeAllConnections();
    server?.close();
    server = undefined;
  });

  function start(maxStreamMs = 5_000): { events: EventHub; url: string } {
    const events = createEventHub({ clock, logger: captureLogger().logger });
    const app = buildTestApp({ events, eventStream: { heartbeatMs: 20, maxStreamMs } });
    server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    return { events, url: `http://127.0.0.1:${port}/api/v1/events` };
  }

  /** Reads the stream until `until` matches the text so far (or it ends). */
  async function read(response: Response, until: (text: string) => boolean): Promise<string> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return text;
      text += decoder.decode(value, { stream: true });
      if (until(text)) {
        await reader.cancel();
        return text;
      }
    }
  }

  const waitFor = async (check: () => boolean) => {
    for (let i = 0; i < 100 && !check(); i += 1) await new Promise((resolve) => setTimeout(resolve, 5));
  };

  it("needs a signed-in user", async () => {
    const { url } = start();
    const response = await fetch(url);
    expect(response.status).toBe(401);
  });

  it("streams the author's own updates with heartbeats, and nothing else", async () => {
    const { events, url } = start();
    const response = await fetch(url, { headers: { Authorization: bearer(TEST_TOKENS.author) } });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-cache, no-transform");

    await waitFor(() => events.size() === 1);
    events.publish({ type: "ticket.created", ticketId: "t0", authorId: "AUTH001", changes: ["created"] });
    events.publish({ type: "ticket.updated", ticketId: "t9", authorId: "AUTH002", changes: ["messages"] });
    events.publish({ type: "ticket.updated", ticketId: TICKET, authorId: "AUTH001", changes: ["messages"] });

    const text = await read(response, (so) => so.includes("event: ticket.updated") && so.includes(": ping"));
    expect(text.startsWith(": connected\n\n")).toBe(true);
    expect(text).toContain(`"ticketId":"${TICKET}"`);
    expect(text).not.toContain("ticket.created");
    expect(text).not.toContain("t9");
    await waitFor(() => events.size() === 0);
    expect(events.size()).toBe(0); // unsubscribed when the client went away
  });

  it("ends the stream after its maximum age so the client re-authenticates", async () => {
    const { events, url } = start(60);
    const response = await fetch(url, { headers: { Authorization: bearer(TEST_TOKENS.admin) } });
    const text = await read(response, () => false); // until the server ends it
    expect(text.startsWith(": connected")).toBe(true);
    expect(events.size()).toBe(0);
  });

  it("refuses more than the per-user limit with 429", async () => {
    const { events, url } = start();
    const open = await Promise.all(
      Array.from({ length: MAX_STREAMS_PER_USER }, () =>
        fetch(url, { headers: { Authorization: bearer(TEST_TOKENS.admin) } }),
      ),
    );
    await waitFor(() => events.size() === MAX_STREAMS_PER_USER);
    const extra = await fetch(url, { headers: { Authorization: bearer(TEST_TOKENS.admin) } });
    expect(extra.status).toBe(429);
    expect(((await extra.json()) as { error: { code: string } }).error.code).toBe("RATE_LIMITED");
    await Promise.all(open.map((response) => response.body?.cancel()));
  });
});
