# Deployment

**Owns:** environments, environment variables, deploy order and post-deploy checks. Rollback: [.agent/ROLLBACK.md](../.agent/ROLLBACK.md). Credentials: [.agent/CREDENTIALS_GUIDE.md](../.agent/CREDENTIALS_GUIDE.md). **Status, 2026-10-22:** the repository is public on GitHub (`main`), local builds and all offline tests pass, and the hosting files are ready ([render.yaml](../render.yaml), one `vercel.json` per portal). **Deployed by the user on 2026-10-22:** API https://bookleaf-338a.onrender.com/api/v1, author portal https://bookleaf-author.vercel.app, support console https://bookleafsupport.vercel.app. Live checks and open findings: [deployment record](../.agent/verification/2026-10-22-deployment.md).

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

## Deployment runbook (DEP-1..3)

Every step below is done by the user in the hosting dashboards: accounts, secrets and the deploy buttons stay with the user (C-16). Secrets are pasted directly into Render or Vercel from the local env files, never into chat, issues or commits.

### 0. Before you start

| Decide or collect | Recommendation |
|---|---|
| Source | `main` on [github.com/amitprasad21/BookLeaf](https://github.com/amitprasad21/BookLeaf) (public). Both hosts deploy from it. |
| Supabase project for the demo | Reuse the existing project: it is already migrated, seeded (10 authors, 18 books, 12 logins) and RLS-tested. Don't rerun migrations or the seed. Local development and the demo then share data, so delete test tickets before handing in. A new project would need separately approved migration, seed and RLS work. |
| Render region | The region closest to the Supabase project (every API request reads the caller's profile there). The Blueprint says `singapore`; if Supabase isn't in Asia, change `region` in [render.yaml](../render.yaml) and push **before** step 1, because Render can't move a service later. Render regions: `oregon`, `ohio`, `virginia`, `frankfurt`, `singapore`. |
| Names (they set the URLs) | Render service `bookleaf-api` → `https://bookleaf-api.onrender.com`. Vercel projects `bookleaf-author` and `bookleaf-admin` → `https://bookleaf-author.vercel.app` and `https://bookleaf-admin.vercel.app`. If a name is taken, the host adds a suffix: always use the URL the dashboard shows. |
| Values to paste (from `backend/.env`) | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`. The frontends need only the URL and the **publishable** key. |

### 1. Backend on Render (DEP-1)

1. Sign in at [dashboard.render.com](https://dashboard.render.com) with GitHub and allow Render to read `amitprasad21/BookLeaf`.
2. **New → Blueprint**, pick the repository and branch `main`. Render reads `render.yaml` from the repository root and lists one service, `bookleaf-api` (Node, free plan).
3. Render asks for the values marked `sync: false`:
   - `CORS_ALLOWED_ORIGINS`: `https://bookleaf-author.vercel.app,https://bookleaf-admin.vercel.app` (the planned Vercel origins; corrected in step 4 if Vercel assigns different ones). The API refuses to start in production without this list.
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`.
   Everything else (Node 24, `NODE_ENV=production`, `TRUST_PROXY_HOPS=1`, Gemini primary + Groq fallback, budget, 8 s pacing) comes from the file.
4. **Apply.** Render creates the service and runs the first deploy even though automatic deploys are off. The build installs the whole workspace with npm 11.6.2, builds `packages/shared` and `packages/ui`, then the API; expect several minutes.
5. Check it:
   - The log ends with `BookLeaf API listening` showing `"nodeEnv":"production"` and `"ai":"gemini"`. A missing setting stops startup with the variable's **name** only.
   - `https://<api-host>/api/v1/health` returns `{"data":{"status":"ok",…}}`; `https://<api-host>/api/docs` shows Swagger UI.
6. Note the exact service URL from the top of the service page; the frontends need it in step 2.

Later releases: automatic deploys are off, so a push changes nothing until **Manual Deploy → Deploy latest commit**.

### 2. Author portal on Vercel (DEP-2)

1. Sign in at [vercel.com](https://vercel.com) with GitHub. **Add New → Project → Import** `amitprasad21/BookLeaf`.
2. Project name `bookleaf-author`. **Root Directory → Edit → `author-frontend`**. Framework: Next.js (detected). Leave the build and install commands alone: [author-frontend/vercel.json](../author-frontend/vercel.json) installs from the repository root with npm 11.6.2 and builds the shared packages first.
3. **Environment Variables** (before the first deploy: they are compiled into the bundle and into the page's Content-Security-Policy, so changing them later needs a redeploy):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | same as `SUPABASE_URL` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key (**never** the secret key) |
   | `NEXT_PUBLIC_API_BASE_URL` | `https://<api-host>/api/v1` (the Render URL from step 1, ending in `/api/v1`, no trailing slash) |

4. **Deploy.** Then, in **Settings → Build and Deployment**: set **Node.js Version** to 24.x (matches local and Render; redeploy if it changed) and keep "Include files outside the root directory in the Build Step" **enabled** (the portal imports `packages/shared` and `packages/ui`).
5. Note the production domain under **Settings → Domains** (e.g. `https://bookleaf-author.vercel.app`). Open it: the sign-in page loads. If the API is asleep, "Waking up the server…" appears after 5 s.

### 3. Support console on Vercel (DEP-2)

Repeat step 2 with project name `bookleaf-admin`, Root Directory `admin-frontend`, and the same three variables with the same values. Note its production domain.

Vercel deploys both projects on every push to `main` (a project whose files didn't change is skipped). Preview deployments get other URLs, which the API's CORS list doesn't include, so only the production domains can call the API.

### 4. Lock CORS to the real origins

In Render → `bookleaf-api` → **Environment**, set `CORS_ALLOWED_ORIGINS` to the two production domains from steps 2 and 3: `https://…`, no trailing slash, comma-separated. Save and redeploy. Check from a terminal:

```bash
curl -s -o /dev/null -D - -X OPTIONS -H "Origin: https://bookleaf-admin.vercel.app" -H "Access-Control-Request-Method: GET" https://bookleaf-api.onrender.com/api/v1/me
```

The answer must contain `Access-Control-Allow-Origin` with that origin. Repeat with `-H "Origin: https://evil.example"`: no such header.

### 5. Check the proxy setting (`TRUST_PROXY_HOPS`)

The per-IP limits (health 60/min; 50 failed sign-ins per 5 min) need the visitor's real IP from `X-Forwarded-For`. Render doesn't document how many proxies sit in front of a service, and community reports differ, so test it once:

- **Too low:** every visitor shares one bucket. 50 bad or expired tokens from anyone would make the API answer 429 to **everyone** for up to 5 minutes.
- **Too high:** a client can fake its IP and dodge the per-IP limits (the per-user limits still apply).

1. From a laptop, run 61 health checks within a minute:

   ```bash
   for i in $(seq 1 61); do curl -s -o /dev/null -w "%{http_code}\n" https://bookleaf-api.onrender.com/api/v1/health; done | sort | uniq -c
   ```

   Expect 60 × `200` and 1 × `429`.
2. Within the same minute, open the health URL on a phone using **mobile data** (not the same Wi-Fi). It must show `"status":"ok"`. If it shows "Too many health checks", the value is too low: raise `TRUST_PROXY_HOPS` by one, redeploy, wait a minute and repeat.
3. Still within the minute, from the laptop:

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -H "X-Forwarded-For: 203.0.113.50" https://bookleaf-api.onrender.com/api/v1/health
   ```

   It must stay `429`. A `200` means the value is too high: lower it by one and repeat.

Record the final value in the verification record.

### 6. Supabase checks (DEP-3)

- **Authentication → Sign In / Providers:** new-user sign-ups stay **off** (accounts are provisioned by the seed).
- Don't rerun migrations or the seed against the existing project. `npm run check:db` (local, read-only) confirms tables, policies and grants.
- Delete leftover test tickets before the hand-in (with approval; ROLLBACK.md "Demo data reset").

### 7. Smoke tests on the live URLs

The user signs in; Claude can then drive the browser pane and record results in `.agent/verification/`.

1. Author (e.g. `priya.sharma@email.com`) signs in → My Books matches the dataset (books, royalties, pending amounts).
2. Author raises a query → the console queue shows it within seconds, triaged by AI (category, priority).
3. Admin opens it → AI draft → edits → sends → the author's ticket shows the reply without a refresh.
4. AI-down path: set `AI_PRIMARY_PROVIDER=none` on Render → create a ticket → it lands as manual review, the admin replies by hand → restore `gemini` (each change redeploys).
5. A second author can't open the first author's ticket (404); internal notes never appear for authors; two admins editing one ticket get a version conflict, not a silent overwrite.
6. Security: step 4 (CORS) and step 5 (proxy) pass; responses carry `Strict-Transport-Security`; errors show a request id and no stack trace; the deployed JavaScript contains no `sb_secret_`, `AIza…` or `gsk_…` strings.
7. Cold start: after 15+ idle minutes the first page shows "Waking up the server…" and then loads (about a minute).

### 8. Finish (DOCS-2)

Put the live URLs (both portals, API health, Swagger) in README, and decide whether to publish the demo passwords there. Publishing them lets anyone sign in, including as admin, and use the AI budget (capped by `AI_DAILY_TOKEN_BUDGET`); sharing them privately with the evaluators avoids that. Commit the verification record.

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Build log: `Cannot read properties of null (reading 'edgesOut')` | npm 10 ran the install | The install must start with `npx -y npm@11.6.2` (render.yaml / vercel.json) |
| Vercel build: `Cannot find module '@bookleaf/shared'` | Root Directory wrong, or files outside it excluded | Root `author-frontend` / `admin-frontend`; enable "Include files outside the root directory" |
| Render log: `CORS_ALLOWED_ORIGINS is required in production`, or another variable name | Missing setting | Add it in Render → Environment; redeploy |
| Portal: "We couldn't reach BookLeaf." and a CORS error in the browser console | The portal's origin isn't listed exactly | Fix `CORS_ALLOWED_ORIGINS` (step 4) |
| Browser console: "violates the following Content Security Policy directive: connect-src" | `NEXT_PUBLIC_*` values missing or wrong at build time | Fix them in Vercel, then **Redeploy** |
| Sign-in fails for every account | Frontend points at another Supabase project, or wrong password | Check `NEXT_PUBLIC_SUPABASE_URL` matches the API's `SUPABASE_URL` |
| Everyone gets 429 at once | `TRUST_PROXY_HOPS` too low | Step 5 |
| First request takes about a minute | Render free instance was asleep | Expected; the portals show the wake-up hint |
| Queue shows tickets as "Manual" | AI off, budget used up or provider quota hit | Check `/api/v1/admin/ai/usage` and the Render log; manual replies keep working |

Rollback: [.agent/ROLLBACK.md](../.agent/ROLLBACK.md) (Vercel: promote the previous deployment; Render: redeploy the previous deploy; AI misbehaving: `AI_PRIMARY_PROVIDER=none`).

## Known hosting limitations

- Render free services spin down after 15 minutes idle and may take about a minute to wake. The frontends show a delayed server-wakeup hint; warm-server latency does not apply to cold starts.
- Run one backend instance: the SSE hub, request limits, queue deduplication and provider pacing are per process (A-15). Scaling needs shared coordination first.
- Eight-second pacing covers provider calls, repairs and retries; triage jobs also start at least eight seconds apart. Waiting consumes the request timeout. This reduces bursts but does not guarantee token/minute or daily provider quotas; budget, breaker, bounded fallback and manual mode remain necessary.
- Production estimates remain awaiting confirmation, as accepted by the user. A development-only braces advisory has no listed patch; review limitations are recorded in [release verification](../.agent/verification/2026-10-22-release-preparation.md).

Official references checked during preparation: [Render Blueprint specification](https://render.com/docs/blueprint-spec), [Render free services](https://render.com/docs/free), [Vercel monorepos](https://vercel.com/docs/monorepos). These explain configuration; they do not establish that BookLeaf is deployed.
