import { describe, expect, it } from "vitest";
import {
  DEFAULT_GST_RATE,
  lineDiscountAmount,
  lineGstAmount,
  lineTaxable,
  lineTotalWithGst,
  roundMoney,
} from "@/lib/gst";

describe("GST on a quote line", () => {
  it("keeps GST on the full price and takes the percent off the tax-inclusive total", () => {
    expect(lineTaxable(1, 10_000)).toBe(10_000);
    expect(lineGstAmount(1, 10_000, DEFAULT_GST_RATE)).toBe(1_800);
    expect(lineDiscountAmount(1, 10_000, 10, DEFAULT_GST_RATE)).toBe(1_180);
    expect(lineTotalWithGst(1, 10_000, 10, DEFAULT_GST_RATE)).toBe(10_620);
  });

  it("rounds to paise", () => {
    expect(roundMoney(18.005)).toBe(18.01);
    expect(lineGstAmount(1, 99.99, 18)).toBe(18);
  });

  it("still calculates GST when the line is fully discounted", () => {
    expect(lineGstAmount(1, 500, 18)).toBe(90);
    expect(lineTotalWithGst(1, 500, 100, 18)).toBe(0);
  });
});
