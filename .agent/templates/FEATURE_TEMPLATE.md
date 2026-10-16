# Feature: <name>

- **Task ID:** <from TASKS.md>
- **Requirement IDs:** <from PRD.md>
- **Branch:** `feature/<short-name>`

## Goal
<One or two sentences: what the user can do afterwards.>

## Acceptance criteria
- [ ] <observable behaviour>
- [ ] <edge case: empty / error / permission denied>

## Design
- **Contract changes:** <openapi.yaml paths/schemas, or "none">
- **Data changes:** <tables/columns/policies, or "none">
- **Files to touch:** <list>
- **Alternatives considered:** <brief>

## Risks
| Risk | Check |
|---|---|
| Authorization / ownership | <test> |
| Secrets / env | <check> |
| AI cost or failure path | <test> |

## Credentials needed
<"none", or the specific variable and why, per .agent/CREDENTIALS_GUIDE.md>

## Verification (filled in after running)
| Check | Command | Result |
|---|---|---|
| Typecheck | | |
| Tests | | |
| Manual path | | |

## Docs to update
- [ ] TASKS.md status + evidence
- [ ] .agent/FLOW.md (if call path changed)
- [ ] .agent/DECISIONS.md (if a material choice was made)
- [ ] .agent/HANDOVER.md
