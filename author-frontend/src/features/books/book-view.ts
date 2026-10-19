// What My Books shows for each value (author/SCREENS.md A2, DESIGN_SYSTEM.md
// section 7). Unknown values get their null wording, never ₹0 or a blank.
import {
  formatCount,
  formatDate,
  formatInr,
  isBelowPayoutThreshold,
  NULL_WORDING,
  productionStage,
  type BookDto,
  type RoyaltySummaryDto,
} from "@bookleaf/shared";

export const FULLY_PAID = "Fully paid";
export const ROLLOVER_NOTE = "Below ₹1,000 payout minimum; rolls over to next quarter";

export interface BookView {
  book: BookDto;
  status: string;
  /** "Stage 3 of 9" for books in production. */
  stageCaption: string | null;
  published: string;
  mrp: string;
  copiesSold: string;
  copiesCaption: string | null;
  /** null while the book isn't on sale yet (shown as "Not yet on sale"). */
  royalties: { earned: string; paid: string; pending: string; pendingNote: string | null } | null;
  lastPayout: string;
  royaltyPerCopy: string;
  printPartner: string;
  availableOn: string;
}

const money = (value: number | null) => (value === null ? NULL_WORDING.money : formatInr(value));

/**
 * The ₹1,000 minimum applies to the author's accumulated pending royalties,
 * so a book's rollover note shows only when the author's total is below it too.
 */
function pendingNote(book: BookDto, summary: RoyaltySummaryDto): string | null {
  if (book.royaltyPending === 0 && book.totalRoyaltyEarned > 0) return FULLY_PAID;
  if (isBelowPayoutThreshold(book.royaltyPending) && summary.pendingBelowThreshold) return ROLLOVER_NOTE;
  return null;
}

export function toBookView(book: BookDto, summary: RoyaltySummaryDto): BookView {
  const stage = productionStage(book.status);
  const onSale = book.isPublished || book.totalRoyaltyEarned > 0;
  return {
    book,
    status: stage ? `In production: ${stage.stage}` : book.status,
    stageCaption: stage && stage.number > 0 ? `Stage ${stage.number} of ${stage.of}` : null,
    published: book.publicationDate ? formatDate(book.publicationDate) : NULL_WORDING.publicationDate,
    mrp: money(book.mrp),
    copiesSold: formatCount(book.totalCopiesSold),
    copiesCaption: book.isPublished ? null : NULL_WORDING.notOnSale,
    royalties: onSale
      ? {
          earned: formatInr(book.totalRoyaltyEarned),
          paid: formatInr(book.royaltyPaid),
          pending: formatInr(book.royaltyPending),
          pendingNote: pendingNote(book, summary),
        }
      : null,
    lastPayout: book.lastRoyaltyPayoutDate ? formatDate(book.lastRoyaltyPayoutDate) : NULL_WORDING.lastPayout,
    royaltyPerCopy: money(book.authorRoyaltyPerCopy),
    printPartner: book.printPartner ?? NULL_WORDING.printPartner,
    availableOn: book.availableOn.length > 0 ? book.availableOn.join(", ") : NULL_WORDING.platforms,
  };
}

/** The caption under the Pending figure. */
export function pendingCaption(summary: RoyaltySummaryDto): string {
  if (summary.totalEarned === 0) return "Royalties start once your first book is on sale";
  if (summary.totalPending === 0) return "You're fully paid up";
  if (summary.pendingBelowThreshold) {
    return `Below the ${formatInr(summary.payoutThreshold)} payout minimum; this rolls over to the next quarter`;
  }
  return `Next payout window: by ${formatDate(summary.nextPayoutDueBy, "long")}`;
}

/** "Priya" from "Priya Sharma". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
