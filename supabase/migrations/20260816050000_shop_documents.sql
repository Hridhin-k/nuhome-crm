-- Shop documents: GST/HSN tax invoice, attachments, billing vs site,
-- installation after delivery, warranty / AMC.

-- ---------------------------------------------------------------------------
-- Company GSTIN (invoice header)
-- ---------------------------------------------------------------------------

create table public.company_settings (
  id integer primary key default 1 check (id = 1),
  legal_name text not null default 'Nuhome',
  gstin text,
  address text,
  phone text,
  email text,
  state_code text,
  default_gst_rate numeric(5, 2) not null default 18
    check (default_gst_rate >= 0 and default_gst_rate <= 100),
  updated_at timestamptz not null default now()
);

insert into public.company_settings (id) values (1);

create trigger company_settings_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

alter table public.company_settings enable row level security;

create policy company_settings_select on public.company_settings
  for select to authenticated
  using (true);

create policy company_settings_update on public.company_settings
  for update to authenticated
  using (public.has_permission('admin.manage'))
  with check (public.has_permission('admin.manage'));

grant select, update on public.company_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Customer GSTIN + billing vs site
-- ---------------------------------------------------------------------------

alter table public.customers
  add column if not exists gstin text,
  add column if not exists billing_address text,
  add column if not exists site_address text;

update public.customers
set
  billing_address = coalesce(billing_address, address),
  site_address = coalesce(site_address, address)
where address is not null
  and (billing_address is null or site_address is null);

-- ---------------------------------------------------------------------------
-- Material HSN / GST / warranty term
-- ---------------------------------------------------------------------------

alter table public.materials
  add column if not exists hsn_code text,
  add column if not exists gst_rate numeric(5, 2) not null default 18
    check (gst_rate >= 0 and gst_rate <= 100),
  add column if not exists warranty_months integer not null default 12
    check (warranty_months >= 0 and warranty_months <= 120);

alter table public.quote_items
  add column if not exists hsn_code text,
  add column if not exists gst_rate numeric(5, 2) not null default 0
    check (gst_rate >= 0 and gst_rate <= 100);

update public.quote_items qi
set hsn_code = coalesce(qi.hsn_code, m.hsn_code)
from public.materials m
where m.id = qi.material_id;

-- ---------------------------------------------------------------------------
-- Tax invoice number on the order
-- ---------------------------------------------------------------------------

create sequence if not exists public.tax_invoice_seq start 1001;

alter table public.orders
  add column if not exists invoice_number text unique,
  add column if not exists invoice_issued_at timestamptz;

-- ---------------------------------------------------------------------------
-- Attachments: kind + storage
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'attachment_kind' and n.nspname = 'public'
  ) then
    create type public.attachment_kind as enum ('file', 'measurement', 'drawing', 'photo');
  end if;
end;
$$;

alter table public.attachments
  add column if not exists kind public.attachment_kind not null default 'file';

create index if not exists attachments_entity_idx
  on public.attachments (entity_type, entity_id);

drop policy if exists attachments_select on public.attachments;

create policy attachments_select on public.attachments
  for select to authenticated
  using (true);

create policy attachments_insert on public.attachments
  for insert to authenticated
  with check (uploaded_by = auth.uid());

create policy attachments_delete on public.attachments
  for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_admin());

grant select, insert, delete on public.attachments to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists shop_attachments_select on storage.objects;
drop policy if exists shop_attachments_insert on storage.objects;
drop policy if exists shop_attachments_update on storage.objects;
drop policy if exists shop_attachments_delete on storage.objects;

create policy shop_attachments_select
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments');

create policy shop_attachments_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');

create policy shop_attachments_update
  on storage.objects for update to authenticated
  using (bucket_id = 'attachments')
  with check (bucket_id = 'attachments');

create policy shop_attachments_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (owner = auth.uid() or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- Installation + warranty / AMC
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'installation_status' and n.nspname = 'public'
  ) then
    create type public.installation_status as enum ('scheduled', 'done', 'cancelled');
  end if;
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'coverage_kind' and n.nspname = 'public'
  ) then
    create type public.coverage_kind as enum ('warranty', 'amc');
  end if;
end;
$$;

create table public.installations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  scheduled_on date not null,
  notes text,
  status public.installation_status not null default 'scheduled',
  completed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger installations_updated_at
before update on public.installations
for each row execute function public.set_updated_at();

create table public.warranties (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  kind public.coverage_kind not null,
  starts_on date not null,
  ends_on date not null,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (order_id, kind)
);

alter table public.installations enable row level security;
alter table public.warranties enable row level security;

create or replace function public.can_schedule_aftercare()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_permission('quotes.create')
    or public.has_permission('deliveries.complete')
    or public.is_admin();
$$;

grant execute on function public.can_schedule_aftercare() to authenticated;

create policy installations_select on public.installations
  for select to authenticated
  using (true);

create policy installations_write on public.installations
  for insert to authenticated
  with check (public.can_schedule_aftercare() and created_by = auth.uid());

create policy installations_update on public.installations
  for update to authenticated
  using (public.can_schedule_aftercare())
  with check (public.can_schedule_aftercare());

create policy warranties_select on public.warranties
  for select to authenticated
  using (true);

create policy warranties_write on public.warranties
  for insert to authenticated
  with check (public.can_schedule_aftercare() and created_by = auth.uid());

create policy warranties_update on public.warranties
  for update to authenticated
  using (public.can_schedule_aftercare())
  with check (public.can_schedule_aftercare());

grant select, insert, update on public.installations, public.warranties to authenticated;

-- ---------------------------------------------------------------------------
-- Quote lines copy HSN / GST; tax is GST on taxable value when omitted
-- ---------------------------------------------------------------------------

create or replace function public.insert_quote_items(p_version_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  i int := 0;
  v_material uuid;
  v_qty numeric;
  v_price numeric;
  v_discount numeric;
  v_tax numeric;
  v_hsn text;
  v_rate numeric;
  v_mat public.materials%rowtype;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Quote must have at least one item' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    i := i + 1;
    v_material := nullif(item ->> 'material_id', '')::uuid;
    v_qty := (item ->> 'quantity')::numeric;
    v_price := (item ->> 'unit_price')::numeric;
    v_discount := coalesce((item ->> 'discount')::numeric, 0);
    v_hsn := nullif(trim(coalesce(item ->> 'hsn_code', '')), '');
    v_rate := nullif(item ->> 'gst_rate', '')::numeric;

    if v_material is not null then
      select * into v_mat from public.materials where id = v_material;
      if v_mat.id is not null then
        v_hsn := coalesce(v_hsn, v_mat.hsn_code);
        v_rate := coalesce(v_rate, v_mat.gst_rate);
      end if;
    end if;

    v_rate := coalesce(v_rate, 0);

    if item ? 'tax' and nullif(item ->> 'tax', '') is not null then
      v_tax := (item ->> 'tax')::numeric;
    else
      v_tax := round(greatest(v_qty * v_price - v_discount, 0) * v_rate / 100, 2);
    end if;

    insert into public.quote_items (
      version_id, material_id, description, quantity, unit_price, unit_cost,
      discount, tax, line_total, sort_order, hsn_code, gst_rate
    ) values (
      p_version_id,
      v_material,
      coalesce(item ->> 'description', 'Item'),
      v_qty,
      v_price,
      coalesce((item ->> 'unit_cost')::numeric, 0),
      v_discount,
      v_tax,
      (v_qty * v_price) - v_discount + v_tax,
      i,
      v_hsn,
      v_rate
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public quotation: bill/site, GSTIN, HSN, GST
-- ---------------------------------------------------------------------------

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

  if o.id is not null and o.status = 'closed' then
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

-- ---------------------------------------------------------------------------
-- Issue / reuse a tax invoice number
-- ---------------------------------------------------------------------------

create or replace function public.ensure_tax_invoice(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  v_number text;
begin
  perform public.require_permission('orders.read');
  select * into o from public.orders where id = p_order_id;
  if o.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if o.invoice_number is not null then
    return o.invoice_number;
  end if;

  v_number := 'INV-' || lpad(nextval('public.tax_invoice_seq')::text, 4, '0');

  update public.orders
  set invoice_number = v_number, invoice_issued_at = now()
  where id = p_order_id
    and invoice_number is null;

  select invoice_number into v_number from public.orders where id = p_order_id;
  return v_number;
end;
$$;

grant execute on function public.ensure_tax_invoice(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Warranty starts on delivery
-- ---------------------------------------------------------------------------

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
  v_months integer;
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

  select coalesce(max(m.warranty_months), 12)
  into v_months
  from public.order_items oi
  left join public.materials m on m.id = oi.material_id
  where oi.order_id = o.id;

  insert into public.warranties (order_id, kind, starts_on, ends_on, notes, created_by)
  values (
    o.id,
    'warranty',
    (timezone('Asia/Kolkata', now()))::date,
    ((timezone('Asia/Kolkata', now()))::date + (v_months * interval '1 month'))::date,
    'Issued on delivery',
    actor.id
  )
  on conflict (order_id, kind) do nothing;

  perform public.assert_transition('delivered', 'closed');
  update public.orders set status = 'closed' where id = o.id;
  perform public.write_audit(
    actor.id, actor.role, 'ORDER_CLOSED', 'order', o.id,
    'delivered', 'closed', '{}'::jsonb
  );
end;
$$;
