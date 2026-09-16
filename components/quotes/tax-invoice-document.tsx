import { NuhomeSheet } from "@/components/quotes/nuhome-sheet";

type InvoiceItem = {
  description: string;
  quantity: number | string;
  unit_price: number | string;
  discount: number | string;
  tax: number | string;
  line_total: number | string;
  hsn_code: string | null;
  gst_rate: number | string;
  item_code?: string | null;
  specification?: string | null;
};

export function TaxInvoiceDocument({
  invoiceNumber,
  issuedAt,
  company,
  customer,
  salesman,
  version,
  items,
}: {
  invoiceNumber: string;
  issuedAt: string | null;
  salesman?: string | null;
  company: {
    legal_name: string;
    gstin: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    bank_name?: string | null;
    bank_account?: string | null;
    bank_ifsc?: string | null;
    bank_branch?: string | null;
    upi_id?: string | null;
  };
  customer: {
    name: string;
    phone: string | null;
    firm?: string | null;
    billing_address: string | null;
    site_address: string | null;
    address: string | null;
  } | null;
  quoteNumber: string;
  orderNumber?: string;
  version: {
    total: number | string;
    notes?: string | null;
  } | null;
  items: InvoiceItem[];
}) {
  return (
    <NuhomeSheet
      kind="invoice"
      refLabel="Invoice"
      refValue={invoiceNumber}
      date={issuedAt || new Date().toISOString()}
      salesman={salesman}
      company={company}
      customer={{
        name: customer?.name,
        firm: customer?.firm,
        phone: customer?.phone,
        place:
          customer?.billing_address ||
          customer?.address ||
          customer?.site_address,
      }}
      items={items}
      total={Number(version?.total ?? 0)}
      notes={version?.notes}
    />
  );
}
