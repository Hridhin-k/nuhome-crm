import { cache } from "react";
import { getDb, throwQuery } from "@/lib/api/db";
import type { WorkflowStatus } from "@/lib/workflow/types";

const QUOTE_LIST_SELECT =
  "id, quote_number, status, created_at, updated_at, customer_id, created_by, current_version_id, customers(name, phone), quote_versions!quotes_current_version_fk(version_number, total, margin_amount, margin_percent, status, rejection_reason)";

type OrderRef = { id: string; status: string; quote_id: string };

async function attachOrders<T extends { id: string }>(quotes: T[]) {
  if (quotes.length === 0) {
    return quotes.map((quote) => ({ ...quote, order: null as OrderRef | null }));
  }

  const db = await getDb();
  const orders = await throwQuery(
    db
      .from("orders")
      .select("id, status, quote_id, assigned_sales_id")
      .in(
        "quote_id",
        quotes.map((quote) => quote.id),
      ),
    "Failed to load order status",
  );

  const byQuote = new Map(orders.map((order) => [order.quote_id, order]));
  return quotes.map((quote) => ({
    ...quote,
    order: byQuote.get(quote.id) ?? null,
  }));
}

export const listQuotes = cache(async () => {
  const db = await getDb();
  const quotes = await throwQuery(
    db.from("quotes").select(QUOTE_LIST_SELECT).order("updated_at", { ascending: false }),
    "Failed to load quotes",
  );
  return attachOrders(quotes);
});

export const listQuotesForCustomer = cache(async (customerId: string) => {
  const db = await getDb();
  const quotes = await throwQuery(
    db
      .from("quotes")
      .select(QUOTE_LIST_SELECT)
      .eq("customer_id", customerId)
      .order("updated_at", { ascending: false }),
    "Failed to load quotes",
  );
  return attachOrders(quotes);
});

export const listPendingApprovals = cache(async () => {
  const db = await getDb();
  return throwQuery(
    db
      .from("quotes")
      .select(
        "id, quote_number, status, created_at, customer_id, customers(name), quote_versions!quotes_current_version_fk(version_number, total, margin_amount, margin_percent)",
      )
      .eq("status", "quote_pending_accounts")
      .order("updated_at", { ascending: false }),
    "Failed to load approvals",
  );
});

export const getQuote = cache(async (id: string) => {
  const db = await getDb();
  const { data: quote, error } = await db
    .from("quotes")
    .select(
      "id, quote_number, status, created_at, created_by, customer_id, current_version_id, public_access_token",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load quote");
  }
  if (!quote) {
    return null;
  }

  const [customer, versions, order] = await Promise.all([
    db
      .from("customers")
      .select("id, name, phone, address, gstin, billing_address, site_address, kind")
      .eq("id", quote.customer_id)
      .maybeSingle(),
    db
      .from("quote_versions")
      .select(
        "id, version_number, status, subtotal, discount, tax, total, margin_amount, margin_percent, notes, rejection_reason, rejected_at, created_at, created_by",
      )
      .eq("quote_id", id)
      .order("version_number", { ascending: false }),
    db.from("orders").select("id, status").eq("quote_id", id).maybeSingle(),
  ]);

  const versionIds = (versions.data ?? []).map((v) => v.id);
  const items = versionIds.length
    ? await db
        .from("quote_items")
        .select(
          "id, version_id, material_id, description, quantity, unit_price, unit_cost, discount, tax, line_total, hsn_code, gst_rate",
        )
        .in("version_id", versionIds)
        .order("sort_order")
    : { data: [], error: null };

  if (items.error) {
    throw new Error("Failed to load quote items");
  }

  return {
    quote: {
      ...quote,
      status: quote.status as WorkflowStatus,
    },
    customer: customer.data,
    versions: versions.data ?? [],
    items: items.data ?? [],
    order: order.data,
  };
});
