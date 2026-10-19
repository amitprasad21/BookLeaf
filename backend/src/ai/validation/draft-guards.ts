// Server-side checks on every AI draft (AI_SPEC.md section 9, post-validation).
// Shape problems (unknown KB sections, placeholders, an empty greeting) send
// the draft back for one repair attempt. The fact guard never blocks: it lists
// amounts and dates that aren't in the facts or the author's own words, so
// the admin checks them before sending.
import type { DraftFacts } from "../facts/draft-facts.js";

/** A reason the draft must be repaired, or null when it is usable. */
export function draftShapeProblem(
  draft: { reply: string; kb_sections_used: string[] },
  providedSections: readonly string[],
): string | null {
  const unknown = draft.kb_sections_used.filter((id) => !providedSections.includes(id));
  if (unknown.length > 0)
    return `kb_sections_used lists sections that were not provided (${unknown.join(", ")})`;
  if (/\[[^\]\n]{1,60}\]/.test(draft.reply)) return "the reply contains a bracketed placeholder";
  if (/\{\{|\}\}/.test(draft.reply)) return "the reply contains a {{template}} placeholder";
  if (/^\s*(hi|hello|dear)\s*[,!]/im.test(draft.reply)) return "the greeting has no name";
  if (!/\n\s*\n/.test(draft.reply.trim())) {
    return "the reply is one block of text; use short paragraphs separated by blank lines";
  }
  return null;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const MONTH =
  "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)";
const DAY_MONTH_YEAR = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH}\\.?,?\\s+(\\d{4})\\b`, "gi");
const MONTH_DAY_YEAR = new RegExp(`\\b${MONTH}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi");
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const RUPEES = /(?:₹|\bRs\.?|\bINR)\s?(\d[\d,]*(?:\.\d+)?)/gi;
const ANY_NUMBER = /\d[\d,]*(?:\.\d+)?/g;

const monthIndex = (name: string) =>
  MONTHS.findIndex((month) => month.startsWith(name.toLowerCase().slice(0, 3)));
const iso = (year: string, month: number, day: string) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
const amount = (text: string) => Number(text.replace(/,/g, ""));

/** Calendar dates in the text, as ISO strings with how they were written. */
export function extractDates(text: string): { iso: string; written: string }[] {
  const found: { iso: string; written: string }[] = [];
  for (const match of text.matchAll(DAY_MONTH_YEAR))
    found.push({ iso: iso(match[3]!, monthIndex(match[2]!), match[1]!), written: match[0] });
  for (const match of text.matchAll(MONTH_DAY_YEAR))
    found.push({ iso: iso(match[3]!, monthIndex(match[1]!), match[2]!), written: match[0] });
  for (const match of text.matchAll(ISO_DATE)) found.push({ iso: match[0], written: match[0] });
  return found;
}

/** Rupee amounts in the text (₹, Rs or INR). */
export function extractAmounts(text: string): { value: number; written: string }[] {
  return [...text.matchAll(RUPEES)].map((match) => ({ value: amount(match[1]!), written: match[0].trim() }));
}

function factNumbers(facts: DraftFacts): number[] {
  const numbers = [facts.payout.thresholdInr];
  if (facts.book) {
    const book = facts.book;
    numbers.push(book.royaltyPending, book.royaltyPaid, book.totalRoyaltyEarned);
    if (book.mrp !== null) numbers.push(book.mrp);
    if (book.royaltyPerCopy !== null) numbers.push(book.royaltyPerCopy);
  }
  if (facts.authorBooks) {
    numbers.push(...facts.authorBooks.map((book) => book.royaltyPending));
    numbers.push(
      Math.round(facts.authorBooks.reduce((sum, book) => sum + book.royaltyPending * 100, 0)) / 100,
    );
  }
  return numbers;
}

function factDates(facts: DraftFacts): string[] {
  const dates = [
    facts.today,
    facts.payout.lastClosedQuarterDueBy,
    facts.payout.currentQuarterEnd,
    facts.payout.nextQuarterDueBy,
  ];
  if (facts.book)
    dates.push(
      ...[facts.book.publicationDate, facts.book.lastRoyaltyPayoutDate].filter(
        (d): d is string => d !== null,
      ),
    );
  for (const book of facts.authorBooks ?? [])
    if (book.lastRoyaltyPayoutDate) dates.push(book.lastRoyaltyPayoutDate);
  return dates;
}

/**
 * Amounts and dates in the reply that match neither the facts nor anything
 * the author wrote. Each becomes one plain-language warning for the admin.
 */
export function factWarnings(reply: string, context: { facts: DraftFacts; authorText: string }): string[] {
  const knownAmounts = [
    ...factNumbers(context.facts),
    ...[...context.authorText.matchAll(ANY_NUMBER)].map((m) => amount(m[0])),
  ];
  const knownDates = new Set([
    ...factDates(context.facts),
    ...extractDates(context.authorText).map((d) => d.iso),
  ]);
  const warnings = new Set<string>();
  for (const { value, written } of extractAmounts(reply)) {
    if (!knownAmounts.some((known) => Math.abs(known - value) < 0.005)) {
      warnings.add(`${written} isn't in this author's records or the ticket; check it before sending.`);
    }
  }
  for (const { iso: date, written } of extractDates(reply)) {
    if (!knownDates.has(date))
      warnings.add(`"${written}" isn't a date in this ticket's facts; check it before sending.`);
  }
  return [...warnings].slice(0, 10);
}

export const SIGN_OFF = "Warm regards,\nBookLeaf Author Support";
const CLOSING = /^(warm|best|kind)?\s*regards\b|^sincerely\b|^thank you,?$|^thanks,?$/i;
const TEAM_SIGNATURE = /^(the\s+)?bookleaf\b/i;

/**
 * The sign-off is fixed text, so the server sets it rather than trusting the
 * model: any trailing closing ("Best regards", "Warm regards, BookLeaf Author
 * Support", a team signature line) is replaced by the standard one.
 */
export function withStandardSignOff(reply: string): string {
  const lines = reply.replace(/\s+$/, "").split("\n");
  for (let removed = 0; removed < 3 && lines.length > 1; removed += 1) {
    const last = lines.at(-1)!.trim();
    if (last === "" || CLOSING.test(last) || TEAM_SIGNATURE.test(last)) lines.pop();
    else break;
  }
  // A closing written inline at the end of the last paragraph ("…let us know. Warm regards, BookLeaf Author Support").
  const body = lines.join("\n").replace(INLINE_CLOSING, "").replace(/\s+$/, "");
  return `${body}\n\n${SIGN_OFF}`;
}

const INLINE_CLOSING =
  /\s*(?:warm|best|kind)?\s*regards,?(?:\s+(?:the\s+)?bookleaf(?:\s+author)?(?:\s+support)?(?:\s+team)?)?\.?\s*$/i;
