import { getDb } from "@/lib/api/db";

export type PublicQuote = {
  quote_number: string;
  customer: {
    name: string;
    phone: string | null;
    address: string | null;
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
