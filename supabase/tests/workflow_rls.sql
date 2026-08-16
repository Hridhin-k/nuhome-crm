-- RLS + workflow RPC checks. Runs as a privileged role; uses a transaction rollback.

begin;

create extension if not exists pgcrypto;

do $$
declare
  sales_id uuid := gen_random_uuid();
  accounts_id uuid := gen_random_uuid();
  store_id uuid := gen_random_uuid();
  procurement_id uuid := gen_random_uuid();
  instance uuid := '00000000-0000-0000-0000-000000000000';
  v_quote uuid;
  v_customer uuid;
  v_version uuid;
  v_payment uuid;
  v_item uuid;
  v_vendor_a uuid;
  v_vendor_b uuid;
  v_vo_a uuid;
  v_vo_b uuid;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values
    (instance, sales_id, 'authenticated', 'authenticated', 'rls-sales@nuhome.test',
     crypt('test-pass', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (instance, accounts_id, 'authenticated', 'authenticated', 'rls-accounts@nuhome.test',
     crypt('test-pass', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (instance, store_id, 'authenticated', 'authenticated', 'rls-store@nuhome.test',
     crypt('test-pass', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (instance, procurement_id, 'authenticated', 'authenticated', 'rls-proc@nuhome.test',
     crypt('test-pass', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

  update public.profiles set role = 'accounts' where id = accounts_id;
  update public.profiles set role = 'store' where id = store_id;
  update public.profiles set role = 'procurement' where id = procurement_id;
  delete from public.profile_roles pr
    using public.profiles p
    where pr.profile_id = p.id
      and p.id in (accounts_id, store_id, procurement_id)
      and pr.role is distinct from p.role;

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', sales_id, 'role', 'authenticated')::text, true);

  insert into public.customers (name, created_by)
  values ('RLS Customer', sales_id)
  returning id into v_customer;

  v_quote := public.create_quote(
    v_customer,
    '[{"description":"Door","quantity":1,"unit_price":1000,"unit_cost":400}]'::jsonb,
    'test'
  );

  if (select status from public.quotes where id = v_quote) <> 'quote_draft' then
    raise exception 'create_quote should start in quote_draft';
  end if;

  v_version := public.revise_quote(
    v_quote,
    '[{"description":"Door","quantity":1,"unit_price":1100,"unit_cost":400}]'::jsonb,
    'saved draft'
  );
  if (select count(*) from public.quote_versions qv where qv.quote_id = v_quote) <> 1 then
    raise exception 'draft revise_quote must update in place';
  end if;

  insert into public.customers (name, phone, created_by)
  values ('Phone One', '9990001111', sales_id);
  begin
    insert into public.customers (name, phone, created_by)
    values ('Phone Two', '+91 99900 01111', sales_id);
    raise exception 'duplicate normalized phone must fail';
  exception
    when unique_violation then
      null;
    when others then
      if sqlerrm like '%duplicate normalized phone%' then raise; end if;
  end;

  perform public.submit_quote(v_quote);

  if not exists (
    select 1 from public.notifications
    where user_id = accounts_id and type = 'QUOTE_SUBMITTED'
  ) then
    raise exception 'accounts not notified on quote submit';
  end if;
  if exists (
    select 1 from public.notifications
    where user_id = sales_id and type = 'QUOTE_SUBMITTED'
  ) then
    raise exception 'sales must not be notified of their own submit';
  end if;

  -- Sales cannot approve
  begin
    perform public.approve_quote(v_quote);
    raise exception 'sales must not approve quotes';
  exception
    when others then
      if sqlerrm like '%sales must not approve%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', accounts_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', accounts_id, 'role', 'authenticated')::text, true);

  -- Reject without reason should fail
  begin
    perform public.reject_quote(v_quote, '');
    raise exception 'empty reject reason must fail';
  exception
    when others then
      if sqlerrm like '%empty reject reason%' then raise; end if;
  end;

  perform public.reject_quote(v_quote, 'Margin too thin');

  if (select rejection_reason from public.quote_versions
      where id = (select current_version_id from public.quotes where id = v_quote))
     is distinct from 'Margin too thin' then
    raise exception 'rejection reason not stored';
  end if;

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', sales_id, 'role', 'authenticated')::text, true);

  v_version := public.revise_quote(
    v_quote,
    '[{"description":"Door","quantity":1,"unit_price":1200,"unit_cost":400}]'::jsonb,
    'revised'
  );

  if (select count(*) from public.quote_versions qv where qv.quote_id = v_quote) <> 2 then
    raise exception 'revise_quote must insert a new version, not overwrite';
  end if;

  perform public.submit_quote(v_quote);

  perform set_config('request.jwt.claim.sub', accounts_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', accounts_id, 'role', 'authenticated')::text, true);
  perform public.approve_quote(v_quote);

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', sales_id, 'role', 'authenticated')::text, true);

  v_version := public.revise_quote(
    v_quote,
    '[{"description":"Door","quantity":1,"unit_price":1250,"unit_cost":400}]'::jsonb,
    'correction'
  );
  if (select status from public.quotes where id = v_quote) <> 'quote_draft' then
    raise exception 'approved revise_quote must return to quote_draft';
  end if;
  if (select count(*) from public.quote_versions qv where qv.quote_id = v_quote) <> 3 then
    raise exception 'approved revise_quote must insert a new version';
  end if;

  perform public.submit_quote(v_quote);
  perform set_config('request.jwt.claim.sub', accounts_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', accounts_id, 'role', 'authenticated')::text, true);
  perform public.approve_quote(v_quote);

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', sales_id, 'role', 'authenticated')::text, true);
  perform public.send_quote_to_customer(v_quote);

  v_payment := public.record_payment(v_quote, 'advance', 100, 'upi', 'bad-upi');
  begin
    perform public.reject_payment(v_payment, 'Wrong amount');
    raise exception 'sales must not reject payments';
  exception
    when others then
      if sqlerrm like '%sales must not reject%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', accounts_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', accounts_id, 'role', 'authenticated')::text, true);
  begin
    perform public.reject_payment(v_payment, '');
    raise exception 'empty payment reject reason must fail';
  exception
    when others then
      if sqlerrm like '%empty payment reject%' then raise; end if;
  end;
  perform public.reject_payment(v_payment, 'Wrong UPI amount');
  if (select status from public.payments where id = v_payment) <> 'rejected' then
    raise exception 'reject_payment should mark the payment rejected';
  end if;

  perform set_config('request.jwt.claim.sub', store_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', store_id, 'role', 'authenticated')::text, true);
  begin
    perform public.complete_delivery((select id from public.orders where quote_id = v_quote));
    raise exception 'store must not deliver before unlock';
  exception
    when others then
      if sqlerrm like '%store must not deliver%' then raise; end if;
  end;

  if not exists (
    select 1 from public.audit_logs where action = 'QUOTE_REJECTED' and entity_id = v_quote
  ) then
    raise exception 'missing QUOTE_REJECTED audit';
  end if;

  -- Split vendor, partial GRN, shortage write-off, Store collect at handover
  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', sales_id, 'role', 'authenticated')::text, true);

  v_quote := public.create_quote(
    v_customer,
    '[{"description":"Kitchen","quantity":10,"unit_price":1000,"unit_cost":400}]'::jsonb,
    'fulfillment'
  );
  perform public.submit_quote(v_quote);

  perform set_config('request.jwt.claim.sub', accounts_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', accounts_id, 'role', 'authenticated')::text, true);
  perform public.approve_quote(v_quote);

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', sales_id, 'role', 'authenticated')::text, true);
  perform public.send_quote_to_customer(v_quote);
  v_payment := public.record_payment(v_quote, 'advance', 1000, 'upi', 'adv-1');

  perform set_config('request.jwt.claim.sub', accounts_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', accounts_id, 'role', 'authenticated')::text, true);
  perform public.verify_payment(v_payment);

  if (select o.status from public.orders o where o.quote_id = v_quote) <> 'order_active' then
    raise exception 'expected order_active after verified advance';
  end if;

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', sales_id, 'role', 'authenticated')::text, true);
  v_payment := public.record_payment(v_quote, 'advance', 200, 'upi', 'install-1');
  if (select o.status from public.orders o where o.quote_id = v_quote) <> 'order_active' then
    raise exception 'installment must leave the order on the vendor path';
  end if;
  perform set_config('request.jwt.claim.sub', accounts_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', accounts_id, 'role', 'authenticated')::text, true);
  perform public.verify_payment(v_payment);
  if (select o.status from public.orders o where o.quote_id = v_quote) <> 'order_active' then
    raise exception 'verified installment must not change vendor-stage status';
  end if;
  if not exists (
    select 1 from public.notifications
    where user_id = accounts_id and type = 'PAYMENT_RECORDED'
  ) then
    raise exception 'accounts not notified when payment is recorded';
  end if;
  if not exists (
    select 1 from public.notifications
    where user_id = procurement_id and type = 'ORDER_ACTIVATED'
  ) then
    raise exception 'procurement not notified when order becomes active';
  end if;

  select oi.id into v_item
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.quote_id = v_quote;

  perform set_config('request.jwt.claim.sub', procurement_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', procurement_id, 'role', 'authenticated')::text, true);

  insert into public.vendors (name) values ('Vendor A') returning id into v_vendor_a;
  insert into public.vendors (name) values ('Vendor B') returning id into v_vendor_b;

  v_vo_a := public.send_order_to_vendor(
    (select id from public.orders where quote_id = v_quote),
    v_vendor_a,
    jsonb_build_array(jsonb_build_object('order_item_id', v_item, 'quantity', 6)),
    (current_date - 1)
  );
  v_vo_b := public.send_order_to_vendor(
    (select id from public.orders where quote_id = v_quote),
    v_vendor_b,
    jsonb_build_array(jsonb_build_object('order_item_id', v_item, 'quantity', 4)),
    (current_date + 7)
  );

  if (select count(*) from public.vendor_orders vo
      join public.orders o on o.id = vo.order_id
      where o.quote_id = v_quote) <> 2 then
    raise exception 'expected two vendor batches';
  end if;

  perform set_config('request.jwt.claim.sub', store_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', store_id, 'role', 'authenticated')::text, true);

  if not exists (select 1 from public.orders where quote_id = v_quote) then
    raise exception 'store should see in-transit orders';
  end if;

  begin
    perform public.record_payment(v_quote, 'advance', 9000, 'cash', 'door');
    raise exception 'store must not record payment before handover';
  exception
    when others then
      if sqlerrm like '%store must not record%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', procurement_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', procurement_id, 'role', 'authenticated')::text, true);
  perform public.mark_vendor_dispatched(v_vo_a);
  perform public.mark_vendor_dispatched(v_vo_b);

  if not exists (
    select 1 from public.notifications
    where user_id = sales_id and type = 'VENDOR_DISPATCHED'
  ) then
    raise exception 'sales not notified of vendor dispatch';
  end if;

  perform public.record_items_received(
    v_vo_a,
    jsonb_build_array(jsonb_build_object('order_item_id', v_item, 'quantity', 5))
  );

  if (select o.status from public.orders o where o.quote_id = v_quote) <> 'vendor_dispatched' then
    raise exception 'partial GRN must not close the order';
  end if;
  if (select vo.status from public.vendor_orders vo where vo.id = v_vo_a) <> 'dispatched' then
    raise exception 'partial GRN must leave the vendor batch open';
  end if;

  perform public.write_off_order_items(
    (select id from public.orders where quote_id = v_quote),
    jsonb_build_array(jsonb_build_object(
      'order_item_id', v_item, 'quantity', 1, 'reason', 'shortage'
    )),
    'one missing'
  );

  if (select oi.quantity_written_off from public.order_items oi where oi.id = v_item) <> 1 then
    raise exception 'write-off quantity not stored';
  end if;
  if (select voi.quantity_written_off from public.vendor_order_items voi
      where voi.vendor_order_id = v_vo_a) <> 1 then
    raise exception 'shortage should close the partially received vendor line';
  end if;
  if (select voi.quantity_written_off from public.vendor_order_items voi
      where voi.vendor_order_id = v_vo_b) <> 0 then
    raise exception 'other vendor batch should stay open';
  end if;

  perform public.record_items_received(
    v_vo_b,
    jsonb_build_array(jsonb_build_object('order_item_id', v_item, 'quantity', 4))
  );

  if (select o.status from public.orders o where o.quote_id = v_quote) <> 'order_on_hold' then
    raise exception 'expected on hold after goods with outstanding';
  end if;
  if not exists (
    select 1 from public.notifications
    where user_id = sales_id and type = 'ORDER_PLACED_ON_HOLD'
  ) then
    raise exception 'sales not notified when order goes on hold';
  end if;

  perform set_config('request.jwt.claim.sub', store_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', store_id, 'role', 'authenticated')::text, true);
  v_payment := public.record_payment(v_quote, 'advance', 8800, 'cash', 'door');

  perform set_config('request.jwt.claim.sub', accounts_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', accounts_id, 'role', 'authenticated')::text, true);
  perform public.verify_payment(v_payment);

  if (select o.status from public.orders o where o.quote_id = v_quote) <> 'delivery_unlocked' then
    raise exception 'expected delivery_unlocked after store collect';
  end if;
  if not exists (
    select 1 from public.notifications
    where user_id = store_id and type = 'DELIVERY_UNLOCKED'
  ) then
    raise exception 'store not notified when delivery is unlocked';
  end if;

  perform set_config('request.jwt.claim.sub', store_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', store_id, 'role', 'authenticated')::text, true);
  perform public.complete_delivery((select id from public.orders where quote_id = v_quote));

  if not exists (
    select 1 from public.notifications
    where user_id = sales_id and type = 'ORDER_DELIVERED'
  ) then
    raise exception 'sales not notified when order is delivered';
  end if;
end;
$$;

-- Extra hats + leave cover (users from the previous block still exist in this txn).
do $$
declare
  sales_id uuid;
  admin_id uuid := gen_random_uuid();
  cover_id uuid := gen_random_uuid();
  instance uuid := '00000000-0000-0000-0000-000000000000';
  moved jsonb;
  v_customer uuid;
  v_dead uuid;
  v_store_block uuid;
  store_id uuid;
begin
  select id into sales_id from auth.users where email = 'rls-sales@nuhome.test';
  select id into store_id from auth.users where email = 'rls-store@nuhome.test';
  if sales_id is null then
    raise exception 'expected sales user from prior test block';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values
    (instance, admin_id, 'authenticated', 'authenticated', 'rls-admin@nuhome.test',
     crypt('test-pass', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (instance, cover_id, 'authenticated', 'authenticated', 'rls-cover@nuhome.test',
     crypt('test-pass', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

  update public.profiles set role = 'admin' where id = admin_id;
  delete from public.profile_roles where profile_id = admin_id and role is distinct from 'admin';

  perform set_config('request.jwt.claim.sub', cover_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', cover_id, 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.customers) then
    raise exception 'floor book: sales should see colleagues'' customers';
  end if;
  if not exists (select 1 from public.quotes) then
    raise exception 'floor book: sales should see colleagues'' quotes';
  end if;

  insert into public.profile_roles (profile_id, role)
  values (sales_id, 'store')
  on conflict do nothing;

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', sales_id, 'role', 'authenticated')::text, true);

  if not public.has_permission('deliveries.complete') then
    raise exception 'sales + store hat should grant deliveries.complete';
  end if;
  if not public.has_permission('quotes.create') then
    raise exception 'sales hat should still grant quotes.create';
  end if;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);

  moved := public.reassign_sales_cover(sales_id, cover_id);
  if coalesce((moved ->> 'customers')::int, 0) < 1 then
    raise exception 'cover should move customers, got %', moved;
  end if;
  if exists (select 1 from public.customers where created_by = sales_id) then
    raise exception 'away sales still owns customers after cover';
  end if;

  if not exists (select 1 from public.company_settings where id = 1) then
    raise exception 'company_settings seed missing';
  end if;

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', sales_id, 'role', 'authenticated')::text, true);

  insert into public.customers (name, created_by, gstin, billing_address, site_address)
  values ('GST Customer', sales_id, '32ABCDE1234F1Z5', 'Showroom street', 'Site plot 12')
  returning id into v_customer;

  if (select billing_address from public.customers where id = v_customer) is distinct from 'Showroom street' then
    raise exception 'billing_address did not save';
  end if;

  insert into public.attachments (entity_type, entity_id, storage_path, kind, uploaded_by, file_name)
  values ('customer', v_customer, 'customer/' || v_customer || '/sheet.pdf', 'measurement', sales_id, 'sheet.pdf');

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);

  insert into public.materials (name, sku, unit)
  values ('GST Test Panel', 'GST-TEST-1', 'pcs');
  if (select gst_rate from public.materials where sku = 'GST-TEST-1') <> 18 then
    raise exception 'materials should default to 18 percent GST';
  end if;

  update public.company_settings set legal_name = 'Nuhome Interiors' where id = 1;
  if (select legal_name from public.company_settings where id = 1) is distinct from 'Nuhome Interiors' then
    raise exception 'admin should update company_settings';
  end if;
  update public.company_settings set legal_name = 'Nuhome' where id = 1;

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', sales_id, 'role', 'authenticated')::text, true);

  v_dead := public.create_quote(
    v_customer,
    '[{"description":"Dead job","quantity":1,"unit_price":500,"unit_cost":200}]'::jsonb,
    'cancel me'
  );
  perform public.cancel_job(v_dead, 'Customer walked away');
  if (select status from public.quotes where id = v_dead) <> 'cancelled' then
    raise exception 'sales should cancel a quote that will never complete';
  end if;

  v_store_block := public.create_quote(
    v_customer,
    '[{"description":"Store cannot","quantity":1,"unit_price":500,"unit_cost":200}]'::jsonb,
    'store'
  );
  perform set_config('request.jwt.claim.sub', store_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', store_id, 'role', 'authenticated')::text, true);
  begin
    perform public.cancel_job(v_store_block, 'Store trying');
    raise exception 'store must not cancel a job';
  exception
    when insufficient_privilege then
      null;
    when others then
      if sqlerrm like '%store must not cancel%' then raise; end if;
  end;
  if (select status from public.quotes where id = v_store_block) <> 'quote_draft' then
    raise exception 'store cancel must leave the quote as a draft';
  end if;
end;
$$;

rollback;
