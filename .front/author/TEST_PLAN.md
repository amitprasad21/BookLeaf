# Author Test Plan

Status of every case: **not run** until recorded in [.agent/verification/](../../.agent/verification/README.md).

**Run so far (2026-10-19, [2026-10-19-fe1-author.md](../../.agent/verification/2026-10-19-fe1-author.md)):** AT-01..AT-05 and AT-10 at logic level (Vitest over the view model, form validation and shared formatters: `author-frontend/src/features/**/*.test.ts`, `backend/test/format.test.ts`). Rendered component tests need Testing Library (not installed). AT-07/08 wait for SSE (API-8).

## Automated (component/integration, Vitest + Testing Library)

| ID | Case | Expected |
|---|---|---|
| AT-01 | Book with null MRP, date, royalty-per-copy (BK013 shape) | Renders "Not yet set" / "Not yet published"; no "₹0" for MRP |
| AT-02 | Pending ₹850 (BK016) | Rollover note shown |
| AT-03 | Pending ₹0 with earnings (BK002) | "Fully paid" shown |
| AT-04 | Query form validation | Subject < 5 and description < 20 show inline errors; submit blocked |
| AT-05 | Server `VALIDATION_FAILED` mapping | Errors appear under matching fields |
| AT-06 | Form preserved on 500 | Text remains; error with reference |
| AT-07 | SSE event invalidates ticket query | Detail refetches; new message rendered |
| AT-08 | Stream error → polling | Indicator switches to polling text; refetch interval active |
| AT-09 | Wrong role on `/me` | Signs out and shows the portal-access message |
| AT-10 | Money/date formatting | `₹11,970`, `20 Jun 2023` |

## End-to-end smoke (Playwright, against local or deployed stack)

| ID | Journey | Expected |
|---|---|---|
| AE-01 | Sign in as Priya Sharma (AUTH001) → My Books | Exactly BK001, BK002 with dataset figures |
| AE-02 | Sign in as Sneha Kulkarni (AUTH007) | 3 books; BK013 shows in-production rendering |
| AE-03 | Raise a query about BK001 → appears in My Tickets as Open | Reference shown; status Open |
| AE-04 | With AI disabled, raise a query | Still succeeds (AUTHOR-05) |
| AE-05 | Admin replies (second browser) → author detail updates without refresh within ~5 s | Reply visible, status updated |
| AE-06 | Visit another author's ticket URL | "We couldn't find that ticket." |

## Manual

| ID | Check |
|---|---|
| AM-01 | Keyboard-only: sign in → raise query → open ticket |
| AM-02 | Viewport matrix ([ACCESSIBILITY_RESPONSIVENESS.md](../ACCESSIBILITY_RESPONSIVENESS.md)) |
| AM-03 | 200% zoom on My Books and the query form |
| AM-04 | Screen reader announces a new reply |
