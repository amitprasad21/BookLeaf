# Product: BookLeaf Author Support & Communication Portal

**Owns:** product framing, users, outcomes, scope and non-goals. Requirements and acceptance criteria live in [PRD.md](PRD.md).

## 1. Problem

BookLeaf Publishing processes 1,200+ books a month across a 22,000+ title catalogue, working with thousands of authors in India and the US. Authors write in about royalties, book status, ISBN problems and print quality. Today these queries are handled manually, which leads to:

- **Slow responses**, especially during high-volume periods.
- **Inconsistent answers**: different staff explain the same policy differently.
- **A growing backlog**, where urgent problems (missing money, wrong ISBNs) wait behind simple questions.

## 2. Users

| User | Goal | What "good" feels like |
|---|---|---|
| **Author** (BookLeaf's partner) | Understand how their books and royalties are doing; get a clear, specific answer to a problem | Sees their own numbers without asking; raises a ticket in under a minute; gets a reply that names real figures, dates and a next step; never has to refresh to see it |
| **Operations admin** (BookLeaf support team) | Clear the queue quickly and correctly, urgent issues first | Opens the queue and immediately sees what's critical and what's oldest; gets a policy-accurate draft they can edit rather than writing from scratch; never loses a ticket when AI is down |

## 3. Outcomes we are building toward

| Outcome | Signal (measurable once built) |
|---|---|
| Faster first response | Median time from ticket creation to first admin reply |
| Consistent, policy-accurate replies | Share of AI drafts sent with only light edits; admin override rate of AI category/priority |
| Urgent issues handled first | Critical/High tickets breaching first-response targets |
| Resilience | Tickets created and replied to while AI is unavailable (must be 100%) |
| Cost control | AI tokens and estimated cost per ticket, within the configured daily budget |

These are product signals, not claims. None has been measured yet.

## 4. In scope

- Author portal: sign-in, My Books, Submit a Query, My Tickets with live updates.
- Admin portal: ticket queue with filters and urgency ordering, AI classification and priority with override, AI-drafted reply with human edit and explicit send, status changes, internal notes, self-assignment.
- One REST API with authentication, role-based access, validation, structured errors and OpenAPI documentation.
- AI orchestration with Knowledge Base grounding, output validation, cost controls and graceful degradation to manual mode.
- Exact seeding of the provided dataset, deployment of a live demo, README and a one-page write-up.

## 5. Non-goals (for this assessment)

- Author self-registration, password reset flows, OTP or social login (accounts are provisioned by seed/ops).
- Editing books, royalties or payouts: book and royalty data are read-only in this product.
- Sending email or SMS notifications.
- Automatic sending of AI-generated replies. A human always approves.
- Multi-language support, analytics dashboards beyond queue counts, and SLA reporting.
- Real attachment storage (bonus only; see PRD requirement AUTHOR-08).

## 6. Product principles

1. **Authors are partners.** Show them their real data; never show fake or zero values where data is missing (a book in production has no MRP yet, so show "Not yet set", not ₹0).
2. **Urgency first, then age.** The queue answers "what should I do next?" without configuration.
3. **AI assists, humans decide.** Every AI output is a suggestion with a visible source and an override.
4. **Nothing depends on AI being up.** Tickets save first; manual triage and replies always work.
5. **Specific over vague.** Replies name amounts, dates, statuses and timelines from BookLeaf policy.
