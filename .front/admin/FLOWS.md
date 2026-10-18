# Admin Flows

## F-M1. Start of shift: what next?

1. Open the queue. The default filter (Open + In progress) and sort (Most urgent) put Critical and High at the top, untriaged next, and oldest first within each level.
2. The summary bar shows counts. Clicking "Overdue" or "Needs manual triage" filters to them.
3. Admin clicks "Assign to me" on the top ticket, or opens it.

## F-M2. Triage check and override

1. Open a ticket. The triage panel shows the AI category/priority with confidence and rationale.
2. If wrong, the admin changes the select → `PATCH {version, category}` → the label becomes "Set by admin". The audit event is recorded and the draft context changes, so the next draft request regenerates with the right KB sections.
3. On `409 VERSION_CONFLICT`: notice "Updated by {name} just now. Showing the latest version." The panel refreshes from `error.current` (`{name}` = actor of the newest timeline entry) and the admin re-applies if still needed.

## F-M3. Reply with an AI draft

1. On open, the editor requests the draft (`POST /draft`). A cached draft appears instantly; a new one shows "Drafting a reply…" (typically a few seconds) and the admin can start typing manually at any time, which cancels insertion of the late draft.
2. Admin reviews fact warnings and missing information, then edits.
3. Admin chooses **Send reply** (→ In progress) or **Send & resolve** (→ Resolved).
4. `POST /messages {body, draftId, statusAfter}` → thread updates, the status badge updates and the author is notified live.
5. The editor clears and its `sessionStorage` copy is removed.

## F-M4. Reply without AI (manual mode)

1. Draft request returns `503 AI_UNAVAILABLE` (or the ticket is in manual review).
2. Notice explains why in plain words: "AI drafting is paused (daily budget reached)" / "The AI service isn't responding" / "AI is turned off".
3. Admin sets category/priority manually if needed, writes the reply and sends. Identical outcome to F-M3.

## F-M5. Retry AI triage

1. Ticket shows "Needs manual triage · {reason}" with a "Retry AI triage" button.
2. `POST /triage` → `202` → the panel shows "Triaging…" → the `ticket.triaged` event updates it.
3. If the retry fails again, the reason updates and the button stays (rate limited).

## F-M6. Internal note

1. Admin types a note → "Add note" → appears in notes and timeline. Never visible to authors.

## F-M7. Status management

| From | Allowed actions |
|---|---|
| Open | Start (In progress), Resolve, Close |
| In progress | Resolve, Close |
| Resolved | Reopen (In progress), Close |
| Closed | Reopen (In progress) |

Closing or reopening asks for confirmation. Full rules: [.back/TICKET_LIFECYCLE.md](../../.back/TICKET_LIFECYCLE.md).

## F-M8. Regenerate draft

1. "Regenerate" → confirm if the editor has unsent edits ("Replace your edits with a new draft?").
2. `POST /draft {regenerate:true}` → new draft, or `429` "Draft limit reached for this ticket today."
