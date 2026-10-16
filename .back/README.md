# .back/: Backend Specifications

Specifications for the single backend (`backend/`, Express + TypeScript) and its Supabase database. Planned, not yet implemented.

| Topic | File |
|---|---|
| Tables, enums, constraints, indexes, triggers | [DATA_MODEL.md](DATA_MODEL.md) |
| Code layering, middleware order, conventions | [API_IMPLEMENTATION.md](API_IMPLEMENTATION.md) |
| Authentication, authorization, secrets boundary, system writer | [AUTH_SECURITY.md](AUTH_SECURITY.md) |
| Row Level Security access matrix and policy tests | [SUPABASE_RLS.md](SUPABASE_RLS.md) |
| Ticket status machine and side effects | [TICKET_LIFECYCLE.md](TICKET_LIFECYCLE.md) |
| AI provider interface, routing, budget, circuit breaker, queue | [AI_PROVIDER_ORCHESTRATION.md](AI_PROVIDER_ORCHESTRATION.md) |
| AI failure matrix and recovery | [AI_FAILURE_HANDLING.md](AI_FAILURE_HANDLING.md) |
| Seed rules and dataset edge cases | [SEED_DATA.md](SEED_DATA.md) |
| Backend test strategy | [TEST_PLAN.md](TEST_PLAN.md) |
| Environments and deploy steps | [DEPLOYMENT.md](DEPLOYMENT.md) |

The API contract is [openapi.yaml](../openapi.yaml) (conventions in [INTEGRATION_CONTRACT.md](../INTEGRATION_CONTRACT.md)). Runtime AI behaviour is [AI_SPEC.md](../AI_SPEC.md).
