-- Accurate notification copy, audiences, and auto-approve handling.

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
  v_status_label text;
  v_needs_accounts boolean;
  v_created_by uuid;
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
    select q.quote_number, c.name, q.created_by
    into v_quote_no, v_cust_name, v_created_by
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

  v_status_label := case coalesce(new.new_state, '')
    when 'quote_draft' then 'Draft'
    when 'quote_pending_accounts' then 'Pending'
    when 'quote_rejected' then 'Returned'
    when 'quote_approved' then 'Approved'
    when 'quote_sent_to_customer' then 'Sent'
    when 'payment_pending_verification' then 'Verify pay'
    when 'order_active' then 'Active'
    when 'sent_to_vendor' then 'With vendor'
    when 'vendor_dispatched' then 'Dispatched'
    when 'items_received' then 'Received'
    when 'delivery_pending_payment' then 'Locked'
    when 'order_on_hold' then 'On hold'
    when 'delivery_unlocked' then 'Ready'
    when 'delivered' then 'Delivered'
    when 'closed' then 'Closed'
    when 'cancelled' then 'Cancelled'
    else nullif(replace(coalesce(new.new_state, ''), '_', ' '), '')
  end;

  v_label := concat_ws(
    ' · ',
    v_cust_name,
    v_status_label,
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
      v_needs_accounts := coalesce((new.metadata ->> 'needs_accounts')::boolean, true);
      if not v_needs_accounts or new.new_state = 'quote_approved' then
        if v_created_by is not null then
          perform public.notify_user(
            v_created_by,
            'QUOTE_APPROVED',
            'Quote approved',
            v_body || 'Auto-approved — send it to the customer.',
            v_payload
          );
        end if;
      else
        perform public.notify_role(
          'accounts',
          'QUOTE_SUBMITTED',
          'Quote submitted',
          v_body || 'Waiting for approval.',
          v_payload,
          new.actor_id
        );
        perform public.notify_role(
          'operations',
          'QUOTE_SUBMITTED',
          'Quote submitted',
          v_body || 'Waiting for approval.',
          v_payload,
          new.actor_id
        );
      end if;
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
        'operations',
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
      perform public.notify_role(
        'operations',
        'ORDER_ACTIVATED',
        'Order active',
        v_body || 'Ready to send to a vendor.',
        v_payload,
        new.actor_id
      );
    when 'DELIVERY_UNLOCKED' then
      perform public.notify_assigned_sales(
        v_order_id,
        'DELIVERY_UNLOCKED',
        'Delivery unlocked',
        v_body || 'Ready for handover.',
        v_payload,
        new.actor_id
      );
      perform public.notify_role(
        'store',
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
        v_body || 'Waiting for verification.',
        v_payload,
        new.actor_id
      );
      perform public.notify_role(
        'operations',
        'VENDOR_QUOTE_SUBMITTED',
        'Vendor quote to verify',
        v_body || 'Waiting for verification.',
        v_payload,
        new.actor_id
      );
    when 'CREDIT_DELIVERY_REQUESTED' then
      perform public.notify_role(
        'operations',
        'CREDIT_DELIVERY_REQUESTED',
        'Credit delivery requested',
        v_body || 'Waiting for Operations to review.',
        v_payload,
        new.actor_id
      );
      perform public.notify_role(
        'admin',
        'CREDIT_DELIVERY_REQUESTED',
        'Credit delivery requested',
        v_body || 'Waiting for Operations to review.',
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

create or replace function public.reject_quote(p_quote_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  q public.quotes;
  v_cust_name text;
  v_body text;
begin
  actor := public.require_permission('quotes.reject');
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Rejection reason is required' using errcode = '22023';
  end if;
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.created_by = actor.id then
    raise exception 'You cannot reject your own quote' using errcode = '42501';
  end if;
  perform public.assert_transition(q.status, 'quote_rejected');
  perform public.allow_status();
  update public.quotes set status = 'quote_rejected' where id = q.id;
  update public.quote_versions
    set status = 'quote_rejected',
        rejection_reason = btrim(p_reason),
        rejected_by = actor.id,
        rejected_at = now()
    where id = q.current_version_id;
  insert into public.quote_approvals (quote_id, version_id, decided_by, decision, reason)
  values (q.id, q.current_version_id, actor.id, 'rejected', btrim(p_reason));
  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_REJECTED', 'quote', q.id,
    q.status::text, 'quote_rejected',
    jsonb_build_object('version_id', q.current_version_id, 'reason', btrim(p_reason))
  );

  select c.name into v_cust_name
  from public.customers c
  where c.id = q.customer_id;

  v_body := concat_ws(' · ', v_cust_name, 'Returned', q.quote_number)
    || '. '
    || btrim(p_reason);

  perform public.notify_user(
    q.created_by, 'QUOTE_REJECTED', 'Quote returned',
    v_body,
    jsonb_build_object(
      'quote_id', q.id,
      'quote_number', q.quote_number,
      'customer_name', v_cust_name
    )
  );
end;
$$;
