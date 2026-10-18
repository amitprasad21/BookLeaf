import { businessDate } from "@bookleaf/shared";
import { Router } from "express";
import type { Clock } from "../../lib/clock.js";
import { authorIdOf, dbOf } from "../../middleware/authenticate.js";
import { listBooksForAuthor } from "../books/repository.js";
import { toBookDto } from "../books/serializers.js";
import { summarizeRoyalties } from "../books/service.js";

export interface AuthorRouterDeps {
  clock: Clock;
}

/** /api/v1/author/* (role author, enforced in app.ts). Ticket routes arrive in API-4. */
export function createAuthorRouter({ clock }: AuthorRouterDeps) {
  const router = Router();

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

  return router;
}
