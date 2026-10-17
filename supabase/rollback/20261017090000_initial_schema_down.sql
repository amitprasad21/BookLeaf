-- Rollback for supabase/migrations/20261017090000_initial_schema.sql.
-- DESTRUCTIVE: drops every BookLeaf table and all data in them, including the
-- seeded authors and books. Run only with explicit approval and after a backup
-- (.agent/ROLLBACK.md). It does not touch auth.users; remove seeded users
-- separately if needed.
-- Kept outside supabase/migrations/ so the Supabase CLI never applies it.

-- Tables, in reverse dependency order (their triggers go with them).
drop table if exists public.ai_usage_events;
drop table if exists public.audit_events;
drop table if exists public.internal_notes;
drop table if exists public.ticket_messages;
drop table if exists public.ai_drafts;
drop table if exists public.tickets;
drop table if exists public.profiles;
drop table if exists public.books;
drop table if exists public.authors;

-- Trigger functions
drop function if exists public.ticket_messages_touch_ticket();
drop function if exists public.tickets_author_rate_limit();
drop function if exists public.tickets_set_updated_at_and_version();
drop function if exists public.tickets_guard_immutable_fields();

-- Enums
drop type if exists public.draft_status;
drop type if exists public.message_sender;
drop type if exists public.value_source;
drop type if exists public.ai_status;
drop type if exists public.ticket_priority;
drop type if exists public.ticket_category;
drop type if exists public.ticket_status;
drop type if exists public.user_role;
