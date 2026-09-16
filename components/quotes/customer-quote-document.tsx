import { NuhomeSheet } from "@/components/quotes/nuhome-sheet";
import type { PublicQuote } from "@/lib/api/public-quote";

export function CustomerQuoteDocument({ quote }: { quote: PublicQuote }) {
  const { customer, version, items, company } = quote;
  const place = customer?.billing_address || customer?.address;

  return (
    <NuhomeSheet
      kind="quotation"
      refLabel="Quote"
      refValue={quote.quote_number}
      date={version.created_at}
      salesman={quote.salesman}
      company={{
        legal_name: company?.legal_name ?? "NUHOME",
        gstin: company?.gstin,
        address: company?.address,
        phone: company?.phone,
        email: company?.email,
        bank_name: company?.bank_name,
        bank_account: company?.bank_account,
        bank_ifsc: company?.bank_ifsc,
        bank_branch: company?.bank_branch,
        upi_id: company?.upi_id,
      }}
      customer={{
        name: customer?.name,
        firm: customer?.firm,
        phone: customer?.phone,
        place,
      }}
      items={items}
      total={Number(version.total)}
      notes={version.notes}
    />
  );
}
