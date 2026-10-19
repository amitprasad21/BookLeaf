# Author Screens

Requirement IDs refer to [PRD.md](../../PRD.md). Formatting and null wording: [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) §7.

## A1. Sign in (`/login`) (AUTH-01, AUTH-05)

- Title "BookLeaf Author Portal", email field, password field, "Sign in" button.
- Error copy: "Email or password is incorrect." (never reveals which).
- If redirected with `reason=expired`: notice "Your session expired. Please sign in again."
- No sign-up link (accounts are provisioned). Helper text: "Need access? Contact your BookLeaf publishing manager."

## A2. My Books (`/books`) (AUTHOR-01..03)

**Header:** "Welcome back, {firstName}" and a primary button "Raise a query".

**Royalty summary** (three `KeyFigure`s): Total earned · Paid to you · Pending.
- Caption under Pending, one of:
  - "Next payout window: by {nextDueDate}" (pending ≥ ₹1,000)
  - "Below the ₹1,000 payout minimum; this rolls over to the next quarter" (0 < pending < ₹1,000)
  - "You're fully paid up" (pending = 0 and earned > 0)
  - "Royalties start once your first book is on sale" (earned = 0)
- Footnote: "Royalties are calculated quarterly and paid by bank transfer within 45 days of each quarter ending."

**Books** (table ≥ 1024 px, cards below):

| Column | Notes |
|---|---|
| Title | + genre beneath in muted text |
| ISBN | monospace |
| Status | "Published & Live" or "In production: Cover Design" with a stage-progress caption ("Stage 3 of 9") |
| Published | date or "Not yet published" |
| MRP | ₹ or "Not yet set" |
| Copies sold | number; for unpublished "0 · Not yet on sale" |
| Royalty earned / paid / pending | ₹ values; pending gets the rollover note when below threshold |
| Last payout | date or "No payout yet" |
| Actions | "Ask about this book" → `/tickets/new?bookId=…` |

Expandable row/card detail: royalty per copy, print partner ("Not assigned yet"), available on (list or "Not listed yet").

## A3. Raise a query (`/tickets/new`) (AUTHOR-04/05)

| Field | Control | Validation / help |
|---|---|---|
| About | Select: each of the author's books (title + status) and "General / Account Level". Pre-selected from `?bookId` | Required |
| Subject | Text, 5–150 chars | "A short summary, e.g. 'Royalty for Q3 not received'" |
| Description | Textarea, 20–5,000 chars, counter | "Include dates, platforms and amounts if relevant." |
| Attachment | File input (jpg, png, pdf ≤ 5 MB), UI-only | "Upload isn't enabled yet. We'll record the filename; our team may ask you to email the file." |

- Submit button "Send to BookLeaf". Disabled while submitting; inputs preserved on error.
- Success: navigate to the new ticket with notice "Thanks, we've received your query (BL-1042). You'll see our reply here." No mention of AI.

## A4. My Tickets (`/tickets`) (AUTHOR-06/09)

- Filter chips: All · Open · In progress · Resolved · Closed.
- Rows/cards: reference, subject, book (or "General / Account"), `StatusBadge`, "Updated 2h ago", and a "New reply" marker when an admin reply arrived since the author last opened the ticket (tracked client-side).
- `ConnectionIndicator` in the header.

## A5. Ticket detail (`/tickets/[ticketId]`) (AUTHOR-07/09)

- Header: subject, reference, `StatusBadge`, book title (or "General / Account Level"; there is no per-book page to link to), created date.
- Status explainer one-liner per status: Open = "Waiting for our team", In progress = "Our team is working on this", Resolved = "We believe this is sorted. If it isn't, raise a new query." (changed at FE-A4: follow-up replies are P2, so there is nothing to reply with yet), Closed = "This conversation is closed."
- Thread: the original description first (as "You"), then admin replies ("{Admin name}, BookLeaf Support"), oldest → newest, plain text with line breaks.
- Empty replies: "No reply yet. Most queries get a first response within one working day." (copy to confirm with the product owner.)
- P2: follow-up box when status is Open/In progress.
- Not-found or not-owned: "We couldn't find that ticket." with a link back.
