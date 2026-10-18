// Royalty payout calendar from the BookLeaf Knowledge Base: royalties are
// calculated per calendar quarter and paid within 45 days of the quarter
// ending; accumulated royalties below ₹1,000 roll over to the next quarter.
// Pure functions over ISO business dates ("YYYY-MM-DD", Asia/Kolkata).
// Assumptions A-02 (calendar quarters), A-03 (45 calendar days), A-04 (time zone).

export const PAYOUT_THRESHOLD_INR = 1000;
export const PAYOUT_WINDOW_DAYS = 45;
export const BUSINESS_TIME_ZONE = "Asia/Kolkata";

export interface Quarter {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  start: string;
  end: string;
  /** e.g. "July–September 2026" */
  label: string;
}

export interface PayoutCalendar {
  today: string;
  currentQuarter: Quarter;
  lastClosedQuarter: Quarter;
  /** Payout deadline for royalties earned in the last closed quarter. */
  lastClosedQuarterDueBy: string;
  nextQuarterEnd: string;
  nextQuarterDueBy: string;
  /** The earliest payout deadline that hasn't passed yet. */
  nextPayoutDueBy: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function parts(date: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Not an ISO date: ${date}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Today's date in BookLeaf's business time zone. */
export function businessDate(now: Date, timeZone: string = BUSINESS_TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = parts(date);
  return isoDate(new Date(Date.UTC(year, month - 1, day + days)));
}

function makeQuarter(year: number, quarter: Quarter["quarter"]): Quarter {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  return {
    year,
    quarter,
    start: `${year}-${String(startMonth).padStart(2, "0")}-01`,
    end: isoDate(new Date(Date.UTC(year, endMonth, 0))), // day 0 of the next month = last day of endMonth
    label: `${MONTHS[startMonth - 1]}–${MONTHS[endMonth - 1]} ${year}`,
  };
}

export function quarterOf(date: string): Quarter {
  const [year, month] = parts(date);
  return makeQuarter(year, Math.ceil(month / 3) as Quarter["quarter"]);
}

export function previousQuarter(quarter: Quarter): Quarter {
  return quarter.quarter === 1
    ? makeQuarter(quarter.year - 1, 4)
    : makeQuarter(quarter.year, (quarter.quarter - 1) as Quarter["quarter"]);
}

export function payoutDueBy(quarter: Quarter): string {
  return addDays(quarter.end, PAYOUT_WINDOW_DAYS);
}

export function payoutCalendar(today: string): PayoutCalendar {
  const currentQuarter = quarterOf(today);
  const lastClosedQuarter = previousQuarter(currentQuarter);
  const lastClosedQuarterDueBy = payoutDueBy(lastClosedQuarter);
  const nextQuarterDueBy = payoutDueBy(currentQuarter);
  return {
    today,
    currentQuarter,
    lastClosedQuarter,
    lastClosedQuarterDueBy,
    nextQuarterEnd: currentQuarter.end,
    nextQuarterDueBy,
    nextPayoutDueBy: lastClosedQuarterDueBy >= today ? lastClosedQuarterDueBy : nextQuarterDueBy,
  };
}

/** Pending royalties that will roll over instead of being paid (0 < pending < ₹1,000). */
export function isBelowPayoutThreshold(pending: number): boolean {
  return pending > 0 && pending < PAYOUT_THRESHOLD_INR;
}

/** The most recent quarter whose payout deadline is on or before today. */
export function latestPassedPayout(today: string): { quarter: Quarter; dueBy: string } {
  let quarter = previousQuarter(quarterOf(today));
  while (payoutDueBy(quarter) > today) quarter = previousQuarter(quarter);
  return { quarter, dueBy: payoutDueBy(quarter) };
}

/**
 * Heuristic for AI facts (AI_SPEC section 8): a payable balance exists, the
 * latest payout deadline has passed, and the last payout (or the publication,
 * if never paid) was no later than the end of the quarter that deadline
 * covered. "Possibly", because only totals are known, not per-quarter sales.
 */
export function paymentPossiblyOverdue(
  book: { royaltyPending: number; lastRoyaltyPayoutDate: string | null; publicationDate: string | null },
  today: string,
): boolean {
  if (book.royaltyPending < PAYOUT_THRESHOLD_INR) return false;
  const reference = book.lastRoyaltyPayoutDate ?? book.publicationDate;
  if (reference === null) return false;
  return reference <= latestPassedPayout(today).quarter.end;
}
