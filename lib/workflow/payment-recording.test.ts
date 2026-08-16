import { describe, expect, it } from "vitest";
import {
  canRecordPayment,
  hasPendingPayment,
} from "@/lib/workflow/payment-recording";

describe("payment recording visibility", () => {
  it("blocks when a payment is pending verification", () => {
    expect(
      canRecordPayment({
        status: "payment_pending_verification",
        payments: [{ status: "pending" }],
        outstanding: 175_400,
      }),
    ).toBe(false);
    expect(hasPendingPayment([{ status: "pending" }])).toBe(true);
  });

  it("allows the first payment on a sent quote", () => {
    expect(
      canRecordPayment({
        status: "quote_sent_to_customer",
        payments: [],
        outstanding: 175_400,
      }),
    ).toBe(true);
  });

  it("allows retry after Accounts rejects a payment", () => {
    expect(
      canRecordPayment({
        status: "payment_pending_verification",
        payments: [{ status: "rejected" }],
        outstanding: 175_400,
      }),
    ).toBe(true);
  });

  it("allows balance payments on hold when nothing is pending", () => {
    expect(
      canRecordPayment({
        status: "order_on_hold",
        payments: [{ status: "verified" }],
        outstanding: 50_000,
      }),
    ).toBe(true);
  });

  it("allows a further installment while the job is with the vendor", () => {
    expect(
      canRecordPayment({
        status: "sent_to_vendor",
        payments: [{ status: "verified" }],
        outstanding: 50_000,
      }),
    ).toBe(true);
    expect(
      canRecordPayment({
        status: "order_active",
        payments: [{ status: "verified" }],
        outstanding: 50_000,
      }),
    ).toBe(true);
  });

  it("hides recording when the vendor-stage balance is already cleared", () => {
    expect(
      canRecordPayment({
        status: "sent_to_vendor",
        payments: [{ status: "verified" }],
        outstanding: 0,
      }),
    ).toBe(false);
  });

  it("blocks recording on a cancelled job", () => {
    expect(
      canRecordPayment({
        status: "cancelled",
        payments: [{ status: "verified" }],
        outstanding: 50_000,
      }),
    ).toBe(false);
  });
});
