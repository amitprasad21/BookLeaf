# Constraints (Non-Negotiable)

Breaking any of these needs explicit user approval **and** a recorded decision in [DECISIONS.md](DECISIONS.md).

## Architecture

- C-01 Exactly **one backend**. Two frontend experiences (author, admin) call it. Frontends never query application tables directly; they use Supabase only for sign-in.
- C-02 The seed dataset is loaded **exactly**: 10 authors, 18 books, nulls preserved, no extra or altered records presented as part of it.
- C-03 The canonical API contract is [openapi.yaml](../openapi.yaml). Change the contract before the code.

## Security

- C-04 Identity, role and ownership come only from the verified token and the database, never from request input.
- C-05 Every protected route has auth + role guard. Every object access by ID checks ownership. Not-owned resources return 404.
- C-06 RLS stays enabled on every application table. The secret (RLS-bypassing) key is used only in the system writer module and the seed script.
- C-07 No secret, LLM key or privileged key in frontend code, `NEXT_PUBLIC_*` variables, logs, docs, prompts, screenshots or commits.
- C-08 Author-facing responses are built by the author serializer. Internal notes, AI fields, priority, assignee and drafts never reach an author endpoint.
- C-09 Production returns no stack traces and no provider error bodies to clients.

## AI

- C-10 Tickets are saved before any AI call. AI failure must not fail ticket creation or block manual replies.
- C-11 AI never sends a reply, changes status, assigns, or touches royalty data. Sending requires an explicit admin action.
- C-12 Model output is validated against the schema before persistence and is never executed or interpolated into SQL.
- C-13 Context sent to an LLM contains only the ticket author's own data needed for the task; no emails, phone numbers, other authors or internal notes.
- C-14 No key rotation or provider switching to evade rate limits, quotas or billing limits. A fallback provider is used only if explicitly configured and budget-capped.
- C-15 Live LLM calls that spend money (eval runs, load tests) need user approval first.

## Process

- C-16 No installs, hosted-database migrations, commits, pushes, merges or deploys without approval ([GIT_WORKFLOW.md](../GIT_WORKFLOW.md)).
- C-17 Never ask the user to paste a secret into chat ([CREDENTIALS_GUIDE.md](CREDENTIALS_GUIDE.md)).
- C-18 Never report a check as passed unless it ran. Record evidence in [verification/](verification/README.md).

## Protected areas (extra review before changing)

| Area | Why |
|---|---|
| `backend/src/middleware/auth*`, role guards | Authorization boundary |
| `backend/src/db/system-writer*` | Bypasses RLS |
| `supabase/migrations/*rls*` | Data isolation |
| `backend/src/ai/prompts/`, `knowledge-base/` | Changes AI behaviour; run the eval set |
| `supabase/seed/bookleaf_sample_data.json` | Must stay byte-identical to the provided file |
