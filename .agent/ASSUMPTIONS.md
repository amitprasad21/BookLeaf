# Assumptions

Each assumption is something we are acting on without confirmation. Confirm or correct them as soon as possible; when one changes, update the linked documents.

| ID | Assumption | Basis | Affects | Status |
|---|---|---|---|---|
| A-01 | Assignment received 2026-10-16; deadline 2026-10-20 | Bundle file dates | Scope, stretch goals | Unconfirmed (Q-01) |
| A-02 | Royalty quarters are calendar quarters (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec) | KB says "quarterly"; Indian FY quarters share the same month boundaries | Payout facts | Unconfirmed |
| A-03 | "Paid within 45 days" means 45 calendar days after the quarter's last day | KB wording | Payout due dates | Unconfirmed |
| A-04 | Business date and time zone: `Asia/Kolkata` | India-first operations | Facts, SLA display | Assumed |
| A-05 | Accounts are provisioned by BookLeaf (seed), not self-registered; one demo password per role, published in the README for the live demo only | Assignment: "Include test login credentials in your README" | Auth, seed | Assumed |
| A-06 | Admin users are not in the dataset; two admin accounts are created: `admin@bookleaf.test` and `support.lead@bookleaf.test` (`.test` is a reserved TLD) | Dataset has authors only | Seed, demo | Assumed |
| A-07 | Admin replies are signed "BookLeaf Support" in the author view; admins see the sending admin's display name | Authors can't read admin profiles under RLS, and a team signature stays consistent when several admins reply | Author thread DTO and UI | Assumed (changed at API-4; was "admin's name + BookLeaf Support") |
| A-08 | Internal first-response targets: Critical 4 h, High 24 h, Medium 48 h, Low 72 h (wall-clock) | Not in KB; needed to make "urgent and oldest" visible | Queue SLA state | Assumed (internal targets, not promises to authors) |
| A-09 | Legal, rights or copyright concerns are Critical | Business risk | Priority floor | Assumed |
| A-10 | Tickets are written in English | Dataset/KB in English | Prompts, eval | Assumed |
| A-11 | Author emails in the dataset are fictional; no email is ever sent to them | Sample data | Seed (create users with email confirmed, no invites) | Assumed |
| A-12 | A book is "published" exactly when `status = "Published & Live"`; other statuses are `"In Production - <Stage>"` | Dataset values | Book UI, facts | Assumed |
| A-13 | Authors do not see category or priority | Internal triage data; a wrong AI label shouldn't confuse authors | Author DTO | Assumed |
| A-14 | Monochrome dark theme with provisional tokens | Blueprint rules; spec missing | UI | Provisional (Q-02) |
| A-15 | The demo runs a single backend instance | Free-tier hosting | SSE hub, in-memory rate limits | Assumed; documented limitation |
| A-16 | Self-assignment only: an admin takes an **unassigned** ticket or releases **their own**; no assigning others and no taking over a colleague's ticket (D-026) | Assignment: "assign tickets to themselves" | PATCH rules | Assumed |
| A-17 | Closed tickets can be reopened by an admin (to In Progress); authors cannot change status | Ops flexibility | Lifecycle | Assumed |
| A-18 | The demo may run on Gemini's free tier, where Google may use prompts and outputs to improve its products; a production deployment uses the paid tier (no such use) | Free keys supplied for the assessment; the dataset is fictional (A-11) | AI provider config, README limitations | Assumed (D-028) |
