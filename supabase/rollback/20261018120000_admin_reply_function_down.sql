-- Rollback for supabase/migrations/20261018120000_admin_reply_function.sql.
-- Drops the reply function. Messages already sent stay. Admin replies stop
-- working until the migration is applied again.

begin;

drop function if exists public.admin_send_reply(uuid, text, public.ticket_status, uuid);

commit;
