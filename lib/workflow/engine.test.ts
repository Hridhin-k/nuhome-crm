import { describe, expect, it } from "vitest";
import { roleHasPermission } from "@/lib/auth/permissions";
import {
  assertCanApproveQuote,
  assertCanDeliver,
  assertCanRejectQuote,
  assertCanSendQuote,
  assertCanVerifyPayment,
  assertCanRejectPayment,
  assertPaymentAmount,
  calculateOutstanding,
  resolveDeliveryGate,
  resolvePaymentVerificationNext,
  WorkflowError,
} from "@/lib/workflow/engine";
import { assertTransition, canSendQuoteToCustomer } from "@/lib/workflow/transitions";
import { WORKFLOW_STATUSES, type WorkflowStatus } from "@/lib/workflow/types";
import { buildAuditRow } from "@/lib/workflow/audit";

describe("quote workflow", () => {
  it("allows draft → pending accounts", () => {
    expect(() => assertTransition("quote_draft", "quote_pending_accounts")).not.toThrow();
  });

  it("allows accounts to approve or reject a submitted quote", () => {
    expect(() => assertTransition("quote_pending_accounts", "quote_approved")).not.toThrow();
    expect(() => assertTransition("quote_pending_accounts", "quote_rejected")).not.toThrow();
  });

  it("returns a rejected quote to draft for revision", () => {
    expect(() => assertTransition("quote_rejected", "quote_draft")).not.toThrow();
  });

  it("lets sales withdraw an approved quote before send", () => {
    expect(() => assertTransition("quote_approved", "quote_draft")).not.toThrow();
    expect(() =>
      assertTransition("quote_approved", "quote_sent_to_customer"),
    ).not.toThrow();
    expect(() =>
      assertTransition("quote_sent_to_customer", "quote_draft"),
    ).toThrow();
  });

  it("never sends a rejected quote to the customer", () => {
    expect(canSendQuoteToCustomer("quote_rejected")).toBe(false);
    expect(() => assertTransition("quote_rejected", "quote_sent_to_customer")).toThrow();
    expect(() =>
      assertCanSendQuote({ actorRole: "sales", status: "quote_rejected" }),
    ).toThrow(WorkflowError);
  });

  it("only sends an approved quote", () => {
    expect(() =>
      assertCanSendQuote({ actorRole: "sales", status: "quote_approved" }),
    ).not.toThrow();
  });

  it("blocks sales from approving their own quote", () => {
    expect(() =>
      assertCanApproveQuote({
        actorId: "sales-1",
        actorRole: "sales",
        quoteCreatedBy: "other",
        status: "quote_pending_accounts",
      }),
    ).toThrow(/Missing permission/);

    expect(() =>
      assertCanApproveQuote({
        actorId: "accounts-1",
        actorRole: "accounts",
        quoteCreatedBy: "accounts-1",
        status: "quote_pending_accounts",
      }),
    ).toThrow(/own quote/);
  });

  it("requires a rejection reason", () => {
    expect(() =>
      assertCanRejectQuote({
        actorId: "accounts-1",
        actorRole: "accounts",
        quoteCreatedBy: "sales-1",
        status: "quote_pending_accounts",
        reason: "   ",
      }),
    ).toThrow(/reason/);
  });
});

describe("payment and activation", () => {
  it("blocks sales from verifying their own payment", () => {
    expect(() =>
      assertCanVerifyPayment({
        actorId: "sales-1",
        actorRole: "sales",
        recordedBy: "sales-1",
      }),
    ).toThrow(/Missing permission/);

    expect(() =>
      assertCanVerifyPayment({
        actorId: "accounts-1",
        actorRole: "accounts",
        recordedBy: "accounts-1",
      }),
    ).toThrow(/you recorded/);

    expect(() =>
      assertCanRejectPayment({
        actorId: "sales-1",
        actorRole: "sales",
        recordedBy: "other",
      }),
    ).toThrow(/Missing permission/);

    expect(() =>
      assertCanRejectPayment({
        actorId: "accounts-1",
        actorRole: "accounts",
        recordedBy: "accounts-1",
      }),
    ).toThrow(/you recorded/);

    expect(() =>
      assertCanRejectPayment({
        actorId: "accounts-1",
        actorRole: "accounts",
        recordedBy: "sales-1",
      }),
    ).not.toThrow();
  });

  it("activates the order on first verified payment terms", () => {
    expect(
      resolvePaymentVerificationNext({
        alreadyActivated: false,
        outstanding: 5000,
        currentStatus: "payment_pending_verification",
        itemsFullyReceived: false,
      }),
    ).toBe("order_active");
  });

  it("does not skip vendor fulfillment when a later payment is verified", () => {
    expect(
      resolvePaymentVerificationNext({
        alreadyActivated: true,
        outstanding: 0,
        currentStatus: "order_active",
        itemsFullyReceived: false,
      }),
    ).toBe("order_active");
    expect(
      resolvePaymentVerificationNext({
        alreadyActivated: true,
        outstanding: 0,
        currentStatus: "sent_to_vendor",
        itemsFullyReceived: false,
      }),
    ).toBe("sent_to_vendor");
  });

  it("unlocks delivery after on-hold payment when outstanding is 0", () => {
    expect(
      resolvePaymentVerificationNext({
        alreadyActivated: true,
        outstanding: 0,
        currentStatus: "payment_pending_verification",
        itemsFullyReceived: true,
      }),
    ).toBe("delivery_unlocked");
  });

  it("keeps the order on hold if a verified payment still leaves a balance", () => {
    expect(
      resolvePaymentVerificationNext({
        alreadyActivated: true,
        outstanding: 100,
        currentStatus: "order_on_hold",
        itemsFullyReceived: true,
      }),
    ).toBe("order_on_hold");
  });

  it("validates nil vs advance amounts", () => {
    expect(() => assertPaymentAmount("nil", 0)).not.toThrow();
    expect(() => assertPaymentAmount("nil", 10)).toThrow();
    expect(() => assertPaymentAmount("full", 0)).toThrow();
  });
});

describe("vendor and delivery gate", () => {
  it("does not allow skip from items_received to delivered", () => {
    expect(() => assertTransition("items_received", "delivered")).toThrow();
    expect(() =>
      assertTransition("items_received", "delivery_pending_payment"),
    ).not.toThrow();
  });

  it("allows closing remainder without a goods receipt", () => {
    expect(() =>
      assertTransition("sent_to_vendor", "items_received"),
    ).not.toThrow();
  });

  it("calculates outstanding server-side", () => {
    expect(calculateOutstanding(10000, 2500)).toEqual({
      orderTotal: 10000,
      verifiedPayments: 2500,
      outstanding: 7500,
    });
  });

  it("holds delivery when outstanding > 0", () => {
    expect(resolveDeliveryGate(1)).toBe("order_on_hold");
    expect(resolveDeliveryGate(0)).toBe("delivery_unlocked");
  });

  it("rejects delivery unless unlocked, received, and paid", () => {
    expect(() =>
      assertCanDeliver({
        actorRole: "store",
        status: "order_on_hold",
        outstanding: 0,
        itemsFullyReceived: true,
      }),
    ).toThrow(/locked/);

    expect(() =>
      assertCanDeliver({
        actorRole: "store",
        status: "delivery_unlocked",
        outstanding: 50,
        itemsFullyReceived: true,
      }),
    ).toThrow(/Outstanding/);

    expect(() =>
      assertCanDeliver({
        actorRole: "store",
        status: "delivery_unlocked",
        outstanding: 0,
        itemsFullyReceived: false,
      }),
    ).toThrow(/received/);

    expect(() =>
      assertCanDeliver({
        actorRole: "sales",
        status: "delivery_unlocked",
        outstanding: 0,
        itemsFullyReceived: true,
      }),
    ).toThrow(/permission/);

    expect(() =>
      assertCanDeliver({
        actorRole: "store",
        status: "delivery_unlocked",
        outstanding: 0,
        itemsFullyReceived: true,
      }),
    ).not.toThrow();
  });
});

describe("permissions", () => {
  it("does not let sales approve quotes or verify payments", () => {
    expect(roleHasPermission("sales", "quotes.approve")).toBe(false);
    expect(roleHasPermission("sales", "payments.verify")).toBe(false);
    expect(roleHasPermission("accounts", "quotes.approve")).toBe(true);
    expect(roleHasPermission("accounts", "payments.verify")).toBe(true);
  });
});

describe("audit payload", () => {
  it("records actor, role, action, entity, and states", () => {
    const row = buildAuditRow({
      actorId: "a",
      actorRole: "accounts",
      action: "QUOTE_APPROVED",
      entityType: "quote",
      entityId: "q1",
      oldState: "quote_pending_accounts",
      newState: "quote_approved",
    });
    expect(row.action).toBe("QUOTE_APPROVED");
    expect(row.old_state).toBe("quote_pending_accounts");
    expect(row.new_state).toBe("quote_approved");
  });
});

describe("transition table completeness", () => {
  it("defines every workflow status", async () => {
    const { WORKFLOW_TRANSITIONS } = await import("@/lib/workflow/transitions");
    for (const status of WORKFLOW_STATUSES) {
      expect(Array.isArray(WORKFLOW_TRANSITIONS[status as WorkflowStatus])).toBe(true);
    }
  });
});
