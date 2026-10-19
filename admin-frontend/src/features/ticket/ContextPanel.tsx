// Author context (admin/SCREENS.md M3): who wrote in and where their books
// stand, with the same null wording as the author portal.
import {
  formatDate,
  formatInr,
  NULL_WORDING,
  productionStage,
  type AdminTicketDetailDto,
  type BookDto,
} from "@bookleaf/shared";
import { Badge, cx, Panel } from "@bookleaf/ui";
import styles from "./ticket.module.css";

function bookStatus(book: BookDto): string {
  const stage = productionStage(book.status);
  if (!stage) return book.status;
  return stage.number > 0
    ? `In production: ${stage.stage} (stage ${stage.number} of ${stage.of})`
    : `In production: ${stage.stage}`;
}

const onSale = (book: BookDto) => book.isPublished || book.totalRoyaltyEarned > 0;

export function ContextPanel({ ticket }: { ticket: AdminTicketDetailDto }) {
  const { author, books } = ticket.authorContext;
  return (
    <Panel title="Author" headingLevel={2}>
      <dl className="bl-facts">
        <div>
          <dt>Name</dt>
          <dd>{author.name}</dd>
        </div>
        <div>
          <dt>Author ID</dt>
          <dd className="bl-mono">{author.authorId}</dd>
        </div>
        <div>
          <dt>City</dt>
          <dd>{author.city ?? "Not given"}</dd>
        </div>
        <div>
          <dt>With BookLeaf since</dt>
          <dd>{formatDate(author.joinedDate, "long")}</dd>
        </div>
      </dl>

      <h3 className={styles.subheading}>Books</h3>
      {books.length === 0 ? (
        <p className="bl-muted">No books yet.</p>
      ) : (
        <ul className={styles.books}>
          {books.map((book) => {
            const current = ticket.book?.bookId === book.bookId;
            return (
              <li key={book.bookId} className={cx(styles.book, current && styles.bookCurrent)}>
                <p className={styles.bookTitle}>
                  {book.title}
                  {current ? <Badge variant="strong">This ticket</Badge> : null}
                </p>
                <p className={styles.bookMeta}>
                  <span className="bl-mono">{book.bookId}</span> · {bookStatus(book)}
                </p>
                <dl className={`bl-facts ${styles.bookFacts}`}>
                  <div>
                    <dt>Earned / paid</dt>
                    <dd>
                      {onSale(book)
                        ? `${formatInr(book.totalRoyaltyEarned)} / ${formatInr(book.royaltyPaid)}`
                        : NULL_WORDING.notOnSale}
                    </dd>
                  </div>
                  <div>
                    <dt>Pending royalty</dt>
                    <dd>{onSale(book) ? formatInr(book.royaltyPending) : NULL_WORDING.notOnSale}</dd>
                  </div>
                  <div>
                    <dt>Last payout</dt>
                    <dd>
                      {book.lastRoyaltyPayoutDate
                        ? formatDate(book.lastRoyaltyPayoutDate)
                        : NULL_WORDING.lastPayout}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
