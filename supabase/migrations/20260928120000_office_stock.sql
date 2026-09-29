-- Office ready stock. The firm buys materials ahead of a customer job.
-- A quote line is either taken from that shelf or ordered from a vendor.

create type public.supply_source as enum ('office', 'vendor');

create type public.stock_movement_kind as enum (
  'receipt',
  'reservation',
  'release',
  'handover',
  'void',
  'adjustment'
);

create type public.stock_purchase_status as enum (
  'draft',
  'sent',
  'partial',
  'received',
  'closed'
);

create sequence public.stock_purchase_number_seq start 1001;

create table public.stock_purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_number text not null unique default (
    'SP-' || lpad(nextval('public.stock_purchase_number_seq')::text, 4, '0')
  ),
  vendor_id uuid not null references public.vendors (id),
  status public.stock_purchase_status not null default 'draft',
  notes text,
  created_by uuid references public.profiles (id),
  sent_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger stock_purchases_updated_at
before update on public.stock_purchases
for each row execute function public.set_updated_at();

create table public.stock_purchase_items (
  id uuid primary key default gen_random_uuid(),
  stock_purchase_id uuid not null references public.stock_purchases (id) on delete cascade,
  material_id uuid not null references public.materials (id),
  description text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  quantity_received numeric(12, 3) not null default 0 check (quantity_received >= 0),
  unit_cost numeric(12, 2) not null default 0 check (unit_cost >= 0),
  constraint stock_purchase_items_received_chk check (quantity_received <= quantity)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials (id),
  kind public.stock_movement_kind not null,
  quantity numeric(12, 3) not null check (quantity <> 0),
  stock_purchase_item_id uuid references public.stock_purchase_items (id),
  quote_item_id uuid references public.quote_items (id) on delete set null,
  order_item_id uuid references public.order_items (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  reverses_id uuid references public.stock_movements (id),
  reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index stock_movements_material_idx on public.stock_movements (material_id);
create index stock_movements_quote_item_idx on public.stock_movements (quote_item_id);

alter table public.quote_items
  add column supply_source public.supply_source not null default 'vendor',
  add column quantity_handed_over numeric(12, 3) not null default 0;

alter table public.quote_items
  add constraint quote_items_handed_chk
    check (quantity_handed_over >= 0 and quantity_handed_over <= quantity),
  add constraint quote_items_office_material_chk
    check (supply_source <> 'office' or material_id is not null);

alter table public.order_items
  add column supply_source public.supply_source not null default 'vendor',
  add column quantity_handed_over numeric(12, 3) not null default 0;

alter table public.order_items
  add constraint order_items_handed_chk
    check (quantity_handed_over >= 0 and quantity_handed_over <= quantity),
  add constraint order_items_office_material_chk
    check (supply_source <> 'office' or material_id is not null);

insert into public.workflow_transitions (from_status, to_status)
values
  ('quote_draft', 'quote_sent_to_customer'),
  ('quote_pending_accounts', 'quote_sent_to_customer'),
  ('quote_sent_to_customer', 'delivered'),
  ('closed', 'cancelled')
on conflict do nothing;

insert into public.permissions (slug, description)
values
  ('stock.read', 'View office on-hand'),
  ('stock.purchase', 'Buy stock into the office'),
  ('stock.receive', 'Receive office stock from a vendor'),
  ('stock.sell', 'Hand office stock to a customer'),
  ('stock.adjust', 'Correct office stock counts')
on conflict (slug) do nothing;

insert into public.role_permissions (role, permission)
select role::public.app_role, permission
from (
  values
    ('sales', 'stock.read'),
    ('sales', 'stock.sell'),
    ('accounts', 'stock.read'),
    ('procurement', 'stock.read'),
    ('procurement', 'stock.purchase'),
    ('procurement', 'stock.receive'),
    ('store', 'stock.read'),
    ('store', 'stock.receive'),
    ('store', 'stock.sell'),
    ('operations', 'stock.read'),
    ('operations', 'stock.purchase'),
    ('operations', 'stock.receive'),
    ('operations', 'stock.sell'),
    ('operations', 'stock.adjust'),
    ('admin', 'stock.read'),
    ('admin', 'stock.purchase'),
    ('admin', 'stock.receive'),
    ('admin', 'stock.sell'),
    ('admin', 'stock.adjust')
) as grants(role, permission)
on conflict do nothing;

-- Floor staff handing over shelf goods can read the balance before an order exists.
create or replace function public.quote_balance(p_quote_id uuid)
returns public.balance_snapshot
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  snap public.balance_snapshot;
  oid uuid;
begin
  select o.id into oid from public.orders o where o.quote_id = p_quote_id;
  if oid is not null and not public.can_view_order(oid) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if oid is null and not exists (
    select 1 from public.quotes q
    where q.id = p_quote_id
      and (
        public.is_admin()
        or public.is_accounts()
        or q.created_by = auth.uid()
        or public.has_permission('stock.sell')
      )
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select
    coalesce(qv.total, 0),
    coalesce((
      select sum(p.amount) from public.payments p
      where p.quote_id = p_quote_id and p.status = 'verified'
    ), 0),
    coalesce(qv.total, 0) - coalesce((
      select sum(p.amount) from public.payments p
      where p.quote_id = p_quote_id and p.status = 'verified'
    ), 0)
  into snap
  from public.quotes q
  left join public.quote_versions qv on qv.id = q.current_version_id
  where q.id = p_quote_id;

  return snap;
end;
$$;

-- ---------------------------------------------------------------------------
-- Balances
-- ---------------------------------------------------------------------------

create or replace function public.material_on_hand(p_material_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case
      when kind in ('receipt', 'adjustment', 'void') then quantity
      when kind = 'handover' then -quantity
      else 0
    end
  ), 0)
  from public.stock_movements
  where material_id = p_material_id
$$;

create or replace function public.material_reserved(p_material_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case
      when kind = 'reservation' then quantity
      when kind in ('release', 'handover') then -quantity
      else 0
    end
  ), 0)
  from public.stock_movements
  where material_id = p_material_id
$$;

create or replace function public.quote_item_reserved(p_quote_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case
      when kind = 'reservation' then quantity
      when kind in ('release', 'handover') then -quantity
      else 0
    end
  ), 0)
  from public.stock_movements
  where quote_item_id = p_quote_item_id
$$;

create or replace function public.list_office_stock(p_quote_id uuid default null)
returns table (
  material_id uuid,
  on_hand numeric,
  reserved numeric,
  available numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_permission('stock.read') then
    return;
  end if;

  return query
  select
    m.id,
    public.material_on_hand(m.id),
    public.material_reserved(m.id),
    public.material_on_hand(m.id)
      - public.material_reserved(m.id)
      + coalesce((
          select sum(public.quote_item_reserved(qi.id))
          from public.quote_items qi
          join public.quotes q on q.current_version_id = qi.version_id
          where q.id = p_quote_id
            and qi.material_id = m.id
            and qi.supply_source = 'office'
        ), 0)
  from public.materials m
  where m.is_active;
end;
$$;

create or replace function public.release_version_reservations(
  p_version_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  qi record;
  held numeric;
begin
  for qi in
    select id, material_id
    from public.quote_items
    where version_id = p_version_id
      and material_id is not null
  loop
    held := public.quote_item_reserved(qi.id);
    if held > 0 then
      insert into public.stock_movements (
        material_id, kind, quantity, quote_item_id, created_by
      ) values (
        qi.material_id, 'release', held, qi.id, p_actor
      );
    end if;
  end loop;
end;
$$;

create or replace function public.reserve_quote_office_stock(
  p_quote_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  qi record;
  need numeric;
  held numeric;
  avail numeric;
begin
  for qi in
    select src.id, src.material_id, src.description, src.quantity, src.quantity_handed_over
    from public.quote_items src
    join public.quotes q on q.current_version_id = src.version_id
    where q.id = p_quote_id
      and src.supply_source = 'office'
      and src.material_id is not null
    order by src.material_id
  loop
    perform 1 from public.materials where id = qi.material_id for update;
    need := qi.quantity - qi.quantity_handed_over;
    held := public.quote_item_reserved(qi.id);
    if need > held then
      avail := public.material_on_hand(qi.material_id) - public.material_reserved(qi.material_id);
      if avail < need - held then
        raise exception 'Not enough office stock for %', qi.description
          using errcode = 'P0001';
      end if;
      insert into public.stock_movements (
        material_id, kind, quantity, quote_item_id, created_by
      ) values (
        qi.material_id, 'reservation', need - held, qi.id, p_actor
      );
    elsif held > need then
      insert into public.stock_movements (
        material_id, kind, quantity, quote_item_id, created_by
      ) values (
        qi.material_id, 'release', held - need, qi.id, p_actor
      );
    end if;
  end loop;
end;
$$;

-- Keep order lines aligned with the quote line they came from.
create or replace function public.order_items_copy_supply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  src public.quote_items;
begin
  if new.quote_item_id is null then
    return new;
  end if;
  select * into src from public.quote_items where id = new.quote_item_id;
  if src.id is null then
    return new;
  end if;
  new.supply_source := src.supply_source;
  new.quantity_handed_over := src.quantity_handed_over;
  if src.supply_source = 'office' then
    new.quantity_received := greatest(new.quantity_received, src.quantity_handed_over);
  end if;
  return new;
end;
$$;

drop trigger if exists order_items_copy_supply on public.order_items;
create trigger order_items_copy_supply
before insert or update of quote_item_id, quantity on public.order_items
for each row execute function public.order_items_copy_supply();

create or replace function public.release_office_write_off()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta numeric;
  held numeric;
begin
  if new.supply_source <> 'office' or new.quote_item_id is null then
    return new;
  end if;
  delta := new.quantity_written_off - old.quantity_written_off;
  if delta <= 0 then
    return new;
  end if;
  held := public.quote_item_reserved(new.quote_item_id);
  if held > 0 then
    insert into public.stock_movements (
      material_id, kind, quantity, quote_item_id, order_item_id, reason, created_by
    ) values (
      new.material_id,
      'release',
      least(held, delta),
      new.quote_item_id,
      new.id,
      'Written off before handover',
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists order_items_release_office_write_off on public.order_items;
create trigger order_items_release_office_write_off
after update of quantity_written_off on public.order_items
for each row execute function public.release_office_write_off();

create or replace function public.release_stock_on_quote_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform public.release_version_reservations(new.current_version_id, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_release_stock_on_cancel on public.quotes;
create trigger quotes_release_stock_on_cancel
after update of status on public.quotes
for each row execute function public.release_stock_on_quote_cancel();

create or replace function public.order_item_available_to_send(p_order_item_id uuid)
returns numeric
language sql
stable
as $$
  select case
    when oi.supply_source = 'office' then 0
    else greatest(
      0,
      oi.quantity
        - coalesce(oi.quantity_written_off, 0)
        - coalesce((
            select sum(voi.quantity)
            from public.vendor_order_items voi
            where voi.order_item_id = oi.id
          ), 0)
    )
  end
  from public.order_items oi
  where oi.id = p_order_item_id
$$;

-- ---------------------------------------------------------------------------
-- Quote lines remember how they will be supplied
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
  v_code text;
  v_spec text;
  v_supply public.supply_source;
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
    v_spec := nullif(trim(coalesce(item ->> 'specification', '')), '');
    v_mat := null;
    v_hsn := null;
    v_rate := 0;
    v_code := nullif(trim(coalesce(item ->> 'item_code', '')), '');
    v_supply := case
      when coalesce(item ->> 'supply_source', 'vendor') = 'office' then 'office'::public.supply_source
      else 'vendor'::public.supply_source
    end;

    if v_material is not null then
      select * into v_mat from public.materials where id = v_material;
      if v_mat.id is not null then
        v_hsn := v_mat.hsn_code;
        v_rate := coalesce(v_mat.gst_rate, 0);
        v_code := coalesce(v_mat.sku, v_code);
      end if;
    end if;

    if v_supply = 'office' and v_material is null then
      v_supply := 'vendor';
    end if;

    v_tax := round(greatest(v_qty * v_price - v_discount, 0) * v_rate / 100, 2);

    insert into public.quote_items (
      version_id, material_id, description, specification, item_code,
      quantity, unit_price, unit_cost, discount, tax, line_total, sort_order,
      hsn_code, gst_rate, supply_source
    ) values (
      p_version_id,
      v_material,
      coalesce(item ->> 'description', 'Item'),
      v_spec,
      v_code,
      v_qty,
      v_price,
      coalesce((item ->> 'unit_cost')::numeric, 0),
      v_discount,
      v_tax,
      (v_qty * v_price) - v_discount + v_tax,
      i,
      v_hsn,
      v_rate,
      v_supply
    );
  end loop;
end;
$$;

create or replace function public.create_quote(
  p_customer_id uuid,
  p_items jsonb,
  p_notes text default null,
  p_warranty_months integer default 12,
  p_include_amc boolean default false,
  p_amc_months integer default 12
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
    quote_id, version_number, created_by, status, notes,
    warranty_months, include_amc, amc_months
  ) values (
    qid, 1, actor.id, 'quote_draft', p_notes,
    coalesce(p_warranty_months, 12),
    coalesce(p_include_amc, false),
    coalesce(p_amc_months, 12)
  ) returning id into vid;

  perform public.insert_quote_items(vid, p_items);
  perform public.recalc_version_totals(vid);

  update public.quotes set current_version_id = vid where id = qid;
  perform public.reserve_quote_office_stock(qid, actor.id);

  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_CREATED', 'quote', qid, null, 'quote_draft',
    jsonb_build_object('quote_number', qnum, 'version', 1)
  );

  return qid;
end;
$$;

create or replace function public.revise_quote(
  p_quote_id uuid,
  p_items jsonb,
  p_notes text default null,
  p_warranty_months integer default 12,
  p_include_amc boolean default false,
  p_amc_months integer default 12
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
  live boolean;
begin
  actor := public.require_permission('quotes.revise');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.status not in (
    'quote_draft', 'quote_rejected', 'quote_approved', 'quote_sent_to_customer'
  ) then
    raise exception 'This quote cannot be edited now' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from public.quote_items qi
    where qi.version_id = q.current_version_id
      and qi.quantity_handed_over > 0
  ) then
    raise exception 'Office lines already handed over cannot be edited. Void the handover first.'
      using errcode = 'P0001';
  end if;

  live := q.status = 'quote_sent_to_customer';
  perform public.release_version_reservations(q.current_version_id, actor.id);

  if q.status = 'quote_draft' then
    vid := q.current_version_id;
    delete from public.quote_items where version_id = vid;
    perform public.insert_quote_items(vid, p_items);
    perform public.recalc_version_totals(vid);
    perform public.reserve_quote_office_stock(q.id, actor.id);
    update public.quote_versions
      set notes = p_notes,
          warranty_months = coalesce(p_warranty_months, warranty_months),
          include_amc = coalesce(p_include_amc, include_amc),
          amc_months = coalesce(p_amc_months, amc_months)
      where id = vid;
    update public.quotes set updated_at = now() where id = q.id;
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
    quote_id, version_number, created_by, status, notes,
    warranty_months, include_amc, amc_months
  ) values (
    q.id, next_ver, actor.id, 'quote_draft', p_notes,
    coalesce(p_warranty_months, 12),
    coalesce(p_include_amc, false),
    coalesce(p_amc_months, 12)
  ) returning id into vid;

  perform public.insert_quote_items(vid, p_items);
  perform public.recalc_version_totals(vid);

  perform public.allow_status();
  update public.quotes
    set status = 'quote_draft',
        current_version_id = vid,
        revision_pending = live or q.revision_pending
    where id = q.id;
  perform public.reserve_quote_office_stock(q.id, actor.id);

  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_REVISED', 'quote', q.id,
    q.status::text, 'quote_draft',
    jsonb_build_object('version', next_ver, 'version_id', vid, 'live', live)
  );

  return vid;
end;
$$;

create or replace function public.ensure_order_for_quote(p_quote_id uuid, p_actor uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes;
  oid uuid;
begin
  select * into q from public.quotes where id = p_quote_id;
  select id into oid from public.orders where quote_id = q.id;
  if oid is not null then
    return oid;
  end if;

  insert into public.orders (quote_id, customer_id, assigned_sales_id, status)
  values (q.id, q.customer_id, p_actor, 'quote_sent_to_customer')
  returning id into oid;

  insert into public.order_items (
    order_id, quote_item_id, material_id, description, quantity
  )
  select oid, qi.id, qi.material_id, qi.description, qi.quantity
  from public.quote_items qi
  where qi.version_id = q.current_version_id;

  return oid;
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
  o public.orders;
  oid uuid;
  onum text;
begin
  actor := public.require_permission('quotes.send_to_customer');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.status <> 'quote_approved' then
    raise exception 'Only an approved quote can be sent to the customer' using errcode = 'P0001';
  end if;

  select * into o from public.orders where quote_id = q.id;

  perform public.assert_transition(q.status, 'quote_sent_to_customer');
  perform public.allow_status();
  update public.quotes
    set status = 'quote_sent_to_customer', sent_at = coalesce(sent_at, now())
    where id = q.id;
  update public.quote_versions
    set status = 'quote_sent_to_customer'
    where id = q.current_version_id;

  if o.id is null then
    oid := public.ensure_order_for_quote(q.id, actor.id);
    select * into o from public.orders where id = oid;
  else
    oid := o.id;
    update public.order_items oi
      set quantity = qi.quantity,
          description = qi.description
      from public.quote_items qi
      where oi.order_id = oid
        and oi.quote_item_id = qi.id
        and qi.version_id = q.current_version_id;
  end if;

  update public.payments
    set order_id = oid
    where quote_id = q.id
      and order_id is null;

  select order_number into onum from public.orders where id = oid;

  if o.status = 'quote_sent_to_customer' and exists (
    select 1 from public.payments p
    where p.quote_id = q.id and p.status = 'verified' and p.amount > 0
  ) then
    perform public.assert_transition('quote_sent_to_customer', 'payment_pending_verification');
    perform public.allow_status();
    update public.orders set status = 'payment_pending_verification' where id = oid;
    perform public.assert_transition('payment_pending_verification', 'order_active');
    update public.orders
      set status = 'order_active', activated_at = coalesce(activated_at, now())
      where id = oid;
  end if;

  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_SENT_TO_CUSTOMER', 'quote', q.id,
    'quote_approved', 'quote_sent_to_customer',
    jsonb_build_object('order_id', oid, 'order_number', onum)
  );

  return oid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Buying stock into the office
-- ---------------------------------------------------------------------------

create or replace function public.create_stock_purchase(
  p_vendor_id uuid,
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
  pid uuid;
  item jsonb;
  mid uuid;
begin
  actor := public.require_permission('stock.purchase');
  if not exists (select 1 from public.vendors v where v.id = p_vendor_id and v.is_active) then
    raise exception 'Vendor not found' using errcode = 'P0002';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one material' using errcode = '22023';
  end if;

  insert into public.stock_purchases (vendor_id, notes, created_by, status)
  values (p_vendor_id, nullif(trim(coalesce(p_notes, '')), ''), actor.id, 'draft')
  returning id into pid;

  for item in select value from jsonb_array_elements(p_items)
  loop
    mid := nullif(item ->> 'material_id', '')::uuid;
    if mid is null or not exists (select 1 from public.materials m where m.id = mid) then
      raise exception 'Each stock line needs a catalogue material' using errcode = '22023';
    end if;
    insert into public.stock_purchase_items (
      stock_purchase_id, material_id, description, quantity, unit_cost
    ) values (
      pid,
      mid,
      coalesce(nullif(trim(item ->> 'description'), ''), (select name from public.materials where id = mid)),
      (item ->> 'quantity')::numeric,
      coalesce((item ->> 'unit_cost')::numeric, 0)
    );
  end loop;

  perform public.write_audit(
    actor.id, actor.role, 'STOCK_PURCHASE_CREATED', 'stock_purchase', pid,
    null, 'draft', jsonb_build_object('vendor_id', p_vendor_id)
  );
  return pid;
end;
$$;

create or replace function public.send_stock_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  row public.stock_purchases;
begin
  actor := public.require_permission('stock.purchase');
  select * into row from public.stock_purchases where id = p_purchase_id for update;
  if row.id is null then
    raise exception 'Stock purchase not found' using errcode = 'P0002';
  end if;
  if row.status <> 'draft' then
    raise exception 'Only a draft purchase can be sent' using errcode = 'P0001';
  end if;
  update public.stock_purchases
    set status = 'sent', sent_at = now()
    where id = row.id;
  perform public.write_audit(
    actor.id, actor.role, 'STOCK_PURCHASE_SENT', 'stock_purchase', row.id,
    'draft', 'sent', '{}'::jsonb
  );
end;
$$;

create or replace function public.receive_stock_purchase(
  p_purchase_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  row public.stock_purchases;
  item jsonb;
  line public.stock_purchase_items;
  qty numeric;
  open_qty numeric;
begin
  actor := public.require_permission('stock.receive');
  select * into row from public.stock_purchases where id = p_purchase_id for update;
  if row.id is null then
    raise exception 'Stock purchase not found' using errcode = 'P0002';
  end if;
  if row.status not in ('sent', 'partial') then
    raise exception 'This purchase is not waiting for a receipt' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Enter a received quantity' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    qty := coalesce((item ->> 'quantity')::numeric, 0);
    if qty <= 0 then
      continue;
    end if;
    select * into line
    from public.stock_purchase_items
    where id = (item ->> 'stock_purchase_item_id')::uuid
      and stock_purchase_id = row.id
    for update;
    if line.id is null then
      raise exception 'Stock line does not belong to this purchase' using errcode = 'P0001';
    end if;
    open_qty := line.quantity - line.quantity_received;
    if qty > open_qty then
      raise exception 'Cannot receive more than the remaining quantity for %', line.description
        using errcode = 'P0001';
    end if;
    update public.stock_purchase_items
      set quantity_received = quantity_received + qty
      where id = line.id;
    insert into public.stock_movements (
      material_id, kind, quantity, stock_purchase_item_id, created_by
    ) values (
      line.material_id, 'receipt', qty, line.id, actor.id
    );
  end loop;

  update public.stock_purchases sp
    set status = case
      when not exists (
        select 1 from public.stock_purchase_items spi
        where spi.stock_purchase_id = sp.id
          and spi.quantity_received < spi.quantity
      ) then 'received'::public.stock_purchase_status
      else 'partial'::public.stock_purchase_status
    end
    where sp.id = row.id;

  perform public.write_audit(
    actor.id, actor.role, 'STOCK_RECEIVED', 'stock_purchase', row.id,
    row.status::text, 'received', '{}'::jsonb
  );
end;
$$;

create or replace function public.close_stock_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  row public.stock_purchases;
begin
  actor := public.require_permission('stock.purchase');
  select * into row from public.stock_purchases where id = p_purchase_id for update;
  if row.id is null then
    raise exception 'Stock purchase not found' using errcode = 'P0002';
  end if;
  if row.status not in ('sent', 'partial') then
    raise exception 'This purchase cannot be closed' using errcode = 'P0001';
  end if;
  update public.stock_purchases
    set status = 'closed', closed_at = now()
    where id = row.id;
  perform public.write_audit(
    actor.id, actor.role, 'STOCK_PURCHASE_CLOSED', 'stock_purchase', row.id,
    row.status::text, 'closed', '{}'::jsonb
  );
end;
$$;

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
  actor := public.require_permission('stock.adjust');
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

-- ---------------------------------------------------------------------------
-- Counter handover and same-day void
-- ---------------------------------------------------------------------------

create or replace function public.hand_over_office_lines(
  p_quote_id uuid,
  p_amount numeric,
  p_method public.payment_method,
  p_reference text default null,
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
  qi record;
  oid uuid;
  pid uuid;
  office_due numeric := 0;
  outstanding numeric;
  all_office boolean;
  bal public.balance_snapshot;
  ref text;
  qv public.quote_versions;
  v_months integer;
  did uuid;
begin
  actor := public.require_permission('stock.sell');
  select * into q from public.quotes where id = p_quote_id for update;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.status not in (
    'quote_draft', 'quote_pending_accounts', 'quote_approved', 'quote_sent_to_customer'
  ) then
    raise exception 'Office stock cannot be handed over from this quote' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.orders o
    where o.quote_id = q.id and o.status in ('delivered', 'closed', 'cancelled')
  ) then
    raise exception 'This job is already finished' using errcode = 'P0001';
  end if;
  if p_method is null then
    raise exception 'Choose how the customer paid' using errcode = '22023';
  end if;
  ref := nullif(trim(coalesce(p_reference, '')), '');
  if p_method <> 'cash' and ref is null then
    raise exception 'Payment reference is required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.quote_items src
    where src.version_id = q.current_version_id
      and src.supply_source = 'office'
      and src.quantity_handed_over < src.quantity
  ) then
    raise exception 'No office lines are waiting to be handed over' using errcode = 'P0001';
  end if;

  select coalesce(sum(src.line_total), 0) into office_due
  from public.quote_items src
  where src.version_id = q.current_version_id
    and src.supply_source = 'office'
    and src.quantity_handed_over < src.quantity;

  select * into bal from public.quote_balance(q.id);
  outstanding := coalesce(bal.outstanding, 0);
  if p_amount is null or p_amount + 0.009 < office_due then
    raise exception 'Collect at least % for the items leaving now', office_due
      using errcode = '22023';
  end if;

  select not exists (
    select 1 from public.quote_items src
    where src.version_id = q.current_version_id
      and src.supply_source = 'vendor'
  ) into all_office;

  if all_office and p_amount + 0.009 < outstanding then
    raise exception 'A shelf-only sale must be paid in full' using errcode = '22023';
  end if;

  for qi in
    select *
    from public.quote_items
    where version_id = q.current_version_id
      and supply_source = 'office'
      and quantity_handed_over < quantity
    order by material_id
  loop
    perform 1 from public.materials where id = qi.material_id for update;
    if public.quote_item_reserved(qi.id) < qi.quantity - qi.quantity_handed_over then
      raise exception 'Office stock for % is no longer reserved', qi.description
        using errcode = 'P0001';
    end if;
    if public.material_on_hand(qi.material_id) < qi.quantity - qi.quantity_handed_over then
      raise exception 'Office stock for % is no longer on hand', qi.description
        using errcode = 'P0001';
    end if;
  end loop;

  insert into public.payments (
    quote_id, kind, method, amount, reference_number, paid_at, recorded_by, status, notes
  ) values (
    q.id,
    case when p_amount + 0.009 >= outstanding then 'full' else 'advance' end::public.payment_kind,
    p_method,
    p_amount,
    coalesce(ref, 'cash'),
    current_date,
    actor.id,
    'verified',
    coalesce(nullif(trim(coalesce(p_notes, '')), ''), 'Office counter')
  ) returning id into pid;

  for qi in
    select *
    from public.quote_items
    where version_id = q.current_version_id
      and supply_source = 'office'
      and quantity_handed_over < quantity
  loop
    insert into public.stock_movements (
      material_id, kind, quantity, quote_item_id, payment_id, created_by
    ) values (
      qi.material_id,
      'handover',
      qi.quantity - qi.quantity_handed_over,
      qi.id,
      pid,
      actor.id
    );
    update public.quote_items
      set quantity_handed_over = quantity
      where id = qi.id;
  end loop;

  oid := public.ensure_order_for_quote(q.id, actor.id);
  update public.payments set order_id = oid where id = pid;
  update public.order_items oi
    set quantity_handed_over = src.quantity_handed_over,
        quantity_received = greatest(oi.quantity_received, src.quantity_handed_over)
    from public.quote_items src
    where oi.order_id = oid
      and oi.quote_item_id = src.id
      and src.supply_source = 'office';

  perform public.ensure_tax_invoice(oid);

  if all_office then
    if q.status <> 'quote_sent_to_customer' then
      perform public.assert_transition(q.status, 'quote_sent_to_customer');
      perform public.allow_status();
      update public.quotes
        set status = 'quote_sent_to_customer', sent_at = coalesce(sent_at, now())
        where id = q.id;
      update public.quote_versions
        set status = 'quote_sent_to_customer'
        where id = q.current_version_id;
    end if;

    perform public.assert_transition('quote_sent_to_customer', 'delivered');
    insert into public.deliveries (order_id, delivered_by, delivered_at, notes)
    values (oid, actor.id, now(), 'Handed over from office stock')
    returning id into did;
    insert into public.delivery_items (delivery_id, order_item_id, quantity)
    select did, oi.id, oi.quantity
    from public.order_items oi
    where oi.order_id = oid;

    perform public.allow_status();
    update public.orders set status = 'delivered' where id = oid;

    select qv2.* into qv
    from public.quotes qq
    join public.quote_versions qv2 on qv2.id = qq.current_version_id
    where qq.id = q.id;
    v_months := coalesce(qv.warranty_months, 12);
    insert into public.warranties (order_id, kind, starts_on, ends_on, notes, created_by)
    values (
      oid,
      'warranty',
      (timezone('Asia/Kolkata', now()))::date,
      ((timezone('Asia/Kolkata', now()))::date + (v_months * interval '1 month'))::date,
      'Issued when office stock was handed over',
      actor.id
    )
    on conflict (order_id, kind) do nothing;

    perform public.assert_transition('delivered', 'closed');
    update public.orders set status = 'closed' where id = oid;
  end if;

  perform public.write_audit(
    actor.id, actor.role, 'OFFICE_HANDED_OVER', 'quote', q.id,
    q.status::text,
    case when all_office then 'closed' else q.status::text end,
    jsonb_build_object('order_id', oid, 'payment_id', pid, 'amount', p_amount)
  );

  return oid;
end;
$$;

create or replace function public.void_office_handover(
  p_quote_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  q public.quotes;
  o public.orders;
  mov record;
  all_office boolean;
  today date := (timezone('Asia/Kolkata', now()))::date;
begin
  actor := public.require_permission('stock.sell');
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  select * into q from public.quotes where id = p_quote_id for update;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.stock_movements sm
    join public.quote_items qi on qi.id = sm.quote_item_id
    where qi.version_id = q.current_version_id
      and sm.kind = 'handover'
      and not exists (
        select 1 from public.stock_movements v where v.reverses_id = sm.id
      )
  ) then
    raise exception 'Nothing to void' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.stock_movements sm
    join public.quote_items qi on qi.id = sm.quote_item_id
    where qi.version_id = q.current_version_id
      and sm.kind = 'handover'
      and (timezone('Asia/Kolkata', sm.created_at))::date <> today
      and not exists (
        select 1 from public.stock_movements v where v.reverses_id = sm.id
      )
  ) then
    raise exception 'Office handover can only be voided the same day' using errcode = 'P0001';
  end if;

  if not public.has_permission('stock.adjust') and exists (
    select 1
    from public.stock_movements sm
    join public.quote_items qi on qi.id = sm.quote_item_id
    where qi.version_id = q.current_version_id
      and sm.kind = 'handover'
      and sm.created_by is distinct from actor.id
      and not exists (
        select 1 from public.stock_movements v where v.reverses_id = sm.id
      )
  ) then
    raise exception 'Only the person who handed these over can void them today'
      using errcode = '42501';
  end if;

  for mov in
    select sm.*
    from public.stock_movements sm
    join public.quote_items qi on qi.id = sm.quote_item_id
    where qi.version_id = q.current_version_id
      and sm.kind = 'handover'
      and not exists (
        select 1 from public.stock_movements v where v.reverses_id = sm.id
      )
  loop
    insert into public.stock_movements (
      material_id, kind, quantity, quote_item_id, payment_id, reverses_id, reason, created_by
    ) values (
      mov.material_id, 'void', mov.quantity, mov.quote_item_id, mov.payment_id,
      mov.id, trim(p_reason), actor.id
    );
    update public.quote_items
      set quantity_handed_over = greatest(quantity_handed_over - mov.quantity, 0)
      where id = mov.quote_item_id;
    if mov.payment_id is not null then
      update public.payments
        set status = 'rejected',
            notes = trim(both ' ' from coalesce(notes, '') || ' Voided: ' || trim(p_reason))
        where id = mov.payment_id
          and status = 'verified';
    end if;
  end loop;

  select * into o from public.orders where quote_id = q.id;
  if o.id is not null then
    update public.order_items oi
      set quantity_handed_over = qi.quantity_handed_over,
          quantity_received = case
            when oi.supply_source = 'office' then qi.quantity_handed_over
            else oi.quantity_received
          end
      from public.quote_items qi
      where oi.quote_item_id = qi.id
        and oi.order_id = o.id;
  end if;

  select not exists (
    select 1 from public.quote_items qi
    where qi.version_id = q.current_version_id
      and qi.supply_source = 'vendor'
  ) into all_office;

  if all_office and o.id is not null and o.status = 'closed' then
    delete from public.delivery_items di
    using public.deliveries d
    where di.delivery_id = d.id and d.order_id = o.id;
    delete from public.deliveries where order_id = o.id;
    delete from public.warranties where order_id = o.id;
    perform public.assert_transition('closed', 'cancelled');
    perform public.allow_status();
    update public.orders set status = 'cancelled' where id = o.id;
    perform public.assert_transition(q.status, 'cancelled');
    update public.quotes set status = 'cancelled' where id = q.id;
    update public.quote_versions set status = 'cancelled' where id = q.current_version_id;
  else
    perform public.reserve_quote_office_stock(q.id, actor.id);
  end if;

  perform public.write_audit(
    actor.id, actor.role, 'OFFICE_HANDOVER_VOIDED', 'quote', q.id,
    q.status::text, 'voided', jsonb_build_object('reason', trim(p_reason))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.stock_purchases enable row level security;
alter table public.stock_purchase_items enable row level security;
alter table public.stock_movements enable row level security;

create policy stock_purchases_read on public.stock_purchases
  for select to authenticated using (public.has_permission('stock.read'));
create policy stock_purchase_items_read on public.stock_purchase_items
  for select to authenticated using (public.has_permission('stock.read'));
create policy stock_movements_read on public.stock_movements
  for select to authenticated using (public.has_permission('stock.read'));

revoke insert, update, delete on public.stock_purchases from anon, authenticated;
revoke insert, update, delete on public.stock_purchase_items from anon, authenticated;
revoke insert, update, delete on public.stock_movements from anon, authenticated;

revoke all on function public.material_on_hand(uuid) from public, anon, authenticated;
revoke all on function public.material_reserved(uuid) from public, anon, authenticated;
revoke all on function public.quote_item_reserved(uuid) from public, anon, authenticated;
revoke all on function public.release_version_reservations(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reserve_quote_office_stock(uuid, uuid) from public, anon, authenticated;
revoke all on function public.ensure_order_for_quote(uuid, uuid) from public, anon, authenticated;
grant execute on function public.material_on_hand(uuid) to postgres, service_role;
grant execute on function public.material_reserved(uuid) to postgres, service_role;
grant execute on function public.quote_item_reserved(uuid) to postgres, service_role;
grant execute on function public.release_version_reservations(uuid, uuid) to postgres, service_role;
grant execute on function public.reserve_quote_office_stock(uuid, uuid) to postgres, service_role;
grant execute on function public.ensure_order_for_quote(uuid, uuid) to postgres, service_role;

grant execute on function public.list_office_stock(uuid) to authenticated;
grant execute on function public.create_stock_purchase(uuid, jsonb, text) to authenticated;
grant execute on function public.send_stock_purchase(uuid) to authenticated;
grant execute on function public.receive_stock_purchase(uuid, jsonb) to authenticated;
grant execute on function public.close_stock_purchase(uuid) to authenticated;
grant execute on function public.adjust_office_stock(uuid, numeric, text) to authenticated;
grant execute on function public.hand_over_office_lines(uuid, numeric, public.payment_method, text, text) to authenticated;
grant execute on function public.void_office_handover(uuid, text) to authenticated;
