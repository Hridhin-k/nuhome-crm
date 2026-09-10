insert into public.role_permissions (role, permission)
values ('accounts', 'vendors.quote_approve')
on conflict do nothing;

create or replace function public.decide_vendor_quote(
  p_vendor_order_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  vo public.vendor_orders;
begin
  actor := public.require_permission('vendors.quote_approve');
  select * into vo from public.vendor_orders where id = p_vendor_order_id;
  if vo.id is null then
    raise exception 'Vendor batch not found' using errcode = 'P0002';
  end if;
  if vo.commercial_status not in ('quoted', 'quote_rejected') then
    raise exception 'This vendor quote is not waiting for a decision' using errcode = 'P0001';
  end if;
  if not p_approve and (p_reason is null or length(trim(p_reason)) = 0) then
    raise exception 'A reason is required to return a vendor quote' using errcode = '22023';
  end if;

  if p_approve then
    update public.vendor_orders
      set commercial_status = 'quote_approved',
          quote_approved_by = actor.id,
          quote_approved_at = now(),
          quote_rejection_reason = null
      where id = vo.id;
  else
    update public.vendor_orders
      set commercial_status = 'quote_rejected',
          quote_approved_by = null,
          quote_approved_at = null,
          quote_rejection_reason = trim(p_reason)
      where id = vo.id;
  end if;
end;
$$;
