-- Staff ops: extra roles, vendor contacts, sales cover, payment hats.

create table if not exists public.profile_roles (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  primary key (profile_id, role)
);

insert into public.profile_roles (profile_id, role)
select id, role from public.profiles
on conflict do nothing;

alter table public.profile_roles enable row level security;

drop policy if exists profile_roles_select on public.profile_roles;
create policy profile_roles_select on public.profile_roles
  for select to authenticated
  using (true);

create table if not exists public.vendor_contacts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists vendor_contacts_vendor_idx on public.vendor_contacts (vendor_id);

alter table public.vendor_contacts enable row level security;

drop policy if exists vendor_contacts_select on public.vendor_contacts;
create policy vendor_contacts_select on public.vendor_contacts
  for select to authenticated
  using (
    exists (select 1 from public.vendors v where v.id = vendor_contacts.vendor_id)
  );

drop policy if exists vendor_contacts_write on public.vendor_contacts;
create policy vendor_contacts_write on public.vendor_contacts
  for all to authenticated
  using (public.has_permission('orders.send_to_vendor') or public.is_admin())
  with check (public.has_permission('orders.send_to_vendor') or public.is_admin());

create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_roles pr
    join public.profiles p on p.id = pr.profile_id
    where pr.profile_id = auth.uid()
      and pr.role = p_role
      and p.is_active
  )
$$;

create or replace function public.user_has_role(p_user_id uuid, p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_roles pr
    join public.profiles p on p.id = pr.profile_id
    where pr.profile_id = p_user_id
      and pr.role = p_role
      and p.is_active
  )
$$;

create or replace function public.has_permission(required text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.profile_roles pr on pr.profile_id = p.id
    join public.role_permissions rp on rp.role = pr.role
    where p.id = auth.uid()
      and p.is_active
      and rp.permission = required
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.has_role('admin'), false)
$$;

create or replace function public.is_accounts()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.has_role('accounts') or public.has_role('admin'), false)
$$;

create or replace function public.admin_set_profile_roles(
  p_user_id uuid,
  p_roles public.app_role[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  target public.profiles;
  admin_count int;
  unique_roles public.app_role[];
begin
  actor := public.require_permission('admin.manage');
  select * into target from public.profiles where id = p_user_id;
  if target.id is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  if p_roles is null or cardinality(p_roles) = 0 then
    raise exception 'Choose at least one role' using errcode = '22023';
  end if;

  select array(select distinct unnest(p_roles) order by 1) into unique_roles;
  if not (target.role = any (unique_roles)) then
    unique_roles := array_append(unique_roles, target.role);
  end if;

  select count(distinct p.id) into admin_count
  from public.profiles p
  join public.profile_roles pr on pr.profile_id = p.id
  where pr.role = 'admin' and p.is_active;

  if public.user_has_role(p_user_id, 'admin')
     and not ('admin' = any (unique_roles))
     and admin_count <= 1 then
    raise exception 'Cannot remove the last admin role' using errcode = '42501';
  end if;

  delete from public.profile_roles where profile_id = p_user_id;
  insert into public.profile_roles (profile_id, role)
  select p_user_id, r from unnest(unique_roles) as r
  on conflict do nothing;

  perform public.write_audit(
    actor.id, actor.role, 'ROLE_CHANGED', 'profile', p_user_id,
    target.role::text, target.role::text,
    jsonb_build_object('roles', unique_roles)
  );
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role := 'sales';
  v_meta_role text;
begin
  v_meta_role := lower(coalesce(new.raw_user_meta_data ->> 'role', ''));
  if v_meta_role in ('sales', 'accounts', 'procurement', 'store', 'admin') then
    v_role := v_meta_role::public.app_role;
  end if;

  insert into public.profiles (id, full_name, role, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    v_role,
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);

  insert into public.profile_roles (profile_id, role)
  values (new.id, v_role)
  on conflict do nothing;

  return new;
end;
$$;

create or replace function public.notify_role(
  p_role public.app_role,
  p_type text,
  p_title text,
  p_body text,
  p_payload jsonb default '{}'::jsonb,
  p_except_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  for rec in
    select distinct p.id
    from public.profiles p
    join public.profile_roles pr on pr.profile_id = p.id
    where pr.role = p_role
      and p.is_active
      and p.id is distinct from p_except_user_id
  loop
    perform public.notify_user(rec.id, p_type, p_title, p_body, p_payload);
  end loop;
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
      and status not in ('quote_sent_to_customer');
  get diagnostics quotes_moved = row_count;

  update public.orders
    set assigned_sales_id = p_to_user_id
    where assigned_sales_id = p_from_user_id
      and status not in ('delivered', 'closed');
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
  if o.status in ('delivered', 'closed') then
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

create or replace function public.sync_primary_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile_roles (profile_id, role)
  values (new.id, new.role)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_sync_primary_role on public.profiles;
create trigger profiles_sync_primary_role
  after insert or update of role on public.profiles
  for each row execute function public.sync_primary_profile_role();

create or replace function public.admin_update_user(
  p_user_id uuid,
  p_full_name text default null,
  p_phone text default null,
  p_role public.app_role default null,
  p_is_active boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  target public.profiles;
  admin_count int;
begin
  actor := public.require_permission('admin.manage');

  select * into target from public.profiles where id = p_user_id;
  if target.id is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  if p_user_id = actor.id and p_is_active is false then
    raise exception 'You cannot deactivate your own account' using errcode = '42501';
  end if;

  select count(distinct p.id) into admin_count
  from public.profiles p
  join public.profile_roles pr on pr.profile_id = p.id
  where pr.role = 'admin' and p.is_active;

  if public.user_has_role(p_user_id, 'admin') and admin_count <= 1 then
    if p_is_active is false then
      raise exception 'Cannot deactivate the last admin' using errcode = '42501';
    end if;
  end if;

  update public.profiles
  set
    full_name = coalesce(nullif(btrim(p_full_name), ''), full_name),
    phone = case when p_phone is null then phone else nullif(btrim(p_phone), '') end,
    role = coalesce(p_role, role),
    is_active = coalesce(p_is_active, is_active)
  where id = p_user_id;

  if p_role is not null and p_role is distinct from target.role then
    perform public.write_audit(
      actor.id, actor.role, 'ROLE_CHANGED', 'profile', p_user_id,
      target.role::text, p_role::text, '{}'::jsonb
    );
  end if;

  if p_is_active is not null and p_is_active is distinct from target.is_active then
    perform public.write_audit(
      actor.id, actor.role, 'PROFILE_UPDATED', 'profile', p_user_id,
      case when target.is_active then 'active' else 'inactive' end,
      case when p_is_active then 'active' else 'inactive' end,
      '{}'::jsonb
    );
  end if;
end;
$$;

grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.user_has_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_set_profile_roles(uuid, public.app_role[]) to authenticated;
grant execute on function public.reassign_sales_cover(uuid, uuid) to authenticated;
grant execute on function public.reassign_order_sales(uuid, uuid) to authenticated;
grant select on public.profile_roles to authenticated;
grant select, insert, update, delete on public.vendor_contacts to authenticated;
