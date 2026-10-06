export { isOrderNumber } from "@/lib/documents/number";

export function orderRef(order: {
  order_number?: string | null;
  id?: string | null;
}) {
  if (order.order_number) return order.order_number;
  if (order.id) return `ORD-${order.id.slice(0, 8).toUpperCase()}`;
  return "Order";
}
