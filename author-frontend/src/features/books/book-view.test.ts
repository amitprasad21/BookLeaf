// My Books rendering rules (author TEST_PLAN AT-01..03), using the dataset's
// own book shapes.
import type { BookDto, RoyaltySummaryDto } from "@bookleaf/shared";
import { describe, expect, it } from "vitest";
import {
  FULLY_PAID,
  ROLLOVER_NOTE,
  bookStatusText,
  firstName,
  pendingCaption,
  toBookView,
} from "./book-view";

const book = (overrides: Partial<BookDto>): BookDto => ({
  bookId: "BK001",
  title: "The Silent River",
  isbn: "978-93-00000-01-1",
  genre: "Literary Fiction",
  publicationDate: "2023-06-20",
  status: "Published & Live",
  isPublished: true,
  mrp: 399,
  authorRoyaltyPerCopy: 30,
  totalCopiesSold: 399,
  totalRoyaltyEarned: 11970,
  royaltyPaid: 8400,
  royaltyPending: 3570,
  lastRoyaltyPayoutDate: "2025-10-15",
  printPartner: "In-House",
  availableOn: ["Amazon India", "Flipkart", "BookLeaf Store"],
  ...overrides,
});

const summary = (overrides: Partial<RoyaltySummaryDto> = {}): RoyaltySummaryDto => ({
  totalEarned: 11970,
  totalPaid: 8400,
  totalPending: 3570,
  payoutThreshold: 1000,
  pendingBelowThreshold: false,
  nextPayoutDueBy: "2026-11-14",
  ...overrides,
});

// BK013: in production, nothing set yet.
const inProduction = book({
  bookId: "BK013",
  status: "In Production - Cover Design",
  isPublished: false,
  publicationDate: null,
  mrp: null,
  authorRoyaltyPerCopy: null,
  totalCopiesSold: 0,
  totalRoyaltyEarned: 0,
  royaltyPaid: 0,
  royaltyPending: 0,
  lastRoyaltyPayoutDate: null,
  printPartner: null,
  availableOn: [],
});

describe("a book in production (AT-01)", () => {
  const view = toBookView(inProduction, summary());

  it("uses the null wording, never ₹0 for unset values", () => {
    expect(view.mrp).toBe("Not yet set");
    expect(view.royaltyPerCopy).toBe("Not yet set");
    expect(view.published).toBe("Not yet published");
    expect(view.lastPayout).toBe("No payout yet");
    expect(view.printPartner).toBe("Not assigned yet");
    expect(view.availableOn).toBe("Not listed yet");
    expect(view.royalties).toBeNull();
  });

  it("shows the stage and that it isn't on sale yet", () => {
    expect(view.status).toBe("In production: Cover Design");
    expect(view.stageCaption).toBe("Stage 3 of 9");
    expect(view.copiesSold).toBe("0");
    expect(view.copiesCaption).toBe("Not yet on sale");
  });
});

describe("a published book", () => {
  it("formats money, dates and platforms (AT-10)", () => {
    const view = toBookView(book({}), summary());
    expect(view.mrp).toBe("₹399");
    expect(view.published).toBe("20 Jun 2023");
    expect(view.royalties).toEqual({
      earned: "₹11,970",
      paid: "₹8,400",
      pending: "₹3,570",
      pendingNote: null,
    });
    expect(view.availableOn).toBe("Amazon India, Flipkart, BookLeaf Store");
    expect(view.stageCaption).toBeNull();
  });

  it("notes a balance below the payout minimum when the author's total is below it too (AT-02, BK016)", () => {
    const bk016 = book({ bookId: "BK016", totalRoyaltyEarned: 850, royaltyPaid: 0, royaltyPending: 850 });
    const view = toBookView(bk016, summary({ totalPending: 850, pendingBelowThreshold: true }));
    expect(view.royalties?.pendingNote).toBe(ROLLOVER_NOTE);
    expect(view.royalties?.pending).toBe("₹850");
  });

  it("doesn't note a small balance when the author's total will be paid", () => {
    const small = book({ royaltyPending: 850 });
    expect(toBookView(small, summary({ totalPending: 4420 })).royalties?.pendingNote).toBeNull();
  });

  it("says fully paid when nothing is pending (AT-03, BK002)", () => {
    const bk002 = book({ bookId: "BK002", totalRoyaltyEarned: 7938, royaltyPaid: 7938, royaltyPending: 0 });
    const view = toBookView(bk002, summary());
    expect(view.royalties?.pendingNote).toBe(FULLY_PAID);
    expect(view.royalties?.pending).toBe("₹0");
  });
});

describe("the Pending caption", () => {
  it("gives the next payout window", () => {
    expect(pendingCaption(summary())).toBe("Next payout window: by 14 November 2026");
  });

  it("explains the rollover below ₹1,000", () => {
    expect(pendingCaption(summary({ totalPending: 850, pendingBelowThreshold: true }))).toBe(
      "Below the ₹1,000 payout minimum; this rolls over to the next quarter",
    );
  });

  it("says fully paid up, or that royalties haven't started", () => {
    expect(pendingCaption(summary({ totalPending: 0 }))).toBe("You're fully paid up");
    expect(pendingCaption(summary({ totalEarned: 0, totalPaid: 0, totalPending: 0 }))).toBe(
      "Royalties start once your first book is on sale",
    );
  });
});

describe("bookStatusText", () => {
  it("matches the wording used on My Books and in the query form", () => {
    expect(bookStatusText("In Production - Cover Design")).toBe("In production: Cover Design");
    expect(bookStatusText("Published & Live")).toBe("Published & Live");
  });
});

describe("firstName", () => {
  it("takes the first word", () => {
    expect(firstName("Priya Sharma")).toBe("Priya");
    expect(firstName("  Sneha  Kulkarni ")).toBe("Sneha");
  });
});
