-- PL/pgSQL variables named quote_id/order_id clash with table columns
-- (SQLSTATE 42702: column reference "quote_id" is ambiguous).

create or replace function public.notify_from_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
  v_order_id uuid;
  quote_no text;
  order_no text;
  cust_name text;
  item_summary text;
  payload jsonb;
  label text;
  body text;
begin
  if new.entity_type = 'quote' then
    v_quote_id := new.entity_id;
  elsif new.entity_type = 'order' then
    v_order_id := new.entity_id;
  elsif new.entity_type = 'payment' then
    select p.quote_id, p.order_id into v_quote_id, v_order_id
    from public.payments p
    where p.id = new.entity_id;
  end if;

  if v_quote_id is null and v_order_id is not null then
    select o.quote_id into v_quote_id from public.orders o where o.id = v_order_id;
  end if;
  if v_order_id is null and v_quote_id is not null then
    select o.id into v_order_id from public.orders o where o.quote_id = v_quote_id;
  end if;
  if v_quote_id is not null then
    select q.quote_number, c.name into quote_no, cust_name
    from public.quotes q
    join public.customers c on c.id = q.customer_id
    where q.id = v_quote_id;
  end if;
  if v_order_id is not null then
    select o.order_number into order_no from public.orders o where o.id = v_order_id;
  end if;
  if v_quote_id is not null then
    select string_agg(qi.description, ', ')
    into item_summary
    from public.quote_items qi
    join public.quotes q on q.current_version_id = qi.version_id
    where q.id = v_quote_id;
  end if;

  label := concat_ws(' · ', cust_name, new.to_state, coalesce(order_no, quote_no), left(item_summary, 80));
  if label is null or length(label) = 0 then
    label := coalesce(quote_no, 'A job');
  end if;
  payload := coalesce(new.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'quote_id', v_quote_id,
      'order_id', v_order_id,
      'quote_number', quote_no,
      'order_number', order_no,
      'customer_name', cust_name
    );

  body := label || '. ';

  case new.action
    when 'QUOTE_SUBMITTED' then
      perform public.notify_role(
        'accounts',
        'QUOTE_SUBMITTED',
        'Quote submitted',
        body || 'Waiting for approval.',
        payload,
        new.actor_id
      );
      perform public.notify_role(
        'super_accounts',
        'QUOTE_SUBMITTED',
        'Quote submitted',
        body || 'Waiting for approval.',
        payload,
        new.actor_id
      );
    when 'PAYMENT_RECORDED' then
      perform public.notify_role(
        'accounts',
        'PAYMENT_RECORDED',
        'Payment recorded',
        body || 'Waiting for verification.',
        payload,
        new.actor_id
      );
      perform public.notify_role(
        'super_accounts',
        'PAYMENT_RECORDED',
        'Payment recorded',
        body || 'Waiting for verification.',
        payload,
        new.actor_id
      );
    when 'ORDER_ACTIVATED' then
      perform public.notify_role(
        'accounts',
        'ORDER_ACTIVATED',
        'Order active',
        body || 'Ready to send to a vendor.',
        payload,
        new.actor_id
      );
    when 'DELIVERY_UNLOCKED' then
      perform public.notify_role(
        'sales',
        'DELIVERY_UNLOCKED',
        'Delivery unlocked',
        body || 'Ready for handover.',
        payload,
        new.actor_id
      );
    when 'ORDER_PLACED_ON_HOLD' then
      perform public.notify_assigned_sales(
        v_order_id,
        'ORDER_PLACED_ON_HOLD',
        'Order on hold',
        body || 'Locked until the balance is paid.',
        payload,
        new.actor_id
      );
    when 'VENDOR_DISPATCHED' then
      perform public.notify_assigned_sales(
        v_order_id,
        'VENDOR_DISPATCHED',
        'Vendor dispatched',
        body || 'In transit from the vendor.',
        payload,
        new.actor_id
      );
    when 'ORDER_DELIVERED' then
      perform public.notify_assigned_sales(
        v_order_id,
        'ORDER_DELIVERED',
        'Order delivered',
        body || 'Handed over.',
        payload,
        new.actor_id
      );
    else
      null;
  end case;

  return new;
end;
$$;
