# Threat Model

**Owns:** actors, assets, abuse cases, mitigations and residual risk. The control checklist and review findings are in [SECURITY_REVIEW_CHECKLIST.md](SECURITY_REVIEW_CHECKLIST.md). Verification is recorded per control; deployment checks remain outstanding.

## Assets

1. Authors' royalty and personal data.
2. Internal notes and AI triage data.
3. Ticket integrity (status, replies, audit trail).
4. Credentials (Supabase secret key, LLM keys).
5. AI budget (money).
6. Availability of the support workflow.

## Actors

| Actor | Capability | Motivation |
|---|---|---|
| Anonymous internet user | Reach public URLs and the API | Data theft, abuse, cost exhaustion |
| Authenticated author (curious or malicious) | Valid author JWT | See other authors' royalties/tickets, see internal notes, manipulate priority, burn AI budget, prompt-inject |
| Authenticated admin (mistake-prone) | Valid admin JWT | Accidental overwrite, sending an unreviewed or hallucinated draft |
| Compromised dependency / leaked key | Code execution or key reuse | Data exfiltration, spend |
| LLM provider outage or misbehaviour | Errors, garbage, refusals | Availability, data quality |

## Abuse cases and mitigations

| # | Scenario | Mitigations | Residual risk | Test |
|---|---|---|---|---|
| T-01 | Anonymous call to `/admin/*` | Auth middleware on all non-public routes; route inventory test | Low | SEC-1: 401 |
| T-02 | Author calls `/admin/*` | Role guard per namespace | Low | SEC-1: 403 |
| T-03 | Author substitutes another author's `ticketId`/`bookId` (IDOR) | Ownership in query + RLS + 404 response; UUIDs; `bookId` checked by composite FK | Low | SEC-1: 404, no data |
| T-04 | Author injects `authorId`, `role`, `status`, `priority` in body | Strict zod schemas reject unknown fields; identity from token; RLS WITH CHECK on insert | Low | SEC-1: 400 / ignored |
| T-05 | Author reads internal notes / AI fields | Separate author serializer; notes table has no author policy | Low | SEC-1: response shape snapshot |
| T-06 | Ticket spam / AI budget exhaustion | Per-author creation limits; daily token budget; per-ticket triage cap; draft regeneration limits | Medium (in-memory limits reset on restart) | SEC-1: 429 |
| T-07 | Prompt injection to leak other authors' data | Context built post-authorization with only the author's own data; delimited input; no tools; schema output | Low (nothing to leak) | AI-6 injection cases |
| T-08 | Prompt injection to force Critical priority | Admin sees rationale and confidence and can override; floors only raise for specific signals; eval coverage | Medium (queue gaming possible but visible) | AI-6 |
| T-09 | Hallucinated amounts or promises in a draft reach an author | Human send gate; fact guard warnings; facts computed by code; prompt forbids invented figures | Medium (depends on admin attention) | AI-6 draft rubric |
| T-10 | Malformed AI output sets an invalid enum | Structured outputs + zod + DB enums | Low | Unit tests with mock garbage |
| T-11 | RLS misconfiguration | RLS tests with author A, author B, admin; backend checks too | Medium until tested | DB-3 |
| T-12 | Secret key misuse (bypasses RLS) | Only imported by the system writer module (lint rule / grep check); never in frontend envs | Low | SEC-2 grep |
| T-13 | LLM/secret key leaked to browser | No `NEXT_PUBLIC_` secrets; build output grep; keys only in backend env | Low | SEC-2 bundle grep |
| T-14 | Keys or ticket text in logs | pino redaction of `authorization`, `apiKey`, body fields; request logs carry no headers or bodies and redact the `q` search value; usage logs store counts only | Low | Log review in SEC-2 |
| T-15 | Stack traces / provider errors exposed | Central error handler; generic 500 with requestId; `NODE_ENV=production` | Low | SEC-1 forced error |
| T-16 | Cross-origin abuse | CORS allowlist of the two frontend origins; bearer tokens (no cookies) avoid CSRF | Low | SEC-2 |
| T-17 | XSS via ticket content or AI draft | React escaping; no `dangerouslySetInnerHTML`; plain-text rendering with preserved line breaks | Low | Manual + lint rule |
| T-18 | Credential stuffing on login | Supabase Auth rate limits; generic error message; signups disabled | Medium (demo shares a known password) | n/a; documented |
| T-19 | Concurrent admin edits overwrite each other | Optimistic locking (409) | Low | API-6 tests |
| T-20 | Expired/copied attachment URLs (if X-1 built) | Private bucket, short-lived signed URLs, owner check | n/a until built | X-1 |
| T-21 | Vulnerable dependencies | `npm audit` before deploy; minimal dependency set; lockfile committed | Medium | SEC-2 |
| T-22 | Event stream leaks content | Events carry IDs only; per-subscriber filtering by ownership; internal changes are a separate admin-only event; streams re-authenticate every 10 min | Low | API-8 tests (offline + live I-20: no reply text on the stream, nothing to another author) |
| T-23 | Author bypasses the backend and calls the Supabase Data API directly with the public key + own JWT | RLS limits them to their own rows; insert WITH CHECK blocks setting status/priority/AI fields; DB constraints enforce lengths; DB rate-limit trigger caps inserts; AI daily budget caps cost of sweeper triage | Low–Medium | RLS-04..09 |

## Hardening review: 2026-10-21

- D-035 adds the global authenticated-request ceiling (failures count), failed-auth IP ceiling and health-check IP ceiling. `TRUST_PROXY_HOPS` defaults to zero; the deployed proxy topology still needs verification. Limits remain per instance and reset on restart.
- Asymmetric JWT header filtering reduces unnecessary legacy verification calls; it is not signature validation. A generated-key regression verifies that tampered claims never reach the profile query.
- D-036 separates the passed payout reference period from the upcoming scheduled deadline. Prompts preserve uncertainty and human review. Date/amount guards still cannot prove the semantic correctness of every model statement; live eval and admin review remain necessary.
- The 2026-10-21 audit found five high entries from one `braces` advisory in the development lint dependency chain; the production-only audit returned zero. No patched `braces` release is listed. This is an open SEC-2 finding, not an accepted risk or an audit pass. See the verification record.

**2026-10-22 follow-up:** provider/queue pacing now reduces bursts, including repairs and HTTP retries, but remains process-local and cannot guarantee provider quotas or an exact billing cap. Draft-policy guards send known action/tone/period failures through one repair attempt; they do not establish semantic correctness. The latest eight live drafts correct the prior observed failures. Missing production estimates remain explicit by user choice. Local secret scanning found no configured server keys/demo passwords in working files, Git history or static frontend bundles. The user chose local-only review; no source was sent to Claude, and independent human review remains open. The development braces advisory remains unpatched and has not received maintainer risk acceptance.

## Explicitly accepted risks (demo, unchanged)

- **Shared demo passwords** published in the README (required by the assignment). Mitigation: demo-only data and accounts.
- **In-memory rate limiting and event hub** reset on restart and don't span instances (A-15).
- **No email verification / MFA** (out of scope per assignment).
