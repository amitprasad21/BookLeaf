# Deployment

**Owns:** environments, the environment-variable matrix, deploy order and post-deploy checks. Rollback: [.agent/ROLLBACK.md](../.agent/ROLLBACK.md). Credentials: [.agent/CREDENTIALS_GUIDE.md](../.agent/CREDENTIALS_GUIDE.md). **Status: nothing deployed. Hosting choice is proposed (D-017, Q-06). Deploying requires explicit approval.**

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
| `AI_PRIMARY_PROVIDER` / `AI_PRIMARY_MODEL` | ✓ | | | No |
| `ANTHROPIC_API_KEY` (or chosen provider key) | ✓ | **never** | **never** | **Yes** |
| `AI_FALLBACK_*` (optional) | ✓ | | | Key: **Yes** |
| `AI_DAILY_TOKEN_BUDGET` etc. | ✓ | | | No |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | | ✓ | ✓ | No (public) |
| `NEXT_PUBLIC_API_BASE_URL` | | ✓ | ✓ | No |
| `SEED_*_PASSWORD` | not deployed (seed runs from a trusted machine) | | | Demo-only |

## Deploy order (DEP-1..3)

1. **Database:** back up (if data exists) → apply migrations → run seed with verification → confirm signups are disabled.
2. **Backend (Render):** connect repo, root `backend/`, build `npm ci && npm run build -w backend`, start `npm run start -w backend`, set env, health check path `/api/v1/health`.
3. **Frontends (Vercel):** two projects from the same repo, root directories `author-frontend/` and `admin-frontend/`; set public env; deploy.
4. **CORS:** set `CORS_ALLOWED_ORIGINS` to the two exact Vercel production origins; redeploy backend.
5. **Smoke tests** (record in `.agent/verification/`):
   - `/api/v1/health` 200 over HTTPS.
   - Author sign-in → My Books matches the dataset.
   - Author creates a ticket → admin queue shows it with AI triage.
   - Admin opens it → draft → edits → sends → author sees it without refreshing.
   - Set `AI_PRIMARY_PROVIDER=none` → repeat create + manual reply → works → restore.
   - Preflight from an unlisted origin is rejected; a forced error returns no stack trace.
   - Frontend bundles contain no secret key patterns.

## Known hosting limitations

- Render free tier sleeps when idle, so the first request after idle can take tens of seconds. The README warns evaluators; the frontends show a "Waking up the server…" loading state after 5 s.
- Single backend instance: the SSE hub and in-memory rate limits are per instance (A-15).
