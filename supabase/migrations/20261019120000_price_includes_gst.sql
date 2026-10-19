-- Material prices already include GST. Do not add GST on top of a line.

create or replace function public.quote_line_amounts(
  p_qty numeric,
  p_price numeric,
  p_percent numeric,
  p_rate numeric
)
returns table (
  discount numeric,
  tax numeric,
  line_total numeric,
  discount_percent numeric
)
language sql
immutable
as $$
  with input as (
    select
      round(coalesce(p_qty, 0) * coalesce(p_price, 0), 2) as base,
      round(least(100, greatest(0, coalesce(p_percent, 0))), 6) as pct
  )
  select
    round(base * pct / 100, 2) as discount,
    0::numeric as tax,
    base - round(base * pct / 100, 2) as line_total,
    pct as discount_percent
  from input;
$$;
