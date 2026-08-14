-- Demo logins for local reset and manual testing. Password for every account: password123
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  demo record;
  uid uuid;
begin
  for demo in
    select *
    from (
      values
        ('sales@nuhome.demo'::text, 'sales'::public.app_role, 'Sales Demo'),
        ('accounts@nuhome.demo', 'accounts', 'Accounts Demo'),
        ('procurement@nuhome.demo', 'procurement', 'Procurement Demo'),
        ('store@nuhome.demo', 'store', 'Store Demo'),
        ('admin@nuhome.demo', 'admin', 'Admin Demo')
    ) as t(email, role, full_name)
  loop
    select u.id into uid from auth.users u where u.email = demo.email;

    if uid is null then
      uid := gen_random_uuid();

      insert into auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change,
        email_change_token_new,
        email_change_token_current
      )
      values (
        '00000000-0000-0000-0000-000000000000',
        uid,
        'authenticated',
        'authenticated',
        demo.email,
        extensions.crypt('password123', extensions.gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', demo.full_name),
        now(),
        now(),
        '',
        '',
        '',
        '',
        ''
      );

      insert into auth.identities (
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      values (
        uid,
        jsonb_build_object('sub', uid::text, 'email', demo.email),
        'email',
        uid::text,
        now(),
        now(),
        now()
      );
    else
      update auth.users
      set
        encrypted_password = extensions.crypt('password123', extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
          || jsonb_build_object('full_name', demo.full_name),
        updated_at = now()
      where id = uid;

      insert into auth.identities (
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      values (
        uid,
        jsonb_build_object('sub', uid::text, 'email', demo.email),
        'email',
        uid::text,
        now(),
        now(),
        now()
      )
      on conflict (provider_id, provider) do nothing;
    end if;

    insert into public.profiles (id, full_name, role, is_active)
    values (uid, demo.full_name, demo.role, true)
    on conflict (id) do update
    set
      full_name = excluded.full_name,
      role = excluded.role,
      is_active = true;
  end loop;
end $$;

-- Material catalogue for walk-in quoting
insert into public.material_categories (name)
values
  ('Modular Kitchen'),
  ('Wardrobes'),
  ('Bathroom'),
  ('Hardware'),
  ('Appliances'),
  ('Services')
on conflict (name) do nothing;

insert into public.materials (category_id, sku, name, unit, default_sell_price, default_cost)
select c.id, m.sku, m.name, m.unit, m.sell, m.cost
from (
  values
    ('Modular Kitchen', 'MK-BASE-600', 'Base cabinet 600mm', 'pcs', 8500, 5200),
    ('Modular Kitchen', 'MK-WALL-600', 'Wall cabinet 600mm', 'pcs', 6200, 3800),
    ('Modular Kitchen', 'MK-TALL-2100', 'Tall unit 2100mm', 'pcs', 14500, 9200),
    ('Modular Kitchen', 'MK-CORNER', 'Corner carousel unit', 'pcs', 12800, 8100),
    ('Modular Kitchen', 'MK-CT-GRANITE', 'Granite countertop', 'sqft', 320, 180),
    ('Modular Kitchen', 'MK-CT-QUARTZ', 'Quartz countertop', 'sqft', 480, 290),
    ('Modular Kitchen', 'MK-SINK-SS', 'SS sink with drainboard', 'pcs', 4200, 2600),
    ('Modular Kitchen', 'MK-FAUCET', 'Pull-out kitchen faucet', 'pcs', 2800, 1600),
    ('Wardrobes', 'WD-SLIDE-8', 'Sliding wardrobe 8ft', 'pcs', 42000, 26500),
    ('Wardrobes', 'WD-SWING-6', 'Swing wardrobe 6ft', 'pcs', 32000, 19800),
    ('Wardrobes', 'WD-LOFT', 'Loft storage unit', 'pcs', 9800, 6100),
    ('Wardrobes', 'WD-INTERNAL', 'Internal drawer set', 'set', 6500, 3900),
    ('Bathroom', 'BT-VANITY', 'Vanity cabinet with basin', 'pcs', 18500, 11200),
    ('Bathroom', 'BT-MIRROR', 'LED mirror cabinet', 'pcs', 7200, 4300),
    ('Bathroom', 'BT-SHOWER', 'Shower cubicle 900mm', 'pcs', 24000, 15200),
    ('Bathroom', 'BT-FLOOR', 'Anti-skid floor tiles', 'sqft', 95, 52),
    ('Hardware', 'HW-HINGE-SOFT', 'Soft-close hinge', 'pair', 450, 220),
    ('Hardware', 'HW-HANDLE', 'Cabinet handle', 'pcs', 180, 85),
    ('Hardware', 'HW-CHANNEL', 'Drawer channel 450mm', 'pair', 680, 340),
    ('Hardware', 'HW-LOCK', 'Main door lock set', 'set', 2200, 1200),
    ('Appliances', 'AP-HOB-3B', '3-burner built-in hob', 'pcs', 12500, 7800),
    ('Appliances', 'AP-CHIMNEY-60', 'Chimney 60cm', 'pcs', 9800, 6100),
    ('Appliances', 'AP-OVEN-BI', 'Built-in oven', 'pcs', 22000, 14500),
    ('Services', 'SV-INSTALL', 'Installation labour', 'day', 2500, 1500),
    ('Services', 'SV-DESIGN', 'Design consultation', 'visit', 1500, 800),
    ('Services', 'SV-DELIVERY', 'Site delivery', 'trip', 1200, 700)
) as m(category, sku, name, unit, sell, cost)
join public.material_categories c on c.name = m.category
on conflict (sku) do update
set
  name = excluded.name,
  unit = excluded.unit,
  default_sell_price = excluded.default_sell_price,
  default_cost = excluded.default_cost,
  category_id = excluded.category_id,
  is_active = true;
