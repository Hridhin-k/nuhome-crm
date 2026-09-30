import { importVendorsCsvAction } from "@/app/actions/admin";
import { AdminCatalogNav } from "@/components/admin/admin-catalog-nav";
import { CsvImportSheet } from "@/components/admin/csv-import-sheet";
import { EmptyState } from "@/components/app/empty-state";
import { Notice } from "@/components/app/notice";
import { PageFrame, panelClass } from "@/components/app/page-frame";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";
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
  const canCatalog =
    rolesHavePermission(user.roles, "admin.manage") ||
    rolesHavePermission(user.roles, "catalog.manage");
  const vendors = await listVendors({
    includeInactive: canCatalog,
  });
  const canWrite =
    canCatalog || rolesHavePermission(user.roles, "orders.send_to_vendor");

  return (
    <PageFrame>
      <PageHeader
        title="Vendors"
        hideTitleOnMobile
        description="Used when sending an activated order."
        action={
          canWrite ? (
            <div className="flex flex-col items-end gap-2 sm:flex-row">
              {canCatalog ? (
                <CsvImportSheet
                  title="Import vendors"
                  description="Columns: name, phone, email, notes. Rows that match an existing name + phone are skipped. If any row is wrong, nothing is imported."
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
      {canCatalog ? <AdminCatalogNav current="/vendors" /> : null}
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
                className={cn(panelClass, "flex items-start justify-between gap-3")}
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-subheading text-on-surface">
                    {vendor.name}
                    {vendor.is_active ? null : <Badge variant="secondary">Inactive</Badge>}
                  </p>
                  <p className="mt-0.5 text-body-sm text-on-surface-variant">
                    {vendor.phone ?? vendor.email ?? "No contact"}
                  </p>
                  {contacts.length > 0 ? (
                    <p className="mt-1 text-body-sm text-on-surface-variant">
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
