import {
  QuoteBuilder,
  linesFromQuoteItems,
} from "@/components/quotes/quote-builder";
import { PageFrame } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { listCategories, listMaterials } from "@/lib/api/catalog";
import type { MaterialRow } from "@/lib/api/catalog";
import { listCustomers } from "@/lib/api/customers";
import { getQuote } from "@/lib/api/quotes";
import { requirePermission } from "@/lib/auth/guards";
import { notFound, redirect } from "next/navigation";
import type { WorkflowStatus } from "@/lib/workflow/types";

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

const EDITABLE: WorkflowStatus[] = [
  "quote_draft",
  "quote_rejected",
  "quote_approved",
];

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

  const status = detail.quote.status;
  if (!EDITABLE.includes(status)) {
    redirect(`/quotes/${id}?error=${encodeURIComponent("This quote can no longer be edited.")}`);
  }

  const current =
    detail.versions.find((v) => v.id === detail.quote.current_version_id) ??
    detail.versions[0];
  const currentItems = detail.items.filter((i) => i.version_id === current?.id);
  const initialLines = linesFromQuoteItems(currentItems);
  const title =
    status === "quote_draft"
      ? `Edit ${detail.quote.quote_number}`
      : `Revise ${detail.quote.quote_number}`;
  const description =
    status === "quote_approved"
      ? "Adjust materials. The current approval is withdrawn until Accounts reviews the new version."
      : status === "quote_draft"
        ? "Save a draft or submit to Accounts when you are ready."
        : "Adjust materials and resubmit to Accounts. Previous versions stay in history.";

  return (
    <PageFrame width="wide" className="space-y-6">
      <PageHeader title={title} hideTitleOnMobile description={description} />
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
        quoteStatus={
          status as "quote_draft" | "quote_rejected" | "quote_approved"
        }
      />
    </PageFrame>
  );
}
