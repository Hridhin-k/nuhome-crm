-- Workflow RPCs (security definer) and role RLS.

-- ---------------------------------------------------------------------------
-- Quote RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_quote(
  p_customer_id uuid,
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
  qid uuid;
  vid uuid;
  qnum text;
begin
  actor := public.require_permission('quotes.create');

  if not exists (select 1 from public.customers c where c.id = p_customer_id) then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;

  qnum := 'QUOTE-' || lpad(nextval('public.quote_number_seq')::text, 4, '0');

  insert into public.quotes (quote_number, customer_id, created_by, status)
  values (qnum, p_customer_id, actor.id, 'quote_draft')
  returning id into qid;

  insert into public.quote_versions (
    quote_id, version_number, created_by, status, notes
  ) values (
    qid, 1, actor.id, 'quote_draft', p_notes
  ) returning id into vid;

  perform public.insert_quote_items(vid, p_items);
  perform public.recalc_version_totals(vid);

  update public.quotes set current_version_id = vid where id = qid;

  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_CREATED', 'quote', qid, null, 'quote_draft',
    jsonb_build_object('quote_number', qnum, 'version', 1)
  );

  return qid;
end;
$$;

create or replace function public.submit_quote(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  q public.quotes;
begin
  actor := public.require_permission('quotes.submit');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.created_by <> actor.id and actor.role <> 'admin' then
    raise exception 'Only the owning sales user can submit this quote' using errcode = '42501';
  end if;
  perform public.assert_transition(q.status, 'quote_pending_accounts');
  perform public.allow_status();
  update public.quotes
    set status = 'quote_pending_accounts', submitted_at = now()
    where id = q.id;
  update public.quote_versions
    set status = 'quote_pending_accounts'
    where id = q.current_version_id;
  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_SUBMITTED', 'quote', q.id,
    q.status::text, 'quote_pending_accounts',
    jsonb_build_object('version_id', q.current_version_id)
  );
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
  update public.quotes set status = 'quote_approved' where id = q.id;
  update public.quote_versions
    set status = 'quote_approved', rejection_reason = null, rejected_by = null, rejected_at = null
    where id = q.current_version_id;
  insert into public.quote_approvals (quote_id, version_id, decided_by, decision)
  values (q.id, q.current_version_id, actor.id, 'approved');
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

create or replace function public.reject_quote(p_quote_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  q public.quotes;
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
  perform public.notify_user(
    q.created_by, 'QUOTE_REJECTED', 'Quote returned',
    btrim(p_reason),
    jsonb_build_object('quote_id', q.id)
  );
end;
$$;

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
begin
  actor := public.require_permission('quotes.revise');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.created_by <> actor.id and actor.role <> 'admin' then
    raise exception 'Only the owning sales user can revise this quote' using errcode = '42501';
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
    set status = 'quote_draft', current_version_id = vid
    where id = q.id;

  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_REVISED', 'quote', q.id,
    q.status::text, 'quote_draft',
    jsonb_build_object('version', next_ver, 'version_id', vid)
  );

  return vid;
end;
$$;

create or replace function public.send_quote_to_customer(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  q public.quotes;
  oid uuid;
begin
  actor := public.require_permission('quotes.send_to_customer');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.status <> 'quote_approved' then
    raise exception 'Only an approved quote can be sent to the customer' using errcode = 'P0001';
  end if;
  if q.created_by <> actor.id and actor.role <> 'admin' then
    raise exception 'Only the owning sales user can send this quote' using errcode = '42501';
  end if;
  perform public.assert_transition(q.status, 'quote_sent_to_customer');
  perform public.allow_status();
  update public.quotes
    set status = 'quote_sent_to_customer', sent_at = now()
    where id = q.id;
  update public.quote_versions
    set status = 'quote_sent_to_customer'
    where id = q.current_version_id;

  insert into public.orders (quote_id, customer_id, assigned_sales_id, status)
  values (q.id, q.customer_id, q.created_by, 'quote_sent_to_customer')
  returning id into oid;

  insert into public.order_items (order_id, quote_item_id, material_id, description, quantity)
  select oid, qi.id, qi.material_id, qi.description, qi.quantity
  from public.quote_items qi
  where qi.version_id = q.current_version_id;

  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_SENT_TO_CUSTOMER', 'quote', q.id,
    'quote_approved', 'quote_sent_to_customer',
    jsonb_build_object('order_id', oid)
  );
  perform public.write_audit(
    actor.id, actor.role, 'ORDER_CREATED', 'order', oid,
    null, 'quote_sent_to_customer',
    jsonb_build_object('quote_id', q.id)
  );

  return oid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

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
begin
  actor := public.require_permission('payments.record');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.status <> 'quote_sent_to_customer' then
    select * into o from public.orders where quote_id = q.id;
    if o.id is null then
      raise exception 'Quote has not been sent to the customer' using errcode = 'P0001';
    end if;
  else
    select * into o from public.orders where quote_id = q.id;
  end if;

  if o.assigned_sales_id <> actor.id and actor.role <> 'admin' then
    raise exception 'Only the assigned sales user can record payment' using errcode = '42501';
  end if;

  if o.status not in (
    'quote_sent_to_customer', 'order_on_hold', 'payment_pending_verification'
  ) then
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
  end if;

  perform public.write_audit(
    actor.id, actor.role, 'PAYMENT_RECORDED', 'payment', pid,
    o.status::text, 'payment_pending_verification',
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

  if o.activated_at is null then
    next_status := 'order_active';
  elsif bal.outstanding <= 0 then
    next_status := 'delivery_unlocked';
  else
    next_status := 'order_on_hold';
  end if;

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

  perform public.write_audit(
    actor.id, actor.role, 'PAYMENT_VERIFIED', 'payment', pay.id,
    'pending', 'verified',
    jsonb_build_object('order_id', o.id, 'outstanding', bal.outstanding)
  );

  if next_status = 'order_active' then
    perform public.write_audit(
      actor.id, actor.role, 'ORDER_ACTIVATED', 'order', o.id,
      o.status::text, 'order_active',
      jsonb_build_object('payment_id', pay.id)
    );
  elsif next_status = 'delivery_unlocked' then
    perform public.write_audit(
      actor.id, actor.role, 'DELIVERY_UNLOCKED', 'order', o.id,
      o.status::text, 'delivery_unlocked',
      jsonb_build_object('outstanding', 0)
    );
  end if;

  return next_status;
end;
$$;

create or replace function public.reject_payment(p_payment_id uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  pay public.payments;
begin
  actor := public.require_permission('payments.verify');
  if p_notes is null or btrim(p_notes) = '' then
    raise exception 'Rejection reason is required' using errcode = '22023';
  end if;
  select * into pay from public.payments where id = p_payment_id;
  if pay.id is null then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if pay.recorded_by = actor.id then
    raise exception 'You cannot reject a payment you recorded' using errcode = '42501';
  end if;
  update public.payments set status = 'rejected' where id = pay.id;
  insert into public.payment_verifications (payment_id, decided_by, decision, notes)
  values (pay.id, actor.id, 'rejected', btrim(p_notes));
  perform public.write_audit(
    actor.id, actor.role, 'PAYMENT_REJECTED', 'payment', pay.id,
    'pending', 'rejected',
    jsonb_build_object('reason', btrim(p_notes))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Vendor / fulfillment
-- ---------------------------------------------------------------------------

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
begin
  actor := public.require_permission('orders.send_to_vendor');
  select * into o from public.orders where id = p_order_id;
  if o.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  perform public.assert_transition(o.status, 'sent_to_vendor');

  insert into public.vendor_orders (
    order_id, vendor_id, status, sent_at, expected_delivery_at, created_by
  ) values (
    o.id, p_vendor_id, 'sent', now(), p_expected_delivery, actor.id
  ) returning id into vid;

  for item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.vendor_order_items (vendor_order_id, order_item_id, quantity)
    values (
      vid,
      (item ->> 'order_item_id')::uuid,
      (item ->> 'quantity')::numeric
    );
  end loop;

  perform public.allow_status();
  update public.orders set status = 'sent_to_vendor' where id = o.id;
  perform public.write_audit(
    actor.id, actor.role, 'ORDER_SENT_TO_VENDOR', 'order', o.id,
    o.status::text, 'sent_to_vendor',
    jsonb_build_object('vendor_order_id', vid, 'vendor_id', p_vendor_id)
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
  select * into o from public.orders where id = vo.order_id;
  perform public.assert_transition(o.status, 'vendor_dispatched');
  update public.vendor_orders
    set status = 'dispatched', dispatched_at = now()
    where id = vo.id;
  perform public.allow_status();
  update public.orders set status = 'vendor_dispatched' where id = o.id;
  perform public.write_audit(
    actor.id, actor.role, 'VENDOR_DISPATCHED', 'order', o.id,
    o.status::text, 'vendor_dispatched',
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
  bal public.balance_snapshot;
  gate public.workflow_status;
begin
  actor := public.require_permission('fulfillment.update');
  select * into vo from public.vendor_orders where id = p_vendor_order_id;
  if vo.id is null then
    raise exception 'Vendor order not found' using errcode = 'P0002';
  end if;
  select * into o from public.orders where id = vo.order_id;
  perform public.assert_transition(o.status, 'items_received');

  for rec in select value from jsonb_array_elements(p_received)
  loop
    oi_id := (rec ->> 'order_item_id')::uuid;
    qty := (rec ->> 'quantity')::numeric;
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
  update public.orders set status = 'items_received' where id = o.id;
  perform public.write_audit(
    actor.id, actor.role, 'ITEMS_RECEIVED', 'order', o.id,
    o.status::text, 'items_received',
    jsonb_build_object('vendor_order_id', vo.id)
  );

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
  if bal.outstanding > 0 then
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

  perform public.assert_transition('delivered', 'closed');
  update public.orders set status = 'closed' where id = o.id;
  perform public.write_audit(
    actor.id, actor.role, 'ORDER_CLOSED', 'order', o.id,
    'delivered', 'closed', '{}'::jsonb
  );
end;
$$;

create or replace function public.admin_set_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
begin
  actor := public.require_permission('admin.manage');
  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  perform public.write_audit(
    actor.id, actor.role, 'ROLE_CHANGED', 'profile', p_user_id,
    null, p_role::text, '{}'::jsonb
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: mutations go through RPCs
-- ---------------------------------------------------------------------------

grant execute on function public.create_quote(uuid, jsonb, text) to authenticated;
grant execute on function public.submit_quote(uuid) to authenticated;
grant execute on function public.approve_quote(uuid) to authenticated;
grant execute on function public.reject_quote(uuid, text) to authenticated;
grant execute on function public.revise_quote(uuid, jsonb, text) to authenticated;
grant execute on function public.send_quote_to_customer(uuid) to authenticated;
grant execute on function public.record_payment(uuid, public.payment_kind, numeric, public.payment_method, text, date, text) to authenticated;
grant execute on function public.verify_payment(uuid, text) to authenticated;
grant execute on function public.reject_payment(uuid, text) to authenticated;
grant execute on function public.send_order_to_vendor(uuid, uuid, jsonb, date) to authenticated;
grant execute on function public.mark_vendor_dispatched(uuid) to authenticated;
grant execute on function public.record_items_received(uuid, jsonb) to authenticated;
grant execute on function public.complete_delivery(uuid, text) to authenticated;
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;
grant execute on function public.quote_balance(uuid) to authenticated;
grant execute on function public.order_balance(uuid) to authenticated;

revoke all on function public.write_audit(uuid, public.app_role, text, text, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.write_audit(uuid, public.app_role, text, text, uuid, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'admin', false)
$$;

create or replace function public.is_accounts()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() in ('accounts', 'admin'), false)
$$;

-- Profiles: directory readable; role changes only via admin_set_role
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

-- Customers / leads
create policy customers_select on public.customers
  for select to authenticated
  using (
    public.is_admin()
    or public.is_accounts()
    or created_by = auth.uid()
    or exists (
      select 1 from public.orders o
      where o.customer_id = customers.id
    )
  );

create policy customers_insert on public.customers
  for insert to authenticated
  with check (public.has_permission('customers.write') and created_by = auth.uid());

create policy customers_update on public.customers
  for update to authenticated
  using (public.has_permission('customers.write') and (created_by = auth.uid() or public.is_admin()))
  with check (public.has_permission('customers.write'));

create policy leads_select on public.leads
  for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = leads.customer_id
    )
  );

create policy leads_write on public.leads
  for all to authenticated
  using (public.has_permission('customers.write'))
  with check (public.has_permission('customers.write'));

-- Catalog
create policy materials_select on public.materials
  for select to authenticated using (true);
create policy material_categories_select on public.material_categories
  for select to authenticated using (true);
create policy materials_admin_write on public.materials
  for all to authenticated
  using (public.has_permission('admin.manage'))
  with check (public.has_permission('admin.manage'));
create policy material_categories_admin_write on public.material_categories
  for all to authenticated
  using (public.has_permission('admin.manage'))
  with check (public.has_permission('admin.manage'));

create policy vendors_select on public.vendors
  for select to authenticated
  using (
    public.has_permission('orders.send_to_vendor')
    or public.has_permission('fulfillment.update')
    or public.is_admin()
    or public.has_permission('orders.read')
  );
create policy vendors_write on public.vendors
  for all to authenticated
  using (public.has_permission('orders.send_to_vendor') or public.is_admin())
  with check (public.has_permission('orders.send_to_vendor') or public.is_admin());

-- Quotes (read); writes via RPC (table owner bypasses RLS? SECURITY DEFINER runs as owner so RLS skipped for table owner postgres)
create policy quotes_select on public.quotes
  for select to authenticated
  using (
    public.is_admin()
    or public.is_accounts()
    or created_by = auth.uid()
  );

create policy quote_versions_select on public.quote_versions
  for select to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_versions.quote_id
        and (
          public.is_admin() or public.is_accounts() or q.created_by = auth.uid()
        )
    )
  );

create policy quote_items_select on public.quote_items
  for select to authenticated
  using (
    exists (
      select 1 from public.quote_versions v
      join public.quotes q on q.id = v.quote_id
      where v.id = quote_items.version_id
        and (public.is_admin() or public.is_accounts() or q.created_by = auth.uid())
    )
  );

create policy quote_approvals_select on public.quote_approvals
  for select to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_approvals.quote_id
        and (public.is_admin() or public.is_accounts() or q.created_by = auth.uid())
    )
  );

-- Orders
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
        'items_received', 'delivery_pending_payment', 'order_on_hold',
        'delivery_unlocked', 'delivered', 'closed'
      )
    )
  );

create policy order_items_select on public.order_items
  for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_items.order_id)
  );

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
  );

create policy payment_verifications_select on public.payment_verifications
  for select to authenticated
  using (
    public.is_admin()
    or public.is_accounts()
    or exists (
      select 1 from public.payments p
      where p.id = payment_verifications.payment_id and p.recorded_by = auth.uid()
    )
  );

create policy vendor_orders_select on public.vendor_orders
  for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = vendor_orders.order_id)
  );

create policy vendor_order_items_select on public.vendor_order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.vendor_orders vo
      where vo.id = vendor_order_items.vendor_order_id
    )
  );

create policy deliveries_select on public.deliveries
  for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = deliveries.order_id)
  );

create policy delivery_items_select on public.delivery_items
  for select to authenticated
  using (
    exists (select 1 from public.deliveries d where d.id = delivery_items.delivery_id)
  );

create policy attachments_select on public.attachments
  for select to authenticated
  using (uploaded_by = auth.uid() or public.is_admin() or public.is_accounts());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Block authenticated writes on workflow tables (RPCs are table owner)
revoke insert, update, delete on public.quotes from authenticated, anon;
revoke insert, update, delete on public.quote_versions from authenticated, anon;
revoke insert, update, delete on public.quote_items from authenticated, anon;
revoke insert, update, delete on public.quote_approvals from authenticated, anon;
revoke insert, update, delete on public.orders from authenticated, anon;
revoke insert, update, delete on public.order_items from authenticated, anon;
revoke insert, update, delete on public.payments from authenticated, anon;
revoke insert, update, delete on public.payment_verifications from authenticated, anon;
revoke insert, update, delete on public.vendor_orders from authenticated, anon;
revoke insert, update, delete on public.vendor_order_items from authenticated, anon;
revoke insert, update, delete on public.deliveries from authenticated, anon;
revoke insert, update, delete on public.delivery_items from authenticated, anon;
revoke insert, update, delete on public.audit_logs from authenticated, anon;
revoke insert, update, delete on public.workflow_transitions from authenticated, anon;

grant select on public.quotes, public.quote_versions, public.quote_items,
  public.quote_approvals, public.orders, public.order_items, public.payments,
  public.payment_verifications, public.vendor_orders, public.vendor_order_items,
  public.deliveries, public.delivery_items, public.workflow_transitions
  to authenticated;

grant select on public.audit_logs to authenticated;
grant insert, update, delete on public.customers, public.leads to authenticated;
grant insert, update, delete on public.materials, public.material_categories to authenticated;
grant insert, update, delete on public.vendors to authenticated;
grant select, update on public.notifications to authenticated;
grant select, update on public.profiles to authenticated;
