export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

function payloadId(
  payload: Record<string, unknown>,
  key: "quote_id" | "order_id" | "stock_purchase_id",
) {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

export function notificationHref(notification: AppNotification): string | null {
  const quoteId = payloadId(notification.payload, "quote_id");
  const orderId = payloadId(notification.payload, "order_id");
  const purchaseId = payloadId(notification.payload, "stock_purchase_id");

  switch (notification.type) {
    case "QUOTE_SUBMITTED":
      return quoteId ? `/quotes/${quoteId}` : "/approvals";
    case "QUOTE_APPROVED":
    case "QUOTE_REJECTED":
      return quoteId ? `/quotes/${quoteId}` : "/quotes";
    case "PAYMENT_RECORDED":
      return "/payments";
    case "PAYMENT_VERIFIED":
    case "PAYMENT_REJECTED":
      if (orderId) return `/orders/${orderId}`;
      return quoteId ? `/quotes/${quoteId}` : "/orders";
    case "ORDER_ACTIVATED":
    case "GOODS_INCOMING":
      return orderId ? `/fulfillment/${orderId}` : "/fulfillment";
    case "DELIVERY_UNLOCKED":
      return orderId ? `/orders/${orderId}` : "/ready";
    case "ORDER_PLACED_ON_HOLD":
    case "VENDOR_DISPATCHED":
    case "ORDER_DELIVERED":
    case "ORDER_CANCELLED":
    case "CREDIT_DELIVERY_DECIDED":
    case "BALANCE_DUE":
      return orderId ? `/orders/${orderId}` : "/orders";
    case "WORK_REASSIGNED":
      if (orderId) return `/orders/${orderId}`;
      return quoteId ? `/quotes/${quoteId}` : "/home";
    case "STOCK_PURCHASE_SENT":
    case "STOCK_RECEIVED":
      return purchaseId ? `/stock/${purchaseId}` : "/stock";
    case "ROLE_CHANGED":
      return "/home";
    case "VENDOR_QUOTE_SUBMITTED":
      return orderId ? `/fulfillment/${orderId}` : "/fulfillment";
    case "CREDIT_DELIVERY_REQUESTED":
      return orderId ? `/orders/${orderId}` : "/orders?credit=1";
    case "QUOTE_CANCELLED":
      return quoteId ? `/quotes/${quoteId}` : "/quotes";
    default:
      if (quoteId) return `/quotes/${quoteId}`;
      if (orderId) return `/orders/${orderId}`;
      return null;
  }
}
