-- Workflow foundation: unified status, versioning extras, RPCs, RLS.
-- Depends on 20260813120000_phase1_schema_auth.sql

-- ---------------------------------------------------------------------------
-- Unified workflow status
-- ---------------------------------------------------------------------------

create type public.workflow_status as enum (
  'quote_draft',
  'quote_pending_accounts',
  'quote_rejected',
  'quote_approved',
  'quote_sent_to_customer',
  'payment_pending_verification',
  'order_active',
  'sent_to_vendor',
  'vendor_dispatched',
  'items_received',
  'delivery_pending_payment',
  'order_on_hold',
  'delivery_unlocked',
  'delivered',
  'closed'
);

drop table if exists public.quote_status_transitions;
drop table if exists public.order_status_transitions;

alter table public.quotes alter column status drop default;
alter table public.quotes
  alter column status type public.workflow_status
  using (
    case status::text
      when 'draft' then 'quote_draft'
      when 'pending_accounts' then 'quote_pending_accounts'
      when 'rejected' then 'quote_rejected'
      when 'approved' then 'quote_approved'
      when 'sent_to_customer' then 'quote_sent_to_customer'
      else status::text
    end::public.workflow_status
  );
alter table public.quotes alter column status set default 'quote_draft';

alter table public.quote_versions alter column status drop default;
alter table public.quote_versions
  alter column status type public.workflow_status
  using (
    case status::text
      when 'draft' then 'quote_draft'
      when 'pending_accounts' then 'quote_pending_accounts'
      when 'rejected' then 'quote_rejected'
      when 'approved' then 'quote_approved'
      when 'sent_to_customer' then 'quote_sent_to_customer'
      else status::text
    end::public.workflow_status
  );
alter table public.quote_versions alter column status set default 'quote_draft';

alter table public.orders alter column status drop default;
alter table public.orders
  alter column status type public.workflow_status
  using (
    case status::text
      when 'quote_sent_to_customer' then 'quote_sent_to_customer'
      when 'payment_pending_verification' then 'payment_pending_verification'
      when 'order_active' then 'order_active'
      when 'sent_to_vendor' then 'sent_to_vendor'
      when 'vendor_dispatched' then 'vendor_dispatched'
      when 'items_received' then 'items_received'
      when 'delivery_pending_payment' then 'delivery_pending_payment'
      when 'order_on_hold' then 'order_on_hold'
      when 'delivery_unlocked' then 'delivery_unlocked'
      when 'delivered' then 'delivered'
      when 'closed' then 'closed'
      else status::text
    end::public.workflow_status
  );
alter table public.orders alter column status set default 'quote_sent_to_customer';

alter table public.quotes
  add constraint quotes_status_phase check (
    status in (
      'quote_draft',
      'quote_pending_accounts',
      'quote_rejected',
      'quote_approved',
      'quote_sent_to_customer'
    )
  );

alter table public.quote_versions
  add constraint quote_versions_status_phase check (
    status in (
      'quote_draft',
      'quote_pending_accounts',
      'quote_rejected',
      'quote_approved',
      'quote_sent_to_customer'
    )
  );

drop type if exists public.quote_status;
drop type if exists public.order_status;

create table public.workflow_transitions (
  from_status public.workflow_status not null,
  to_status public.workflow_status not null,
  primary key (from_status, to_status)
);

insert into public.workflow_transitions (from_status, to_status) values
  ('quote_draft', 'quote_pending_accounts'),
  ('quote_pending_accounts', 'quote_approved'),
  ('quote_pending_accounts', 'quote_rejected'),
  ('quote_rejected', 'quote_draft'),
  ('quote_approved', 'quote_sent_to_customer'),
  ('quote_sent_to_customer', 'payment_pending_verification'),
  ('payment_pending_verification', 'order_active'),
  ('payment_pending_verification', 'delivery_unlocked'),
  ('payment_pending_verification', 'order_on_hold'),
  ('order_active', 'sent_to_vendor'),
  ('sent_to_vendor', 'vendor_dispatched'),
  ('vendor_dispatched', 'items_received'),
  ('items_received', 'delivery_pending_payment'),
  ('delivery_pending_payment', 'delivery_unlocked'),
  ('delivery_pending_payment', 'order_on_hold'),
  ('order_on_hold', 'payment_pending_verification'),
  ('delivery_unlocked', 'delivered'),
  ('delivered', 'closed');

alter table public.workflow_transitions enable row level security;
create policy workflow_transitions_read on public.workflow_transitions
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Extra columns
-- ---------------------------------------------------------------------------

alter table public.quote_versions
  add column if not exists margin_percent numeric(8, 4),
  add column if not exists rejected_by uuid references public.profiles (id),
  add column if not exists rejected_at timestamptz;

alter table public.quotes
  add column if not exists submitted_at timestamptz,
  add column if not exists sent_at timestamptz;

alter table public.orders
  add column if not exists activated_at timestamptz,
  add column if not exists on_hold_reason text;

alter table public.order_items
  add column if not exists quantity_pending numeric(12, 3)
    generated always as (quantity - quantity_received) stored;

alter table public.order_items
  drop constraint if exists order_items_received_chk;
alter table public.order_items
  add constraint order_items_received_chk check (quantity_received >= 0 and quantity_received <= quantity);

alter table public.vendor_orders
  add column if not exists expected_delivery_at date,
  add column if not exists notes text;

alter table public.vendor_order_items
  add column if not exists quantity_received numeric(12, 3) not null default 0;

alter table public.vendor_order_items
  add column if not exists quantity_pending numeric(12, 3)
    generated always as (quantity - quantity_received) stored;

alter table public.vendor_order_items
  drop constraint if exists vendor_order_items_received_chk;
alter table public.vendor_order_items
  add constraint vendor_order_items_received_chk
  check (quantity_received >= 0 and quantity_received <= quantity);

create index if not exists quotes_created_by_idx on public.quotes (created_by);
create index if not exists quotes_status_idx on public.quotes (status);
create index if not exists quotes_customer_idx on public.quotes (customer_id);
create index if not exists quote_versions_quote_idx on public.quote_versions (quote_id);
create index if not exists quote_items_version_idx on public.quote_items (version_id);
create index if not exists payments_quote_idx on public.payments (quote_id);
create index if not exists payments_order_idx on public.payments (order_id);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists vendor_orders_order_idx on public.vendor_orders (order_id);

alter table public.quotes drop constraint if exists quotes_current_version_fk;
alter table public.quotes
  add constraint quotes_current_version_fk
  foreign key (current_version_id) references public.quote_versions (id)
  deferrable initially deferred;

-- ---------------------------------------------------------------------------
-- Status lock: only workflow RPCs may change status
-- ---------------------------------------------------------------------------

create or replace function public.enforce_workflow_status()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if current_setting('nuhome.allow_status', true) is distinct from '1' then
      raise exception 'Status changes must go through workflow functions'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_enforce_status on public.quotes;
create trigger quotes_enforce_status
before update on public.quotes
for each row execute function public.enforce_workflow_status();

drop trigger if exists orders_enforce_status on public.orders;
create trigger orders_enforce_status
before update on public.orders
for each row execute function public.enforce_workflow_status();

create or replace function public.allow_status()
returns void
language plpgsql
as $$
begin
  perform set_config('nuhome.allow_status', '1', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid()
$$;

create or replace function public.require_permission(required text)
returns public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null or not p.is_active then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not public.has_permission(required) then
    raise exception 'Missing permission: %', required using errcode = '42501';
  end if;
  return p;
end;
$$;

create or replace function public.assert_transition(
  p_from public.workflow_status,
  p_to public.workflow_status
)
returns void
language plpgsql
stable
as $$
begin
  if not exists (
    select 1 from public.workflow_transitions
    where from_status = p_from and to_status = p_to
  ) then
    raise exception 'Invalid transition: % → %', p_from, p_to using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.write_audit(
  p_actor uuid,
  p_role public.app_role,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_old_state text,
  p_new_state text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, old_state, new_state, metadata
  ) values (
    p_actor, p_role, p_action, p_entity_type, p_entity_id, p_old_state, p_new_state,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into rid;
  return rid;
end;
$$;

create type public.balance_snapshot as (
  order_total numeric,
  verified_payments numeric,
  outstanding numeric
);

create or replace function public.quote_balance(p_quote_id uuid)
returns public.balance_snapshot
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(qv.total, 0),
    coalesce((
      select sum(p.amount) from public.payments p
      where p.quote_id = p_quote_id and p.status = 'verified'
    ), 0),
    coalesce(qv.total, 0) - coalesce((
      select sum(p.amount) from public.payments p
      where p.quote_id = p_quote_id and p.status = 'verified'
    ), 0)
  from public.quotes q
  left join public.quote_versions qv on qv.id = q.current_version_id
  where q.id = p_quote_id
$$;

create or replace function public.order_balance(p_order_id uuid)
returns public.balance_snapshot
language sql
stable
security definer
set search_path = public
as $$
  select public.quote_balance(o.quote_id)
  from public.orders o
  where o.id = p_order_id
$$;

create or replace function public.order_items_fully_received(p_order_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(bool_and(oi.quantity_received >= oi.quantity), false)
  from public.order_items oi
  where oi.order_id = p_order_id
$$;

create or replace function public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, payload)
  values (p_user_id, p_type, p_title, p_body, coalesce(p_payload, '{}'::jsonb));
end;
$$;

create or replace function public.recalc_version_totals(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric;
  v_discount numeric;
  v_tax numeric;
  v_cost numeric;
begin
  select
    coalesce(sum(unit_price * quantity), 0),
    coalesce(sum(discount), 0),
    coalesce(sum(tax), 0),
    coalesce(sum(unit_cost * quantity), 0)
  into v_subtotal, v_discount, v_tax, v_cost
  from public.quote_items
  where version_id = p_version_id;

  update public.quote_versions
  set
    subtotal = v_subtotal,
    discount = v_discount,
    tax = v_tax,
    total = v_subtotal - v_discount + v_tax,
    margin_amount = (v_subtotal - v_discount) - v_cost,
    margin_percent = case
      when (v_subtotal - v_discount) = 0 then 0
      else (((v_subtotal - v_discount) - v_cost) / (v_subtotal - v_discount)) * 100
    end
  where id = p_version_id;
end;
$$;

create or replace function public.insert_quote_items(p_version_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  i int := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Quote must have at least one item' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    i := i + 1;
    insert into public.quote_items (
      version_id, material_id, description, quantity, unit_price, unit_cost,
      discount, tax, line_total, sort_order
    ) values (
      p_version_id,
      nullif(item ->> 'material_id', '')::uuid,
      coalesce(item ->> 'description', 'Item'),
      (item ->> 'quantity')::numeric,
      (item ->> 'unit_price')::numeric,
      coalesce((item ->> 'unit_cost')::numeric, 0),
      coalesce((item ->> 'discount')::numeric, 0),
      coalesce((item ->> 'tax')::numeric, 0),
      ((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric)
        - coalesce((item ->> 'discount')::numeric, 0)
        + coalesce((item ->> 'tax')::numeric, 0),
      i
    );
  end loop;
end;
$$;
