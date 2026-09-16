-- GST is catalog-owned. Quote lines keep Sales specification and item code for vendor quotes.

alter table public.quote_items
  add column if not exists specification text,
  add column if not exists item_code text;

update public.quote_items qi
set item_code = coalesce(qi.item_code, m.sku)
from public.materials m
where m.id = qi.material_id
  and qi.item_code is null;

update public.quote_items
set specification = nullif(trim(split_part(description, ' — ', 2)), '')
where specification is null
  and description like '% — %';

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

    if v_material is not null then
      select * into v_mat from public.materials where id = v_material;
      if v_mat.id is not null then
        v_hsn := v_mat.hsn_code;
        v_rate := coalesce(v_mat.gst_rate, 0);
        v_code := coalesce(v_mat.sku, v_code);
      end if;
    end if;

    v_tax := round(greatest(v_qty * v_price - v_discount, 0) * v_rate / 100, 2);

    insert into public.quote_items (
      version_id, material_id, description, specification, item_code,
      quantity, unit_price, unit_cost, discount, tax, line_total, sort_order,
      hsn_code, gst_rate
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
      v_rate
    );
  end loop;
end;
$$;

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

  return jsonb_build_object(
    'quote_number', q.quote_number,
    'warranty_months', v.warranty_months,
    'include_amc', v.include_amc,
    'amc_months', v.amc_months,
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
