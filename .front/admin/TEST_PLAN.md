# Admin Test Plan

Status of every case: **not run** until recorded in [.agent/verification/](../../.agent/verification/README.md).

## Automated (component/integration)

| ID | Case | Expected |
|---|---|---|
| MT-01 | Queue filters ↔ URL | Changing filters updates the query string; loading a URL restores filters |
| MT-02 | Urgency sort display | Critical/High rows first, then untriaged, then Medium/Low; oldest first within a level (fixture) |
| MT-03 | Priority/status encodings | Every badge has a text label; Critical uses the inverse badge |
| MT-04 | Override shows source | After PATCH, label reads "Set by admin" with the original AI suggestion muted |
| MT-05 | 409 handling | Conflict notice shown and data refreshed |
| MT-06 | Draft unavailable (503) | Empty editor with reason; Send still works |
| MT-07 | Fact warnings render | Warnings listed above the editor |
| MT-08 | Send & resolve | Calls messages endpoint with `statusAfter=resolved` |
| MT-09 | Disallowed transitions disabled | e.g. In progress → Open not offered |
| MT-10 | Late draft vs typing | If the admin types before the draft arrives, the draft does not overwrite text |
| MT-11 | Wrong role on `/me` | Signs out with the console-access message |

## End-to-end smoke

| ID | Journey | Expected |
|---|---|---|
| ME-01 | Admin signs in → queue shows tickets from multiple authors | Rows from ≥ 2 authors |
| ME-02 | Open a royalty ticket → draft mentions the correct pending amount and the 45-day window | Matches seed data facts |
| ME-03 | Override category → regenerate → draft uses the new category's policy | KB sections in meta strip change |
| ME-04 | Assign to me → filter "Assigned to me" | Ticket listed |
| ME-05 | Add note → sign in as the ticket's author in another browser | Note not visible anywhere |
| ME-06 | Send reply → author sees it live | Within ~5 s |
| ME-07 | AI disabled (`AI_PRIMARY_PROVIDER=none`) → full triage + reply manually | Works end to end |

## Manual

| ID | Check |
|---|---|
| MM-01 | Keyboard-only: queue → filter → open → override → send |
| MM-02 | Viewport matrix ([ACCESSIBILITY_RESPONSIVENESS.md](../ACCESSIBILITY_RESPONSIVENESS.md)) |
| MM-03 | Two admins on the same ticket (conflict UX) |
| MM-04 | Screen reader: new ticket announcement isn't noisy |
