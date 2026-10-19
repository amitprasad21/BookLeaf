// In-memory stand-ins for data access in offline route tests.
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TicketCategory, TicketPriority } from "@bookleaf/shared";
import type {
  AuditEventInput,
  SystemWriter,
  TriageTicket,
  TriageWrite,
  UsageEventInput,
} from "../src/db/system-writer.js";
import type { AdminTicketsRepository } from "../src/modules/tickets/admin-repository.js";
import type {
  AuthorTicketRow,
  NewTicket,
  ThreadMessageRow,
  TicketsRepository,
} from "../src/modules/tickets/repository.js";

type StoredTicket = AuthorTicketRow & { author_id: string };
type StoredMessage = ThreadMessageRow & { ticket_id: string };

/** Captures audit and usage events; `fail` makes every append throw. */
/** A ticket as the fake triage store holds it: the triage view plus the effective values. */
export interface FakeTriageTicket extends TriageTicket {
  category: TicketCategory | null;
  priority: TicketPriority | null;
  aiFailureReason: string | null;
  result: TriageWrite | null;
  updatedAt: string;
}

export function fakeTriageTicket(overrides: Partial<FakeTriageTicket> = {}): FakeTriageTicket {
  return {
    id: "6f9d3c1e-1d2a-4c55-9a51-1b8f2f0c0007",
    version: 1,
    authorId: "AUTH001",
    bookId: "BK001",
    subject: "Royalty for Q3 not received",
    description: "I haven't received my royalty payment for the last quarter. Could you check?",
    status: "open",
    aiStatus: "pending",
    aiAttempts: 0,
    categorySource: null,
    prioritySource: null,
    authorBooks: [
      {
        book_id: "BK001",
        title: "Whispers of the Ganges",
        status: "Published & Live",
        publication_date: "2024-01-15",
        last_royalty_payout_date: "2025-12-01",
        royalty_pending: 3570,
      },
    ],
    category: null,
    priority: null,
    aiFailureReason: null,
    result: null,
    updatedAt: "2026-10-18T06:00:00.000Z",
    ...overrides,
  };
}

/**
 * Captures audit and usage events, and holds triage tickets in memory with the
 * same rules as the real writer (version lock, admin overrides kept).
 * `fail` makes every append throw.
 */
export function recordingSystemWriter(
  options: { fail?: boolean; tokensUsedToday?: number; triageTickets?: FakeTriageTicket[] } = {},
) {
  const events: AuditEventInput[] = [];
  const usage: UsageEventInput[] = [];
  const tickets = new Map((options.triageTickets ?? []).map((ticket) => [ticket.id, ticket]));
  const bump = (ticket: FakeTriageTicket) => {
    ticket.version += 1;
    ticket.updatedAt = new Date().toISOString();
  };
  const writer: SystemWriter = {
    async appendAuditEvents(batch) {
      if (options.fail) throw new Error("audit insert failed (simulated)");
      events.push(...batch);
    },
    async appendUsageEvent(event) {
      if (options.fail) throw new Error("usage insert failed (simulated)");
      usage.push(event);
    },
    async tokensUsedSince() {
      return (
        (options.tokensUsedToday ?? 0) +
        usage.reduce((sum, event) => sum + event.inputTokens + event.outputTokens, 0)
      );
    },
    async loadTicketForTriage(ticketId) {
      const ticket = tickets.get(ticketId);
      return ticket ? structuredClone(ticket) : null;
    },
    async saveTriageResult(claim, result) {
      const ticket = tickets.get(claim.id);
      if (!ticket || ticket.version !== claim.version) return false;
      Object.assign(ticket, {
        aiStatus: "completed",
        aiAttempts: claim.aiAttempts + 1,
        aiFailureReason: null,
        result,
        ...(claim.categorySource === "admin" ? {} : { category: result.category, categorySource: "ai" }),
        ...(claim.prioritySource === "admin" ? {} : { priority: result.priority, prioritySource: "ai" }),
      });
      bump(ticket);
      return true;
    },
    async markTriageFailure(claim, reason, final) {
      const ticket = tickets.get(claim.id);
      if (!ticket || ticket.version !== claim.version) return false;
      Object.assign(ticket, {
        aiStatus: final ? "manual_review_required" : "failed",
        aiFailureReason: reason,
        aiAttempts: claim.aiAttempts + 1,
      });
      bump(ticket);
      return true;
    },
    async resetTriage(ticketId) {
      const ticket = tickets.get(ticketId);
      if (!ticket) return false;
      Object.assign(ticket, { aiStatus: "pending", aiFailureReason: null, aiAttempts: 0 });
      bump(ticket);
      return true;
    },
    async listTicketsForSweep(olderThanIso, maxAttempts, limit) {
      return [...tickets.values()]
        .filter(
          (ticket) =>
            (ticket.aiStatus === "pending" || ticket.aiStatus === "failed") &&
            ticket.aiAttempts < maxAttempts &&
            ticket.updatedAt < olderThanIso,
        )
        .slice(0, limit)
        .map((ticket) => ticket.id);
    },
  };
  return { writer, events, usage, tickets };
}

/**
 * Ticket store with the same author scoping as the real repository. `books`
 * says which author owns which book (for the ownership check and embedding).
 */
export function fakeTicketsStore(books: { book_id: string; author_id: string; title: string }[]) {
  const tickets: StoredTicket[] = [];
  const messages: StoredMessage[] = [];
  let referenceNo = 1000;
  let tick = 0;
  // Strictly increasing timestamps so "newest activity first" is deterministic.
  const nextTimestamp = () => new Date(Date.UTC(2026, 9, 16, 6, 0, tick++)).toISOString();

  const repository: TicketsRepository = {
    async bookBelongsToAuthor(authorId, bookId) {
      return books.some((book) => book.book_id === bookId && book.author_id === authorId);
    },
    async insertTicket(ticket: NewTicket) {
      const now = nextTimestamp();
      const book = books.find((candidate) => candidate.book_id === ticket.bookId);
      const row: StoredTicket = {
        id: randomUUID(),
        reference: `BL-${(referenceNo += 1)}`,
        author_id: ticket.authorId,
        subject: ticket.subject,
        description: ticket.description,
        attachment_name: ticket.attachmentName,
        status: "open",
        book_id: ticket.bookId,
        created_at: now,
        updated_at: now,
        first_response_at: null,
        book: book ? { book_id: book.book_id, title: book.title } : null,
      };
      tickets.push(row);
      return row;
    },
    async listForAuthor(authorId, query) {
      const visible = tickets
        .filter((ticket) => ticket.author_id === authorId)
        .filter((ticket) => !query.status?.length || query.status.includes(ticket.status))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      const from = (query.page - 1) * query.pageSize;
      return { rows: visible.slice(from, from + query.pageSize), total: visible.length };
    },
    async findForAuthor(authorId, ticketId) {
      return tickets.find((ticket) => ticket.id === ticketId && ticket.author_id === authorId) ?? null;
    },
    async listThread(ticketId) {
      return messages.filter((message) => message.ticket_id === ticketId);
    },
  };

  return {
    factory: () => repository,
    tickets,
    /** Simulate a reply or follow-up (API-7 and P2 write paths don't exist yet). */
    addMessage(ticketId: string, sender: "author" | "admin", body: string) {
      const ticket = tickets.find((candidate) => candidate.id === ticketId)!;
      const now = nextTimestamp();
      messages.push({ id: randomUUID(), ticket_id: ticketId, sender_role: sender, body, created_at: now });
      ticket.updated_at = now;
      if (sender === "admin" && ticket.first_response_at === null) ticket.first_response_at = now;
    },
  };
}

/** One recorded query-builder call, e.g. ["in", "status", ["open"]]. */
export type BuilderCall = [method: string, ...args: unknown[]];

/**
 * Records every call made on Supabase query builders, per `from()` table, and
 * resolves with the canned result for that table. Lets offline tests check the
 * exact filters a repository sends without a database.
 */
type CannedResult = { data?: unknown; count?: number; error?: { code: string; message: string } | null };

export function recordingSupabase(
  results: Record<string, CannedResult | ((calls: BuilderCall[], index: number) => CannedResult)> = {},
) {
  const queries: { table: string; calls: BuilderCall[] }[] = [];
  /** `table` is the from() table, or "rpc:<function>" for rpc() calls. */
  const start = (table: string, firstCall?: BuilderCall) => {
    const query = { table, calls: firstCall ? [firstCall] : ([] as BuilderCall[]) };
    queries.push(query);
    const builder: object = new Proxy(
      {},
      {
        get(_target, method: string) {
          if (method === "then") {
            const canned = results[table];
            const value = typeof canned === "function" ? canned(query.calls, queries.indexOf(query)) : canned;
            const result = {
              data: value?.error ? null : value && "data" in value ? value.data : [],
              count: value?.count ?? 0,
              error: value?.error ?? null,
            };
            return (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
          }
          return (...args: unknown[]) => {
            query.calls.push([method, ...args]);
            return builder;
          };
        },
      },
    );
    return builder;
  };
  const db = {
    from: (table: string) => start(table),
    rpc: (fn: string, args: unknown) => start(`rpc:${fn}`, ["rpc", fn, args]),
  } as unknown as SupabaseClient;
  return { db, queries };
}

/** An admin repository whose methods throw unless the test supplies them. */
export function adminRepository(methods: Partial<AdminTicketsRepository>): AdminTicketsRepository {
  const unused = (name: string) => async (): Promise<never> => {
    throw new Error(`${name} isn't used by this test`);
  };
  return {
    listQueue: unused("listQueue"),
    summary: unused("summary"),
    findTicket: unused("findTicket"),
    findDetail: unused("findDetail"),
    updateIfVersion: unused("updateIfVersion"),
    sendReply: unused("sendReply"),
    listNotes: unused("listNotes"),
    addNote: unused("addNote"),
    countAuditEvents: unused("countAuditEvents"),
    findReadyDraft: unused("findReadyDraft"),
    insertDraft: unused("insertDraft"),
    supersedeOtherDrafts: unused("supersedeOtherDrafts"),
    ...methods,
  };
}
