-- Secure public quote links for customer WhatsApp sharing (no CRM login).

create extension if not exists pgcrypto with schema extensions;

create or replace function public.generate_quote_public_token()
returns text
language sql
volatile
as $$
  select replace(
    replace(
      replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'),
      '/',
      '_'
    ),
    '=',
    ''
  );
$$;

alter table public.quotes
  add column if not exists public_access_token text;

create unique index if not exists quotes_public_access_token_idx
  on public.quotes (public_access_token)
  where public_access_token is not null;

update public.quotes
set public_access_token = public.generate_quote_public_token()
where public_access_token is null
  and status in ('quote_approved', 'quote_sent_to_customer');

create or replace function public.approve_quote(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  q public.quotes;
begin
  actor := public.require_permission('quotes.approve');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.created_by = actor.id then
    raise exception 'You cannot approve your own quote' using errcode = '42501';
  end if;
  perform public.assert_transition(q.status, 'quote_approved');
  perform public.allow_status();
  update public.quotes
  set
    status = 'quote_approved',
    public_access_token = coalesce(public_access_token, public.generate_quote_public_token())
  where id = q.id;
  update public.quote_versions
    set status = 'quote_approved', rejection_reason = null, rejected_by = null, rejected_at = null
    where id = q.current_version_id;
  insert into public.quote_approvals (quote_id, version_id, decided_by, decision)
  values (q.id, q.current_version_id, actor.id, 'approved');
  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_APPROVED', 'quote', q.id,
    q.status::text, 'quote_approved',
    jsonb_build_object('version_id', q.current_version_id)
  );
  perform public.notify_user(
    q.created_by, 'QUOTE_APPROVED', 'Quote approved',
    'Accounts approved the quote. You can send it to the customer.',
    jsonb_build_object('quote_id', q.id)
  );
end;
$$;

create or replace function public.get_public_quote(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q public.quotes;
  v public.quote_versions;
  o public.orders;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return null;
  end if;

  select * into q
  from public.quotes
  where public_access_token = trim(p_token);

  if q.id is null then
    return null;
  end if;

  if q.status not in ('quote_approved', 'quote_sent_to_customer') then
    return null;
  end if;

  select * into o
  from public.orders
  where quote_id = q.id
  order by created_at desc
  limit 1;

  if o.id is not null and o.status = 'closed' then
    return null;
  end if;

  select * into v
  from public.quote_versions
  where id = q.current_version_id;

  if v.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'quote_number', q.quote_number,
    'customer', (
      select jsonb_build_object(
        'name', c.name,
        'phone', c.phone,
        'address', c.address
      )
      from public.customers c
      where c.id = q.customer_id
    ),
    'version', jsonb_build_object(
      'version_number', v.version_number,
      'subtotal', v.subtotal,
      'discount', v.discount,
      'tax', v.tax,
      'total', v.total,
      'notes', v.notes,
      'created_at', v.created_at
    ),
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'description', qi.description,
            'quantity', qi.quantity,
            'line_total', qi.line_total
          )
          order by qi.sort_order
        ),
        '[]'::jsonb
      )
      from public.quote_items qi
      where qi.version_id = v.id
    )
  );
end;
$$;

grant execute on function public.get_public_quote(text) to anon, authenticated;
