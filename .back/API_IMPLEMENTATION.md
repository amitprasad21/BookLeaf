# API Implementation

**Owns:** backend code structure, middleware order and coding conventions. The contract (paths, schemas, errors) is [openapi.yaml](../openapi.yaml) + [INTEGRATION_CONTRACT.md](../INTEGRATION_CONTRACT.md). Status: API-1..API-7 built; API-8 planned.

## 1. Layout

```text
backend/src/
├── server.ts                 starts HTTP server, sweeper, graceful shutdown
├── app.ts                    builds the Express app (exported for Supertest)
├── config/env.ts             zod-validated env; fails fast naming missing vars (never values)
├── lib/
│   ├── errors.ts             AppError subclasses → error codes
│   ├── logger.ts             pino with redaction
│   └── clock.ts              injectable clock (tests pin dates); business date via @bookleaf/shared
├── types/express.d.ts        adds req.requestId, req.auth, req.db
├── auth/                     types.ts (AuthContext, AuthVerifier) · supabase-verifier.ts (API-2)
├── middleware/
│   ├── request-id.ts  http-logger.ts  cors.ts  error-handler.ts  not-found.ts   (API-1, built)
│   ├── authenticate.ts  require-role.ts                                        (API-2, built)
│   ├── rate-limit.ts         perUserLimit() (API-4, built); validation happens in handlers (D-024)
├── db/
│   ├── user-client.ts        per-request Supabase client carrying the caller's JWT (RLS applies)
│   └── system-writer.ts      secret-key client; narrow typed functions only (see AUTH_SECURITY §5); appendAuditEvents built (API-4, batched in API-6)
├── modules/
│   ├── health/               router.ts (public liveness)
│   ├── me/                   router.ts (API-2)
│   ├── author/               router.ts: createAuthorRouter({ clock, audit, ticketsRepository }): /books (API-3), /tickets (API-4)
│   ├── admin/                router.ts: createAdminRouter({ clock, audit, adminTicketsRepository }): /tickets, /tickets/summary (API-5), /tickets/:ticketId GET + PATCH (API-6), /tickets/:ticketId/messages POST and /notes GET + POST (API-7)
│   ├── books/                repository · service (royalty summary) · serializers (API-3)
│   ├── tickets/              repository.ts · serializers/author.ts (API-4); admin-repository.ts · serializers/admin.ts (API-5); admin-service.ts (PATCH planner, API-6)
│   ├── audit/                service.ts: createAuditRecorder (logs and swallows failures) (API-4)
│   ├── messages/  notes/
│   └── events/               hub.ts (in-process pub/sub) · router.ts (SSE)
├── ai/                       see .back/AI_PROVIDER_ORCHESTRATION.md
│
packages/shared/src/payout-calendar.ts   quarter / 45-day due date / ₹1,000 threshold / overdue heuristic
                                         (pure; shared by the API, AI facts and frontends; tested in backend/test)
packages/shared/src/sla.ts               first-response targets, slaState, overdue cut-offs (API-5)
packages/shared/src/ticket-lifecycle.ts  status machine: STATUS_TRANSITIONS, canTransition (API-6)
packages/shared/src/schemas.ts           request schemas: author tickets (API-4), admin queue query (API-5)
└── openapi/                  serves ../../openapi.yaml + Swagger UI
```

**Dependency direction:** router → service → repository → db. Services hold business rules (transitions, ownership, side effects) and never touch `req`/`res`. Repositories hold queries only. Serializers turn rows into DTOs; the author serializer has an explicit allowlist of fields.

## 2. Middleware order

| # | Middleware | Applies to | Notes |
|---|---|---|---|
| 1 | `requestId` | all | Accept a safe incoming `X-Request-Id` or generate one; echo it in the response header |
| 2 | `pino-http` | all | Logs only request id, method, URL, status and timing: no headers, IPs, user agents or bodies. The value of the `q` search parameter is logged as `redacted` (D-025). Health checks are skipped. pino redaction masks credential-like fields (`authorization`, `cookie`, `*.password`, `*.token`, `*.apiKey`, `*.secret`) as a backstop for other log calls |
| 3 | `helmet` | all | HSTS, no-sniff, frameguard, minimal CSP for Swagger UI |
| 4 | `cors` | all | Exact-match allowlist from `CORS_ALLOWED_ORIGINS`; methods GET/POST/PATCH; headers Authorization, Content-Type, X-Request-Id |
| 5 | `express.json({ limit: '32kb' })` | all | Oversized → 413 envelope |
| 6 | Public routes | `/api/v1/health`, `/api/docs`, `/api/openapi.yaml` | No auth |
| 7 | `authenticate` | everything else under `/api/v1` | Verifies JWT, loads profile → `req.auth = { userId, role, authorId, displayName }` |
| 8 | `requireRole('author')` / `requireRole('admin')` | `/author/*`, `/admin/*` routers | 403 on mismatch |
| 9 | Route-level `perUserLimit(...)` | per route | In-memory, keyed by user id; failed requests don't count |
| 9a | `Schema.parse(req.body / req.query / req.params)` in the handler | per route | Strict zod schemas from `packages/shared`; a `ZodError` becomes a 400 with field details (D-024) |
| 10 | Handler | | Calls service; returns `{ data }` |
| 11 | `notFound` | unmatched | `404 NOT_FOUND` envelope |
| 12 | `errorHandler` | all | Maps `AppError` → status/code; zod → 400 with field details; malformed JSON → 400; body > 32 KB → 413; bad encoding → 415; anything else → 500 `INTERNAL_ERROR` with requestId (stack only in logs). Database errors are mapped in repositories (`mapPostgrestError`): DB `rate_limited` → 429, FK/check violations → 400, RLS refusal → 403 (API-4) |

## 3. Error classes

`ValidationError (400)`, `UnauthenticatedError (401)`, `ForbiddenError (403)`, `NotFoundError (404)`, `VersionConflictError (409, current DTO in error.current)`, `InvalidTransitionError (422)`, `InvalidAssignmentError (422)`, `RateLimitedError (429, retryAfter)`, `AiUnavailableError (503, reason)`. Services throw these, and only the error handler formats responses.

## 4. Conventions

- **Ownership:** author services always filter by `req.auth.authorId` even though RLS would too. A missing row → `NotFoundError`.
- **No client identity:** request schemas never contain `authorId`, `role` or `userId`. `strict()` rejects them.
- **Transactions:** multi-step writes (reply + status + first_response) go through a single Postgres function (RPC) so they are atomic: `admin_send_reply` (API-7, D-027). Audit is appended after commit via the system writer, and a failure there is logged but doesn't fail the request.
- **Events:** published only after a successful commit, with payload `{ type, ticketId, changes, at }`.
- **Time:** all "now" comes from `clock.ts`.
- **Config:** read once at startup from `config/env.ts`; no `process.env` elsewhere.
- **Docs:** each route handler has a one-line comment naming its `operationId` in `openapi.yaml`; contract tests compare responses to the spec (TEST_PLAN).

## 5. Rate limits (express-rate-limit, in-memory; see A-15)

| Route | Key | Limit |
|---|---|---|
| `POST /author/tickets` | user | 5 / 10 min, 20 / day (DB trigger backstop) **(built, API-4)** |
| `POST /author/tickets/{id}/messages` | user | 10 / 10 min |
| `POST /admin/tickets/{id}/draft` (regenerate) | user | 10 / min; plus 5 regenerations / ticket / day (DB count) |
| `POST /admin/tickets/{id}/triage` | user | 5 / min; plus 3 manual retries / ticket / day |
| All authenticated routes | user | 300 / 5 min (abuse ceiling) |
| `/health` | IP | 60 / min |

## 6. SSE endpoint

- Sets `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`; flushes headers immediately.
- Registers the subscriber with `{ userId, role, authorId }`; the hub filters: admins get all events, authors only `ticket.updated` for tickets they own (the hub checks a cached ticket→author map populated on publish).
- Heartbeat `: ping` every 25 s; unregisters on `close`.
