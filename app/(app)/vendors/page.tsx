import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { VendorForm } from "@/components/vendors/vendor-form";
import { listVendors } from "@/lib/api/catalog";
import { requireUser } from "@/lib/auth/guards";
import { roleHasPermission } from "@/lib/auth/permissions";

export default async function VendorsPage() {
  const user = await requireUser();
  const vendors = await listVendors();
  const canWrite = roleHasPermission(user.role, "orders.send_to_vendor");

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Used when sending an activated order."
        action={canWrite ? <VendorForm /> : null}
      />
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
          {vendors.map((vendor) => (
            <li
              key={vendor.id}
              className="rounded-xl border border-surface-variant bg-surface-container-lowest px-4 py-4"
            >
              <p className="font-medium">{vendor.name}</p>
              <p className="text-sm text-on-surface-variant">
                {vendor.phone ?? vendor.email ?? "No contact"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
