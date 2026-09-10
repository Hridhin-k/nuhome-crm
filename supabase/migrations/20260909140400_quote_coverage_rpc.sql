-- Warranty/AMC must be written inside security definer RPCs.
-- quote_versions is not updatable by authenticated (RLS revoke).

drop function if exists public.create_quote(uuid, jsonb, text);
drop function if exists public.revise_quote(uuid, jsonb, text);

create function public.create_quote(
  p_customer_id uuid,
  p_items jsonb,
  p_notes text default null,
  p_warranty_months integer default 12,
  p_include_amc boolean default false,
  p_amc_months integer default 12
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  qid uuid;
  vid uuid;
  qnum text;
begin
  actor := public.require_permission('quotes.create');

  if not exists (select 1 from public.customers c where c.id = p_customer_id) then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;

  qnum := 'QUOTE-' || lpad(nextval('public.quote_number_seq')::text, 4, '0');

  insert into public.quotes (quote_number, customer_id, created_by, status)
  values (qnum, p_customer_id, actor.id, 'quote_draft')
  returning id into qid;

  insert into public.quote_versions (
    quote_id, version_number, created_by, status, notes,
    warranty_months, include_amc, amc_months
  ) values (
    qid, 1, actor.id, 'quote_draft', p_notes,
    coalesce(p_warranty_months, 12),
    coalesce(p_include_amc, false),
    coalesce(p_amc_months, 12)
  ) returning id into vid;

  perform public.insert_quote_items(vid, p_items);
  perform public.recalc_version_totals(vid);

  update public.quotes set current_version_id = vid where id = qid;

  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_CREATED', 'quote', qid, null, 'quote_draft',
    jsonb_build_object('quote_number', qnum, 'version', 1)
  );

  return qid;
end;
$$;

create function public.revise_quote(
  p_quote_id uuid,
  p_items jsonb,
  p_notes text default null,
  p_warranty_months integer default 12,
  p_include_amc boolean default false,
  p_amc_months integer default 12
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  q public.quotes;
  vid uuid;
  next_ver int;
  live boolean;
begin
  actor := public.require_permission('quotes.revise');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.status not in (
    'quote_draft', 'quote_rejected', 'quote_approved', 'quote_sent_to_customer'
  ) then
    raise exception 'This quote cannot be edited now' using errcode = 'P0001';
  end if;

  live := q.status = 'quote_sent_to_customer';

  if q.status = 'quote_draft' then
    vid := q.current_version_id;
    delete from public.quote_items where version_id = vid;
    perform public.insert_quote_items(vid, p_items);
    perform public.recalc_version_totals(vid);
    update public.quote_versions
      set notes = p_notes,
          warranty_months = coalesce(p_warranty_months, warranty_months),
          include_amc = coalesce(p_include_amc, include_amc),
          amc_months = coalesce(p_amc_months, amc_months)
      where id = vid;
    update public.quotes set updated_at = now() where id = q.id;
    perform public.write_audit(
      actor.id, actor.role, 'QUOTE_REVISED', 'quote', q.id,
      'quote_draft', 'quote_draft',
      jsonb_build_object('version_id', vid, 'saved_draft', true)
    );
    return vid;
  end if;

  perform public.assert_transition(q.status, 'quote_draft');

  select coalesce(max(version_number), 0) + 1 into next_ver
  from public.quote_versions where quote_id = q.id;

  insert into public.quote_versions (
    quote_id, version_number, created_by, status, notes,
    warranty_months, include_amc, amc_months
  ) values (
    q.id, next_ver, actor.id, 'quote_draft', p_notes,
    coalesce(p_warranty_months, 12),
    coalesce(p_include_amc, false),
    coalesce(p_amc_months, 12)
  ) returning id into vid;

  perform public.insert_quote_items(vid, p_items);
  perform public.recalc_version_totals(vid);

  perform public.allow_status();
  update public.quotes
    set status = 'quote_draft',
        current_version_id = vid,
        revision_pending = live or q.revision_pending
    where id = q.id;

  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_REVISED', 'quote', q.id,
    q.status::text, 'quote_draft',
    jsonb_build_object('version', next_ver, 'version_id', vid, 'live', live)
  );

  return vid;
end;
$$;

grant execute on function public.create_quote(uuid, jsonb, text, integer, boolean, integer) to authenticated;
grant execute on function public.revise_quote(uuid, jsonb, text, integer, boolean, integer) to authenticated;
