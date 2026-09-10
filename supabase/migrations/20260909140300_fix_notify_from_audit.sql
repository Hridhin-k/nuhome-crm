-- Rebuild notify_from_audit to match audit_logs (old_state/new_state),
-- skip actions that should not notify, and keep cancel fan-out.

create or replace function public.notify_from_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
  v_order_id uuid;
  v_quote_no text;
  v_order_no text;
  v_cust_name text;
  v_item_summary text;
  v_payload jsonb;
  v_label text;
  v_body text;
begin
  if new.action not in (
    'QUOTE_SUBMITTED',
    'PAYMENT_RECORDED',
    'ORDER_ACTIVATED',
    'DELIVERY_UNLOCKED',
    'ORDER_PLACED_ON_HOLD',
    'VENDOR_DISPATCHED',
    'ORDER_DELIVERED',
    'ORDER_CANCELLED',
    'QUOTE_CANCELLED'
  ) then
    return new;
  end if;

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
    select q.quote_number, c.name into v_quote_no, v_cust_name
    from public.quotes q
    join public.customers c on c.id = q.customer_id
    where q.id = v_quote_id;
  end if;
  if v_order_id is not null then
    select o.order_number into v_order_no from public.orders o where o.id = v_order_id;
  end if;
  if v_quote_id is not null then
    select string_agg(qi.description, ', ')
    into v_item_summary
    from public.quote_items qi
    join public.quotes q on q.current_version_id = qi.version_id
    where q.id = v_quote_id;
  end if;

  v_label := concat_ws(
    ' · ',
    v_cust_name,
    replace(coalesce(new.new_state, ''), '_', ' '),
    coalesce(v_order_no, v_quote_no),
    left(v_item_summary, 80)
  );
  if v_label is null or length(v_label) = 0 then
    v_label := coalesce(v_quote_no, 'A job');
  end if;
  v_payload := coalesce(new.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'quote_id', v_quote_id,
      'order_id', v_order_id,
      'quote_number', v_quote_no,
      'order_number', v_order_no,
      'customer_name', v_cust_name
    );

  v_body := v_label || '. ';

  case new.action
    when 'QUOTE_SUBMITTED' then
      perform public.notify_role(
        'accounts',
        'QUOTE_SUBMITTED',
        'Quote submitted',
        v_body || 'Waiting for approval.',
        v_payload,
        new.actor_id
      );
      perform public.notify_role(
        'super_accounts',
        'QUOTE_SUBMITTED',
        'Quote submitted',
        v_body || 'Waiting for approval.',
        v_payload,
        new.actor_id
      );
    when 'PAYMENT_RECORDED' then
      perform public.notify_role(
        'accounts',
        'PAYMENT_RECORDED',
        'Payment recorded',
        v_body || 'Waiting for verification.',
        v_payload,
        new.actor_id
      );
      perform public.notify_role(
        'super_accounts',
        'PAYMENT_RECORDED',
        'Payment recorded',
        v_body || 'Waiting for verification.',
        v_payload,
        new.actor_id
      );
    when 'ORDER_ACTIVATED' then
      perform public.notify_role(
        'accounts',
        'ORDER_ACTIVATED',
        'Order active',
        v_body || 'Ready to send to a vendor.',
        v_payload,
        new.actor_id
      );
    when 'DELIVERY_UNLOCKED' then
      perform public.notify_role(
        'sales',
        'DELIVERY_UNLOCKED',
        'Delivery unlocked',
        v_body || 'Ready for handover.',
        v_payload,
        new.actor_id
      );
    when 'ORDER_PLACED_ON_HOLD' then
      perform public.notify_assigned_sales(
        v_order_id,
        'ORDER_PLACED_ON_HOLD',
        'Order on hold',
        v_body || 'Locked until the balance is paid.',
        v_payload,
        new.actor_id
      );
    when 'VENDOR_DISPATCHED' then
      perform public.notify_assigned_sales(
        v_order_id,
        'VENDOR_DISPATCHED',
        'Vendor dispatched',
        v_body || 'In transit from the vendor.',
        v_payload,
        new.actor_id
      );
    when 'ORDER_DELIVERED' then
      perform public.notify_assigned_sales(
        v_order_id,
        'ORDER_DELIVERED',
        'Order delivered',
        v_body || 'Handed over.',
        v_payload,
        new.actor_id
      );
    when 'ORDER_CANCELLED' then
      if new.old_state in (
        'order_active',
        'sent_to_vendor',
        'vendor_dispatched',
        'items_received'
      ) then
        perform public.notify_role(
          'accounts',
          'ORDER_CANCELLED',
          'Order cancelled',
          v_body || 'Was cancelled.',
          v_payload,
          new.actor_id
        );
      end if;
      perform public.notify_assigned_sales(
        v_order_id,
        'ORDER_CANCELLED',
        'Order cancelled',
        v_body || 'Was cancelled.',
        v_payload,
        new.actor_id
      );
    when 'QUOTE_CANCELLED' then
      if new.old_state = 'quote_pending_accounts' then
        perform public.notify_role(
          'accounts',
          'QUOTE_CANCELLED',
          'Quote cancelled',
          v_body || 'Was cancelled.',
          v_payload,
          new.actor_id
        );
      end if;
    else
      null;
  end case;

  return new;
end;
$$;
