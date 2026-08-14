-- All profiles are customers; retire lead as the default kind.
update public.customers
set kind = 'customer'
where kind = 'lead';

alter table public.customers
  alter column kind set default 'customer';
