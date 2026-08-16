import type { WorkflowStatus } from "@/lib/workflow/types";

/** Canonical allowed transitions. Must match public.workflow_transitions. */
export const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  quote_draft: ["quote_pending_accounts", "cancelled"],
  quote_pending_accounts: ["quote_approved", "quote_rejected", "cancelled"],
  quote_rejected: ["quote_draft", "cancelled"],
  quote_approved: ["quote_sent_to_customer", "quote_draft", "cancelled"],
  quote_sent_to_customer: ["payment_pending_verification", "cancelled"],
  payment_pending_verification: [
    "order_active",
    "delivery_unlocked",
    "order_on_hold",
    "cancelled",
  ],
  order_active: ["sent_to_vendor", "cancelled"],
  sent_to_vendor: ["vendor_dispatched", "items_received", "cancelled"],
  vendor_dispatched: ["items_received", "cancelled"],
  items_received: ["delivery_pending_payment", "cancelled"],
  delivery_pending_payment: ["delivery_unlocked", "order_on_hold", "cancelled"],
  order_on_hold: ["payment_pending_verification", "cancelled"],
  delivery_unlocked: ["delivered", "cancelled"],
  delivered: ["closed"],
  closed: [],
  cancelled: [],
};

export function canTransition(from: WorkflowStatus, to: WorkflowStatus) {
  return WORKFLOW_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: WorkflowStatus, to: WorkflowStatus) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid transition: ${from} → ${to}`);
  }
}

export function canSendQuoteToCustomer(status: WorkflowStatus) {
  return status === "quote_approved";
}
