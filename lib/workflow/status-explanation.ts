import type { WorkflowStatus } from "@/lib/workflow/types";
import { formatInr } from "@/lib/format/money";

export function orderStatusExplanation(input: {
  status: WorkflowStatus;
  outstanding: number;
  activated?: boolean;
}): string {
  const { status, outstanding, activated } = input;
  switch (status) {
    case "quote_sent_to_customer":
      return "Waiting for Sales to record payment terms.";
    case "payment_pending_verification":
      return activated
        ? "Accounts must verify the latest payment before delivery can proceed."
        : "Accounts must verify payment before the order can activate.";
    case "order_active":
      return "Procurement can send this order to a vendor.";
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
    default:
      return "Track progress in the timeline below.";
  }
}
