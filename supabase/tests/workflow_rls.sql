-- RLS + workflow RPC checks. Runs as a privileged role; uses a transaction rollback.

begin;

create extension if not exists pgcrypto;

do $$
declare
  sales_id uuid := gen_random_uuid();
  accounts_id uuid := gen_random_uuid();
  store_id uuid := gen_random_uuid();
  instance uuid := '00000000-0000-0000-0000-000000000000';
  v_quote uuid;
  v_customer uuid;
  v_version uuid;
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
     crypt('test-pass', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

  update public.profiles set role = 'accounts' where id = accounts_id;
  update public.profiles set role = 'store' where id = store_id;

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

  perform public.submit_quote(v_quote);

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
  perform public.send_quote_to_customer(v_quote);

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
end;
$$;

rollback;
