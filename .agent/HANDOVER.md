# Handover

**Session:** 2026-10-16 (Claude Code)
**Branch:** `docs/initial-setup` (three commits; `main` has no commits until this branch is merged, which needs approval)

## Done

- Read the assignment PDF, sample JSON and blueprint bundle v2 in full; verified the dataset's internal totals.
- Initialised the Git repository; added `.gitignore`, `.gitattributes`, `.env.example`, root `GIT_WORKFLOW.md`.
- Copied the dataset byte-for-byte to `supabase/seed/bookleaf_sample_data.json` and the blueprint bundle to `docs/blueprint/`.
- Created the full documentation tree from the blueprint (root, `.agent/`, `.front/`, `.back/`) with planning-stage content.
- Drafted the API contract ([openapi.yaml](../openapi.yaml)) and runtime AI design ([AI_SPEC.md](../AI_SPEC.md)).

## In progress

- Nothing half-done in code (no code exists).

## Broken / risky

- Four blueprint-cited sources were not provided (S-07..S-10 in [SOURCE_REGISTER.md](../SOURCE_REGISTER.md)). Design tokens are provisional.
- Model choice (D-010) is a proposal, not a decision.

## Next

1. Get approval for the SETUP-2 package list ([TASKS.md](../TASKS.md)), then scaffold the workspace.
2. SETUP-3 tooling, then API-1 skeleton (no credentials needed).
3. DB-1: guided Supabase setup when it is reached (just in time).

## Do not touch

- `supabase/seed/bookleaf_sample_data.json`: must stay identical to the provided file.
- `docs/blueprint/`: source material; edit only to replace with a newer bundle.

## Commits (approved by the user 2026-10-16)

On branch `docs/initial-setup` (hashes: `git log --oneline`):

1. `chore: initialise repository with git config and env example`
2. `docs: add BookLeaf blueprint sources and seed dataset`
3. `docs: add project documentation tree per blueprint v2`

Not pushed. No remote exists yet.
