-- Rollback for supabase/migrations/20261017120000_rls_policies.sql.
-- Removes the policies and helper functions. RLS stays ENABLED on every table
-- (from the initial schema), so after this rollback client roles are back to
-- "deny everything", the safe state. Grants revoked by the migration are
-- deliberately NOT restored. No data is touched.

drop policy if exists ai_usage_events_admin_select on public.ai_usage_events;
drop policy if exists audit_events_admin_select on public.audit_events;
drop policy if exists ai_drafts_admin_update on public.ai_drafts;
drop policy if exists ai_drafts_admin_insert on public.ai_drafts;
drop policy if exists ai_drafts_admin_select on public.ai_drafts;
drop policy if exists internal_notes_admin_insert on public.internal_notes;
drop policy if exists internal_notes_admin_select on public.internal_notes;
drop policy if exists ticket_messages_author_insert on public.ticket_messages;
drop policy if exists ticket_messages_admin_insert on public.ticket_messages;
drop policy if exists ticket_messages_select on public.ticket_messages;
drop policy if exists tickets_admin_update on public.tickets;
drop policy if exists tickets_author_insert on public.tickets;
drop policy if exists tickets_select on public.tickets;
drop policy if exists books_select on public.books;
drop policy if exists authors_select on public.authors;
drop policy if exists profiles_select on public.profiles;

drop function if exists private.current_author_id();
drop function if exists private.is_admin();
drop schema if exists private;
