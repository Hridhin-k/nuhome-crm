export const APP_ROLES = [
  "sales",
  "accounts",
  "procurement",
  "store",
  "admin",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const WORKFLOW_STATUSES = [
  "quote_draft",
  "quote_pending_accounts",
  "quote_rejected",
  "quote_approved",
  "quote_sent_to_customer",
  "payment_pending_verification",
  "order_active",
  "sent_to_vendor",
  "vendor_dispatched",
  "items_received",
  "delivery_pending_payment",
  "order_on_hold",
  "delivery_unlocked",
  "delivered",
  "closed",
  "cancelled",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export function parseWorkflowStatus(
  value?: string | null,
): WorkflowStatus | undefined {
  if (!value) return undefined;
  return (WORKFLOW_STATUSES as readonly string[]).includes(value)
    ? (value as WorkflowStatus)
    : undefined;
}

export const QUOTE_STATUSES = [
  "quote_draft",
  "quote_pending_accounts",
  "quote_rejected",
  "quote_approved",
  "quote_sent_to_customer",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const ORDER_STATUSES = [
  "quote_sent_to_customer",
  "payment_pending_verification",
  "order_active",
  "sent_to_vendor",
  "vendor_dispatched",
  "items_received",
  "delivery_pending_payment",
  "order_on_hold",
  "delivery_unlocked",
  "delivered",
  "closed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_KINDS = ["advance", "full", "nil"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_STATUSES = ["pending", "verified", "rejected"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const AUDIT_ACTIONS = [
  "QUOTE_CREATED",
  "QUOTE_SUBMITTED",
  "QUOTE_REJECTED",
  "QUOTE_REVISED",
  "QUOTE_APPROVED",
  "QUOTE_SENT_TO_CUSTOMER",
  "QUOTE_SHARED_VIA_WHATSAPP",
  "ORDER_CREATED",
  "PAYMENT_RECORDED",
  "PAYMENT_VERIFIED",
  "PAYMENT_REJECTED",
  "ORDER_ACTIVATED",
  "ORDER_SENT_TO_VENDOR",
  "VENDOR_DISPATCHED",
  "ITEMS_RECEIVED",
  "ITEMS_WRITTEN_OFF",
  "ORDER_PLACED_ON_HOLD",
  "DELIVERY_UNLOCKED",
  "ORDER_DELIVERED",
  "ORDER_CLOSED",
  "QUOTE_CANCELLED",
  "ORDER_CANCELLED",
  "ROLE_CHANGED",
  "PROFILE_UPDATED",
  "WORK_REASSIGNED",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
