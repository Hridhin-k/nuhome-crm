import { describe, expect, it } from "vitest";
import {
  availableToSend,
  formatExpectedDate,
  isVendorOrderOverdue,
  unaccountedQty,
  vendorBatchStep,
} from "@/lib/workflow/fulfillment";

describe("fulfillment quantities", () => {
  it("lets accounts hold back or split a line", () => {
    expect(
      availableToSend({ quantity: 10, allocated: 6, quantity_written_off: 0 }),
    ).toBe(4);
    expect(
      availableToSend({ quantity: 8, allocated: 8, quantity_written_off: 0 }),
    ).toBe(0);
    expect(
      availableToSend({ quantity: 10, allocated: 10, quantity_written_off: 2 }),
    ).toBe(0);
  });

  it("treats shortage write-off as accounted", () => {
    expect(
      unaccountedQty({
        quantity: 10,
        quantity_received: 8,
        quantity_written_off: 2,
      }),
    ).toBe(0);
    expect(
      unaccountedQty({
        quantity: 10,
        quantity_received: 8,
        quantity_written_off: 0,
      }),
    ).toBe(2);
  });
});

describe("expected delivery", () => {
  it("flags in-flight orders past the promised date", () => {
    expect(
      isVendorOrderOverdue(
        { expected_delivery_at: "2026-08-01", status: "dispatched" },
        "2026-08-14",
      ),
    ).toBe(true);
    expect(
      isVendorOrderOverdue(
        { expected_delivery_at: "2026-08-20", status: "sent" },
        "2026-08-14",
      ),
    ).toBe(false);
    expect(
      isVendorOrderOverdue(
        { expected_delivery_at: "2026-08-01", status: "received" },
        "2026-08-14",
      ),
    ).toBe(false);
  });

  it("formats dates for the floor", () => {
    expect(formatExpectedDate("2026-08-14")).toBe("14/08/2026");
  });
});

describe("vendor batch stepper", () => {
  it("stays allocated until quote, then send, then goods", () => {
    expect(vendorBatchStep({ status: "draft", commercial_status: "pending_quote" })).toBe(
      "Allocated",
    );
    expect(vendorBatchStep({ status: "draft", commercial_status: "quoted" })).toBe("Quoted");
    expect(vendorBatchStep({ status: "draft", commercial_status: "quote_approved" })).toBe(
      "Approved",
    );
    expect(vendorBatchStep({ status: "sent", commercial_status: "quote_approved" })).toBe(
      "Sent",
    );
    expect(vendorBatchStep({ status: "received", commercial_status: "vendor_paid" })).toBe(
      "Received",
    );
  });
});
