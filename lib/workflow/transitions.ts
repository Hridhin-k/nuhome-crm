import type { WorkflowStatus } from "@/lib/workflow/types";

/** Canonical allowed transitions. Must match public.workflow_transitions. */
export const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  quote_draft: ["quote_pending_accounts"],
  quote_pending_accounts: ["quote_approved", "quote_rejected"],
  quote_rejected: ["quote_draft"],
  quote_approved: ["quote_sent_to_customer"],
  quote_sent_to_customer: ["payment_pending_verification"],
  payment_pending_verification: [
    "order_active",
    "delivery_unlocked",
    "order_on_hold",
  ],
  order_active: ["sent_to_vendor"],
  sent_to_vendor: ["vendor_dispatched"],
  vendor_dispatched: ["items_received"],
  items_received: ["delivery_pending_payment"],
  delivery_pending_payment: ["delivery_unlocked", "order_on_hold"],
  order_on_hold: ["payment_pending_verification"],
  delivery_unlocked: ["delivered"],
  delivered: ["closed"],
  closed: [],
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
