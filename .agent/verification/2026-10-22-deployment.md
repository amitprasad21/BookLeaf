# Deployment checks — 2026-10-22

## Scope

The user deployed the API to Render and both portals to Vercel from `main` (`d8fca2f`) and asked for a check of every part. Claude Code ran the checks below from the user's machine (Windows, curl and Node 24), plus one request from Anthropic's servers via WebFetch for the proxy check. Everything was read-only: no tickets or other records were written, and no AI provider was called.

| Piece | URL |
|---|---|
| Author portal | https://bookleaf-author.vercel.app |
| Support console | https://bookleafsupport.vercel.app |
| API | https://bookleaf-338a.onrender.com/api/v1 |

## API (outside, no sign-in)

| Check | Result |
|---|---|
| `GET /health` | 200 `{"data":{"status":"ok","version":"0.1.0"}}` in about 1 s (instance awake) |
| Headers | `strict-transport-security: max-age=31536000; includeSubDomains`, `x-content-type-options: nosniff`, `x-frame-options: SAMEORIGIN`, `referrer-policy: no-referrer`, `x-request-id`; no `x-powered-by` |
| Swagger UI `/api/docs/`, `/api/openapi.yaml` | 200, 200 |
| Anonymous `GET /admin/tickets` and an unknown path | 401 `UNAUTHENTICATED` with a request id |
| Malformed JSON body | 400 `VALIDATION_FAILED` "Request body is not valid JSON.", no internal detail |
| Forged tokens (`alg: HS256`, `alg: none`) | 401 |
| CORS preflight, first run | Both portal origins refused; `http://localhost:3000` allowed. The running deploy still had the default development origins. Reported to the user. |
| CORS preflight, after the user's Render redeploy | `https://bookleaf-author.vercel.app` → 204 with matching `Access-Control-Allow-Origin`; `https://bookleafsupport.vercel.app` → 204 with matching header; `https://evil.example` and `http://localhost:3000` → no header (401). **PASS** |

## API (signed in, read-only)

A scratch script ran with `node --env-file=backend/.env`. It signed in through Supabase Auth with the seed demo accounts (values never printed), sent `Origin` set to each portal, and called GET endpoints only.

| Check | Result |
|---|---|
| Sign-in: AUTH001, AUTH002, ops admin | PASS |
| Author `GET /me` | 200, role `author` (first call about 2 s) |
| Author `GET /author/books` | 200, 2/2 books for AUTH001; copies sold, royalty earned/paid/pending, MRP and status equal to the seed |
| Second author sees only their own books | AUTH002: 2 books, no overlap with AUTH001 |
| Author `GET /author/tickets` | 200, 0 tickets (database has no tickets) |
| Author → `/admin/tickets` | 403 |
| Admin `GET /me` | 200, role `admin` |
| Admin `GET /admin/tickets/summary` | 200, all counts 0 |
| Admin `GET /admin/tickets` | 200, 0 tickets |
| Admin → `/author/books` | 403 |
| `GET /events` (author) | 200 `text/event-stream`, first chunk `: connected` |
| `Access-Control-Allow-Origin` on real responses | Each portal's own origin |
| `GET /admin/ai/usage` | 404: the P2 usage view is specified but not built (expected) |

13/13 checks passed. The cross-author ticket check was skipped because no tickets exist.

## Portals

| Check | Author portal | Support console |
|---|---|---|
| `/login` | 200, renders, no console errors | 200, renders, no console errors |
| Headers | CSP, HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Frame-Options: DENY`, nosniff, Referrer-Policy, Permissions-Policy | Same |
| CSP `connect-src` | `'self' http://localhost:4000 https://jhszxq….supabase.co` | `'self' https://bookleaf-338a.onrender.com https://jhszxq….supabase.co` |
| API base compiled into the JavaScript | **`http://localhost:4000/api/v1`** (15 chunks from `/login`, `/books`, `/tickets`, `/tickets/new`) | `https://bookleaf-338a.onrender.com/api/v1` |
| Secret patterns in the JavaScript (`sb_secret_…`, `AIza…`, `gsk_…`, secret variable names, `service_role`) | None | None |

**Finding D-1 (blocks sharing):** the live author portal was built while `NEXT_PUBLIC_API_BASE_URL` was the local value. After sign-in it would call the visitor's own `localhost:4000`, so authors can't load their books or tickets. Fix: in Vercel → `bookleaf-author` → Environment Variables, set `NEXT_PUBLIC_API_BASE_URL=https://bookleaf-338a.onrender.com/api/v1` for **Production**, then redeploy the production deployment without the build cache. Re-check: the `connect-src` header must name the Render origin.

## Proxy and per-IP limits

- 61 sequential health checks (about a minute) and then 75 parallel ones within 4 s from one machine: **all 200**. The per-IP health limit (60/min) never triggered.
- A request from another network (WebFetch) right after: 200.
- A spoofed `X-Forwarded-For` from the limited machine: 200.

**Finding D-2:** behind Render's proxies, requests from one client don't share one rate-limit key, so the per-IP limits (health checks; 50 requests without a valid session per 5 min) aren't per visitor. Per-user limits are unaffected. The existing follow-up proposal (make the bad-token limit independent of client IPs; cap JWKS refetches) addresses the auth-related part; the hop count can't be determined from outside without a diagnostic endpoint.

## Not run

- The write journey on the live system (author raises a ticket → AI triage on Gemini → admin draft → reply → author sees it live), the AI-off path and a two-admin conflict: they create records and call the AI providers, so they need the user's approval or the user's own browser run.
- Signed-in UI in the deployed portals (needs the user's sign-in in the browser pane), cold-start timing after 15 idle minutes, the phone-network proxy check.
