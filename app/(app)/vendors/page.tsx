import { importVendorsCsvAction } from "@/app/actions/admin";
import { AdminCatalogNav } from "@/components/admin/admin-catalog-nav";
import { CsvImportSheet } from "@/components/admin/csv-import-sheet";
import { EmptyState } from "@/components/app/empty-state";
import { Notice } from "@/components/app/notice";
import { PageFrame } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { VendorForm } from "@/components/vendors/vendor-form";
import { listVendors } from "@/lib/api/catalog";
import { requireUser } from "@/lib/auth/guards";
import { rolesHavePermission } from "@/lib/auth/permissions";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const [user, { notice }] = await Promise.all([
    requireUser(),
    searchParams,
  ]);
  const isAdmin = rolesHavePermission(user.roles, "admin.manage");
  const vendors = await listVendors({
    includeInactive: isAdmin,
  });
  const canWrite = rolesHavePermission(user.roles, "orders.send_to_vendor");

  return (
    <PageFrame>
      <PageHeader
        title="Vendors"
        hideTitleOnMobile
        description="Used when sending an activated order."
        action={
          canWrite ? (
            <div className="flex flex-col items-end gap-2 sm:flex-row">
              {isAdmin ? (
                <CsvImportSheet
                  title="Import vendors"
                  description="Columns: name, phone, email, notes. Rows that match an existing name + phone are skipped."
                  templateName="nuhome-vendors.csv"
                  templateHeaders={["name", "phone", "email", "notes"]}
                  templateRows={[
                    ["Kerala Modular Hub", "9876500001", "hub@example.com", "Kitchen units"],
                    ["Hardware Mart", "9876500002", "", "Hinges and channels"],
                  ]}
                  action={importVendorsCsvAction}
                />
              ) : null}
              <VendorForm />
            </div>
          ) : null
        }
      />
      {isAdmin ? <AdminCatalogNav current="/vendors" /> : null}
      {notice === "vendor-saved" ? <Notice>Vendor saved.</Notice> : null}
      {vendors.length === 0 ? (
        <EmptyState
          title="No vendors yet"
          description="Add a vendor before sending an activated order."
          action={
            canWrite ? <VendorForm triggerClassName="w-full" /> : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {vendors.map((vendor) => {
            const contacts = vendor.vendor_contacts ?? [];
            return (
              <li
                key={vendor.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-outline-variant bg-card p-4 shadow-card"
              >
                <div className="min-w-0">
                  <p className="font-medium">{vendor.name}</p>
                  <p className="text-sm text-on-surface-variant">
                    {vendor.phone ?? vendor.email ?? "No contact"}
                    {vendor.is_active ? "" : " · inactive"}
                  </p>
                  {contacts.length > 0 ? (
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {contacts
                        .map(
                          (contact) =>
                            `${contact.name}${contact.phone ? ` ${contact.phone}` : ""}`,
                        )
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
                {canWrite ? (
                  <VendorForm
                    vendor={{
                      id: vendor.id,
                      name: vendor.name,
                      phone: vendor.phone,
                      email: vendor.email,
                      notes: vendor.notes,
                      is_active: vendor.is_active,
                      contacts: contacts.map((contact) => ({
                        name: contact.name,
                        phone: contact.phone ?? "",
                        email: contact.email ?? "",
                      })),
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </PageFrame>
  );
}
