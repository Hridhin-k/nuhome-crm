import { formatInr } from "@/lib/format/money";
import {
  canRecordPayment,
  hasPendingPayment,
} from "@/lib/workflow/payment-recording";
import type { AppRole, WorkflowStatus } from "@/lib/workflow/types";

export type NextAction = {
  title: string;
  detail: string;
  href?: string;
  cta?: string;
};

export function nextRequiredAction(input: {
  status: WorkflowStatus;
  role: AppRole;
  outstanding?: number;
  orderId?: string;
  quoteId?: string;
  activated?: boolean;
  orderStatus?: WorkflowStatus;
  payments?: { status: string }[];
}): NextAction {
  const {
    status,
    role,
    outstanding = 0,
    orderId,
    quoteId,
    activated,
    orderStatus,
    payments = [],
  } = input;

    const salesCanRecord =
    (role === "sales" || role === "admin" || role === "store") &&
    canRecordPayment({ status, payments, outstanding });

  if (
    status === "quote_sent_to_customer" &&
    orderStatus &&
    orderStatus !== "quote_sent_to_customer"
  ) {
    return nextRequiredAction({
      status: orderStatus,
      role,
      outstanding,
      orderId,
      quoteId,
      activated,
      orderStatus,
      payments,
    });
  }

  switch (status) {
    case "quote_draft":
      return {
        title: "Finish this draft",
        detail: "Save more changes or submit to Accounts when it is ready.",
        href: quoteId ? `/quotes/${quoteId}/revise` : "/quotes",
        cta: role === "sales" || role === "admin" ? "Edit draft" : undefined,
      };
    case "quote_pending_accounts":
      return role === "accounts" || role === "admin"
        ? {
            title: "Approve quote",
            detail: "Review margins and discounts before approving for Sales.",
            href: quoteId ? `/quotes/${quoteId}` : "/approvals",
            cta: "Review",
          }
        : {
            title: "Waiting for Accounts to review",
            detail: "Sales cannot send this quote until Accounts approves it.",
          };
    case "quote_rejected":
      return {
        title: "Revise and resubmit",
        detail: "Accounts returned this quote. Create a new version.",
        href: quoteId ? `/quotes/${quoteId}` : "/quotes",
        cta: role === "sales" || role === "admin" ? "Revise" : undefined,
      };
    case "quote_approved":
      return {
        title: "Send to customer",
        detail:
          "Only an approved quote can go to the customer. Correct it first if something is wrong — Accounts will need to approve again.",
        href: quoteId ? `/quotes/${quoteId}` : "/quotes",
        cta: role === "sales" || role === "admin" ? "Send" : undefined,
      };
    case "quote_sent_to_customer":
      return {
        title: "Record payment terms",
        detail: hasPendingPayment(payments)
          ? "Accounts is verifying the payment you recorded."
          : "Log advance, full, or nil payment so Accounts can verify.",
        href: orderId ? `/orders/${orderId}` : "/orders",
        cta: salesCanRecord ? "Record payment" : undefined,
      };
    case "payment_pending_verification": {
      const rejected = payments.some((payment) => payment.status === "rejected");
      if (!hasPendingPayment(payments) && rejected) {
        return {
          title: "Record a corrected payment",
          detail:
            "Accounts sent the last entry back. Log the right amount so they can verify again.",
          href: orderId ? `/orders/${orderId}` : "/orders",
          cta: salesCanRecord ? "Record payment" : undefined,
        };
      }
      return {
        title: "Waiting for Accounts to review payment",
        detail: activated
          ? "Delivery stays locked until this payment is verified."
          : "The order cannot activate until verification succeeds. Accounts can verify or send it back.",
        href: "/payments",
        cta: role === "accounts" || role === "admin" ? "Review" : undefined,
      };
    }
    case "order_active":
      return {
        title: "Waiting for vendor send",
        detail: "Procurement can place this with a vendor.",
        href: orderId ? `/fulfillment/${orderId}` : "/fulfillment",
        cta:
          role === "procurement" || role === "admin" ? "Send to vendor" : undefined,
      };
    case "sent_to_vendor":
      return {
        title: "Waiting for vendor dispatch",
        detail: "Mark dispatch when the vendor ships.",
        href: orderId ? `/fulfillment/${orderId}` : "/fulfillment",
        cta:
          role === "procurement" || role === "admin" ? "Mark dispatched" : undefined,
      };
    case "vendor_dispatched":
      return {
        title: "Waiting for goods receipt",
        detail: "Record received quantities when stock arrives.",
        href: orderId ? `/fulfillment/${orderId}` : "/fulfillment",
        cta:
          role === "procurement" || role === "store" || role === "admin"
            ? "Record receipt"
            : undefined,
      };
    case "items_received":
    case "delivery_pending_payment":
    case "order_on_hold":
      return {
        title:
          outstanding > 0
            ? `${formatInr(outstanding)} outstanding before delivery`
            : "Delivery check",
        detail:
          outstanding > 0
            ? "Sales or Delivery can take cash or UPI. Accounts must verify before handover."
            : "Payment is complete. Delivery can proceed.",
        href: orderId ? `/orders/${orderId}` : "/orders",
        cta:
          salesCanRecord
            ? "Record payment"
            : role === "store" || role === "admin"
              ? "Open delivery"
              : undefined,
      };
    case "delivery_unlocked":
      return {
        title: "Ready for delivery",
        detail: "Balance is cleared. Complete delivery with the customer.",
        href: orderId ? `/orders/${orderId}` : "/ready",
        cta: role === "store" || role === "admin" ? "Complete delivery" : undefined,
      };
    case "delivered":
      return { title: "Delivered", detail: "This order is closing." };
    case "closed":
      return {
        title: "Order closed",
        detail: "This quote's order has been delivered and closed.",
        href: orderId ? `/orders/${orderId}` : undefined,
        cta: orderId ? "View order" : undefined,
      };
  }
}
