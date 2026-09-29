-- One material can be supplied by many vendors, each at its own price.
-- The usual supplier is the one pre-selected when a job is sent out.

create table public.material_vendors (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  unique (material_id, vendor_id)
);

create unique index material_vendors_one_preferred
  on public.material_vendors (material_id)
  where is_preferred;

create index material_vendors_vendor_idx on public.material_vendors (vendor_id);

alter table public.material_vendors enable row level security;

create policy material_vendors_select on public.material_vendors
  for select to authenticated
  using (true);

create policy material_vendors_write on public.material_vendors
  for all to authenticated
  using (
    public.has_permission('admin.manage')
    or public.has_permission('catalog.manage')
  )
  with check (
    public.has_permission('admin.manage')
    or public.has_permission('catalog.manage')
  );

grant select, insert, update, delete on public.material_vendors to authenticated;
