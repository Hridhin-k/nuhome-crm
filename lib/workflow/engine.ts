import type { AppRole, PaymentKind, WorkflowStatus } from "@/lib/workflow/types";
import { assertTransition, canSendQuoteToCustomer } from "@/lib/workflow/transitions";
import { roleHasPermission, type Permission } from "@/lib/auth/permissions";

export class WorkflowError extends Error {
  constructor(
    message: string,
    readonly code:
      | "FORBIDDEN"
      | "INVALID_TRANSITION"
      | "VALIDATION"
      | "DELIVERY_LOCKED",
  ) {
    super(message);
    this.name = "WorkflowError";
  }
}

export function assertPermission(role: AppRole, permission: Permission) {
  if (!roleHasPermission(role, permission)) {
    throw new WorkflowError(`Missing permission: ${permission}`, "FORBIDDEN");
  }
}

export function assertCanApproveQuote(input: {
  actorId: string;
  actorRole: AppRole;
  quoteCreatedBy: string;
  status: WorkflowStatus;
}) {
  assertPermission(input.actorRole, "quotes.approve");
  if (input.actorId === input.quoteCreatedBy) {
    throw new WorkflowError("You cannot approve your own quote", "FORBIDDEN");
  }
  assertTransition(input.status, "quote_approved");
}

export function assertCanRejectQuote(input: {
  actorId: string;
  actorRole: AppRole;
  quoteCreatedBy: string;
  status: WorkflowStatus;
  reason: string;
}) {
  assertPermission(input.actorRole, "quotes.reject");
  if (!input.reason.trim()) {
    throw new WorkflowError("Rejection reason is required", "VALIDATION");
  }
  if (input.actorId === input.quoteCreatedBy) {
    throw new WorkflowError("You cannot reject your own quote", "FORBIDDEN");
  }
  assertTransition(input.status, "quote_rejected");
}

export function assertCanSendQuote(input: {
  actorRole: AppRole;
  status: WorkflowStatus;
}) {
  assertPermission(input.actorRole, "quotes.send_to_customer");
  if (!canSendQuoteToCustomer(input.status)) {
    throw new WorkflowError(
      "Only an approved quote can be sent to the customer",
      "INVALID_TRANSITION",
    );
  }
}

export function assertCanVerifyPayment(input: {
  actorId: string;
  actorRole: AppRole;
  recordedBy: string;
}) {
  assertCanDecidePayment(input);
}

export function assertCanRejectPayment(input: {
  actorId: string;
  actorRole: AppRole;
  recordedBy: string;
}) {
  assertCanDecidePayment(input);
}

function assertCanDecidePayment(input: {
  actorId: string;
  actorRole: AppRole;
  recordedBy: string;
}) {
  assertPermission(input.actorRole, "payments.verify");
  if (input.actorId === input.recordedBy) {
    throw new WorkflowError(
      "You cannot verify or reject a payment you recorded",
      "FORBIDDEN",
    );
  }
}

export type BalanceSnapshot = {
  orderTotal: number;
  verifiedPayments: number;
  outstanding: number;
};

export function calculateOutstanding(orderTotal: number, verifiedPayments: number): BalanceSnapshot {
  const outstanding = Number((orderTotal - verifiedPayments).toFixed(2));
  return { orderTotal, verifiedPayments, outstanding };
}

export function resolveDeliveryGate(outstanding: number): Extract<
  WorkflowStatus,
  "delivery_unlocked" | "order_on_hold"
> {
  return outstanding > 0 ? "order_on_hold" : "delivery_unlocked";
}

export function resolvePaymentVerificationNext(input: {
  alreadyActivated: boolean;
  outstanding: number;
  currentStatus: WorkflowStatus;
  itemsFullyReceived: boolean;
}): WorkflowStatus {
  if (!input.alreadyActivated) {
    return "order_active";
  }

  const inFulfillment =
    input.currentStatus === "order_active" ||
    input.currentStatus === "sent_to_vendor" ||
    input.currentStatus === "vendor_dispatched" ||
    (input.currentStatus === "items_received" && !input.itemsFullyReceived);

  if (inFulfillment) {
    return input.currentStatus;
  }

  return resolveDeliveryGate(input.outstanding);
}

export function assertCanDeliver(input: {
  actorRole: AppRole;
  status: WorkflowStatus;
  outstanding: number;
  itemsFullyReceived: boolean;
}) {
  assertPermission(input.actorRole, "deliveries.complete");
  if (input.status !== "delivery_unlocked") {
    throw new WorkflowError(
      `Delivery is locked. Order status is ${input.status}`,
      "DELIVERY_LOCKED",
    );
  }
  if (!input.itemsFullyReceived) {
    throw new WorkflowError(
      "Not all required items have been received",
      "DELIVERY_LOCKED",
    );
  }
  if (input.outstanding > 0) {
    throw new WorkflowError(
      `Delivery blocked. Outstanding balance is ${input.outstanding}`,
      "DELIVERY_LOCKED",
    );
  }
}

export function assertPaymentAmount(kind: PaymentKind, amount: number) {
  if (kind === "nil" && amount !== 0) {
    throw new WorkflowError("Nil payment must be amount 0", "VALIDATION");
  }
  if ((kind === "advance" || kind === "full") && amount <= 0) {
    throw new WorkflowError("Advance and full payments must be greater than 0", "VALIDATION");
  }
}
