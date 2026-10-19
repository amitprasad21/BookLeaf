// Display formatting shared by both portals (.front/DESIGN_SYSTEM.md section 7):
// whole rupees with en-IN grouping, "20 Jun 2023" dates, short relative times,
// and the wording for values that aren't known yet (never ₹0 or a blank).

export const NULL_WORDING = {
  money: "Not yet set",
  publicationDate: "Not yet published",
  lastPayout: "No payout yet",
  printPartner: "Not assigned yet",
  platforms: "Not listed yet",
  notOnSale: "Not yet on sale",
} as const;

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const counts = new Intl.NumberFormat("en-IN");

/** ₹11,970 */
export function formatInr(amount: number): string {
  return inr.format(amount);
}

/** 1,567 */
export function formatCount(value: number): string {
  return counts.format(value);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type DateStyle = "short" | "long";

/**
 * "20 Jun 2023" (short, tables) or "20 June 2023" (long, prose). Calendar
 * dates ("2023-06-20") are formatted as written; timestamps in `timeZone`
 * (the viewer's own when omitted).
 */
export function formatDate(value: string, style: DateStyle = "short", timeZone?: string): string {
  const dateOnly = DATE_ONLY.test(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: style,
    year: "numeric",
    timeZone: dateOnly ? "UTC" : timeZone,
  }).format(new Date(dateOnly ? `${value}T00:00:00Z` : value));
}

/** "20 Jun 2023, 4:25 pm" */
export function formatDateTime(value: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5 min ago", "3 h ago", "2 d ago"; a date after a week. */
export function formatRelative(value: string, now: Date = new Date(), timeZone?: string): string {
  const elapsed = now.getTime() - new Date(value).getTime();
  if (elapsed < MINUTE) return "just now"; // includes small clock skew into the future
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)} d ago`;
  return formatDate(value, "short", timeZone);
}
