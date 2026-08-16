import { notFound } from "next/navigation";
import { TaxInvoiceDocument } from "@/components/quotes/tax-invoice-document";
import { getTaxInvoice } from "@/lib/api/documents";
import { rel } from "@/lib/api/rel";
import { requirePermission } from "@/lib/auth/guards";

export default async function TaxInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("orders.read");
  const { id } = await params;
  let cargo: Awaited<ReturnType<typeof getTaxInvoice>>;
  try {
    cargo = await getTaxInvoice(id);
  } catch {
    notFound();
  }

  const version = rel(cargo.quote?.quote_versions);

  return (
    <main className="min-h-dvh bg-surface-container-low px-4 py-6 print:bg-white print:p-0 md:py-10">
      <TaxInvoiceDocument
        invoiceNumber={cargo.invoiceNumber}
        issuedAt={cargo.issuedAt}
        company={cargo.company}
        customer={cargo.customer}
        quoteNumber={cargo.quote?.quote_number ?? "Quote"}
        version={version}
        items={cargo.items}
      />
    </main>
  );
}
