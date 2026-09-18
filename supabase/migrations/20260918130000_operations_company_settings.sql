-- Operations (catalog.manage) can edit company letterhead / GSTIN like Admin.

drop policy if exists company_settings_update on public.company_settings;
create policy company_settings_update on public.company_settings
  for update to authenticated
  using (
    public.has_permission('admin.manage')
    or public.has_permission('catalog.manage')
  )
  with check (
    public.has_permission('admin.manage')
    or public.has_permission('catalog.manage')
  );
