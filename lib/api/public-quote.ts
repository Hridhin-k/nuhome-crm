import { getDb } from "@/lib/api/db";

export type PublicQuote = {
  quote_number: string;
  company?: {
    legal_name: string;
    gstin: string | null;
    address: string | null;
    phone: string | null;
  } | null;
  customer: {
    name: string;
    phone: string | null;
    address: string | null;
    gstin?: string | null;
    billing_address?: string | null;
    site_address?: string | null;
  } | null;
  version: {
    version_number: number;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    notes: string | null;
    created_at: string;
  };
  items: {
    description: string;
    quantity: number;
    line_total: number;
    hsn_code?: string | null;
    gst_rate?: number | null;
    tax?: number | null;
    unit_price?: number | null;
  }[];
};

type PublicQuoteRpcClient = {
  rpc(
    fn: "get_public_quote",
    args: { p_token: string },
  ): Promise<{ data: PublicQuote | null; error: { message: string } | null }>;
};

export async function getPublicQuote(token: string): Promise<PublicQuote | null> {
  const db = (await getDb()) as unknown as PublicQuoteRpcClient;
  const { data, error } = await db.rpc("get_public_quote", {
    p_token: token,
  });

  if (error || !data) {
    return null;
  }

  return data;
}
