# Handover

**Session:** 2026-10-16 (Claude Code)
**Branch:** `feature/api-skeleton` (branched from `main` at `6898131`; two API-1 commits; not merged, not pushed)

## Done

- Phase 0, SETUP-2 (scaffold) and SETUP-3 (tooling) are merged to `main` (`6898131`) with the user's approval.
- API-1, backend skeleton ([verification/2026-10-16-api1.md](verification/2026-10-16-api1.md)):
  - `packages/shared/src/errors.ts`: `ERROR_CODES`, `AI_UNAVAILABLE_REASONS` and `ErrorBody` types (contract shared with the frontends).
  - `backend/src/config/env.ts`: adds `LOG_LEVEL` (silent in tests) and `CORS_ALLOWED_ORIGINS` (exact origins; required in production; dev default is localhost:3000/3001).
  - `lib/errors.ts`: typed `AppError` family (400/401/403/404/409/422/429/503).
  - `lib/logger.ts`: pino with credential redaction.
  - `middleware/`:
    - `request-id` (accepts safe incoming ids)
    - `http-logger` (id, method, URL, status only; health skipped)
    - `cors` (allowlist, no wildcard)
    - `not-found` and `error-handler` (envelope; zod → 400 details; bad JSON 400; >32 KB 413; unknown errors → generic 500, logged with request id)
  - `modules/health/router.ts`, `openapi/docs.ts` (raw spec at `/api/openapi.yaml`, Swagger UI at `/api/docs`, read from the repo-root `openapi.yaml`).
  - `server.ts`: exits cleanly on bad env (names the variable only) and shuts down gracefully on SIGINT/SIGTERM. `dev`/`start` load `backend/.env` if present (`--env-file-if-exists`).
  - Tests: 7 files, 28 tests. Redaction tests were mutation-checked (they fail when redaction is removed).
- Security finding found and fixed during smoke testing: request logs included all headers, IP and user agent. Now logged minimally (recorded in SECURITY_REVIEW_CHECKLIST).

## In progress

- Nothing half-done. API-1 is committed on `feature/api-skeleton`. Merging into `main` needs approval.

## Broken / risky

- **npm 10.2.5 on PATH** crashes on this workspace. Use Node's bundled npm 11.6.2 (`"C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`) or upgrade the global npm (user's call).
- `.claude/launch.json` (git-ignored) now also has a `backend-dev` config.
- `VersionConflictError` doesn't yet carry the current ticket representation the contract mentions. Add it in API-6.
- Still open: four missing sources (S-07..S-10); D-010 model choice is still a proposal; ESLint 9 is unsupported upstream (D-019).

## Next

1. Merge `feature/api-skeleton` into `main` (fast-forward) after approval.
2. **DB-1: first credential stop.** A Supabase project is needed before API-2 (auth) and DB-2..4. Guide the user step by step from the official docs; never take keys in chat.
3. Without credentials meanwhile: FE-1 (`packages/ui` primitives from `.front/COMPONENTS.md`).

## Do not touch

- `supabase/seed/bookleaf_sample_data.json` (byte-identical to the provided file).
- `docs/blueprint/` (source material).

## Commits (approved by the user 2026-10-16)

On `feature/api-skeleton` (hashes: `git log --oneline main..`):

1. `feat(api): add backend skeleton with request ids, logging, CORS, error envelope and API docs`
2. `docs: record API-1 skeleton, error codes and verification`
