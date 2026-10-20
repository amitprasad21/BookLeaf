import { formatSseEvent } from "@bookleaf/shared";
import { Router } from "express";
import type { EventHub } from "../../events/hub.js";
import { RateLimitedError } from "../../lib/errors.js";
import { authOf } from "../../middleware/authenticate.js";

export interface EventsRouterOptions {
  hub: EventHub;
  /** Comment line that keeps proxies from closing an idle stream (contract: 25 s). */
  heartbeatMs?: number;
  /**
   * The stream is authorised once, at connect. Ending it after this long
   * makes the client reconnect with a current token, so a signed-out or
   * expired session stops receiving events.
   */
  maxStreamMs?: number;
}

const HEARTBEAT_MS = 25_000;
const MAX_STREAM_MS = 10 * 60_000;

/** /api/v1/events (any signed-in user): SSE stream of ticket events scoped to the caller. */
export function createEventsRouter({
  hub,
  heartbeatMs = HEARTBEAT_MS,
  maxStreamMs = MAX_STREAM_MS,
}: EventsRouterOptions) {
  // operationId: streamEvents
  return Router().get("/", (req, res) => {
    const auth = authOf(req);
    let ended = false;
    let unsubscribe: (() => void) | null = null;
    const timers: { heartbeat?: ReturnType<typeof setInterval>; expiry?: ReturnType<typeof setTimeout> } = {};

    const end = () => {
      if (ended) return;
      ended = true;
      clearInterval(timers.heartbeat);
      clearTimeout(timers.expiry);
      unsubscribe?.();
      res.end();
    };

    unsubscribe = hub.subscribe({
      userId: auth.userId,
      role: auth.role,
      authorId: auth.author?.authorId ?? null,
      send: (event) => {
        if (!ended) res.write(formatSseEvent(event));
      },
      close: end,
    });
    if (!unsubscribe) {
      throw new RateLimitedError(60, "Too many live-update connections are open. Close a tab and try again.");
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // proxies: don't buffer the stream
    res.flushHeaders();
    res.write(": connected\n\n");

    timers.heartbeat = setInterval(() => res.write(": ping\n\n"), heartbeatMs);
    timers.expiry = setTimeout(end, maxStreamMs);
    res.on("close", end); // the client went away (or end() above)
  });
}
