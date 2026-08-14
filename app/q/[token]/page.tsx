import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerQuoteDocument } from "@/components/quotes/customer-quote-document";
import { getPublicQuote } from "@/lib/api/public-quote";

export const metadata: Metadata = {
  title: "Your quotation · Nuhome",
  robots: { index: false, follow: false },
};

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const quote = await getPublicQuote(token);
  if (!quote) {
    notFound();
  }

  return (
    <main className="min-h-dvh bg-surface-container-low px-4 py-6 print:bg-white print:p-0 md:py-10">
      <CustomerQuoteDocument quote={quote} />
    </main>
  );
}
