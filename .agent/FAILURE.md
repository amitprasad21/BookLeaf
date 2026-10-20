# Failure Modes (System-Wide)

**Owns:** how each dependency can fail, how we detect it, what the user experiences and how we recover. AI-specific detail is owned by [.back/AI_FAILURE_HANDLING.md](../.back/AI_FAILURE_HANDLING.md).

| # | Failure | Detection | User experience | Recovery |
|---|---|---|---|---|
| F-01 | LLM provider down, rate-limited, mis-keyed or over budget | Provider errors, circuit breaker, budget check | Tickets still create; admin sees "Needs manual triage" and a manual reply editor | Automatic for transient cases (sweeper); config fix for keys; budget resets daily. Full matrix in `.back/AI_FAILURE_HANDLING.md` |
| F-02 | Supabase unavailable | DB/client errors; `/health` stays up but API calls 503 | Clear "Service temporarily unavailable, your draft is kept" message; author form keeps input | Retry with backoff in the client; no data loss because nothing was written |
| F-03 | Supabase Auth unavailable | Sign-in errors | Sign-in page shows a service error, not "wrong password" | Wait / retry |
| F-04 | Expired JWT mid-session | 401 from API | Silent token refresh then retry once; otherwise redirect to sign-in with "Session expired" | Re-authenticate |
| F-05 | SSE stream drops | Stream end / error | Indicator switches to "Refreshing every 15 s"; polling every 15 s takes over | Reconnect with backoff 1, 2, 5, 15 s; everything shown is re-fetched on reconnect (D-033) |
| F-06 | Backend restart during AI work | In-flight jobs lost | Ticket shows "AI triage pending" | Startup sweeper re-queues after 2 minutes |
| F-07 | Backend cold start (free tier sleep) | First request slow | Loading state up to ~60 s | Documented; a paid tier or a keep-alive would remove it |
| F-08 | Invalid environment configuration | Startup env validation fails fast (zod) | Service doesn't start (no half-configured runtime) | Fix env; logs name the **missing variable**, never values |
| F-09 | Concurrent admin edit | 409 VERSION_CONFLICT | "This ticket was updated by someone else. Showing the latest version." | Reload and reapply |
| F-10 | Invalid status transition | 422 | Control disabled for impossible transitions; message if raced | None needed |
| F-11 | Rate limit hit | 429 with Retry-After | "You've submitted several tickets recently. Please try again in N minutes." | Wait |
| F-12 | Seed mismatch (data not loaded exactly) | Seed verification step fails | Seed script exits non-zero | Fix and re-run (idempotent upserts) |
| F-13 | Migration failure in production | CLI error | Deploy halted before app rollout | See [ROLLBACK.md](ROLLBACK.md) |
| F-14 | Frontend can't reach API (CORS/URL misconfig) | Network errors in browser | Global error banner with retry | Fix env/CORS allowlist |

## Principles

- Fail closed on security (deny on doubt), fail open on workflow (manual paths always work).
- Every failure shown to a user has a next step.
- Logs carry a `requestId` to connect a user report to the server event.
