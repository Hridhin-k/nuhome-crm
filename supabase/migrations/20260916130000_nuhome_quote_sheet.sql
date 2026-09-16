alter table public.company_settings
  add column if not exists bank_branch text;

update public.company_settings
set
  legal_name = coalesce(nullif(btrim(legal_name), ''), 'NUHOME'),
  address = coalesce(
    nullif(btrim(address), ''),
    'SHLOKA 21/720-1' || chr(10) || 'NADATHRA MAIN ROAD, KACHERY' || chr(10) || 'THRISSUR-680751'
  ),
  phone = coalesce(nullif(btrim(phone), ''), '9249088304'),
  gstin = coalesce(nullif(btrim(gstin), ''), '32AAYFN3323P1ZP'),
  bank_name = coalesce(nullif(btrim(bank_name), ''), 'ICICI BANK'),
  bank_account = coalesce(nullif(btrim(bank_account), ''), '536405000074'),
  bank_ifsc = coalesce(nullif(btrim(bank_ifsc), ''), 'ICIC0005364'),
  bank_branch = coalesce(nullif(btrim(bank_branch), ''), 'Paravattani Branch')
where id = 1;

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
      'legal_name', coalesce(company.legal_name, 'NUHOME'),
      'gstin', company.gstin,
      'address', company.address,
      'phone', company.phone,
      'email', company.email,
      'bank_name', company.bank_name,
      'bank_account', company.bank_account,
      'bank_ifsc', company.bank_ifsc,
      'bank_branch', company.bank_branch,
      'upi_id', company.upi_id
    ),
    'customer', (
      select jsonb_build_object(
        'name', c.name,
        'phone', c.phone,
        'firm', c.firm,
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
