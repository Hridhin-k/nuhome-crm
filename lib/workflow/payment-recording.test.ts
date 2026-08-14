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

  it("hides recording once balance is cleared on hold", () => {
    expect(
      canRecordPayment({
        status: "order_on_hold",
        payments: [{ status: "verified" }],
        outstanding: 0,
      }),
    ).toBe(false);
  });
});
