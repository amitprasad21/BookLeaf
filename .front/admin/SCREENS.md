# Admin Screens

Requirement IDs refer to [PRD.md](../../PRD.md). Encodings: [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) §6.

## M1. Sign in (`/login`) (AUTH-01, AUTH-05)

Same pattern as the author sign-in, titled "BookLeaf Support Console". Non-admin accounts are signed out with "This account doesn't have access to the support console."

## M2. Queue (`/tickets`) (ADMIN-01..03, ADMIN-14)

**Summary bar** (`GET /admin/tickets/summary`); each count is a button that applies its filter:
Open · In progress · Unassigned · Critical · Overdue · Needs manual triage.
(Filters: `status=open` · `status=in_progress` · `assignee=unassigned` · `priority=critical` · `overdue=true` · `aiStatus=manual_review_required`, each with `status=open,in_progress` where the count is unresolved-only; see `QueueSummary` in openapi.yaml.)

**Filter bar** (state mirrored in the URL query string):
- Status (multi, default Open + In progress)
- Category (multi, 6 labels)
- Priority (multi, includes "Needs triage")
- Assignee: Anyone / Assigned to me / Unassigned
- Created from / to (date inputs)
- Search: reference, subject or author name
- "Clear filters"

**Sort** (select): Most urgent (default) · Newest · Oldest · Recently updated. The urgency rule is shown as hint text under the Sort select: "Unresolved first, then priority, then oldest."

**Table columns** (≥ 1024 px):

| Column | Content |
|---|---|
| Priority | `PriorityBadge` + `SourceTag` icon (AI/Admin); "Needs triage" if null |
| Ticket | Reference (mono) + subject (link to detail) |
| Author | Name; book title (or "General") beneath |
| Category | Label + source icon. (The "Low confidence" marker is on the ticket page only: the list API has no confidence, D-032.) |
| Status | `StatusBadge` |
| Age | Relative age since created; `SlaIndicator` when breached/due soon |
| Assignee | Name or "Unassigned"; inline "Assign to me" button (always visible: hover-only controls fail on touch) |
| AI | `pending` spinner + "Triaging…", or "Manual" when `manual_review_required` |

Below 768 px: cards showing priority, subject, author, status and age.

**Live:** new tickets appear at their sorted position with a subtle "New" tag and a polite announcement ("1 new ticket"). The list doesn't reorder under the admin's focus; a "Show 2 updates" button applies them when the admin is mid-scan.

## M3. Ticket detail (`/tickets/[ticketId]`) (ADMIN-04..17)

**Header:** reference, subject, `StatusBadge`, `PriorityBadge`, age + `SlaIndicator`, author name, book (or General). Back to queue (filters preserved).

**Left column: Conversation**
1. Original description (author name, time).
2. Thread of replies and author follow-ups.
3. **Reply editor** (`ReplyEditor`):
   - Draft area pre-filled from the AI draft when available, with a header strip: "AI draft · {model} · uses: Royalty policy, Company overview · Regenerate".
   - Above the field, if present:
     - **Fact warnings** ("₹4,000 isn't in this author's records; check before sending").
     - **Missing information** ("Confirm whether bank details are linked").
     - **Escalation suggestion** ("Suggested escalation: finance team").
   - **Internal checklist** (admin-only) as a collapsible list under the editor.
   - Buttons: **Send reply** (keeps/moves to In progress) · **Send & resolve** · Discard draft changes.
   - If the AI is unavailable: an empty editor with notice "AI draft unavailable ({reason}). Write your reply below." Everything else works.

**Right column: Triage and context**
1. **Triage panel**
   - Status select (only allowed transitions enabled).
   - Category select. Shows the AI suggestion + confidence + rationale; if overridden, "Set by admin" with the AI's original suggestion in muted text.
   - Priority select, with the same pattern plus "Raised by policy: ISBN errors are at least High" when a floor applied.
   - "Retry AI triage" when `ai_status` is failed or manual.
2. **Assignment:** "Assigned to {name}" / "Unassigned" with "Assign to me" or "Unassign me".
3. **Author context:** name, city, joined date; the author's books with status, pending royalty, last payout. The ticket's book is highlighted.
4. **Internal notes:** list + add note ("Visible to the BookLeaf team only" label on the field).
5. **Timeline:** created, triaged (AI), overrides, status changes, assignment, replies, notes, with actor and time.

Below 1024 px the right column becomes tabs: Conversation · Triage · Context · Notes · Timeline.

## M4. System pages

- 404: "Ticket not found." + back to queue.
- Session expired: redirect to sign-in with notice.
- Global error: ErrorState with reference ID.
