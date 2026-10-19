# Frontend Architecture

**Owns:** structure of the two Next.js apps, data fetching, session handling and the real-time client. Visual rules: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). Status: planned.

## 1. Apps and shared packages

| Package | Role |
|---|---|
| `author-frontend/` (port 3000) | Author routes only |
| `admin-frontend/` (port 3001) | Admin routes only |
| `packages/ui` | Tokens (CSS custom properties), primitives (Button, Field, Badge, Table, …), icons |
| `packages/shared` | Enums, labels, zod schemas, DTO types, formatting helpers (money, dates, null wording) |

Both apps use the Next.js App Router with **client-side data fetching** against the backend. They do no server-side data access, hold no secrets and have no server actions touching data.

## 2. Route map

**author-frontend**

| Route | Screen | Auth |
|---|---|---|
| `/login` | Sign in | Public |
| `/` | Redirect → `/books` | Author |
| `/books` | My Books | Author |
| `/tickets` | My Tickets | Author |
| `/tickets/new` | Submit a Query (optional `?bookId=`) | Author |
| `/tickets/[ticketId]` | Ticket detail | Author |

**admin-frontend**

| Route | Screen | Auth |
|---|---|---|
| `/login` | Sign in | Public |
| `/` | Redirect → `/tickets` | Admin |
| `/tickets` | Queue (filters in query string) | Admin |
| `/tickets/[ticketId]` | Ticket detail | Admin |

Route guards are **UX only**. The backend enforces everything.

## 3. Source structure (per app)

```text
src/
├── app/                  routes, layouts, loading/error boundaries
├── features/             books/, tickets/, queue/, ticket-detail/ (components + hooks per feature)
├── lib/
│   ├── supabase.ts       browser client (URL + publishable key only)
│   ├── api-client.ts     fetch wrapper: base URL, bearer token, 401 refresh-once, error envelope → ApiError
│   ├── query-client.ts   TanStack Query config
│   └── events.ts         SSE client hook
└── providers/            QueryClientProvider, SessionProvider
```

## 4. Session

- Sign in with `supabase.auth.signInWithPassword`. The session is kept by supabase-js and the access token is attached by `api-client`.
- After sign-in, and for a stored session on load (Supabase `INITIAL_SESSION`), call `GET /me`. If `role` doesn't match the portal (or `/me` is 403), sign out and show "This account doesn't have access to the {author|admin} portal." If the API can't be reached, show a retry screen instead of signing out.
- On `401`: refresh the session once and retry; on a second `401`, sign out to `/login?reason=expired`.
- **Known trade-off:** supabase-js stores the session in `localStorage` by default, which XSS could read. Mitigated by React escaping, no `dangerouslySetInnerHTML` and CSP. Cookie-based sessions (`@supabase/ssr`) are the production upgrade (see [.agent/ALTERNATIVES.md](../.agent/ALTERNATIVES.md)).

## 5. Data fetching

TanStack Query keys (shared constants):

| Key | Endpoint | Invalidated by |
|---|---|---|
| `['me']` | `GET /me` | sign-in/out |
| `['author','books']` | `GET /author/books` | n/a (read-only data) |
| `['author','tickets', filters]` | `GET /author/tickets` | `ticket.updated`, create |
| `['author','ticket', id]` | `GET /author/tickets/{id}` | `ticket.updated` for id |
| `['admin','queue', filters]` | `GET /admin/tickets` | `ticket.created`, `ticket.updated`, `ticket.triaged`, `ticket.internal_updated` |
| `['admin','summary']` | `GET /admin/tickets/summary` | same as queue |
| `['admin','ticket', id]` | `GET /admin/tickets/{id}` | any event for id |
| `['admin','draft', id]` | `POST /admin/tickets/{id}/draft` | category override (context changed) |

- Mutations update the cache optimistically only for low-risk actions (assign). Status changes and sends wait for the server response.
- `refetchOnWindowFocus: true`, `retry: 1` for queries, `retry: 0` for mutations.

## 6. Real-time client

- `useTicketEvents()` opens `GET /events` with `fetch` + `ReadableStream`, parses SSE frames and invalidates query keys per event.
- Reconnect with backoff 1 s → 2 s → 5 s → 15 s. While disconnected, affected queries poll every 15 s (`refetchInterval`).
- A small indicator shows "Live" or "Refreshing every 15 s" (text, not colour).
- **Until API-8:** there is no stream yet, so My Tickets and the ticket page poll every 15 s and the indicator reads "Refreshing every 15 s" (D-031).

## 7. Forms and validation

- Controlled inputs validated with the **same zod schemas** the backend uses (`packages/shared`). Server `VALIDATION_FAILED` details map onto fields by `path`.
- Unsaved ticket and reply text survives errors. Drafts in the admin reply editor persist in `sessionStorage` per ticket until sent.

## 8. Errors

- `ApiError { code, message, details, requestId, status }`.
- Global error boundary shows a friendly message, a retry and the `requestId` ("Reference: req_…") for support.
- Never render raw server error text that isn't from the documented envelope.

## 9. Security headers

Next.js `headers()` config: `Content-Security-Policy` (self + backend origin + Supabase origin for `connect-src`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal, `frame-ancestors 'none'`.

Implemented in `author-frontend/next.config.ts` (D-031): `script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'` in dev), `style-src 'self' 'unsafe-inline'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. A per-request nonce would remove `'unsafe-inline'` but makes every page dynamic; it is a hardening option.
