-- Draft quotes can be saved in place. Approved quotes can be withdrawn
-- for a new version before they are sent. Customer phones are unique.

insert into public.workflow_transitions (from_status, to_status)
values ('quote_approved', 'quote_draft')
on conflict do nothing;

create or replace function public.normalize_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if digits is null or digits = '' then
    return null;
  end if;
  if length(digits) = 12 and left(digits, 2) = '91' then
    return right(digits, 10);
  end if;
  if length(digits) = 11 and left(digits, 1) = '0' then
    return right(digits, 10);
  end if;
  return digits;
end;
$$;

create or replace function public.find_customer_by_phone(p_phone text)
returns table (id uuid, name text, phone text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized text;
begin
  if not public.has_permission('customers.read') then
    raise exception 'Missing permission: customers.read' using errcode = '42501';
  end if;
  normalized := public.normalize_phone(p_phone);
  if normalized is null or length(normalized) < 10 then
    return;
  end if;
  return query
    select c.id, c.name, c.phone
    from public.customers c
    where public.normalize_phone(c.phone) = normalized
    limit 1;
end;
$$;

revoke all on function public.normalize_phone(text) from public, anon;
revoke all on function public.find_customer_by_phone(text) from public, anon;
grant execute on function public.normalize_phone(text) to authenticated;
grant execute on function public.find_customer_by_phone(text) to authenticated;

create unique index if not exists customers_phone_normalized_idx
  on public.customers (public.normalize_phone(phone))
  where public.normalize_phone(phone) is not null
    and length(public.normalize_phone(phone)) >= 10;

create or replace function public.revise_quote(
  p_quote_id uuid,
  p_items jsonb,
  p_notes text default null
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
begin
  actor := public.require_permission('quotes.revise');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.created_by <> actor.id and actor.role <> 'admin' then
    raise exception 'Only the owning sales user can revise this quote' using errcode = '42501';
  end if;
  if q.status not in ('quote_draft', 'quote_rejected', 'quote_approved') then
    raise exception 'This quote cannot be edited now' using errcode = 'P0001';
  end if;

  -- Draft: update the current version in place so sales can pause and return.
  if q.status = 'quote_draft' then
    vid := q.current_version_id;
    delete from public.quote_items where version_id = vid;
    perform public.insert_quote_items(vid, p_items);
    perform public.recalc_version_totals(vid);
    update public.quote_versions
      set notes = p_notes
      where id = vid;
    update public.quotes
      set updated_at = now()
      where id = q.id;
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
    quote_id, version_number, created_by, status, notes
  ) values (
    q.id, next_ver, actor.id, 'quote_draft', p_notes
  ) returning id into vid;

  perform public.insert_quote_items(vid, p_items);
  perform public.recalc_version_totals(vid);

  perform public.allow_status();
  update public.quotes
    set status = 'quote_draft', current_version_id = vid
    where id = q.id;

  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_REVISED', 'quote', q.id,
    q.status::text, 'quote_draft',
    jsonb_build_object('version', next_ver, 'version_id', vid)
  );

  return vid;
end;
$$;
