-- Audit fixes: payment verification must not skip fulfillment;
-- additional payments after activation; GRN must be complete before the delivery gate;
-- balance RPCs must not leak other orders.

create or replace function public.can_view_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and (
        public.is_admin()
        or public.is_accounts()
        or o.assigned_sales_id = auth.uid()
        or (
          public.has_permission('orders.send_to_vendor')
          and o.status in (
            'order_active', 'sent_to_vendor', 'vendor_dispatched', 'items_received',
            'delivery_pending_payment', 'order_on_hold', 'delivery_unlocked', 'delivered', 'closed'
          )
        )
        or (
          public.has_permission('deliveries.complete')
          and o.status in (
            'items_received', 'delivery_pending_payment', 'order_on_hold',
            'delivery_unlocked', 'delivered', 'closed'
          )
        )
      )
  )
$$;

create or replace function public.quote_balance(p_quote_id uuid)
returns public.balance_snapshot
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  snap public.balance_snapshot;
  oid uuid;
begin
  select o.id into oid from public.orders o where o.quote_id = p_quote_id;
  if oid is not null and not public.can_view_order(oid) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if oid is null and not exists (
    select 1 from public.quotes q
    where q.id = p_quote_id
      and (public.is_admin() or public.is_accounts() or q.created_by = auth.uid())
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select
    coalesce(qv.total, 0),
    coalesce((
      select sum(p.amount) from public.payments p
      where p.quote_id = p_quote_id and p.status = 'verified'
    ), 0),
    coalesce(qv.total, 0) - coalesce((
      select sum(p.amount) from public.payments p
      where p.quote_id = p_quote_id and p.status = 'verified'
    ), 0)
  into snap
  from public.quotes q
  left join public.quote_versions qv on qv.id = q.current_version_id
  where q.id = p_quote_id;

  return snap;
end;
$$;

create or replace function public.order_balance(p_order_id uuid)
returns public.balance_snapshot
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  qid uuid;
begin
  if not public.can_view_order(p_order_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select quote_id into qid from public.orders where id = p_order_id;
  return public.quote_balance(qid);
end;
$$;

create or replace function public.record_payment(
  p_quote_id uuid,
  p_kind public.payment_kind,
  p_amount numeric,
  p_method public.payment_method default null,
  p_reference text default null,
  p_paid_at date default current_date,
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
  o public.orders;
  pid uuid;
  moved boolean := false;
begin
  actor := public.require_permission('payments.record');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  select * into o from public.orders where quote_id = q.id;
  if o.id is null then
    raise exception 'Quote has not been sent to the customer' using errcode = 'P0001';
  end if;
  if o.assigned_sales_id <> actor.id and actor.role <> 'admin' then
    raise exception 'Only the assigned sales user can record payment' using errcode = '42501';
  end if;
  if o.status in ('delivered', 'closed') then
    raise exception 'Payments cannot be recorded in status %', o.status using errcode = 'P0001';
  end if;

  insert into public.payments (
    quote_id, order_id, kind, method, amount, reference_number, paid_at, recorded_by, status, notes
  ) values (
    q.id, o.id, p_kind, p_method, p_amount, p_reference, coalesce(p_paid_at, current_date),
    actor.id, 'pending', p_notes
  ) returning id into pid;

  if o.status in ('quote_sent_to_customer', 'order_on_hold') then
    perform public.assert_transition(o.status, 'payment_pending_verification');
    perform public.allow_status();
    update public.orders set status = 'payment_pending_verification' where id = o.id;
    moved := true;
  end if;

  perform public.write_audit(
    actor.id, actor.role, 'PAYMENT_RECORDED', 'payment', pid,
    o.status::text,
    case when moved then 'payment_pending_verification' else o.status::text end,
    jsonb_build_object('kind', p_kind, 'amount', p_amount, 'order_id', o.id)
  );

  return pid;
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
    if bal.outstanding <= 0 then
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
      jsonb_build_object('outstanding', 0)
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

create or replace function public.record_items_received(
  p_vendor_order_id uuid,
  p_received jsonb
)
returns public.workflow_status
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  vo public.vendor_orders;
  o public.orders;
  rec jsonb;
  oi_id uuid;
  qty numeric;
  bal public.balance_snapshot;
  gate public.workflow_status;
  received boolean;
begin
  actor := public.require_permission('fulfillment.update');
  select * into vo from public.vendor_orders where id = p_vendor_order_id;
  if vo.id is null then
    raise exception 'Vendor order not found' using errcode = 'P0002';
  end if;
  select * into o from public.orders where id = vo.order_id;
  if o.status not in ('vendor_dispatched', 'items_received') then
    raise exception 'Items cannot be received in status %', o.status using errcode = 'P0001';
  end if;

  for rec in select value from jsonb_array_elements(p_received)
  loop
    oi_id := (rec ->> 'order_item_id')::uuid;
    qty := (rec ->> 'quantity')::numeric;
    if qty is null or qty < 0 then
      raise exception 'Invalid received quantity' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.order_items oi where oi.id = oi_id and oi.order_id = o.id
    ) then
      raise exception 'Order item does not belong to this order' using errcode = 'P0001';
    end if;
    update public.vendor_order_items
      set quantity_received = quantity_received + qty
      where vendor_order_id = vo.id and order_item_id = oi_id;
    update public.order_items
      set quantity_received = quantity_received + qty
      where id = oi_id and order_id = o.id;
  end loop;

  update public.vendor_orders
    set status = 'received', received_at = now()
    where id = vo.id;

  perform public.allow_status();
  if o.status = 'vendor_dispatched' then
    perform public.assert_transition(o.status, 'items_received');
    update public.orders set status = 'items_received' where id = o.id;
    perform public.write_audit(
      actor.id, actor.role, 'ITEMS_RECEIVED', 'order', o.id,
      o.status::text, 'items_received',
      jsonb_build_object('vendor_order_id', vo.id)
    );
    o.status := 'items_received';
  end if;

  received := public.order_items_fully_received(o.id);
  if not received then
    return 'items_received';
  end if;

  perform public.assert_transition('items_received', 'delivery_pending_payment');
  update public.orders set status = 'delivery_pending_payment' where id = o.id;

  select * into bal from public.order_balance(o.id);
  if bal.outstanding > 0 then
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

  if gate = 'order_on_hold' then
    perform public.write_audit(
      actor.id, actor.role, 'ORDER_PLACED_ON_HOLD', 'order', o.id,
      'delivery_pending_payment', 'order_on_hold',
      jsonb_build_object('outstanding', bal.outstanding, 'order_total', bal.order_total, 'verified_payments', bal.verified_payments)
    );
  else
    perform public.write_audit(
      actor.id, actor.role, 'DELIVERY_UNLOCKED', 'order', o.id,
      'delivery_pending_payment', 'delivery_unlocked',
      jsonb_build_object('outstanding', 0)
    );
  end if;

  return gate;
end;
$$;

revoke all on function public.can_view_order(uuid) from public, anon, authenticated;
grant execute on function public.can_view_order(uuid) to service_role;
