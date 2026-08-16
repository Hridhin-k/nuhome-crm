import { describe, expect, it } from "vitest";
import {
  assertCanApproveQuote,
  assertCanDeliver,
  assertCanRejectPayment,
  assertCanRejectQuote,
  assertCanSendQuote,
  assertCanVerifyPayment,
  assertPaymentAmount,
  calculateOutstanding,
  resolveDeliveryGate,
  resolvePaymentVerificationNext,
  WorkflowError,
} from "@/lib/workflow/engine";
import { assertTransition, canTransition } from "@/lib/workflow/transitions";
import { canRecordPayment } from "@/lib/workflow/payment-recording";
import { availableToSend, unaccountedQty } from "@/lib/workflow/fulfillment";
import { canCancelJob } from "@/lib/workflow/cancel";
import { rolesHavePermission } from "@/lib/auth/permissions";
import { lineTotalWithGst } from "@/lib/gst";
import { recordPaymentSchema } from "@/lib/validation/workflow";
import type { WorkflowStatus } from "@/lib/workflow/types";

const SALES = "sales-1";
const ACCOUNTS = "accounts-1";
const UUID = "550e8400-e29b-41d4-a716-446655440000";

type Job = {
  status: WorkflowStatus;
  createdBy: string;
  activated: boolean;
  orderTotal: number;
  verified: number;
  payments: { status: string; recordedBy: string; amount: number }[];
  allocated: number;
  received: number;
  writtenOff: number;
  quantity: number;
};

function outstanding(job: Job) {
  return calculateOutstanding(job.orderTotal, job.verified).outstanding;
}

function verifyFirstPayment(job: Job): WorkflowStatus {
  const pending = job.payments.find((payment) => payment.status === "pending");
  if (!pending) throw new Error("no pending payment");
  assertCanVerifyPayment({
    actorId: ACCOUNTS,
    actorRole: "accounts",
    recordedBy: pending.recordedBy,
  });
  pending.status = "verified";
  job.verified += pending.amount;
  const next = resolvePaymentVerificationNext({
    alreadyActivated: job.activated,
    outstanding: outstanding(job),
    currentStatus: job.status,
    itemsFullyReceived: unaccountedQty({
      quantity: job.quantity,
      quantity_received: job.received,
      quantity_written_off: job.writtenOff,
    }) === 0 && job.received + job.writtenOff > 0,
  });
  if (next === "order_active") job.activated = true;
  job.status = next;
  return next;
}

describe("quote → pay → vendor → deliver pipeline", () => {
  it("walks a fully paid job through every live status without skipping vendor", () => {
    const total = lineTotalWithGst(1, 100_000, 0, 18);
    const job: Job = {
      status: "quote_draft",
      createdBy: SALES,
      activated: false,
      orderTotal: total,
      verified: 0,
      payments: [],
      allocated: 0,
      received: 0,
      writtenOff: 0,
      quantity: 10,
    };

    assertTransition(job.status, "quote_pending_accounts");
    job.status = "quote_pending_accounts";

    expect(() =>
      assertCanApproveQuote({
        actorId: SALES,
        actorRole: "sales",
        quoteCreatedBy: job.createdBy,
        status: job.status,
      }),
    ).toThrow(WorkflowError);

    assertCanApproveQuote({
      actorId: ACCOUNTS,
      actorRole: "accounts",
      quoteCreatedBy: job.createdBy,
      status: job.status,
    });
    assertTransition(job.status, "quote_approved");
    job.status = "quote_approved";

    assertCanSendQuote({ actorRole: "sales", status: job.status });
    assertTransition(job.status, "quote_sent_to_customer");
    job.status = "quote_sent_to_customer";

    expect(
      canRecordPayment({
        status: job.status,
        payments: job.payments,
        outstanding: outstanding(job),
      }),
    ).toBe(true);
    assertPaymentAmount("full", total);
    recordPaymentSchema.parse({ quote_id: UUID, kind: "full", amount: total, method: "upi" });
    job.payments.push({ status: "pending", recordedBy: SALES, amount: total });
    assertTransition(job.status, "payment_pending_verification");
    job.status = "payment_pending_verification";

    expect(verifyFirstPayment(job)).toBe("order_active");
    expect(job.activated).toBe(true);
    expect(outstanding(job)).toBe(0);

    assertTransition(job.status, "sent_to_vendor");
    expect(availableToSend({ quantity: job.quantity, allocated: 0 })).toBe(10);
    job.allocated = 10;
    job.status = "sent_to_vendor";

    assertTransition(job.status, "vendor_dispatched");
    job.status = "vendor_dispatched";
    assertTransition(job.status, "items_received");
    job.received = 10;
    job.status = "items_received";

    expect(canTransition("items_received", "delivered")).toBe(false);
    assertTransition(job.status, "delivery_pending_payment");
    job.status = "delivery_pending_payment";
    expect(resolveDeliveryGate(outstanding(job))).toBe("delivery_unlocked");
    assertTransition(job.status, "delivery_unlocked");
    job.status = "delivery_unlocked";

    assertCanDeliver({
      actorRole: "store",
      status: job.status,
      outstanding: outstanding(job),
      itemsFullyReceived: true,
    });
    assertTransition(job.status, "delivered");
    job.status = "delivered";
    assertTransition(job.status, "closed");
    job.status = "closed";
    expect(canTransition("closed", "order_active")).toBe(false);
  });

  it("keeps an advance job on hold after GRN until the balance is verified", () => {
    const total = 118_000;
    const job: Job = {
      status: "payment_pending_verification",
      createdBy: SALES,
      activated: false,
      orderTotal: total,
      verified: 0,
      payments: [{ status: "pending", recordedBy: SALES, amount: 18_000 }],
      allocated: 0,
      received: 0,
      writtenOff: 0,
      quantity: 1,
    };

    expect(verifyFirstPayment(job)).toBe("order_active");
    expect(outstanding(job)).toBe(100_000);

    job.status = "sent_to_vendor";
    expect(
      canRecordPayment({
        status: job.status,
        payments: job.payments,
        outstanding: outstanding(job),
      }),
    ).toBe(true);

    job.status = "items_received";
    job.received = 1;
    expect(resolveDeliveryGate(outstanding(job))).toBe("order_on_hold");
    job.status = "order_on_hold";

    expect(() =>
      assertCanDeliver({
        actorRole: "store",
        status: job.status,
        outstanding: outstanding(job),
        itemsFullyReceived: true,
      }),
    ).toThrow(/locked/);

    job.payments.push({ status: "pending", recordedBy: SALES, amount: 100_000 });
    job.status = "payment_pending_verification";
    expect(verifyFirstPayment(job)).toBe("delivery_unlocked");
    expect(outstanding(job)).toBe(0);
  });

  it("does not skip vendor when a later installment is verified mid-fulfillment", () => {
    expect(
      resolvePaymentVerificationNext({
        alreadyActivated: true,
        outstanding: 0,
        currentStatus: "vendor_dispatched",
        itemsFullyReceived: false,
      }),
    ).toBe("vendor_dispatched");
    expect(
      resolvePaymentVerificationNext({
        alreadyActivated: true,
        outstanding: 0,
        currentStatus: "items_received",
        itemsFullyReceived: false,
      }),
    ).toBe("items_received");
    expect(
      resolvePaymentVerificationNext({
        alreadyActivated: true,
        outstanding: 0,
        currentStatus: "items_received",
        itemsFullyReceived: true,
      }),
    ).toBe("delivery_unlocked");
  });

  it("lets Accounts reject a payment so Sales can record again", () => {
    assertCanRejectPayment({
      actorId: ACCOUNTS,
      actorRole: "accounts",
      recordedBy: SALES,
    });
    expect(
      canRecordPayment({
        status: "payment_pending_verification",
        payments: [{ status: "rejected" }],
        outstanding: 10,
      }),
    ).toBe(true);
    expect(() =>
      assertCanRejectQuote({
        actorId: ACCOUNTS,
        actorRole: "accounts",
        quoteCreatedBy: SALES,
        status: "quote_pending_accounts",
        reason: "Discount too high",
      }),
    ).not.toThrow();
    expect(
      canCancelJob({
        quoteStatus: "quote_pending_accounts",
        roles: ["accounts"],
      }),
    ).toBe(true);
  });
});

describe("extra hats vs separation of duties", () => {
  it("lets Sales+Delivery complete handover but still blocks self-approval", () => {
    expect(rolesHavePermission(["sales", "store"], "deliveries.complete")).toBe(true);
    expect(() =>
      assertCanApproveQuote({
        actorId: SALES,
        actorRole: "accounts",
        quoteCreatedBy: SALES,
        status: "quote_pending_accounts",
      }),
    ).toThrow(/own quote/);
    expect(() =>
      assertCanVerifyPayment({
        actorId: SALES,
        actorRole: "accounts",
        recordedBy: SALES,
      }),
    ).toThrow(/you recorded/);
  });
});
