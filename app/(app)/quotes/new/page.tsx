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
import { redirect } from "next/navigation";

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

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  await requirePermission("quotes.create");
  const { customerId } = await searchParams;
  const target = customerId
    ? `/walk-in?customerId=${customerId}&step=2`
    : "/walk-in";
  redirect(target);
}
