# Test Checklist (Definition of Done)

**Owns:** the checks a change must pass before it is called done. Area-specific cases live in [.back/TEST_PLAN.md](../.back/TEST_PLAN.md), [.front/admin/TEST_PLAN.md](../.front/admin/TEST_PLAN.md) and [.front/author/TEST_PLAN.md](../.front/author/TEST_PLAN.md).

**Commands below are planned and do not exist until SETUP-3.** Record actual outputs in [verification/](verification/README.md).

## Every change

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (unit + integration)
- [ ] `npm run build` passes for affected workspaces
- [ ] Full diff reviewed: no secrets, no `.env`, no unrelated files, no weakened checks, no deleted/skipped tests
- [ ] Docs updated (contract, specs, TASKS, HANDOVER)

## Changes touching auth, data access or API

- [ ] Route inventory test: every non-public route requires auth
- [ ] Cross-author tests: author A cannot read/write author B's books, tickets, messages (expect 404)
- [ ] Author cannot call `/admin/*` (expect 403)
- [ ] Author responses contain no internal fields (snapshot of DTO keys)
- [ ] RLS tests (author A, author B, admin) still pass
- [ ] Error responses use the envelope with `requestId`; no stack traces

## Changes touching AI

- [ ] Mock-provider tests: success, timeout, 429, 401, 500, invalid JSON, invalid enum, refusal, budget exhausted, circuit open
- [ ] Ticket creation succeeds with `AI_PRIMARY_PROVIDER=none`
- [ ] Golden-set eval run (mock in CI; live only with approval) and results recorded
- [ ] No ticket content in logs

## Changes touching UI

- [ ] Loading, empty, error and success states render
- [ ] Keyboard-only path works; focus visible
- [ ] Checked at 360×800 and 1440×900 at minimum; full matrix before release ([.front/ACCESSIBILITY_RESPONSIVENESS.md](../.front/ACCESSIBILITY_RESPONSIVENESS.md))
- [ ] Missing data shown as "Not yet set" etc., never as zero

## Before deploy / demo

- [ ] [SECURITY_REVIEW_CHECKLIST.md](SECURITY_REVIEW_CHECKLIST.md) required items reviewed with evidence
- [ ] `npm audit` reviewed
- [ ] Frontend build output grepped for key patterns (`sk-`, `sb_secret_`, `service_role`, `ANTHROPIC`)
- [ ] Seed verification passes on the target database
- [ ] Live smoke: author submits → admin triages/replies → author sees reply live; repeat with AI disabled
