create sequence if not exists public.order_number_seq start 1001;

create or replace function public.next_order_number()
returns text
language sql
as $$
  select 'ORD-' || lpad(nextval('public.order_number_seq')::text, 4, '0');
$$;

alter table public.orders
  add column if not exists order_number text;

do $$
declare
  r record;
begin
  for r in
    select id
    from public.orders
    where order_number is null
    order by created_at, id
  loop
    update public.orders
      set order_number = public.next_order_number()
      where id = r.id;
  end loop;
end $$;

alter table public.orders
  alter column order_number set default public.next_order_number();

alter table public.orders
  alter column order_number set not null;

create unique index if not exists orders_order_number_key
  on public.orders (order_number);

create or replace function public.send_quote_to_customer(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  q public.quotes;
  oid uuid;
  onum text;
begin
  actor := public.require_permission('quotes.send_to_customer');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.status <> 'quote_approved' then
    raise exception 'Only an approved quote can be sent to the customer' using errcode = 'P0001';
  end if;
  perform public.assert_transition(q.status, 'quote_sent_to_customer');
  perform public.allow_status();
  update public.quotes
    set status = 'quote_sent_to_customer', sent_at = now()
    where id = q.id;
  update public.quote_versions
    set status = 'quote_sent_to_customer'
    where id = q.current_version_id;

  insert into public.orders (quote_id, customer_id, assigned_sales_id, status)
  values (q.id, q.customer_id, actor.id, 'quote_sent_to_customer')
  returning id, order_number into oid, onum;

  insert into public.order_items (order_id, quote_item_id, material_id, description, quantity)
  select oid, qi.id, qi.material_id, qi.description, qi.quantity
  from public.quote_items qi
  where qi.version_id = q.current_version_id;

  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_SENT_TO_CUSTOMER', 'quote', q.id,
    'quote_approved', 'quote_sent_to_customer',
    jsonb_build_object('order_id', oid, 'order_number', onum)
  );
  perform public.write_audit(
    actor.id, actor.role, 'ORDER_CREATED', 'order', oid,
    null, 'quote_sent_to_customer',
    jsonb_build_object('quote_id', q.id, 'order_number', onum)
  );

  return oid;
end;
$$;
