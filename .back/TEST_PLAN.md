# Backend Test Plan

**Owns:** backend test strategy and the case list. Definition-of-done checks: [.agent/TEST_CHECKLIST.md](../.agent/TEST_CHECKLIST.md). Status of every case: **not run** until recorded in [.agent/verification/](../.agent/verification/README.md).

## Tooling

| Layer | Tool | Runs against |
|---|---|---|
| Unit | Vitest | Pure modules (payout calendar, lifecycle, floors, guards, serializers, router with mock provider) |
| API integration | Vitest + Supertest on `createApp()` | Real Supabase project (test data) with mock AI provider |
| RLS | Vitest + supabase-js (publishable key, real sign-ins) | Supabase project ([SUPABASE_RLS.md](SUPABASE_RLS.md) §5) |
| Contract | Response shapes validated against `openapi.yaml` schemas | Integration responses |
| AI eval | Eval runner | Mock in CI; live provider only with approval |

Integration tests use a dedicated test author and test admin plus tickets they create, and clean up after themselves. They never modify the 10 dataset authors or 18 books.

## Unit cases

| ID | Module | Case |
|---|---|---|
| U-01 | payout-calendar | 2026-10-16 → last closed quarter Jul–Sep 2026, due 2026-11-14; next due 2027-02-14 (**implemented**: `backend/test/payout-calendar.test.ts`) |
| U-02 | payout-calendar | Quarter boundaries (Mar 31 → May 15; Jun 30 → Aug 14; Dec 31 → Feb 14) and leap years (**implemented**) |
| U-03 | payout-calendar | `pendingBelowThreshold` for 0, 850, 1000, 1001 (**implemented**) |
| U-04 | payout-calendar | `paymentPossiblyOverdue` for BK001 (true), BK016 (false: below threshold), BK002 (false: zero pending) (**implemented**, plus BK005 and published-/paid-after-quarter cases) |
| U-05 | lifecycle | Every allowed transition passes; every other pair → InvalidTransition (**implemented**: `backend/test/admin-ticket.test.ts`) |
| U-06 | lifecycle | Reply on `open` → `in_progress`; `statusAfter=resolved` → `resolved`; reply on `closed` rejected (**implemented** in the database function; live `test-integration/admin-replies.test.ts`) |
| U-07 | floors | `isbn_error` + low → high; `legal_or_rights` → critical; floors never lower (**implemented**: `backend/test/ai-triage.test.ts`) |
| U-08 | placeholder-guard | Detects `[insert date]`, `{{name}}` (**implemented**, plus a nameless greeting and one-block replies: `backend/test/ai-drafts.test.ts`) |
| U-09 | fact-guard | `₹3,570` matches BK001 pending; `₹4,000` flagged; dates normalised across formats (**implemented**) |
| U-10 | serializers | Author DTO keys = exact allowlist (snapshot) |
| U-11 | sla | met / breached / due_soon / on_track / not_applicable boundaries (**implemented**: `backend/test/sla.test.ts`) |
| U-12 | facts | Never includes email, phone, city; `authorBooks` only for General tickets in royalty/general categories (**implemented**, plus production stage facts) |
| U-13 | KB selection | Each category maps to the expected section IDs (**implemented**) |
| U-14 | router | Failover order, breaker transitions, no failover on refusal/bad_request (**implemented**: `backend/test/ai-router.test.ts`, adapters in `ai-providers.test.ts`) |

## API integration cases

| ID | Endpoint | Case | Expected |
|---|---|---|---|
| I-01 | all non-public | No token | 401 envelope with requestId |
| I-02 | `/admin/*` | Author token | 403 |
| I-03 | `GET /author/books` | Test author | Only own books |
| I-04 | `POST /author/tickets` | Valid, AI mock success | 201; later `ai_status=completed` (**implemented**: queueing in `triage-routes.test.ts`, job on the mock in `ai-triage.test.ts`, live on Gemini in `test-integration/ai-triage.test.ts`) |
| I-05 | `POST /author/tickets` | `AI_PRIMARY_PROVIDER=none` | 201; `manual_review_required` (**implemented**: `ai-triage.test.ts`, reason `not_configured`) |
| I-06 | `POST /author/tickets` | Another author's `bookId` | 400/404, nothing created |
| I-07 | `POST /author/tickets` | Extra field `priority` / `authorId` | 400 |
| I-08 | `GET /author/tickets/{id}` | Other author's ticket | 404 |
| I-09 | `GET /author/tickets/{id}` | Own ticket with notes + draft | Response has no internal fields |
| I-10 | `GET /admin/tickets` | Filters combined + urgency sort | Correct set and order (**implemented**: offline `admin-queue.test.ts` (recorded queries), live `test-integration/admin-queue.test.ts`) |
| I-11 | `PATCH /admin/tickets/{id}` | Stale version | 409 with current ticket (**implemented**, plus a live two-admin race) |
| I-12 | `PATCH` | Invalid transition | 422 (**implemented**) |
| I-13 | `PATCH` | `assignedAdminId` = other admin | 422 INVALID_ASSIGNMENT (**implemented**, plus taking or releasing a colleague's ticket) |
| I-14 | `PATCH` | Category override | `category_source=admin`; audit row with old/new (**implemented**, offline + live) |
| I-15 | `POST /admin/tickets/{id}/messages` | First reply | `first_response_at` set; status in_progress; author sees message (**implemented**, offline + live) |
| I-16 | `POST /admin/tickets/{id}/notes` | Note | Visible to admin; absent from author view (**implemented**, offline + live) |
| I-17 | `POST /admin/tickets/{id}/draft` | Twice, unchanged context | Second returns 200 cached, 1 usage event (**implemented**: offline + live) |
| I-18 | `POST /admin/tickets/{id}/draft` | Mock invalid output | 503 `invalid_output` after one repair attempt (**implemented**) |
| I-19 | `POST /author/tickets` | 6 within 10 min | 6th → 429 with Retry-After |
| I-20 | `GET /events` | Author subscribed; admin replies to another author's ticket | No event delivered to this author (**implemented**: `backend/test-integration/events.test.ts`, plus offline `backend/test/events.test.ts`) |
| I-21 | error handler | Forced internal error in production mode | Generic 500, no stack, requestId present |
| I-22 | CORS | Preflight from unlisted origin | No CORS allow headers |

## Security cases

Mapped to [.agent/SECURITY_REVIEW_CHECKLIST.md](../.agent/SECURITY_REVIEW_CHECKLIST.md) R-01..R-10 and executed in SEC-1.
