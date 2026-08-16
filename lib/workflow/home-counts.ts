import {
  displayWorkflowStatus,
  isClosedOrderStatus,
  isCompletedSaleStatus,
  ORDER_BUCKET_STATUSES,
  QUOTE_ONLY_STATUSES,
} from "@/lib/workflow/status-buckets";
import type { WorkflowStatus } from "@/lib/workflow/types";

export type QuoteForCount = {
  status: string;
  order?: { status: string } | null;
};

export type OrderForCount = {
  status: string;
};

export function liveStatus(quote: QuoteForCount): WorkflowStatus {
  return displayWorkflowStatus(
    quote.status as WorkflowStatus,
    quote.order?.status as WorkflowStatus | undefined,
  );
}

export function inStatuses(
  status: string,
  statuses: readonly string[],
) {
  return statuses.includes(status);
}

/** Quotes that have not become an order yet. */
export function openQuoteCount(quotes: QuoteForCount[]) {
  return quotes.filter((quote) =>
    inStatuses(liveStatus(quote), QUOTE_ONLY_STATUSES),
  ).length;
}

export function ordersInBucket(
  orders: OrderForCount[],
  bucket: keyof typeof ORDER_BUCKET_STATUSES,
) {
  return orders.filter((order) =>
    inStatuses(order.status, ORDER_BUCKET_STATUSES[bucket]),
  ).length;
}

export function ordersWithStatus(orders: OrderForCount[], status: string) {
  return orders.filter((order) => order.status === status).length;
}

export function completedOrderCount(orders: OrderForCount[]) {
  return orders.filter((order) =>
    isCompletedSaleStatus(order.status as WorkflowStatus),
  ).length;
}

/** Unique live jobs (quotes + orders), excluding delivered / closed / cancelled. */
export function liveJobCount(
  census: { status: WorkflowStatus; count: number }[],
) {
  return census
    .filter((cell) => !isClosedOrderStatus(cell.status))
    .reduce((sum, cell) => sum + cell.count, 0);
}

export function workWaiting(cards: { kind?: string; count: number }[]) {
  return cards
    .filter((card) => card.kind !== "directory" && card.kind !== "flag")
    .reduce((sum, card) => sum + card.count, 0);
}
