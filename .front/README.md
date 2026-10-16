# .front/: Frontend Specifications

Specifications for the two frontend experiences. They are separate apps (`author-frontend/`, `admin-frontend/`) that share `packages/ui` and `packages/shared` (decision D-001).

| Shared topic | File |
|---|---|
| Visual tokens: the only visual source of truth | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) |
| App structure, data fetching, session, real-time client | [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) |
| Shared components and their states | [COMPONENTS.md](COMPONENTS.md) |
| Accessibility rules and viewport matrix | [ACCESSIBILITY_RESPONSIVENESS.md](ACCESSIBILITY_RESPONSIVENESS.md) |

| Experience | Screens | Flows | States | Tests |
|---|---|---|---|---|
| Author | [author/SCREENS.md](author/SCREENS.md) | [author/FLOWS.md](author/FLOWS.md) | [author/STATES.md](author/STATES.md) | [author/TEST_PLAN.md](author/TEST_PLAN.md) |
| Admin | [admin/SCREENS.md](admin/SCREENS.md) | [admin/FLOWS.md](admin/FLOWS.md) | [admin/STATES.md](admin/STATES.md) | [admin/TEST_PLAN.md](admin/TEST_PLAN.md) |

API usage follows [INTEGRATION_CONTRACT.md](../INTEGRATION_CONTRACT.md); schemas come from [openapi.yaml](../openapi.yaml) via `packages/shared`.
