import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TaxInvoiceDocument } from "@/components/quotes/tax-invoice-document";
import { getPublicInvoice } from "@/lib/api/public-invoice";
import { invoiceSupplyNote } from "@/lib/quotes/supply-note";

export const metadata: Metadata = {
  title: "Your bill · Nuhome",
  robots: { index: false, follow: false },
};

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invoice = await getPublicInvoice(token);
  if (!invoice) {
    notFound();
  }

  return (
    <main className="min-h-dvh bg-surface-container-low px-4 py-6 print:bg-white print:p-0 md:py-10">
      <TaxInvoiceDocument
        invoiceNumber={invoice.invoice_number}
        issuedAt={invoice.issued_at}
        company={{ ...invoice.company, email: invoice.company.email ?? null }}
        customer={invoice.customer}
        salesman={invoice.salesman}
        quoteNumber={invoice.quote_number}
        orderNumber={invoice.order_number ?? undefined}
        version={invoice.version}
        items={invoice.items.map((item) => ({
          ...item,
          supply_note: invoiceSupplyNote(item),
        }))}
      />
    </main>
  );
}
