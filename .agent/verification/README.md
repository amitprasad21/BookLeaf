# Verification Log

Evidence of checks that **actually ran**. One file per session or milestone: `YYYY-MM-DD-<topic>.md`.

Each entry records:

- What was checked and why.
- The exact command (or manual procedure).
- A summarised real result (pass/fail, counts). Never secrets, tokens or personal data.
- Anything **not** run, stated explicitly.

| File | Scope |
|---|---|
| [2026-10-16-phase0.md](2026-10-16-phase0.md) | Source inspection, seed data integrity, documentation tree and link checks |
| [2026-10-16-setup2.md](2026-10-16-setup2.md) | Workspace scaffold: install, build, typecheck, tests, live smoke |
| [2026-10-16-setup3.md](2026-10-16-setup3.md) | Tooling: ESLint, Prettier, OpenAPI lint, full `check`, fresh-clone install |
| [2026-10-16-api1.md](2026-10-16-api1.md) | Backend skeleton: 28 tests, mutation checks, live smoke incl. Swagger UI |
| [2026-10-17-db1.md](2026-10-17-db1.md) | Supabase project + credentials: safe `check:env`, sign-ups disabled |
| [2026-10-17-db2.md](2026-10-17-db2.md) | Initial schema: contract test, applied via SQL Editor, `check:db` OK |
| [2026-10-18-db3-db4.md](2026-10-18-db3-db4.md) | Access rules + seed: seed OK, wrong-project apply caught, 15/15 live RLS tests |
| [2026-10-18-api2.md](2026-10-18-api2.md) | Auth middleware, role guards, `/me`: 69 offline + 21 live tests, live server smoke |
| [2026-10-18-api3.md](2026-10-18-api3.md) | `/author/books` + royalty summary + payout calendar: 88 offline + 27 live tests |
| [2026-10-18-api4.md](2026-10-18-api4.md) | Author tickets (create, list, detail), rate limit, audit: 106 offline + 32 live tests, server smoke |
| [2026-10-18-api5.md](2026-10-18-api5.md) | Admin queue + summary, urgency-rank migration, SLA rules: 138 offline + 39 live tests, server smoke, log redaction fix |
| [2026-10-18-api6.md](2026-10-18-api6.md) | Admin ticket detail + PATCH (transitions, overrides, self-assign, optimistic lock, audit): 159 offline + 46 live tests, two-admin race, server smoke |
| [2026-10-18-api7.md](2026-10-18-api7.md) | Admin replies (atomic reply function) + internal notes: 181 offline + 53 live tests, full support-loop smoke |
| [2026-10-19-ai1-ai2.md](2026-10-19-ai1-ai2.md) | AI providers (Gemini + Groq fallback), router, breaker, budget, usage: 236 offline tests, one live call per model |
| [2026-10-19-ai3.md](2026-10-19-ai3.md) | AI triage: queue, sweeper, floors, manual re-run; 267 offline + 57 live tests, smoke on Gemini incl. an injection attempt |
