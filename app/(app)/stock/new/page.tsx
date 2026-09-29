import { PurchaseForm } from "@/components/stock/purchase-form";
import { PageFrame } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { listMaterials, listVendors } from "@/lib/api/catalog";
import { requirePermission } from "@/lib/auth/guards";

export default async function NewStockPurchasePage() {
  const [, vendors, materials] = await Promise.all([
    requirePermission("stock.purchase"),
    listVendors(),
    listMaterials(),
  ]);

  return (
    <PageFrame width="detail" className="flex flex-col gap-4">
      <PageHeader
        title="Buy office stock"
        description="This purchase is for the shelf. It is not tied to a customer."
      />
      {vendors.length === 0 || materials.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          Add a vendor and at least one material before buying stock.
        </p>
      ) : (
        <PurchaseForm
          vendors={vendors.map((vendor) => ({ id: vendor.id, name: vendor.name }))}
          materials={materials.map((material) => ({
            id: material.id,
            name: material.name,
            sku: material.sku,
            default_cost: material.default_cost,
          }))}
        />
      )}
    </PageFrame>
  );
}
