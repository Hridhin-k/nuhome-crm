import { cache } from "react";
import { getDb, throwQuery } from "@/lib/api/db";
import { pageRange, type ListPage } from "@/lib/api/paging";
import { rangeToIso, sanitizeSearch } from "@/lib/search";
import type { WorkflowStatus } from "@/lib/workflow/types";

const QUOTE_LIST_SELECT =
  "id, quote_number, status, created_at, updated_at, customer_id, created_by, current_version_id, revision_pending, customers(name, phone), quote_versions!quotes_current_version_fk(version_number, total, margin_amount, margin_percent, status, rejection_reason)";

type OrderRef = { id: string; status: string; quote_id: string; order_number: string };

async function attachOrders<T extends { id: string }>(quotes: T[]) {
  if (quotes.length === 0) {
    return quotes.map((quote) => ({ ...quote, order: null as OrderRef | null }));
  }

  const db = await getDb();
  const orders = await throwQuery(
    db
      .from("orders")
      .select("id, status, quote_id, assigned_sales_id, order_number")
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

export type FloorJobRow = {
  id: string;
  quote_number: string;
  quote_status: string;
  updated_at: string;
  created_at: string;
  created_by: string | null;
  revision_pending: boolean | null;
  customer_name: string | null;
  customer_phone: string | null;
  created_by_name: string | null;
  order_id: string | null;
  order_number: string | null;
  order_status: string | null;
  live_status: WorkflowStatus;
  version_total: number | string | null;
};

export function listFloorJobs(input: {
  statuses: readonly WorkflowStatus[];
  exactStatus?: WorkflowStatus;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
}) {
  return listFloorJobsCached(JSON.stringify(input));
}

const listFloorJobsCached = cache(async (raw: string): Promise<ListPage<FloorJobRow>> => {
  const input = JSON.parse(raw) as {
    statuses: WorkflowStatus[];
    exactStatus?: WorkflowStatus;
    q?: string;
    from?: string;
    to?: string;
    page?: number;
  };
  const { page, pageSize, from, to } = pageRange(input.page ?? 1);
  const db = await getDb();
  const q = sanitizeSearch(input.q);

  let request = db
    .from("floor_jobs")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (input.exactStatus) {
    request = request.eq("live_status", input.exactStatus);
  } else if (input.statuses.length > 0) {
    request = request.in("live_status", input.statuses);
  }
  if (q) {
    request = request.or(
      [
        `quote_number.ilike.%${q}%`,
        `order_number.ilike.%${q}%`,
        `customer_name.ilike.%${q}%`,
        `customer_phone.ilike.%${q}%`,
        `created_by_name.ilike.%${q}%`,
      ].join(","),
    );
  }
  if (input.from && input.to) {
    const iso = rangeToIso(input.from, input.to);
    request = request.gte("updated_at", iso.start).lte("updated_at", iso.end);
  } else if (input.from) {
    request = request.gte("updated_at", rangeToIso(input.from, input.from).start);
  } else if (input.to) {
    request = request.lte("updated_at", rangeToIso(input.to, input.to).end);
  }

  const { data, error, count } = await request;
  if (error) {
    throw new Error(`Failed to load quotes: ${error.message}`);
  }
  return {
    rows: (data ?? []) as FloorJobRow[],
    total: count ?? 0,
    page,
    pageSize,
  };
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
      "id, quote_number, status, created_at, created_by, customer_id, current_version_id, public_access_token, revision_pending",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load quote: ${error.message}`);
  }
  if (!quote) {
    return null;
  }

  const [customer, versions, order] = await Promise.all([
    db
      .from("customers")
      .select("id, name, phone, email, address, gstin, billing_address, site_address, kind")
      .eq("id", quote.customer_id)
      .maybeSingle(),
    db
      .from("quote_versions")
      .select(
        "id, version_number, status, subtotal, discount, tax, total, margin_amount, margin_percent, notes, rejection_reason, rejected_at, created_at, created_by, warranty_months, include_amc, amc_months",
      )
      .eq("quote_id", id)
      .order("version_number", { ascending: false }),
      db.from("orders").select("id, status, order_number, assigned_sales_id").eq("quote_id", id).maybeSingle(),
  ]);

  const versionIds = (versions.data ?? []).map((v) => v.id);
  const items = versionIds.length
    ? await db
        .from("quote_items")
        .select(
          "id, version_id, material_id, description, specification, item_code, quantity, unit_price, unit_cost, discount, tax, line_total, hsn_code, gst_rate, materials(description)",
        )
        .in("version_id", versionIds)
        .order("sort_order")
    : { data: [], error: null };

  if (items.error) {
    throw new Error(`Failed to load quote items: ${items.error.message}`);
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
