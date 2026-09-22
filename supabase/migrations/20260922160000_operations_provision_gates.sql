-- Let Operations use catalog.manage / staff.manage / reports.read end-to-end.
-- App gates already allow these; RLS and RPCs were still Admin-only.

drop policy if exists materials_admin_write on public.materials;
create policy materials_admin_write on public.materials
  for all to authenticated
  using (
    public.has_permission('admin.manage')
    or public.has_permission('catalog.manage')
  )
  with check (
    public.has_permission('admin.manage')
    or public.has_permission('catalog.manage')
  );

drop policy if exists material_categories_admin_write on public.material_categories;
create policy material_categories_admin_write on public.material_categories
  for all to authenticated
  using (
    public.has_permission('admin.manage')
    or public.has_permission('catalog.manage')
  )
  with check (
    public.has_permission('admin.manage')
    or public.has_permission('catalog.manage')
  );

drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated
  using (
    public.has_permission('admin.manage')
    or public.has_permission('reports.read')
  );

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
  actor := public.require_any_permission(array['admin.manage', 'staff.manage']);
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
  actor := public.require_any_permission(array['admin.manage', 'staff.manage']);
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
      and status not in ('quote_sent_to_customer');
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
