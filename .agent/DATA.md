# Data Reasoning

**Owns:** what data the system holds, how sensitive it is, who may read or write it, and what may leave the system. Exact tables and columns are owned by [.back/DATA_MODEL.md](../.back/DATA_MODEL.md); policies by [.back/SUPABASE_RLS.md](../.back/SUPABASE_RLS.md).

## Data classes

| Data | Examples | Sensitivity | Owner | Leaves the system? |
|---|---|---|---|---|
| Author identity | name, email, phone, city, joined date | Personal data | Author (read-only in app) | Name's first token only, to the LLM, for greetings. **Email/phone/city never sent.** |
| Catalogue | title, ISBN, genre, status, publication date, print partner, platforms | Low | BookLeaf | Linked book's fields, to the LLM, when relevant |
| Royalty figures | MRP, per-copy royalty, copies sold, earned/paid/pending, last payout | Confidential financial | Author + BookLeaf finance | Only the ticket author's own figures, to the LLM, for royalty/general tickets |
| Ticket content | subject, description, author follow-ups | Personal / confidential; untrusted input | Author | Sent to the LLM as delimited untrusted data |
| Admin replies | sent messages | Business communication | BookLeaf | Last 4 thread messages may be sent as draft context |
| Internal notes | admin-only notes | Internal | BookLeaf ops | **Never** sent to the LLM, never to authors |
| AI suggestions and drafts | category, priority, rationale, draft text | Internal | BookLeaf ops | Never to authors (only the admin-sent reply is) |
| Audit events | action, actor, old/new values | Internal, integrity-critical | System | No |
| AI usage events | task, model, tokens, latency, outcome | Operational | System | No |
| Credentials | Supabase keys, LLM keys | Secret | Ops | Never logged, never in client bundles |

## Access patterns

| Actor | Reads | Writes |
|---|---|---|
| Author | Own profile, own author record, own books, own tickets, admin replies on own tickets | Create own tickets; (P2) follow-up messages on own unresolved tickets |
| Admin | All authors, books, tickets, messages, notes, drafts, audit, usage | Ticket status/category/priority/assignment, replies, notes, drafts (via API) |
| System writer | Ticket + linked book for background triage | AI fields on tickets, audit events, usage events |
| Seed script | Dataset file | Authors, books, auth users, profiles |

## Integrity rules

- Royalty fields are read-only in the product. Database check: `royalty_paid + royalty_pending = total_royalty_earned`.
- A ticket's book must belong to the ticket's author (composite foreign key).
- Audit and usage events are append-only (no update/delete grants or policies).
- Admin-overridden category/priority are never overwritten by AI.

## Retention (production considerations, not implemented)

- Ticket content: retain for the life of the author relationship; support export/delete on request.
- AI usage events: aggregate after 90 days.
- No prompts or completions stored in logs; drafts are stored because admins need them.

## Seed dataset specifics

See [.back/SEED_DATA.md](../.back/SEED_DATA.md) for the exact records and edge cases.
