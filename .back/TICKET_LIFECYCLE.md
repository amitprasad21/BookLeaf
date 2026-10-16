# Ticket Lifecycle

**Owns:** the status machine, who can trigger each transition, side effects and first-response targets. AI processing state (`ai_status`) is separate from ticket status and is described in [AI_SPEC.md](../AI_SPEC.md).

## 1. Status machine

```mermaid
stateDiagram-v2
    [*] --> open: author submits
    open --> in_progress: admin starts / first reply
    open --> resolved: admin resolves (incl. Send & resolve)
    open --> closed: admin closes (spam/duplicate)
    in_progress --> resolved: admin resolves
    in_progress --> closed: admin closes
    resolved --> in_progress: admin reopens
    resolved --> closed: admin closes
    closed --> in_progress: admin reopens
```

Authors never change status (A-17). Any transition not drawn returns `422 INVALID_STATUS_TRANSITION`. Same-status "transitions" are no-ops rejected by validation.

## 2. Side effects

| Event | Effects |
|---|---|
| Ticket created | `status=open`, `ai_status=pending`; audit `ticket.created`; event `ticket.created`; triage enqueued |
| AI triage completes | AI columns set; effective `category`/`priority` set **only if their `*_source` is null**; audit `ticket.triaged` (actor null); event `ticket.triaged` |
| Admin overrides category/priority | Effective value + `*_source='admin'`; AI columns untouched; audit `*_overridden` with old/new; event `ticket.internal_updated` |
| Admin sends reply | Message inserted; `first_response_at` set if null; status → `statusAfter` (default `in_progress`; from `open` or `in_progress` only; `resolved`/`closed` must be reopened first); audit `ticket.reply_sent` (+ `status_changed`); event `ticket.updated` |
| → resolved | `resolved_at = now()` |
| → closed | `closed_at = now()` |
| Reopen (→ in_progress from resolved/closed) | `resolved_at`, `closed_at` set null (history stays in audit) |
| Assign / unassign self | `assigned_admin_id` = caller / null; no status change; audit; event `ticket.internal_updated` |
| Internal note | Note inserted; audit `ticket.note_added` (no body in metadata); event `ticket.internal_updated` |
| Author follow-up (P2) | Allowed on `open`/`in_progress`; message inserted; event `ticket.updated` |

Every admin mutation of the ticket row checks `version` (optimistic locking) and increments it (trigger).

## 3. First-response targets (internal, assumption A-08)

| Priority | Target from `created_at` |
|---|---|
| Critical | 4 hours |
| High | 24 hours |
| Untriaged | 24 hours (treated as High until triaged) |
| Medium | 48 hours |
| Low | 72 hours |

`slaState` (computed in the API, not stored):

| State | Rule |
|---|---|
| `met` | `first_response_at` ≤ `created_at` + target |
| `breached` | No first response and now > `created_at` + target, or first response after target |
| `due_soon` | No first response and remaining time < 25% of target |
| `on_track` | Otherwise, with no first response yet |
| `not_applicable` | Closed without any response (spam/duplicates) |

These are internal operational targets, never promised to authors.

## 4. Queue urgency ordering (`sort=urgency`)

1. Unresolved (`open`, `in_progress`) before resolved/closed.
2. Priority rank: critical (0), high (1), untriaged (2), medium (3), low (4).
3. `created_at` ascending (oldest first).

Implemented in SQL with a `case` expression on priority so pagination stays stable.
