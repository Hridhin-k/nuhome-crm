-- Admin catalog: store email on profiles, allow admins to update staff,
-- and copy role from auth metadata when a user is created.

alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');

create unique index if not exists profiles_email_lower_idx
  on public.profiles (lower(email))
  where email is not null;

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

  return new;
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
  actor := public.require_permission('admin.manage');

  select * into target from public.profiles where id = p_user_id;
  if target.id is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  if p_user_id = actor.id and p_is_active is false then
    raise exception 'You cannot deactivate your own account' using errcode = '42501';
  end if;

  select count(*) into admin_count
  from public.profiles
  where role = 'admin' and is_active;

  if target.role = 'admin' and admin_count <= 1 then
    if p_role is not null and p_role <> 'admin' then
      raise exception 'Cannot change the last admin''s role' using errcode = '42501';
    end if;
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

create or replace function public.admin_set_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_update_user(p_user_id, null, null, p_role, null);
end;
$$;

grant execute on function public.admin_update_user(uuid, text, text, public.app_role, boolean) to authenticated;
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;
