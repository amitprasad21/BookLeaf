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
