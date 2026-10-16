# Admin Experience

**App:** `admin-frontend/` (Next.js, port 3001). **Users:** BookLeaf operations/support team (role `admin`).

**Job to be done:** "Tell me what to work on next, give me everything I need to answer correctly on one screen, and let me send a good reply fast, whether or not the AI is working."

| Spec | File |
|---|---|
| Screens and content | [SCREENS.md](SCREENS.md) |
| User flows | [FLOWS.md](FLOWS.md) |
| UI states per screen | [STATES.md](STATES.md) |
| Test plan | [TEST_PLAN.md](TEST_PLAN.md) |

**Design stance:** AI output is always labelled as a suggestion with its source and confidence, and the human controls are always available. Nothing is sent to an author without an explicit Send.
