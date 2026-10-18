import { PAYOUT_THRESHOLD_INR, isBelowPayoutThreshold, payoutCalendar } from "@bookleaf/shared";
import type { BookRow } from "./repository.js";

// Sum money in paise so repeated additions never drift (royalties are numeric(12,2)).
const sumInr = (values: number[]) =>
  values.reduce((total, value) => total + Math.round(value * 100), 0) / 100;

/**
 * RoyaltySummary (openapi.yaml). The ₹1,000 threshold applies to the
 * author's accumulated pending royalties, so it's evaluated on the total.
 */
export function summarizeRoyalties(books: BookRow[], today: string) {
  const totalPending = sumInr(books.map((book) => book.royalty_pending));
  return {
    totalEarned: sumInr(books.map((book) => book.total_royalty_earned)),
    totalPaid: sumInr(books.map((book) => book.royalty_paid)),
    totalPending,
    payoutThreshold: PAYOUT_THRESHOLD_INR,
    pendingBelowThreshold: isBelowPayoutThreshold(totalPending),
    nextPayoutDueBy: payoutCalendar(today).nextPayoutDueBy,
  };
}
