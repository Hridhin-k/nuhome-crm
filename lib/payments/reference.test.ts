import { describe, expect, it } from "vitest";
import {
  customerPaymentReferenceRequired,
  remainingPaymentKinds,
  vendorPaymentReferenceRequired,
} from "@/lib/payments/reference";

describe("payment reference rules", () => {
  it("requires a customer reference except for nil/credit", () => {
    expect(customerPaymentReferenceRequired("advance")).toBe(true);
    expect(customerPaymentReferenceRequired("full")).toBe(true);
    expect(customerPaymentReferenceRequired("nil")).toBe(false);
  });

  it("requires a vendor reference for non-cash amounts", () => {
    expect(vendorPaymentReferenceRequired("cash", 500)).toBe(false);
    expect(vendorPaymentReferenceRequired("upi", 500)).toBe(true);
    expect(vendorPaymentReferenceRequired("cheque", 500)).toBe(true);
    expect(vendorPaymentReferenceRequired("upi", 0)).toBe(false);
  });

  it("hides Advance after a verified advance exists", () => {
    expect(remainingPaymentKinds([])).toEqual(["advance", "full", "nil"]);
    expect(
      remainingPaymentKinds([{ kind: "advance", status: "pending" }]),
    ).toEqual(["advance", "full", "nil"]);
    expect(
      remainingPaymentKinds([{ kind: "advance", status: "verified" }]),
    ).toEqual(["full", "nil"]);
  });
});
