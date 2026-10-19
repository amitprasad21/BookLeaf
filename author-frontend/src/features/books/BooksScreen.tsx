"use client";
// A2. My Books (author/SCREENS.md, author/STATES.md): royalty summary, then a
// table from 1024 px and cards below it.
import { formatInr, type AuthorBooksDto } from "@bookleaf/shared";
import {
  buttonClassName,
  Disclosure,
  EmptyState,
  ErrorState,
  KeyFigure,
  KeyFigures,
  LoadingState,
  PageHeader,
  PlusIcon,
  Skeleton,
} from "@bookleaf/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { api, isApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import { useMe } from "@/providers/SessionProvider";
import { firstName, pendingCaption, toBookView, type BookView } from "./book-view";
import styles from "./books.module.css";

const FOOTNOTE =
  "Royalties are calculated quarterly and paid by bank transfer within 45 days of each quarter ending.";

const askHref = (bookId: string) => `/tickets/new?bookId=${encodeURIComponent(bookId)}`;

export function BooksScreen() {
  const me = useMe();
  const books = useQuery({
    queryKey: queryKeys.books,
    queryFn: ({ signal }) => api.get<AuthorBooksDto>("/author/books", { signal }).then((body) => body.data),
  });

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName(me.author?.name ?? me.displayName)}`}
        actions={
          <Link href="/tickets/new" className={buttonClassName({ variant: "primary" })}>
            <PlusIcon />
            Raise a query
          </Link>
        }
      />
      {books.isPending ? (
        <BooksLoading />
      ) : books.isError ? (
        <ErrorState
          title="We couldn't load your books."
          description="Please try again in a moment."
          requestId={isApiError(books.error) ? books.error.requestId : null}
          onRetry={() => void books.refetch()}
        />
      ) : (
        <BooksContent data={books.data} />
      )}
    </>
  );
}

function BooksLoading() {
  return (
    <LoadingState label="Loading your books…">
      <div className={styles.skeletonFigures}>
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} height="6.5rem" />
        ))}
      </div>
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} height="3.5rem" />
      ))}
    </LoadingState>
  );
}

function BooksContent({ data }: { data: AuthorBooksDto }) {
  const { summary } = data;
  const views = data.books.map((book) => toBookView(book, summary));
  return (
    <>
      <section aria-labelledby="royalties-heading">
        <h2 id="royalties-heading" className={styles.sectionTitle}>
          Your royalties
        </h2>
        <KeyFigures>
          <KeyFigure label="Total earned" value={formatInr(summary.totalEarned)} />
          <KeyFigure label="Paid to you" value={formatInr(summary.totalPaid)} />
          <KeyFigure
            label="Pending"
            value={formatInr(summary.totalPending)}
            caption={pendingCaption(summary)}
          />
        </KeyFigures>
        <p className={styles.footnote}>{FOOTNOTE}</p>
      </section>

      <section aria-labelledby="books-heading" className={styles.section}>
        <h2 id="books-heading" className={styles.sectionTitle}>
          Your books
        </h2>
        {views.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title="You don't have any books with us yet."
            description="When your first manuscript is received it will appear here."
          />
        ) : (
          <>
            <div className={styles.tableView}>
              <BooksTable views={views} />
            </div>
            <ul className={styles.cardView}>
              {views.map((view) => (
                <BookCard key={view.book.bookId} view={view} />
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

function Royalties({ view }: { view: BookView }) {
  if (!view.royalties) return <span className="bl-muted">Not yet on sale</span>;
  const { earned, paid, pending, pendingNote } = view.royalties;
  return (
    <>
      <dl className={styles.royalties}>
        <div>
          <dt>Earned</dt>
          <dd>{earned}</dd>
        </div>
        <div>
          <dt>Paid</dt>
          <dd>{paid}</dd>
        </div>
        <div>
          <dt>Pending</dt>
          <dd>{pending}</dd>
        </div>
      </dl>
      {pendingNote ? <p className={styles.note}>{pendingNote}</p> : null}
    </>
  );
}

function MoreFacts({ view }: { view: BookView }) {
  return (
    <dl className="bl-facts">
      <div>
        <dt>Royalty per copy</dt>
        <dd>{view.royaltyPerCopy}</dd>
      </div>
      <div>
        <dt>Print partner</dt>
        <dd>{view.printPartner}</dd>
      </div>
      <div>
        <dt>Available on</dt>
        <dd>{view.availableOn}</dd>
      </div>
    </dl>
  );
}

function StatusCell({ view }: { view: BookView }) {
  return (
    <>
      {view.status}
      {view.stageCaption ? <span className={styles.caption}>{view.stageCaption}</span> : null}
    </>
  );
}

const COLUMNS = 9;

function BooksTable({ views }: { views: BookView[] }) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggle = (bookId: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });

  return (
    <div className="bl-table-wrap">
      <table className="bl-table">
        <caption className="bl-sr-only">Your books with sales and royalties</caption>
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">ISBN</th>
            <th scope="col">Status</th>
            <th scope="col">Published</th>
            <th scope="col" className="bl-num">
              MRP
            </th>
            <th scope="col" className="bl-num">
              Copies sold
            </th>
            <th scope="col">Royalties</th>
            <th scope="col">Last payout</th>
            <th scope="col">
              <span className="bl-sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {views.map((view) => {
            const { bookId, title, genre, isbn } = view.book;
            const open = expanded.has(bookId);
            const detailsId = `book-details-${bookId}`;
            return [
              <tr key={bookId}>
                <th scope="row" className={styles.titleCell}>
                  {title}
                  <span className={styles.caption}>{genre}</span>
                </th>
                <td className="bl-mono">{isbn}</td>
                <td>
                  <StatusCell view={view} />
                </td>
                <td>{view.published}</td>
                <td className="bl-num">{view.mrp}</td>
                <td className="bl-num">
                  {view.copiesSold}
                  {view.copiesCaption ? <span className={styles.caption}>{view.copiesCaption}</span> : null}
                </td>
                <td>
                  <Royalties view={view} />
                </td>
                <td>{view.lastPayout}</td>
                <td>
                  <div className={styles.actions}>
                    <Link href={askHref(bookId)} className={styles.actionLink}>
                      Ask about this book<span className="bl-sr-only">: {title}</span>
                    </Link>
                    <button
                      type="button"
                      className={styles.toggle}
                      aria-expanded={open}
                      aria-controls={detailsId}
                      onClick={() => toggle(bookId)}
                    >
                      {open ? "Hide details" : "More details"}
                      <span className="bl-sr-only">: {title}</span>
                    </button>
                  </div>
                </td>
              </tr>,
              <tr key={`${bookId}-details`} id={detailsId} hidden={!open} className={styles.detailRow}>
                <td colSpan={COLUMNS}>
                  <MoreFacts view={view} />
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

function BookCard({ view }: { view: BookView }) {
  const { bookId, title, genre, isbn } = view.book;
  return (
    <li className={styles.card}>
      <article aria-labelledby={`book-${bookId}`}>
        <h3 id={`book-${bookId}`} className={styles.cardTitle}>
          {title}
        </h3>
        <p className={styles.cardGenre}>{genre}</p>
        <p className={styles.cardStatus}>
          <StatusCell view={view} />
        </p>
        <dl className={`bl-facts ${styles.cardFacts}`}>
          <div>
            <dt>ISBN</dt>
            <dd className="bl-mono">{isbn}</dd>
          </div>
          <div>
            <dt>Published</dt>
            <dd>{view.published}</dd>
          </div>
          <div>
            <dt>MRP</dt>
            <dd>{view.mrp}</dd>
          </div>
          <div>
            <dt>Copies sold</dt>
            <dd>
              {view.copiesSold}
              {view.copiesCaption ? ` · ${view.copiesCaption}` : null}
            </dd>
          </div>
          <div>
            <dt>Last payout</dt>
            <dd>{view.lastPayout}</dd>
          </div>
        </dl>
        <div className={styles.cardRoyalties}>
          <Royalties view={view} />
        </div>
        <Disclosure summary="More details">
          <MoreFacts view={view} />
        </Disclosure>
        <Link href={askHref(bookId)} className={buttonClassName({ className: styles.cardAction })}>
          Ask about this book<span className="bl-sr-only">: {title}</span>
        </Link>
      </article>
    </li>
  );
}
