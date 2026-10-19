// The BookLeaf Knowledge Base from the assignment, transcribed section by
// section (AI_SPEC.md section 7) and reviewed against the source PDF on
// 2026-10-19 (₹ signs and ranges restored where text extraction dropped them).
// Tone guidelines are not a section: they live in the static draft prompt.
// Change any wording → bump KB_VERSION (it is part of every draft's context hash).
import type { TicketCategory, TriageSignal } from "@bookleaf/shared";

export const KB_VERSION = "kb-2026-10-19.1";

export const KB_SECTIONS = {
  "kb.company": `Company overview
- BookLeaf Publishing is a self-publishing company operating in India and the US.
- Publishing packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium, paid package with marketing and distribution add-ons).
- BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution and royalty management for its authors.
- The in-house printing facility and warehouse are in Delhi. Print partners include Repro India and Epitome Books.`,

  "kb.royalty": `Royalty policy
- 80/20 royalty split: 80% of the net profit per book goes to the author, 20% to BookLeaf.
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart) and shipping charges.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold: ₹1,000. If accumulated royalties are below this, they roll over to the next quarter.
- Payouts are made by bank transfer to the account linked in the author's dashboard.
- Authors can see a detailed royalty breakdown in their dashboard, with sales figures per platform.`,

  "kb.isbn": `ISBN policy
- Every book published through BookLeaf receives a unique ISBN assigned by BookLeaf.
- ISBNs are registered under BookLeaf's publisher imprint. An author who wants an ISBN under their own imprint must obtain it independently.
- An ISBN error reported by an author (duplicate, wrong book linked) is a high-priority issue and is escalated to the production team.`,

  "kb.printing": `Printing and quality
- In-house printing handles most orders. Overflow or specific format requirements go to Repro India or Epitome Books.
- Standard print turnaround: 5–7 business days from order confirmation.
- For a quality issue (misprints, binding defects, colour inconsistency), BookLeaf arranges a free reprint after verification. The author may need to share photos of the defective copy.`,

  "kb.distribution": `Distribution and availability
- Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store.
- New listings typically go live within 7–10 business days after publication is complete.
- A book showing as unavailable on a platform usually indicates a stock sync issue. BookLeaf's team can trigger a re-sync within 24–48 hours.`,

  "kb.production": `Production stages
- Stages, in order: Manuscript Received → Editing (if opted) → Cover Design → Typesetting → Proofreading → ISBN Assignment → Printing → Distribution Setup → Published & Live.
- Authors are updated by email at each stage. Delays typically happen at Cover Design (waiting for author approval) and Proofreading (revision rounds).`,

  "kb.guidance.royalty_payments": `Response guidance: Royalty & Payments
Example 1: "I published my book 4 months ago and still haven't received any royalty. What's going on?"
Acknowledge the frustration. Explain the quarterly royalty cycle and the 45-day payout window. Check whether their bank details are linked. Give the specific next payout date. If the payment is genuinely overdue, escalate with a 48-hour resolution timeline.
Example 2: "My royalty amount seems too low. I sold 200 copies but only received ₹3,000."
Explain the net profit calculation: MRP minus printing, platform commission and shipping. Offer to share a detailed line-by-line royalty breakdown. Don't be defensive: offer transparency.`,

  "kb.guidance.isbn_metadata": `Response guidance: ISBN & Metadata Issues
Example: "My book is showing a different ISBN on Amazon than what's on the physical copy."
Treat it as high priority. Acknowledge this is a serious data issue. Confirm you are escalating to the production team immediately. Give a 48-hour resolution timeline.`,

  "kb.guidance.printing_quality": `Response guidance: Printing & Quality
Example: "I received my author copies and the print quality is terrible. The images are blurry and pages are misaligned."
Apologise sincerely. Ask the author to share photos of the defective copies. Confirm that BookLeaf will arrange a free reprint once verified. Give a timeline of 5–7 business days for the reprint.`,

  "kb.guidance.distribution_availability": `Response guidance: Distribution & Availability
Example: "My book is published but it's showing as 'Currently Unavailable' on Amazon."
Explain that this is typically a stock sync issue. Confirm you're triggering a re-sync with the distribution team. Set the expectation: 24–48 hours for it to go live again.`,

  "kb.guidance.book_status_production": `Response guidance: Book Status & Production Updates
Example: "It's been 3 weeks and my book is still in typesetting. When will it be done?"
Check the actual production status. If it's delayed, be honest about why (for example, waiting on author approval for proofs). Give a specific updated timeline. Don't blame the author even if the delay is on their side: frame it collaboratively.`,

  "kb.guidance.general_inquiry": `Response guidance: General Inquiry
Example: "Can I update the description of my book on Amazon after it's already live?"
Yes: metadata updates can be submitted through the dashboard or by emailing the BookLeaf team. Changes typically reflect on platforms within 3–5 business days.`,
} as const;

export type KbSectionId = keyof typeof KB_SECTIONS;

const BY_CATEGORY: Record<TicketCategory, KbSectionId[]> = {
  royalty_payments: ["kb.company", "kb.royalty", "kb.guidance.royalty_payments"],
  isbn_metadata: ["kb.company", "kb.isbn", "kb.guidance.isbn_metadata"],
  printing_quality: ["kb.company", "kb.printing", "kb.guidance.printing_quality"],
  distribution_availability: ["kb.company", "kb.distribution", "kb.guidance.distribution_availability"],
  book_status_production: ["kb.company", "kb.production", "kb.guidance.book_status_production"],
  general_inquiry: ["kb.company", "kb.guidance.general_inquiry"],
};

/**
 * Deterministic section choice by effective category (no vector search: the
 * KB is small and maps cleanly to the six categories). A metadata change
 * request also gets the distribution section, which carries platform timelines.
 */
export function selectKbSections(category: TicketCategory, signals: readonly TriageSignal[]): KbSectionId[] {
  const sections = [...BY_CATEGORY[category]];
  if (category === "general_inquiry" && signals.includes("metadata_change")) sections.push("kb.distribution");
  return sections;
}
