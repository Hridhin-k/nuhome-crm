import { describe, expect, it } from "vitest";
import {
  DEFAULT_GST_RATE,
  lineGstAmount,
  lineTaxable,
  lineTotalWithGst,
  roundMoney,
} from "@/lib/gst";

describe("GST on a quote line", () => {
  it("treats sell price as GST-exclusive", () => {
    expect(lineTaxable(2, 1000, 100)).toBe(1900);
    expect(lineGstAmount(2, 1000, 100, DEFAULT_GST_RATE)).toBe(342);
    expect(lineTotalWithGst(2, 1000, 100, DEFAULT_GST_RATE)).toBe(2242);
  });

  it("rounds to paise", () => {
    expect(roundMoney(18.005)).toBe(18.01);
    expect(lineGstAmount(1, 99.99, 0, 18)).toBe(18);
  });

  it("does not tax a fully discounted line", () => {
    expect(lineGstAmount(1, 500, 500, 18)).toBe(0);
  });
});
