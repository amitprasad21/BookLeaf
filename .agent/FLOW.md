# Flow: Real Call Paths

**Owns:** how requests actually travel across UI → API → services → database → AI. **Status: planned paths.** Update this file whenever the implementation diverges.

## 1. Sign-in and session

```mermaid
sequenceDiagram
    participant U as Author/Admin browser
    participant SA as Supabase Auth
    participant API as Backend
    participant DB as Postgres (RLS)
    U->>SA: signInWithPassword(email, password)
    SA-->>U: access token (JWT) + refresh token
    U->>API: GET /api/v1/me (Bearer JWT)
    API->>API: verify JWT
    API->>DB: select profile where id = auth.uid() (user-scoped client)
    DB-->>API: role, author_id, display_name
    API-->>U: { role, author? }
    Note over U: Portal checks role. Wrong portal → sign out + message
```

## 2. Author creates a ticket (save first, AI second)

```mermaid
sequenceDiagram
    participant A as author-frontend
    participant API as Backend
    participant DB as Postgres (RLS)
    participant Q as In-process AI queue
    participant LLM as LLM provider
    participant SW as System writer
    participant H as Event hub
    A->>API: POST /author/tickets {bookId, subject, description}
    API->>API: auth → role=author → rate limit → zod validate
    API->>DB: insert ticket (author_id from profile, status=open, ai_status=pending)
    Note over DB: RLS WITH CHECK: author_id = current_author_id()<br/>FK (book_id, author_id) proves book ownership
    DB-->>API: ticket row
    API->>H: ticket.created (admins)
    API-->>A: 201 { ticket }
    API->>Q: enqueue triage(ticketId)
    Q->>SW: load ticket + book facts (server-side)
    Q->>Q: build minimal context, check budget and circuit
    Q->>LLM: triage call (structured output)
    alt valid output
        LLM-->>Q: {category, priority, confidence, signals, rationale}
        Q->>Q: validate, apply policy floors
        Q->>SW: update ai_* columns, ai_status=completed
    else failure / invalid / refused / no budget
        Q->>SW: ai_status=failed or manual_review_required, ai_failure_reason
    end
    Q->>H: ticket.triaged (admins)
```

## 3. Admin opens a ticket and gets a draft

```mermaid
sequenceDiagram
    participant M as admin-frontend
    participant API as Backend
    participant DB as Postgres (RLS)
    participant AI as AI orchestrator
    participant LLM as LLM provider
    M->>API: GET /admin/tickets/{id}
    API->>DB: ticket + author + books + messages + notes + events (admin policies)
    API-->>M: AdminTicketDetail
    M->>API: POST /admin/tickets/{id}/draft {regenerate:false}
    API->>AI: getOrCreateDraft(ticketId, admin)
    AI->>AI: build facts + select KB sections + context hash
    AI->>DB: find ready draft with same hash
    alt cached
        DB-->>AI: draft
        AI-->>API: 200 draft
    else needs generation
        AI->>LLM: draft call
        LLM-->>AI: structured draft
        AI->>AI: validate, placeholder guard, fact guard
        AI->>DB: insert ai_drafts (admin client)
        AI-->>API: 201 draft
    end
    alt AI unavailable
        AI-->>API: AI_UNAVAILABLE(reason)
        API-->>M: 503 → empty editor, manual mode notice
    end
```

## 4. Admin sends a reply; author sees it live

```mermaid
sequenceDiagram
    participant M as admin-frontend
    participant API as Backend
    participant DB as Postgres
    participant SW as System writer
    participant H as Event hub
    participant A as author-frontend
    M->>API: POST /admin/tickets/{id}/messages {body, draftId?, statusAfter}
    API->>API: auth → role=admin → validate → transition check
    API->>DB: insert ticket_messages (sender_role=admin)
    API->>DB: update ticket status, first_response_at, version+1
    API->>SW: audit ticket.reply_sent (+ status_changed)
    API->>H: ticket.updated {ticketId, changes:[messages,status]}
    API-->>M: 201
    H-->>A: SSE ticket.updated (only if A owns ticketId)
    A->>API: GET /author/tickets/{id}
    API-->>A: thread incl. new reply (author serializer)
```

## 5. Admin override and assignment

`PATCH /admin/tickets/{id} {version, category?, priority?, status?, assignedAdminId?}`
→ auth → role=admin → validate → load ticket → version check (409) → transition check (422) → assignment check (self or null) → update + `version+1` → `category_source/priority_source='admin'` for overrides → audit event per changed field (old/new) → `ticket.internal_updated` or `ticket.updated` (status) → 200.

## 6. Startup recovery

On boot: select tickets with `ai_status in ('pending','failed')`, `created_at < now() - 2 min` and `ai_attempts < 3` → enqueue triage. Tickets reaching 3 attempts → `manual_review_required`.
