-- Floor features body. super_accounts enum is added in 20260909140000.

insert into public.roles (slug, name, description)
values (
  'super_accounts',
  'Super Accounts',
  'Catalogue, members, leads, and floor monitoring'
)
on conflict (slug) do nothing;

insert into public.permissions (slug, description) values
  ('catalog.manage', 'Add and edit materials'),
  ('staff.manage', 'Add and edit staff (not full admin)'),
  ('leads.manage', 'Manage leads'),
  ('reports.read', 'Read reports and monitoring'),
  ('deliveries.credit_approve', 'Approve delivery without full payment')
on conflict (slug) do nothing;

insert into public.role_permissions (role, permission)
select 'accounts', p
from unnest(array['orders.send_to_vendor', 'fulfillment.update']) as p
on conflict do nothing;

insert into public.role_permissions (role, permission)
select 'sales', 'deliveries.complete'
on conflict do nothing;

insert into public.role_permissions (role, permission)
select 'super_accounts', p
from unnest(array[
  'customers.read',
  'customers.write',
  'quotes.approve',
  'quotes.reject',
  'quotes.read_margin',
  'payments.verify',
  'orders.read',
  'orders.send_to_vendor',
  'fulfillment.update',
  'catalog.manage',
  'staff.manage',
  'leads.manage',
  'reports.read',
  'deliveries.credit_approve'
]) as p
on conflict do nothing;

insert into public.role_permissions (role, permission)
select 'admin', p
from unnest(array[
  'catalog.manage',
  'staff.manage',
  'leads.manage',
  'reports.read',
  'deliveries.credit_approve'
]) as p
on conflict do nothing;

update public.profiles
set role = 'accounts'
where role = 'procurement';

alter table public.customers
  add column if not exists firm text,
  add column if not exists whatsapp text,
  add column if not exists profession text[] not null default '{}',
  add column if not exists profession_other text,
  add column if not exists property_type text,
  add column if not exists property_other text,
  add column if not exists project_status text,
  add column if not exists interests text[] not null default '{}',
  add column if not exists source text,
  add column if not exists source_other text,
  add column if not exists follow_up_on date,
  add column if not exists follow_up_action text;

alter table public.materials
  add column if not exists description text;

alter table public.quotes
  add column if not exists revision_pending boolean not null default false;

alter table public.quote_versions
  add column if not exists warranty_months integer not null default 12,
  add column if not exists include_amc boolean not null default false,
  add column if not exists amc_months integer not null default 12;

alter table public.orders
  add column if not exists credit_delivery_status text not null default 'none';

alter table public.vendor_orders
  add column if not exists quote_ref text,
  add column if not exists quote_amount numeric(14, 2),
  add column if not exists bill_ref text,
  add column if not exists bill_amount numeric(14, 2),
  add column if not exists payable_amount numeric(14, 2),
  add column if not exists commercial_status text not null default 'sent';

create table if not exists public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  vendor_order_id uuid not null references public.vendor_orders (id) on delete cascade,
  amount numeric(14, 2) not null,
  status text not null default 'pending',
  method text,
  reference_number text,
  notes text,
  recorded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.vendor_payments enable row level security;

drop policy if exists vendor_payments_read on public.vendor_payments;
create policy vendor_payments_read on public.vendor_payments
for select to authenticated
using (public.has_permission('orders.read'));

drop policy if exists vendor_payments_write on public.vendor_payments;
create policy vendor_payments_write on public.vendor_payments
for all to authenticated
using (public.has_permission('payments.verify') or public.has_permission('fulfillment.update'))
with check (public.has_permission('payments.verify') or public.has_permission('fulfillment.update'));

alter table public.leads
  alter column customer_id drop not null;

alter table public.leads
  add column if not exists name text,
  add column if not exists phone text,
  add column if not exists firm text,
  add column if not exists place text,
  add column if not exists remarks text,
  add column if not exists follow_up_on date;

insert into public.workflow_transitions (from_status, to_status)
values ('quote_sent_to_customer', 'quote_draft')
on conflict do nothing;

create or replace function public.revise_quote(
  p_quote_id uuid,
  p_items jsonb,
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
  vid uuid;
  next_ver int;
  live boolean;
begin
  actor := public.require_permission('quotes.revise');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.status not in (
    'quote_draft', 'quote_rejected', 'quote_approved', 'quote_sent_to_customer'
  ) then
    raise exception 'This quote cannot be edited now' using errcode = 'P0001';
  end if;

  live := q.status = 'quote_sent_to_customer';

  if q.status = 'quote_draft' then
    vid := q.current_version_id;
    delete from public.quote_items where version_id = vid;
    perform public.insert_quote_items(vid, p_items);
    perform public.recalc_version_totals(vid);
    update public.quote_versions set notes = p_notes where id = vid;
    update public.quotes set updated_at = now() where id = q.id;
    perform public.write_audit(
      actor.id, actor.role, 'QUOTE_REVISED', 'quote', q.id,
      'quote_draft', 'quote_draft',
      jsonb_build_object('version_id', vid, 'saved_draft', true)
    );
    return vid;
  end if;

  perform public.assert_transition(q.status, 'quote_draft');

  select coalesce(max(version_number), 0) + 1 into next_ver
  from public.quote_versions where quote_id = q.id;

  insert into public.quote_versions (
    quote_id, version_number, created_by, status, notes
  ) values (
    q.id, next_ver, actor.id, 'quote_draft', p_notes
  ) returning id into vid;

  perform public.insert_quote_items(vid, p_items);
  perform public.recalc_version_totals(vid);

  perform public.allow_status();
  update public.quotes
    set status = 'quote_draft',
        current_version_id = vid,
        revision_pending = live or q.revision_pending
    where id = q.id;

  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_REVISED', 'quote', q.id,
    q.status::text, 'quote_draft',
    jsonb_build_object('version', next_ver, 'version_id', vid, 'live', live)
  );

  return vid;
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
    order_id, vendor_id, status, commercial_status, sent_at, expected_delivery_at, created_by
  ) values (
    o.id, p_vendor_id, 'sent', 'sent', now(), p_expected_delivery, actor.id
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
    jsonb_build_object('vendor_order_id', vid)
  );

  return vid;
end;
$$;

create or replace function public.approve_quote(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  q public.quotes;
  o public.orders;
  qi record;
begin
  actor := public.require_permission('quotes.approve');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.created_by = actor.id then
    raise exception 'You cannot approve your own quote' using errcode = '42501';
  end if;
  perform public.assert_transition(q.status, 'quote_approved');
  perform public.allow_status();
  update public.quotes
  set
    status = 'quote_approved',
    revision_pending = false,
    public_access_token = coalesce(public_access_token, public.generate_quote_public_token())
  where id = q.id;
  update public.quote_versions
    set status = 'quote_approved', rejection_reason = null, rejected_by = null, rejected_at = null
    where id = q.current_version_id;
  insert into public.quote_approvals (quote_id, version_id, decided_by, decision)
  values (q.id, q.current_version_id, actor.id, 'approved');

  select * into o from public.orders where quote_id = q.id order by created_at desc limit 1;
  if o.id is not null then
    for qi in
      select * from public.quote_items where version_id = q.current_version_id
    loop
      if exists (
        select 1 from public.order_items oi
        where oi.order_id = o.id and oi.quote_item_id = qi.id
      ) then
        update public.order_items
          set quantity = qi.quantity, description = qi.description
          where order_id = o.id and quote_item_id = qi.id
            and quantity_received <= qi.quantity;
      elsif exists (
        select 1 from public.order_items oi
        where oi.order_id = o.id and oi.material_id is not distinct from qi.material_id
          and oi.description = qi.description
      ) then
        update public.order_items
          set quantity = greatest(quantity, qi.quantity)
          where order_id = o.id
            and material_id is not distinct from qi.material_id
            and description = qi.description;
      else
        insert into public.order_items (order_id, quote_item_id, material_id, description, quantity)
        values (o.id, qi.id, qi.material_id, qi.description, qi.quantity);
      end if;
    end loop;
  end if;

  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_APPROVED', 'quote', q.id,
    q.status::text, 'quote_approved',
    jsonb_build_object('version_id', q.current_version_id)
  );
  perform public.notify_user(
    q.created_by, 'QUOTE_APPROVED', 'Quote approved',
    'Accounts approved the quote. You can send it to the customer.',
    jsonb_build_object('quote_id', q.id)
  );
end;
$$;

create or replace function public.complete_delivery(p_order_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  o public.orders;
  bal public.balance_snapshot;
  did uuid;
  v_months integer;
  qv public.quote_versions;
begin
  actor := public.require_permission('deliveries.complete');
  select * into o from public.orders where id = p_order_id;
  if o.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if o.status <> 'delivery_unlocked' then
    raise exception 'Delivery is locked. Order status is %', o.status using errcode = 'P0001';
  end if;
  if not public.order_items_fully_received(o.id) then
    raise exception 'Not all required items have been received' using errcode = 'P0001';
  end if;
  select * into bal from public.order_balance(o.id);
  if bal.outstanding > 0 and o.credit_delivery_status is distinct from 'approved' then
    raise exception 'Delivery blocked. Outstanding balance is %', bal.outstanding using errcode = 'P0001';
  end if;

  perform public.assert_transition(o.status, 'delivered');
  insert into public.deliveries (order_id, delivered_by, delivered_at, notes)
  values (o.id, actor.id, now(), p_notes)
  returning id into did;

  insert into public.delivery_items (delivery_id, order_item_id, quantity)
  select did, oi.id, oi.quantity from public.order_items oi where oi.order_id = o.id;

  perform public.allow_status();
  update public.orders set status = 'delivered' where id = o.id;
  perform public.write_audit(
    actor.id, actor.role, 'ORDER_DELIVERED', 'order', o.id,
    'delivery_unlocked', 'delivered',
    jsonb_build_object('delivery_id', did)
  );

  select qv2.* into qv
  from public.quotes q
  join public.quote_versions qv2 on qv2.id = q.current_version_id
  where q.id = o.quote_id;

  v_months := coalesce(qv.warranty_months, 12);

  insert into public.warranties (order_id, kind, starts_on, ends_on, notes, created_by)
  values (
    o.id,
    'warranty',
    (timezone('Asia/Kolkata', now()))::date,
    ((timezone('Asia/Kolkata', now()))::date + (v_months * interval '1 month'))::date,
    'Issued on delivery',
    actor.id
  )
  on conflict (order_id, kind) do nothing;

  if coalesce(qv.include_amc, false) then
    insert into public.warranties (order_id, kind, starts_on, ends_on, notes, created_by)
    values (
      o.id,
      'amc',
      (timezone('Asia/Kolkata', now()))::date,
      ((timezone('Asia/Kolkata', now()))::date + (coalesce(qv.amc_months, 12) * interval '1 month'))::date,
      'Quoted AMC',
      actor.id
    )
    on conflict (order_id, kind) do nothing;
  end if;

  perform public.assert_transition('delivered', 'closed');
  update public.orders set status = 'closed' where id = o.id;
  perform public.write_audit(
    actor.id, actor.role, 'ORDER_CLOSED', 'order', o.id,
    'delivered', 'closed', '{}'::jsonb
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
    actor.id, actor.role, 'DELIVERY_UNLOCKED', 'order', o.id,
    o.status::text, o.status::text,
    jsonb_build_object('credit_delivery', 'requested')
  );
end;
$$;

create or replace function public.decide_credit_delivery(p_order_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  o public.orders;
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
  if p_approve and o.status in ('delivery_pending_payment', 'order_on_hold', 'items_received') then
    perform public.allow_status();
    update public.orders set status = 'delivery_unlocked' where id = o.id;
  end if;
end;
$$;

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
  status text := 'sent';
begin
  actor := public.require_permission('fulfillment.update');
  if p_bill_amount is not null then
    status := 'payable';
  elsif p_quote_amount is not null then
    status := 'vendor_quoted';
  end if;
  update public.vendor_orders
    set quote_ref = coalesce(p_quote_ref, quote_ref),
        quote_amount = coalesce(p_quote_amount, quote_amount),
        bill_ref = coalesce(p_bill_ref, bill_ref),
        bill_amount = coalesce(p_bill_amount, bill_amount),
        payable_amount = coalesce(p_bill_amount, payable_amount, p_quote_amount),
        commercial_status = status
    where id = p_vendor_order_id;
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

grant execute on function public.request_credit_delivery(uuid, text) to authenticated;
grant execute on function public.decide_credit_delivery(uuid, boolean) to authenticated;
grant execute on function public.save_vendor_commercial(uuid, text, numeric, text, numeric) to authenticated;
grant execute on function public.record_vendor_payment(uuid, numeric, text, text) to authenticated;

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
