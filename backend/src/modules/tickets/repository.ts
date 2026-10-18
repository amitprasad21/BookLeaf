import type { AuthorTicketListQuery, TicketStatus } from "@bookleaf/shared";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ForbiddenError, RateLimitedError, ValidationError } from "../../lib/errors.js";

export interface AuthorTicketRow {
  id: string;
  reference: string;
  subject: string;
  description?: string;
  attachment_name?: string | null;
  status: TicketStatus;
  book_id: string | null;
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
  book: { book_id: string; title: string } | null;
}

export interface ThreadMessageRow {
  id: string;
  sender_role: "author" | "admin";
  body: string;
  created_at: string;
}

export interface NewTicket {
  authorId: string;
  bookId: string | null;
  subject: string;
  description: string;
  attachmentName: string | null;
}

/** Author-side ticket data access. Every method is scoped to one author. */
export interface TicketsRepository {
  bookBelongsToAuthor(authorId: string, bookId: string): Promise<boolean>;
  insertTicket(ticket: NewTicket): Promise<AuthorTicketRow>;
  listForAuthor(
    authorId: string,
    query: AuthorTicketListQuery,
  ): Promise<{ rows: AuthorTicketRow[]; total: number }>;
  findForAuthor(authorId: string, ticketId: string): Promise<AuthorTicketRow | null>;
  listThread(ticketId: string): Promise<ThreadMessageRow[]>;
}

// Author paths never select AI, priority, category, assignment or version columns.
const SUMMARY_COLUMNS =
  "id, reference, subject, status, book_id, created_at, updated_at, first_response_at, book:books(book_id, title)";
const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, description, attachment_name`;

export const BOOK_NOT_OWNED_ISSUE = "must be one of your books, or null for General / Account Level";

/** Translate database errors into API errors; anything unexpected stays a generic 500. */
export function mapPostgrestError(error: Pick<PostgrestError, "code" | "message">, operation: string): Error {
  if (error.message === "rate_limited") {
    return new RateLimitedError(
      600,
      "You've raised several queries recently. Please try again in a few minutes.",
    );
  }
  if (error.code === "23503")
    return new ValidationError(undefined, [{ path: "bookId", issue: BOOK_NOT_OWNED_ISSUE }]);
  if (error.code === "23514") return new ValidationError();
  if (error.code === "42501") return new ForbiddenError();
  return new Error(`${operation} failed (${error.code})`);
}

/**
 * Supabase implementation over the caller's RLS-scoped client. Queries also
 * filter by author explicitly (defense in depth); inserts rely on the DB-3
 * insert policy plus the composite FK that ties a ticket's book to its author.
 */
export function createTicketsRepository(db: SupabaseClient): TicketsRepository {
  return {
    async bookBelongsToAuthor(authorId, bookId) {
      const { data, error } = await db
        .from("books")
        .select("book_id")
        .eq("author_id", authorId)
        .eq("book_id", bookId)
        .maybeSingle();
      if (error) throw mapPostgrestError(error, "book ownership check");
      return data !== null;
    },

    async insertTicket(ticket) {
      const { data, error } = await db
        .from("tickets")
        .insert({
          author_id: ticket.authorId,
          book_id: ticket.bookId,
          subject: ticket.subject,
          description: ticket.description,
          attachment_name: ticket.attachmentName,
        })
        .select(DETAIL_COLUMNS)
        .single();
      if (error) throw mapPostgrestError(error, "ticket insert");
      return data as unknown as AuthorTicketRow;
    },

    async listForAuthor(authorId, query) {
      const from = (query.page - 1) * query.pageSize;
      let request = db
        .from("tickets")
        .select(SUMMARY_COLUMNS, { count: "exact" })
        .eq("author_id", authorId)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, from + query.pageSize - 1);
      if (query.status?.length) request = request.in("status", query.status);
      const { data, error, count } = await request;
      if (error) throw mapPostgrestError(error, "ticket list");
      return { rows: (data ?? []) as unknown as AuthorTicketRow[], total: count ?? 0 };
    },

    async findForAuthor(authorId, ticketId) {
      const { data, error } = await db
        .from("tickets")
        .select(DETAIL_COLUMNS)
        .eq("id", ticketId)
        .eq("author_id", authorId)
        .maybeSingle();
      if (error) throw mapPostgrestError(error, "ticket lookup");
      return data as unknown as AuthorTicketRow | null;
    },

    async listThread(ticketId) {
      const { data, error } = await db
        .from("ticket_messages")
        .select("id, sender_role, body, created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw mapPostgrestError(error, "thread lookup");
      return (data ?? []) as ThreadMessageRow[];
    },
  };
}
