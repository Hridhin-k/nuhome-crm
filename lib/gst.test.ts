import { describe, expect, it } from "vitest";
import {
  lineDiscountAmount,
  lineGstAmount,
  lineTaxable,
  lineTotalWithGst,
  roundMoney,
} from "@/lib/gst";

describe("quote line amounts", () => {
  it("does not add GST on top of a price that already includes it", () => {
    expect(lineTaxable(1, 10_000)).toBe(10_000);
    expect(lineGstAmount(1, 10_000, 18)).toBe(0);
    expect(lineDiscountAmount(1, 10_000, 10, 18)).toBe(1_000);
    expect(lineTotalWithGst(1, 10_000, 10, 18)).toBe(9_000);
  });

  it("rounds to paise", () => {
    expect(roundMoney(18.005)).toBe(18.01);
    expect(lineGstAmount(1, 99.99, 18)).toBe(0);
  });

  it("takes the whole price off at 100 percent", () => {
    expect(lineTotalWithGst(1, 500, 100, 18)).toBe(0);
  });
});
