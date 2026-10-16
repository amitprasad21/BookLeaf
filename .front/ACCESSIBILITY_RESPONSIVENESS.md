# Accessibility and Responsiveness

**Owns:** accessibility rules and the viewport verification matrix for both portals. Target: WCAG 2.2 AA where practical.

## Rules

1. Every action is keyboard-operable in a logical order. No keyboard traps except intentional dialog focus traps.
2. Visible focus on every focusable element ([DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) §5).
3. Every control has an accessible name. Icon-only buttons have `aria-label`.
4. Status, priority, SLA and source are conveyed by text (and icon), never by shade alone.
5. Errors are announced (`role="alert"`), linked to fields, and say how to fix them.
6. Live updates are announced politely ("New reply from BookLeaf Support") without stealing focus.
7. Text resizes to 200% without loss of content or function; no horizontal page scroll at 320 px except data tables, which scroll within their own container.
8. Touch targets ≥ 44 × 44 px.
9. Respect `prefers-reduced-motion`.
10. Page titles are unique per screen ("My Tickets · BookLeaf Author Portal").

## Responsive behaviour

| Screen | < 768 px | ≥ 1024 px |
|---|---|---|
| Author My Books | Card per book with key figures | Table + summary row |
| Author My Tickets | Card list | Table |
| Author Ticket detail | Single column | Single column (max 800 px) |
| Admin Queue | Card list with priority/status/age; filters in a disclosure panel | Full table with filter bar |
| Admin Ticket detail | Tabs: Conversation · Triage · Context · Notes | Two columns: conversation + reply (left), triage/assignment/context/notes/timeline (right) |

## Verification matrix

Status stays **not run** until actually checked (QA-1). Record evidence in [.agent/verification/](../.agent/verification/README.md).

| Viewport | Author portal | Admin portal |
|---|---|---|
| 320 × 568 | not run | not run |
| 360 × 800 | not run | not run |
| 390 × 844 | not run | not run |
| 430 × 932 | not run | not run |
| 768 × 1024 | not run | not run |
| 1024 × 768 | not run | not run |
| 1280 × 800 | not run | not run |
| 1440 × 900 | not run | not run |
| 1920 × 1080 | not run | not run |
| 200% zoom (1280 × 800) | not run | not run |
| Keyboard-only full journey | not run | not run |
| Screen reader spot check (NVDA or VoiceOver) | not run | not run |
