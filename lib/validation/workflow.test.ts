import { describe, expect, it } from "vitest";
import {
  cancelJobSchema,
  completeDeliverySchema,
  createQuoteSchema,
  customerSchema,
  quoteItemSchema,
  receiveItemsSchema,
  recordPaymentSchema,
  rejectPaymentSchema,
  rejectQuoteSchema,
  reviseQuoteSchema,
  sendToVendorSchema,
  verifyPaymentSchema,
  writeOffItemsSchema,
} from "@/lib/validation/workflow";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const UUID_B = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";

const validItem = {
  description: "Modular kitchen",
  quantity: 1,
  unit_price: 10000,
};

describe("quoteItemSchema", () => {
  it("accepts a priced line and defaults cost, discount, and tax", () => {
    const parsed = quoteItemSchema.parse(validItem);
    expect(parsed.unit_cost).toBe(0);
    expect(parsed.discount).toBe(0);
    expect(parsed.tax).toBe(0);
  });

  it("rejects empty description, zero quantity, and GST over 100", () => {
    expect(() => quoteItemSchema.parse({ ...validItem, description: "" })).toThrow();
    expect(() => quoteItemSchema.parse({ ...validItem, quantity: 0 })).toThrow();
    expect(() => quoteItemSchema.parse({ ...validItem, unit_price: -1 })).toThrow();
    expect(() => quoteItemSchema.parse({ ...validItem, gst_rate: 101 })).toThrow();
    expect(() => quoteItemSchema.parse({ ...validItem, hsn_code: "123456789" })).toThrow();
  });

  it("accepts GST 0–100 and an 8-character HSN", () => {
    expect(quoteItemSchema.parse({ ...validItem, gst_rate: 0, hsn_code: "12345678" }).gst_rate).toBe(0);
    expect(quoteItemSchema.parse({ ...validItem, gst_rate: 100 }).gst_rate).toBe(100);
  });
});

describe("createQuoteSchema / reviseQuoteSchema", () => {
  it("requires a customer and at least one line", () => {
    expect(() => createQuoteSchema.parse({ customer_id: UUID, items: [] })).toThrow();
    expect(() => createQuoteSchema.parse({ customer_id: "not-a-uuid", items: [validItem] })).toThrow();
    expect(createQuoteSchema.parse({ customer_id: UUID, items: [validItem] }).items).toHaveLength(1);
  });

  it("requires a quote id to revise", () => {
    expect(reviseQuoteSchema.parse({ quote_id: UUID, items: [validItem] }).quote_id).toBe(UUID);
    expect(() => reviseQuoteSchema.parse({ items: [validItem] })).toThrow();
  });
});

describe("rejectQuoteSchema / cancelJobSchema", () => {
  it("requires a non-blank reason", () => {
    expect(() => rejectQuoteSchema.parse({ quote_id: UUID, reason: "  " })).toThrow();
    expect(() => cancelJobSchema.parse({ quote_id: UUID, reason: "" })).toThrow();
    expect(rejectQuoteSchema.parse({ quote_id: UUID, reason: "Margin too thin" }).reason).toBe(
      "Margin too thin",
    );
    expect(cancelJobSchema.parse({ quote_id: UUID, reason: "Customer walked" }).reason).toBe(
      "Customer walked",
    );
  });
});

describe("recordPaymentSchema", () => {
  it("accepts cash / UPI / bank / cheque / card / other methods", () => {
    for (const method of ["cash", "upi", "bank_transfer", "cheque", "card", "other"] as const) {
      expect(
        recordPaymentSchema.parse({
          quote_id: UUID,
          kind: "advance",
          amount: 1000,
          method,
        }).method,
      ).toBe(method);
    }
  });

  it("forces nil to amount 0 and advance/full above 0", () => {
    expect(() =>
      recordPaymentSchema.parse({ quote_id: UUID, kind: "nil", amount: 10 }),
    ).toThrow(/Nil payment/);
    expect(() =>
      recordPaymentSchema.parse({ quote_id: UUID, kind: "advance", amount: 0 }),
    ).toThrow(/greater than 0/);
    expect(() =>
      recordPaymentSchema.parse({ quote_id: UUID, kind: "full", amount: 0 }),
    ).toThrow(/greater than 0/);
    expect(recordPaymentSchema.parse({ quote_id: UUID, kind: "nil", amount: 0 }).amount).toBe(0);
    expect(recordPaymentSchema.parse({ quote_id: UUID, kind: "full", amount: 500 }).kind).toBe(
      "full",
    );
  });

  it("rejects unknown payment kinds", () => {
    expect(() =>
      recordPaymentSchema.parse({ quote_id: UUID, kind: "installment", amount: 100 }),
    ).toThrow();
  });
});

describe("verify / reject payment", () => {
  it("lets Accounts verify without notes and requires a reason to reject", () => {
    expect(verifyPaymentSchema.parse({ payment_id: UUID }).payment_id).toBe(UUID);
    expect(() => rejectPaymentSchema.parse({ payment_id: UUID, notes: "  " })).toThrow();
    expect(
      rejectPaymentSchema.parse({ payment_id: UUID, notes: "Wrong UPI ref" }).notes,
    ).toBe("Wrong UPI ref");
  });
});

describe("fulfillment schemas", () => {
  it("requires at least one vendor line with a positive quantity", () => {
    expect(() =>
      sendToVendorSchema.parse({ order_id: UUID, vendor_id: UUID_B, items: [] }),
    ).toThrow();
    expect(() =>
      sendToVendorSchema.parse({
        order_id: UUID,
        vendor_id: UUID_B,
        items: [{ order_item_id: UUID, quantity: 0 }],
      }),
    ).toThrow();
    expect(
      sendToVendorSchema.parse({
        order_id: UUID,
        vendor_id: UUID_B,
        expected_delivery: "2026-08-20",
        items: [{ order_item_id: UUID, quantity: 2 }],
      }).items[0].quantity,
    ).toBe(2);
  });

  it("allows a zero received qty (partial GRN of nothing this trip) but not empty lists", () => {
    expect(
      receiveItemsSchema.parse({
        vendor_order_id: UUID,
        received: [{ order_item_id: UUID, quantity: 0 }],
      }).received[0].quantity,
    ).toBe(0);
    expect(() => receiveItemsSchema.parse({ vendor_order_id: UUID, received: [] })).toThrow();
  });

  it("accepts every write-off reason and rejects unknown ones", () => {
    for (const reason of ["shortage", "damaged", "returned", "cancelled"] as const) {
      expect(
        writeOffItemsSchema.parse({
          order_id: UUID,
          items: [{ order_item_id: UUID, quantity: 1, reason }],
        }).items[0].reason,
      ).toBe(reason);
    }
    expect(() =>
      writeOffItemsSchema.parse({
        order_id: UUID,
        items: [{ order_item_id: UUID, quantity: 1, reason: "lost" }],
      }),
    ).toThrow();
  });

  it("requires an order id to complete delivery", () => {
    expect(completeDeliverySchema.parse({ order_id: UUID, notes: "handed over" }).order_id).toBe(
      UUID,
    );
    expect(() => completeDeliverySchema.parse({})).toThrow();
  });
});

describe("customerSchema", () => {
  it("requires a name and accepts billing vs site plus GSTIN", () => {
    expect(() => customerSchema.parse({ name: "" })).toThrow();
    const parsed = customerSchema.parse({
      name: "Priya Nair",
      phone: "9876543210",
      email: "",
      gstin: "32AAAAA0000A1Z5",
      billing_address: "Showroom bill-to",
      site_address: "Site at Kakkanad",
    });
    expect(parsed.gstin).toBe("32AAAAA0000A1Z5");
    expect(parsed.billing_address).not.toBe(parsed.site_address);
  });

  it("rejects a GSTIN longer than 15 characters and a bad email", () => {
    expect(() => customerSchema.parse({ name: "A", gstin: "1234567890123456" })).toThrow();
    expect(() => customerSchema.parse({ name: "A", email: "not-an-email" })).toThrow();
  });
});
