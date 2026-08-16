import type { WorkflowStatus } from "@/lib/workflow/types";

export type PaymentSummary = {
  status: string;
};

const RECORDABLE_STATUSES = new Set<WorkflowStatus>([
  "quote_sent_to_customer",
  "payment_pending_verification",
  "order_active",
  "sent_to_vendor",
  "vendor_dispatched",
  "items_received",
  "order_on_hold",
  "delivery_pending_payment",
]);

export function hasPendingPayment(payments: PaymentSummary[]) {
  return payments.some((payment) => payment.status === "pending");
}

/** Sales can record when no payment awaits verification and the order still needs terms or balance. */
export function canRecordPayment(input: {
  status: WorkflowStatus;
  payments: PaymentSummary[];
  outstanding: number;
}) {
  const { status, payments, outstanding } = input;

  if (["delivered", "closed", "cancelled"].includes(status)) {
    return false;
  }

  if (hasPendingPayment(payments)) {
    return false;
  }

  if (!RECORDABLE_STATUSES.has(status)) {
    return false;
  }

  if (status === "quote_sent_to_customer") {
    return true;
  }

  if (status === "payment_pending_verification") {
    // Retry after Accounts rejected the last submission.
    return payments.some((payment) => payment.status === "rejected");
  }

  return outstanding > 0;
}

export function pendingPaymentMessage(payments: PaymentSummary[]) {
  const pending = payments.find((payment) => payment.status === "pending");
  if (!pending) {
    return null;
  }
  return "A payment is pending Accounts verification. You can record another once it is verified or rejected.";
}
