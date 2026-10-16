# API Implementation

**Owns:** backend code structure, middleware order and coding conventions. The contract (paths, schemas, errors) is [openapi.yaml](../openapi.yaml) + [INTEGRATION_CONTRACT.md](../INTEGRATION_CONTRACT.md). Status: planned (API-1..API-8).

## 1. Layout

```text
backend/src/
├── server.ts                 starts HTTP server, sweeper, graceful shutdown
├── app.ts                    builds the Express app (exported for Supertest)
├── config/env.ts             zod-validated env; fails fast naming missing vars (never values)
├── lib/
│   ├── errors.ts             AppError subclasses → error codes
│   ├── logger.ts             pino with redaction
│   ├── clock.ts              injectable clock (tests pin dates; Asia/Kolkata business date)
│   └── payout-calendar.ts    quarter / due-date / threshold maths (pure, unit-tested)
├── types/express.d.ts        adds req.requestId
├── middleware/
│   ├── request-id.ts  http-logger.ts  cors.ts  error-handler.ts  not-found.ts   (API-1, built)
│   ├── authenticate.ts  require-role.ts  validate.ts  rate-limit.ts            (API-2 / API-4)
├── db/
│   ├── user-client.ts        per-request Supabase client carrying the caller's JWT (RLS applies)
│   └── system-writer.ts      secret-key client; narrow typed functions only (see AUTH_SECURITY §5)
├── modules/
│   ├── health/               router.ts (public liveness)
│   ├── me/                   router.ts · service.ts
│   ├── books/                router · service · repository · serializers
│   ├── tickets/              author.router · admin.router · service · repository · lifecycle.ts · serializers/{author,admin}.ts
│   ├── messages/  notes/  audit/
│   └── events/               hub.ts (in-process pub/sub) · router.ts (SSE)
├── ai/                       see .back/AI_PROVIDER_ORCHESTRATION.md
└── openapi/                  serves ../../openapi.yaml + Swagger UI
```

**Dependency direction:** router → service → repository → db. Services hold business rules (transitions, ownership, side effects) and never touch `req`/`res`. Repositories hold queries only. Serializers turn rows into DTOs; the author serializer has an explicit allowlist of fields.

## 2. Middleware order

| # | Middleware | Applies to | Notes |
|---|---|---|---|
| 1 | `requestId` | all | Accept a safe incoming `X-Request-Id` or generate one; echo it in the response header |
| 2 | `pino-http` | all | Logs only request id, method, URL, status and timing: no headers, IPs, user agents or bodies. Health checks are skipped. pino redaction masks credential-like fields (`authorization`, `cookie`, `*.password`, `*.token`, `*.apiKey`, `*.secret`) as a backstop for other log calls |
| 3 | `helmet` | all | HSTS, no-sniff, frameguard, minimal CSP for Swagger UI |
| 4 | `cors` | all | Exact-match allowlist from `CORS_ALLOWED_ORIGINS`; methods GET/POST/PATCH; headers Authorization, Content-Type, X-Request-Id |
| 5 | `express.json({ limit: '32kb' })` | all | Oversized → 413 envelope |
| 6 | Public routes | `/api/v1/health`, `/api/docs`, `/api/openapi.yaml` | No auth |
| 7 | `authenticate` | everything else under `/api/v1` | Verifies JWT, loads profile → `req.auth = { userId, role, authorId, displayName }` |
| 8 | `requireRole('author')` / `requireRole('admin')` | `/author/*`, `/admin/*` routers | 403 on mismatch |
| 9 | Route-level `rateLimit`, `validate({ params, query, body })` | per route | zod `strict()` schemas from `packages/shared` |
| 10 | Handler | | Calls service; returns `{ data }` |
| 11 | `notFound` | unmatched | `404 NOT_FOUND` envelope |
| 12 | `errorHandler` | all | Maps `AppError` → status/code; zod → 400 with field details; malformed JSON → 400; body > 32 KB → 413; bad encoding → 415; anything else → 500 `INTERNAL_ERROR` with requestId (stack only in logs). Planned with DB work: DB `rate_limited` → 429; FK/check violations → 400/404 |

## 3. Error classes

`ValidationError (400)`, `UnauthenticatedError (401)`, `ForbiddenError (403)`, `NotFoundError (404)`, `VersionConflictError (409, includes current DTO)`, `InvalidTransitionError (422)`, `InvalidAssignmentError (422)`, `RateLimitedError (429, retryAfter)`, `AiUnavailableError (503, reason)`. Services throw these, and only the error handler formats responses.

## 4. Conventions

- **Ownership:** author services always filter by `req.auth.authorId` even though RLS would too. A missing row → `NotFoundError`.
- **No client identity:** request schemas never contain `authorId`, `role` or `userId`. `strict()` rejects them.
- **Transactions:** multi-step writes (reply + status + first_response) go through a single Postgres function (RPC) so they are atomic. Audit is appended after commit via the system writer, and a failure there is logged but doesn't fail the request.
- **Events:** published only after a successful commit, with payload `{ type, ticketId, changes, at }`.
- **Time:** all "now" comes from `clock.ts`.
- **Config:** read once at startup from `config/env.ts`; no `process.env` elsewhere.
- **Docs:** each route handler has a one-line comment naming its `operationId` in `openapi.yaml`; contract tests compare responses to the spec (TEST_PLAN).

## 5. Rate limits (express-rate-limit, in-memory; see A-15)

| Route | Key | Limit |
|---|---|---|
| `POST /author/tickets` | user | 5 / 10 min, 20 / day (DB trigger backstop) |
| `POST /author/tickets/{id}/messages` | user | 10 / 10 min |
| `POST /admin/tickets/{id}/draft` (regenerate) | user | 10 / min; plus 5 regenerations / ticket / day (DB count) |
| `POST /admin/tickets/{id}/triage` | user | 5 / min; plus 3 manual retries / ticket / day |
| All authenticated routes | user | 300 / 5 min (abuse ceiling) |
| `/health` | IP | 60 / min |

## 6. SSE endpoint

- Sets `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`; flushes headers immediately.
- Registers the subscriber with `{ userId, role, authorId }`; the hub filters: admins get all events, authors only `ticket.updated` for tickets they own (the hub checks a cached ticket→author map populated on publish).
- Heartbeat `: ping` every 25 s; unregisters on `close`.
