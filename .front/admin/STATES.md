# Admin UI States

## Queue

| State | Rendering / copy |
|---|---|
| Loading | Skeleton summary + 8 skeleton rows |
| Success | Table/cards |
| Empty (no tickets at all) | "No tickets yet. New author queries will appear here automatically." |
| Empty (filters) | "No tickets match these filters." + "Clear filters" |
| AI pending on a row | "Triaging…" with spinner; priority shows "Needs triage" until done |
| AI manual on a row | "Manual" tag; priority "Needs triage" |
| Live updates pending | "Show N updates" button (doesn't reorder under focus) |
| Polling fallback | Indicator "Refreshing every 15 s" |
| Error | ErrorState + Retry + reference |

## Ticket detail

| Area | State | Rendering / copy |
|---|---|---|
| Page | Loading | Skeleton |
| Page | Not found | "Ticket not found." + back |
| Triage | AI pending | "AI is triaging this ticket…"; selects enabled for manual setting |
| Triage | AI completed | Suggestion + confidence + rationale |
| Triage | Low confidence (< 0.5) | Notice "Low confidence: please check the category" |
| Triage | Overridden | "Set by admin" + muted original AI suggestion |
| Triage | Floor applied | "Raised to High by policy: ISBN errors" |
| Triage | AI failed / manual | Reason + "Retry AI triage" |
| Triage | Version conflict | Notice + refreshed values |
| Editor | Draft loading | "Drafting a reply…" with skeleton; typing allowed |
| Editor | Draft ready | Prefilled text + meta strip |
| Editor | Draft has fact warnings | Warning notice listing each item |
| Editor | Draft unavailable | Empty editor + reason notice |
| Editor | Rate-limited regenerate | "Draft limit reached for this ticket today." |
| Editor | Sending | Buttons disabled, "Sending…" |
| Editor | Send failed | Error notice; text kept |
| Editor | Sent | Message appended; editor cleared; success notice "Reply sent to {author}" |
| Editor | Ticket closed | Editor hidden; "Reopen to reply" button |
| Notes | Empty | "No internal notes yet." |
| Timeline | Empty (impossible after creation) | n/a; always has "Created" |
| Context | Author has books in production | Same null wording as the author portal |
