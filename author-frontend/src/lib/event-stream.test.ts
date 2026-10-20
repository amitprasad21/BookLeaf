// The live-update client (author TEST_PLAN AT-07/08 at logic level).
import type { TicketEvent } from "@bookleaf/shared";
import { describe, expect, it } from "vitest";
import { BACKOFF_MS, runEventStream, type EventStreamOptions, type LiveMode } from "./event-stream";

const EVENT =
  'event: ticket.updated\ndata: {"ticketId":"t1","changes":["messages"],"at":"2026-10-20T06:30:00Z"}\n\n';

const streamOf = (...chunks: string[]) =>
  new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  );

function harness(responses: (Response | Error)[], options: Partial<EventStreamOptions> = {}) {
  const controller = new AbortController();
  const events: TicketEvent[] = [];
  const modes: LiveMode[] = [];
  const sleeps: number[] = [];
  const tokens: string[] = [];
  let opens = 0;
  let clock = 0;
  const run = runEventStream(
    {
      url: "http://api.test/api/v1/events",
      getToken: async () => "token-1",
      refreshSession: async () => true,
      onEvent: (event) => events.push(event),
      onOpen: () => (opens += 1),
      onMode: (mode) => modes.push(mode),
      now: () => (clock += 1_000),
      fetchFn: async (_url, init) => {
        tokens.push(new Headers(init?.headers).get("Authorization") ?? "");
        const next = responses.shift();
        if (!next) {
          controller.abort();
          throw new DOMException("aborted", "AbortError");
        }
        if (next instanceof Error) throw next;
        return next;
      },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      ...options,
    },
    controller.signal,
  );
  return { run, events, modes, sleeps, tokens, opens: () => opens };
}

describe("runEventStream", () => {
  it("delivers ticket events and re-syncs when the stream opens", async () => {
    const h = harness([streamOf(": connected\n\n", EVENT.slice(0, 20), EVENT.slice(20))]);
    await h.run;
    expect(h.events).toEqual([
      { type: "ticket.updated", ticketId: "t1", changes: ["messages"], at: "2026-10-20T06:30:00Z" },
    ]);
    expect(h.opens()).toBe(1);
    expect(h.modes[0]).toBe("live");
    expect(h.tokens[0]).toBe("Bearer token-1");
  });

  it("falls back to polling and backs off 1, 2, 5, then 15 s (AT-08)", async () => {
    const down = () => new Error("network down");
    const h = harness([down(), down(), down(), down(), down()]);
    await h.run;
    expect(h.sleeps).toEqual([...BACKOFF_MS, 15_000]);
    expect(h.modes.every((mode) => mode === "polling")).toBe(true);
  });

  it("reconnects at once, still live, when a long-lived stream ends", async () => {
    let clock = 0;
    const h = harness([streamOf(EVENT), streamOf(EVENT)], { now: () => (clock += 60_000) });
    await h.run;
    expect(h.events).toHaveLength(2);
    expect(h.sleeps).toEqual([]);
    expect(h.modes.filter((mode) => mode === "polling")).toEqual([]);
  });

  it("treats a stream that ends immediately as a failure", async () => {
    const h = harness([streamOf(": connected\n\n")], { now: () => 0 });
    await h.run;
    expect(h.modes).toEqual(["live", "polling"]);
    expect(h.sleeps).toEqual([1_000]);
  });

  it("refreshes the session once on 401, then gives up", async () => {
    let refreshes = 0;
    const unauthorised = () => new Response(null, { status: 401 });
    const h = harness([unauthorised(), unauthorised(), streamOf(EVENT)], {
      refreshSession: async () => {
        refreshes += 1;
        return true;
      },
    });
    await h.run;
    expect(refreshes).toBe(1);
    expect(h.events).toEqual([]); // stopped: the API client handles the expired session
  });

  it("stops when signed out", async () => {
    const h = harness([streamOf(EVENT)], { getToken: async () => null });
    await h.run;
    expect(h.tokens).toEqual([]);
  });
});
