-- QA Test 1: vendor bill ambiguous status, Accounts vendor-quote verify,
-- vendor quote / credit-delivery notifications, dispatch only after vendor paid.

insert into public.role_permissions (role, permission)
values ('accounts', 'vendors.quote_approve')
on conflict do nothing;

create or replace function public.save_vendor_commercial(
  p_vendor_order_id uuid,
  p_quote_ref text default null,
  p_quote_amount numeric default null,
  p_bill_ref text default null,
  p_bill_amount numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  v_commercial text := 'sent';
begin
  actor := public.require_permission('fulfillment.update');
  if p_bill_amount is not null then
    v_commercial := 'payable';
  elsif p_quote_amount is not null then
    v_commercial := 'vendor_quoted';
  end if;
  update public.vendor_orders
    set quote_ref = coalesce(p_quote_ref, quote_ref),
        quote_amount = coalesce(p_quote_amount, quote_amount),
        bill_ref = coalesce(p_bill_ref, bill_ref),
        bill_amount = coalesce(p_bill_amount, bill_amount),
        payable_amount = coalesce(p_bill_amount, payable_amount, p_quote_amount),
        commercial_status = v_commercial
    where id = p_vendor_order_id;
end;
$$;

create or replace function public.save_vendor_quote(
  p_vendor_order_id uuid,
  p_quote_ref text,
  p_quote_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  vo public.vendor_orders;
begin
  actor := public.require_permission('orders.send_to_vendor');
  select * into vo from public.vendor_orders where id = p_vendor_order_id;
  if vo.id is null then
    raise exception 'Vendor batch not found' using errcode = 'P0002';
  end if;
  if vo.status <> 'draft' then
    raise exception 'Vendor quote can only be logged before send' using errcode = 'P0001';
  end if;
  if p_quote_ref is null or length(trim(p_quote_ref)) = 0 then
    raise exception 'Vendor quote reference is required' using errcode = '22023';
  end if;
  if p_quote_amount is null or p_quote_amount <= 0 then
    raise exception 'Vendor quote amount must be greater than 0' using errcode = '22023';
  end if;

  update public.vendor_orders
    set quote_ref = trim(p_quote_ref),
        quote_amount = p_quote_amount,
        payable_amount = coalesce(payable_amount, p_quote_amount),
        quoted_by = actor.id,
        commercial_status = 'quoted',
        quote_rejection_reason = null
    where id = vo.id;

  perform public.write_audit(
    actor.id, actor.role, 'VENDOR_QUOTE_SUBMITTED', 'order', vo.order_id,
    vo.status::text, vo.status::text,
    jsonb_build_object('vendor_order_id', vo.id)
  );
end;
$$;

create or replace function public.record_vendor_payment(
  p_vendor_order_id uuid,
  p_amount numeric,
  p_method text default null,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  pid uuid;
begin
  actor := public.require_permission('payments.verify');
  if p_amount is null or p_amount < 0 then
    raise exception 'Vendor payment amount is invalid' using errcode = '22023';
  end if;
  if p_amount > 0
     and coalesce(p_method, '') is distinct from 'cash'
     and (p_reference is null or length(trim(p_reference)) = 0) then
    raise exception 'UTR / cheque reference is required for non-cash vendor payments'
      using errcode = '22023';
  end if;
  insert into public.vendor_payments (
    vendor_order_id, amount, status, method, reference_number, recorded_by
  ) values (
    p_vendor_order_id, p_amount, 'verified', p_method, p_reference, actor.id
  ) returning id into pid;
  update public.vendor_orders
    set commercial_status = 'vendor_paid'
    where id = p_vendor_order_id;
  return pid;
end;
$$;

create or replace function public.mark_vendor_dispatched(p_vendor_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  vo public.vendor_orders;
  o public.orders;
begin
  actor := public.require_permission('fulfillment.update');
  select * into vo from public.vendor_orders where id = p_vendor_order_id;
  if vo.id is null then
    raise exception 'Vendor order not found' using errcode = 'P0002';
  end if;
  if vo.status <> 'sent' then
    raise exception 'Only a sent vendor order can be marked dispatched' using errcode = 'P0001';
  end if;
  if vo.commercial_status is distinct from 'vendor_paid' then
    raise exception 'Mark the vendor paid before dispatch' using errcode = 'P0001';
  end if;
  select * into o from public.orders where id = vo.order_id;

  update public.vendor_orders
    set status = 'dispatched', dispatched_at = now()
    where id = vo.id;

  if o.status = 'sent_to_vendor' then
    perform public.assert_transition(o.status, 'vendor_dispatched');
    perform public.allow_status();
    update public.orders set status = 'vendor_dispatched' where id = o.id;
  end if;

  perform public.write_audit(
    actor.id, actor.role, 'VENDOR_DISPATCHED', 'order', o.id,
    o.status::text,
    case when o.status = 'sent_to_vendor' then 'vendor_dispatched' else o.status::text end,
    jsonb_build_object('vendor_order_id', vo.id)
  );
end;
$$;

create or replace function public.request_credit_delivery(p_order_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  o public.orders;
begin
  actor := public.require_permission('payments.record');
  select * into o from public.orders where id = p_order_id;
  if o.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  update public.orders
    set credit_delivery_status = 'requested',
        on_hold_reason = coalesce(p_notes, on_hold_reason)
    where id = o.id;
  perform public.write_audit(
    actor.id, actor.role, 'CREDIT_DELIVERY_REQUESTED', 'order', o.id,
    o.status::text, o.status::text,
    jsonb_build_object('credit_delivery', 'requested')
  );
end;
$$;

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
    'VENDOR_QUOTE_SUBMITTED',
    'CREDIT_DELIVERY_REQUESTED',
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
    when 'VENDOR_QUOTE_SUBMITTED' then
      perform public.notify_role(
        'accounts',
        'VENDOR_QUOTE_SUBMITTED',
        'Vendor quote to verify',
        v_body || 'Waiting for Accounts to verify the vendor quote.',
        v_payload,
        new.actor_id
      );
      perform public.notify_role(
        'super_accounts',
        'VENDOR_QUOTE_SUBMITTED',
        'Vendor quote to verify',
        v_body || 'Waiting for Accounts to verify the vendor quote.',
        v_payload,
        new.actor_id
      );
    when 'CREDIT_DELIVERY_REQUESTED' then
      perform public.notify_role(
        'super_accounts',
        'CREDIT_DELIVERY_REQUESTED',
        'Credit delivery requested',
        v_body || 'Waiting for Super Accounts to review.',
        v_payload,
        new.actor_id
      );
      perform public.notify_role(
        'admin',
        'CREDIT_DELIVERY_REQUESTED',
        'Credit delivery requested',
        v_body || 'Waiting for Super Accounts to review.',
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
