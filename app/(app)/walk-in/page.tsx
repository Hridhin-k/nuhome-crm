import { QuoteBuilder } from "@/components/quotes/quote-builder";
import { CustomerForm } from "@/components/customers/customer-form";
import { PageFrame } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { listCategories, listMaterials } from "@/lib/api/catalog";
import { listCustomers } from "@/lib/api/customers";
import { requirePermission } from "@/lib/auth/guards";
import type { MaterialRow } from "@/lib/api/catalog";

function mapMaterials(materials: MaterialRow[]) {
  return materials.map((m) => ({
    id: m.id,
    name: m.name,
    sku: m.sku,
    unit: m.unit,
    default_sell_price: m.default_sell_price,
    default_cost: m.default_cost,
    category_id: m.category_id,
    category_name: m.material_categories?.name ?? null,
    hsn_code: m.hsn_code,
    gst_rate: m.gst_rate,
  }));
}

export default async function WalkInPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; step?: string }>;
}) {
  const [, { customerId, step }, customers, materials, categories] =
    await Promise.all([
      requirePermission("quotes.create"),
      searchParams,
      listCustomers(),
      listMaterials(),
      listCategories(),
    ]);

  const initialStep =
    step === "2" || customerId ? (2 as const) : step === "3" ? (3 as const) : (1 as const);

  if (customers.length === 0 && !customerId) {
    return (
      <PageFrame width="detail">
        <PageHeader
          title="Customer walk-in"
          hideTitleOnMobile
          description="Start with a customer profile, then build the quote."
        />
        <EmptyState
          title="New customer walk-in"
          description="Create a customer profile to begin the quote flow."
          action={
            <CustomerForm defaultOpen returnTo="/walk-in" triggerClassName="w-full" />
          }
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame width="wide" className="space-y-5">
      <QuoteBuilder
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
        }))}
        materials={mapMaterials(materials)}
        categories={categories}
        presetCustomerId={customerId}
        returnTo="/walk-in"
        step={initialStep}
      />
    </PageFrame>
  );
}
