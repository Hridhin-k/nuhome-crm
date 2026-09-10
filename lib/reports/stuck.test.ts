import { describe, expect, it } from "vitest";
import { stuckReasonFor } from "@/lib/reports/stuck";

describe("stuckReasonFor", () => {
  it("classifies blocked jobs", () => {
    expect(
      stuckReasonFor({ quoteStatus: "quote_pending_accounts" }),
    ).toBe("pending_approval");
    expect(
      stuckReasonFor({ orderStatus: "payment_pending_verification" }),
    ).toBe("pending_payment");
    expect(stuckReasonFor({ orderStatus: "order_on_hold" })).toBe("on_hold");
    expect(stuckReasonFor({ overdueVendor: true })).toBe("overdue_vendor");
    expect(stuckReasonFor({ revisionPending: true })).toBe("revision_pending");
    expect(stuckReasonFor({ creditDelivery: "requested" })).toBe(
      "credit_delivery",
    );
    expect(stuckReasonFor({ orderStatus: "order_active" })).toBeNull();
  });
});
