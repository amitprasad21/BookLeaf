# Supabase Row Level Security

**Owns:** the table access matrix, helper functions, policy definitions and policy tests. Status: design (task DB-3). Verify syntax against current Supabase docs when writing the migration.

## 1. Why RLS matters here (not just decoration)

1. **Defense in depth for the backend:** user-initiated queries run with the caller's JWT ([AUTH_SECURITY.md](AUTH_SECURITY.md)), so a missing ownership check in code is still blocked.
2. **The publishable key is public.** Anyone holding it plus their own valid JWT can call the Supabase Data API directly, bypassing our backend. RLS and table constraints are the only guard on that path.

RLS is **enabled on every table in `public`**. With RLS on and no matching policy, access is denied.

## 2. Helper functions

`security definer`, `stable`, `set search_path = public`, execute revoked from `anon`. They read `profiles` without recursion through profiles' own policies.

| Function | Returns |
|---|---|
| `public.is_admin()` | `exists (select 1 from profiles where id = auth.uid() and role = 'admin')` |
| `public.current_author_id()` | `select author_id from profiles where id = auth.uid()` (null for admins) |
| `public.owns_ticket(t uuid)` | `exists (select 1 from tickets where id = t and author_id = current_author_id())` |

## 3. Access matrix

| Table | Author: SELECT | Author: INSERT | Author: UPDATE/DELETE | Admin: SELECT | Admin: INSERT | Admin: UPDATE | Anon |
|---|---|---|---|---|---|---|---|
| `profiles` | own row | no | no | all | no | no | no |
| `authors` | own row | no | no | all | no | no | no |
| `books` | own books | no | no | all | no | no | no |
| `tickets` | own | own, with check (below) | no | all | no | all (backend restricts columns; immutable-field trigger) | no |
| `ticket_messages` | on own tickets | own follow-up on own open/in-progress ticket (P2) | no | all | `sender_role='admin'` and `sender_profile_id = auth.uid()` | no | no |
| `internal_notes` | **no** | no | no | all | `admin_profile_id = auth.uid()` | no | no |
| `ai_drafts` | **no** | no | no | all | `requested_by = auth.uid()` | status only (`superseded`) | no |
| `audit_events` | **no** | no | no | all | no (system writer only) | no | no |
| `ai_usage_events` | **no** | no | no | all | no (system writer only) | no | no |

Nobody can delete through the Data API. The system writer (secret key) bypasses RLS and is restricted in code ([AUTH_SECURITY.md](AUTH_SECURITY.md) §5).

## 4. Key policies (sketch)

```sql
-- tickets: author insert
create policy tickets_author_insert on public.tickets
  for insert to authenticated
  with check (
    author_id = public.current_author_id()
    and status = 'open'
    and category is null and priority is null
    and ai_status = 'pending' and ai_category is null and ai_priority is null
    and assigned_admin_id is null
    and first_response_at is null and resolved_at is null and closed_at is null
  );

-- tickets: read
create policy tickets_select on public.tickets
  for select to authenticated
  using (author_id = public.current_author_id() or public.is_admin());

-- tickets: admin update
create policy tickets_admin_update on public.tickets
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- internal notes: admins only
create policy notes_admin_select on public.internal_notes
  for select to authenticated using (public.is_admin());
create policy notes_admin_insert on public.internal_notes
  for insert to authenticated
  with check (public.is_admin() and admin_profile_id = auth.uid());
```

Also:

- `revoke all on all tables in schema public from anon;` (anon has no business here).
- Ticket ownership of `book_id` is enforced by the composite FK, not by policy.
- Direct-API abuse path (author inserting tickets via the Data API at volume) is capped by the `tickets_author_rate_limit` trigger ([DATA_MODEL.md](DATA_MODEL.md)) and the AI daily budget.

## 5. Policy tests (DB-3)

Integration tests run against the Supabase project using supabase-js with the **publishable key** and real sign-ins (no secret key), so they exercise exactly what an attacker could:

| ID | As | Action | Expected |
|---|---|---|---|
| RLS-01 | anon | select from each table | 0 rows / permission error |
| RLS-02 | author A (AUTH001) | select books | only BK001, BK002 |
| RLS-03 | author A | select tickets of author B | 0 rows |
| RLS-04 | author A | insert ticket with `author_id = 'AUTH002'` | rejected |
| RLS-05 | author A | insert ticket with B's `book_id` | rejected (composite FK) |
| RLS-06 | author A | insert ticket with `priority = 'critical'` | rejected |
| RLS-07 | author A | update own ticket status | 0 rows updated |
| RLS-08 | author A | select internal_notes / ai_drafts / audit_events | 0 rows |
| RLS-09 | author A | insert 6 tickets in 10 minutes | 6th rejected (`rate_limited`) |
| RLS-10 | admin | select tickets | all authors' tickets |
| RLS-11 | admin | update ticket `subject` | rejected (immutable trigger) |
| RLS-12 | admin | insert audit_event | rejected (system writer only) |

Record results in [.agent/verification/](../.agent/verification/README.md). Until run, RLS is **unverified**.
