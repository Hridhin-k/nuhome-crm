import type { WorkflowStatus } from "@/lib/workflow/types";

export const STUCK_REASONS = [
  "pending_approval",
  "pending_payment",
  "on_hold",
  "overdue_vendor",
  "revision_pending",
  "credit_delivery",
] as const;

export type StuckReason = (typeof STUCK_REASONS)[number];

export function stuckReasonFor(input: {
  quoteStatus?: WorkflowStatus | string | null;
  orderStatus?: WorkflowStatus | string | null;
  overdueVendor?: boolean;
  revisionPending?: boolean;
  creditDelivery?: string | null;
}): StuckReason | null {
  if (input.creditDelivery === "requested") return "credit_delivery";
  if (input.revisionPending) return "revision_pending";
  if (input.quoteStatus === "quote_pending_accounts") return "pending_approval";
  if (input.orderStatus === "payment_pending_verification") {
    return "pending_payment";
  }
  if (input.orderStatus === "order_on_hold") return "on_hold";
  if (input.overdueVendor) return "overdue_vendor";
  return null;
}

export function stuckLabel(reason: StuckReason) {
  switch (reason) {
    case "pending_approval":
      return "Waiting for quote approval";
    case "pending_payment":
      return "Waiting for payment verify";
    case "on_hold":
      return "On hold for balance";
    case "overdue_vendor":
      return "Vendor overdue";
    case "revision_pending":
      return "Revision pending approval";
    case "credit_delivery":
      return "Credit delivery request";
  }
}
