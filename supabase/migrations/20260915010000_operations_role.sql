-- Add Operations enum in its own transaction (required after ADD VALUE).

alter type public.app_role add value if not exists 'operations';
