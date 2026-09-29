-- PL/pgSQL treats a record variable named qi as the SQL alias qi, so reserve and handover never ran.

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
