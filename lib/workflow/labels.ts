import type { WorkflowStatus } from "@/lib/workflow/types";

export const STATUS_LABELS: Record<WorkflowStatus, string> = {
  quote_draft: "Draft",
  quote_pending_accounts: "Pending",
  quote_rejected: "Returned",
  quote_approved: "Approved",
  quote_sent_to_customer: "Sent",
  payment_pending_verification: "Verify pay",
  order_active: "Active",
  sent_to_vendor: "With vendor",
  vendor_dispatched: "Dispatched",
  items_received: "Received",
  delivery_pending_payment: "Locked",
  order_on_hold: "On hold",
  delivery_unlocked: "Ready",
  delivered: "Delivered",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<
  WorkflowStatus,
  "draft" | "waiting" | "rejected" | "approved" | "sent" | "verify" | "active" | "vendor" | "dispatch" | "received" | "gate" | "hold"   | "ready" | "delivered" | "closed" | "cancelled"
> = {
  quote_draft: "draft",
  quote_pending_accounts: "waiting",
  quote_rejected: "rejected",
  quote_approved: "approved",
  quote_sent_to_customer: "sent",
  payment_pending_verification: "verify",
  order_active: "active",
  sent_to_vendor: "vendor",
  vendor_dispatched: "dispatch",
  items_received: "received",
  delivery_pending_payment: "gate",
  order_on_hold: "hold",
  delivery_unlocked: "ready",
  delivered: "delivered",
  closed: "closed",
  cancelled: "cancelled",
};

const BADGE_DRAFT = "bg-surface-container-highest text-on-surface-variant";
const BADGE_WAITING = "bg-warning-container text-warning";
const BADGE_BLOCKED = "bg-[#fce8e6] text-[#c5221f]";
const BADGE_ACTIVE = "bg-secondary-container text-on-secondary-container";
const BADGE_DONE = "bg-success-container text-success";
const BADGE_HOLD = "bg-warning-container text-warning";

export const STATUS_BADGE_CLASS: Record<WorkflowStatus, string> = {
  quote_draft: BADGE_DRAFT,
  quote_pending_accounts: BADGE_WAITING,
  quote_rejected: BADGE_BLOCKED,
  quote_approved: BADGE_DONE,
  quote_sent_to_customer: BADGE_DONE,
  payment_pending_verification: BADGE_WAITING,
  order_active: BADGE_ACTIVE,
  sent_to_vendor: BADGE_WAITING,
  vendor_dispatched: BADGE_WAITING,
  items_received: BADGE_ACTIVE,
  delivery_pending_payment: BADGE_HOLD,
  order_on_hold: BADGE_HOLD,
  delivery_unlocked: BADGE_DONE,
  delivered: BADGE_DONE,
  closed: BADGE_DONE,
  cancelled: BADGE_BLOCKED,
};

export const STATUS_DOT_CLASS: Record<WorkflowStatus, string> = {
  quote_draft: "bg-outline",
  quote_pending_accounts: "bg-warning",
  quote_rejected: "bg-error",
  quote_approved: "bg-secondary",
  quote_sent_to_customer: "bg-warning",
  payment_pending_verification: "bg-warning",
  order_active: "bg-secondary",
  sent_to_vendor: "bg-warning",
  vendor_dispatched: "bg-warning",
  items_received: "bg-secondary",
  delivery_pending_payment: "bg-error",
  order_on_hold: "bg-error",
  delivery_unlocked: "bg-secondary",
  delivered: "bg-success",
  closed: "bg-success",
  cancelled: "bg-error",
};

export const STATUS_NEXT_LINE: Record<WorkflowStatus, string> = {
  quote_draft: "Finish the quote and submit to Accounts.",
  quote_pending_accounts: "Accounts is reviewing price, discount, and margin.",
  quote_rejected: "Revise this version and resubmit.",
  quote_approved: "Send the approved quote to the customer.",
  quote_sent_to_customer: "Record advance, full, or nil payment.",
  payment_pending_verification: "Accounts must verify or reject the payment before the order activates.",
  order_active: "Procurement can send this to a vendor.",
  sent_to_vendor: "Waiting for the vendor to dispatch.",
  vendor_dispatched: "Record goods when they arrive at store.",
  items_received: "Delivery gate — check outstanding payment.",
  delivery_pending_payment: "Outstanding balance must be verified before delivery.",
  order_on_hold: "Delivery locked until the balance is verified.",
  delivery_unlocked: "Complete handover with the customer.",
  delivered: "Handover done — closing out.",
  closed: "This job is complete. No further action.",
  cancelled: "This job was cancelled. No further action.",
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
    case "cancelled":
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
