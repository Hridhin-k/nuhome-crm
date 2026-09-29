import {
  importMaterialsCsvAction,
} from "@/app/actions/admin";
import { AdminCatalogNav } from "@/components/admin/admin-catalog-nav";
import { CsvImportSheet } from "@/components/admin/csv-import-sheet";
import { MaterialForm } from "@/components/admin/material-form";
import { MaterialToggleForm } from "@/components/admin/material-toggle-form";
import { Notice } from "@/components/app/notice";
import { PageFrame } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { listCategories, listMaterialVendorOffers, listMaterials, listVendors } from "@/lib/api/catalog";
import { listMaterialOfficeBalances } from "@/lib/api/stock";
import { rel } from "@/lib/api/rel";
import { requireAnyPermission } from "@/lib/auth/guards";
import { formatInr } from "@/lib/format/money";

function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const [, { notice, error }, materials, categories, officeBalances, vendorOffers, vendors] =
    await Promise.all([
      requireAnyPermission("admin.manage", "catalog.manage"),
      searchParams,
      listMaterials({ includeInactive: true }),
      listCategories(),
      listMaterialOfficeBalances(),
      listMaterialVendorOffers(),
      listVendors(),
    ]);
  const linksByMaterial = new Map<
    string,
    { vendorId: string; name: string; unitCost: number; preferred: boolean }[]
  >();
  for (const offer of vendorOffers) {
    const vendor = rel(offer.vendors);
    const list = linksByMaterial.get(offer.material_id) ?? [];
    list.push({
      vendorId: offer.vendor_id,
      name: vendor?.name ?? "Vendor",
      unitCost: Number(offer.unit_cost),
      preferred: offer.is_preferred,
    });
    linksByMaterial.set(offer.material_id, list);
  }
  for (const list of linksByMaterial.values()) {
    list.sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.name.localeCompare(b.name));
  }
  const vendorOptions = vendors
    .filter((vendor) => vendor.is_active)
    .map((vendor) => ({ id: vendor.id, name: vendor.name }));

  return (
    <PageFrame>
      <PageHeader
        title="Materials"
        hideTitleOnMobile
        description="Catalogue Sales uses. Set the office quantity and the vendors who supply each material."
        action={
          <div className="flex flex-col items-end gap-2 sm:flex-row">
            <CsvImportSheet
              title="Import materials"
              description="Columns: sku, name, category, unit, sell_price, cost, office_quantity, vendors, description. Vendors look like Name:price|Other:price. Add a star after the usual supplier's price. Leave vendors out to keep the suppliers already saved."
              templateName="nuhome-materials.csv"
              templateHeaders={["sku", "name", "category", "unit", "sell_price", "cost", "hsn_code", "gst_rate", "warranty_months", "office_quantity", "vendors", "description"]}
              templateRows={[
                ["MK-BASE-600", "Base cabinet 600mm", "Modular Kitchen", "pcs", "8500", "5200", "9403", "18", "12", "4", "Adhams:5200*|Kerala Woods:5400", "600mm base with soft-close"],
                ["SV-INSTALL", "Installation labour", "Services", "day", "2500", "1500", "9987", "18", "0", "0", "In-house:1500*", "On-site fitting"],
              ]}
              action={importMaterialsCsvAction}
            />
            <MaterialForm categories={categories} vendors={vendorOptions} />
          </div>
        }
      />
      <AdminCatalogNav current="/materials" />
      {notice === "material-saved" ? <Notice>Material saved.</Notice> : null}
      {notice === "material-updated" ? <Notice>Material updated.</Notice> : null}
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      {materials.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant px-5 py-14 text-center text-sm text-on-surface-variant">
          No materials yet. Add one or import a CSV.
        </p>
      ) : (
      <ul className="flex flex-col gap-3">
        {materials.map((material) => {
          const category = rel(material.material_categories);
          const active = material.is_active !== false;
          const office = officeBalances.get(material.id);
          const atOffice = Number(office?.onHand ?? 0);
          const reserved = Number(office?.reserved ?? 0);
          const links = linksByMaterial.get(material.id) ?? [];
          return (
            <li
              key={material.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-outline-variant bg-card p-4 shadow-card"
            >
              <div className="min-w-0">
                <p className="font-medium">{material.name}</p>
                <p className="text-sm text-on-surface-variant">
                  {material.sku ?? "No SKU"}
                  {category ? ` · ${category.name}` : ""}
                  {` · ${material.unit}`}
                  {material.hsn_code ? ` · HSN ${material.hsn_code}` : ""}
                  {` · GST ${Number(material.gst_rate ?? 18)}%`}
                  {active ? "" : " · inactive"}
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Sell {formatInr(Number(material.default_sell_price))} · Cost{" "}
                  {formatInr(Number(material.default_cost))}
                  {" · "}
                  {atOffice > 0
                    ? `${formatQty(atOffice)} ${material.unit} at office`
                    : "Order when a customer wants it"}
                  {reserved > 0 ? ` · ${formatQty(reserved)} reserved` : ""}
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {links.length > 0
                    ? links
                        .map(
                          (link) =>
                            `${link.name} ${formatInr(link.unitCost)}${link.preferred ? " usual" : ""}`,
                        )
                        .join(" · ")
                    : "No vendor yet"}
                </p>
                {material.description?.trim() ? (
                  <p className="mt-2 text-body-sm text-on-surface">
                    {material.description.trim()}
                  </p>
                ) : (
                  <p className="mt-2 text-body-sm text-on-surface-variant">
                    No description yet — edit to add one for the ⓘ hint.
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-start gap-2">
                <MaterialForm
                  categories={categories}
                  vendors={vendorOptions}
                  material={{
                    id: material.id,
                    name: material.name,
                    sku: material.sku,
                    unit: material.unit,
                    categoryName: category?.name ?? "",
                    sellPrice: Number(material.default_sell_price),
                    cost: Number(material.default_cost),
                    hsnCode: material.hsn_code,
                    gstRate: Number(material.gst_rate ?? 18),
                    warrantyMonths: material.warranty_months ?? 12,
                    description: material.description,
                    isActive: active,
                    officeQuantity: atOffice,
                    officeReserved: reserved,
                    vendorLinks: links,
                  }}
                />
                <MaterialToggleForm id={material.id} active={active} />
              </div>
            </li>
          );
        })}
      </ul>
      )}
    </PageFrame>
  );
}
