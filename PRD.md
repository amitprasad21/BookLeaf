# PRD: Requirements and Acceptance Criteria

**Owns:** functional and non-functional requirements, acceptance criteria and the mapping to the assessment's evaluation criteria.
**Source authority:** the BookLeaf assignment PDF and the provided sample JSON (see [SOURCE_REGISTER.md](SOURCE_REGISTER.md)). Priorities: **P0** = required by the assignment; **P1** = needed for a credible demo; **P2** = bonus or stretch.

Task IDs that implement each requirement are in [TASKS.md](TASKS.md). API shapes are in [openapi.yaml](openapi.yaml); AI behaviour is in [AI_SPEC.md](AI_SPEC.md).

## 1. Authentication and access

| ID | Pri | Requirement | Acceptance criteria |
|---|---|---|---|
| AUTH-01 | P0 | Email/password sign-in for authors and admins | Valid seeded credentials sign in; invalid credentials show a clear, non-revealing error ("Email or password is incorrect") |
| AUTH-02 | P0 | Every API route except health/docs requires a verified session | Calls without a valid bearer token return `401 UNAUTHENTICATED` |
| AUTH-03 | P0 | Role-based access: authors see only their own data; admins see everything | An author requesting another author's ticket or book receives `404 NOT_FOUND`; an author calling any `/admin/*` route receives `403 FORBIDDEN` |
| AUTH-04 | P0 | Identity and role are derived server-side from the verified token and profile, never from request input | Supplying `authorId`, `role` or `userId` in a body or query has no effect on authorization (tested) |
| AUTH-05 | P1 | Each portal accepts only its own role | An admin signing into the author portal (and vice versa) sees "This account doesn't have access to this portal" and is signed out |
| AUTH-06 | P1 | Self-signup disabled | Supabase Auth signups are disabled; accounts exist only via the seed script |

## 2. Author portal

| ID | Pri | Requirement | Acceptance criteria |
|---|---|---|---|
| AUTHOR-01 | P0 | My Books lists the signed-in author's books | Shows title, ISBN, genre, publication date, status, MRP, total copies sold, total royalty earned, royalty paid, royalty pending, for exactly the author's books in the dataset |
| AUTHOR-02 | P0 | Books in production render honestly | BK013/BK015-style records show "Not yet published" / "Not yet set" for null date, MRP and royalty-per-copy, and 0 for copies sold; never "₹0" for an unset price |
| AUTHOR-03 | P1 | Royalty summary | Totals for earned/paid/pending across the author's books; zero-pending books show "Fully paid"; pending below ₹1,000 notes the rollover threshold |
| AUTHOR-04 | P0 | Submit a query form | Fields: book dropdown (author's books + "General / Account Level"), subject, description, optional attachment control; client and server validation with inline errors |
| AUTHOR-05 | P0 | Ticket is created even if AI is unavailable | With AI disabled or failing, submission still returns success and the ticket appears in My Tickets with status Open |
| AUTHOR-06 | P0 | My Tickets lists the author's tickets | Each shows reference, subject, book (or General), status (Open / In Progress / Resolved / Closed), created and last-updated times |
| AUTHOR-07 | P0 | Ticket detail shows the original query and admin responses | Thread shows the original description and all sent admin replies in order; internal notes, AI drafts, AI category/priority and assignment are never shown |
| AUTHOR-08 | P2 | Real attachment upload | If implemented: private storage bucket, type/size limits, owner-only signed URLs. Otherwise the control is UI-only and states that clearly |
| AUTHOR-09 | P0 | Near-real-time updates | When an admin replies or changes status, the author's list and detail update within about 5 seconds without a manual refresh (stream), or within 15 seconds (polling fallback) |
| AUTHOR-10 | P2 | Author follow-up message | Author can add a follow-up message on an unresolved ticket; it appears in the admin thread |

## 3. Admin portal

| ID | Pri | Requirement | Acceptance criteria |
|---|---|---|---|
| ADMIN-01 | P0 | Ticket queue across all authors | Lists every ticket with reference, subject, author, book, status, category, priority, assignee, age |
| ADMIN-02 | P0 | Filters | By status, category, priority and created-date range; filters combine and are reflected in the URL |
| ADMIN-03 | P0 | Urgent and oldest unresolved tickets are easy to spot | Default sort: unresolved first, then priority (Critical, High, untriaged, Medium, Low), then oldest first; overdue first-response is marked with text and icon, not colour alone |
| ADMIN-04 | P0 | AI auto-classification into the six categories | New tickets receive one of: Royalty & Payments, ISBN & Metadata Issues, Printing & Quality, Distribution & Availability, Book Status & Production Updates, General Inquiry |
| ADMIN-05 | P0 | Admin can override category | Override persists, is labelled "Set by admin", and is audited with old/new values |
| ADMIN-06 | P0 | AI priority score (Critical / High / Medium / Low) | "No royalty for 6 months" ranks above "update my author bio"; rationale visible to admin |
| ADMIN-07 | P0 | Admin can override priority | Same behaviour as ADMIN-05 |
| ADMIN-08 | P0 | AI-drafted response on opening a ticket | Draft uses the ticket content plus relevant Knowledge Base sections and the author's own book facts; appears in an editable field |
| ADMIN-09 | P0 | Admin edits and explicitly sends | Nothing is sent without pressing Send; the sent text (as edited) appears on the author's ticket |
| ADMIN-10 | P0 | Manual reply when AI is unavailable | The reply editor works empty with a clear "AI draft unavailable: write manually" notice |
| ADMIN-11 | P0 | Update ticket status | Allowed transitions enforced server-side (see [.back/TICKET_LIFECYCLE.md](.back/TICKET_LIFECYCLE.md)) |
| ADMIN-12 | P0 | Internal notes | Admin-only notes on a ticket; never returned by any author endpoint (tested) |
| ADMIN-13 | P0 | Assign to self | Admin can assign an unassigned ticket to themselves or unassign themselves; queue can filter "Assigned to me" / "Unassigned" |
| ADMIN-14 | P1 | Queue summary counts | Counts for open, in progress, unassigned, critical, overdue and needs-manual-triage |
| ADMIN-15 | P1 | Concurrent edit safety | Two admins changing the same ticket: the stale write gets `409 VERSION_CONFLICT` and the UI reloads fresh data |
| ADMIN-16 | P1 | Ticket context panel | Author name, joined date and the author's books with royalty figures, shown beside the ticket |
| ADMIN-17 | P1 | Activity timeline | Status changes, overrides, assignment, replies and notes listed with actor and time |
| ADMIN-18 | P2 | AI usage view | Calls, failures, tokens and estimated cost by task for today |

## 4. API layer

| ID | Pri | Requirement | Acceptance criteria |
|---|---|---|---|
| API-01 | P0 | RESTful, consistently named endpoints under `/api/v1` | Plural nouns, kebab-free lower-case paths, standard verbs; see [INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md) |
| API-02 | P0 | Authentication middleware on all protected routes | Route inventory test: every route except `/health` and docs requires auth |
| API-03 | P0 | Role-based access control | Role guard per namespace plus ownership filtering per query; RLS as second layer |
| API-04 | P0 | Input validation with meaningful errors | Schema validation on body/query/params; `400 VALIDATION_FAILED` lists field-level issues; no raw 500s for bad input |
| API-05 | P0 | API documentation | `openapi.yaml` is complete for every endpoint and served at `/api/docs` |
| API-06 | P1 | Consistent error envelope with request ID | Every error has `code`, `message`, `requestId`; production never returns stack traces |
| API-07 | P1 | Rate limiting on expensive and abusable routes | Ticket creation, draft generation and re-triage are limited per user; `429 RATE_LIMITED` with `Retry-After` |

## 5. AI integration

Detailed design: [AI_SPEC.md](AI_SPEC.md).

| ID | Pri | Requirement | Acceptance criteria |
|---|---|---|---|
| AI-01 | P0 | Prompts grounded in the Knowledge Base and BookLeaf tone | Drafts acknowledge the concern, cite specific figures/dates/timelines from facts and policy, own company errors, give a timeline and end with a next step |
| AI-02 | P0 | API keys server-side only | No LLM or privileged key in any frontend bundle or `NEXT_PUBLIC_*` variable (checked by build-output grep) |
| AI-03 | P0 | Graceful degradation | With provider down, rate-limited, mis-keyed or over budget: tickets still create, ticket shows "Needs manual triage", admin can triage and reply manually |
| AI-04 | P0 | Cost awareness | One combined triage call per ticket; drafts generated on demand and cached; only relevant KB sections and the ticket's own facts are sent; token usage recorded per call |
| AI-05 | P0 | Model choice justified | Decision and rationale recorded in [.agent/DECISIONS.md](.agent/DECISIONS.md) and the README |
| AI-06 | P1 | Output validation | Category/priority must be exact enum values; invalid output never reaches the database |
| AI-07 | P1 | Prompt-injection containment | Ticket text is delimited as untrusted data; context contains only the ticket author's own data; injection test tickets do not change behaviour or leak data |
| AI-08 | P1 | Classification quality is measured | A labelled evaluation set reports category accuracy and priority agreement |
| AI-09 | P1 | Deterministic facts | Dates, payout windows and threshold checks are computed by code and passed to the model, never inferred by it |

## 6. Non-functional

| ID | Pri | Requirement | Acceptance criteria |
|---|---|---|---|
| NFR-01 | P0 | Seed data loaded exactly | All 10 authors and 18 books match the JSON field-for-field, including nulls (automated check) |
| NFR-02 | P0 | Live deployment | Public URLs for both portals and the API, over HTTPS |
| NFR-03 | P1 | Accessibility | Keyboard-operable, visible focus, labelled controls, status not conveyed by colour alone |
| NFR-04 | P1 | Responsive | Usable at the viewports in [.front/ACCESSIBILITY_RESPONSIVENESS.md](.front/ACCESSIBILITY_RESPONSIVENESS.md) |
| NFR-05 | P1 | Security baseline | [.agent/SECURITY_REVIEW_CHECKLIST.md](.agent/SECURITY_REVIEW_CHECKLIST.md) required items reviewed with evidence |
| NFR-06 | P1 | Empty, loading and error states for every screen | Specified in `.front/*/STATES.md` and verified manually |

## 7. Evaluation criteria mapping

| Assessment criterion (weight) | Where it is addressed |
|---|---|
| AI Integration Quality (25%) | AI-01..09, [AI_SPEC.md](AI_SPEC.md), [.back/AI_PROVIDER_ORCHESTRATION.md](.back/AI_PROVIDER_ORCHESTRATION.md), [.back/AI_FAILURE_HANDLING.md](.back/AI_FAILURE_HANDLING.md) |
| Architecture & Code Quality (25%) | [ARCHITECTURE.md](ARCHITECTURE.md), [.back/API_IMPLEMENTATION.md](.back/API_IMPLEMENTATION.md), [.front/FRONTEND_ARCHITECTURE.md](.front/FRONTEND_ARCHITECTURE.md) |
| API Design (15%) | API-01..07, [INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md), [openapi.yaml](openapi.yaml) |
| Functionality & Completeness (15%) | AUTH/AUTHOR/ADMIN requirements; edge cases AUTHOR-02, AUTHOR-03, ADMIN-10 |
| Product Thinking (10%) | [PRODUCT.md](PRODUCT.md), ADMIN-03, ADMIN-14..17, `.front/*/FLOWS.md` |
| Documentation & Communication (10%) | README, write-up, this documentation set, commit history per [GIT_WORKFLOW.md](GIT_WORKFLOW.md) |

## 8. Edge cases that must be handled

From the dataset (see [.back/SEED_DATA.md](.back/SEED_DATA.md)):

- Books in production with null MRP/date/royalty-per-copy (BK013, BK015).
- Books never paid out (null `last_royalty_payout_date`: BK005, BK010, BK016, BK018).
- Pending royalty below the ₹1,000 payout threshold (BK016: ₹850).
- Fully paid books (₹0 pending: BK002, BK007, BK008, BK014).
- An author with a book in production and a published book (AUTH009).
- Non-ASCII title (BK017 "Durga’s Daughters", curly apostrophe).
- Placeholder ISBNs (`978-93-5XXXX-…`): stored as given and never checksum-validated.

From the product:

- Author with no tickets yet (empty state), admin queue with no matches for a filter, AI pending/failed states, ticket on a book later in production, concurrent admin edits.
