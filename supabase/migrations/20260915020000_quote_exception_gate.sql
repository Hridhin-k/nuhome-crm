-- Straight quotes (no discount, margin at or above floor) skip Accounts.

alter table public.company_settings
  add column if not exists min_quote_margin_percent numeric(5, 2) not null default 0
  check (min_quote_margin_percent >= -100 and min_quote_margin_percent <= 100);

insert into public.workflow_transitions (from_status, to_status)
values ('quote_draft', 'quote_approved')
on conflict (from_status, to_status) do nothing;

create or replace function public.submit_quote(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  q public.quotes;
  v public.quote_versions;
  o public.orders;
  qi record;
  min_margin numeric(5, 2);
  needs_accounts boolean;
  next_status public.workflow_status;
begin
  actor := public.require_permission('quotes.submit');
  select * into q from public.quotes where id = p_quote_id;
  if q.id is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  select * into v from public.quote_versions where id = q.current_version_id;
  select coalesce(min_quote_margin_percent, 0)
    into min_margin
    from public.company_settings
    where id = 1;
  needs_accounts :=
    coalesce(v.discount, 0) > 0.009
    or coalesce(v.margin_percent, 0) < coalesce(min_margin, 0);
  next_status := case
    when needs_accounts then 'quote_pending_accounts'::public.workflow_status
    else 'quote_approved'::public.workflow_status
  end;

  perform public.assert_transition(q.status, next_status);
  perform public.allow_status();
  update public.quotes
    set
      status = next_status,
      submitted_at = now(),
      revision_pending = case when next_status = 'quote_approved' then false else revision_pending end,
      public_access_token = case
        when next_status = 'quote_approved'
          then coalesce(public_access_token, public.generate_quote_public_token())
        else public_access_token
      end
    where id = q.id;
  update public.quote_versions
    set
      status = next_status,
      rejection_reason = case when next_status = 'quote_approved' then null else rejection_reason end,
      rejected_by = case when next_status = 'quote_approved' then null else rejected_by end,
      rejected_at = case when next_status = 'quote_approved' then null else rejected_at end
    where id = q.current_version_id;

  perform public.write_audit(
    actor.id, actor.role, 'QUOTE_SUBMITTED', 'quote', q.id,
    q.status::text, next_status::text,
    jsonb_build_object(
      'version_id', q.current_version_id,
      'needs_accounts', needs_accounts
    )
  );

  if next_status = 'quote_approved' then
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
      'quote_pending_accounts', 'quote_approved',
      jsonb_build_object('version_id', q.current_version_id, 'auto', true)
    );
  end if;
end;
$$;
