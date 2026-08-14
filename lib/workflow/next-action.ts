import type { AppRole, WorkflowStatus } from "@/lib/workflow/types";
import { formatInr } from "@/lib/format/money";

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
}): NextAction {
  const {
    status,
    role,
    outstanding = 0,
    orderId,
    quoteId,
    activated,
    orderStatus,
  } = input;

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
    });
  }

  switch (status) {
    case "quote_draft":
      return {
        title: "Submit to Accounts",
        detail: "This quote is a draft. Send it for approval.",
        href: quoteId ? `/quotes/${quoteId}` : "/quotes",
        cta: role === "sales" || role === "admin" ? "Submit" : undefined,
      };
    case "quote_pending_accounts":
      return {
        title: "Waiting for Accounts to review",
        detail: "Sales cannot send this quote until Accounts approves it.",
        href: quoteId ? `/approvals/${quoteId}` : "/approvals",
        cta: role === "accounts" || role === "admin" ? "Review" : undefined,
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
        detail: "Only an approved quote can go to the customer.",
        href: quoteId ? `/quotes/${quoteId}` : "/quotes",
        cta: role === "sales" || role === "admin" ? "Send" : undefined,
      };
    case "quote_sent_to_customer":
      return {
        title: "Record payment terms",
        detail: "Log advance, full, or nil payment so Accounts can verify.",
        href: orderId ? `/orders/${orderId}` : "/orders",
        cta: role === "sales" || role === "admin" ? "Record payment" : undefined,
      };
    case "payment_pending_verification":
      return {
        title: "Waiting for Accounts to verify payment",
        detail: activated
          ? "Delivery stays locked until this payment is verified."
          : "The order cannot activate until verification succeeds.",
        href: "/payments",
        cta: role === "accounts" || role === "admin" ? "Verify" : undefined,
      };
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
            ? "Delivery is locked until full payment is verified."
            : "Payment is complete. Delivery can proceed.",
        href: orderId ? `/orders/${orderId}` : "/orders",
        cta:
          outstanding > 0 && (role === "sales" || role === "admin")
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
