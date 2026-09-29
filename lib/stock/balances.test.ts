import { describe, expect, it } from "vitest";
import { officeBalances, quantityDelta } from "@/lib/stock/balances";

describe("officeBalances", () => {
  it("counts pieces at the office and pieces held on quotes", () => {
    const balances = officeBalances([
      { material_id: "a", kind: "adjustment", quantity: 10 },
      { material_id: "a", kind: "reservation", quantity: 2 },
      { material_id: "a", kind: "handover", quantity: 1 },
      { material_id: "b", kind: "receipt", quantity: 4 },
      { material_id: "b", kind: "release", quantity: 1 },
    ]);
    expect(balances.get("a")).toEqual({ onHand: 9, reserved: 1 });
    expect(balances.get("b")).toEqual({ onHand: 4, reserved: -1 });
  });
});

describe("quantityDelta", () => {
  it("is zero when the saved quantity already matches", () => {
    expect(quantityDelta(4, 4)).toBe(0);
    expect(quantityDelta(4, 4.0000001)).toBe(0);
  });

  it("is the change from the current quantity", () => {
    expect(quantityDelta(0, 6)).toBe(6);
    expect(quantityDelta(6, 2)).toBe(-4);
  });
});
