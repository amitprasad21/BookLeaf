# 2026-10-19: Support console (FE-M1..M4, AI-5) and the rest of FE-1

Branch `feature/admin-portal` (from `main` at `7a688a9`). Decision D-032.

## What was built

- **`packages/shared`:**
  - Admin response DTOs: queue item, summary, ticket detail, AI suggestion, timeline event, internal note, AI draft, triage accepted. The admin serializers and routes now return them; `toInternalNote` maps the author directly, as openapi requires.
  - Labels: AI status, plain-words AI unavailable reasons, escalation teams, policy floors, knowledge base section titles.
- **`packages/ui`:** `CheckboxGroup`, `Tabs` (WAI-ARIA, arrow/Home/End), `ConfirmDialog` (native modal `<dialog>`), `Pagination`, `SlaIndicator`, `Timeline`, with styles.
- **`admin-frontend`:**
  - Session layer copied from the author portal with role `admin`, its own storage key and the console copy (D-032). The API client keeps `error.current` for version conflicts and adds `patch`. CSP as in the author portal.
  - **Queue** (`/tickets`):
    - Summary bar with shortcut filters.
    - URL filters: status, priority incl. Needs triage, category, assignee, created dates, search on submit, clear.
    - Sort with the urgency rule as a hint; result count announced.
    - Table from 768 px, cards below. Priority/category source icons, "New" tag, SLA indicator, inline "Assign to me", AI state.
    - Pagination. Polling every 15 s, offered as "Show N updates" instead of reordering rows.
  - **Ticket** (`/tickets/[ticketId]`):
    - Header with badges and SLA. Two columns from 1024 px, tabs below.
    - Conversation with the reply editor, or "Reopen to reply" for resolved/closed tickets.
    - Triage: status with allowed transitions only and confirmation for close/reopen; category/priority with AI suggestion, confidence, override note, low-confidence notice, policy floor, rationale; AI pending/failed/manual with "Retry AI triage".
    - Assignment (self only), author context with books, internal notes, timeline.
    - Version conflicts show the latest ticket and who changed it.
  - **Reply editor (AI-5):**
    - The draft is requested on open when it's the team's turn. Otherwise "Draft a reply with AI".
    - Meta strip (model, KB sections used, age, Regenerate with confirm over edits); fact warnings, missing information, suggested escalation, internal checklist.
    - Typing before a late draft keeps the typed text. Unsent text is kept per ticket in `sessionStorage`.
    - "AI draft unavailable (reason). Write your reply below." when AI can't help.
    - Send reply / Send & resolve with `draftId`; success notice and refresh.
    - A category override refetches the draft.

## Checks that ran

| Check | Command / procedure | Result |
|---|---|---|
| Shared + backend after the DTO typing | `npm run build -w @bookleaf/shared`; `tsc --noEmit` in `backend/` | Pass |
| Label sync (new) | `backend/test/labels.test.ts`: every KB section title and priority-floor rule matches `packages/shared` | 2 passed |
| Admin typecheck and lint | `npm run typecheck -w admin-frontend`; `npx eslint admin-frontend packages/ui` | Pass, 0 problems |
| Admin logic tests | `npx vitest run --root admin-frontend` (hoisted vitest 5.0.3) | 5 files, 29 passed. MT-01, MT-09 and the MT-04 wording, plus SLA text, timeline, draft-on-open, sections/escalation text |
| Author logic tests (unchanged) | `npx vitest run --root author-frontend` | 22 passed |
| Production build | `npm run build -w admin-frontend` | Pass; `/tickets/[ticketId]` dynamic, the rest static |
| Full repository check | `npm run check` | Exit 0; 26 files, 303 backend tests |
| Signed-out console | Browser: `/tickets/<uuid>` → `/login?next=…`; sign-in page; `?reason=expired` notice; CSP and `X-Frame-Options: DENY`; 320 × 640 without horizontal scroll; no console errors | Pass |

**Per-commit checks:** each of the six code commits was checked on its own, with the rest stashed:
- shared: build + 303 backend tests;
- API typing: backend typecheck, lint, 303 tests;
- UI: build, lint, and typecheck of both apps;
- console session / queue / ticket page: typecheck, lint, 3 / 17 / 29 tests.

**Found and fixed during the work:**
- An unknown `status=` value in the URL meant "every status"; it now falls back to the default (test added).
- A category override didn't refresh the shown draft; it now refetches it (the API reuses the draft when nothing changed).

## Not run

- **Signed-in console** (queue, ticket page, triage, draft, send). The admin demo password is in `backend/.env`, and the sign-in form sends credentials to the hosted Supabase project, so the user signs in. ME-01..ME-07 and MT-02..MT-08, MT-10 and MT-11 as rendered tests are not run.
- Component and end-to-end test libraries are not installed (Testing Library, Playwright).
- The viewport matrix, keyboard-only journey and screen reader checks.
- SSE: both portals poll every 15 s until API-8.
