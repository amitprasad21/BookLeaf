-- API-5: admin queue urgency rank (.back/TICKET_LIFECYCLE.md section 4, decision D-025).
--
-- The Data API (PostgREST) can only order by columns, so the urgency rule is
-- stored as a generated column the queue can sort and page on:
--   unresolved (open, in_progress) 0-4, then resolved/closed 10-14;
--   within each: critical 0, high 1, untriaged (no priority) 2, medium 3, low 4.
-- The queue orders by (urgency_rank, created_at), so ties go to the oldest.
--
-- Additive: one column computed from status and priority, plus an index. No
-- data changes, no policy or grant changes. Authors can already read their own
-- tickets' status and priority, so the derived rank exposes nothing new.
--
-- Apply in the SQL Editor (D-021): run the fingerprint query first, then this
-- file, then the query in .back/DATA_MODEL.md "Migration log" again.
-- Rollback: supabase/rollback/20261018090000_queue_urgency_rank_down.sql

begin;

alter table public.tickets
  add column urgency_rank smallint not null generated always as (
    (
      case when status = 'open' or status = 'in_progress' then 0 else 10 end
      + case
          when priority = 'critical' then 0
          when priority = 'high' then 1
          when priority is null then 2
          when priority = 'medium' then 3
          else 4
        end
    )::smallint
  ) stored;

comment on column public.tickets.urgency_rank is
  'Queue sort key: unresolved first, then critical, high, untriaged, medium, low. Generated; never written.';

create index tickets_urgency_idx on public.tickets (urgency_rank, created_at);

commit;
