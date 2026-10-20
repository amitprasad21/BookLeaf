// In-process event hub (ARCHITECTURE.md section 6, D-006). Routes publish
// after a successful write; each open stream gets only what its user may
// see: admins every event, authors only `ticket.updated` for their own
// tickets. One backend instance (A-15): scaling out would need a shared
// channel (ALTERNATIVES.md).
import type { Role, TicketChange, TicketEvent, TicketEventType } from "@bookleaf/shared";
import type { Logger } from "pino";
import type { Clock } from "../lib/clock.js";

/** At most this many open streams per user (tabs); more is refused with 429. */
export const MAX_STREAMS_PER_USER = 5;

export interface PublishedEvent {
  type: TicketEventType;
  ticketId: string;
  changes: TicketChange[];
  /** The ticket's author (authors.author_id), for author delivery; null when unknown. */
  authorId: string | null;
}

export interface Subscriber {
  userId: string;
  role: Role;
  /** authors.author_id for an author, null for an admin. */
  authorId: string | null;
  send(event: TicketEvent): void;
  close(): void;
}

export interface EventHub {
  publish(event: PublishedEvent): void;
  /** Returns the unsubscribe function, or null when the user has too many streams. */
  subscribe(subscriber: Subscriber): (() => void) | null;
  size(): number;
  /** Ends every stream (shutdown). */
  closeAll(): void;
}

function deliverable(subscriber: Subscriber, event: PublishedEvent): boolean {
  if (subscriber.role === "admin") return true;
  return event.type === "ticket.updated" && event.authorId !== null && event.authorId === subscriber.authorId;
}

export function createEventHub({ clock, logger }: { clock: Clock; logger: Logger }): EventHub {
  const subscribers = new Set<Subscriber>();

  return {
    publish(event) {
      const payload: TicketEvent = {
        type: event.type,
        ticketId: event.ticketId,
        changes: event.changes,
        at: clock().toISOString(),
      };
      for (const subscriber of subscribers) {
        if (!deliverable(subscriber, event)) continue;
        try {
          subscriber.send(payload);
        } catch (error) {
          // A broken stream must never affect the write that triggered the event.
          logger.warn({ err: error, type: event.type }, "event delivery failed");
        }
      }
    },

    subscribe(subscriber) {
      let open = 0;
      for (const existing of subscribers) if (existing.userId === subscriber.userId) open += 1;
      if (open >= MAX_STREAMS_PER_USER) return null;
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
      };
    },

    size: () => subscribers.size,

    closeAll() {
      for (const subscriber of [...subscribers]) subscriber.close();
      subscribers.clear();
    },
  };
}
