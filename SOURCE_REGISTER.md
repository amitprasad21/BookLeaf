# Source Register

**Owns:** the inventory of source materials, what was actually accessible, their precedence and known gaps.

## Precedence (highest first)

When sources conflict, the higher one wins and the conflict is recorded below.

1. BookLeaf assignment PDF: product requirements, Knowledge Base, deliverables, evaluation weights, timeline.
2. Provided sample JSON: exact seed records.
3. Monochrome UI design specification: design authority (**not received**).
4. "Defend What You Ship" AI Field Guide v2: coding-agent workflow guidance (**not received**).
5. Skills/tools registry: capability inventory, not permission to install (**not received**).
6. Security checklist screenshot: coverage guidance (**not received**; its 18 controls are listed in the blueprint and its generation prompt).
7. Blueprint bundle v2: planning, governance and architecture decisions.
8. This repository's own documents and code.

## Inventory

| ID | Source | Location | Accessed? | Notes |
|---|---|---|---|---|
| S-01 | Assignment: "Author Support & Communication Portal" (`FULLSTACK-ASSIGNMENT1 (1).docx (1).pdf`) | Outside repo (user's Downloads). **Deliberately not committed**: it is the company's assessment brief and the repository will be public. | Yes, full text extracted 2026-10-16 | Evaluation weights: AI 25%, Architecture & Code 25%, API 15%, Functionality 15%, Product 10%, Docs 10% |
| S-02 | Sample data (`FULLSTACK-SAMPLEDATA (1) (1).json`) | [supabase/seed/bookleaf_sample_data.json](supabase/seed/bookleaf_sample_data.json) (byte-identical copy; the assignment calls it `bookleaf_sample_data.json`) | Yes | 10 authors, 18 books; internal totals consistent |
| S-03 | Blueprint v2 (Markdown) | [docs/blueprint/BOOKLEAF_DOCUMENTATION_BLUEPRINT_v2.md](docs/blueprint/BOOKLEAF_DOCUMENTATION_BLUEPRINT_v2.md) | Yes | Canonical planning source |
| S-04 | Blueprint v2 (PDF render) | [docs/blueprint/BOOKLEAF_DOCUMENTATION_BLUEPRINT_v2.pdf](docs/blueprint/BOOKLEAF_DOCUMENTATION_BLUEPRINT_v2.pdf) | Copied, not re-rendered | Reference copy of S-03 |
| S-05 | Claude Code document-generation prompt | [docs/blueprint/BOOKLEAF_CLAUDE_CODE_DOCUMENT_GENERATION_PROMPT.md](docs/blueprint/BOOKLEAF_CLAUDE_CODE_DOCUMENT_GENERATION_PROMPT.md) | Yes | Lists the 18 security controls and diagram requirements |
| S-06 | Git workflow template | [GIT_WORKFLOW.md](GIT_WORKFLOW.md) | Yes | Adopted verbatim as the root policy |
| S-07 | Monochrome UI design specification | n/a | **No** | Referenced by S-03 as canonical; provisional tokens in use (D-014) |
| S-08 | "Defend What You Ship" AI Field Guide v2 | n/a | **No** | S-03's summary used for `.agent/` structure |
| S-09 | Skills/tools registry | n/a | **No** | [.agent/skills-and-tools.md](.agent/skills-and-tools.md) records what is actually available locally instead |
| S-10 | Security checklist screenshot | n/a | **No** | Controls taken from S-03 section 9 and S-05 |
| S-11 | Blueprint diagram assets (`.dot` + `.png`) | [docs/blueprint/BOOKLEAF_BLUEPRINT_ASSETS/](docs/blueprint/BOOKLEAF_BLUEPRINT_ASSETS/) | Yes | Graphviz not installed; PNGs used as provided |
| S-12 | Claude API reference (model IDs, pricing cached 2026-10-06, structured outputs, caching minimums) | Claude Code `claude-api` skill | Yes | Used for [AI_SPEC.md](AI_SPEC.md) section 2; re-verify at AI-1 |

## Known conflicts and resolutions

| Topic | Conflict | Resolution |
|---|---|---|
| LLM provider | S-03 names OpenRouter/Groq as examples; S-01 suggests gpt-4o-mini or Claude Haiku | Proposed Claude Haiku 5.5 as primary, with an optional OpenAI-compatible fallback; confirm at AI-1 (Q-04) |
| Frontend topology | S-03 allows one app with route groups or two apps | Two apps, per the user's instruction to follow the blueprint's full structure (D-001) |
| Metadata change requests | The category name "ISBN & Metadata **Issues**" vs the S-01 sample "update the description…" listed under General | Change requests → General Inquiry; errors → ISBN & Metadata ([AI_SPEC.md](AI_SPEC.md) section 4) |
| Date context | Sample payout dates end 2025-12; current date is 2026-10 | Facts computed from the real date; open question Q-03 |
