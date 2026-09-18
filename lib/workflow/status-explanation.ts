import type { WorkflowStatus } from "@/lib/workflow/types";
import { formatInr } from "@/lib/format/money";

export function orderStatusExplanation(input: {
  status: WorkflowStatus;
  outstanding: number;
  activated?: boolean;
  creditDelivery?: string | null;
}): string {
  const { status, outstanding, activated, creditDelivery } = input;
  if (creditDelivery === "approved") {
    if (status === "payment_pending_verification" || status === "quote_sent_to_customer") {
      return "Credit delivery is approved. This job is not waiting on advance payment.";
    }
    if (status === "order_active") {
      return "Credit delivery approved. Accounts can send this order to a vendor.";
    }
    if (
      status === "order_on_hold" ||
      status === "delivery_pending_payment" ||
      status === "items_received" ||
      status === "delivery_unlocked"
    ) {
      return "Credit delivery approved. Handover is not blocked by outstanding balance.";
    }
  }
  switch (status) {
    case "quote_sent_to_customer":
      return "Waiting for Sales to record payment terms.";
    case "payment_pending_verification":
      return activated
        ? "Accounts must verify the latest payment before delivery can proceed."
        : "Accounts must verify payment before the order can activate.";
    case "order_active":
      return "Accounts can send this order to a vendor.";
    case "sent_to_vendor":
      return "Waiting for the vendor to dispatch goods.";
    case "vendor_dispatched":
      return "Record received quantities when stock arrives.";
    case "items_received":
    case "delivery_pending_payment":
      return outstanding > 0
        ? `Delivery locked until ${formatInr(outstanding)} outstanding is verified.`
        : "Payment complete. Delivery can proceed.";
    case "order_on_hold":
      return `Delivery locked until ${formatInr(outstanding)} outstanding is verified.`;
    case "delivery_unlocked":
      return "Balance cleared. Complete handover with the customer.";
    case "delivered":
      return "Order delivered. Closing out.";
    case "closed":
      return "This order is complete. No further action required.";
    case "cancelled":
      return "This job was cancelled. No further action.";
    default:
      return "Track progress in the timeline below.";
  }
}
