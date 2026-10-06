-- Notification routing: task notices go to whoever holds the permission for the
-- next step; personal notices go to the specific person involved. The actor is
-- never notified, and each user gets at most one notice per job per transaction.

create or replace function public.format_inr(p_amount numeric)
returns text
language plpgsql
immutable
as $$
declare
  v_int text;
  v_head text;
begin
  if p_amount is null then
    return null;
  end if;
  v_int := round(abs(p_amount))::bigint::text;
  if length(v_int) > 3 then
    v_head := left(v_int, length(v_int) - 3);
    v_head := regexp_replace(v_head, '(\d)(?=(\d{2})+$)', '\1,', 'g');
    v_int := v_head || ',' || right(v_int, 3);
  end if;
  return case when p_amount < 0 then '-' else '' end || '₹' || v_int;
end;
$$;

create or replace function public.users_with_permission(
  p_permission text,
  p_include_admin boolean default false
)
returns uuid[]
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(array_agg(distinct pr.profile_id), '{}'::uuid[])
  from public.profile_roles pr
  join public.role_permissions rp on rp.role = pr.role
  where rp.permission = p_permission
    and (p_include_admin or pr.role <> 'admin');
$$;

create or replace function public.users_with_role(p_role public.app_role)
returns uuid[]
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(array_agg(distinct pr.profile_id), '{}'::uuid[])
  from public.profile_roles pr
  where pr.role = p_role;
$$;

create or replace function public.notify_users(
  p_user_ids uuid[],
  p_type text,
  p_title text,
  p_body text,
  p_payload jsonb default '{}'::jsonb,
  p_except_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_key text := coalesce(
    v_payload ->> 'order_id',
    v_payload ->> 'quote_id',
    v_payload ->> 'stock_purchase_id'
  );
begin
  if p_user_ids is null or cardinality(p_user_ids) = 0 then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, payload)
  select p.id, p_type, p_title, p_body, v_payload
  from public.profiles p
  where p.id = any (p_user_ids)
    and p.is_active
    and p.id is distinct from p_except_user_id
    and (
      v_key is null
      or not exists (
        select 1
        from public.notifications n
        where n.user_id = p.id
          and n.created_at = now()
          and coalesce(
            n.payload ->> 'order_id',
            n.payload ->> 'quote_id',
            n.payload ->> 'stock_purchase_id'
          ) = v_key
      )
    );
end;
$$;

create or replace function public.notify_role(
  p_role public.app_role,
  p_type text,
  p_title text,
  p_body text,
  p_payload jsonb default '{}'::jsonb,
  p_except_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.notify_users(
    public.users_with_role(p_role), p_type, p_title, p_body, p_payload, p_except_user_id
  );
end;
$$;

create or replace function public.notify_assigned_sales(
  p_order_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_payload jsonb default '{}'::jsonb,
  p_except_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  sales_id uuid;
begin
  select o.assigned_sales_id into sales_id from public.orders o where o.id = p_order_id;
  perform public.notify_users(
    array[sales_id], p_type, p_title, p_body, p_payload, p_except_user_id
  );
end;
$$;

create or replace function public.notify_from_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_quote_id uuid;
  v_order_id uuid;
  v_quote_no text;
  v_order_no text;
  v_cust_name text;
  v_item_summary text;
  v_created_by uuid;
  v_sales_id uuid;
  v_recorder uuid;
  v_payload jsonb;
  v_body text;
  v_status_label text;
  v_actor_name text;
  v_to_user uuid;
  v_from_user uuid;
  v_to_name text;
  v_from_name text;
  v_outstanding numeric;
  v_purchase_no text;
  v_vendor_name text;
  v_purchase_by uuid;
  v_roles text;
  v_fulfillment_states text[] := array[
    'order_active', 'sent_to_vendor', 'vendor_dispatched', 'items_received'
  ];
begin
  if new.action not in (
    'QUOTE_SUBMITTED',
    'QUOTE_APPROVED',
    'PAYMENT_RECORDED',
    'PAYMENT_VERIFIED',
    'PAYMENT_REJECTED',
    'ORDER_ACTIVATED',
    'VENDOR_QUOTE_SUBMITTED',
    'VENDOR_DISPATCHED',
    'DELIVERY_UNLOCKED',
    'ORDER_PLACED_ON_HOLD',
    'CREDIT_DELIVERY_REQUESTED',
    'CREDIT_DELIVERY_DECIDED',
    'ORDER_DELIVERED',
    'ORDER_CANCELLED',
    'QUOTE_CANCELLED',
    'WORK_REASSIGNED',
    'ROLE_CHANGED',
    'STOCK_PURCHASE_SENT',
    'STOCK_RECEIVED'
  ) then
    return new;
  end if;

  select p.full_name into v_actor_name from public.profiles p where p.id = new.actor_id;

  -- Staff and stock events carry their own context.
  if new.entity_type = 'profile' then
    if new.action = 'ROLE_CHANGED' then
      select string_agg(initcap(replace(r, '_', ' ')), ', ')
      into v_roles
      from jsonb_array_elements_text(coalesce(new.metadata -> 'roles', '[]'::jsonb)) r;
      perform public.notify_users(
        array[new.entity_id],
        'ROLE_CHANGED',
        'Your access changed',
        coalesce('You now have: ' || v_roles || '.', 'Your roles were updated.'),
        jsonb_build_object('roles', new.metadata -> 'roles'),
        new.actor_id
      );
    elsif new.action = 'WORK_REASSIGNED' then
      v_from_user := new.entity_id;
      v_to_user := nullif(new.metadata ->> 'to_user_id', '')::uuid;
      select full_name into v_from_name from public.profiles where id = v_from_user;
      select full_name into v_to_name from public.profiles where id = v_to_user;
      perform public.notify_users(
        array[v_to_user],
        'WORK_REASSIGNED',
        'Covering for ' || coalesce(v_from_name, 'a colleague'),
        concat_ws(
          ' · ',
          coalesce(new.metadata ->> 'quotes', '0') || ' quotes',
          coalesce(new.metadata ->> 'orders', '0') || ' orders',
          coalesce(new.metadata ->> 'customers', '0') || ' customers'
        ) || ' moved to you.',
        jsonb_build_object('from_user_id', v_from_user, 'to_user_id', v_to_user),
        new.actor_id
      );
      perform public.notify_users(
        array[v_from_user],
        'WORK_REASSIGNED',
        'Your work was reassigned',
        'Open quotes and orders moved to ' || coalesce(v_to_name, 'a colleague') || '.',
        jsonb_build_object('from_user_id', v_from_user, 'to_user_id', v_to_user),
        new.actor_id
      );
    end if;
    return new;
  end if;

  if new.entity_type = 'stock_purchase' then
    select sp.purchase_number, v.name, sp.created_by
    into v_purchase_no, v_vendor_name, v_purchase_by
    from public.stock_purchases sp
    left join public.vendors v on v.id = sp.vendor_id
    where sp.id = new.entity_id;
    v_payload := jsonb_build_object(
      'stock_purchase_id', new.entity_id,
      'purchase_number', v_purchase_no,
      'vendor_name', v_vendor_name
    );
    v_body := concat_ws(' · ', v_purchase_no, v_vendor_name);
    if new.action = 'STOCK_PURCHASE_SENT' then
      perform public.notify_users(
        public.users_with_permission('stock.receive'),
        'STOCK_PURCHASE_SENT',
        'Office stock on the way',
        v_body || '. Record what arrives.',
        v_payload,
        new.actor_id
      );
    elsif new.action = 'STOCK_RECEIVED' then
      perform public.notify_users(
        array[v_purchase_by],
        'STOCK_RECEIVED',
        'Office stock received',
        v_body || '. Received by ' || coalesce(v_actor_name, 'the store') || '.',
        v_payload,
        new.actor_id
      );
    end if;
    return new;
  end if;

  -- Job events: resolve quote, order and the people attached to them.
  if new.entity_type = 'quote' then
    v_quote_id := new.entity_id;
  elsif new.entity_type = 'order' then
    v_order_id := new.entity_id;
  elsif new.entity_type = 'payment' then
    select p.quote_id, p.order_id, p.recorded_by
    into v_quote_id, v_order_id, v_recorder
    from public.payments p
    where p.id = new.entity_id;
  end if;

  if v_quote_id is null and v_order_id is not null then
    select o.quote_id into v_quote_id from public.orders o where o.id = v_order_id;
  end if;
  if v_order_id is null and v_quote_id is not null then
    select o.id into v_order_id from public.orders o where o.quote_id = v_quote_id;
  end if;
  if v_quote_id is not null then
    select q.quote_number, c.name, q.created_by
    into v_quote_no, v_cust_name, v_created_by
    from public.quotes q
    join public.customers c on c.id = q.customer_id
    where q.id = v_quote_id;
    select string_agg(qi.description, ', ')
    into v_item_summary
    from public.quote_items qi
    join public.quotes q on q.current_version_id = qi.version_id
    where q.id = v_quote_id;
  end if;
  if v_order_id is not null then
    select o.order_number, o.assigned_sales_id
    into v_order_no, v_sales_id
    from public.orders o
    where o.id = v_order_id;
  end if;

  v_status_label := case coalesce(new.new_state, '')
    when 'quote_pending_accounts' then 'Pending'
    when 'quote_approved' then 'Approved'
    when 'payment_pending_verification' then 'Verify pay'
    when 'order_active' then 'Active'
    when 'sent_to_vendor' then 'With vendor'
    when 'vendor_dispatched' then 'Dispatched'
    when 'items_received' then 'Received'
    when 'order_on_hold' then 'On hold'
    when 'delivery_unlocked' then 'Ready'
    when 'delivered' then 'Delivered'
    when 'cancelled' then 'Cancelled'
    else null
  end;

  v_body := concat_ws(
    ' · ',
    v_cust_name,
    v_status_label,
    coalesce(v_order_no, v_quote_no),
    left(v_item_summary, 80)
  );
  if v_body is null or length(v_body) = 0 then
    v_body := coalesce(v_order_no, v_quote_no, 'A job');
  end if;
  v_body := v_body || '. ';

  v_payload := coalesce(new.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'quote_id', v_quote_id,
      'order_id', v_order_id,
      'quote_number', v_quote_no,
      'order_number', v_order_no,
      'customer_name', v_cust_name
    );

  case new.action
    when 'QUOTE_SUBMITTED' then
      if coalesce((new.metadata ->> 'needs_accounts')::boolean, true)
         and new.new_state is distinct from 'quote_approved' then
        perform public.notify_users(
          public.users_with_permission('quotes.approve'),
          'QUOTE_SUBMITTED',
          'Quote to approve',
          v_body || 'Check price, discount and margin.',
          v_payload,
          new.actor_id
        );
      end if;

    when 'QUOTE_APPROVED' then
      perform public.notify_users(
        array[v_created_by],
        'QUOTE_APPROVED',
        'Quote approved',
        v_body || 'Approved by ' || coalesce(v_actor_name, 'Accounts') || '. Send it to the customer.',
        v_payload,
        new.actor_id
      );

    when 'PAYMENT_RECORDED' then
      perform public.notify_users(
        public.users_with_permission('payments.verify'),
        'PAYMENT_RECORDED',
        'Payment to verify',
        v_body || coalesce(public.format_inr((new.metadata ->> 'amount')::numeric) || ' ', '')
          || 'recorded by ' || coalesce(v_actor_name, 'Sales') || '.',
        v_payload,
        new.actor_id
      );

    when 'PAYMENT_VERIFIED' then
      perform public.notify_users(
        array[v_recorder, v_sales_id],
        'PAYMENT_VERIFIED',
        'Payment verified',
        v_body || case new.metadata ->> 'order_status'
          when 'order_active' then 'Order is active and going to a vendor.'
          when 'delivery_unlocked' then 'Ready for handover.'
          when 'order_on_hold' then
            coalesce(public.format_inr((new.metadata ->> 'outstanding')::numeric), 'Balance')
              || ' still due before handover.'
          else 'Recorded against the order.'
        end,
        v_payload,
        new.actor_id
      );

    when 'PAYMENT_REJECTED' then
      perform public.notify_users(
        array[v_recorder, v_sales_id],
        'PAYMENT_REJECTED',
        'Payment sent back',
        v_body || coalesce('Reason: ' || nullif(btrim(new.metadata ->> 'reason'), '') || '. ', '')
          || 'Record it again with the right details.',
        v_payload,
        new.actor_id
      );

    when 'ORDER_ACTIVATED' then
      perform public.notify_users(
        public.users_with_permission('orders.send_to_vendor'),
        'ORDER_ACTIVATED',
        'Ready for a vendor',
        v_body || 'Send it to a vendor.',
        v_payload,
        new.actor_id
      );

    when 'VENDOR_QUOTE_SUBMITTED' then
      perform public.notify_users(
        public.users_with_permission('vendors.quote_approve'),
        'VENDOR_QUOTE_SUBMITTED',
        'Vendor quote to verify',
        v_body || 'Check the vendor price before sending.',
        v_payload,
        new.actor_id
      );

    when 'VENDOR_DISPATCHED' then
      perform public.notify_users(
        array[v_sales_id],
        'VENDOR_DISPATCHED',
        'Vendor dispatched',
        v_body || 'On the way from the vendor.',
        v_payload,
        new.actor_id
      );
      perform public.notify_users(
        public.users_with_role('store'),
        'GOODS_INCOMING',
        'Goods on the way',
        v_body || 'Record what arrives.',
        v_payload,
        new.actor_id
      );

    when 'DELIVERY_UNLOCKED' then
      perform public.notify_users(
        array[v_sales_id] || public.users_with_role('store'),
        'DELIVERY_UNLOCKED',
        'Ready for handover',
        v_body || 'Delivery is unlocked.',
        v_payload,
        new.actor_id
      );

    when 'ORDER_PLACED_ON_HOLD' then
      perform public.notify_users(
        array[v_sales_id],
        'ORDER_PLACED_ON_HOLD',
        'Delivery on hold',
        v_body || coalesce(public.format_inr((new.metadata ->> 'outstanding')::numeric), 'Balance')
          || ' due before handover.',
        v_payload,
        new.actor_id
      );

    when 'CREDIT_DELIVERY_REQUESTED' then
      perform public.notify_users(
        public.users_with_permission('deliveries.credit_approve', true),
        'CREDIT_DELIVERY_REQUESTED',
        'Credit delivery to review',
        v_body || 'Requested by ' || coalesce(v_actor_name, 'Sales') || '.',
        v_payload,
        new.actor_id
      );

    when 'CREDIT_DELIVERY_DECIDED' then
      if new.new_state = 'approved' then
        perform public.notify_users(
          array[v_sales_id],
          'CREDIT_DELIVERY_DECIDED',
          'Credit delivery approved',
          v_body || 'You can hand over before the balance is paid.',
          v_payload,
          new.actor_id
        );
      else
        perform public.notify_users(
          array[v_sales_id],
          'CREDIT_DELIVERY_DECIDED',
          'Credit delivery declined',
          v_body || 'Collect the balance before handover.',
          v_payload,
          new.actor_id
        );
      end if;

    when 'ORDER_DELIVERED' then
      perform public.notify_users(
        array[v_sales_id],
        'ORDER_DELIVERED',
        'Order delivered',
        v_body || 'Handed over by ' || coalesce(v_actor_name, 'the store') || '.',
        v_payload,
        new.actor_id
      );
      if v_order_id is not null then
        select b.outstanding into v_outstanding from public.order_balance(v_order_id) b;
        if coalesce(v_outstanding, 0) > 0 then
          perform public.notify_users(
            public.users_with_permission('payments.verify'),
            'BALANCE_DUE',
            'Balance to collect',
            v_body || public.format_inr(v_outstanding) || ' still due after handover.',
            v_payload,
            new.actor_id
          );
        end if;
      end if;

    when 'ORDER_CANCELLED' then
      perform public.notify_users(
        array[v_sales_id],
        'ORDER_CANCELLED',
        'Order cancelled',
        v_body || 'Cancelled by ' || coalesce(v_actor_name, 'a colleague') || '.',
        v_payload,
        new.actor_id
      );
      if new.old_state = any (v_fulfillment_states) then
        perform public.notify_users(
          public.users_with_permission('orders.send_to_vendor'),
          'ORDER_CANCELLED',
          'Order cancelled',
          v_body || 'Stop any vendor work on this order.',
          v_payload,
          new.actor_id
        );
      elsif new.old_state = 'payment_pending_verification' then
        perform public.notify_users(
          public.users_with_permission('payments.verify'),
          'ORDER_CANCELLED',
          'Order cancelled',
          v_body || 'A payment was waiting for verification.',
          v_payload,
          new.actor_id
        );
      end if;

    when 'QUOTE_CANCELLED' then
      if new.old_state = 'quote_pending_accounts' then
        perform public.notify_users(
          public.users_with_permission('quotes.approve'),
          'QUOTE_CANCELLED',
          'Quote withdrawn',
          v_body || 'No approval needed.',
          v_payload,
          new.actor_id
        );
      elsif new.old_state = 'payment_pending_verification' then
        perform public.notify_users(
          public.users_with_permission('payments.verify'),
          'QUOTE_CANCELLED',
          'Quote cancelled',
          v_body || 'A payment was waiting for verification.',
          v_payload,
          new.actor_id
        );
      end if;

    when 'WORK_REASSIGNED' then
      v_to_user := nullif(new.metadata ->> 'to_user_id', '')::uuid;
      begin
        v_from_user := nullif(new.old_state, '')::uuid;
      exception when invalid_text_representation then
        v_from_user := null;
      end;
      select full_name into v_to_name from public.profiles where id = v_to_user;
      perform public.notify_users(
        array[v_to_user],
        'WORK_REASSIGNED',
        'Job assigned to you',
        v_body || 'Assigned by ' || coalesce(v_actor_name, 'a manager') || '.',
        v_payload,
        new.actor_id
      );
      if v_from_user is distinct from v_to_user then
        perform public.notify_users(
          array[v_from_user],
          'WORK_REASSIGNED',
          'Job reassigned',
          v_body || 'Now with ' || coalesce(v_to_name, 'a colleague') || '.',
          v_payload,
          new.actor_id
        );
      end if;

    else
      null;
  end case;

  return new;
end;
$$;

-- Approval notice now comes from the audit trigger with full job context.
create or replace function public.approve_quote(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  actor public.profiles;
  q public.quotes;
  o public.orders;
  qi record;
begin
  actor := public.require_permission('quotes.approve');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if q.created_by = actor.id then
    raise exception 'You cannot approve your own quote' using errcode = '42501';
  end if;
  perform public.assert_transition(q.status, 'quote_approved');
  perform public.allow_status();
  update public.quotes
  set
    status = 'quote_approved',
    revision_pending = false,
    public_access_token = coalesce(public_access_token, public.generate_quote_public_token())
  where id = q.id;
  update public.quote_versions
    set status = 'quote_approved', rejection_reason = null, rejected_by = null, rejected_at = null
    where id = q.current_version_id;
  insert into public.quote_approvals (quote_id, version_id, decided_by, decision)
  values (q.id, q.current_version_id, actor.id, 'approved');

  select * into o from public.orders where quote_id = q.id order by created_at desc limit 1;
  if o.id is not null then
    for qi in
      select * from public.quote_items where version_id = q.current_version_id
    loop
      if exists (
        select 1 from public.order_items oi
        where oi.order_id = o.id and oi.quote_item_id = qi.id
      ) then
        update public.order_items
          set quantity = qi.quantity, description = qi.description
          where order_id = o.id and quote_item_id = qi.id
            and quantity_received <= qi.quantity;
      elsif exists (
        select 1 from public.order_items oi
        where oi.order_id = o.id and oi.material_id is not distinct from qi.material_id
          and oi.description = qi.description
      ) then
        update public.order_items
          set quantity = greatest(quantity, qi.quantity)
          where order_id = o.id
            and material_id is not distinct from qi.material_id
            and description = qi.description;
      else
        insert into public.order_items (order_id, quote_item_id, material_id, description, quantity)
        values (o.id, qi.id, qi.material_id, qi.description, qi.quantity);
      end if;
    end loop;
  end if;

  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_APPROVED', 'quote', q.id,
    q.status::text, 'quote_approved',
    jsonb_build_object('version_id', q.current_version_id)
  );
end;
$function$;

-- Record the credit decision so the requesting salesperson is told either way.
create or replace function public.decide_credit_delivery(p_order_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  actor public.profiles;
  o public.orders;
  next_status public.workflow_status;
  received boolean;
begin
  actor := public.require_permission('deliveries.credit_approve');
  select * into o from public.orders where id = p_order_id;
  if o.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if o.assigned_sales_id = actor.id then
    raise exception 'You cannot approve your own credit delivery request' using errcode = '42501';
  end if;
  update public.orders
    set credit_delivery_status = case when p_approve then 'approved' else 'rejected' end
    where id = o.id;

  perform public.write_audit(
    actor.id, actor.role, 'CREDIT_DELIVERY_DECIDED', 'order', o.id,
    coalesce(o.credit_delivery_status::text, 'requested'),
    case when p_approve then 'approved' else 'rejected' end,
    jsonb_build_object('credit_delivery', case when p_approve then 'approved' else 'rejected' end)
  );

  if not p_approve then
    return;
  end if;

  received := public.order_items_fully_received(o.id);
  if o.status in ('quote_sent_to_customer', 'payment_pending_verification') then
    next_status := 'order_active';
  elsif o.status in ('delivery_pending_payment', 'order_on_hold')
     or (o.status = 'items_received' and received) then
    next_status := 'delivery_unlocked';
  else
    next_status := o.status;
  end if;

  if next_status is distinct from o.status then
    perform public.assert_transition(o.status, next_status);
    perform public.allow_status();
    update public.orders
      set status = next_status,
          activated_at = coalesce(activated_at, now()),
          on_hold_reason = null
      where id = o.id;
    perform public.write_audit(
      actor.id, actor.role,
      case when next_status = 'order_active' then 'ORDER_ACTIVATED' else 'DELIVERY_UNLOCKED' end,
      'order', o.id,
      o.status::text, next_status::text,
      jsonb_build_object('credit_delivery', 'approved')
    );
  else
    update public.orders
      set activated_at = coalesce(activated_at, now()),
          on_hold_reason = null
      where id = o.id;
  end if;
end;
$function$;

-- Live refresh for the stock screens.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stock_purchases'
  ) then
    alter publication supabase_realtime add table public.stock_purchases;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stock_movements'
  ) then
    alter publication supabase_realtime add table public.stock_movements;
  end if;
end;
$$;

revoke execute on function public.notify_users(uuid[], text, text, text, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.users_with_permission(text, boolean) from public, anon, authenticated;
revoke execute on function public.users_with_role(public.app_role) from public, anon, authenticated;
