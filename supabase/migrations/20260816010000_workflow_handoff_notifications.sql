-- Fan out in-app notifications when the next role has work.
-- Existing QUOTE_APPROVED / QUOTE_REJECTED notifies (in those RPCs) stay as-is.

create or replace function public.notify_role(
  p_role public.app_role,
  p_type text,
  p_title text,
  p_body text,
  p_payload jsonb default '{}'::jsonb,
  p_except_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  for rec in
    select p.id
    from public.profiles p
    where p.role = p_role
      and p.id is distinct from p_except_user_id
  loop
    perform public.notify_user(rec.id, p_type, p_title, p_body, p_payload);
  end loop;
end;
$$;

create or replace function public.notify_assigned_sales(
  p_order_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_payload jsonb default '{}'::jsonb,
  p_except_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sales_id uuid;
begin
  select o.assigned_sales_id into sales_id
  from public.orders o
  where o.id = p_order_id;
  if sales_id is null or sales_id is not distinct from p_except_user_id then
    return;
  end if;
  perform public.notify_user(sales_id, p_type, p_title, p_body, p_payload);
end;
$$;

create or replace function public.notify_from_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_id uuid;
  order_id uuid;
  quote_no text;
  payload jsonb;
  label text;
begin
  if new.entity_type = 'quote' then
    quote_id := new.entity_id;
  elsif new.entity_type = 'order' then
    order_id := new.entity_id;
  elsif new.entity_type = 'payment' then
    select p.quote_id, p.order_id into quote_id, order_id
    from public.payments p
    where p.id = new.entity_id;
  end if;

  if quote_id is null and order_id is not null then
    select o.quote_id into quote_id from public.orders o where o.id = order_id;
  end if;
  if order_id is null and quote_id is not null then
    select o.id into order_id from public.orders o where o.quote_id = quote_id;
  end if;
  if quote_id is not null then
    select q.quote_number into quote_no from public.quotes q where q.id = quote_id;
  end if;

  label := coalesce(quote_no, 'A job');
  payload := coalesce(new.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'quote_id', quote_id,
      'order_id', order_id,
      'quote_number', quote_no
    );

  case new.action
    when 'QUOTE_SUBMITTED' then
      perform public.notify_role(
        'accounts',
        'QUOTE_SUBMITTED',
        'Quote submitted',
        label || ' is waiting for approval.',
        payload,
        new.actor_id
      );
    when 'PAYMENT_RECORDED' then
      perform public.notify_role(
        'accounts',
        'PAYMENT_RECORDED',
        'Payment recorded',
        label || ' has a payment waiting for verification.',
        payload,
        new.actor_id
      );
    when 'ORDER_ACTIVATED' then
      perform public.notify_role(
        'procurement',
        'ORDER_ACTIVATED',
        'Order active',
        label || ' is ready to send to a vendor.',
        payload,
        new.actor_id
      );
    when 'DELIVERY_UNLOCKED' then
      perform public.notify_role(
        'store',
        'DELIVERY_UNLOCKED',
        'Delivery unlocked',
        label || ' is ready for handover.',
        payload,
        new.actor_id
      );
    when 'ORDER_PLACED_ON_HOLD' then
      perform public.notify_assigned_sales(
        order_id,
        'ORDER_PLACED_ON_HOLD',
        'Order on hold',
        label || ' is locked until the balance is paid.',
        payload,
        new.actor_id
      );
    when 'VENDOR_DISPATCHED' then
      perform public.notify_assigned_sales(
        order_id,
        'VENDOR_DISPATCHED',
        'Vendor dispatched',
        label || ' is in transit from the vendor.',
        payload,
        new.actor_id
      );
    when 'ORDER_DELIVERED' then
      perform public.notify_assigned_sales(
        order_id,
        'ORDER_DELIVERED',
        'Order delivered',
        label || ' has been handed over.',
        payload,
        new.actor_id
      );
    else
      null;
  end case;

  return new;
end;
$$;

drop trigger if exists audit_logs_notify on public.audit_logs;
create trigger audit_logs_notify
after insert on public.audit_logs
for each row
execute function public.notify_from_audit();

revoke all on function public.notify_role(public.app_role, text, text, text, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.notify_assigned_sales(uuid, text, text, text, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.notify_from_audit() from public, anon, authenticated;

grant execute on function public.notify_role(public.app_role, text, text, text, jsonb, uuid)
  to postgres, service_role;
grant execute on function public.notify_assigned_sales(uuid, text, text, text, jsonb, uuid)
  to postgres, service_role;
grant execute on function public.notify_from_audit() to postgres, service_role;
