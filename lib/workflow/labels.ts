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

const TILE = {
  quiet: "bg-[#e4e4e4] text-[#1b1b1b]",
  wait: "bg-[#cfd6e4] text-[#1a2744]",
  stop: "bg-[#e4dcdc] text-[#8b1515]",
  go: "bg-[#c5d4c9] text-[#0f3d24]",
  move: "bg-[#c9cee4] text-[#1e1b4b]",
  vendor: "bg-[#d0d5dc] text-[#2d3a4a]",
  hold: "bg-[#d8d0c4] text-[#4a3510]",
} as const;

/** Floor tiles: ink on cool gray. No coral, pink, or candy pastels. */
export const STATUS_TILE_CLASS: Record<WorkflowStatus, string> = {
  quote_draft: TILE.quiet,
  quote_pending_accounts: TILE.wait,
  quote_rejected: TILE.stop,
  quote_approved: TILE.go,
  quote_sent_to_customer: TILE.move,
  payment_pending_verification: TILE.wait,
  order_active: TILE.move,
  sent_to_vendor: TILE.vendor,
  vendor_dispatched: TILE.vendor,
  items_received: TILE.vendor,
  delivery_pending_payment: TILE.stop,
  order_on_hold: TILE.hold,
  delivery_unlocked: TILE.go,
  delivered: TILE.go,
  closed: TILE.quiet,
  cancelled: TILE.stop,
};

export const STATUS_BADGE_CLASS: Record<WorkflowStatus, string> = {
  quote_draft: "bg-surface-container-high text-on-surface",
  quote_pending_accounts: "bg-surface-container-high text-on-surface",
  quote_rejected: "bg-surface-container-high text-on-surface",
  quote_approved: "bg-surface-container-high text-on-surface",
  quote_sent_to_customer: "bg-surface-container-high text-on-surface",
  payment_pending_verification: "bg-surface-container-high text-on-surface",
  order_active: "bg-surface-container-high text-on-surface",
  sent_to_vendor: "bg-surface-container-high text-on-surface",
  vendor_dispatched: "bg-surface-container-high text-on-surface",
  items_received: "bg-surface-container-high text-on-surface",
  delivery_pending_payment: "bg-surface-container-high text-on-surface",
  order_on_hold: "bg-surface-container-high text-on-surface",
  delivery_unlocked: "bg-surface-container-high text-on-surface",
  delivered: "bg-surface-container-high text-on-surface",
  closed: "bg-surface-container-high text-on-surface",
  cancelled: "bg-surface-container-high text-on-surface",
};

export const STATUS_DOT_CLASS: Record<WorkflowStatus, string> = {
  quote_draft: "bg-[#5c5c5c]",
  quote_pending_accounts: "bg-[#1a2744]",
  quote_rejected: "bg-[#ba1a1a]",
  quote_approved: "bg-[#137333]",
  quote_sent_to_customer: "bg-[#3730a3]",
  payment_pending_verification: "bg-[#4a3510]",
  order_active: "bg-[#1e1b4b]",
  sent_to_vendor: "bg-[#2d3a4a]",
  vendor_dispatched: "bg-[#475569]",
  items_received: "bg-[#1e293b]",
  delivery_pending_payment: "bg-[#8b1515]",
  order_on_hold: "bg-[#6b4e1e]",
  delivery_unlocked: "bg-[#0f3d24]",
  delivered: "bg-[#14532d]",
  closed: "bg-[#334155]",
  cancelled: "bg-[#7f1d1d]",
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
