# Integration Contract

**Owns:** the conventions that govern every request between the frontends and the backend: auth, envelopes, errors, pagination, concurrency, real-time events and versioning.
**Request/response schemas are owned by [openapi.yaml](openapi.yaml).** The endpoint index below is for navigation only. If it ever disagrees with `openapi.yaml`, the YAML wins and this table must be corrected.

**Status:** Draft v0.1 (contract-first; no implementation yet).

## 1. Base URL and versioning

- Base path: `/api/v1`. Local: `http://localhost:4000/api/v1`.
- Breaking changes require `/api/v2`. Additive changes (new optional fields, new endpoints) stay in v1.
- Interactive docs: `GET /api/docs` (Swagger UI) and the raw spec at `GET /api/openapi.yaml`.

## 2. Authentication

- Frontends sign in with Supabase Auth (email/password) and send the access token on every request: `Authorization: Bearer <access_token>`.
- The backend verifies the token, then loads the caller's profile (`role`, `authorId`) from the database. **Role and ownership never come from the request body, query or headers.**
- Expired or invalid token → `401 UNAUTHENTICATED`. Clients refresh the session once and retry; if it fails again they sign out.

## 3. Route namespaces and access

| Namespace | Who | Guard |
|---|---|---|
| `/health`, `/api/docs`, `/api/openapi.yaml` | Anyone | Public by design (no data) |
| `/me`, `/events` | Any authenticated user | Auth only; response scoped to the caller |
| `/author/*` | Role `author` | Auth + role guard + ownership in every query + RLS |
| `/admin/*` | Role `admin` | Auth + role guard + RLS admin policies |

Author and admin endpoints return **different DTOs**. Author DTOs are built by a dedicated serializer that has no access to internal fields (AI suggestions, priority, notes, assignee, drafts). This prevents accidental leakage through "return the whole row".

## 4. Endpoint index

| Method | Path | Role | Purpose | Req. IDs |
|---|---|---|---|---|
| GET | `/health` | public | Liveness + version | n/a |
| GET | `/me` | any | Caller profile and role | AUTH-04/05 |
| GET | `/events` | any | SSE stream of ticket events scoped to caller | AUTHOR-09 |
| GET | `/author/books` | author | Caller's books + royalty summary | AUTHOR-01..03 |
| GET | `/author/tickets` | author | Caller's tickets (paged, filter by status) | AUTHOR-06 |
| POST | `/author/tickets` | author | Create ticket (AI triage runs after save) | AUTHOR-04/05 |
| GET | `/author/tickets/{ticketId}` | author | Ticket + author-visible thread | AUTHOR-07 |
| POST | `/author/tickets/{ticketId}/messages` | author | Follow-up message (P2) | AUTHOR-10 |
| GET | `/admin/tickets` | admin | Queue with filters, urgency sort, paging | ADMIN-01..03 |
| GET | `/admin/tickets/summary` | admin | Queue counts | ADMIN-14 |
| GET | `/admin/tickets/{ticketId}` | admin | Full ticket, author context, thread, notes, AI, timeline | ADMIN-16/17 |
| PATCH | `/admin/tickets/{ticketId}` | admin | Status / category / priority / assignment (optimistic lock) | ADMIN-05/07/11/13/15 |
| POST | `/admin/tickets/{ticketId}/messages` | admin | Send reply to author (optionally from a draft) | ADMIN-09/10 |
| GET | `/admin/tickets/{ticketId}/notes` | admin | List internal notes | ADMIN-12 |
| POST | `/admin/tickets/{ticketId}/notes` | admin | Add internal note | ADMIN-12 |
| POST | `/admin/tickets/{ticketId}/draft` | admin | Get cached or generate AI draft (`regenerate` flag) | ADMIN-08 |
| POST | `/admin/tickets/{ticketId}/triage` | admin | Re-run AI triage after failure | AI-03 |
| GET | `/admin/ai/usage` | admin | Today's AI calls, failures, tokens, est. cost (P2) | ADMIN-18 |

## 5. Envelopes

Success:

```json
{ "data": { "...": "..." } }
```

Collections:

```json
{ "data": [ ], "meta": { "page": 1, "pageSize": 25, "total": 42 } }
```

Error (every non-2xx response):

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Some fields are invalid.",
    "details": [ { "path": "subject", "issue": "Must be between 5 and 150 characters." } ],
    "requestId": "req_01J9Z..."
  }
}
```

`requestId` matches the `X-Request-Id` response header and the server log line, so a user-reported error can be traced without exposing internals.

## 6. Error codes

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Body, query or path fails schema validation (field-level `details`) |
| 401 | `UNAUTHENTICATED` | Missing, invalid or expired token |
| 403 | `FORBIDDEN` | Authenticated but wrong role for the namespace |
| 404 | `NOT_FOUND` | Resource doesn't exist **or isn't owned by the caller** (never reveal which) |
| 409 | `VERSION_CONFLICT` | `PATCH` with a stale `version` |
| 413 | `VALIDATION_FAILED` | JSON body larger than 32 KB |
| 415 | `VALIDATION_FAILED` | Unsupported request body encoding/charset |
| 422 | `INVALID_STATUS_TRANSITION` | Transition not allowed by the lifecycle |
| 422 | `INVALID_ASSIGNMENT` | Assigning a ticket to someone other than yourself |
| 429 | `RATE_LIMITED` | Per-user limit hit; `Retry-After` header set |
| 503 | `AI_UNAVAILABLE` | AI cannot serve this request; `details[0].issue` is one of `not_configured`, `provider_unavailable`, `circuit_open`, `budget_exhausted`, `invalid_output`, `refused` |
| 500 | `INTERNAL_ERROR` | Unexpected failure; generic message only, details in server logs |

AI failures are **never** surfaced through ticket creation. `POST /author/tickets` succeeds regardless of AI state; only the explicit AI endpoints (`/draft`, `/triage`) can return `AI_UNAVAILABLE`.

## 7. Pagination, filtering and sorting

- `page` (default 1), `pageSize` (default 25, max 100).
- Multi-value filters are comma-separated: `status=open,in_progress`.
- Dates are ISO 8601 (`createdFrom=2026-10-01`). Timestamps in responses are UTC ISO strings. Business-date calculations (payout windows) use `Asia/Kolkata`.
- Admin queue `sort` values: `urgency` (default), `created_at`, `-created_at`, `-updated_at`.
  - `urgency` = unresolved first → priority rank (critical, high, *untriaged*, medium, low) → oldest `created_at` first.

## 8. Concurrency

- Admin ticket representations include an integer `version`.
- `PATCH /admin/tickets/{id}` requires `version` in the body. A mismatch returns `409 VERSION_CONFLICT` with `details: [{ path: "version", issue: "is out of date" }]` and the current representation in `error.current`. The UI shows it and tells the admin what changed (the newest timeline entry names who). The version check is repeated atomically in the UPDATE, so concurrent saves can't both win.
- Message and note creation are append-only and need no version.

## 9. Real-time events (SSE)

- `GET /api/v1/events` with `Accept: text/event-stream` and the bearer token. Clients use `fetch` streaming, not `EventSource`, so the token stays out of the URL.
- Event payloads contain identifiers only:

```text
event: ticket.updated
data: {"ticketId":"4f1c…","changes":["status","messages"],"at":"2026-10-16T10:15:00Z"}
```

| Event | Delivered to | Trigger |
|---|---|---|
| `ticket.created` | admins | Author created a ticket |
| `ticket.updated` | ticket's author + admins | Status change, new author-visible message |
| `ticket.triaged` | admins | AI triage finished (completed or manual review) |
| `ticket.internal_updated` | admins | Note added, override, assignment, AI triage re-run |

- `changes` names what changed: `created`, `status`, `messages`, `category`, `priority`, `assignee`, `notes`, `ai`.
- Heartbeat comment every 25 s. The server ends a stream after 10 minutes so the client reconnects with a current token; at most 5 streams per user (429). On disconnect, clients back off (1 s, 2 s, 5 s, then 15 s) and poll the relevant list every 15 s until reconnected.

## 10. Validation limits (shared schemas in `packages/shared`)

| Field | Rule |
|---|---|
| `subject` | Trimmed, 5–150 characters |
| `description` | Trimmed, 20–5,000 characters |
| `bookId` | `null` (General / Account Level) or a book ID owned by the caller |
| `attachmentName` | Optional, ≤ 255 chars; allowed extensions `.jpg .jpeg .png .pdf` (UI-only attachment) |
| Reply / note `body` | Trimmed, 1–5,000 characters |
| Unknown body fields | Rejected (`strict` schemas) |

## 11. Change process

1. Edit `openapi.yaml` first, then shared schemas, then backend, then frontends.
2. Update this file only if a convention changes.
3. Note the change in [.agent/HANDOVER.md](.agent/HANDOVER.md).
