import { AdminCatalogNav } from "@/components/admin/admin-catalog-nav";
import { CoverLeaveForm } from "@/components/admin/cover-leave-form";
import { CsvImportSheet } from "@/components/admin/csv-import-sheet";
import { CreateStaffForm, EditStaffForm } from "@/components/admin/staff-forms";
import { Notice } from "@/components/app/notice";
import { PageFrame, panelClass } from "@/components/app/page-frame";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";
import { importStaffCsvAction } from "@/app/actions/admin";
import { listCoverSales, listProfiles, profileRoles } from "@/lib/api/catalog";
import { requireAnyPermission } from "@/lib/auth/guards";
import { roleLabels } from "@/lib/auth/nav";
import type { AppRole } from "@/lib/workflow/types";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const [, { notice }, profiles] = await Promise.all([
    requireAnyPermission("admin.manage", "staff.manage"),
    searchParams,
    listProfiles(),
  ]);
  const coverPeople = listCoverSales(profiles);

  return (
    <PageFrame>
      <PageHeader
        title="Users"
        hideTitleOnMobile
        description="Add staff, extra hats, cover for leave, or import a CSV."
        action={
          <div className="flex flex-col items-end gap-2 sm:flex-row">
            {coverPeople.length >= 2 ? (
              <CoverLeaveForm people={coverPeople} />
            ) : null}
            <CsvImportSheet
              title="Import users"
              description="Columns: email, full_name, role, phone, password. Role is sales, accounts, procurement, store, operations, or admin. Password is optional — we generate one if blank. If any row is wrong, nothing is imported."
              templateName="nuhome-users.csv"
              templateHeaders={["email", "full_name", "role", "phone", "password"]}
              templateRows={[
                ["ravi.sales@nuhome.in", "Ravi Kumar", "sales", "9876543210", ""],
                ["priya.accounts@nuhome.in", "Priya Nair", "accounts", "9876543211", "ChangeMe123"],
              ]}
              action={importStaffCsvAction}
            />
            <CreateStaffForm />
          </div>
        }
      />
      <AdminCatalogNav current="/users" />
      {notice === "user-created" ? <Notice>User created. They can sign in now.</Notice> : null}
      {notice === "user-updated" ? <Notice>User updated.</Notice> : null}

      <ul className="flex flex-col gap-3">
        {profiles.map((profile) => {
          const roles = profileRoles(profile);
          return (
            <li
              key={profile.id}
              className={cn(panelClass, "flex items-start justify-between gap-3")}
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-subheading text-on-surface">
                  {profile.full_name || "Unnamed"}
                  {profile.is_active ? null : <Badge variant="secondary">Inactive</Badge>}
                </p>
                <p className="mt-0.5 text-body-sm text-on-surface-variant">
                  {profile.email ?? "No email"}
                  {profile.phone ? ` · ${profile.phone}` : ""}
                </p>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  {roleLabels(roles)}
                </p>
              </div>
              <EditStaffForm
                user={{
                  id: profile.id,
                  full_name: profile.full_name,
                  email: profile.email,
                  phone: profile.phone,
                  role: (profile.role as AppRole) ?? "sales",
                  roles,
                  is_active: profile.is_active,
                }}
              />
            </li>
          );
        })}
      </ul>
    </PageFrame>
  );
}
