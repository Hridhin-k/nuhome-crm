-- Approved credit delivery must keep the order fully completable (no money hold).
-- Without approved credit, outstanding balance still blocks delivery as before.

create or replace function public.try_unlock_after_goods(p_order_id uuid)
returns public.workflow_status
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  o public.orders;
  bal public.balance_snapshot;
  gate public.workflow_status;
begin
  select * into o from public.orders where id = p_order_id;
  if o.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if not public.order_items_fully_received(o.id) then
    return o.status;
  end if;
  if o.status in ('delivered', 'closed', 'delivery_unlocked', 'order_on_hold', 'delivery_pending_payment') then
    return o.status;
  end if;

  perform public.allow_status();
  if o.status = 'sent_to_vendor' then
    perform public.assert_transition(o.status, 'items_received');
    update public.orders set status = 'items_received' where id = o.id;
    o.status := 'items_received';
  elsif o.status = 'vendor_dispatched' then
    perform public.assert_transition(o.status, 'items_received');
    update public.orders set status = 'items_received' where id = o.id;
    o.status := 'items_received';
  elsif o.status = 'order_active' then
    return o.status;
  end if;

  if o.status <> 'items_received' then
    return o.status;
  end if;

  perform public.assert_transition('items_received', 'delivery_pending_payment');
  update public.orders set status = 'delivery_pending_payment' where id = o.id;

  select * into bal from public.order_balance(o.id);
  if bal.outstanding > 0 and o.credit_delivery_status is distinct from 'approved' then
    gate := 'order_on_hold';
  else
    gate := 'delivery_unlocked';
  end if;

  perform public.assert_transition('delivery_pending_payment', gate);
  update public.orders
    set status = gate,
        on_hold_reason = case
          when gate = 'order_on_hold' then 'Outstanding balance ' || bal.outstanding::text
          else null
        end
    where id = o.id;

  select * into actor from public.profiles where id = auth.uid();
  if gate = 'order_on_hold' then
    perform public.write_audit(
      actor.id, actor.role, 'ORDER_PLACED_ON_HOLD', 'order', o.id,
      'delivery_pending_payment', 'order_on_hold',
      jsonb_build_object('outstanding', bal.outstanding)
    );
  else
    perform public.write_audit(
      actor.id, actor.role, 'DELIVERY_UNLOCKED', 'order', o.id,
      'delivery_pending_payment', 'delivery_unlocked',
      jsonb_build_object(
        'outstanding', bal.outstanding,
        'credit_delivery', o.credit_delivery_status
      )
    );
  end if;

  return gate;
end;
$$;

create or replace function public.verify_payment(p_payment_id uuid, p_notes text default null)
returns public.workflow_status
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  pay public.payments;
  o public.orders;
  bal public.balance_snapshot;
  next_status public.workflow_status;
  received boolean;
begin
  actor := public.require_permission('payments.verify');
  select * into pay from public.payments where id = p_payment_id;
  if pay.id is null then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if pay.recorded_by = actor.id then
    raise exception 'You cannot verify a payment you recorded' using errcode = '42501';
  end if;
  if pay.status <> 'pending' then
    raise exception 'Payment is not pending verification' using errcode = 'P0001';
  end if;

  select * into o from public.orders where id = pay.order_id;

  update public.payments set status = 'verified' where id = pay.id;
  insert into public.payment_verifications (payment_id, decided_by, decision, notes)
  values (pay.id, actor.id, 'verified', p_notes);

  select * into bal from public.order_balance(o.id);
  received := public.order_items_fully_received(o.id);

  if o.activated_at is null then
    next_status := 'order_active';
  elsif o.status in ('order_active', 'sent_to_vendor', 'vendor_dispatched')
     or (o.status = 'items_received' and not received) then
    next_status := o.status;
  elsif received
     or o.status in ('order_on_hold', 'delivery_pending_payment', 'delivery_unlocked', 'payment_pending_verification') then
    if bal.outstanding <= 0 or o.credit_delivery_status = 'approved' then
      next_status := 'delivery_unlocked';
    else
      next_status := 'order_on_hold';
    end if;
  else
    next_status := o.status;
  end if;

  if next_status is distinct from o.status then
    perform public.assert_transition(o.status, next_status);
    perform public.allow_status();
    update public.orders
      set status = next_status,
          activated_at = coalesce(activated_at, now()),
          on_hold_reason = case
            when next_status = 'order_on_hold' then 'Outstanding balance ' || bal.outstanding::text
            else null
          end
      where id = o.id;
  elsif o.activated_at is null then
    update public.orders set activated_at = now() where id = o.id;
  end if;

  perform public.write_audit(
    actor.id, actor.role, 'PAYMENT_VERIFIED', 'payment', pay.id,
    'pending', 'verified',
    jsonb_build_object('order_id', o.id, 'outstanding', bal.outstanding, 'order_status', next_status)
  );

  if o.activated_at is null and next_status = 'order_active' then
    perform public.write_audit(
      actor.id, actor.role, 'ORDER_ACTIVATED', 'order', o.id,
      o.status::text, 'order_active',
      jsonb_build_object('payment_id', pay.id)
    );
  elsif next_status = 'delivery_unlocked' and o.status is distinct from 'delivery_unlocked' then
    perform public.write_audit(
      actor.id, actor.role, 'DELIVERY_UNLOCKED', 'order', o.id,
      o.status::text, 'delivery_unlocked',
      jsonb_build_object('outstanding', bal.outstanding, 'credit_delivery', o.credit_delivery_status)
    );
  elsif next_status = 'order_on_hold' and o.status is distinct from 'order_on_hold' then
    perform public.write_audit(
      actor.id, actor.role, 'ORDER_PLACED_ON_HOLD', 'order', o.id,
      o.status::text, 'order_on_hold',
      jsonb_build_object('outstanding', bal.outstanding)
    );
  end if;

  return next_status;
end;
$$;

-- Re-apply decide so approval always clears money holds when goods are ready.
create or replace function public.decide_credit_delivery(p_order_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  o public.orders;
  next_status public.workflow_status;
  received boolean;
begin
  actor := public.require_permission('deliveries.credit_approve');
  select * into o from public.orders where id = p_order_id;
  if o.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if o.assigned_sales_id = actor.id then
    raise exception 'You cannot approve your own credit delivery request' using errcode = '42501';
  end if;
  update public.orders
    set credit_delivery_status = case when p_approve then 'approved' else 'rejected' end
    where id = o.id;

  if not p_approve then
    return;
  end if;

  received := public.order_items_fully_received(o.id);
  if o.status in ('quote_sent_to_customer', 'payment_pending_verification') then
    next_status := 'order_active';
  elsif o.status in ('delivery_pending_payment', 'order_on_hold')
     or (o.status = 'items_received' and received) then
    next_status := 'delivery_unlocked';
  else
    next_status := o.status;
  end if;

  if next_status is distinct from o.status then
    perform public.assert_transition(o.status, next_status);
    perform public.allow_status();
    update public.orders
      set status = next_status,
          activated_at = coalesce(activated_at, now()),
          on_hold_reason = null
      where id = o.id;
    perform public.write_audit(
      actor.id, actor.role,
      case when next_status = 'order_active' then 'ORDER_ACTIVATED' else 'DELIVERY_UNLOCKED' end,
      'order', o.id,
      o.status::text, next_status::text,
      jsonb_build_object('credit_delivery', 'approved')
    );
  else
    update public.orders
      set activated_at = coalesce(activated_at, now()),
          on_hold_reason = null
      where id = o.id;
  end if;
end;
$$;

-- Unstick jobs already approved for credit but still money-gated.
do $$
declare
  r record;
  received boolean;
  next_status public.workflow_status;
begin
  for r in
    select *
    from public.orders
    where credit_delivery_status = 'approved'
      and status in (
        'quote_sent_to_customer',
        'payment_pending_verification',
        'delivery_pending_payment',
        'order_on_hold',
        'items_received'
      )
  loop
    received := public.order_items_fully_received(r.id);
    if r.status in ('quote_sent_to_customer', 'payment_pending_verification') then
      next_status := 'order_active';
    elsif r.status in ('delivery_pending_payment', 'order_on_hold')
       or (r.status = 'items_received' and received) then
      next_status := 'delivery_unlocked';
    else
      next_status := r.status;
    end if;

    if next_status is distinct from r.status then
      perform public.allow_status();
      begin
        perform public.assert_transition(r.status, next_status);
        update public.orders
          set status = next_status,
              activated_at = coalesce(activated_at, now()),
              on_hold_reason = null
          where id = r.id;
      exception when others then
        -- Leave status if transition matrix rejects; still clear hold reason.
        update public.orders
          set activated_at = coalesce(activated_at, now()),
              on_hold_reason = null
          where id = r.id;
      end;
    else
      update public.orders
        set activated_at = coalesce(activated_at, now()),
            on_hold_reason = null
        where id = r.id;
    end if;
  end loop;
end;
$$;
