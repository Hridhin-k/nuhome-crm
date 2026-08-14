-- Production polish: audit activity reads + WhatsApp share logging

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
        or q.created_by = auth.uid()
      )
  );
$$;

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
        or o.assigned_sales_id = auth.uid()
        or (
          public.has_permission('orders.send_to_vendor')
          and o.status in (
            'order_active', 'sent_to_vendor', 'vendor_dispatched', 'items_received',
            'delivery_pending_payment', 'order_on_hold', 'delivery_unlocked', 'delivered', 'closed'
          )
        )
        or (
          public.has_permission('deliveries.complete')
          and o.status in (
            'delivery_unlocked', 'delivered', 'closed', 'order_on_hold',
            'delivery_pending_payment', 'items_received'
          )
        )
      )
  );
$$;

create or replace function public.list_quote_activity(p_quote_id uuid)
returns table (
  id uuid,
  actor_id uuid,
  actor_role public.app_role,
  actor_name text,
  action text,
  entity_type text,
  entity_id uuid,
  old_state text,
  new_state text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_read_quote(p_quote_id) then
    raise exception 'You don''t have permission to view this activity' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    a.actor_id,
    a.actor_role,
    coalesce(p.full_name, 'System') as actor_name,
    a.action,
    a.entity_type,
    a.entity_id,
    a.old_state,
    a.new_state,
    a.metadata,
    a.created_at
  from public.audit_logs a
  left join public.profiles p on p.id = a.actor_id
  where
    (a.entity_type = 'quote' and a.entity_id = p_quote_id)
    or (
      a.entity_type = 'order'
      and a.entity_id in (select o.id from public.orders o where o.quote_id = p_quote_id)
    )
    or (
      a.entity_type = 'payment'
      and a.entity_id in (select pay.id from public.payments pay where pay.quote_id = p_quote_id)
    )
  order by a.created_at desc
  limit 100;
end;
$$;

create or replace function public.list_order_activity(p_order_id uuid)
returns table (
  id uuid,
  actor_id uuid,
  actor_role public.app_role,
  actor_name text,
  action text,
  entity_type text,
  entity_id uuid,
  old_state text,
  new_state text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
begin
  if not public.can_read_order(p_order_id) then
    raise exception 'You don''t have permission to view this activity' using errcode = '42501';
  end if;

  select o.quote_id into v_quote_id from public.orders o where o.id = p_order_id;

  return query
  select
    a.id,
    a.actor_id,
    a.actor_role,
    coalesce(p.full_name, 'System') as actor_name,
    a.action,
    a.entity_type,
    a.entity_id,
    a.old_state,
    a.new_state,
    a.metadata,
    a.created_at
  from public.audit_logs a
  left join public.profiles p on p.id = a.actor_id
  where
    (a.entity_type = 'order' and a.entity_id = p_order_id)
    or (v_quote_id is not null and a.entity_type = 'quote' and a.entity_id = v_quote_id)
    or (
      a.entity_type = 'payment'
      and a.entity_id in (select pay.id from public.payments pay where pay.order_id = p_order_id)
    )
    or (
      a.entity_type = 'vendor_order'
      and a.entity_id in (select vo.id from public.vendor_orders vo where vo.order_id = p_order_id)
    )
  order by a.created_at desc
  limit 100;
end;
$$;

create or replace function public.log_quote_whatsapp_share(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  q public.quotes;
begin
  actor := public.require_permission('quotes.send_to_customer');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.status not in ('quote_approved', 'quote_sent_to_customer') then
    raise exception 'Only approved or sent quotes can be shared with the customer' using errcode = 'P0001';
  end if;
  if q.created_by <> actor.id and actor.role <> 'admin' then
    raise exception 'Only the owning sales user can share this quote' using errcode = '42501';
  end if;

  perform public.write_audit(
    actor.id,
    actor.role,
    'QUOTE_SHARED_VIA_WHATSAPP',
    'quote',
    q.id,
    q.status::text,
    q.status::text,
    '{}'::jsonb
  );
end;
$$;

grant execute on function public.list_quote_activity(uuid) to authenticated;
grant execute on function public.list_order_activity(uuid) to authenticated;
grant execute on function public.log_quote_whatsapp_share(uuid) to authenticated;

revoke all on function public.can_read_quote(uuid) from public, anon, authenticated;
revoke all on function public.can_read_order(uuid) from public, anon, authenticated;
