# AGENTS.md

Entry point for Codex and other coding agents. Claude Code uses [CLAUDE.md](CLAUDE.md); both follow the same workflow and documents. This file adds no separate policy.

## Start every session with

1. [AI_WORKFLOW.md](AI_WORKFLOW.md): the session procedure.
2. [PROJECT_STATE.md](PROJECT_STATE.md), [TASKS.md](TASKS.md), [.agent/HANDOVER.md](.agent/HANDOVER.md).
3. [.agent/CONSTRAINTS.md](.agent/CONSTRAINTS.md).
4. [GIT_WORKFLOW.md](GIT_WORKFLOW.md).

Navigation: [DOCUMENTATION_MAP.md](DOCUMENTATION_MAP.md).

## Coordination with Claude Code

- Check `git status` and [.agent/HANDOVER.md](.agent/HANDOVER.md) for work in progress before touching files.
- Do not edit the same tracker (`TASKS.md`, `PROJECT_STATE.md`), API contract (`openapi.yaml`) or architecture document at the same time as another agent. Agree ownership in the handover first.
- End each session by rewriting [.agent/HANDOVER.md](.agent/HANDOVER.md).
