-- BookLeaf row level security policies (task DB-3).
-- Source of truth: .back/SUPABASE_RLS.md (access matrix). Applies on top of
-- 20261017090000_initial_schema.sql, which enabled RLS everywhere with no
-- policies and revoked all anon access.
--
-- Two layers here: (1) policies that decide WHICH ROWS a signed-in user may
-- see or write; (2) grants that decide WHICH OPERATIONS the authenticated role
-- may attempt at all (read-only tables, append-only logs, no deletes).
-- The backend's secret key (system writer, seed) bypasses all of this by
-- design; its use is confined in code (.back/AUTH_SECURITY.md section 5).
-- Rollback: supabase/rollback/20261017120000_rls_policies_down.sql

-- ---------------------------------------------------------------------------
-- 1. Helper functions in a private schema (not exposed through the Data API)
-- ---------------------------------------------------------------------------
create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- SECURITY DEFINER so policies can read profiles without recursing through
-- profiles' own policies. Each returns facts about the CALLER only.
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create function private.current_author_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select author_id from public.profiles where id = (select auth.uid());
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.current_author_id() from public;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.current_author_id() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Policies (all for the authenticated role; anon has no grants at all)
-- ---------------------------------------------------------------------------

-- profiles: your own row; admins see everyone.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

-- authors / books: your own record and books; admins see all. Read-only.
create policy authors_select on public.authors
  for select to authenticated
  using (author_id = (select private.current_author_id()) or (select private.is_admin()));

create policy books_select on public.books
  for select to authenticated
  using (author_id = (select private.current_author_id()) or (select private.is_admin()));

-- tickets: authors see and create their own; admins see and update all.
create policy tickets_select on public.tickets
  for select to authenticated
  using (author_id = (select private.current_author_id()) or (select private.is_admin()));

-- A new ticket must belong to the caller and start in its initial state.
-- Book ownership is enforced by the composite foreign key, not here.
create policy tickets_author_insert on public.tickets
  for insert to authenticated
  with check (
    author_id = (select private.current_author_id())
    and status = 'open'
    and category is null and category_source is null
    and priority is null and priority_source is null
    and ai_status = 'pending'
    and ai_category is null and ai_priority is null and ai_confidence is null
    and ai_signals = '{}' and ai_rationale is null and ai_policy_floor is null
    and ai_attempts = 0 and ai_failure_reason is null
    and ai_prompt_version is null and ai_processed_at is null
    and assigned_admin_id is null
    and version = 1
    and first_response_at is null and resolved_at is null and closed_at is null
  );

-- Admin updates; which columns may change is the backend's job, and ticket
-- content/ownership is frozen by the tickets_guard_immutable_fields trigger.
create policy tickets_admin_update on public.tickets
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ticket_messages: visible on tickets you can see; admins reply as
-- themselves; authors may follow up on their own unresolved tickets (P2).
create policy ticket_messages_select on public.ticket_messages
  for select to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1 from public.tickets as t
      where t.id = ticket_messages.ticket_id
        and t.author_id = (select private.current_author_id())
    )
  );

create policy ticket_messages_admin_insert on public.ticket_messages
  for insert to authenticated
  with check (
    (select private.is_admin())
    and sender_role = 'admin'
    and sender_profile_id = (select auth.uid())
  );

create policy ticket_messages_author_insert on public.ticket_messages
  for insert to authenticated
  with check (
    sender_role = 'author'
    and sender_profile_id = (select auth.uid())
    and ai_draft_id is null
    and exists (
      select 1 from public.tickets as t
      where t.id = ticket_messages.ticket_id
        and t.author_id = (select private.current_author_id())
        and t.status in ('open', 'in_progress')
    )
  );

-- internal_notes: admins only, written as themselves. Authors: no policy at all.
create policy internal_notes_admin_select on public.internal_notes
  for select to authenticated
  using ((select private.is_admin()));

create policy internal_notes_admin_insert on public.internal_notes
  for insert to authenticated
  with check ((select private.is_admin()) and admin_profile_id = (select auth.uid()));

-- ai_drafts: admins only. Updates are limited to the status column by grants below.
create policy ai_drafts_admin_select on public.ai_drafts
  for select to authenticated
  using ((select private.is_admin()));

create policy ai_drafts_admin_insert on public.ai_drafts
  for insert to authenticated
  with check ((select private.is_admin()) and requested_by = (select auth.uid()));

create policy ai_drafts_admin_update on public.ai_drafts
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- audit_events / ai_usage_events: admins read; only the system writer inserts.
create policy audit_events_admin_select on public.audit_events
  for select to authenticated
  using ((select private.is_admin()));

create policy ai_usage_events_admin_select on public.ai_usage_events
  for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- 3. Grants: narrow what the authenticated role may even attempt
-- ---------------------------------------------------------------------------
-- TRUNCATE ignores RLS, so it must never be granted to client roles.
revoke truncate, references, trigger on all tables in schema public from authenticated;
-- Nothing is deleted through the Data API.
revoke delete on all tables in schema public from authenticated;
-- Catalogue and identity are read-only for clients.
revoke insert, update on public.authors, public.books, public.profiles from authenticated;
-- Thread, notes and logs are append-only; logs are written by the system writer only.
revoke update on public.ticket_messages, public.internal_notes from authenticated;
revoke insert, update on public.audit_events, public.ai_usage_events from authenticated;
-- Admins may only change a draft's status (ready -> superseded).
revoke update on public.ai_drafts from authenticated;
grant update (status) on public.ai_drafts to authenticated;
