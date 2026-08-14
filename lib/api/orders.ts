import { getDb, throwQuery } from "@/lib/api/db";
import type { WorkflowStatus } from "@/lib/workflow/types";

export async function listOrders(filter?: WorkflowStatus | WorkflowStatus[]) {
  const db = await getDb();
  let request = db
    .from("orders")
    .select(
      "id, status, updated_at, customer_id, quote_id, assigned_sales_id, on_hold_reason, customers(name, phone), quotes(quote_number)",
    )
    .order("updated_at", { ascending: false });

  if (Array.isArray(filter) && filter.length) {
    request = request.in("status", filter);
  } else if (typeof filter === "string") {
    request = request.eq("status", filter);
  }

  return throwQuery(request, "Failed to load orders");
}

export async function listOrdersForCustomer(customerId: string) {
  const db = await getDb();
  return throwQuery(
    db
      .from("orders")
      .select(
        "id, status, updated_at, customer_id, quote_id, assigned_sales_id, on_hold_reason, customers(name, phone), quotes(quote_number)",
      )
      .eq("customer_id", customerId)
      .order("updated_at", { ascending: false }),
    "Failed to load orders",
  );
}

export async function listPaymentsForOrder(orderId: string) {
  const db = await getDb();
  return throwQuery(
    db
      .from("payments")
      .select("id, kind, amount, status, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    "Failed to load payments",
  );
}

export async function getOrder(id: string) {
  const db = await getDb();
  const { data: order, error } = await db
    .from("orders")
    .select(
      "id, status, quote_id, customer_id, assigned_sales_id, on_hold_reason, activated_at, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load order");
  }
  if (!order) {
    return null;
  }

  const [customer, quote, items, payments, vendorOrders, delivery, balance] =
    await Promise.all([
      db
        .from("customers")
        .select("id, name, phone, address, kind")
        .eq("id", order.customer_id)
        .maybeSingle(),
      db
        .from("quotes")
        .select(
          "id, quote_number, status, current_version_id, quote_versions!quotes_current_version_fk(total, version_number)",
        )
        .eq("id", order.quote_id)
        .maybeSingle(),
      db
        .from("order_items")
        .select("id, description, quantity, quantity_received, quantity_pending")
        .eq("order_id", id),
      db
        .from("payments")
        .select("id, kind, amount, status, recorded_by, created_at, notes")
        .eq("order_id", id)
        .order("created_at", { ascending: false }),
      db
        .from("vendor_orders")
        .select(
          "id, vendor_id, status, sent_at, dispatched_at, received_at, expected_delivery_at, vendors(name)",
        )
        .eq("order_id", id)
        .order("created_at", { ascending: false }),
      db
        .from("deliveries")
        .select("id, delivered_at, notes")
        .eq("order_id", id)
        .maybeSingle(),
      db.rpc("order_balance", { p_order_id: id }),
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
  };
}
