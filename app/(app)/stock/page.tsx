import { AppLink } from "@/components/app/app-link";
import { Notice } from "@/components/app/notice";
import { PageFrame } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { AdjustForm } from "@/components/stock/adjust-form";
import { listMaterials } from "@/lib/api/catalog";
import { listOfficeStock, listStockPurchases } from "@/lib/api/stock";
import { rel } from "@/lib/api/rel";
import { requirePermission } from "@/lib/auth/guards";
import { rolesHavePermission } from "@/lib/auth/permissions";
import { FormError } from "@/components/app/form-error";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requirePermission("stock.read");
  const [{ notice, error }, stock, materials, purchases] = await Promise.all([
    searchParams,
    listOfficeStock(),
    listMaterials(),
    listStockPurchases(),
  ]);
  const names = new Map(materials.map((material) => [material.id, material]));
  const canAdjust = rolesHavePermission(user.roles, "stock.adjust");
  const onHand = stock
    .map((row) => ({
      ...row,
      name: names.get(row.material_id)?.name ?? "Material",
      sku: names.get(row.material_id)?.sku ?? null,
      available: Number(row.available),
    }))
    .filter((row) => row.available > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageFrame className="flex flex-col gap-6">
      <PageHeader
        title="Office stock"
        description="Pieces already at the office. Set the quantity on each material."
      />
      {notice === "adjusted" ? <Notice>Stock count updated.</Notice> : null}
      {notice === "sent" ? <Notice>Purchase sent. Store can receive it.</Notice> : null}
      {error ? <FormError>{error}</FormError> : null}

      <section className="rounded-2xl border border-outline-variant bg-card p-4 shadow-card">
        <h2 className="text-subheading text-on-surface">On hand</h2>
        {onHand.length === 0 ? (
          <p className="mt-3 text-sm text-on-surface-variant">
            Nothing is at the office yet. Set a quantity on the material. Zero means Sales orders it when a customer wants it.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-surface-variant">
            {onHand.map((row) => (
              <li key={row.material_id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{row.name}</span>
                  <span className="text-on-surface-variant">{row.sku ?? "No SKU"}</span>
                </span>
                <span className="shrink-0 text-right text-on-surface-variant">
                  {row.available} in office
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {purchases.length > 0 ? (
        <section className="rounded-2xl border border-outline-variant bg-card p-4 shadow-card">
          <h2 className="text-subheading text-on-surface">Purchases</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {purchases.map((purchase) => {
              const vendor = rel(purchase.vendors);
              return (
                <li key={purchase.id}>
                  <AppLink
                    href={`/stock/${purchase.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant px-3 py-3 text-body-sm transition-colors hover:bg-surface-container-low"
                  >
                    <span>
                      <span className="block font-medium">{purchase.purchase_number}</span>
                      <span className="text-on-surface-variant">{vendor?.name ?? "Vendor"}</span>
                    </span>
                    <span className="capitalize text-on-surface-variant">{purchase.status}</span>
                  </AppLink>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {canAdjust ? (
        <section className="rounded-2xl border border-outline-variant bg-card p-4 shadow-card">
          <h2 className="text-subheading text-on-surface">Count correction</h2>
          <p className="mt-1 mb-4 text-sm text-on-surface-variant">
            Use a positive number to add pieces and a negative number to remove them.
          </p>
          <AdjustForm
            materials={materials.map((material) => ({
              id: material.id,
              name: material.name,
            }))}
          />
        </section>
      ) : null}
    </PageFrame>
  );
}
