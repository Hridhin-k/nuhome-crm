-- Credit approval (and paid-in-full from hold) must be allowed to unlock delivery.
insert into public.workflow_transitions (from_status, to_status)
values
  ('order_on_hold', 'delivery_unlocked'),
  ('items_received', 'delivery_unlocked')
on conflict (from_status, to_status) do nothing;

-- Re-run unlock for credit-approved jobs stuck on money gates.
do $$
declare
  r record;
  received boolean;
  next_status public.workflow_status;
begin
  for r in
    select *
    from public.orders
    where credit_delivery_status = 'approved'
      and status in (
        'quote_sent_to_customer',
        'payment_pending_verification',
        'delivery_pending_payment',
        'order_on_hold',
        'items_received'
      )
  loop
    received := public.order_items_fully_received(r.id);
    if r.status in ('quote_sent_to_customer', 'payment_pending_verification') then
      next_status := 'order_active';
    elsif r.status in ('delivery_pending_payment', 'order_on_hold')
       or (r.status = 'items_received' and received) then
      next_status := 'delivery_unlocked';
    else
      continue;
    end if;

    perform public.allow_status();
    update public.orders
      set status = next_status,
          activated_at = coalesce(activated_at, now()),
          on_hold_reason = null
      where id = r.id;
  end loop;
end;
$$;
