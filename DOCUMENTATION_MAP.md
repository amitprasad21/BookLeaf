# Documentation Map

**Owns:** where each document lives, what it owns and the order to read them. Rule: **one source of truth per concern.** Link to the owner instead of copying its content.

## Read order

| You are… | Read, in order |
|---|---|
| New to the project | [README.md](README.md) → [PRODUCT.md](PRODUCT.md) → [PRD.md](PRD.md) → [ARCHITECTURE.md](ARCHITECTURE.md) → [PROJECT_STATE.md](PROJECT_STATE.md) |
| A coding agent starting a session | [CLAUDE.md](CLAUDE.md) or [AGENTS.md](AGENTS.md) → [AI_WORKFLOW.md](AI_WORKFLOW.md) → [PROJECT_STATE.md](PROJECT_STATE.md) → [TASKS.md](TASKS.md) → [.agent/HANDOVER.md](.agent/HANDOVER.md) → [.agent/CONSTRAINTS.md](.agent/CONSTRAINTS.md) → [GIT_WORKFLOW.md](GIT_WORKFLOW.md) |
| Working on backend/API | [INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md) → [openapi.yaml](openapi.yaml) → [.back/README.md](.back/README.md) and the `.back/` file for the area |
| Working on AI features | [AI_SPEC.md](AI_SPEC.md) → [.back/AI_PROVIDER_ORCHESTRATION.md](.back/AI_PROVIDER_ORCHESTRATION.md) → [.back/AI_FAILURE_HANDLING.md](.back/AI_FAILURE_HANDLING.md) |
| Working on a frontend | [DESIGN.md](DESIGN.md) → [.front/README.md](.front/README.md) → `.front/admin/` or `.front/author/` |
| Reviewing security | [.agent/THREAT_MODEL.md](.agent/THREAT_MODEL.md) → [.agent/SECURITY_REVIEW_CHECKLIST.md](.agent/SECURITY_REVIEW_CHECKLIST.md) → [.back/AUTH_SECURITY.md](.back/AUTH_SECURITY.md) → [.back/SUPABASE_RLS.md](.back/SUPABASE_RLS.md) |
| Preparing the demo discussion | [.agent/DEFENSE.md](.agent/DEFENSE.md) → [.agent/DECISIONS.md](.agent/DECISIONS.md) |

## Ownership register

### Root

| Document | Owns |
|---|---|
| [README.md](README.md) | Entry point, setup, credentials for the demo, deliverables status |
| [PRODUCT.md](PRODUCT.md) | Problem, users, outcomes, scope, non-goals |
| [PRD.md](PRD.md) | Requirements, acceptance criteria, evaluation mapping |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System map, components, trust boundaries, topology |
| [DESIGN.md](DESIGN.md) | Pointer to the design system |
| [INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md) | API conventions, errors, events, endpoint index |
| [openapi.yaml](openapi.yaml) | API schemas (authoritative) |
| [AI_SPEC.md](AI_SPEC.md) | Runtime AI behaviour |
| [AI_WORKFLOW.md](AI_WORKFLOW.md) | Coding-agent session procedure |
| [GIT_WORKFLOW.md](GIT_WORKFLOW.md) | All Git rules (the only Git policy) |
| [PROJECT_STATE.md](PROJECT_STATE.md) | Milestone, verified facts, blockers, open questions |
| [TASKS.md](TASKS.md) | Work items and status |
| [SOURCE_REGISTER.md](SOURCE_REGISTER.md) | Sources, precedence, gaps, conflicts |
| [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md) | Agent entry points (pointers only) |
| [.env.example](.env.example) | Environment variable names and placeholders |

### `.agent/`: governance and reasoning

| Document | Owns |
|---|---|
| [.agent/README.md](.agent/README.md) | Folder guide |
| [.agent/CONSTRAINTS.md](.agent/CONSTRAINTS.md) | Non-negotiable rules, protected areas |
| [.agent/HANDOVER.md](.agent/HANDOVER.md) | Latest session handover |
| [.agent/DECISIONS.md](.agent/DECISIONS.md) | Material decisions (D-xxx) |
| [.agent/ALTERNATIVES.md](.agent/ALTERNATIVES.md) | Options considered and why not chosen |
| [.agent/FLOW.md](.agent/FLOW.md) | Real call paths across UI, API, DB, AI |
| [.agent/DATA.md](.agent/DATA.md) | Data reasoning: sensitivity, ownership, access patterns |
| [.agent/THREAT_MODEL.md](.agent/THREAT_MODEL.md) | Actors, abuse cases, mitigations, residual risk |
| [.agent/FAILURE.md](.agent/FAILURE.md) | System-wide failure modes and recovery |
| [.agent/TEST_CHECKLIST.md](.agent/TEST_CHECKLIST.md) | Definition-of-done checks and commands |
| [.agent/ROLLBACK.md](.agent/ROLLBACK.md) | Recovery for code, deploy and data changes |
| [.agent/ASSUMPTIONS.md](.agent/ASSUMPTIONS.md) | Assumptions (A-xx) awaiting confirmation |
| [.agent/DEFENSE.md](.agent/DEFENSE.md) | Prepared answers for the technical discussion |
| [.agent/CREDENTIALS_GUIDE.md](.agent/CREDENTIALS_GUIDE.md) | Just-in-time credential steps (names, never values) |
| [.agent/SECURITY_REVIEW_CHECKLIST.md](.agent/SECURITY_REVIEW_CHECKLIST.md) | 18-control baseline + review findings |
| [.agent/skills-and-tools.md](.agent/skills-and-tools.md) | Tools actually available and their install state |
| [.agent/templates/](.agent/templates/) | Feature and bug templates |
| [.agent/verification/](.agent/verification/) | Evidence of checks actually run |

### `.front/`: frontend specifications

| Document | Owns |
|---|---|
| [.front/README.md](.front/README.md) | Folder guide |
| [.front/DESIGN_SYSTEM.md](.front/DESIGN_SYSTEM.md) | Tokens, type, spacing, iconography (only visual source of truth) |
| [.front/FRONTEND_ARCHITECTURE.md](.front/FRONTEND_ARCHITECTURE.md) | App structure, data fetching, auth/session, real-time client |
| [.front/COMPONENTS.md](.front/COMPONENTS.md) | Shared components and their states |
| [.front/ACCESSIBILITY_RESPONSIVENESS.md](.front/ACCESSIBILITY_RESPONSIVENESS.md) | Accessibility rules, viewport check matrix |
| `.front/admin/*` | Admin screens, flows, states, test plan |
| `.front/author/*` | Author screens, flows, states, test plan |

### `.back/`: backend specifications

| Document | Owns |
|---|---|
| [.back/README.md](.back/README.md) | Folder guide |
| [.back/DATA_MODEL.md](.back/DATA_MODEL.md) | Tables, enums, constraints, indexes |
| [.back/API_IMPLEMENTATION.md](.back/API_IMPLEMENTATION.md) | Backend layering, middleware order, conventions |
| [.back/AUTH_SECURITY.md](.back/AUTH_SECURITY.md) | Authentication, authorization, secrets boundary, system writer |
| [.back/SUPABASE_RLS.md](.back/SUPABASE_RLS.md) | RLS access matrix and policy tests |
| [.back/TICKET_LIFECYCLE.md](.back/TICKET_LIFECYCLE.md) | Status machine, side effects, first-response targets |
| [.back/AI_PROVIDER_ORCHESTRATION.md](.back/AI_PROVIDER_ORCHESTRATION.md) | Provider interface, router, budget, circuit breaker |
| [.back/AI_FAILURE_HANDLING.md](.back/AI_FAILURE_HANDLING.md) | AI failure matrix and recovery |
| [.back/SEED_DATA.md](.back/SEED_DATA.md) | Seeding rules and dataset edge cases |
| [.back/TEST_PLAN.md](.back/TEST_PLAN.md) | Backend test strategy and cases |
| [.back/DEPLOYMENT.md](.back/DEPLOYMENT.md) | Environments, deploy steps, env matrix |

### Reference

| Location | Content |
|---|---|
| [docs/blueprint/](docs/blueprint/) | Blueprint bundle v2 (planning source, diagrams, generation prompt) |
| [supabase/seed/](supabase/seed/) | Exact assessment dataset |
