-- Credit delivery activates the order; vendor pay can take bill ref; Operations can manage staff.

alter table public.company_settings
  add column if not exists bank_name text,
  add column if not exists bank_account text,
  add column if not exists bank_ifsc text,
  add column if not exists upi_id text;

insert into public.workflow_transitions (from_status, to_status)
values ('quote_sent_to_customer', 'order_active')
on conflict (from_status, to_status) do nothing;

create or replace function public.require_any_permission(required text[])
returns public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor public.profiles;
begin
  if required is null or cardinality(required) = 0 then
    raise exception 'Permission required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from unnest(required) as slug
    where public.has_permission(slug)
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or not actor.is_active then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return actor;
end;
$$;

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
  actor := public.require_any_permission(array['admin.manage', 'staff.manage']);

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
    if p_role is not null and p_role is distinct from 'admin' then
      raise exception 'Cannot change the last admin role' using errcode = '42501';
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
  actor := public.require_any_permission(array['admin.manage', 'staff.manage']);
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
    raise exception 'Cannot remove the last admin' using errcode = '42501';
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

create or replace function public.decide_credit_delivery(p_order_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  o public.orders;
  next_status public.workflow_status;
  received boolean;
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

  if not p_approve then
    return;
  end if;

  received := public.order_items_fully_received(o.id);
  if o.status in ('quote_sent_to_customer', 'payment_pending_verification') then
    next_status := 'order_active';
  elsif o.status in ('delivery_pending_payment', 'order_on_hold')
     or (o.status = 'items_received' and received) then
    next_status := 'delivery_unlocked';
  else
    next_status := o.status;
  end if;

  if next_status is distinct from o.status then
    perform public.assert_transition(o.status, next_status);
    perform public.allow_status();
    update public.orders
      set status = next_status,
          activated_at = coalesce(activated_at, now()),
          on_hold_reason = null
      where id = o.id;
    perform public.write_audit(
      actor.id, actor.role,
      case when next_status = 'order_active' then 'ORDER_ACTIVATED' else 'DELIVERY_UNLOCKED' end,
      'order', o.id,
      o.status::text, next_status::text,
      jsonb_build_object('credit_delivery', 'approved')
    );
  elsif o.activated_at is null then
    update public.orders set activated_at = now() where id = o.id;
  end if;
end;
$$;

drop function if exists public.record_vendor_payment(uuid, numeric, text, text);

create or replace function public.record_vendor_payment(
  p_vendor_order_id uuid,
  p_amount numeric,
  p_method text default null,
  p_reference text default null,
  p_bill_ref text default null
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
  if p_bill_ref is not null and length(trim(p_bill_ref)) > 0 then
    update public.vendor_orders
      set bill_ref = trim(p_bill_ref),
          bill_amount = coalesce(bill_amount, p_amount),
          payable_amount = coalesce(payable_amount, p_amount)
      where id = p_vendor_order_id;
  end if;
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

grant execute on function public.require_any_permission(text[]) to authenticated;
grant execute on function public.record_vendor_payment(uuid, numeric, text, text, text) to authenticated;

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
  salesman text;
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
  select p.full_name into salesman from public.profiles p where p.id = q.created_by;

  return jsonb_build_object(
    'quote_number', q.quote_number,
    'warranty_months', v.warranty_months,
    'include_amc', v.include_amc,
    'amc_months', v.amc_months,
    'salesman', salesman,
    'company', jsonb_build_object(
      'legal_name', coalesce(company.legal_name, 'Nuhome'),
      'gstin', company.gstin,
      'address', company.address,
      'phone', company.phone,
      'email', company.email,
      'bank_name', company.bank_name,
      'bank_account', company.bank_account,
      'bank_ifsc', company.bank_ifsc,
      'upi_id', company.upi_id
    ),
    'customer', (
      select jsonb_build_object(
        'name', c.name,
        'phone', c.phone,
        'address', coalesce(c.billing_address, c.address),
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
            'specification', qi.specification,
            'item_code', qi.item_code,
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

do $$
declare r record;
begin
  for r in
    select id from public.orders
    where credit_delivery_status = 'approved'
      and status in ('quote_sent_to_customer', 'payment_pending_verification')
  loop
    perform public.allow_status();
    update public.orders
      set status = 'order_active',
          activated_at = coalesce(activated_at, now())
      where id = r.id;
  end loop;
end $$;

