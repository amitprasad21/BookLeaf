// Real-time ticket events (INTEGRATION_CONTRACT.md section 9). The stream
// carries identifiers and change names only; clients re-fetch through the
// authorised REST endpoints, so an event can never leak ticket content.

export const TICKET_EVENT_TYPES = [
  "ticket.created", // admins
  "ticket.updated", // the ticket's author + admins: status or author-visible messages
  "ticket.triaged", // admins: AI triage finished (or gave up)
  "ticket.internal_updated", // admins: notes, overrides, assignment, AI re-run
] as const;
export type TicketEventType = (typeof TICKET_EVENT_TYPES)[number];

export const TICKET_CHANGES = [
  "created",
  "status",
  "messages",
  "category",
  "priority",
  "assignee",
  "notes",
  "ai",
] as const;
export type TicketChange = (typeof TICKET_CHANGES)[number];

export interface TicketEvent {
  type: TicketEventType;
  ticketId: string;
  changes: TicketChange[];
  at: string;
}

/** One SSE frame: `event: <type>` and `data: {"ticketId","changes","at"}`. */
export function formatSseEvent(event: TicketEvent): string {
  const data = JSON.stringify({ ticketId: event.ticketId, changes: event.changes, at: event.at });
  return `event: ${event.type}\ndata: ${data}\n\n`;
}

export interface SseMessage {
  event: string;
  data: string;
}

/**
 * Incremental SSE parser (the subset the API sends): `event:` and `data:`
 * fields, comment lines, LF or CRLF line ends, frames split across chunks.
 */
export function createSseParser(onMessage: (message: SseMessage) => void) {
  let buffer = "";
  let event = "";
  let data: string[] = [];

  const dispatch = () => {
    if (data.length > 0) onMessage({ event: event || "message", data: data.join("\n") });
    event = "";
    data = [];
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      let newline = buffer.search(/\r?\n/);
      while (newline !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(buffer[newline] === "\r" ? newline + 2 : newline + 1);
        if (line === "") dispatch();
        else if (!line.startsWith(":")) {
          const colon = line.indexOf(":");
          const field = colon === -1 ? line : line.slice(0, colon);
          const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
          if (field === "event") event = value;
          else if (field === "data") data.push(value);
        }
        newline = buffer.search(/\r?\n/);
      }
    },
  };
}

const isType = (value: string): value is TicketEventType =>
  (TICKET_EVENT_TYPES as readonly string[]).includes(value);

/** A parsed SSE message as a ticket event, or null for anything else. */
export function toTicketEvent(message: SseMessage): TicketEvent | null {
  if (!isType(message.event)) return null;
  try {
    const value = JSON.parse(message.data) as Partial<TicketEvent>;
    if (typeof value.ticketId !== "string" || typeof value.at !== "string" || !Array.isArray(value.changes)) {
      return null;
    }
    const changes = value.changes.filter((change): change is TicketChange =>
      (TICKET_CHANGES as readonly string[]).includes(change as string),
    );
    return { type: message.event, ticketId: value.ticketId, changes, at: value.at };
  } catch {
    return null;
  }
}
