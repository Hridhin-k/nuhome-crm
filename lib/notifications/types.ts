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
  key: "quote_id" | "order_id",
) {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

export function notificationHref(notification: AppNotification): string | null {
  const quoteId = payloadId(notification.payload, "quote_id");
  const orderId = payloadId(notification.payload, "order_id");

  switch (notification.type) {
    case "QUOTE_SUBMITTED":
      return quoteId ? `/approvals/${quoteId}` : "/approvals";
    case "QUOTE_APPROVED":
    case "QUOTE_REJECTED":
      return quoteId ? `/quotes/${quoteId}` : "/quotes";
    case "PAYMENT_RECORDED":
      return "/payments";
    case "ORDER_ACTIVATED":
      return orderId ? `/fulfillment/${orderId}` : "/fulfillment";
    case "DELIVERY_UNLOCKED":
      return orderId ? `/orders/${orderId}` : "/ready";
    case "ORDER_PLACED_ON_HOLD":
    case "VENDOR_DISPATCHED":
    case "ORDER_DELIVERED":
    case "ORDER_CANCELLED":
      return orderId ? `/orders/${orderId}` : "/orders";
    case "QUOTE_CANCELLED":
      return quoteId ? `/quotes/${quoteId}` : "/quotes";
    default:
      if (quoteId) return `/quotes/${quoteId}`;
      if (orderId) return `/orders/${orderId}`;
      return null;
  }
}
