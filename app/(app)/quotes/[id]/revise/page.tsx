import {
  QuoteBuilder,
  linesFromQuoteItems,
} from "@/components/quotes/quote-builder";
import { PageHeader } from "@/components/app/page-header";
import { WorkflowStepper } from "@/components/app/workflow-stepper";
import { listCategories, listMaterials } from "@/lib/api/catalog";
import type { MaterialRow } from "@/lib/api/catalog";
import { listCustomers } from "@/lib/api/customers";
import { getQuote } from "@/lib/api/quotes";
import { requirePermission } from "@/lib/auth/guards";
import { notFound } from "next/navigation";

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
  }));
}

export default async function ReviseQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("quotes.revise");
  const { id } = await params;
  const [detail, customers, materials, categories] = await Promise.all([
    getQuote(id),
    listCustomers(),
    listMaterials(),
    listCategories(),
  ]);
  if (!detail) {
    notFound();
  }

  const current =
    detail.versions.find((v) => v.id === detail.quote.current_version_id) ??
    detail.versions[0];
  const currentItems = detail.items.filter((i) => i.version_id === current?.id);
  const initialLines = linesFromQuoteItems(currentItems);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Revise ${detail.quote.quote_number}`}
        description="Adjust materials and resubmit to Accounts. Previous versions stay in history."
      />
      <WorkflowStepper status="quote_rejected" />
      <QuoteBuilder
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
        }))}
        materials={mapMaterials(materials)}
        categories={categories}
        presetCustomerId={detail.quote.customer_id}
        reviseQuoteId={id}
        initialLines={initialLines}
        initialNotes={current?.notes ?? ""}
        rejectionReason={current?.rejection_reason ?? undefined}
        showCustomerStep={false}
        step={2}
      />
    </div>
  );
}
