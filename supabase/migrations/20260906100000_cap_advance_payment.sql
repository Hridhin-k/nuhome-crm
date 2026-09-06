-- Cap advance/full payments at the outstanding (verified) balance.

create or replace function public.enforce_payment_not_over_outstanding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bal public.balance_snapshot;
begin
  if new.kind = 'nil' then
    return new;
  end if;

  select * into bal from public.quote_balance(new.quote_id);
  if bal.outstanding is not null and new.amount > bal.outstanding then
    raise exception 'Amount cannot be more than the outstanding balance of %',
      bal.outstanding
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists payments_cap_amount on public.payments;
create trigger payments_cap_amount
before insert on public.payments
for each row
execute function public.enforce_payment_not_over_outstanding();
