import { AdminCatalogNav } from "@/components/admin/admin-catalog-nav";
import { CsvImportSheet } from "@/components/admin/csv-import-sheet";
import { CreateStaffForm, EditStaffForm } from "@/components/admin/staff-forms";
import { Notice } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { importStaffCsvAction } from "@/app/actions/admin";
import { listProfiles } from "@/lib/api/catalog";
import { requirePermission } from "@/lib/auth/guards";
import { roleLabel } from "@/lib/auth/nav";
import type { AppRole } from "@/lib/workflow/types";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const [, { notice }, profiles] = await Promise.all([
    requirePermission("admin.manage"),
    searchParams,
    listProfiles(),
  ]);

  return (
    <div>
      <PageHeader
        title="Users"
        description="Add staff, assign roles, or import a CSV."
        action={
          <div className="flex flex-col items-end gap-2 sm:flex-row">
            <CsvImportSheet
              title="Import users"
              description="Columns: email, full_name, role, phone, password. Role is sales, accounts, procurement, store, or admin. Password is optional — we generate one if blank."
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
        {profiles.map((profile) => (
          <li
            key={profile.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-surface-variant bg-surface-container-lowest px-4 py-4"
          >
            <div className="min-w-0">
              <p className="font-medium">{profile.full_name || "Unnamed"}</p>
              <p className="text-sm text-on-surface-variant">
                {profile.email ?? "No email"}
                {profile.phone ? ` · ${profile.phone}` : ""}
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                {roleLabel(profile.role as AppRole)}
                {profile.is_active ? "" : " · inactive"}
              </p>
            </div>
            <EditStaffForm
              user={{
                id: profile.id,
                full_name: profile.full_name,
                email: profile.email,
                phone: profile.phone,
                role: profile.role as AppRole,
                is_active: profile.is_active,
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
