import type { WorkflowStatus } from "@/lib/workflow/types";

export const STATUS_LABELS: Record<WorkflowStatus, string> = {
  quote_draft: "Draft",
  quote_pending_accounts: "Awaiting approval",
  quote_rejected: "Returned to sales",
  quote_approved: "Approved",
  quote_sent_to_customer: "Sent to customer",
  payment_pending_verification: "Payment verification",
  order_active: "Order active",
  sent_to_vendor: "Sent to vendor",
  vendor_dispatched: "Vendor dispatched",
  items_received: "Items received",
  delivery_pending_payment: "Delivery check",
  order_on_hold: "On hold",
  delivery_unlocked: "Delivery ready",
  delivered: "Delivered",
  closed: "Closed",
};

export const STATUS_TONE: Record<
  WorkflowStatus,
  "neutral" | "warning" | "success" | "danger" | "info"
> = {
  quote_draft: "neutral",
  quote_pending_accounts: "warning",
  quote_rejected: "danger",
  quote_approved: "success",
  quote_sent_to_customer: "info",
  payment_pending_verification: "warning",
  order_active: "info",
  sent_to_vendor: "info",
  vendor_dispatched: "info",
  items_received: "info",
  delivery_pending_payment: "warning",
  order_on_hold: "danger",
  delivery_unlocked: "success",
  delivered: "success",
  closed: "neutral",
};

export const TIMELINE_STEPS = [
  { key: "approved", label: "Quote approved" },
  { key: "sent", label: "Quote sent" },
  { key: "payment", label: "Payment verified" },
  { key: "active", label: "Order active" },
  { key: "vendor", label: "Sent to vendor" },
  { key: "dispatch", label: "Vendor dispatched" },
  { key: "received", label: "Items received" },
  { key: "paid", label: "Payment complete" },
  { key: "unlocked", label: "Delivery unlocked" },
  { key: "delivered", label: "Delivered" },
  { key: "closed", label: "Closed" },
] as const;

export function timelineIndex(status: WorkflowStatus, activated = false) {
  switch (status) {
    case "quote_draft":
    case "quote_pending_accounts":
    case "quote_rejected":
      return -1;
    case "quote_approved":
      return 0;
    case "quote_sent_to_customer":
      return 1;
    case "payment_pending_verification":
      return activated ? 7 : 2;
    case "order_active":
      return 3;
    case "sent_to_vendor":
      return 4;
    case "vendor_dispatched":
      return 5;
    case "items_received":
    case "delivery_pending_payment":
    case "order_on_hold":
      return 6;
    case "delivery_unlocked":
      return 8;
    case "delivered":
      return 9;
    case "closed":
      return 10;
  }
}
