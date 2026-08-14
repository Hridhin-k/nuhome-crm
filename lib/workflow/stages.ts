import type { WorkflowStatus } from "@/lib/workflow/types";

export type FlowStage = {
  id: string;
  label: string;
  shortLabel: string;
  phase: "quote" | "payment" | "fulfillment" | "delivery" | "done";
};

/** End-to-end flow stages — mirrors the business process diagram. */
export const FLOW_STAGES: FlowStage[] = [
  { id: "walk_in", label: "Customer walk-in", shortLabel: "Walk-in", phase: "quote" },
  { id: "profile", label: "Profile check", shortLabel: "Profile", phase: "quote" },
  { id: "materials", label: "Materials + pricing", shortLabel: "Materials", phase: "quote" },
  { id: "create_quote", label: "Create quote", shortLabel: "Quote", phase: "quote" },
  { id: "accounts_review", label: "Accounts review", shortLabel: "Review", phase: "quote" },
  { id: "send_customer", label: "Send to customer", shortLabel: "Send", phase: "quote" },
  { id: "payment", label: "Customer payment", shortLabel: "Payment", phase: "payment" },
  { id: "verify", label: "Payment verified", shortLabel: "Verified", phase: "payment" },
  { id: "order_active", label: "Order activated", shortLabel: "Active", phase: "fulfillment" },
  { id: "vendor", label: "Send to vendor", shortLabel: "Vendor", phase: "fulfillment" },
  { id: "dispatch", label: "Vendor dispatch", shortLabel: "Dispatch", phase: "fulfillment" },
  { id: "received", label: "Items received", shortLabel: "Received", phase: "fulfillment" },
  { id: "delivery_gate", label: "Delivery gate", shortLabel: "Gate", phase: "delivery" },
  { id: "deliver", label: "Deliver to customer", shortLabel: "Deliver", phase: "delivery" },
  { id: "closed", label: "Closed", shortLabel: "Closed", phase: "done" },
];

export function flowStageIndex(status: WorkflowStatus, outstanding = 0): number {
  switch (status) {
    case "quote_draft":
      return 3;
    case "quote_pending_accounts":
      return 4;
    case "quote_rejected":
      return 3;
    case "quote_approved":
      return 5;
    case "quote_sent_to_customer":
      return 6;
    case "payment_pending_verification":
      return 7;
    case "order_active":
      return 8;
    case "sent_to_vendor":
      return 9;
    case "vendor_dispatched":
      return 10;
    case "items_received":
    case "delivery_pending_payment":
      return outstanding > 0 ? 12 : 11;
    case "order_on_hold":
      return 12;
    case "delivery_unlocked":
      return 13;
    case "delivered":
      return 14;
    case "closed":
      return 15;
  }
}