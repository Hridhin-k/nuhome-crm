-- Reject only pending payments, and require a reason (already enforced).

create or replace function public.reject_payment(p_payment_id uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  pay public.payments;
begin
  actor := public.require_permission('payments.verify');
  if p_notes is null or btrim(p_notes) = '' then
    raise exception 'Rejection reason is required' using errcode = '22023';
  end if;
  select * into pay from public.payments where id = p_payment_id;
  if pay.id is null then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if pay.recorded_by = actor.id then
    raise exception 'You cannot reject a payment you recorded' using errcode = '42501';
  end if;
  if pay.status <> 'pending' then
    raise exception 'Payment is not pending verification' using errcode = 'P0001';
  end if;

  update public.payments set status = 'rejected' where id = pay.id;
  insert into public.payment_verifications (payment_id, decided_by, decision, notes)
  values (pay.id, actor.id, 'rejected', btrim(p_notes));
  perform public.write_audit(
    actor.id, actor.role, 'PAYMENT_REJECTED', 'payment', pay.id,
    'pending', 'rejected',
    jsonb_build_object('reason', btrim(p_notes), 'order_id', pay.order_id)
  );
end;
$$;
