-- Shared sales floor book: any sales hat can see colleagues' customers,
-- quotes, and orders, and pick up a walk-in (submit / revise / send).

create or replace function public.can_read_quote(p_quote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quotes q
    where q.id = p_quote_id
      and (
        public.is_admin()
        or public.is_accounts()
        or public.has_role('sales')
        or q.created_by = auth.uid()
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
        or public.has_role('sales')
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

create or replace function public.can_view_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_read_order(p_order_id)
$$;

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select to authenticated
  using (
    public.is_admin()
    or public.is_accounts()
    or public.has_role('sales')
    or created_by = auth.uid()
    or exists (
      select 1 from public.orders o
      where o.customer_id = customers.id
    )
  );

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update to authenticated
  using (public.has_permission('customers.write'))
  with check (public.has_permission('customers.write'));

drop policy if exists quotes_select on public.quotes;
create policy quotes_select on public.quotes
  for select to authenticated
  using (public.can_read_quote(id));

drop policy if exists quote_versions_select on public.quote_versions;
create policy quote_versions_select on public.quote_versions
  for select to authenticated
  using (public.can_read_quote(quote_id));

drop policy if exists quote_items_select on public.quote_items;
create policy quote_items_select on public.quote_items
  for select to authenticated
  using (
    exists (
      select 1 from public.quote_versions v
      where v.id = quote_items.version_id
        and public.can_read_quote(v.quote_id)
    )
  );

drop policy if exists quote_approvals_select on public.quote_approvals;
create policy quote_approvals_select on public.quote_approvals
  for select to authenticated
  using (public.can_read_quote(quote_id));

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated
  using (public.can_read_order(id));

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
  if q.status not in ('quote_draft', 'quote_rejected', 'quote_approved') then
    raise exception 'This quote cannot be edited now' using errcode = 'P0001';
  end if;

  if q.status = 'quote_draft' then
    vid := q.current_version_id;
    delete from public.quote_items where version_id = vid;
    perform public.insert_quote_items(vid, p_items);
    perform public.recalc_version_totals(vid);
    update public.quote_versions
      set notes = p_notes
      where id = vid;
    update public.quotes
      set updated_at = now()
      where id = q.id;
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
  perform public.assert_transition(q.status, 'quote_sent_to_customer');
  perform public.allow_status();
  update public.quotes
    set status = 'quote_sent_to_customer', sent_at = now()
    where id = q.id;
  update public.quote_versions
    set status = 'quote_sent_to_customer'
    where id = q.current_version_id;

  insert into public.orders (quote_id, customer_id, assigned_sales_id, status)
  values (q.id, q.customer_id, actor.id, 'quote_sent_to_customer')
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

create or replace function public.log_quote_whatsapp_share(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  q public.quotes;
begin
  actor := public.require_permission('quotes.send_to_customer');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.status not in ('quote_approved', 'quote_sent_to_customer') then
    raise exception 'Only approved or sent quotes can be shared with the customer' using errcode = 'P0001';
  end if;

  perform public.write_audit(
    actor.id,
    actor.role,
    'QUOTE_SHARED_VIA_WHATSAPP',
    'quote',
    q.id,
    q.status::text,
    q.status::text,
    '{}'::jsonb
  );
end;
$$;
