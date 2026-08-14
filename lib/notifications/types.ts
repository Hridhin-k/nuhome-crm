export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export function notificationHref(notification: AppNotification): string | null {
  const quoteId = notification.payload.quote_id;
  const orderId = notification.payload.order_id;
  if (typeof quoteId === "string") return `/quotes/${quoteId}`;
  if (typeof orderId === "string") return `/orders/${orderId}`;
  return null;
}
