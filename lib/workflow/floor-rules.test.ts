import { describe, expect, it } from "vitest";
import {
  availableToSend,
  earliestOpenExpectedDate,
  formatExpectedDate,
  isVendorOrderOverdue,
  orderHasOverdueVendor,
  todayIsoDate,
  unaccountedQty,
  vendorOrderList,
  WRITE_OFF_LABELS,
  WRITE_OFF_REASONS,
} from "@/lib/workflow/fulfillment";
import {
  canRecordPayment,
  pendingPaymentMessage,
} from "@/lib/workflow/payment-recording";
import { canCancelJob, isCancelledStatus } from "@/lib/workflow/cancel";
import { WORKFLOW_STATUSES, type WorkflowStatus } from "@/lib/workflow/types";

describe("fulfillment remainder and overdue", () => {
  it("labels every write-off reason", () => {
    for (const reason of WRITE_OFF_REASONS) {
      expect(WRITE_OFF_LABELS[reason].length).toBeGreaterThan(0);
    }
  });

  it("never returns a negative available or unaccounted qty", () => {
    expect(availableToSend({ quantity: 2, allocated: 9, quantity_written_off: 1 })).toBe(0);
    expect(unaccountedQty({ quantity: 2, quantity_received: 9, quantity_written_off: 1 })).toBe(0);
  });

  it("normalizes a single vendor order or a missing list", () => {
    expect(vendorOrderList(null)).toEqual([]);
    expect(vendorOrderList(undefined)).toEqual([]);
    expect(vendorOrderList({ status: "sent" })).toEqual([{ status: "sent" }]);
    expect(vendorOrderList([{ status: "sent" }, { status: "received" }])).toHaveLength(2);
  });

  it("picks the earliest promised date among in-flight batches", () => {
    expect(
      earliestOpenExpectedDate([
        { status: "sent", expected_delivery_at: "2026-08-20" },
        { status: "dispatched", expected_delivery_at: "2026-08-18T10:00:00.000Z" },
        { status: "received", expected_delivery_at: "2026-08-01" },
      ]),
    ).toBe("2026-08-18");
    expect(earliestOpenExpectedDate([{ status: "received", expected_delivery_at: "2026-08-01" }])).toBeNull();
  });

  it("flags an order overdue only when an in-flight batch is past due", () => {
    expect(
      orderHasOverdueVendor(
        [
          { status: "received", expected_delivery_at: "2026-08-01" },
          { status: "sent", expected_delivery_at: "2026-08-20" },
        ],
        "2026-08-14",
      ),
    ).toBe(false);
    expect(
      orderHasOverdueVendor(
        { status: "sent", expected_delivery_at: "2026-08-01" },
        "2026-08-14",
      ),
    ).toBe(true);
    expect(isVendorOrderOverdue({ expected_delivery_at: null, status: "sent" })).toBe(false);
    expect(formatExpectedDate(null)).toBeNull();
    expect(formatExpectedDate("nope")).toBe("nope");
    expect(todayIsoDate(new Date("2026-08-16T22:30:00.000Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("payment recording on every status", () => {
  const unpaid = { payments: [] as { status: string }[], outstanding: 10_000 };

  it("allows recording only on the live money statuses", () => {
    const allowed = new Set<WorkflowStatus>([
      "quote_sent_to_customer",
      "order_active",
      "sent_to_vendor",
      "vendor_dispatched",
      "items_received",
      "order_on_hold",
      "delivery_pending_payment",
    ]);
    for (const status of WORKFLOW_STATUSES) {
      const ok = canRecordPayment({ status, ...unpaid });
      if (status === "payment_pending_verification") {
        expect(ok).toBe(false);
        continue;
      }
      expect(ok).toBe(allowed.has(status));
    }
  });

  it("blocks draft, approved, unlocked, delivered, closed, and cancelled", () => {
    for (const status of [
      "quote_draft",
      "quote_pending_accounts",
      "quote_rejected",
      "quote_approved",
      "delivery_unlocked",
      "delivered",
      "closed",
      "cancelled",
    ] as const) {
      expect(canRecordPayment({ status, payments: [], outstanding: 10_000 })).toBe(false);
    }
  });

  it("explains a pending verification and stays silent otherwise", () => {
    expect(pendingPaymentMessage([{ status: "pending" }])).toMatch(/pending Accounts verification/);
    expect(pendingPaymentMessage([{ status: "verified" }])).toBeNull();
  });
});

describe("cancel coverage", () => {
  it("lets Admin cancel a live job and nobody cancel a finished one", () => {
    expect(canCancelJob({ quoteStatus: "quote_draft", roles: "admin" })).toBe(true);
    expect(
      canCancelJob({
        quoteStatus: "quote_sent_to_customer",
        orderStatus: "closed",
        roles: "admin",
      }),
    ).toBe(false);
    expect(isCancelledStatus("cancelled")).toBe(true);
    expect(isCancelledStatus("closed")).toBe(false);
    expect(
      canCancelJob({
        quoteStatus: "quote_approved",
        roles: ["sales", "accounts"],
      }),
    ).toBe(true);
    expect(
      canCancelJob({
        quoteStatus: "quote_approved",
        roles: "accounts",
      }),
    ).toBe(false);
  });
});
