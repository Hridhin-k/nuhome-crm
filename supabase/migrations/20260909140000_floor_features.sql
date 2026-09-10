-- Add Super Accounts enum in its own transaction.
-- Postgres cannot use a new enum value in the same transaction as ADD VALUE.

alter type public.app_role add value if not exists 'super_accounts';
