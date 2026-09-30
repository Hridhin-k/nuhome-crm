-- Specs on each material (colour, dimensions, ...) and customer links for the
-- quotation and the tax invoice that keep working for the life of the job.

alter table public.materials
  add column if not exists specs jsonb not null default '[]'::jsonb;

alter table public.materials
  drop constraint if exists materials_specs_is_array;
alter table public.materials
  add constraint materials_specs_is_array check (jsonb_typeof(specs) = 'array');

-- ---------------------------------------------------------------------------
-- Quotation link: any time after approval, until the job is cancelled
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

  if o.id is not null and o.status = 'cancelled' then
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

grant execute on function public.get_public_quote(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tax invoice link, opened with the same token as the quotation
-- ---------------------------------------------------------------------------

create or replace function public.get_public_invoice(p_token text)
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

  if q.id is null or q.status not in ('quote_approved', 'quote_sent_to_customer') then
    return null;
  end if;

  select * into o
  from public.orders
  where quote_id = q.id
  order by created_at desc
  limit 1;

  if o.id is null or o.status = 'cancelled' or o.invoice_number is null then
    return null;
  end if;

  select * into v
  from public.quote_versions
  where id = q.current_version_id;

  if v.id is null then
    return null;
  end if;

  select * into company from public.company_settings where id = 1;
  select p.full_name into salesman
  from public.profiles p
  where p.id = coalesce(o.assigned_sales_id, q.created_by);

  return jsonb_build_object(
    'invoice_number', o.invoice_number,
    'issued_at', o.invoice_issued_at,
    'quote_number', q.quote_number,
    'order_number', o.order_number,
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
        'address', c.address,
        'billing_address', coalesce(c.billing_address, c.address),
        'site_address', coalesce(c.site_address, c.billing_address, c.address)
      )
      from public.customers c
      where c.id = q.customer_id
    ),
    'version', jsonb_build_object(
      'total', v.total,
      'notes', v.notes
    ),
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'description', qi.description,
            'specification', qi.specification,
            'item_code', qi.item_code,
            'quantity', qi.quantity,
            'unit_price', qi.unit_price,
            'discount', qi.discount,
            'tax', qi.tax,
            'line_total', qi.line_total,
            'hsn_code', qi.hsn_code,
            'gst_rate', qi.gst_rate,
            'supply_source', qi.supply_source,
            'quantity_handed_over', qi.quantity_handed_over
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

revoke all on function public.get_public_invoice(text) from public;
grant execute on function public.get_public_invoice(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- WhatsApp share log for the quotation or the tax invoice
-- ---------------------------------------------------------------------------

drop function if exists public.log_quote_whatsapp_share(uuid);

create or replace function public.log_quote_whatsapp_share(
  p_quote_id uuid,
  p_document text default 'quote'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  q public.quotes;
  o public.orders;
  v_invoice text;
begin
  actor := public.require_permission('quotes.send_to_customer');
  if p_document not in ('quote', 'invoice') then
    raise exception 'Choose the quotation or the bill' using errcode = '22023';
  end if;
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.status not in ('quote_approved', 'quote_sent_to_customer') then
    raise exception 'Only an approved quote can be shared with the customer' using errcode = 'P0001';
  end if;

  select * into o
  from public.orders
  where quote_id = q.id
  order by created_at desc
  limit 1;

  if o.id is not null and o.status = 'cancelled' then
    raise exception 'This job was cancelled' using errcode = 'P0001';
  end if;

  if p_document = 'invoice' then
    if o.id is null then
      raise exception 'There is no bill until the quote becomes an order' using errcode = 'P0001';
    end if;
    v_invoice := o.invoice_number;
    if v_invoice is null then
      v_invoice := 'INV-' || lpad(nextval('public.tax_invoice_seq')::text, 4, '0');
      update public.orders
        set invoice_number = v_invoice, invoice_issued_at = now()
        where id = o.id and invoice_number is null;
      select invoice_number into v_invoice from public.orders where id = o.id;
    end if;
  end if;

  perform public.write_audit(
    actor.id,
    actor.role,
    case when p_document = 'invoice' then 'INVOICE_SHARED_VIA_WHATSAPP' else 'QUOTE_SHARED_VIA_WHATSAPP' end,
    'quote',
    q.id,
    q.status::text,
    q.status::text,
    case when p_document = 'invoice'
      then jsonb_build_object('invoice_number', v_invoice, 'order_id', o.id)
      else '{}'::jsonb
    end
  );

  return v_invoice;
end;
$$;

revoke all on function public.log_quote_whatsapp_share(uuid, text) from public, anon;
grant execute on function public.log_quote_whatsapp_share(uuid, text) to authenticated;
