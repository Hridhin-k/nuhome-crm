-- Discount is a percent of the tax-inclusive line. GST stays on the full pre-tax amount.
-- Quote and order numbers: QT0000NUOCT26 / OR0000NUOCT26, counted from 0 in Asia/Kolkata.

create or replace function public.quote_line_amounts(
  p_qty numeric,
  p_price numeric,
  p_percent numeric,
  p_rate numeric
)
returns table (
  discount numeric,
  tax numeric,
  line_total numeric,
  discount_percent numeric
)
language sql
immutable
as $$
  with input as (
    select
      round(coalesce(p_qty, 0) * coalesce(p_price, 0), 2) as base,
      round(least(100, greatest(0, coalesce(p_percent, 0))), 6) as pct,
      coalesce(p_rate, 0) as rate
  ),
  taxed as (
    select
      base,
      pct,
      round(base * rate / 100, 2) as tax
    from input
  )
  select
    round((base + tax) * pct / 100, 2) as discount,
    tax,
    (base + tax) - round((base + tax) * pct / 100, 2) as line_total,
    pct as discount_percent
  from taxed;
$$;

alter table public.quote_items
  add column if not exists discount_percent numeric(12, 6) not null default 0;

do $$
declare
  r record;
  a record;
  pct numeric;
begin
  for r in select * from public.quote_items
  loop
    if r.quantity * r.unit_price > 0 then
      pct := least(100, greatest(0, r.discount / (r.quantity * r.unit_price) * 100));
    else
      pct := 0;
    end if;

    select * into a
    from public.quote_line_amounts(r.quantity, r.unit_price, pct, r.gst_rate);

    update public.quote_items
      set discount_percent = a.discount_percent,
          discount = a.discount,
          tax = a.tax,
          line_total = a.line_total
      where id = r.id;
  end loop;
end $$;

alter table public.quote_items
  drop constraint if exists quote_items_discount_percent_range;

alter table public.quote_items
  add constraint quote_items_discount_percent_range
  check (discount_percent >= 0 and discount_percent <= 100);

do $$
declare
  vid uuid;
begin
  for vid in select id from public.quote_versions
  loop
    perform public.recalc_version_totals(vid);
  end loop;
end $$;

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
  v_line numeric;
  v_pct numeric;
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

    if nullif(item ->> 'discount_percent', '') is not null then
      v_pct := (item ->> 'discount_percent')::numeric;
    elsif v_qty * v_price > 0 then
      v_pct := v_discount / (v_qty * v_price) * 100;
    else
      v_pct := 0;
    end if;

    select a.discount, a.tax, a.line_total, a.discount_percent
      into v_discount, v_tax, v_line, v_pct
    from public.quote_line_amounts(v_qty, v_price, v_pct, v_rate) a;

    insert into public.quote_items (
      version_id, material_id, description, specification, item_code,
      quantity, unit_price, unit_cost, discount, discount_percent, tax, line_total, sort_order,
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
      v_pct,
      v_tax,
      v_line,
      i,
      v_hsn,
      v_rate,
      v_supply
    );
  end loop;
end;
$$;

-- Keep in step with lib/documents/number.ts
create or replace function public.format_document_number(
  p_prefix text,
  p_seq bigint,
  p_at timestamptz
)
returns text
language sql
immutable
as $$
  select p_prefix
    || case
         when p_seq < 10000 then lpad(p_seq::text, 4, '0')
         else p_seq::text
       end
    || 'NU'
    || (array['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'])[
         extract(month from (p_at at time zone 'Asia/Kolkata'))::int
       ]
    || to_char(p_at at time zone 'Asia/Kolkata', 'YY');
$$;

create or replace function public.next_quote_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.format_document_number('QT', nextval('public.quote_number_seq'), now());
end;
$$;

create or replace function public.next_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.format_document_number('OR', nextval('public.order_number_seq'), now());
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

  qnum := public.next_quote_number();

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

with numbered as (
  select
    id,
    created_at,
    (row_number() over (order by created_at, id) - 1)::bigint as n
  from public.quotes
)
update public.quotes q
set quote_number = public.format_document_number('QT', numbered.n, numbered.created_at)
from numbered
where q.id = numbered.id;

with numbered as (
  select
    id,
    created_at,
    (row_number() over (order by created_at, id) - 1)::bigint as n
  from public.orders
)
update public.orders o
set order_number = public.format_document_number('OR', numbered.n, numbered.created_at)
from numbered
where o.id = numbered.id;

alter sequence public.quote_number_seq minvalue 0;
alter sequence public.order_number_seq minvalue 0;

do $$
declare
  quote_count bigint;
  order_count bigint;
begin
  select count(*) into quote_count from public.quotes;
  select count(*) into order_count from public.orders;
  perform setval('public.quote_number_seq', quote_count, false);
  perform setval('public.order_number_seq', order_count, false);
end $$;
