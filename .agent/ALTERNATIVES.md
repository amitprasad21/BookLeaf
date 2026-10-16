# Alternatives Considered

**Owns:** options that were evaluated and not chosen, and when they would win. Decisions themselves are in [DECISIONS.md](DECISIONS.md).

| Topic (decision) | Alternative | Why not now | Would win when |
|---|---|---|---|
| Frontend topology (D-001) | One Next.js app with `/author` and `/admin` route groups | Admin code would ship in the same bundle as author code; the blueprint's default is two experiences | Deadline pressure outweighs separation; collapsing later is mechanical |
| Backend framework (D-003) | Fastify | Faster, schema-first, but its plugin encapsulation is more to explain for little gain at this scale | High throughput matters |
| Backend framework (D-003) | NestJS | Heavy decorators/DI for a small API; slower to scaffold | Large team, many modules |
| Backend framework (D-003) | Next.js route handlers as the API | Would couple the API to one frontend; the blueprint requires one shared backend | Single-app deployment |
| DB access (D-005) | Secret key everywhere + backend checks only | One missed check leaks data; RLS would be decorative | Never for this project |
| DB access (D-005) | Prisma/Drizzle over a direct Postgres connection | Bypasses RLS unless JWT claims are set per transaction; adds migration tooling | Complex queries/reporting, with explicit auth layer |
| Real-time (D-006) | WebSockets (socket.io) | Bidirectional channel not needed; more infrastructure | Chat-style interaction |
| Real-time (D-006) | Supabase Realtime from browsers | Frontends would talk to the DB directly, splitting the authorization story | Scaling out without our own pub/sub |
| Real-time (D-006) | Polling only | Simpler, but feels sluggish; SSE gives instant updates and polling remains the fallback | Hosting kills long-lived connections |
| Real-time scale-out | Postgres `LISTEN/NOTIFY` or Redis pub/sub for the event hub | Single instance in the demo | Multiple backend instances |
| AI execution (D-007) | Synchronous triage inside `POST /tickets` | Adds provider latency to the author's submit; failures complicate the response | Never preferred; would still need to save first |
| AI execution (D-007) | Durable queue (pg-boss, Supabase Queues) | Extra moving part for a 4-day build | Production volume (task X-4) |
| AI calls (D-008) | Separate classification and priority calls | 2× calls/tokens | Different models per task prove better on the eval |
| KB context (D-009) | Send the whole KB every time | ~2–3× input tokens per draft; dilutes relevance | KB is tiny and caching makes it free |
| KB context (D-009) | Embeddings + vector search (pgvector) | KB is ~2k tokens and maps 1:1 to categories; retrieval adds infra and nondeterminism | KB grows to many documents |
| Drafting trigger | Generate the draft at ticket creation | Pays for drafts on tickets that get closed or replied to manually; stale after overrides | Admins demand zero wait on open |
| Model (D-010) | Claude Sonnet 5.5 / Opus 5.5 for everything | 20–40× cost for classification that a small model handles | Eval shows drafts need heavy edits |
| Model (D-010) | OpenAI gpt-4o-mini as primary | Viable; one SDK either way. Haiku 5.5 chosen for structured outputs + caching + cost; OpenAI-compatible kept as optional fallback | User prefers OpenAI |
| Determinism | `temperature: 0` | Rejected by current Claude models (non-default sampling params return 400); consistency comes from schemas, rubrics and evals | Using a model that supports it |
| IDs | Sequential ticket IDs in URLs | Enumerable | Never; UUID in URLs, human `reference` (BL-1001) for display |
| Session storage | Cookie-based Supabase sessions (`@supabase/ssr`, httpOnly where possible) | supabase-js default `localStorage` is simpler with a separate bearer-token API; XSS mitigated by React escaping + CSP | Production hardening |
| Auth | Backend-proxied login endpoint | Re-implements what Supabase Auth provides; handling passwords on our server adds risk | Need for custom auth flows |
| Attachments (D-015) | Real upload in MVP | Bonus only; storage security work (private bucket, signed URLs, scanning) competes with core flow | Time remains after M2 |
| Hosting (D-017) | Railway / Fly.io for backend | Comparable; Render chosen for simple free web service | Render limits bite |
