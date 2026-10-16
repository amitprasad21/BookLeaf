# Git Workflow

**Scope:** This is the single canonical Git policy for the BookLeaf project. All other documents and agent instructions must link here instead of maintaining a duplicate Git workflow.

## 1. Branching

- `main` is the stable, reviewed branch.
- `feature/<short-name>` is for new functionality.
- `fix/<short-name>` is for bug fixes.
- `docs/<short-name>` is for documentation changes.

Use short-lived branches based on current `main`. This assessment does not need a `develop` or release branch unless the existing team workflow explicitly requires one.

## 2. Commit messages

Use focused Conventional Commit-style messages:

- `docs: update AI governance blueprint`
- `feat(author): add ticket submission`
- `feat(admin): add priority filters`
- `feat(ai): add bounded provider fallback`
- `fix(api): enforce ticket ownership checks`
- `test(security): cover cross-author access`
- `chore: update safe environment example`

One commit should represent one coherent logical change. Avoid vague messages such as `update`, `final code`, `misc`, `changes` or `work done`.

## 3. Before editing

1. Check the current branch, `git status`, recent commits and existing diff.
2. Inspect the relevant task, acceptance criteria and constraints.
3. Confirm another agent has not already changed the target files.
4. Work on a focused branch when the existing repository and task call for one.

Never overwrite another agent's uncommitted work or silently reset the repository.

## 4. Before committing

1. Run the relevant tests, type checks, linting, build and security checks available for the change.
2. Inspect the full diff, including deletions and changed configuration.
3. Check for secrets, `.env` files, private URLs, unreviewed dependencies, weakened authorization, skipped/deleted tests and unrelated files.
4. Update related specifications, tasks, decisions and handover.
5. Prepare a commit message that truthfully describes the changes.
6. Ask for approval before committing unless the user explicitly authorised committing as part of the task.

Documentation-only edits still require a diff review and validation of links/diagrams/rendering where applicable.

## 5. Claude Code and Codex coordination

Both agents follow this file. Before either agent changes files, inspect current Git state and active work. Assign ownership for shared files and avoid simultaneous edits to the same tracker, API contract or architecture document. Use a small handover note when switching agents.

Agents may prepare a commit proposal, but do not commit solely because a task is complete. Report the actual branch, commit hash and executed checks only when they really exist.

## 6. Operations that require explicit approval

Do not automatically:

- Push commits or open a remote PR.
- Merge a branch.
- Force-push or rewrite shared history.
- Amend/rebase commits that might already be shared.
- Delete branches or reset/discard uncommitted changes.
- Deploy or run production database migrations.

Explain the impact and obtain explicit approval before these actions.

## 7. Secret protection

- Commit `.env.example` with placeholder values only.
- Ignore `.env`, `.env.local`, production environment files and credentials.
- Keep LLM keys and Supabase privileged keys server-side.
- Never place credentials in Markdown, screenshots, prompts, logs, commit messages or agent handovers.
- If a secret is exposed, treat it as compromised: stop using it, revoke/rotate it and use an approved recovery process.

## 8. Definition of done

A commit-ready change has met its acceptance criteria, has real verification results recorded, has had its diff reviewed, includes no unrelated/sensitive files, and has updated the relevant documentation and task state. A proposed commit message is not a commit, and an AI assertion is not test evidence.
