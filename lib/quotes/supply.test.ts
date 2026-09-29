import { describe, expect, it } from "vitest";
import { lineFromMaterial, type QuoteLine } from "@/lib/quotes/lines";
import {
  addCatalogueMaterial,
  officeShelf,
  setLineQuantity,
  setLineSupply,
} from "@/lib/quotes/supply";

function line(partial: Partial<QuoteLine> & Pick<QuoteLine, "key">): QuoteLine {
  return {
    description: "Handle",
    quantity: 1,
    unit_price: 100,
    unit_cost: 40,
    discount: 0,
    tax: 18,
    gst_rate: 18,
    supply_source: "vendor",
    ...partial,
  };
}

describe("office supply split", () => {
  it("starts a line from the shelf when stock covers one piece", () => {
    const row = lineFromMaterial({
      id: "m1",
      name: "Handle",
      default_sell_price: 100,
      default_cost: 40,
      gst_rate: 18,
      office_available: 4,
    });
    expect(row.supply_source).toBe("office");
  });

  it("orders a line when the shelf is empty", () => {
    const row = lineFromMaterial({
      id: "m1",
      name: "Handle",
      default_sell_price: 100,
      default_cost: 40,
      office_available: 0,
    });
    expect(row.supply_source).toBe("vendor");
  });

  it("splits a quantity above the shelf into office and vendor lines", () => {
    const lines = [
      line({
        key: "a",
        material_id: "m1",
        quantity: 2,
        supply_source: "office",
      }),
    ];
    const next = setLineQuantity(lines, "a", 5, new Map([["m1", 3]]), () => "b");
    expect(next.map((row) => [row.key, row.supply_source, row.quantity])).toEqual([
      ["a", "office", 3],
      ["b", "vendor", 2],
    ]);
  });

  it("adds further pieces to the existing order line", () => {
    const lines = [
      line({
        key: "a",
        material_id: "m1",
        quantity: 3,
        supply_source: "office",
      }),
      line({
        key: "b",
        material_id: "m1",
        quantity: 1,
        supply_source: "vendor",
      }),
    ];
    const next = setLineQuantity(lines, "a", 4, new Map([["m1", 3]]));
    expect(next.map((row) => [row.key, row.supply_source, row.quantity])).toEqual([
      ["a", "office", 3],
      ["b", "vendor", 2],
    ]);
  });

  it("increments an ordered line instead of adding another row", () => {
    const material = {
      id: "m1",
      name: "Handle",
      default_sell_price: 100,
      default_cost: 40,
      office_available: 0,
    };
    const shelf = new Map([["m1", 0]]);
    const once = addCatalogueMaterial([], material, shelf);
    const twice = addCatalogueMaterial(once, material, shelf);
    expect(twice).toHaveLength(1);
    expect(twice[0]?.quantity).toBe(2);
    expect(twice[0]?.supply_source).toBe("vendor");
  });

  it("lets staff order the full quantity even when stock exists", () => {
    const lines = [
      line({
        key: "a",
        material_id: "m1",
        quantity: 2,
        supply_source: "office",
      }),
    ];
    const next = setLineSupply(lines, "a", "vendor", new Map([["m1", 10]]));
    expect(next).toHaveLength(1);
    expect(next[0]?.supply_source).toBe("vendor");
    expect(officeShelf(next, "m1", 10)).toBe(10);
  });
});
