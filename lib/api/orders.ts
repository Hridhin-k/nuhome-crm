import { cache } from "react";
import { getDb, throwQuery } from "@/lib/api/db";
import { isOrderNumber } from "@/lib/orders/ref";
import type { WorkflowStatus } from "@/lib/workflow/types";

const ORDER_LIST_SELECT =
  "id, order_number, status, updated_at, created_at, customer_id, quote_id, assigned_sales_id, on_hold_reason, customers(name, phone), quotes(quote_number, quote_versions!quotes_current_version_fk(total, margin_amount)), vendor_orders(status, expected_delivery_at, received_at, sent_at, dispatched_at)";

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
        "id, order_number, status, quote_id, customer_id, assigned_sales_id, on_hold_reason, activated_at, created_at, updated_at",
      ).ilike("order_number", id.trim())
    : db.from("orders").select(
        "id, order_number, status, quote_id, customer_id, assigned_sales_id, on_hold_reason, activated_at, created_at, updated_at",
      ).eq("id", id);

  const { data: order, error } = await lookup.maybeSingle();

  if (error) {
    throw new Error("Failed to load order");
  }
  if (!order) {
    return null;
  }

  const orderId = order.id;
  const [customer, quote, items, payments, vendorOrders, delivery, balance] =
    await Promise.all([
      db
        .from("customers")
        .select("id, name, phone, address, gstin, billing_address, site_address, kind")
        .eq("id", order.customer_id)
        .maybeSingle(),
      db
        .from("quotes")
        .select(
          "id, quote_number, status, current_version_id, quote_versions!quotes_current_version_fk(total, version_number, tax, subtotal, discount)",
        )
        .eq("id", order.quote_id)
        .maybeSingle(),
      db
        .from("order_items")
        .select("id, description, quantity, quantity_received, quantity_written_off, write_off_reason, quantity_pending")
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
          "id, vendor_id, status, sent_at, dispatched_at, received_at, expected_delivery_at, vendors(name), vendor_order_items(id, order_item_id, quantity, quantity_received, quantity_written_off)",
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
      db
        .from("deliveries")
        .select("id, delivered_at, notes")
        .eq("order_id", orderId)
        .maybeSingle(),
      db.rpc("order_balance", { p_order_id: orderId }),
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
});
