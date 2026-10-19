-- Sales can add and edit materials the same way Operations does on the
-- Materials screen: catalogue, hide/show, CSV import, office quantity,
-- and vendor prices. Vendors and Company stay on catalog.manage.

insert into public.permissions (slug, description)
values (
  'materials.manage',
  'Add and edit materials, office quantity, and vendor prices'
)
on conflict (slug) do nothing;

insert into public.role_permissions (role, permission)
values ('sales', 'materials.manage')
on conflict do nothing;

drop policy if exists materials_admin_write on public.materials;
create policy materials_admin_write on public.materials
  for all to authenticated
  using (
    public.has_permission('admin.manage')
    or public.has_permission('catalog.manage')
    or public.has_permission('materials.manage')
  )
  with check (
    public.has_permission('admin.manage')
    or public.has_permission('catalog.manage')
    or public.has_permission('materials.manage')
  );

drop policy if exists material_categories_admin_write on public.material_categories;
create policy material_categories_admin_write on public.material_categories
  for all to authenticated
  using (
    public.has_permission('admin.manage')
    or public.has_permission('catalog.manage')
    or public.has_permission('materials.manage')
  )
  with check (
    public.has_permission('admin.manage')
    or public.has_permission('catalog.manage')
    or public.has_permission('materials.manage')
  );

drop policy if exists material_vendors_write on public.material_vendors;
create policy material_vendors_write on public.material_vendors
  for all to authenticated
  using (
    public.has_permission('admin.manage')
    or public.has_permission('catalog.manage')
    or public.has_permission('materials.manage')
  )
  with check (
    public.has_permission('admin.manage')
    or public.has_permission('catalog.manage')
    or public.has_permission('materials.manage')
  );

-- A new supplier typed on the material form is inserted here.
-- Editing the vendor directory stays with send-to-vendor and admin.
drop policy if exists vendors_insert_from_materials on public.vendors;
create policy vendors_insert_from_materials on public.vendors
  for insert to authenticated
  with check (public.has_permission('materials.manage'));

create or replace function public.adjust_office_stock(
  p_material_id uuid,
  p_delta numeric,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  on_hand numeric;
  reserved numeric;
begin
  actor := public.require_any_permission(array['stock.adjust', 'materials.manage']);
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'Enter a quantity change' using errcode = '22023';
  end if;
  perform 1 from public.materials where id = p_material_id for update;
  if not found then
    raise exception 'Material not found' using errcode = 'P0002';
  end if;
  on_hand := public.material_on_hand(p_material_id);
  reserved := public.material_reserved(p_material_id);
  if on_hand + p_delta < reserved then
    raise exception 'That would drop on-hand below the quantity already reserved'
      using errcode = 'P0001';
  end if;
  insert into public.stock_movements (
    material_id, kind, quantity, reason, created_by
  ) values (
    p_material_id, 'adjustment', p_delta, trim(p_reason), actor.id
  );
  perform public.write_audit(
    actor.id, actor.role, 'STOCK_ADJUSTED', 'material', p_material_id,
    null, null, jsonb_build_object('delta', p_delta, 'reason', trim(p_reason))
  );
end;
$$;
