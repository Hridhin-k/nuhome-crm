-- write_off_order_items: loop record name collided with table alias `voi`.

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
  open_line record;
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
    for open_line in
      select
        voi.id as line_id,
        voi.quantity - voi.quantity_received - voi.quantity_written_off as open_qty
      from public.vendor_order_items voi
      join public.vendor_orders vo on vo.id = voi.vendor_order_id
      where voi.order_item_id = oi_id
        and vo.order_id = o.id
        and voi.quantity - voi.quantity_received - voi.quantity_written_off > 0
      order by vo.created_at, voi.id
    loop
      exit when leftover <= 0;
      if open_line.open_qty >= leftover then
        update public.vendor_order_items
          set quantity_written_off = quantity_written_off + leftover
          where id = open_line.line_id;
        leftover := 0;
      else
        update public.vendor_order_items
          set quantity_written_off = quantity_written_off + open_line.open_qty
          where id = open_line.line_id;
        leftover := leftover - open_line.open_qty;
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
