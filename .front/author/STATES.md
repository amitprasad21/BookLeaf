# Author UI States

Every screen must render each applicable state. "Copy" is the user-facing text (subject to product review).

## My Books

| State | Trigger | Rendering / copy |
|---|---|---|
| Loading | Initial fetch | Skeleton summary + 3 skeleton rows |
| Success | Books returned | Summary + table/cards |
| Empty | Author has no books | "You don't have any books with us yet. When your first manuscript is received it will appear here." |
| Partial data | Book in production (null MRP/date/royalty) | Null wording per DESIGN_SYSTEM §7; never ₹0 for unset values |
| Below threshold | 0 < pending < 1000 | Rollover note under pending |
| Fully paid | pending = 0, earned > 0 | "Fully paid" tag |
| Error | Request failed | ErrorState: "We couldn't load your books." + Retry + reference |

## Raise a query

| State | Rendering / copy |
|---|---|
| Idle | Form with book list loaded (General always available even if books fail to load) |
| Books failed to load | Notice "We couldn't load your book list; you can still send a general query." Select shows General only |
| Field invalid | Inline error under field, `aria-invalid`, summary at top on submit |
| Submitting | Button spinner "Sending…", inputs read-only |
| Rate limited | Warning notice with minutes to wait; text kept |
| Failed | Error notice with Retry; text kept |
| Success | Redirect to ticket detail + success notice with reference |
| Attachment invalid | "Please choose a JPG, PNG or PDF under 5 MB." |

## My Tickets

| State | Rendering / copy |
|---|---|
| Loading | Skeleton rows |
| Empty (no tickets) | "You haven't raised any queries yet." + "Raise a query" button |
| Empty (filter) | "No {status} queries." + "Show all" |
| Success | List with status badges and "New reply" markers |
| Live / polling | Indicator text |
| Error | ErrorState with Retry |

## Ticket detail

| State | Rendering / copy |
|---|---|
| Loading | Skeleton header + thread |
| No replies yet | Original message + "No reply yet…" note |
| With replies | Thread |
| New reply arrives | Message appended, polite announcement, no scroll jump unless the user is at the bottom |
| Status changes live | Badge + explainer update, announced |
| Not found / not owned | "We couldn't find that ticket." + back link (404) |
| Error | ErrorState with Retry |
| Session expired | Redirect to sign-in with notice |
