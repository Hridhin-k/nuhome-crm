-- Internal helpers must not be callable by clients.

revoke all on function public.allow_status() from public, anon, authenticated;
revoke all on function public.insert_quote_items(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.recalc_version_totals(uuid) from public, anon, authenticated;
revoke all on function public.notify_user(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.enforce_workflow_status() from public, anon, authenticated;
revoke all on function public.require_permission(text) from public, anon, authenticated;

grant execute on function public.allow_status() to postgres, service_role;
grant execute on function public.insert_quote_items(uuid, jsonb) to postgres, service_role;
grant execute on function public.recalc_version_totals(uuid) to postgres, service_role;
grant execute on function public.notify_user(uuid, text, text, text, jsonb) to postgres, service_role;
