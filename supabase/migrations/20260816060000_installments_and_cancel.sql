-- Add cancelled to the shared workflow enum (must commit before it can be used).

alter type public.workflow_status add value if not exists 'cancelled';
