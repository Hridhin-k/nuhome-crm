-- Constraints, transitions, cancel_job, installment recording, and notifications for cancelled jobs.
alter table public.quotes drop constraint if exists quotes_status_phase;
alter table public.quotes
  add constraint quotes_status_phase check (
    status in (
      'quote_draft',
      'quote_pending_accounts',
      'quote_rejected',
      'quote_approved',
      'quote_sent_to_customer',
      'cancelled'
    )
  );

alter table public.quote_versions drop constraint if exists quote_versions_status_phase;
alter table public.quote_versions
  add constraint quote_versions_status_phase check (
    status in (
      'quote_draft',
      'quote_pending_accounts',
      'quote_rejected',
      'quote_approved',
      'quote_sent_to_customer',
      'cancelled'
    )
  );

insert into public.workflow_transitions (from_status, to_status)
values
  ('quote_draft', 'cancelled'),
  ('quote_pending_accounts', 'cancelled'),
  ('quote_rejected', 'cancelled'),
  ('quote_approved', 'cancelled'),
  ('quote_sent_to_customer', 'cancelled'),
  ('payment_pending_verification', 'cancelled'),
  ('order_active', 'cancelled'),
  ('sent_to_vendor', 'cancelled'),
  ('vendor_dispatched', 'cancelled'),
  ('items_received', 'cancelled'),
  ('delivery_pending_payment', 'cancelled'),
  ('order_on_hold', 'cancelled'),
  ('delivery_unlocked', 'cancelled')
on conflict do nothing;

-- Keep the job on the vendor path when Sales records another installment.
-- Only first terms / hold repayment move the status to pending verification.

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
  allowed boolean := false;
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

  if public.has_role('admin') then
    allowed := true;
  end if;
  if public.has_role('sales') and o.assigned_sales_id = actor.id then
    allowed := true;
  end if;
  if public.has_role('store') and o.status in (
    'items_received',
    'delivery_pending_payment',
    'order_on_hold',
    'payment_pending_verification'
  ) then
    allowed := true;
  end if;
  if not allowed then
    if public.has_role('store') then
      raise exception 'Delivery can only record payment at handover' using errcode = '42501';
    end if;
    raise exception 'Only the assigned sales user can record payment' using errcode = '42501';
  end if;

  if o.status in ('delivered', 'closed', 'cancelled') then
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

create or replace function public.cancel_job(p_quote_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  q public.quotes;
  o public.orders;
  allowed boolean := false;
  old_quote public.workflow_status;
  old_order public.workflow_status;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to cancel' using errcode = '22023';
  end if;

  actor := public.current_profile();
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  select * into o from public.orders where quote_id = q.id;

  allowed := public.has_permission('quotes.create') or public.is_admin();
  if o.id is not null and public.has_permission('orders.send_to_vendor') then
    allowed := true;
  end if;
  if o.id is null
     and q.status = 'quote_pending_accounts'
     and public.has_permission('quotes.approve') then
    allowed := true;
  end if;
  if not allowed then
    raise exception 'You cannot cancel this job' using errcode = '42501';
  end if;

  if q.status = 'cancelled' or o.status = 'cancelled' then
    raise exception 'This job is already cancelled' using errcode = 'P0001';
  end if;
  if coalesce(o.status, q.status) in ('delivered', 'closed') then
    raise exception 'A delivered job cannot be cancelled' using errcode = 'P0001';
  end if;

  old_quote := q.status;
  old_order := o.status;

  if o.id is not null then
    perform public.assert_transition(o.status, 'cancelled');
    perform public.allow_status();
    update public.orders
      set status = 'cancelled', on_hold_reason = left(trim(p_reason), 500)
      where id = o.id;
    perform public.write_audit(
      actor.id, actor.role, 'ORDER_CANCELLED', 'order', o.id,
      old_order::text, 'cancelled',
      jsonb_build_object('reason', trim(p_reason), 'quote_id', q.id)
    );
  end if;

  if q.status is distinct from 'cancelled' then
    perform public.assert_transition(q.status, 'cancelled');
    perform public.allow_status();
    update public.quotes set status = 'cancelled' where id = q.id;
    update public.quote_versions
      set status = 'cancelled'
      where id = q.current_version_id;
    perform public.write_audit(
      actor.id, actor.role, 'QUOTE_CANCELLED', 'quote', q.id,
      old_quote::text, 'cancelled',
      jsonb_build_object('reason', trim(p_reason), 'order_id', o.id)
    );
  end if;

  if o.id is not null then
    with rejected as (
      update public.payments
        set status = 'rejected'
        where order_id = o.id and status = 'pending'
      returning id
    )
    insert into public.payment_verifications (payment_id, decided_by, decision, notes)
    select id, actor.id, 'rejected', 'Job cancelled: ' || trim(p_reason)
    from rejected;
  end if;
end;
$$;

grant execute on function public.cancel_job(uuid, text) to authenticated;

create or replace function public.get_public_quote(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q public.quotes;
  v public.quote_versions;
  o public.orders;
  company public.company_settings;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return null;
  end if;

  select * into q
  from public.quotes
  where public_access_token = trim(p_token);

  if q.id is null then
    return null;
  end if;

  if q.status not in ('quote_approved', 'quote_sent_to_customer') then
    return null;
  end if;

  select * into o
  from public.orders
  where quote_id = q.id
  order by created_at desc
  limit 1;

  if o.id is not null and o.status in ('closed', 'cancelled') then
    return null;
  end if;

  select * into v
  from public.quote_versions
  where id = q.current_version_id;

  if v.id is null then
    return null;
  end if;

  select * into company from public.company_settings where id = 1;

  return jsonb_build_object(
    'quote_number', q.quote_number,
    'company', jsonb_build_object(
      'legal_name', coalesce(company.legal_name, 'Nuhome'),
      'gstin', company.gstin,
      'address', company.address,
      'phone', company.phone
    ),
    'customer', (
      select jsonb_build_object(
        'name', c.name,
        'phone', c.phone,
        'address', coalesce(c.billing_address, c.address),
        'gstin', c.gstin,
        'billing_address', coalesce(c.billing_address, c.address),
        'site_address', coalesce(c.site_address, c.billing_address, c.address)
      )
      from public.customers c
      where c.id = q.customer_id
    ),
    'version', jsonb_build_object(
      'version_number', v.version_number,
      'subtotal', v.subtotal,
      'discount', v.discount,
      'tax', v.tax,
      'total', v.total,
      'notes', v.notes,
      'created_at', v.created_at
    ),
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'description', qi.description,
            'quantity', qi.quantity,
            'line_total', qi.line_total,
            'hsn_code', qi.hsn_code,
            'gst_rate', qi.gst_rate,
            'tax', qi.tax,
            'unit_price', qi.unit_price,
            'discount', qi.discount
          )
          order by qi.sort_order
        ),
        '[]'::jsonb
      )
      from public.quote_items qi
      where qi.version_id = v.id
    )
  );
end;
$$;

grant execute on function public.get_public_quote(text) to anon, authenticated;

create or replace function public.reassign_sales_cover(
  p_from_user_id uuid,
  p_to_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  customers_moved int;
  quotes_moved int;
  orders_moved int;
begin
  actor := public.require_permission('admin.manage');
  if p_from_user_id is null or p_to_user_id is null or p_from_user_id = p_to_user_id then
    raise exception 'Choose two different people' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_from_user_id) then
    raise exception 'From user not found' using errcode = 'P0002';
  end if;
  if not public.user_has_role(p_to_user_id, 'sales')
     and not public.user_has_role(p_to_user_id, 'admin') then
    raise exception 'Cover person must have a Sales role' using errcode = '22023';
  end if;

  update public.customers
    set created_by = p_to_user_id
    where created_by = p_from_user_id;
  get diagnostics customers_moved = row_count;

  update public.quotes
    set created_by = p_to_user_id
    where created_by = p_from_user_id
      and status not in ('quote_sent_to_customer', 'cancelled');
  get diagnostics quotes_moved = row_count;

  update public.orders
    set assigned_sales_id = p_to_user_id
    where assigned_sales_id = p_from_user_id
      and status not in ('delivered', 'closed', 'cancelled');
  get diagnostics orders_moved = row_count;

  update public.quotes q
    set created_by = p_to_user_id
    where q.created_by = p_from_user_id
      and exists (
        select 1 from public.orders o
        where o.quote_id = q.id and o.assigned_sales_id = p_to_user_id
      );

  perform public.write_audit(
    actor.id, actor.role, 'WORK_REASSIGNED', 'profile', p_from_user_id,
    p_from_user_id::text, p_to_user_id::text,
    jsonb_build_object(
      'to_user_id', p_to_user_id,
      'customers', customers_moved,
      'quotes', quotes_moved,
      'orders', orders_moved
    )
  );

  return jsonb_build_object(
    'customers', customers_moved,
    'quotes', quotes_moved,
    'orders', orders_moved
  );
end;
$$;

create or replace function public.reassign_order_sales(
  p_order_id uuid,
  p_to_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  o public.orders;
begin
  actor := public.require_permission('admin.manage');
  select * into o from public.orders where id = p_order_id;
  if o.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if o.status in ('delivered', 'closed', 'cancelled') then
    raise exception 'Closed jobs cannot be reassigned' using errcode = 'P0001';
  end if;
  if not public.user_has_role(p_to_user_id, 'sales')
     and not public.user_has_role(p_to_user_id, 'admin') then
    raise exception 'Cover person must have a Sales role' using errcode = '22023';
  end if;

  update public.orders
    set assigned_sales_id = p_to_user_id
    where id = o.id;
  update public.quotes
    set created_by = p_to_user_id
    where id = o.quote_id;

  perform public.write_audit(
    actor.id, actor.role, 'WORK_REASSIGNED', 'order', o.id,
    o.assigned_sales_id::text, p_to_user_id::text,
    jsonb_build_object('to_user_id', p_to_user_id)
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
  v_payload jsonb;
  v_label text;
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
    select q.quote_number into v_quote_no from public.quotes q where q.id = v_quote_id;
  end if;

  v_label := coalesce(v_quote_no, 'A job');
  v_payload := coalesce(new.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'quote_id', v_quote_id,
      'order_id', v_order_id,
      'quote_number', v_quote_no
    );

  case new.action
    when 'QUOTE_SUBMITTED' then
      perform public.notify_role(
        'accounts',
        'QUOTE_SUBMITTED',
        'Quote submitted',
        v_label || ' is waiting for approval.',
        v_payload,
        new.actor_id
      );
    when 'PAYMENT_RECORDED' then
      perform public.notify_role(
        'accounts',
        'PAYMENT_RECORDED',
        'Payment recorded',
        v_label || ' has a payment waiting for verification.',
        v_payload,
        new.actor_id
      );
    when 'ORDER_ACTIVATED' then
      perform public.notify_role(
        'procurement',
        'ORDER_ACTIVATED',
        'Order active',
        v_label || ' is ready to send to a vendor.',
        v_payload,
        new.actor_id
      );
    when 'DELIVERY_UNLOCKED' then
      perform public.notify_role(
        'store',
        'DELIVERY_UNLOCKED',
        'Delivery unlocked',
        v_label || ' is ready for handover.',
        v_payload,
        new.actor_id
      );
    when 'ORDER_PLACED_ON_HOLD' then
      perform public.notify_assigned_sales(
        v_order_id,
        'ORDER_PLACED_ON_HOLD',
        'Order on hold',
        v_label || ' is locked until the balance is paid.',
        v_payload,
        new.actor_id
      );
    when 'VENDOR_DISPATCHED' then
      perform public.notify_assigned_sales(
        v_order_id,
        'VENDOR_DISPATCHED',
        'Vendor dispatched',
        v_label || ' is in transit from the vendor.',
        v_payload,
        new.actor_id
      );
    when 'ORDER_DELIVERED' then
      perform public.notify_assigned_sales(
        v_order_id,
        'ORDER_DELIVERED',
        'Order delivered',
        v_label || ' has been handed over.',
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
          'procurement',
          'ORDER_CANCELLED',
          'Order cancelled',
          v_label || ' was cancelled.',
          v_payload,
          new.actor_id
        );
      end if;
      perform public.notify_assigned_sales(
        v_order_id,
        'ORDER_CANCELLED',
        'Order cancelled',
        v_label || ' was cancelled.',
        v_payload,
        new.actor_id
      );
    when 'QUOTE_CANCELLED' then
      if new.old_state = 'quote_pending_accounts' then
        perform public.notify_role(
          'accounts',
          'QUOTE_CANCELLED',
          'Quote cancelled',
          v_label || ' was cancelled.',
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
