import type { WorkflowStatus } from "@/lib/workflow/types";

export const STATUS_LABELS: Record<WorkflowStatus, string> = {
  quote_draft: "Draft",
  quote_pending_accounts: "Awaiting approval",
  quote_rejected: "Returned to sales",
  quote_approved: "Approved — send to customer",
  quote_sent_to_customer: "Awaiting payment terms",
  payment_pending_verification: "Waiting for verification",
  order_active: "Order active",
  sent_to_vendor: "Sent to vendor",
  vendor_dispatched: "Vendor dispatched",
  items_received: "Items received",
  delivery_pending_payment: "Delivery locked",
  order_on_hold: "On hold",
  delivery_unlocked: "Ready to deliver",
  delivered: "Delivered",
  closed: "Closed",
};

export const STATUS_TONE: Record<
  WorkflowStatus,
  "draft" | "waiting" | "rejected" | "approved" | "sent" | "verify" | "active" | "vendor" | "dispatch" | "received" | "gate" | "hold" | "ready" | "delivered" | "closed"
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
};

export const STATUS_BADGE_CLASS: Record<WorkflowStatus, string> = {
  quote_draft: "bg-zinc-100 text-zinc-700",
  quote_pending_accounts: "bg-amber-100 text-amber-900",
  quote_rejected: "bg-red-100 text-red-800",
  quote_approved: "bg-emerald-100 text-emerald-800",
  quote_sent_to_customer: "bg-sky-100 text-sky-800",
  payment_pending_verification: "bg-orange-100 text-orange-900",
  order_active: "bg-blue-100 text-blue-800",
  sent_to_vendor: "bg-teal-100 text-teal-800",
  vendor_dispatched: "bg-cyan-100 text-cyan-900",
  items_received: "bg-lime-100 text-lime-900",
  delivery_pending_payment: "bg-yellow-100 text-yellow-900",
  order_on_hold: "bg-red-100 text-red-800",
  delivery_unlocked: "bg-green-100 text-green-800",
  delivered: "bg-emerald-200 text-emerald-900",
  closed: "bg-zinc-200 text-zinc-600",
};

export const STATUS_DOT_CLASS: Record<WorkflowStatus, string> = {
  quote_draft: "bg-zinc-400",
  quote_pending_accounts: "bg-amber-500",
  quote_rejected: "bg-red-600",
  quote_approved: "bg-emerald-600",
  quote_sent_to_customer: "bg-sky-600",
  payment_pending_verification: "bg-orange-500",
  order_active: "bg-blue-600",
  sent_to_vendor: "bg-teal-600",
  vendor_dispatched: "bg-cyan-600",
  items_received: "bg-lime-600",
  delivery_pending_payment: "bg-yellow-500",
  order_on_hold: "bg-red-600",
  delivery_unlocked: "bg-green-600",
  delivered: "bg-emerald-700",
  closed: "bg-zinc-500",
};

export const STATUS_NEXT_LINE: Record<WorkflowStatus, string> = {
  quote_draft: "Finish the quote and submit to Accounts.",
  quote_pending_accounts: "Accounts is reviewing price, discount, and margin.",
  quote_rejected: "Revise this version and resubmit.",
  quote_approved: "Send the approved quote to the customer.",
  quote_sent_to_customer: "Record advance, full, or nil payment.",
  payment_pending_verification: "Accounts must verify the payment before the order activates.",
  order_active: "Procurement can send this to a vendor.",
  sent_to_vendor: "Waiting for the vendor to dispatch.",
  vendor_dispatched: "Record goods when they arrive at store.",
  items_received: "Delivery gate — check outstanding payment.",
  delivery_pending_payment: "Outstanding balance must be verified before delivery.",
  order_on_hold: "Delivery locked until the balance is verified.",
  delivery_unlocked: "Complete handover with the customer.",
  delivered: "Handover done — closing out.",
  closed: "This job is complete. No further action.",
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
