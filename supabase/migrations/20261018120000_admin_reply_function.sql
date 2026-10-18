-- API-7: send an admin reply atomically (.back/TICKET_LIFECYCLE.md section 2,
-- .back/API_IMPLEMENTATION.md section 4, decision D-027).
--
-- One call, one transaction:
--   1. lock the ticket row (concurrent replies and PATCHes queue up);
--   2. refuse unless the ticket is open or in progress (resolved/closed must
--      be reopened first);
--   3. insert the admin's message (as the caller: auth.uid());
--   4. set first_response_at if this is the first reply, move the status to
--      p_status_after (in_progress or resolved) and stamp resolved_at.
--
-- SECURITY INVOKER: it runs with the caller's rights, so the existing RLS
-- policies (admins may insert their own admin messages and update tickets)
-- still decide; the is_admin() check only gives a clear error first. Clients
-- other than signed-in users can't execute it.
--
-- Additive: one function, no table, policy or data changes.
-- Apply in the SQL Editor (D-021) with the fingerprint query before and after.
-- Rollback: supabase/rollback/20261018120000_admin_reply_function_down.sql

begin;

create function public.admin_send_reply(
  p_ticket_id uuid,
  p_body text,
  p_status_after public.ticket_status default 'in_progress',
  p_draft_id uuid default null
)
returns table (
  message_id uuid,
  message_created_at timestamptz,
  previous_status public.ticket_status,
  new_status public.ticket_status,
  first_response boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status public.ticket_status;
  v_first_response_at timestamptz;
  v_message_id uuid;
  v_created_at timestamptz;
begin
  if not (select private.is_admin()) then
    raise exception using errcode = '42501', message = 'admins_only';
  end if;
  if p_status_after is null or p_status_after not in ('in_progress', 'resolved') then
    raise exception using errcode = '22023', message = 'invalid_status_after';
  end if;

  select t.status, t.first_response_at
    into v_status, v_first_response_at
    from public.tickets as t
   where t.id = p_ticket_id
     for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ticket_not_found';
  end if;
  if v_status not in ('open', 'in_progress') then
    raise exception using
      errcode = 'P0001',
      message = 'reply_requires_reopen',
      detail = 'Resolved and closed tickets must be reopened before replying.';
  end if;
  if p_draft_id is not null and not exists (
    select 1 from public.ai_drafts as d where d.id = p_draft_id and d.ticket_id = p_ticket_id
  ) then
    raise exception using errcode = 'P0001', message = 'draft_not_found';
  end if;

  insert into public.ticket_messages (ticket_id, sender_role, sender_profile_id, body, ai_draft_id)
  values (p_ticket_id, 'admin', (select auth.uid()), p_body, p_draft_id)
  returning id, created_at into v_message_id, v_created_at;

  -- Skipped when nothing changes (a later reply on an in-progress ticket), so
  -- the version only moves for the message itself (ticket_messages_touch_ticket).
  update public.tickets as t
     set status = p_status_after,
         first_response_at = coalesce(t.first_response_at, v_created_at),
         resolved_at = case when p_status_after = 'resolved' then v_created_at else t.resolved_at end
   where t.id = p_ticket_id
     and (t.status <> p_status_after or t.first_response_at is null);

  return query
    select v_message_id, v_created_at, v_status, p_status_after, v_first_response_at is null;
end;
$$;

comment on function public.admin_send_reply(uuid, text, public.ticket_status, uuid) is
  'Admin reply + first response + status in one transaction (API-7). Runs as the caller; RLS applies.';

-- New functions are executable by PUBLIC by default: only signed-in users may call it.
revoke all on function public.admin_send_reply(uuid, text, public.ticket_status, uuid) from public, anon;
grant execute on function public.admin_send_reply(uuid, text, public.ticket_status, uuid) to authenticated;

commit;
