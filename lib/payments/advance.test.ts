import { describe, expect, it } from "vitest";
import { defaultAdvanceAmount } from "@/lib/payments/advance";

describe("defaultAdvanceAmount", () => {
  it("defaults to half of outstanding", () => {
    expect(defaultAdvanceAmount(100_000)).toBe(50_000);
    expect(defaultAdvanceAmount(1)).toBe(0.5);
  });

  it("returns 0 when there is nothing outstanding", () => {
    expect(defaultAdvanceAmount(0)).toBe(0);
    expect(defaultAdvanceAmount(-10)).toBe(0);
    expect(defaultAdvanceAmount(Number.NaN)).toBe(0);
  });
});
