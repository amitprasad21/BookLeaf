// Deterministic facts for the triage prompt (AI_SPEC.md sections 6 and 8):
// only the ticket's own book (or, for General / Account Level tickets, the
// author's totals) and the payout calendar. No author name, email, phone or
// city: classification doesn't need them, so they never leave the system.
import {
  isBelowPayoutThreshold,
  latestPassedPayout,
  paymentPossiblyOverdue,
  payoutCalendar,
  PAYOUT_THRESHOLD_INR,
  PUBLISHED_STATUS as PUBLISHED,
} from "@bookleaf/shared";

/** The catalogue fields the facts read (a subset of a books row). */
export interface FactsBook {
  book_id: string;
  title: string;
  status: string;
  publication_date: string | null;
  last_royalty_payout_date: string | null;
  royalty_pending: number;
}

export interface TriageFacts {
  today: string;
  book: {
    title: string;
    status: string;
    isPublished: boolean;
    publicationDate: string | null;
    lastRoyaltyPayoutDate: string | null;
    royaltyPending: number;
  } | null;
  /** Only for General / Account Level tickets. */
  authorTotals: { books: number; totalPending: number; anyPaymentPossiblyOverdue: boolean } | null;
  payout: {
    thresholdInr: number;
    lastClosedQuarter: string;
    lastClosedQuarterDueBy: string;
    nextQuarterDueBy: string;
    nextPayoutDueBy: string;
    pendingBelowThreshold: boolean;
    paymentPossiblyOverdue: boolean;
    /** Reference period for the heuristic, not a per-quarter sales ledger. */
    possiblyOverduePeriod: { quarter: string; dueBy: string } | null;
  };
}

const paise = (inr: number) => Math.round(inr * 100);

export function buildTriageFacts(
  bookId: string | null,
  authorBooks: FactsBook[],
  today: string,
): TriageFacts {
  const calendar = payoutCalendar(today);
  const overdue = (book: FactsBook) =>
    paymentPossiblyOverdue(
      {
        royaltyPending: book.royalty_pending,
        lastRoyaltyPayoutDate: book.last_royalty_payout_date,
        publicationDate: book.publication_date,
      },
      today,
    );
  const book = bookId ? (authorBooks.find((candidate) => candidate.book_id === bookId) ?? null) : null;
  const totalPending =
    authorBooks.reduce((sum, candidate) => sum + paise(candidate.royalty_pending), 0) / 100;
  const pending = book ? book.royalty_pending : totalPending;
  const possiblyOverdue = book ? overdue(book) : authorBooks.some(overdue);
  const passedPayout = latestPassedPayout(today);

  return {
    today,
    book: book && {
      title: book.title,
      status: book.status,
      isPublished: book.status === PUBLISHED,
      publicationDate: book.publication_date,
      lastRoyaltyPayoutDate: book.last_royalty_payout_date,
      royaltyPending: book.royalty_pending,
    },
    authorTotals: book
      ? null
      : {
          books: authorBooks.length,
          totalPending,
          anyPaymentPossiblyOverdue: authorBooks.some(overdue),
        },
    payout: {
      thresholdInr: PAYOUT_THRESHOLD_INR,
      lastClosedQuarter: calendar.lastClosedQuarter.label,
      lastClosedQuarterDueBy: calendar.lastClosedQuarterDueBy,
      nextQuarterDueBy: calendar.nextQuarterDueBy,
      nextPayoutDueBy: calendar.nextPayoutDueBy,
      pendingBelowThreshold: isBelowPayoutThreshold(pending),
      paymentPossiblyOverdue: possiblyOverdue,
      possiblyOverduePeriod: possiblyOverdue
        ? { quarter: passedPayout.quarter.label, dueBy: passedPayout.dueBy }
        : null,
    },
  };
}
