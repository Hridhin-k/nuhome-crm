-- Operations must see payment-pending / quote-sent orders to approve credit delivery.
-- Previously can_read_order only opened post-activation statuses for send_to_vendor hats.

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
        or public.has_role('operations')
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

create or replace function public.can_read_quote(p_quote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quotes q
    where q.id = p_quote_id
      and (
        public.is_admin()
        or public.is_accounts()
        or public.has_role('operations')
        or public.has_role('sales')
        or q.created_by = auth.uid()
      )
  )
$$;

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select to authenticated
  using (
    public.is_admin()
    or public.is_accounts()
    or public.has_role('operations')
    or public.has_role('sales')
    or created_by = auth.uid()
    or exists (
      select 1 from public.orders o
      where o.customer_id = customers.id
    )
  );

grant execute on function public.can_read_quote(uuid) to authenticated;
grant execute on function public.can_read_order(uuid) to authenticated;
grant execute on function public.can_view_order(uuid) to authenticated;
