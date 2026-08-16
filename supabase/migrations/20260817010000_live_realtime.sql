-- Realtime + RLS needs the full row so filters (user_id, role policies) apply.

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'notifications',
    'quotes',
    'orders',
    'payments',
    'vendor_orders',
    'deliveries',
    'customers'
  ]
  loop
    execute format('alter table public.%I replica identity full', tbl);

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
