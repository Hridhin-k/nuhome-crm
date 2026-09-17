-- Home counts in one round trip. Latest order per customer for the customer list.
-- Floor job rows for paginated quote lists (live status = order status when present).

create or replace function public.floor_counts()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  quote_counts jsonb;
  order_counts jsonb;
begin
  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
  into quote_counts
  from (
    select status::text as status, count(*)::int as n
    from public.quotes
    where status in (
      'quote_draft',
      'quote_pending_accounts',
      'quote_rejected',
      'quote_approved'
    )
    group by status
  ) s;

  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
  into order_counts
  from (
    select status::text as status, count(*)::int as n
    from public.orders
    group by status
  ) s;

  return jsonb_build_object(
    'quote_counts', quote_counts,
    'order_counts', order_counts,
    'customers', (select count(*)::int from public.customers),
    'pending_approvals', (
      select count(*)::int from public.quotes where status = 'quote_pending_accounts'
    ),
    'pending_payments', (
      select count(*)::int from public.payments where status = 'pending'
    ),
    'credit_requested', (
      select count(*)::int
      from public.orders
      where credit_delivery_status = 'requested'
    ),
    'revision_pending', (
      select count(*)::int from public.quotes where revision_pending
    ),
    'overdue_orders', (
      select count(distinct vo.order_id)::int
      from public.vendor_orders vo
      where vo.status in ('sent', 'dispatched')
        and vo.expected_delivery_at is not null
        and vo.expected_delivery_at::date
          < (timezone('Asia/Kolkata', now()))::date
    ),
    'vendor_quoted', (
      select count(distinct vo.order_id)::int
      from public.vendor_orders vo
      where vo.commercial_status = 'quoted'
    ),
    'catalog_users', (select count(*)::int from public.profiles),
    'catalog_vendors', (select count(*)::int from public.vendors),
    'catalog_materials', (select count(*)::int from public.materials)
  );
end;
$$;

create or replace function public.customer_latest_orders(p_ids uuid[])
returns table (
  customer_id uuid,
  order_id uuid,
  order_number text,
  status public.workflow_status
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (o.customer_id)
    o.customer_id,
    o.id,
    o.order_number,
    o.status
  from public.orders o
  where o.customer_id = any (p_ids)
  order by
    o.customer_id,
    case
      when o.status in ('delivered', 'closed', 'cancelled') then 1
      else 0
    end,
    o.updated_at desc;
$$;

create or replace view public.floor_jobs
with (security_invoker = true) as
select
  q.id,
  q.quote_number,
  q.status as quote_status,
  q.updated_at,
  q.created_at,
  q.created_by,
  q.revision_pending,
  c.name as customer_name,
  c.phone as customer_phone,
  p.full_name as created_by_name,
  o.id as order_id,
  o.order_number,
  o.status as order_status,
  coalesce(o.status, q.status) as live_status,
  v.total as version_total
from public.quotes q
left join public.customers c on c.id = q.customer_id
left join public.profiles p on p.id = q.created_by
left join public.quote_versions v on v.id = q.current_version_id
left join lateral (
  select id, order_number, status
  from public.orders
  where quote_id = q.id
  order by created_at desc
  limit 1
) o on true;

grant execute on function public.floor_counts() to authenticated;
grant execute on function public.customer_latest_orders(uuid[]) to authenticated;
grant select on public.floor_jobs to authenticated;
