import {
  AuthorTicketListQuerySchema,
  CreateTicketRequestSchema,
  TicketIdParamsSchema,
  businessDate,
} from "@bookleaf/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Router } from "express";
import type { Clock } from "../../lib/clock.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { authOf, authorIdOf, dbOf } from "../../middleware/authenticate.js";
import { perUserLimit } from "../../middleware/rate-limit.js";
import type { TriageControl } from "../../ai/control.js";
import type { AuditRecorder } from "../audit/service.js";
import { listBooksForAuthor } from "../books/repository.js";
import { toBookDto } from "../books/serializers.js";
import { summarizeRoyalties } from "../books/service.js";
import { BOOK_NOT_OWNED_ISSUE, type TicketsRepository } from "../tickets/repository.js";
import { toAuthorTicketDetail, toAuthorTicketSummary } from "../tickets/serializers/author.js";

export interface AuthorRouterDeps {
  clock: Clock;
  audit: AuditRecorder;
  ticketsRepository: (db: SupabaseClient) => TicketsRepository;
  triage: TriageControl;
}

const TEN_MINUTES = 10 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;
const TICKET_LIMIT_MESSAGE = "You've raised several queries recently. Please try again in a few minutes.";

/** /api/v1/author/* (role author, enforced in app.ts). */
export function createAuthorRouter({ clock, audit, ticketsRepository, triage }: AuthorRouterDeps) {
  const router = Router();
  // Created per app instance, so each limiter's counts are per process (A-15).
  const ticketLimits = [
    perUserLimit({ windowMs: TEN_MINUTES, limit: 5, message: TICKET_LIMIT_MESSAGE }),
    perUserLimit({ windowMs: ONE_DAY, limit: 20, message: "You've reached today's limit for new queries." }),
  ];

  // operationId: listAuthorBooks
  router.get("/books", async (req, res) => {
    const books = await listBooksForAuthor(dbOf(req), authorIdOf(req));
    res.json({
      data: {
        books: books.map(toBookDto),
        summary: summarizeRoyalties(books, businessDate(clock())),
      },
    });
  });

  // operationId: createAuthorTicket. Saved first: AI triage is queued after the
  // insert and can never block or fail ticket creation (C-10).
  router.post("/tickets", ...ticketLimits, async (req, res) => {
    const input = CreateTicketRequestSchema.parse(req.body);
    const auth = authOf(req);
    const authorId = authorIdOf(req);
    const repository = ticketsRepository(dbOf(req));

    if (input.bookId !== null && !(await repository.bookBelongsToAuthor(authorId, input.bookId))) {
      // Same answer for "doesn't exist" and "someone else's", so book ids can't be probed.
      throw new ValidationError(undefined, [{ path: "bookId", issue: BOOK_NOT_OWNED_ISSUE }]);
    }

    const ticket = await repository.insertTicket({
      authorId,
      bookId: input.bookId,
      subject: input.subject,
      description: input.description,
      attachmentName: input.attachmentName ?? null,
    });
    await audit({
      ticketId: ticket.id,
      actorProfileId: auth.userId,
      action: "ticket.created",
      metadata: { bookId: input.bookId },
    });
    // Saved first; triage runs in the background and can never fail this request (C-10).
    triage.enqueue(ticket.id);

    res
      .status(201)
      .location(`/api/v1/author/tickets/${ticket.id}`)
      .json({ data: toAuthorTicketDetail(ticket, [], auth.displayName) });
  });

  // operationId: listAuthorTickets
  router.get("/tickets", async (req, res) => {
    const query = AuthorTicketListQuerySchema.parse(req.query);
    const { rows, total } = await ticketsRepository(dbOf(req)).listForAuthor(authorIdOf(req), query);
    res.json({
      data: rows.map(toAuthorTicketSummary),
      meta: { page: query.page, pageSize: query.pageSize, total },
    });
  });

  // operationId: getAuthorTicket. Another author's ticket is a 404, never a 403.
  router.get("/tickets/:ticketId", async (req, res) => {
    const { ticketId } = TicketIdParamsSchema.parse(req.params);
    const repository = ticketsRepository(dbOf(req));
    const ticket = await repository.findForAuthor(authorIdOf(req), ticketId);
    if (!ticket) throw new NotFoundError("We couldn't find that ticket.");
    const messages = await repository.listThread(ticketId);
    res.json({ data: toAuthorTicketDetail(ticket, messages, authOf(req).displayName) });
  });

  return router;
}
