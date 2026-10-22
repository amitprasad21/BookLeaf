# Deployment

**Owns:** environments, environment variables, deploy order and post-deploy checks. Rollback: [.agent/ROLLBACK.md](../.agent/ROLLBACK.md). Credentials: [.agent/CREDENTIALS_GUIDE.md](../.agent/CREDENTIALS_GUIDE.md). **Status, 2026-10-22:** local builds pass and hosting configuration is prepared; nothing is deployed. The user requested completion of release work. Hosting sign-in, security review and deployed verification remain gates.

## Environments

| Env | Frontends | Backend | Database |
|---|---|---|---|
| Local | `localhost:3000` (author), `localhost:3001` (admin) | `localhost:4000` | Supabase cloud project (dev) |
| Production demo | Vercel (two projects) | Render web service | Supabase cloud project (prod; may be the same project for the assessment, decided at DEP-1) |

## Environment matrix

| Variable | Backend (Render) | author-frontend (Vercel) | admin-frontend (Vercel) | Secret? |
|---|---|---|---|---|
| `NODE_ENV=production` | ✓ | (Vercel sets) | (Vercel sets) | No |
| `PORT` | Render-provided | | | No |
| `CORS_ALLOWED_ORIGINS` | both Vercel origins | | | No |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | ✓ | | | No (public) |
| `SUPABASE_SECRET_KEY` | ✓ | **never** | **never** | **Yes** |
| `TRUST_PROXY_HOPS` | Blueprint proposes `1`; verify the deployed proxy chain | | | No |
| `AI_PRIMARY_PROVIDER` / `AI_FALLBACK_PROVIDER` | `gemini` / `groq` | | | No |
| `GEMINI_API_KEY` / `GROQ_API_KEY` | ✓ | **never** | **never** | **Yes** |
| `AI_PRIMARY_MODEL` / `AI_PRIMARY_DRAFT_MODEL` | Optional; defaults `gemini-3.5-flash-lite` | | | No |
| `AI_FALLBACK_MODEL` / `AI_FALLBACK_DRAFT_MODEL` | Optional; defaults `openai/gpt-oss-120b` | | | No |
| `AI_DAILY_TOKEN_BUDGET` etc. | ✓ | | | No |
| `AI_REQUEST_MIN_INTERVAL_MS` | `8000` (range 0–30000) | | | No |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | | ✓ | ✓ | No (public) |
| `NEXT_PUBLIC_API_BASE_URL` | | API HTTPS base ending in `/api/v1` | Same API base | No |
| `SEED_*_PASSWORD` | not deployed (seed runs from a trusted machine) | | | Demo-only |

## Deploy order (DEP-1..3)

1. **Source and database:** review/commit/publish the intended repository, excluding secrets and the assessment brief. Confirm the demo's Supabase project. The existing development project is already migrated and seeded; do not blindly rerun either operation. A new project needs separately approved migration/seed work and access-rule verification. Keep signups disabled.
2. **Backend (Render):** import [render.yaml](../render.yaml), with the **repository root** as the service root. Shared workspaces are required. Build: `npx -y npm@11.6.2 ci --include=dev && npm run build:packages && npm run build -w backend`; start: `npm run start -w backend`; health path: `/api/v1/health`. Node 24, free plan, Singapore region (confirm against Supabase before creation), automatic deploys off. Enter secrets directly in Render's settings.
3. **Frontends (Vercel):** two projects from the same repo, roots `author-frontend/` and `admin-frontend/`; enable access to files outside the root for shared workspaces. Each checked-in `vercel.json` installs/builds from the repository root. Use Node 24, set only public frontend variables, then deploy.
4. **CORS:** set `CORS_ALLOWED_ORIGINS` to the two exact Vercel production origins; redeploy backend.
5. **Smoke tests** (record in `.agent/verification/`):
   - `/api/v1/health` 200 over HTTPS.
   - Author sign-in → My Books matches the dataset.
   - Author creates a ticket → admin queue shows it with AI triage.
   - Admin opens it → draft → edits → sends → author sees it without refreshing.
   - Set `AI_PRIMARY_PROVIDER=none` → repeat create + manual reply → works → restore.
   - Preflight from an unlisted origin is rejected; a forced error returns no stack trace.
   - Frontend bundles contain no secret key patterns.
   - A second author cannot access the first author's book/ticket; internal notes never reach authors. Two-admin edits produce a version conflict, not a silent overwrite. Verify actual proxy trust and per-client IP limits.
6. Add actual repository/demo/API/Swagger URLs and intended demo credentials to README after the public demo access has been confirmed. Record outcomes rather than treating configured hosting files as a deployment.

## Known hosting limitations

- Render free services spin down after 15 minutes idle and may take about a minute to wake. The frontends show a delayed server-wakeup hint; warm-server latency does not apply to cold starts.
- Run one backend instance: the SSE hub, request limits, queue deduplication and provider pacing are per process (A-15). Scaling needs shared coordination first.
- Eight-second pacing covers provider calls, repairs and retries; triage jobs also start at least eight seconds apart. Waiting consumes the request timeout. This reduces bursts but does not guarantee token/minute or daily provider quotas; budget, breaker, bounded fallback and manual mode remain necessary.
- Production estimates remain awaiting confirmation, as accepted by the user. A development-only braces advisory has no listed patch; review limitations are recorded in [release verification](../.agent/verification/2026-10-22-release-preparation.md).

Official references checked during preparation: [Render Blueprint specification](https://render.com/docs/blueprint-spec), [Render free services](https://render.com/docs/free), [Vercel monorepos](https://vercel.com/docs/monorepos). These explain configuration; they do not establish that BookLeaf is deployed.
