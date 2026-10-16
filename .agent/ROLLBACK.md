# Rollback

**Owns:** how to undo risky changes to code, deployments and data. Destructive steps need explicit approval ([GIT_WORKFLOW.md](../GIT_WORKFLOW.md) section 6).

## Code

| Situation | Action |
|---|---|
| Bad change not yet committed | Inspect the diff; revert only the specific files with the user's approval. Never blanket-reset someone else's work |
| Bad commit on a feature branch | `git revert <hash>` (preferred) or fix forward |
| Bad commit merged to `main` | `git revert <merge-or-commit>` in a `fix/` branch; never force-push shared history |

## Deployments

| Piece | Rollback |
|---|---|
| Frontends (Vercel) | Promote the previous production deployment in the Vercel dashboard (instant) |
| Backend (Render) | Redeploy the previous successful deploy from the Render dashboard, or revert the commit and push |
| Environment variable mistake | Restore the previous value in the host settings; redeploy. If a secret was exposed, rotate it ([CREDENTIALS_GUIDE.md](CREDENTIALS_GUIDE.md)) |
| AI misbehaving in production | Set `AI_PRIMARY_PROVIDER=none` (manual mode) and redeploy/restart. No code change needed |

## Database

- Migrations are forward-only SQL files in `supabase/migrations/`. Each risky migration ships with a written **down** script in its PR description, reviewed before applying.
- Before applying a migration to the hosted database: take a backup/export (Supabase dashboard or `pg_dump`) and note the timestamp.
- Seed script is **idempotent** (upserts keyed by `author_id` / `book_id` / email). Re-running restores dataset values without duplicating rows.
- Demo data reset (with approval only): delete tickets/messages/notes/drafts/events, then re-run the seed. Never deletes authors/books outside the seed's upsert.

## Decision triggers

Roll back immediately (instead of fixing forward) when: authorization is weakened, data leaks across authors, secrets are exposed, or ticket creation fails.
