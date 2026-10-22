// Deterministic facts for reply drafts (AI_SPEC.md section 8), built from
// data the admin is already authorised to see. Only what a reply can use:
// the author's first name (never email, phone or city), the ticket's book,
// the payout calendar and, for unpublished books, where production stands.
import {
  isBelowPayoutThreshold,
  latestPassedPayout,
  paymentPossiblyOverdue,
  payoutCalendar,
  PAYOUT_THRESHOLD_INR,
  PRODUCTION_STAGES,
  productionStage,
  PUBLISHED_STATUS as PUBLISHED,
  type TicketCategory,
} from "@bookleaf/shared";
import type { BookRow } from "../../modules/books/repository.js";

/** Where the KB says delays typically happen. */
const KNOWN_DELAY_POINTS = new Set(["Cover Design", "Proofreading"]);

export interface DraftFacts {
  today: string;
  author: { firstName: string };
  book: {
    bookId: string;
    title: string;
    isbn: string;
    status: string;
    isPublished: boolean;
    publicationDate: string | null;
    mrp: number | null;
    royaltyPerCopy: number | null;
    totalCopiesSold: number;
    totalRoyaltyEarned: number;
    royaltyPaid: number;
    royaltyPending: number;
    lastRoyaltyPayoutDate: string | null;
    availableOn: string[];
  } | null;
  /** General / Account Level tickets about royalties or general matters only: up to 10 of the author's books. */
  authorBooks:
    { title: string; status: string; royaltyPending: number; lastRoyaltyPayoutDate: string | null }[] | null;
  payout: {
    thresholdInr: number;
    lastClosedQuarter: string;
    lastClosedQuarterDueBy: string;
    currentQuarterEnd: string;
    nextQuarterDueBy: string;
    nextPayoutDueBy: string;
    pendingBelowThreshold: boolean;
    paymentPossiblyOverdue: boolean;
    /** Reference period for the heuristic, not a per-quarter sales ledger. */
    possiblyOverduePeriod: { quarter: string; dueBy: string } | null;
  };
  production: {
    currentStage: string;
    stageNumber: number;
    of: number;
    nextStage: string | null;
    knownDelayPoint: boolean;
  } | null;
}

export interface DraftFactsInput {
  authorName: string;
  bookId: string | null;
  category: TicketCategory;
  books: BookRow[];
}

const paise = (inr: number) => Math.round(inr * 100);

function production(status: string): DraftFacts["production"] {
  const current = productionStage(status);
  if (!current) return null;
  const known = current.number > 0;
  return {
    currentStage: current.stage,
    stageNumber: current.number,
    of: current.of,
    nextStage: known ? (PRODUCTION_STAGES[current.number] ?? null) : null,
    knownDelayPoint: known && KNOWN_DELAY_POINTS.has(current.stage),
  };
}

export function buildDraftFacts(input: DraftFactsInput, today: string): DraftFacts {
  const calendar = payoutCalendar(today);
  const overdue = (book: BookRow) =>
    paymentPossiblyOverdue(
      {
        royaltyPending: book.royalty_pending,
        lastRoyaltyPayoutDate: book.last_royalty_payout_date,
        publicationDate: book.publication_date,
      },
      today,
    );
  const book = input.bookId
    ? (input.books.find((candidate) => candidate.book_id === input.bookId) ?? null)
    : null;
  const totalPending =
    input.books.reduce((sum, candidate) => sum + paise(candidate.royalty_pending), 0) / 100;
  const listAuthorBooks =
    !book && (input.category === "royalty_payments" || input.category === "general_inquiry");
  const possiblyOverdue = book ? overdue(book) : input.books.some(overdue);
  const passedPayout = latestPassedPayout(today);

  return {
    today,
    author: { firstName: input.authorName.trim().split(/\s+/)[0] ?? input.authorName },
    book: book && {
      bookId: book.book_id,
      title: book.title,
      isbn: book.isbn,
      status: book.status,
      isPublished: book.status === PUBLISHED,
      publicationDate: book.publication_date,
      mrp: book.mrp,
      royaltyPerCopy: book.author_royalty_per_copy,
      totalCopiesSold: book.total_copies_sold,
      totalRoyaltyEarned: book.total_royalty_earned,
      royaltyPaid: book.royalty_paid,
      royaltyPending: book.royalty_pending,
      lastRoyaltyPayoutDate: book.last_royalty_payout_date,
      availableOn: book.available_on,
    },
    authorBooks: listAuthorBooks
      ? input.books.slice(0, 10).map((candidate) => ({
          title: candidate.title,
          status: candidate.status,
          royaltyPending: candidate.royalty_pending,
          lastRoyaltyPayoutDate: candidate.last_royalty_payout_date,
        }))
      : null,
    payout: {
      thresholdInr: PAYOUT_THRESHOLD_INR,
      lastClosedQuarter: calendar.lastClosedQuarter.label,
      lastClosedQuarterDueBy: calendar.lastClosedQuarterDueBy,
      currentQuarterEnd: calendar.nextQuarterEnd,
      nextQuarterDueBy: calendar.nextQuarterDueBy,
      nextPayoutDueBy: calendar.nextPayoutDueBy,
      pendingBelowThreshold: isBelowPayoutThreshold(book ? book.royalty_pending : totalPending),
      paymentPossiblyOverdue: possiblyOverdue,
      possiblyOverduePeriod: possiblyOverdue
        ? { quarter: passedPayout.quarter.label, dueBy: passedPayout.dueBy }
        : null,
    },
    production: book ? production(book.status) : null,
  };
}
