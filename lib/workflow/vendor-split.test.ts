import { describe, expect, it } from "vitest";
import {
  groupLinesByVendor,
  suggestedVendorQuoteAmount,
  suggestedVendorQuoteRef,
} from "@/lib/workflow/vendor-split";

const KITCHEN = "550e8400-e29b-41d4-a716-446655440000";
const QUARTZ = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const VENDOR_A = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const VENDOR_B = "11111111-1111-4111-8111-111111111111";

describe("vendor quotation split", () => {
  it("keeps one batch when every line uses the same vendor", () => {
    const batches = groupLinesByVendor([
      { order_item_id: KITCHEN, vendor_id: VENDOR_A, quantity: 8, unit_cost: 1000 },
      { order_item_id: QUARTZ, vendor_id: VENDOR_A, quantity: 10, unit_cost: 500 },
    ]);
    expect(batches).toHaveLength(1);
    expect(batches[0].quote_amount).toBe(13000);
  });

  it("splits the quotation across vendors and fills qty from the order lines", () => {
    const batches = groupLinesByVendor([
      { order_item_id: KITCHEN, vendor_id: VENDOR_A, quantity: 8, unit_cost: 1000 },
      { order_item_id: QUARTZ, vendor_id: VENDOR_B, quantity: 10, unit_cost: 500 },
    ]);
    expect(batches).toHaveLength(2);
    expect(batches.find((batch) => batch.vendor_id === VENDOR_A)?.quote_amount).toBe(8000);
    expect(batches.find((batch) => batch.vendor_id === VENDOR_B)?.quote_amount).toBe(5000);
  });

  it("auto-fills a quote reference from the order and vendor name", () => {
    expect(suggestedVendorQuoteRef("ORD-1029", "Kolo Kitchen")).toBe("ORD-1029-KOLO-KITCHEN");
    expect(suggestedVendorQuoteAmount([{ quantity: 2, unit_cost: 99.999 }])).toBe(200);
  });
});
