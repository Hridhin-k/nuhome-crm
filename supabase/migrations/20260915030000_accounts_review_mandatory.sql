-- Accounts must always review a submitted quote. Payment verify stays mandatory too.

delete from public.workflow_transitions
where from_status = 'quote_draft' and to_status = 'quote_approved';

create or replace function public.submit_quote(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  q public.quotes;
begin
  actor := public.require_permission('quotes.submit');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  perform public.assert_transition(q.status, 'quote_pending_accounts');
  perform public.allow_status();
  update public.quotes
    set status = 'quote_pending_accounts', submitted_at = now()
    where id = q.id;
  update public.quote_versions
    set status = 'quote_pending_accounts'
    where id = q.current_version_id;
  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_SUBMITTED', 'quote', q.id,
    q.status::text, 'quote_pending_accounts',
    jsonb_build_object('version_id', q.current_version_id)
  );
end;
$$;
