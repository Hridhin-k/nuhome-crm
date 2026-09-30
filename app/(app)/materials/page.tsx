import {
  importMaterialsCsvAction,
} from "@/app/actions/admin";
import { AdminCatalogNav } from "@/components/admin/admin-catalog-nav";
import { CsvImportSheet } from "@/components/admin/csv-import-sheet";
import { MaterialForm } from "@/components/admin/material-form";
import { MaterialToggleForm } from "@/components/admin/material-toggle-form";
import { EmptyState } from "@/components/app/empty-state";
import { FormError } from "@/components/app/form-error";
import { Notice } from "@/components/app/notice";
import { PageFrame, panelClass } from "@/components/app/page-frame";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";
import { listCategories, listMaterialVendorOffers, listMaterials, listVendors } from "@/lib/api/catalog";
import { listMaterialOfficeBalances } from "@/lib/api/stock";
import { rel } from "@/lib/api/rel";
import { requireAnyPermission } from "@/lib/auth/guards";
import { MATERIAL_CSV_COLUMNS } from "@/lib/catalog/material-csv";
import { formatSpecsInline, normalizeMaterialSpecs } from "@/lib/catalog/material-specs";
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
              description="Add new materials, or update saved ones by SKU. Start from the sample so the columns match."
              templateName="nuhome-materials.csv"
              templateHeaders={[...MATERIAL_CSV_COLUMNS]}
              templateRows={[
                ["MK-WALL-900-WH", "Wall cabinet 900mm", "Modular Kitchen", "pcs", "7400", "4600", "9403", "18", "12", "2", "Adhams:4600*|Kerala Woods:4800", "Colour: White|Dimensions: 900 x 720 x 320 mm", "Lift-up door"],
                ["SV-SITE-VISIT", "Site measurement visit", "Services", "visit", "500", "300", "9987", "18", "0", "", "", "", "Measure the site before the quote"],
              ]}
              help={
                <ul className="list-disc space-y-1.5 pl-4">
                  <li>One row per material. A saved SKU is updated. A new SKU is added.</li>
                  <li>A blank cell keeps what is already saved.</li>
                  <li>If any row is wrong, nothing is imported and each problem is listed.</li>
                  <li>A new material needs name, category, and sell_price.</li>
                  <li>office_quantity is how many are at the office now.</li>
                  <li>
                    vendors: Name:price, separated by |. Put * after the usual supplier’s price,
                    such as <code>Adhams:4600*|Kerala Woods:4800</code>.
                  </li>
                  <li>
                    specs: Label: value, separated by |, such as{" "}
                    <code>Colour: White|Dimensions: 600 mm</code>. A different colour or size is its
                    own row with its own SKU.
                  </li>
                </ul>
              }
              action={importMaterialsCsvAction}
            />
            <MaterialForm categories={categories} vendors={vendorOptions} />
          </div>
        }
      />
      <AdminCatalogNav current="/materials" />
      {notice === "material-saved" ? <Notice>Material saved.</Notice> : null}
      {notice === "material-updated" ? <Notice>Material updated.</Notice> : null}
      {error ? <FormError className="mb-4">{error}</FormError> : null}

      {materials.length === 0 ? (
        <EmptyState
          title="No materials yet"
          description="Add one or import a CSV."
        />
      ) : (
      <ul className="flex flex-col gap-3">
        {materials.map((material) => {
          const category = rel(material.material_categories);
          const active = material.is_active !== false;
          const office = officeBalances.get(material.id);
          const atOffice = Math.max(
            0,
            Number(office?.onHand ?? 0) - Number(office?.reserved ?? 0),
          );
          const links = linksByMaterial.get(material.id) ?? [];
          const specs = normalizeMaterialSpecs(material.specs);
          return (
            <li
              key={material.id}
              className={cn(panelClass, "flex items-start justify-between gap-3")}
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-subheading text-on-surface">
                  {material.name}
                  {active ? null : <Badge variant="secondary">Hidden</Badge>}
                </p>
                <p className="mt-0.5 text-body-sm text-on-surface-variant">
                  {material.sku ?? "No SKU"}
                  {category ? ` · ${category.name}` : ""}
                  {` · ${material.unit}`}
                  {material.hsn_code ? ` · HSN ${material.hsn_code}` : ""}
                  {` · GST ${Number(material.gst_rate ?? 18)}%`}
                </p>
                {specs.length > 0 ? (
                  <p className="mt-1 text-body-sm text-on-surface">
                    {formatSpecsInline(specs)}
                  </p>
                ) : null}
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  Sell {formatInr(Number(material.default_sell_price))} · Cost{" "}
                  {formatInr(Number(material.default_cost))}
                  {" · "}
                  {atOffice > 0
                    ? `${formatQty(atOffice)} ${material.unit} at office`
                    : "Order when a customer wants it"}
                </p>
                <p className="mt-1 text-body-sm text-on-surface-variant">
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
                    specs,
                    isActive: active,
                    officeQuantity: atOffice,
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
