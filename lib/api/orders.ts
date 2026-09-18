import { cache } from "react";
import { getDb, throwQuery } from "@/lib/api/db";
import { emptyPage, pageRange, type ListPage } from "@/lib/api/paging";
import { isOrderNumber } from "@/lib/orders/ref";
import { rangeToIso, sanitizeSearch } from "@/lib/search";
import type { WorkflowStatus } from "@/lib/workflow/types";

const ORDER_LIST_SELECT =
  "id, order_number, status, updated_at, created_at, customer_id, quote_id, assigned_sales_id, on_hold_reason, credit_delivery_status, customers(name, phone), quotes(quote_number, revision_pending, quote_versions!quotes_current_version_fk(total, margin_amount)), vendor_orders(status, expected_delivery_at, received_at, commercial_status), assigned_sales:profiles!orders_assigned_sales_id_fkey(full_name)";

export function listOrders(filter?: WorkflowStatus | WorkflowStatus[]) {
  const key = !filter
    ? ""
    : Array.isArray(filter)
      ? [...filter].sort().join(",")
      : filter;
  return listOrdersCached(key);
}

const listOrdersCached = cache(async (key: string) => {
  const db = await getDb();
  let request = db
    .from("orders")
    .select(ORDER_LIST_SELECT)
    .order("updated_at", { ascending: false });

  if (key.includes(",")) {
    request = request.in("status", key.split(",") as WorkflowStatus[]);
  } else if (key) {
    request = request.eq("status", key as WorkflowStatus);
  }

  return throwQuery(request, "Failed to load orders");
});

export type OrderListRow = Awaited<ReturnType<typeof listOrders>>[number];

async function orderIdsMatchingSearch(query: string) {
  const q = sanitizeSearch(query);
  if (!q) return null;
  const db = await getDb();
  const like = `%${q}%`;
  const [byNumber, customers, quotes] = await Promise.all([
    throwQuery(
      db.from("orders").select("id").ilike("order_number", like).limit(200),
      "Failed to search orders",
    ),
    throwQuery(
      db
        .from("customers")
        .select("id")
        .or(`name.ilike.${like},phone.ilike.${like}`)
        .limit(80),
      "Failed to search customers",
    ),
    throwQuery(
      db.from("quotes").select("id").ilike("quote_number", like).limit(80),
      "Failed to search quotes",
    ),
  ]);
  const extra = await Promise.all([
    customers.length
      ? throwQuery(
          db
            .from("orders")
            .select("id")
            .in(
              "customer_id",
              customers.map((row) => row.id),
            )
            .limit(200),
          "Failed to search orders",
        )
      : Promise.resolve([] as { id: string }[]),
    quotes.length
      ? throwQuery(
          db
            .from("orders")
            .select("id")
            .in(
              "quote_id",
              quotes.map((row) => row.id),
            )
            .limit(200),
          "Failed to search orders",
        )
      : Promise.resolve([] as { id: string }[]),
  ]);
  return [
    ...new Set([...byNumber, ...extra[0], ...extra[1]].map((row) => row.id)),
  ];
}

export function listOrdersPage(input: {
  statuses?: WorkflowStatus | WorkflowStatus[];
  q?: string;
  from?: string;
  to?: string;
  credit?: boolean;
  page?: number;
}) {
  return listOrdersPageCached(JSON.stringify(input));
}

const listOrdersPageCached = cache(async (raw: string): Promise<ListPage<OrderListRow>> => {
  const input = JSON.parse(raw) as {
    statuses?: WorkflowStatus | WorkflowStatus[];
    q?: string;
    from?: string;
    to?: string;
    credit?: boolean;
    page?: number;
  };
  const { page, pageSize, from, to } = pageRange(input.page ?? 1);
  const ids = await orderIdsMatchingSearch(input.q ?? "");
  if (ids && ids.length === 0) {
    return emptyPage(page, pageSize);
  }

  const db = await getDb();
  let request = db
    .from("orders")
    .select(ORDER_LIST_SELECT, { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  const statuses = input.statuses;
  if (Array.isArray(statuses) && statuses.length > 0) {
    request = request.in("status", statuses);
  } else if (typeof statuses === "string" && statuses) {
    request = request.eq("status", statuses);
  }
  if (ids) {
    request = request.in("id", ids);
  }
  if (input.from && input.to) {
    const iso = rangeToIso(input.from, input.to);
    request = request.gte("updated_at", iso.start).lte("updated_at", iso.end);
  } else if (input.from) {
    request = request.gte("updated_at", rangeToIso(input.from, input.from).start);
  } else if (input.to) {
    request = request.lte("updated_at", rangeToIso(input.to, input.to).end);
  }
  if (input.credit) {
    request = request.eq("credit_delivery_status", "requested");
  }

  const { data, error, count } = await request;
  if (error) {
    throw new Error(`Failed to load orders: ${error.message}`);
  }
  return {
    rows: (data ?? []) as OrderListRow[],
    total: count ?? 0,
    page,
    pageSize,
  };
});

export const listCustomerLatestOrders = cache(async (customerIds: string[]) => {
  if (customerIds.length === 0) return [];
  const db = await getDb();
  return throwQuery(
    db.rpc("customer_latest_orders", { p_ids: customerIds }),
    "Failed to load latest orders",
  );
});

export const listOrdersForCustomer = cache(async (customerId: string) => {
  const db = await getDb();
  return throwQuery(
    db
      .from("orders")
      .select(ORDER_LIST_SELECT)
      .eq("customer_id", customerId)
      .order("updated_at", { ascending: false }),
    "Failed to load orders",
  );
});

export const listPaymentsForOrder = cache(async (orderId: string) => {
  const db = await getDb();
  return throwQuery(
    db
      .from("payments")
      .select("id, kind, amount, status, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    "Failed to load payments",
  );
});

export const getOrder = cache(async (id: string) => {
  const db = await getDb();
  const lookup = isOrderNumber(id)
    ? db.from("orders").select(
        "id, order_number, status, quote_id, customer_id, assigned_sales_id, on_hold_reason, credit_delivery_status, activated_at, created_at, updated_at",
      ).ilike("order_number", id.trim())
    : db.from("orders").select(
        "id, order_number, status, quote_id, customer_id, assigned_sales_id, on_hold_reason, credit_delivery_status, activated_at, created_at, updated_at",
      ).eq("id", id);

  const { data: order, error } = await lookup.maybeSingle();

  if (error) {
    throw new Error("Failed to load order");
  }
  if (!order) {
    return null;
  }

  const orderId = order.id;
  const [customer, quote, items, payments, vendorOrders, delivery, balance, salesperson] =
    await Promise.all([
      db
        .from("customers")
        .select("id, name, phone, address, gstin, billing_address, site_address, kind")
        .eq("id", order.customer_id)
        .maybeSingle(),
      db
        .from("quotes")
        .select(
          "id, quote_number, status, revision_pending, current_version_id, quote_versions!quotes_current_version_fk(total, version_number, tax, subtotal, discount, warranty_months, include_amc, amc_months, notes)",
        )
        .eq("id", order.quote_id)
        .maybeSingle(),
      db
        .from("order_items")
        .select("id, description, quantity, quantity_received, quantity_written_off, write_off_reason, quantity_pending, quote_item_id, material_id, materials(description), quote_items(unit_cost, description, specification, item_code, hsn_code)")
        .eq("order_id", orderId),
      db
        .from("payments")
        .select(
          "id, kind, amount, status, recorded_by, created_at, notes, method, reference_number, payment_verifications(decision, notes, created_at)",
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
      db
        .from("vendor_orders")
        .select(
          "id, vendor_id, status, sent_at, dispatched_at, received_at, expected_delivery_at, quote_ref, quote_amount, bill_ref, bill_amount, payable_amount, commercial_status, quoted_by, quote_rejection_reason, vendors(name), vendor_order_items(id, order_item_id, quantity, quantity_received, quantity_written_off), vendor_payments(id, amount, status, method, reference_number, created_at)",
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
      db
        .from("deliveries")
        .select("id, delivered_at, notes")
        .eq("order_id", orderId)
        .maybeSingle(),
      db.rpc("order_balance", { p_order_id: orderId }),
      order.assigned_sales_id
        ? db
            .from("profiles")
            .select("id, full_name")
            .eq("id", order.assigned_sales_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  return {
    order: { ...order, status: order.status as WorkflowStatus },
    customer: customer.data,
    quote: quote.data,
    items: items.data ?? [],
    payments: payments.data ?? [],
    vendorOrders: vendorOrders.data ?? [],
    delivery: delivery.data,
    balance: balance.data,
    salesperson: salesperson.data,
  };
});
