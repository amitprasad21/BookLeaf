# .agent/: Governance, Reasoning and Evidence

This folder holds the reasoning behind the system and the evidence that it works. It is documentation, not a runtime service.

| Need | File |
|---|---|
| Rules that must not be broken | [CONSTRAINTS.md](CONSTRAINTS.md) |
| What happened last session and what's next | [HANDOVER.md](HANDOVER.md) |
| Why we chose X | [DECISIONS.md](DECISIONS.md), [ALTERNATIVES.md](ALTERNATIVES.md) |
| How a request actually flows | [FLOW.md](FLOW.md) |
| What data we hold and who can touch it | [DATA.md](DATA.md) |
| What can go wrong (security) | [THREAT_MODEL.md](THREAT_MODEL.md), [SECURITY_REVIEW_CHECKLIST.md](SECURITY_REVIEW_CHECKLIST.md) |
| What can go wrong (operations) | [FAILURE.md](FAILURE.md), [ROLLBACK.md](ROLLBACK.md) |
| What "done" requires | [TEST_CHECKLIST.md](TEST_CHECKLIST.md) |
| Things we assumed | [ASSUMPTIONS.md](ASSUMPTIONS.md) |
| Getting credentials safely | [CREDENTIALS_GUIDE.md](CREDENTIALS_GUIDE.md) |
| Preparing to explain the system | [DEFENSE.md](DEFENSE.md) |
| Tools available in this environment | [skills-and-tools.md](skills-and-tools.md) |
| Templates | [templates/FEATURE_TEMPLATE.md](templates/FEATURE_TEMPLATE.md), [templates/BUG_TEMPLATE.md](templates/BUG_TEMPLATE.md) |
| Evidence of checks actually run | [verification/](verification/README.md) |

Git rules are **not** here. They live only in the root [GIT_WORKFLOW.md](../GIT_WORKFLOW.md).
