-- Rollback for supabase/migrations/20261018090000_queue_urgency_rank.sql.
-- Drops the generated queue rank and its index. No ticket data is touched
-- (the rank is derived from status and priority). The admin queue's urgency
-- sort stops working until the migration is applied again.

begin;

drop index if exists public.tickets_urgency_idx;
alter table public.tickets drop column if exists urgency_rank;

commit;
