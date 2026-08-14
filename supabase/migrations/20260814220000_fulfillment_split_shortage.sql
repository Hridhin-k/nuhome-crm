-- Split vendor sends, typed/partial GRN, shortage/damage/return write-off,
-- expected-date tracking stays on vendor_orders, Store can record payment.

insert into public.workflow_transitions (from_status, to_status)
values ('sent_to_vendor', 'items_received')
on conflict do nothing;

insert into public.role_permissions (role, permission)
values ('store', 'payments.record')
on conflict do nothing;

alter table public.order_items
  add column if not exists quantity_written_off numeric(12, 3) not null default 0,
  add column if not exists write_off_reason text,
  add column if not exists write_off_notes text;

alter table public.order_items
  drop constraint if exists order_items_write_off_reason_chk;
alter table public.order_items
  add constraint order_items_write_off_reason_chk
  check (
    write_off_reason is null
    or write_off_reason in ('shortage', 'damaged', 'returned', 'cancelled')
  );

alter table public.order_items
  drop constraint if exists order_items_received_chk;
alter table public.order_items
  add constraint order_items_accounted_chk
  check (
    quantity_received >= 0
    and quantity_written_off >= 0
    and quantity_received + quantity_written_off <= quantity
  );

alter table public.order_items drop column if exists quantity_pending;
alter table public.order_items
  add column quantity_pending numeric(12, 3)
  generated always as (quantity - quantity_received - quantity_written_off) stored;

alter table public.vendor_order_items
  add column if not exists quantity_written_off numeric(12, 3) not null default 0;

alter table public.vendor_order_items
  drop constraint if exists vendor_order_items_received_chk;
alter table public.vendor_order_items
  add constraint vendor_order_items_accounted_chk
  check (
    quantity_received >= 0
    and quantity_written_off >= 0
    and quantity_received + quantity_written_off <= quantity
  );

alter table public.vendor_order_items drop column if exists quantity_pending;
alter table public.vendor_order_items
  add column quantity_pending numeric(12, 3)
  generated always as (quantity - quantity_received - quantity_written_off) stored;

create or replace function public.order_items_fully_received(p_order_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    bool_and(oi.quantity_received + oi.quantity_written_off >= oi.quantity),
    false
  )
  from public.order_items oi
  where oi.order_id = p_order_id
$$;

create or replace function public.order_item_available_to_send(p_order_item_id uuid)
returns numeric
language sql
stable
as $$
  select greatest(
    0,
    oi.quantity
      - coalesce(oi.quantity_written_off, 0)
      - coalesce((
          select sum(voi.quantity)
          from public.vendor_order_items voi
          where voi.order_item_id = oi.id
        ), 0)
  )
  from public.order_items oi
  where oi.id = p_order_item_id
$$;

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
      jsonb_build_object('outstanding', 0)
    );
  end if;

  return gate;
end;
$$;

create or replace function public.send_order_to_vendor(
  p_order_id uuid,
  p_vendor_id uuid,
  p_items jsonb,
  p_expected_delivery date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  o public.orders;
  vid uuid;
  item jsonb;
  oi_id uuid;
  qty numeric;
  available numeric;
  seen uuid[] := '{}';
begin
  actor := public.require_permission('orders.send_to_vendor');
  select * into o from public.orders where id = p_order_id;
  if o.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if o.status not in (
    'order_active', 'sent_to_vendor', 'vendor_dispatched', 'items_received'
  ) then
    raise exception 'Items cannot be sent to a vendor in status %', o.status
      using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Select at least one item to send' using errcode = '22023';
  end if;
  if not exists (select 1 from public.vendors v where v.id = p_vendor_id and v.is_active) then
    raise exception 'Vendor not found' using errcode = 'P0002';
  end if;

  insert into public.vendor_orders (
    order_id, vendor_id, status, sent_at, expected_delivery_at, created_by
  ) values (
    o.id, p_vendor_id, 'sent', now(), p_expected_delivery, actor.id
  ) returning id into vid;

  for item in select value from jsonb_array_elements(p_items)
  loop
    oi_id := (item ->> 'order_item_id')::uuid;
    qty := (item ->> 'quantity')::numeric;
    if oi_id is null or qty is null or qty <= 0 then
      raise exception 'Each vendor line needs a quantity greater than 0' using errcode = '22023';
    end if;
    if oi_id = any (seen) then
      raise exception 'Duplicate item in vendor send' using errcode = '22023';
    end if;
    seen := array_append(seen, oi_id);
    if not exists (
      select 1 from public.order_items oi where oi.id = oi_id and oi.order_id = o.id
    ) then
      raise exception 'Order item does not belong to this order' using errcode = 'P0001';
    end if;
    available := public.order_item_available_to_send(oi_id);
    if qty > available then
      raise exception 'Cannot send more than the unsent quantity for an item'
        using errcode = 'P0001';
    end if;
    insert into public.vendor_order_items (vendor_order_id, order_item_id, quantity)
    values (vid, oi_id, qty);
  end loop;

  if o.status = 'order_active' then
    perform public.assert_transition(o.status, 'sent_to_vendor');
    perform public.allow_status();
    update public.orders set status = 'sent_to_vendor' where id = o.id;
  end if;

  perform public.write_audit(
    actor.id, actor.role, 'ORDER_SENT_TO_VENDOR', 'order', o.id,
    o.status::text,
    case when o.status = 'order_active' then 'sent_to_vendor' else o.status::text end,
    jsonb_build_object(
      'vendor_order_id', vid,
      'vendor_id', p_vendor_id,
      'expected_delivery_at', p_expected_delivery
    )
  );
  return vid;
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
  if o.status not in ('vendor_dispatched', 'items_received') then
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

  perform public.allow_status();
  if o.status = 'vendor_dispatched' then
    perform public.assert_transition(o.status, 'items_received');
    update public.orders set status = 'items_received' where id = o.id;
    perform public.write_audit(
      actor.id, actor.role, 'ITEMS_RECEIVED', 'order', o.id,
      o.status::text, 'items_received',
      jsonb_build_object('vendor_order_id', vo.id, 'partial', not vo_done)
    );
  else
    perform public.write_audit(
      actor.id, actor.role, 'ITEMS_RECEIVED', 'order', o.id,
      o.status::text, o.status::text,
      jsonb_build_object('vendor_order_id', vo.id, 'partial', not vo_done)
    );
  end if;

  return public.try_unlock_after_goods(o.id);
end;
$$;

create or replace function public.write_off_order_items(
  p_order_id uuid,
  p_items jsonb,
  p_notes text default null
)
returns public.workflow_status
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  o public.orders;
  item jsonb;
  oi_id uuid;
  qty numeric;
  reason text;
  remaining numeric;
  leftover numeric;
  voi record;
begin
  actor := public.require_permission('fulfillment.update');
  select * into o from public.orders where id = p_order_id;
  if o.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if o.status not in (
    'sent_to_vendor', 'vendor_dispatched', 'items_received'
  ) then
    raise exception 'Remainder cannot be closed in status %', o.status using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Select quantities to close' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    oi_id := (item ->> 'order_item_id')::uuid;
    qty := (item ->> 'quantity')::numeric;
    reason := item ->> 'reason';
    if oi_id is null or qty is null or qty <= 0 then
      raise exception 'Each close line needs a quantity greater than 0' using errcode = '22023';
    end if;
    if reason is null or reason not in ('shortage', 'damaged', 'returned', 'cancelled') then
      raise exception 'Choose shortage, damaged, returned, or cancelled' using errcode = '22023';
    end if;
    select quantity - quantity_received - quantity_written_off
      into remaining
      from public.order_items
      where id = oi_id and order_id = o.id;
    if remaining is null then
      raise exception 'Order item does not belong to this order' using errcode = 'P0001';
    end if;
    if qty > remaining then
      raise exception 'Cannot close more than the unaccounted quantity' using errcode = 'P0001';
    end if;

    leftover := qty;
    for voi in
      select voi.id, voi.quantity - voi.quantity_received - voi.quantity_written_off as open_qty
      from public.vendor_order_items voi
      join public.vendor_orders vo on vo.id = voi.vendor_order_id
      where voi.order_item_id = oi_id
        and vo.order_id = o.id
        and voi.quantity - voi.quantity_received - voi.quantity_written_off > 0
      order by vo.created_at, voi.id
    loop
      exit when leftover <= 0;
      if voi.open_qty >= leftover then
        update public.vendor_order_items
          set quantity_written_off = quantity_written_off + leftover
          where id = voi.id;
        leftover := 0;
      else
        update public.vendor_order_items
          set quantity_written_off = quantity_written_off + voi.open_qty
          where id = voi.id;
        leftover := leftover - voi.open_qty;
      end if;
    end loop;

    update public.order_items
      set quantity_written_off = quantity_written_off + qty,
          write_off_reason = reason,
          write_off_notes = coalesce(p_notes, write_off_notes)
      where id = oi_id;
  end loop;

  update public.vendor_orders vo
    set status = 'received', received_at = coalesce(received_at, now())
    where vo.order_id = o.id
      and vo.status in ('sent', 'dispatched')
      and not exists (
        select 1 from public.vendor_order_items voi
        where voi.vendor_order_id = vo.id
          and voi.quantity_received + voi.quantity_written_off < voi.quantity
      );

  perform public.write_audit(
    actor.id, actor.role, 'ITEMS_WRITTEN_OFF', 'order', o.id,
    o.status::text, o.status::text,
    jsonb_build_object('notes', p_notes)
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

revoke all on function public.try_unlock_after_goods(uuid) from public, anon, authenticated;
grant execute on function public.try_unlock_after_goods(uuid) to postgres, service_role;
grant execute on function public.order_item_available_to_send(uuid) to authenticated;
grant execute on function public.write_off_order_items(uuid, jsonb, text) to authenticated;
