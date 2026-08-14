-- Store/Delivery can see in-transit jobs (GRN + overdue), see payments on
-- those orders, and record cash/UPI only at handover. Partial GRN must not
-- advance the whole order to items_received.

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated
  using (
    public.is_admin()
    or public.is_accounts()
    or assigned_sales_id = auth.uid()
    or (
      public.has_permission('orders.send_to_vendor')
      and status in (
        'order_active', 'sent_to_vendor', 'vendor_dispatched', 'items_received',
        'delivery_pending_payment', 'order_on_hold', 'delivery_unlocked', 'delivered', 'closed'
      )
    )
    or (
      public.has_permission('deliveries.complete')
      and status in (
        'sent_to_vendor', 'vendor_dispatched', 'items_received',
        'delivery_pending_payment', 'order_on_hold',
        'delivery_unlocked', 'delivered', 'closed'
      )
    )
  );

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
            'sent_to_vendor', 'vendor_dispatched', 'items_received',
            'delivery_pending_payment', 'order_on_hold',
            'delivery_unlocked', 'delivered', 'closed'
          )
        )
      )
  )
$$;

create or replace function public.can_read_order(p_order_id uuid)
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
            'sent_to_vendor', 'vendor_dispatched', 'items_received',
            'delivery_pending_payment', 'order_on_hold',
            'delivery_unlocked', 'delivered', 'closed'
          )
        )
      )
  );
$$;

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated
  using (
    public.is_admin()
    or public.is_accounts()
    or recorded_by = auth.uid()
    or exists (
      select 1 from public.orders o
      where o.id = payments.order_id and o.assigned_sales_id = auth.uid()
    )
    or (
      public.has_permission('payments.record')
      and exists (
        select 1 from public.orders o
        where o.id = payments.order_id
      )
    )
  );

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
  voi_remaining numeric;
  oi_remaining numeric;
  vo_done boolean;
  received_any boolean := false;
begin
  actor := public.require_permission('fulfillment.update');
  select * into vo from public.vendor_orders where id = p_vendor_order_id;
  if vo.id is null then
    raise exception 'Vendor order not found' using errcode = 'P0002';
  end if;
  if vo.status <> 'dispatched' then
    raise exception 'Receive against a dispatched vendor order' using errcode = 'P0001';
  end if;
  select * into o from public.orders where id = vo.order_id;
  if o.status not in ('sent_to_vendor', 'vendor_dispatched', 'items_received') then
    raise exception 'Items cannot be received in status %', o.status using errcode = 'P0001';
  end if;
  if p_received is null or jsonb_typeof(p_received) <> 'array' then
    raise exception 'Received quantities are required' using errcode = '22023';
  end if;

  for rec in select value from jsonb_array_elements(p_received)
  loop
    oi_id := (rec ->> 'order_item_id')::uuid;
    qty := coalesce((rec ->> 'quantity')::numeric, 0);
    if qty = 0 then
      continue;
    end if;
    if qty < 0 then
      raise exception 'Invalid received quantity' using errcode = '22023';
    end if;
    received_any := true;
    select quantity - quantity_received - quantity_written_off
      into voi_remaining
      from public.vendor_order_items
      where vendor_order_id = vo.id and order_item_id = oi_id;
    if voi_remaining is null then
      raise exception 'Item is not on this vendor order' using errcode = 'P0001';
    end if;
    if qty > voi_remaining then
      raise exception 'Cannot receive more than this vendor still owes' using errcode = 'P0001';
    end if;
    select quantity - quantity_received - quantity_written_off
      into oi_remaining
      from public.order_items
      where id = oi_id and order_id = o.id;
    if oi_remaining is null or qty > oi_remaining then
      raise exception 'Cannot receive more than the order still needs' using errcode = 'P0001';
    end if;
    update public.vendor_order_items
      set quantity_received = quantity_received + qty
      where vendor_order_id = vo.id and order_item_id = oi_id;
    update public.order_items
      set quantity_received = quantity_received + qty
      where id = oi_id and order_id = o.id;
  end loop;

  if not received_any then
    raise exception 'Enter at least one received quantity' using errcode = '22023';
  end if;

  select not exists (
    select 1 from public.vendor_order_items voi
    where voi.vendor_order_id = vo.id
      and voi.quantity_received + voi.quantity_written_off < voi.quantity
  ) into vo_done;

  if vo_done then
    update public.vendor_orders
      set status = 'received', received_at = now()
      where id = vo.id;
  end if;

  perform public.write_audit(
    actor.id, actor.role, 'ITEMS_RECEIVED', 'order', o.id,
    o.status::text, o.status::text,
    jsonb_build_object('vendor_order_id', vo.id, 'partial', not vo_done)
  );

  return public.try_unlock_after_goods(o.id);
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
  if actor.role = 'sales' and o.assigned_sales_id <> actor.id then
    raise exception 'Only the assigned sales user can record payment' using errcode = '42501';
  end if;
  if actor.role = 'store' and o.status not in (
    'items_received',
    'delivery_pending_payment',
    'order_on_hold',
    'payment_pending_verification'
  ) then
    raise exception 'Delivery can only record payment at handover' using errcode = '42501';
  end if;
  if o.status in ('delivered', 'closed') then
    raise exception 'Payments cannot be recorded in status %', o.status using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.payments p
    where p.order_id = o.id
      and p.status = 'pending'
  ) then
    raise exception 'A payment is already pending verification for this order' using errcode = 'P0001';
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
    jsonb_build_object('kind', p_kind, 'amount', p_amount, 'order_id', o.id, 'role', actor.role)
  );

  return pid;
end;
$$;
