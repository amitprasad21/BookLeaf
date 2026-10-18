import type { BookRow } from "./repository.js";

export const PUBLISHED_STATUS = "Published & Live";

/** Book DTO (openapi.yaml components/schemas/Book). Nulls stay null: the UI shows "Not yet set", never ₹0. */
export function toBookDto(row: BookRow) {
  return {
    bookId: row.book_id,
    title: row.title,
    isbn: row.isbn,
    genre: row.genre,
    publicationDate: row.publication_date,
    status: row.status,
    isPublished: row.status === PUBLISHED_STATUS,
    mrp: row.mrp,
    authorRoyaltyPerCopy: row.author_royalty_per_copy,
    totalCopiesSold: row.total_copies_sold,
    totalRoyaltyEarned: row.total_royalty_earned,
    royaltyPaid: row.royalty_paid,
    royaltyPending: row.royalty_pending,
    lastRoyaltyPayoutDate: row.last_royalty_payout_date,
    printPartner: row.print_partner,
    availableOn: row.available_on,
  };
}
