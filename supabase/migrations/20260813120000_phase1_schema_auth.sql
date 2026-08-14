-- Phase 1: core schema, roles, profiles, auth trigger, RLS baseline.
-- Applied only to the nuhome-crm project.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.app_role as enum (
  'sales',
  'accounts',
  'procurement',
  'store',
  'admin'
);

create type public.customer_kind as enum ('lead', 'customer');

create type public.quote_status as enum (
  'draft',
  'pending_accounts',
  'rejected',
  'approved',
  'sent_to_customer'
);

create type public.order_status as enum (
  'quote_sent_to_customer',
  'payment_pending_verification',
  'order_active',
  'sent_to_vendor',
  'vendor_dispatched',
  'items_received',
  'delivery_pending_payment',
  'order_on_hold',
  'delivery_unlocked',
  'delivered',
  'closed'
);

create type public.payment_kind as enum ('advance', 'full', 'nil');

create type public.payment_status as enum ('pending', 'verified', 'rejected');

create type public.payment_method as enum (
  'cash',
  'upi',
  'bank_transfer',
  'cheque',
  'card',
  'other'
);

create type public.approval_decision as enum ('approved', 'rejected');

-- ---------------------------------------------------------------------------
-- Utility
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auth / RBAC
-- ---------------------------------------------------------------------------

create table public.roles (
  slug public.app_role primary key,
  name text not null,
  description text
);

create table public.permissions (
  slug text primary key,
  description text not null
);

create table public.role_permissions (
  role public.app_role not null references public.roles (slug) on delete cascade,
  permission text not null references public.permissions (slug) on delete cascade,
  primary key (role, permission)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  role public.app_role not null default 'sales',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'sales'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, full_name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  'sales'
from auth.users u
on conflict (id) do nothing;

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
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
    join public.role_permissions rp on rp.role = p.role
    where p.id = auth.uid()
      and p.is_active
      and rp.permission = required
  )
$$;

-- ---------------------------------------------------------------------------
-- Catalog / parties
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  kind public.customer_kind not null default 'lead',
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_phone_idx on public.customers (phone);
create index customers_created_by_idx on public.customers (created_by);

create trigger customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers (id) on delete cascade,
  source text,
  assigned_to uuid references public.profiles (id),
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create table public.material_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.material_categories (id),
  sku text unique,
  name text not null,
  unit text not null default 'pcs',
  default_sell_price numeric(12, 2) not null default 0,
  default_cost numeric(12, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger materials_updated_at
before update on public.materials
for each row execute function public.set_updated_at();

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger vendors_updated_at
before update on public.vendors
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Quotes
-- ---------------------------------------------------------------------------

create sequence public.quote_number_seq start 1001;

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  customer_id uuid not null references public.customers (id),
  created_by uuid not null references public.profiles (id),
  status public.quote_status not null default 'draft',
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger quotes_updated_at
before update on public.quotes
for each row execute function public.set_updated_at();

create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  created_by uuid not null references public.profiles (id),
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  margin_amount numeric(12, 2),
  notes text,
  status public.quote_status not null default 'draft',
  rejection_reason text,
  created_at timestamptz not null default now(),
  unique (quote_id, version_number)
);

alter table public.quotes
  add constraint quotes_current_version_fk
  foreign key (current_version_id) references public.quote_versions (id);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.quote_versions (id) on delete cascade,
  material_id uuid references public.materials (id),
  description text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(12, 2) not null,
  unit_cost numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null,
  sort_order integer not null default 0
);

create table public.quote_approvals (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  version_id uuid not null references public.quote_versions (id) on delete cascade,
  decided_by uuid not null references public.profiles (id),
  decision public.approval_decision not null,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Orders / payments / fulfillment
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes (id),
  customer_id uuid not null references public.customers (id),
  assigned_sales_id uuid references public.profiles (id),
  status public.order_status not null default 'quote_sent_to_customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_status_idx on public.orders (status);
create index orders_sales_idx on public.orders (assigned_sales_id);

create trigger orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  quote_item_id uuid references public.quote_items (id),
  material_id uuid references public.materials (id),
  description text not null,
  quantity numeric(12, 3) not null,
  quantity_received numeric(12, 3) not null default 0
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id),
  order_id uuid references public.orders (id),
  kind public.payment_kind not null,
  method public.payment_method,
  amount numeric(12, 2) not null,
  reference_number text,
  paid_at date not null default current_date,
  recorded_by uuid not null references public.profiles (id),
  status public.payment_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_matches_kind check (
    (kind = 'nil' and amount = 0)
    or (kind in ('advance', 'full') and amount > 0)
  )
);

create trigger payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create table public.payment_verifications (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  decided_by uuid not null references public.profiles (id),
  decision public.payment_status not null check (decision in ('verified', 'rejected')),
  notes text,
  created_at timestamptz not null default now()
);

create table public.vendor_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id),
  status text not null default 'draft',
  sent_at timestamptz,
  dispatched_at timestamptz,
  received_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger vendor_orders_updated_at
before update on public.vendor_orders
for each row execute function public.set_updated_at();

create table public.vendor_order_items (
  id uuid primary key default gen_random_uuid(),
  vendor_order_id uuid not null references public.vendor_orders (id) on delete cascade,
  order_item_id uuid references public.order_items (id),
  quantity numeric(12, 3) not null
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id),
  delivered_by uuid references public.profiles (id),
  delivered_at timestamptz,
  proof_path text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id),
  quantity numeric(12, 3) not null
);

create table public.order_status_transitions (
  from_status public.order_status not null,
  to_status public.order_status not null,
  primary key (from_status, to_status)
);

create table public.quote_status_transitions (
  from_status public.quote_status not null,
  to_status public.quote_status not null,
  primary key (from_status, to_status)
);

-- ---------------------------------------------------------------------------
-- Audit / files / notifications
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  actor_role public.app_role,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_state text,
  new_state text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  storage_path text not null,
  file_name text,
  mime_type text,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Computed outstanding
-- ---------------------------------------------------------------------------

create or replace function public.quote_outstanding(p_quote_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(
    (
      select qv.total
      from public.quotes q
      join public.quote_versions qv on qv.id = q.current_version_id
      where q.id = p_quote_id
    ),
    0
  ) - coalesce(
    (
      select sum(p.amount)
      from public.payments p
      where p.quote_id = p_quote_id
        and p.status = 'verified'
    ),
    0
  )
$$;

create or replace function public.order_outstanding(p_order_id uuid)
returns numeric
language sql
stable
as $$
  select public.quote_outstanding(o.quote_id)
  from public.orders o
  where o.id = p_order_id
$$;

-- ---------------------------------------------------------------------------
-- Seed RBAC + transitions
-- ---------------------------------------------------------------------------

insert into public.roles (slug, name, description) values
  ('sales', 'Sales Executive', 'Customers, quotes, payment recording'),
  ('accounts', 'Accounts', 'Quote approval and payment verification'),
  ('procurement', 'Procurement', 'Vendors and fulfillment'),
  ('store', 'Store / Delivery', 'Receipt and delivery'),
  ('admin', 'Admin', 'Users, catalog, audit');

insert into public.permissions (slug, description) values
  ('customers.read', 'View customers'),
  ('customers.write', 'Create and update customers'),
  ('quotes.create', 'Create quotes'),
  ('quotes.revise', 'Revise rejected quotes'),
  ('quotes.submit', 'Submit quotes to accounts'),
  ('quotes.approve', 'Approve quotes'),
  ('quotes.reject', 'Reject quotes'),
  ('quotes.send_to_customer', 'Send approved quotes'),
  ('quotes.read_margin', 'View margin'),
  ('payments.record', 'Record customer payments'),
  ('payments.verify', 'Verify payments'),
  ('orders.read', 'View orders'),
  ('orders.send_to_vendor', 'Send orders to vendors'),
  ('fulfillment.update', 'Update vendor fulfillment'),
  ('deliveries.complete', 'Complete delivery'),
  ('admin.manage', 'Manage users and settings');

insert into public.role_permissions (role, permission)
select 'sales', slug from public.permissions
where slug in (
  'customers.read', 'customers.write',
  'quotes.create', 'quotes.revise', 'quotes.submit', 'quotes.send_to_customer',
  'payments.record', 'orders.read'
);

insert into public.role_permissions (role, permission)
select 'accounts', slug from public.permissions
where slug in (
  'customers.read', 'quotes.approve', 'quotes.reject', 'quotes.read_margin',
  'payments.verify', 'orders.read'
);

insert into public.role_permissions (role, permission)
select 'procurement', slug from public.permissions
where slug in (
  'customers.read', 'orders.read', 'orders.send_to_vendor', 'fulfillment.update'
);

insert into public.role_permissions (role, permission)
select 'store', slug from public.permissions
where slug in ('customers.read', 'orders.read', 'fulfillment.update', 'deliveries.complete');

insert into public.role_permissions (role, permission)
select 'admin', slug from public.permissions;

insert into public.quote_status_transitions (from_status, to_status) values
  ('draft', 'pending_accounts'),
  ('pending_accounts', 'approved'),
  ('pending_accounts', 'rejected'),
  ('rejected', 'draft'),
  ('approved', 'sent_to_customer');

insert into public.order_status_transitions (from_status, to_status) values
  ('quote_sent_to_customer', 'payment_pending_verification'),
  ('payment_pending_verification', 'order_active'),
  ('order_active', 'sent_to_vendor'),
  ('sent_to_vendor', 'vendor_dispatched'),
  ('vendor_dispatched', 'items_received'),
  ('items_received', 'delivery_pending_payment'),
  ('delivery_pending_payment', 'delivery_unlocked'),
  ('delivery_pending_payment', 'order_on_hold'),
  ('order_on_hold', 'payment_pending_verification'),
  ('delivery_unlocked', 'delivered'),
  ('delivered', 'closed');

-- ---------------------------------------------------------------------------
-- RLS baseline: enable everywhere. Phase 2 expands business policies.
-- ---------------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.leads enable row level security;
alter table public.material_categories enable row level security;
alter table public.materials enable row level security;
alter table public.vendors enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_versions enable row level security;
alter table public.quote_items enable row level security;
alter table public.quote_approvals enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_verifications enable row level security;
alter table public.vendor_orders enable row level security;
alter table public.vendor_order_items enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_items enable row level security;
alter table public.order_status_transitions enable row level security;
alter table public.quote_status_transitions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.attachments enable row level security;
alter table public.notifications enable row level security;

create policy roles_read on public.roles
  for select to authenticated using (true);

create policy permissions_read on public.permissions
  for select to authenticated using (true);

create policy role_permissions_read on public.role_permissions
  for select to authenticated using (true);

create policy quote_transitions_read on public.quote_status_transitions
  for select to authenticated using (true);

create policy order_transitions_read on public.order_status_transitions
  for select to authenticated using (true);

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_role());

create policy notifications_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated using (public.has_permission('admin.manage'));

revoke update, delete on public.audit_logs from authenticated, anon;
