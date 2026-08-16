import { describe, expect, it } from "vitest";
import { lineFromMaterial, linesFromQuoteItems, withGst } from "@/lib/quotes/lines";
import { DEFAULT_GST_RATE, lineGstAmount, lineTaxable, lineTotalWithGst, roundMoney } from "@/lib/gst";
import { publicQuotePath, publicQuoteUrl } from "@/lib/quotes/public-url";
import { isOrderNumber, orderRef } from "@/lib/orders/ref";
import { formatInr, formatInrExact } from "@/lib/format/money";
import { relativeTime } from "@/lib/format/relative-time";
import { afterEach, beforeEach, vi } from "vitest";

describe("quote lines with GST", () => {
  it("fills tax from rate when adding a material", () => {
    const line = lineFromMaterial({
      id: "m1",
      name: "Cabinet",
      default_sell_price: "1000",
      default_cost: "400",
      hsn_code: "9403",
      gst_rate: 18,
    });
    expect(line.quantity).toBe(1);
    expect(line.gst_rate).toBe(18);
    expect(line.tax).toBe(180);
    expect(line.hsn_code).toBe("9403");
    expect(line.material_id).toBe("m1");
  });

  it("defaults GST to 18% when the material has no rate", () => {
    const line = lineFromMaterial({
      id: "m2",
      name: "Handle",
      default_sell_price: 100,
      default_cost: 40,
    });
    expect(line.gst_rate).toBe(DEFAULT_GST_RATE);
    expect(line.tax).toBe(18);
  });

  it("leaves tax alone when the line has no GST rate", () => {
    const line = withGst({
      key: "1",
      description: "Labour",
      quantity: 1,
      unit_price: 500,
      unit_cost: 0,
      discount: 0,
      tax: 0,
      gst_rate: 0,
    });
    expect(line.tax).toBe(0);
  });

  it("recomputes tax from stored quote items", () => {
    const [line] = linesFromQuoteItems([
      {
        id: "qi1",
        material_id: null,
        description: "Counter",
        quantity: "2",
        unit_price: "5000",
        unit_cost: "2000",
        discount: "500",
        tax: "0",
        gst_rate: "18",
      },
    ]);
    expect(line.key).toBe("qi1");
    expect(line.material_id).toBeUndefined();
    expect(line.tax).toBe(lineGstAmount(2, 5000, 500, 18));
  });
});

describe("GST edge cases", () => {
  it("handles 0, 5, 12, 18, and 28 percent and a discount larger than the line", () => {
    expect(lineGstAmount(1, 1000, 0, 0)).toBe(0);
    expect(lineGstAmount(1, 1000, 0, 5)).toBe(50);
    expect(lineGstAmount(1, 1000, 0, 12)).toBe(120);
    expect(lineGstAmount(1, 1000, 0, 18)).toBe(180);
    expect(lineGstAmount(1, 1000, 0, 28)).toBe(280);
    expect(lineTaxable(1, 100, 250)).toBe(0);
    expect(lineTotalWithGst(1, 100, 250, 18)).toBe(0);
    expect(roundMoney(0)).toBe(0);
    expect(roundMoney(Number.NaN)).toBe(0);
  });
});

describe("public quotation URL and order ref", () => {
  it("builds a public path that never includes localhost when given a public origin", () => {
    expect(publicQuotePath("tok_abc")).toBe("/q/tok_abc");
    expect(publicQuoteUrl("https://nuhome-crm.vercel.app", "tok_abc")).toBe(
      "https://nuhome-crm.vercel.app/q/tok_abc",
    );
  });

  it("recognizes ORD- numbers and falls back to a short id", () => {
    expect(isOrderNumber("ORD-1042")).toBe(true);
    expect(isOrderNumber("ord-9")).toBe(true);
    expect(isOrderNumber("NH-1042")).toBe(false);
    expect(isOrderNumber("  ")).toBe(false);
    expect(orderRef({ order_number: "ORD-1042" })).toBe("ORD-1042");
    expect(orderRef({ id: "abcdef12-9999-4000-8000-000000000000" })).toBe("ORD-ABCDEF12");
    expect(orderRef({})).toBe("Order");
  });
});

describe("INR formatting", () => {
  it("uses Indian grouping and optional paise", () => {
    expect(formatInr(175_400)).toMatch(/1,75,400/);
    expect(formatInr(null)).toMatch(/0/);
    expect(formatInrExact(175_400.5)).toMatch(/1,75,400\.50/);
    expect(formatInrExact(undefined)).toMatch(/0\.00/);
  });
});

describe("relativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T10:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("buckets just now, minutes, hours, days, and older dates", () => {
    expect(relativeTime("2026-08-17T10:00:00.000Z")).toBe("just now");
    expect(relativeTime("2026-08-17T09:55:00.000Z")).toBe("5 min ago");
    expect(relativeTime("2026-08-17T07:00:00.000Z")).toBe("3h ago");
    expect(relativeTime("2026-08-15T10:00:00.000Z")).toBe("2d ago");
    expect(relativeTime("2026-08-01T10:00:00.000Z")).toMatch(/Aug/);
    expect(relativeTime("not-a-date")).toBe("");
  });
});
