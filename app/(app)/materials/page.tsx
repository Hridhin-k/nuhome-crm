import {
  importMaterialsCsvAction,
  toggleMaterialAction,
} from "@/app/actions/admin";
import { AdminCatalogNav } from "@/components/admin/admin-catalog-nav";
import { CsvImportSheet } from "@/components/admin/csv-import-sheet";
import { MaterialForm } from "@/components/admin/material-form";
import { Notice } from "@/components/app/notice";
import { PageFrame } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { listCategories, listMaterials } from "@/lib/api/catalog";
import { rel } from "@/lib/api/rel";
import { requirePermission } from "@/lib/auth/guards";
import { formatInr } from "@/lib/format/money";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const [, { notice, error }, materials, categories] = await Promise.all([
    requirePermission("admin.manage"),
    searchParams,
    listMaterials({ includeInactive: true }),
    listCategories(),
  ]);

  return (
    <PageFrame>
      <PageHeader
        title="Materials"
        hideTitleOnMobile
        description="Catalogue used when Sales builds a quote."
        action={
          <div className="flex flex-col items-end gap-2 sm:flex-row">
            <CsvImportSheet
              title="Import materials"
              description="Columns: sku, name, category, unit, sell_price, cost. Existing SKUs are updated."
              templateName="nuhome-materials.csv"
              templateHeaders={["sku", "name", "category", "unit", "sell_price", "cost"]}
              templateRows={[
                ["MK-BASE-600", "Base cabinet 600mm", "Modular Kitchen", "pcs", "8500", "5200"],
                ["SV-INSTALL", "Installation labour", "Services", "day", "2500", "1500"],
              ]}
              action={importMaterialsCsvAction}
            />
            <MaterialForm categories={categories} />
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
                  {active ? "" : " · inactive"}
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Sell {formatInr(Number(material.default_sell_price))} · Cost{" "}
                  {formatInr(Number(material.default_cost))}
                </p>
              </div>
              <form action={toggleMaterialAction}>
                <input type="hidden" name="id" value={material.id} />
                <input type="hidden" name="is_active" value={active ? "false" : "true"} />
                <button
                  type="submit"
                  className="h-9 rounded-lg border border-border px-3 text-[13px] font-medium text-on-surface"
                >
                  {active ? "Hide" : "Restore"}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
      )}
    </PageFrame>
  );
}
