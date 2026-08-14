import type { WorkflowStatus } from "@/lib/workflow/types";
import type { Accent } from "@/components/app/progress-bar";

export const ORDER_BUCKET_IDS = [
  "open",
  "payment",
  "active",
  "hold",
  "delivery",
  "closed",
] as const;

export type OrderBucketId = (typeof ORDER_BUCKET_IDS)[number];

const PAYMENT_STATUSES = [
  "quote_sent_to_customer",
  "payment_pending_verification",
] as const satisfies readonly WorkflowStatus[];

const ACTIVE_STATUSES = [
  "order_active",
  "sent_to_vendor",
  "vendor_dispatched",
  "items_received",
] as const satisfies readonly WorkflowStatus[];

const HOLD_STATUSES = [
  "order_on_hold",
  "delivery_pending_payment",
] as const satisfies readonly WorkflowStatus[];

const DELIVERY_STATUSES = ["delivery_unlocked"] as const satisfies readonly WorkflowStatus[];

const CLOSED_STATUSES = ["delivered", "closed"] as const satisfies readonly WorkflowStatus[];

const OPEN_STATUSES = [
  ...PAYMENT_STATUSES,
  ...ACTIVE_STATUSES,
  ...HOLD_STATUSES,
  ...DELIVERY_STATUSES,
] as const satisfies readonly WorkflowStatus[];

export const ORDER_BUCKET_STATUSES: Record<OrderBucketId, readonly WorkflowStatus[]> = {
  open: OPEN_STATUSES,
  payment: PAYMENT_STATUSES,
  active: ACTIVE_STATUSES,
  hold: HOLD_STATUSES,
  delivery: DELIVERY_STATUSES,
  closed: CLOSED_STATUSES,
};

export const ORDER_BUCKET_LABELS: Record<OrderBucketId, string> = {
  open: "Open",
  payment: "Payment",
  active: "Active",
  hold: "On hold",
  delivery: "Delivery",
  closed: "Closed",
};

export const ORDER_BUCKET_ACCENT: Record<OrderBucketId, Accent> = {
  open: "cerulean",
  payment: "cobalt",
  active: "forest",
  hold: "violet",
  delivery: "cerulean",
  closed: "slate",
};

export function isClosedOrderStatus(status: WorkflowStatus) {
  return status === "closed" || status === "delivered";
}

export function isOpenOrderStatus(status: WorkflowStatus) {
  return !isClosedOrderStatus(status);
}

export function orderBucket(status: WorkflowStatus): OrderBucketId {
  if ((CLOSED_STATUSES as readonly string[]).includes(status)) return "closed";
  if ((DELIVERY_STATUSES as readonly string[]).includes(status)) return "delivery";
  if ((HOLD_STATUSES as readonly string[]).includes(status)) return "hold";
  if ((ACTIVE_STATUSES as readonly string[]).includes(status)) return "active";
  if ((PAYMENT_STATUSES as readonly string[]).includes(status)) return "payment";
  return "open";
}

export function parseOrderBucket(value: string | undefined): OrderBucketId | null {
  if (!value) return null;
  return (ORDER_BUCKET_IDS as readonly string[]).includes(value)
    ? (value as OrderBucketId)
    : null;
}

export function statusesForOrderQuery(input: {
  bucket?: string;
  status?: string;
}): {
  bucket: OrderBucketId | "attention";
  filter?: WorkflowStatus | WorkflowStatus[];
} {
  if (input.status) {
    return {
      bucket: orderBucket(input.status as WorkflowStatus),
      filter: input.status as WorkflowStatus,
    };
  }

  const parsed = parseOrderBucket(input.bucket);
  if (parsed) {
    return { bucket: parsed, filter: [...ORDER_BUCKET_STATUSES[parsed]] };
  }

  if (input.bucket === "attention") {
    return {
      bucket: "open",
      filter: [...ORDER_BUCKET_STATUSES.payment, ...ORDER_BUCKET_STATUSES.hold],
    };
  }

  return { bucket: "open", filter: [...ORDER_BUCKET_STATUSES.open] };
}

/** Prefer the order's live status so a closed job is never shown as sent/pending. */
export function displayWorkflowStatus(
  quoteStatus: WorkflowStatus,
  orderStatus?: WorkflowStatus | null,
): WorkflowStatus {
  return orderStatus ?? quoteStatus;
}

export const QUOTE_GROUP_IDS = [
  "open",
  "quote",
  "payment",
  "active",
  "hold",
  "delivery",
  "closed",
] as const;

export type QuoteGroupId = (typeof QUOTE_GROUP_IDS)[number];

const QUOTE_ONLY_STATUSES = [
  "quote_draft",
  "quote_pending_accounts",
  "quote_rejected",
  "quote_approved",
] as const satisfies readonly WorkflowStatus[];

export const QUOTE_GROUP_STATUSES: Record<QuoteGroupId, readonly WorkflowStatus[]> = {
  open: [...QUOTE_ONLY_STATUSES, ...OPEN_STATUSES],
  quote: QUOTE_ONLY_STATUSES,
  payment: PAYMENT_STATUSES,
  active: ACTIVE_STATUSES,
  hold: HOLD_STATUSES,
  delivery: DELIVERY_STATUSES,
  closed: CLOSED_STATUSES,
};

export const QUOTE_GROUP_LABELS: Record<QuoteGroupId, string> = {
  open: "Open",
  quote: "Quotes",
  payment: "Payment",
  active: "In progress",
  hold: "On hold",
  delivery: "Delivery",
  closed: "Closed",
};

export function quoteListGroup(status: WorkflowStatus): QuoteGroupId {
  if ((QUOTE_ONLY_STATUSES as readonly string[]).includes(status)) return "quote";
  return orderBucket(status);
}

export function parseQuoteGroup(value: string | undefined): QuoteGroupId {
  if (value && (QUOTE_GROUP_IDS as readonly string[]).includes(value)) {
    return value as QuoteGroupId;
  }
  return "open";
}

export function latestOpenOrder<T extends { status: string }>(orders: T[]): T | undefined {
  return orders.find((order) => isOpenOrderStatus(order.status as WorkflowStatus)) ?? orders[0];
}
