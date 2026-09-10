-- Vendor batch: allocate draft lines, log quote, approve, then confirm send.

insert into public.permissions (slug, description) values
  ('vendors.quote_approve', 'Approve a vendor quote before send')
on conflict (slug) do nothing;

insert into public.role_permissions (role, permission)
select r, 'vendors.quote_approve'
from unnest(array['super_accounts'::public.app_role, 'admin'::public.app_role]) as r
on conflict do nothing;

alter table public.vendor_orders
  add column if not exists quoted_by uuid references public.profiles (id),
  add column if not exists quote_approved_by uuid references public.profiles (id),
  add column if not exists quote_approved_at timestamptz,
  add column if not exists quote_rejection_reason text;

create or replace function public.allocate_vendor_order(
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
  q public.quotes;
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
  select * into q from public.quotes where id = o.quote_id;
  if q.revision_pending then
    raise exception 'Vendor send is frozen until the revised quote is approved'
      using errcode = 'P0001';
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
    order_id, vendor_id, status, commercial_status, expected_delivery_at, created_by
  ) values (
    o.id, p_vendor_id, 'draft', 'pending_quote', p_expected_delivery, actor.id
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

  perform public.write_audit(
    actor.id, actor.role, 'ORDER_SENT_TO_VENDOR', 'order', o.id,
    o.status::text, o.status::text,
    jsonb_build_object('vendor_order_id', vid, 'allocated', true)
  );

  return vid;
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
end;
$$;

create or replace function public.decide_vendor_quote(
  p_vendor_order_id uuid,
  p_approve boolean,
  p_reason text default null
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
  actor := public.require_permission('vendors.quote_approve');
  select * into vo from public.vendor_orders where id = p_vendor_order_id;
  if vo.id is null then
    raise exception 'Vendor batch not found' using errcode = 'P0002';
  end if;
  if vo.quoted_by = actor.id then
    raise exception 'You cannot approve your own vendor quote' using errcode = '42501';
  end if;
  if vo.commercial_status not in ('quoted', 'quote_rejected') then
    raise exception 'This vendor quote is not waiting for a decision' using errcode = 'P0001';
  end if;
  if not p_approve and (p_reason is null or length(trim(p_reason)) = 0) then
    raise exception 'A reason is required to return a vendor quote' using errcode = '22023';
  end if;

  if p_approve then
    update public.vendor_orders
      set commercial_status = 'quote_approved',
          quote_approved_by = actor.id,
          quote_approved_at = now(),
          quote_rejection_reason = null
      where id = vo.id;
  else
    update public.vendor_orders
      set commercial_status = 'quote_rejected',
          quote_approved_by = null,
          quote_approved_at = null,
          quote_rejection_reason = trim(p_reason)
      where id = vo.id;
  end if;
end;
$$;

create or replace function public.confirm_vendor_send(p_vendor_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  vo public.vendor_orders;
  o public.orders;
  q public.quotes;
begin
  actor := public.require_permission('orders.send_to_vendor');
  select * into vo from public.vendor_orders where id = p_vendor_order_id;
  if vo.id is null then
    raise exception 'Vendor batch not found' using errcode = 'P0002';
  end if;
  if vo.status <> 'draft' then
    raise exception 'This batch is already sent' using errcode = 'P0001';
  end if;
  if vo.commercial_status is distinct from 'quote_approved' then
    raise exception 'Approve the vendor quote before sending' using errcode = 'P0001';
  end if;

  select * into o from public.orders where id = vo.order_id;
  select * into q from public.quotes where id = o.quote_id;
  if q.revision_pending then
    raise exception 'Vendor send is frozen until the revised quote is approved'
      using errcode = 'P0001';
  end if;

  update public.vendor_orders
    set status = 'sent',
        sent_at = now()
    where id = vo.id;

  if o.status = 'order_active' then
    perform public.assert_transition(o.status, 'sent_to_vendor');
    perform public.allow_status();
    update public.orders set status = 'sent_to_vendor' where id = o.id;
  end if;

  perform public.write_audit(
    actor.id, actor.role, 'ORDER_SENT_TO_VENDOR', 'order', o.id,
    o.status::text,
    case when o.status = 'order_active' then 'sent_to_vendor' else o.status::text end,
    jsonb_build_object('vendor_order_id', vo.id, 'confirmed', true)
  );

  return vo.id;
end;
$$;

grant execute on function public.allocate_vendor_order(uuid, uuid, jsonb, date) to authenticated;
grant execute on function public.save_vendor_quote(uuid, text, numeric) to authenticated;
grant execute on function public.decide_vendor_quote(uuid, boolean, text) to authenticated;
grant execute on function public.confirm_vendor_send(uuid) to authenticated;
