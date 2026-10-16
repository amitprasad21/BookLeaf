# Claude Code Prompt — Update and Generate the BookLeaf Documentation Blueprint PDF

## Role

Act as a documentation architect and senior full-stack/security engineer. Update the existing BookLeaf documentation blueprint and generate a polished, diagrammatic PDF from the Markdown source. This is a documentation-generation task, **not permission to implement the application**.

## Objective

Inspect the existing repository and reference materials, reconcile the current blueprint with the requirements below, then create/update:

- `BOOKLEAF_DOCUMENTATION_BLUEPRINT.md` (or retain the repository's established canonical filename; do not create competing copies without explaining why)
- A matching `BOOKLEAF_DOCUMENTATION_BLUEPRINT.pdf` rendered from that Markdown source
- `GIT_WORKFLOW.md` at the repository root as the single canonical Git policy
- `DOCUMENTATION_MAP.md` and `SOURCE_REGISTER.md`, if equivalent authoritative files do not already exist
- Supporting diagram assets under a clear documentation asset directory, only if the Markdown uses external images

If the repository already contains the prior blueprint as `BOOKLEAF_DOCUMENTATION_BLUEPRINT_v2.md` or another versioned name, inspect it and update the authoritative copy in place only after checking Git status and avoiding destructive overwrites. Preserve previous user work. Use a version suffix or timestamp if there is a legitimate reason to keep a history copy; do not generate multiple unlinked “final-final” files.

## Before editing: source inventory

1. Inspect repository tree, current branch, `git status`, latest commits and existing document names.
2. Read the BookLeaf assessment, the exact sample JSON, the supplied `Defend What You Ship — AI Field Guide v2`, the monochrome design specification, skills/tool registry, the security screenshot, and existing project docs where available.
3. Record what was actually accessible. Never claim to have read an unavailable file.
4. Treat the BookLeaf assignment and JSON as product/data authorities; the UI prompt as design authority; the AI Field Guide as coding-agent workflow guidance; and the skills registry as inventory, not permission to install tools.
5. Check for conflicting requirements and preserve existing valid choices. If the target repository may be a different project, do not overwrite its documents; ask for scope clarification before destructive edits.

## Required architecture

The document must describe exactly two frontend experiences and one shared backend:

- Admin frontend for queue, filters, ticket detail, classification/priority overrides, AI reply drafts, replies, statuses, assignment and private notes.
- Author frontend for login, books/royalties, submitting tickets and viewing tickets/replies.
- One backend REST API responsible for business logic, validation, roles, ownership, ticket workflows, AI orchestration, logs and audit rules.
- Supabase Postgres as the database platform; Supabase Auth is recommended if compatible with the existing repository.
- Supabase RLS as defense in depth, plus backend authorization checks on every protected route. Explicitly warn that privileged/service-role credentials can bypass RLS and are server-only.
- AI orchestration separated from UI, with a primary provider, an optional pre-approved and budget-limited fallback, and a guaranteed manual fallback.

A single frontend codebase with distinct `/admin` and `/author` route groups may be retained if the existing repository already uses it safely. The architecture must still document separate Admin and Author responsibilities. There must never be two backend implementations.

## Required AI governance

Document both categories of AI separately:

1. **Development AI:** Claude Code and Codex workflow, shared instructions, context/handover, plans, scoped implementation, diff review, tests, approvals, decision log, truthful verification and commit workflow.
2. **Application AI:** Ticket classification into the six assessment categories, Critical/High/Medium/Low priority suggestions, response drafting using relevant BookLeaf Knowledge Base content, output validation, safe prompts, data minimization, cost budgets, bounded retries, provider routing, manual fallback and recovery.

A ticket must be saved to Supabase before AI processing. AI failure may not block ticket creation or manual admin replies. Drafts must not be sent without an explicit admin send action. Treat user ticket text and attachments as untrusted input and protect against prompt injection through server-side authorization, context minimization and output validation; a system prompt alone is not a security boundary.

Do not implement unrestricted key rotation to bypass quota/billing/rate limits. A different provider is used only when explicitly configured, authorised, within its own budget and allowed by its terms. If all providers fail, the application continues in manual mode.

## Just-in-time credential assistance — mandatory

Add a prominent policy for both Claude Code and Codex:

- Do not list every possible API key at the start or tell the user about all future credentials only at the end.
- When a real task first requires a credential, pause at that exact dependency. Explain what task needs it and why.
- First decide whether work can proceed with a mock, safe scaffold or manual fallback; if so, continue independent tasks and mark only the live integration test as blocked.
- If a choice is required, name the service and explain the relevant options briefly. Examples could include Supabase credentials and one approved LLM provider such as OpenRouter, Groq, OpenAI or Anthropic. Do not assume a provider until selected/documented.
- When setup steps may change, consult the provider's official documentation and link the official console/setup page rather than guessing.
- Guide the user one step at a time: where to create the account/project, which permission/scope to select, where to generate the key, what variable name to use and where the value must be entered.
- Never ask the user to paste the secret into the chat. Tell the user to place it directly into the correct local environment file or deployment secret settings.
- State whether each variable is public/project configuration or a server-only secret. LLM keys and Supabase privileged keys must never be shipped in frontend bundles.
- Add variable names only to `.env.example`; ensure `.env`, `.env.local` and private secret files are gitignored.
- Run a safe presence/connection test that never prints environment values, headers or connection strings. Resume the blocked task and update decisions/handover without storing credential values.
- If a secret is exposed, stop using it, direct the user to revoke/rotate it, inspect exposure and follow a recovery plan.
- Do not repeatedly interrupt unrelated work for a credential that is not yet needed. Do not declare a live integration verified until it has actually been tested.

For Supabase, explain the difference between browser-appropriate project values and privileged server keys. If direct database migration credentials are needed, explain why and where the connection string goes. For an LLM, ask which supported provider to configure when the choice first blocks a task, then follow that provider's current official setup instructions. Do not place secret values in prompts, documentation, logs or Git.

## Security screenshot: include every relevant control

The screenshot lists the following; cover them in a security checklist and state their applicability:

1. Row Level Security (Supabase RLS).
2. Authentication on every protected API route.
3. Never trust the frontend.
4. Rate limiting.
5. Input sanitization/validation.
6. Parameterized queries.
7. Restricted CORS.
8. HTTPS everywhere in deployed environments.
9. IDOR/object-level access prevention.
10. Debug mode disabled in production.
11. CAPTCHA on public/unauthenticated forms when applicable; don't add it blindly to authenticated flows.
12. Logging admin actions without secrets or unnecessary personal data.
13. Private storage buckets if actual attachment uploads are implemented; the assignment only requires attachment UI, while uploads are a bonus.
14. Hide admin pages in the UI for usability but always enforce admin authorization in the backend.
15. Review/update vulnerable packages.
16. Claude security review of actual changes, with human review and honest evidence; do not claim it ran unless it did.
17. Appropriate security headers.
18. Webhook signature verification only if webhooks are introduced; do not invent an unrequested webhook requirement.

Include test scenarios for anonymous admin access, cross-author ID substitution, internal-note leakage, AI budget abuse, prompt injection, provider-key exposure, RLS policies, expired private URLs and production debug leakage. A checklist is not verification evidence until tests or review actually run.

## Root Git policy

Create exactly one `GIT_WORKFLOW.md` at the root. Do not create other competing Git policies. Include:

- Lightweight branch naming: `main`, `feature/<name>`, `fix/<name>`, `docs/<name>`.
- Normal, focused Conventional Commit-style messages: `docs: ...`, `feat(author): ...`, `fix(api): ...`, `test(security): ...`.
- One coherent logical change per commit.
- Before working: inspect current branch, status, recent commits and existing diff.
- Before commit: tests appropriate to the change, diff review, secret scan/check, no unrelated files, docs/task/handover updates.
- Require user approval before committing unless explicitly authorised. Do not automatically push, force-push, merge, amend/rebase shared history, delete branches, or deploy.
- `.env.example` has placeholders only; real env files are ignored.
- Never invent commit hashes or claim tests passed without outputs.

## Design-system requirements

Treat the supplied monochrome design prompt as canonical. Preserve its black/white/grayscale tokens, opaque panels, system UI font, spacing scale, control boundaries, visible focus, keyboard interaction, clear loading/empty/error/success states, no fake values and responsive checks. Do not import unrelated climate charts, map requirements, colourful accents or decorative effects from generic examples.

Where applicable, document the supplied viewport checks: 320x568, 360x800, 390x844, 430x932, 768x1024, 1024x768, 1280x800, 1440x900 and 1920x1080, plus 200% zoom and keyboard-only navigation. Mark each as not run until actually tested.

## Documentation map to produce or update

At minimum, reconcile root files for product, PRD, architecture, design, integration contract, AI workflow, AI runtime specification, Git workflow, state, task tracking, source register and documentation map.

Use `.agent/` for constraints, handover, decisions, alternatives, actual flow, data reasoning, threat model, failure cases, test checklist, rollback, assumptions, defense, credential instructions, security review checklist and feature/bug templates.

Use `.front/admin/` and `.front/author/` for separate screen inventories, user flows, UI states and test plans. Shared frontend docs own the design system, components, accessibility, responsiveness and API usage.

Use `.back/` for data model, backend API implementation, authentication/authorization, Supabase RLS, ticket lifecycle, AI provider orchestration/failure handling, exact seed data, tests and deployment.

Keep one canonical API contract (e.g. `openapi.yaml`) and link to it instead of repeating endpoint definitions across documents.

## Diagram requirements

Include clear diagrams in both Markdown source and rendered PDF:

1. System architecture showing Admin frontend + Author frontend -> one backend -> Supabase, and backend AI orchestration -> primary/fallback providers -> manual mode.
2. Ticket creation / save-first AI triage / response approval sequence.
3. AI provider failure and fallback flow, including quota exhausted and all providers down.
4. Just-in-time credential assistance flow.
5. Claude Code/Codex plan-review-verify-handover flow.
6. Lightweight Git branch/normal commit flow.
7. Documentation folder tree and dependency/read order.

Use Mermaid source for maintainability. If the PDF renderer cannot render Mermaid, create clean image diagrams from the same source or generate diagram assets in a documented way. Do not leave large raw Mermaid code blocks as the only visualization in the PDF.

## Source document and PDF process

1. Update the canonical Markdown source first. Avoid hand-editing the PDF separately.
2. Generate the PDF from Markdown using a repeatable local command (Pandoc/LaTeX or the repository's documented renderer). Record the exact command in the handover/README if useful.
3. Ensure relative diagram/image assets resolve from the Markdown source.
4. Render the PDF into page images and inspect all pages or a systematic sample covering the title, complex diagrams, tables, page breaks and final page.
5. Fix clipped text, overlaps, cut tables, missing images, broken glyphs and bad page breaks; regenerate and inspect again.
6. Verify PDF page count, text extraction/searchability and that the exported PDF corresponds to the current Markdown source.
7. Bundle or preserve every image asset required to render Markdown again. Do not leave links pointing to machine-specific absolute paths.

## Boundaries

- Do not implement app features, change runtime code, install dependencies/plugins, execute installers, trust hooks, run database migrations, create external services or deploy during this documentation job.
- Do not make Git commits, push or merge automatically.
- Do not invent provider keys, Supabase credentials, project URLs, live tests or deployment state.
- Do not overwrite unrelated documents. Preserve user edits and inspect Git status first.
- Do not claim a security control is implemented because it appears in a written checklist.

## Final verification and response

Before finishing:

- Check all required sections exist and contradict neither the assignment nor the supplied UI spec.
- Verify two frontend experiences, one backend, Supabase RLS, just-in-time credential flow, AI failover/manual mode and root Git workflow are clearly stated.
- Check every relative link and diagram asset.
- Re-render and visually inspect the PDF; report any check not run.
- Update project state and handover only if the user repository scope makes that appropriate.

Report: files created/updated, source materials actually inspected, architecture decisions, key/credential workflows, security checklist coverage, exact rendering/validation steps executed, unresolved questions and first implementation task. Be explicit that this task generated documentation and did not implement the application.
