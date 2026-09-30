import { getDb } from "@/lib/api/db";
import type { PublicQuote } from "@/lib/api/public-quote";

export type PublicInvoice = {
  invoice_number: string;
  issued_at: string | null;
  quote_number: string;
  order_number: string | null;
  salesman?: string | null;
  company: NonNullable<PublicQuote["company"]>;
  customer: {
    name: string;
    phone: string | null;
    firm?: string | null;
    address: string | null;
    billing_address: string | null;
    site_address: string | null;
  } | null;
  version: { total: number; notes: string | null };
  items: {
    description: string;
    specification?: string | null;
    item_code?: string | null;
    quantity: number;
    unit_price: number;
    discount: number;
    tax: number;
    line_total: number;
    hsn_code: string | null;
    gst_rate: number;
    supply_source?: string | null;
    quantity_handed_over?: number | null;
  }[];
};

type PublicInvoiceRpcClient = {
  rpc(
    fn: "get_public_invoice",
    args: { p_token: string },
  ): Promise<{ data: PublicInvoice | null; error: { message: string } | null }>;
};

export async function getPublicInvoice(token: string): Promise<PublicInvoice | null> {
  const db = (await getDb()) as unknown as PublicInvoiceRpcClient;
  const { data, error } = await db.rpc("get_public_invoice", { p_token: token });
  if (error || !data) {
    return null;
  }
  return data;
}
