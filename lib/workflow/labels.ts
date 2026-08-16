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

export const STATUS_BADGE_CLASS: Record<WorkflowStatus, string> = {
  quote_draft: "bg-[#e8e8e8] text-[#3c3c3c]",
  quote_pending_accounts: "bg-[#fff3c4] text-[#8a5a00]",
  quote_rejected: "bg-[#fce8e6] text-[#c5221f]",
  quote_approved: "bg-[#d2f4ea] text-[#0f6b5c]",
  quote_sent_to_customer: "bg-[#d2e3fc] text-[#174ea6]",
  payment_pending_verification: "bg-[#fde7c7] text-[#b06000]",
  order_active: "bg-[#e0e7ff] text-[#3730a3]",
  sent_to_vendor: "bg-[#ede7f6] text-[#5b2c83]",
  vendor_dispatched: "bg-[#fce7f3] text-[#9d174d]",
  items_received: "bg-[#cffafe] text-[#0e7490]",
  delivery_pending_payment: "bg-[#ffdad6] text-[#8b1a1a]",
  order_on_hold: "bg-[#fef3c7] text-[#92400e]",
  delivery_unlocked: "bg-[#ecfccb] text-[#3f6212]",
  delivered: "bg-[#e6f4ea] text-[#137333]",
  closed: "bg-[#e2e8f0] text-[#334155]",
  cancelled: "bg-[#ffe4e6] text-[#9f1239]",
};

export const STATUS_DOT_CLASS: Record<WorkflowStatus, string> = {
  quote_draft: "bg-[#6b6b6b]",
  quote_pending_accounts: "bg-[#f9a825]",
  quote_rejected: "bg-[#c5221f]",
  quote_approved: "bg-[#0f6b5c]",
  quote_sent_to_customer: "bg-[#174ea6]",
  payment_pending_verification: "bg-[#ef6c00]",
  order_active: "bg-[#3730a3]",
  sent_to_vendor: "bg-[#5b2c83]",
  vendor_dispatched: "bg-[#9d174d]",
  items_received: "bg-[#0e7490]",
  delivery_pending_payment: "bg-[#ba1a1a]",
  order_on_hold: "bg-[#b45309]",
  delivery_unlocked: "bg-[#3f6212]",
  delivered: "bg-[#137333]",
  closed: "bg-[#334155]",
  cancelled: "bg-[#9f1239]",
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
