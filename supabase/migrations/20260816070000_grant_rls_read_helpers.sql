-- RLS helpers were revoked from authenticated so they couldn't be called as RPCs.
-- Policy expressions still run as the signed-in user, so Quotes / Home 500'd with
-- "permission denied for function can_read_order" / can_read_quote.

create or replace function public.can_read_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and (
        public.is_admin()
        or public.is_accounts()
        or public.has_role('sales')
        or o.assigned_sales_id = auth.uid()
        or (
          public.has_permission('orders.send_to_vendor')
          and o.status in (
            'order_active', 'sent_to_vendor', 'vendor_dispatched', 'items_received',
            'delivery_pending_payment', 'order_on_hold', 'delivery_unlocked',
            'delivered', 'closed', 'cancelled'
          )
        )
        or (
          public.has_permission('deliveries.complete')
          and o.status in (
            'sent_to_vendor', 'vendor_dispatched', 'items_received',
            'delivery_pending_payment', 'order_on_hold',
            'delivery_unlocked', 'delivered', 'closed', 'cancelled'
          )
        )
      )
  )
$$;

grant execute on function public.can_read_quote(uuid) to authenticated;
grant execute on function public.can_read_order(uuid) to authenticated;
grant execute on function public.can_view_order(uuid) to authenticated;
