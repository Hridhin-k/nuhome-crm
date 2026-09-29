import { describe, expect, it } from "vitest";
import {
  normalizeMaterialVendors,
  parseVendorColumn,
} from "@/lib/catalog/material-vendors";

const VENDOR = "550e8400-e29b-41d4-a716-446655440000";

describe("normalizeMaterialVendors", () => {
  it("requires a vendor and keeps a single usual supplier", () => {
    expect(() => normalizeMaterialVendors([])).toThrow(/at least one vendor/i);
    expect(() =>
      normalizeMaterialVendors([{ unit_cost: 10 }]),
    ).toThrow(/choose a vendor/i);

    const rows = normalizeMaterialVendors([
      { vendor_id: VENDOR, unit_cost: 450 },
      { vendor_name: "Other Woods", unit_cost: 520, is_preferred: true },
    ]);
    expect(rows[0].is_preferred).toBe(false);
    expect(rows[1].is_preferred).toBe(true);
    expect(rows[0].vendor_name).toBeUndefined();
  });

  it("marks the first vendor as usual when none is chosen", () => {
    const rows = normalizeMaterialVendors([
      { vendor_name: "A", unit_cost: 10 },
      { vendor_name: "B", unit_cost: 12 },
    ]);
    expect(rows[0].is_preferred).toBe(true);
    expect(rows[1].is_preferred).toBe(false);
  });

  it("rejects the same vendor twice and a negative price", () => {
    expect(() =>
      normalizeMaterialVendors([
        { vendor_name: "Adhams", unit_cost: 10 },
        { vendor_name: "adhams", unit_cost: 12 },
      ]),
    ).toThrow(/only be added once/i);
    expect(() =>
      normalizeMaterialVendors([{ vendor_name: "A", unit_cost: -1 }]),
    ).toThrow(/cannot be negative/i);
  });
});

describe("parseVendorColumn", () => {
  it("reads name, price, and the usual-supplier star", () => {
    expect(parseVendorColumn("Adhams:85*|Kerala Woods:90")).toEqual([
      { vendor_name: "Adhams", unit_cost: 85, is_preferred: true },
      { vendor_name: "Kerala Woods", unit_cost: 90, is_preferred: false },
    ]);
  });

  it("rejects a price written without a colon", () => {
    expect(() => parseVendorColumn("Adhams 85")).toThrow(/Name:price/);
  });
});
